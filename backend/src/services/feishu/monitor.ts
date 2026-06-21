/**
 * 飞书 WebSocket 长连接监听
 * 参考 OpenClaw extensions/feishu/src/monitor.transport.ts
 *
 * 使用 @larksuiteoapi/node-sdk 的 WSClient 实现 WebSocket 连接
 */
import * as Lark from '@larksuiteoapi/node-sdk';
import type { FeishuConfig } from '../../types/index.js';
import { knowledgeBaseService } from '../knowledge-base.js';
import { configStore } from '../../config/store.js';
import { getDedupInstance } from './dedup.js';
import { sendText, addReaction, replyMessage, createCardEntity, replyCardEntity, sendCardEntity, updateCardEntity, finalizeCardEntity } from './send.js';
import logger from '../../utils/logger.js';

interface FeishuEventContext {
  channelId: string;
  appId: string;
  config: FeishuConfig;
  botOpenId?: string;
  botName?: string;
}

const activeConnections = new Map<string, {
  wsClient: Lark.WSClient;
  abortController: AbortController;
}>();

/** 解析消息文本内容 */
function parseMessageContent(msgType: string, content: string): string {
  if (msgType === 'text') {
    try {
      const parsed = JSON.parse(content);
      return parsed.text?.trim() || '';
    } catch {
      return content.trim();
    }
  }
  if (msgType === 'post') {
    try {
      const parsed = JSON.parse(content);
      const lines: string[] = [];
      for (const line of parsed.content || []) {
        for (const block of line) {
          if (block.tag === 'text') lines.push(block.text || '');
          if (block.tag === 'at') lines.push(`@${block.user_name || '某人'}`);
        }
      }
      return lines.join('').trim();
    } catch {
      return '';
    }
  }
  return '';
}

/** 处理收到的飞书消息 */
async function handleMessage(context: FeishuEventContext, event: any): Promise<void> {
  const { channelId, appId, config } = context;

  logger.debug('Feishu raw event', { channelId, eventKeys: Object.keys(event || {}) });

  // 提取消息内容 - 支持多种事件格式
  const eventData = event?.event || event?.message || event;
  const message = eventData?.message || eventData;

  if (!message) {
    logger.warn('Feishu event has no message field', { channelId });
    return;
  }

  const messageId = message.message_id || event?.header?.event_id;
  const chatType = message.chat_type;
  const msgType = message.msg_type;
  const rawContent = message.content || '{}';

  // 提取发送者信息 - 支持多种格式
  const sender = event?.sender || eventData?.sender || {};
  const senderOpenId = sender?.sender_id?.open_id || sender?.id?.open_id;
  const senderId = sender?.sender_id?.user_id || senderOpenId || 'unknown';

  logger.info('Feishu message parsed', {
    channelId,
    messageId,
    chatType,
    msgType,
    senderOpenId,
    rawContent: String(rawContent).slice(0, 100),
  });

  // 跳过空消息
  const textContent = parseMessageContent(msgType || 'text', rawContent);
  if (!textContent) {
    logger.debug('Feishu message skipped: empty content', { channelId, messageId });
    return;
  }

  // 去重检查
  if (messageId) {
    const dedup = getDedupInstance(appId, config.dedupWindowMs);
    if (dedup.isDuplicate(messageId)) {
      logger.debug('Feishu message skipped: duplicate', { channelId, messageId });
      return;
    }
    dedup.mark(messageId);
  }

  if (messageId) {
    try {
      const ok = await addReaction(config, messageId, 'thumbsup');
      logger.info('Feishu reaction result', { messageId, ok });
    } catch (e: any) {
      logger.debug('Feishu reaction error', { messageId, error: e.message });
    }
  }

  logger.info('Feishu message to process', {
    channelId,
    messageId,
    chatType,
    senderId,
    content: textContent.slice(0, 100),
  });

  const channels = configStore.get('channels');
  const channel = channels.find(c => c.id === channelId);
  if (!channel || !channel.enabled) {
    logger.warn('Feishu channel not found or disabled', { channelId });
    return;
  }

  const knowledgeBases = configStore.get('knowledgeBases');
  const kb = knowledgeBases.find(k => k.id === channel.knowledgeBaseId && k.enabled);
  if (!kb) {
    logger.error('Feishu channel: knowledge base not found or disabled', {
      channelId,
      knowledgeBaseId: channel.knowledgeBaseId
    });
    return;
  }

  const fsConfig = channel.config as FeishuConfig;

  logger.info('Feishu calling knowledge base', { channelId, kbName: kb.name, kbType: kb.type, responseMode: fsConfig.responseMode || 'blocking' });

  const userId = `feishu_${senderOpenId || senderId}`;

  try {
    let replyText: string;

    if (fsConfig.responseMode === 'streaming') {
      // ===== 流式模式（打字机效果：CardKit 卡片实体 + 流式更新）=====
      // 1. 创建卡片实体 → 2. 发送引用消息 → 3. 流式更新卡片内容 → 4. 关闭流式模式
      let cardId: string | null = null;
      let sequence = 1;

      try {
        cardId = await createCardEntity(config, '⚡ 正在生成...');
        if (!cardId) {
          throw new Error('failed to create card entity');
        }
      } catch (e: any) {
        logger.warn('Feishu streaming: card entity create failed, fallback to blocking mode', { error: e.message });
        // fallback：退化为阻塞模式
        const chatResponse = await knowledgeBaseService.chat(kb, {
          knowledgeBaseId: kb.id,
          message: textContent,
          userId
        });
        const fallbackText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';
        if (messageId) {
          try {
            await replyMessage(config, messageId, 'text', JSON.stringify({ text: fallbackText }));
          } catch { /* ignore */ }
        } else if (senderOpenId) {
          await sendText(config, senderOpenId, 'open_id', fallbackText);
        }
        return;
      }

      // 2. 发送卡片消息（引用用户消息）
      try {
        if (messageId) {
          await replyCardEntity(config, messageId, cardId);
        } else if (senderOpenId) {
          await sendCardEntity(config, senderOpenId, 'open_id', cardId);
        }
        logger.info('Feishu streaming: card entity message sent', { channelId, cardId });
      } catch (e: any) {
        logger.warn('Feishu streaming: send card message failed', { channelId, error: e.message });
        // fallback：用文本消息发送
        if (senderOpenId) {
          try {
            await sendText(config, senderOpenId, 'open_id', '⚡ 正在生成...');
          } catch { /* ignore */ }
        }
      }

      // 3. 流式响应：累积内容 + 定时更新卡片（节流）
      //    scheduleEdit: 只有距离上次更新超过 MIN_EDIT_INTERVAL_MS 且有新内容才更新
      //    关键：编辑进行中时新 chunk 不立即触发，但设置 needsFlush=true
      //          编辑完成时若 needsFlush=true 则立即递归再编辑一次
      let pendingFullText = '';
      let lastEditMs = 0;
      let editInProgress = false;
      let needsFlush = false;
      const MIN_EDIT_INTERVAL_MS = 500;
      let chunkCount = 0;
      let updateCount = 0;

      const scheduleEdit = async () => {
        const now = Date.now();
        needsFlush = true;  // 有新内容待发送

        if (editInProgress) return;  // 正在编辑 → 跳过（完成后递归处理）
        if (now - lastEditMs < MIN_EDIT_INTERVAL_MS) return;  // 太频繁 → 稍后再处理
        if (!cardId || !pendingFullText) return;  // 没有卡片ID 或内容 → 跳过

        editInProgress = true;
        needsFlush = false;
        const textToSend = pendingFullText;
        const currentSeq = ++sequence;
        updateCount++;

        try {
          await updateCardEntity(config, cardId, currentSeq, textToSend);
          lastEditMs = Date.now();
        } catch (e: any) {
          logger.warn('Feishu streaming: updateCardEntity failed', { channelId, cardId, error: e.message });
        } finally {
          editInProgress = false;
          // 若编辑期间又有新 chunk 到来，立即再编辑一次
          if (needsFlush && cardId && pendingFullText) {
            lastEditMs = Date.now() - MIN_EDIT_INTERVAL_MS;  // 解除时间限制
            scheduleEdit();
          }
        }
      };

      const chatResponse = await knowledgeBaseService.chatStreaming(
        kb,
        { knowledgeBaseId: kb.id, message: textContent, userId },
        (chunkText, fullText) => {
          pendingFullText = fullText;
          chunkCount++;
          scheduleEdit();
        }
      );
      const finalText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';

      logger.info('Feishu streaming finished', { channelId, chunkCount, updateCount, textLength: finalText.length });

      // 4. 流结束后：最后一次更新，关闭流式模式（streaming_mode=false）
      if (cardId) {
        try {
          const finalSeq = ++sequence;
          await finalizeCardEntity(config, cardId, finalSeq, finalText);
          logger.info('Feishu streaming: card entity finalized', { channelId, cardId });
        } catch (e: any) {
          logger.warn('Feishu streaming: finalizeCardEntity failed', { channelId, error: e.message });
        }
      }
    } else {
      // ===== 阻塞模式：等完整回答后一次性发送 =====
      const chatResponse = await knowledgeBaseService.chat(kb, {
        knowledgeBaseId: kb.id,
        message: textContent,
        userId
      });
      replyText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';

      logger.info('Feishu knowledge base replied', { channelId, replyLength: replyText.length });

      if (messageId) {
        try {
          await replyMessage(config, messageId, 'text', JSON.stringify({ text: replyText }));
          logger.info('Feishu final reply (quoted) sent successfully', { channelId, messageId, replyLength: replyText.length });
        } catch (sendErr: any) {
          logger.warn('Feishu quoted reply failed, falling back to direct reply', { channelId, error: sendErr.message });
          if (senderOpenId) {
            try {
              await sendText(config, senderOpenId, 'open_id', replyText);
            } catch (fallbackErr: any) {
              logger.error('Feishu fallback reply also failed', { channelId, error: fallbackErr.message });
            }
          }
        }
      } else if (senderOpenId) {
        await sendText(config, senderOpenId, 'open_id', replyText);
      }
    }
  } catch (err: any) {
    logger.error('Feishu chat failed', { channelId, error: err.message, stack: err.stack?.slice(0, 200) });
    const errorText = `抱歉，处理消息时出现问题：${err.message}`;
    if (messageId) {
      try {
        await replyMessage(config, messageId, 'text', JSON.stringify({ text: errorText }));
      } catch { /* ignore */ }
    }
  }
}

/** 启动飞书频道的 WebSocket 连接 */
export async function startChannel(
  channelId: string,
  config: FeishuConfig
): Promise<void> {
  // 已存在则先停止
  await stopChannel(channelId);

  const connectionMode = config.connectionMode || 'websocket';

  if (connectionMode === 'webhook') {
    logger.info('Feishu channel using webhook mode (no active connection needed)', { channelId });
    return;
  }

  logger.info(`Feishu channel starting in ${connectionMode} mode`, { channelId, appId: config.appId });

  const context: FeishuEventContext = {
    channelId,
    appId: config.appId,
    config,
  };

  const abortController = new AbortController();

  try {
    // 创建 EventDispatcher 处理事件
    const eventDispatcher = new Lark.EventDispatcher({
      encryptKey: config.encryptKey,
      verificationToken: config.verificationToken,
    });

    // 注册消息事件处理器 - 用多种事件名称格式，确保兼容性
    eventDispatcher.register({
      'im.message.receive_v1': async (event: any) => {
        logger.info('Feishu message event received (v1)', { channelId });
        await handleMessage(context, event);
      },
    });

    // 也添加一个通用处理器，用于调试
    eventDispatcher.register({
      '*': async (eventData: any) => {
        logger.debug('Feishu generic event received', { channelId, eventType: eventData?.header?.event_type || 'unknown' });
      },
    });

    // 创建 WSClient
    const wsClient = new Lark.WSClient({
      appId: config.appId,
      appSecret: config.appSecret,
    });

    // 保存连接实例
    activeConnections.set(channelId, {
      wsClient,
      abortController,
    });

    // 启动 WebSocket 连接
    await wsClient.start({ eventDispatcher });

    logger.info('Feishu WebSocket client started', { channelId, appId: config.appId });
    logger.info(' 请确认飞书开放平台配置：', {
      channelId,
      steps: [
        '1. 事件与回调 → 订阅方式 → 使用长连接接收事件/回调',
        '2. 添加事件 → im.message.receive_v1',
        '3. 权限管理 → 开通 im:message 权限',
        '4. 应用功能 → 机器人 → 启用',
        '5. 发布版本到企业/个人可用范围'
      ]
    });

  } catch (err: any) {
    logger.error('Failed to start Feishu WebSocket', { channelId, error: err.message });
    activeConnections.delete(channelId);
    throw err;
  }

  // 监听中止信号
  abortController.signal.addEventListener('abort', () => {
    logger.info('Feishu channel connection aborted', { channelId });
  });
}

/** 停止指定频道的连接 */
export async function stopChannel(channelId: string): Promise<void> {
  const conn = activeConnections.get(channelId);
  if (!conn) return;

  conn.abortController.abort();
  try {
    conn.wsClient.close();
  } catch (err: any) {
    logger.debug('Error closing WSClient', { channelId, error: err.message });
  }
  activeConnections.delete(channelId);
  logger.info('Feishu channel stopped', { channelId });
}

/** 停止所有频道连接 */
export async function stopAllChannels(): Promise<void> {
  const promises = Array.from(activeConnections.keys()).map(stopChannel);
  await Promise.all(promises);
  logger.info('All Feishu channels stopped');
}

/** 获取当前活跃连接数 */
export function getActiveConnectionCount(): number {
  return activeConnections.size;
}