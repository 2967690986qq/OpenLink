/**
 * 钉钉 Stream 模式 - 参考 Hermes 项目架构实现
 *
 * 核心能力：
 * 1. Markdown 格式消息（钉钉原生渲染，不做清洗）
 * 2. 消息表情回执：📝 Thinking → ✅ Done
 * 3. messageId 去重（不是 content 去重，避免合法重复消息被丢弃）
 * 4. dingtalk-stream SDK 处理连接、ACK、消息解析
 */
import axios from 'axios';
import { DWClient, TOPIC_ROBOT, type DWClientDownStream } from 'dingtalk-stream';
import type { DingTalkConfig } from '../../types/index.js';
import { knowledgeBaseService } from '../knowledge-base.js';
import { configStore } from '../../config/store.js';
import logger from '../../utils/logger.js';

interface StreamConnection {
  client: DWClient;
  stopFlag: { stopped: boolean };
  chatContext: Map<string, ChatContext>;
}

interface ChatContext {
  chatId: string;
  messageId: string;
  sessionWebhook: string;
  senderStaffId: string;
  senderNick: string;
  conversationId: string;
  thinkingEmojiSent: boolean;
}

// 已处理的 messageId（避免重复处理）
const processedMessageIds = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 分钟内不去重

// 活跃连接
const activeConnections = new Map<string, StreamConnection>();

// --- 工具函数 -----------------------------------------------------------------

function shouldProcessMessage(messageId: string): boolean {
  if (!messageId) return true;
  const now = Date.now();
  const lastSeen = processedMessageIds.get(messageId);
  if (lastSeen && now - lastSeen < DEDUP_TTL_MS) {
    logger.debug('DingTalk message skipped (duplicate messageId)', { messageId });
    return false;
  }
  processedMessageIds.set(messageId, now);
  // 懒清理
  if (processedMessageIds.size > 500) {
    for (const [id, ts] of processedMessageIds.entries()) {
      if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(id);
    }
  }
  return true;
}

// --- 钉钉 API -----------------------------------------------------------------

async function getAccessToken(config: DingTalkConfig): Promise<string> {
  const response = await axios.get(
    `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(config.clientId)}&appsecret=${encodeURIComponent(config.clientSecret)}`,
    { timeout: 10_000 }
  );
  if (response.data?.errcode !== 0) {
    throw new Error(`钉钉获取Token失败: ${JSON.stringify(response.data)}`);
  }
  return response.data.access_token;
}

/**
 * 发送 Markdown 格式消息（钉钉 session webhook）
 * 钉钉原生支持 Markdown 渲染，**标题**、1.列表、- 列表等会被正确渲染
 */
async function sendMarkdownMessage(
  sessionWebhook: string,
  content: string,
): Promise<boolean> {
  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: 'OpenLink',
      text: content,
    },
  };

  try {
    const response = await axios.post(
      sessionWebhook,
      payload,
      { headers: { 'Content-Type': 'application/json' }, timeout: 15_000 }
    );

    if (response.data?.errcode && response.data.errcode !== 0) {
      logger.error('DingTalk markdown send failed', { error: response.data });
      return false;
    }
    return true;
  } catch (err: any) {
    logger.error('DingTalk markdown send error', { error: err.message });
    return false;
  }
}

/**
 * 发送消息表情回复（类似飞书 reaction）
 * - 收到消息：📝 Thinking
 * - 回复完成：✅ Done
 * - 中间状态：撤回上一个，发送下一个
 */
async function sendEmotionReply(
  config: DingTalkConfig,
  chatContext: ChatContext,
  emojiName: string,
): Promise<boolean> {
  if (!chatContext.messageId || !chatContext.conversationId) {
    return false;
  }

  try {
    const token = await getAccessToken(config);
    const response = await axios.post(
      'https://api.dingtalk.com/v1.0/robot/messages/replyEmotion',
      {
        robotCode: config.clientId,
        openMsgId: chatContext.messageId,
        openConversationId: chatContext.conversationId,
        emotionType: 2, // 2 = 文本表情
        emotionName: emojiName,
        textEmotion: {
          emotionId: '2659900',
          emotionName: emojiName,
          text: emojiName,
          backgroundId: 'im_bg_1',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': token,
        },
        timeout: 10_000,
      }
    );

    logger.info('DingTalk emotion reply sent', {
      messageId: chatContext.messageId,
      emoji: emojiName,
    });
    return true;
  } catch (err: any) {
    logger.debug('DingTalk emotion reply failed', {
      emoji: emojiName,
      error: err.message,
    });
    return false;
  }
}

/**
 * 撤回消息表情回复
 */
async function recallEmotionReply(
  config: DingTalkConfig,
  chatContext: ChatContext,
  emojiName: string,
): Promise<boolean> {
  if (!chatContext.messageId || !chatContext.conversationId) {
    return false;
  }

  try {
    const token = await getAccessToken(config);
    const response = await axios.post(
      'https://api.dingtalk.com/v1.0/robot/messages/recallEmotion',
      {
        robotCode: config.clientId,
        openMsgId: chatContext.messageId,
        openConversationId: chatContext.conversationId,
        emotionType: 2,
        emotionName: emojiName,
        textEmotion: {
          emotionId: '2659900',
          emotionName: emojiName,
          text: emojiName,
          backgroundId: 'im_bg_1',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': token,
        },
        timeout: 10_000,
      }
    );

    logger.debug('DingTalk emotion recall sent', { emoji: emojiName });
    return true;
  } catch (err: any) {
    logger.debug('DingTalk emotion recall failed', { emoji: emojiName, error: err.message });
    return false;
  }
}

// --- 消息处理 -----------------------------------------------------------------

async function handleRobotMessage(
  channelId: string,
  config: DingTalkConfig,
  msg: DWClientDownStream,
  conn: StreamConnection,
): Promise<void> {
  // 1. 解析消息体
  let robotMsg: any;
  try {
    robotMsg = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
  } catch (err: any) {
    logger.error('DingTalk message parse failed', { channelId, error: err.message });
    return;
  }

  const msgId = robotMsg.msgId || '';
  const conversationId = robotMsg.conversationId || '';
  const conversationType = robotMsg.conversationType || '1';
  const senderStaffId = robotMsg.senderStaffId || '';
  const senderNick = robotMsg.senderNick || 'unknown';
  const sessionWebhook = robotMsg.sessionWebhook || '';
  const msgtype = robotMsg.msgtype || '';

  // 提取文本内容
  let textContent = '';
  if (msgtype === 'text') {
    if (typeof robotMsg.text?.content === 'string') {
      textContent = robotMsg.text.content.trim();
    } else if (typeof robotMsg.text?.text === 'string') {
      textContent = robotMsg.text.text.trim();
    }
  }

  // 2. 消息去重（基于 messageId）
  if (!shouldProcessMessage(msgId)) {
    return;
  }

  // 3. 只处理文本消息
  if (!textContent) {
    logger.debug('DingTalk message skipped (empty text content)', {
      channelId,
      msgtype,
    });
    return;
  }

  // 4. 验证 session webhook
  if (!sessionWebhook) {
    logger.warn('DingTalk: no session webhook, cannot reply', { channelId });
    return;
  }

  // 5. 构建聊天上下文
  const chatId = conversationId || senderStaffId;
  const chatContext: ChatContext = {
    chatId,
    messageId: msgId,
    sessionWebhook,
    senderStaffId,
    senderNick,
    conversationId,
    thinkingEmojiSent: false,
  };
  conn.chatContext.set(chatId, chatContext);

  logger.info('DingTalk message received', {
    channelId,
    senderNick,
    contentPreview: textContent.slice(0, 80),
  });

  // 6. 查找频道配置
  const channels = configStore.get('channels');
  const channel = channels.find(c => c.id === channelId);
  if (!channel || !channel.enabled) {
    logger.warn('DingTalk channel not found or disabled', { channelId });
    return;
  }

  // 7. 查找知识库配置
  const knowledgeBases = configStore.get('knowledgeBases');
  const kbConfig = knowledgeBases.find(kb => kb.id === channel.knowledgeBaseId && kb.enabled);
  if (!kbConfig) {
    logger.error('DingTalk knowledge base not found or disabled', { knowledgeBaseId: channel.knowledgeBaseId });
    return;
  }

  const dtConfig = channel.config as DingTalkConfig;
  const useStreaming = dtConfig.responseMode === 'streaming';

  // 8. 发送 "📝 Thinking" 表情回执
  sendEmotionReply(config, chatContext, '📝 Thinking').then(sent => {
    if (sent) chatContext.thinkingEmojiSent = true;
  }).catch(() => {
    // ignore errors
  });

  // 9. 调用知识库（阻塞或流式，最终都发送完整内容）
  let replyText = '';
  try {
    const userId = `dingtalk_${senderStaffId}`;

    if (useStreaming) {
      const streamResponse = await knowledgeBaseService.chatStreaming(
        kbConfig,
        { knowledgeBaseId: kbConfig.id, message: textContent, userId },
        (_chunk: string, accumulated: string) => {
          replyText = accumulated;
        }
      );
      replyText = streamResponse?.content || replyText;
    } else {
      const response = await knowledgeBaseService.chat(
        kbConfig,
        { knowledgeBaseId: kbConfig.id, message: textContent, userId }
      );
      replyText = response.content;
    }
  } catch (err: any) {
    logger.error('DingTalk knowledge base call failed', { channelId, error: err.message });
    replyText = '抱歉，我暂时无法回答这个问题。请稍后重试。';
  }

  if (!replyText || replyText.trim().length === 0) {
    replyText = '抱歉，我暂时无法回答这个问题。';
  }

  // 9. 发送 Markdown 格式消息
  const sendSuccess = await sendMarkdownMessage(sessionWebhook, replyText);

  if (sendSuccess) {
    logger.info('DingTalk reply sent', {
      channelId,
      length: replyText.length,
    });
  }

  // 10. 表情状态更新：撤回 Thinking，发送 Done
  if (chatContext.thinkingEmojiSent) {
    recallEmotionReply(config, chatContext, '📝 Thinking').then(() => {
      sendEmotionReply(config, chatContext, '✅ Done').catch(() => {});
    }).catch(() => {});
  } else {
    sendEmotionReply(config, chatContext, '✅ Done').catch(() => {});
  }
}

// --- 连接管理 -----------------------------------------------------------------

export async function testConnection(config: DingTalkConfig): Promise<boolean> {
  try {
    await getAccessToken(config);
    return true;
  } catch {
    return false;
  }
}

export async function startChannel(channelId: string, config: DingTalkConfig): Promise<void> {
  // 先停止已存在的连接
  await stopChannel(channelId);

  logger.info('DingTalk channel starting (stream mode)', { channelId });

  const stopFlag = { stopped: false };
  const chatContext = new Map<string, ChatContext>();

  const client = new DWClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    debug: false,
  });

  // 使用 SDK 的 registerCallbackListener 处理机器人消息
  client.registerCallbackListener(TOPIC_ROBOT, async (msg: DWClientDownStream) => {
    if (stopFlag.stopped) return { status: 'LATER' as const };

    // 异步处理消息，立即返回 ACK，避免阻塞连接
    handleRobotMessage(channelId, config, msg, {
      client, stopFlag, chatContext,
    }).catch(err => {
      logger.error('DingTalk message handling error', { channelId, error: err.message });
    });

    return { status: 'SUCCESS' as const };
  });

  client.on('connect', () => {
    logger.info('DingTalk stream connected', { channelId });
  });

  client.on('close', () => {
    if (!stopFlag.stopped) {
      logger.warn('DingTalk stream connection closed', { channelId });
    }
  });

  client.on('error', (err: Error) => {
    logger.error('DingTalk stream error', { channelId, error: err.message });
  });

  activeConnections.set(channelId, { client, stopFlag, chatContext });

  try {
    await client.connect();
    logger.info('DingTalk channel started successfully', { channelId });
  } catch (err: any) {
    activeConnections.delete(channelId);
    logger.error('DingTalk channel connect failed', { channelId, error: err.message });
    throw err;
  }
}

export async function stopChannel(channelId: string): Promise<void> {
  const conn = activeConnections.get(channelId);
  if (!conn) return;
  conn.stopFlag.stopped = true;
  try { conn.client.disconnect(); } catch {}
  activeConnections.delete(channelId);
  logger.info('DingTalk channel stopped', { channelId });
}

export async function stopAllChannels(): Promise<void> {
  await Promise.all(Array.from(activeConnections.keys()).map(stopChannel));
}

export function getActiveConnectionCount(): number {
  return activeConnections.size;
}
