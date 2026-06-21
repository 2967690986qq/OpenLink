/**
 * 飞书消息发送：支持 text / post（富文本）/ interactive（卡片）
 */
import axios from 'axios';
import type { FeishuConfig } from '../../types/index.js';
import logger from '../../utils/logger.js';

interface AccessTokenCache {
  token: string;
  expireTime: number;
}

const tokenCache = new Map<string, AccessTokenCache>();

export async function getTenantAccessToken(config: FeishuConfig): Promise<string> {
  const cached = tokenCache.get(config.appId);
  if (cached && cached.expireTime > Date.now()) {
    return cached.token;
  }

  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: config.appId, app_secret: config.appSecret },
    { timeout: 15_000 }
  );

  const { tenant_access_token, expire } = response.data;
  if (!tenant_access_token) throw new Error('No access token in response');

  tokenCache.set(config.appId, {
    token: tenant_access_token,
    expireTime: Date.now() + (expire - 300) * 1000,
  });

  logger.info('Feishu tenant access token obtained', { appId: config.appId });
  return tenant_access_token;
}

/** 发送纯文本消息 */
export async function sendText(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'chat_id',
  text: string
): Promise<string> {
  const token = await getTenantAccessToken(config);
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      params: { receive_id_type: receiveIdType },
      timeout: 30_000,
    }
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu send failed: ${response.data?.msg}`);
  }

  logger.info('Feishu text message sent', { receiveId, receiveIdType });
  return response.data?.data?.message_id || '';
}

/** 发送富文本消息（post） */
export async function sendPost(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'chat_id',
  messageText: string
): Promise<string> {
  const token = await getTenantAccessToken(config);

  // 将 text 转为飞书 post 格式（支持 @、markdown 等）
  const content = JSON.stringify({
    zh_cn: {
      title: '',
      content: [
        [
          { tag: 'text', text: messageText },
        ],
      ],
    },
  });

  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    {
      receive_id: receiveId,
      msg_type: 'post',
      content,
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      params: { receive_id_type: receiveIdType },
      timeout: 30_000,
    }
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu send failed: ${response.data?.msg}`);
  }

  logger.info('Feishu post message sent', { receiveId, receiveIdType });
  return response.data?.data?.message_id || '';
}

/** 发送交互式卡片消息（Markdown Card） */
export async function sendCard(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'chat_id',
  card: Record<string, unknown>
): Promise<string> {
  const token = await getTenantAccessToken(config);

  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      params: { receive_id_type: receiveIdType },
      timeout: 30_000,
    }
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu card send failed: ${response.data?.msg}`);
  }

  logger.info('Feishu card message sent', { receiveId, receiveIdType });
  return response.data?.data?.message_id || '';
}

/** 回复消息（thread reply） */
export async function sendReply(
  config: FeishuConfig,
  messageId: string,
  messageText: string,
  replyInThread = false
): Promise<string> {
  const token = await getTenantAccessToken(config);

  const response = await axios.post(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`,
    {
      msg_type: 'post',
      content: JSON.stringify({
        zh_cn: {
          content: [[{ tag: 'text', text: messageText }]],
        },
      }),
      ...(replyInThread ? { reply_in_thread: true } : {}),
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    }
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu reply failed: ${response.data?.msg}`);
  }

  return response.data?.data?.message_id || '';
}

/** 获取 Bot 信息 */
export async function getBotInfo(config: FeishuConfig): Promise<{ name: string; openId: string }> {
  const token = await getTenantAccessToken(config);
  const response = await axios.get('https://open.feishu.cn/open-apis/bot/v3/info', {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10_000,
  });

  const botInfo = response.data?.data;
  return {
    name: botInfo?.app_name || botInfo?.bot_name || 'Unknown',
    openId: botInfo?.open_id || '',
  };
}

/** 获取消息内容（用于提取原始消息文本） */
export async function getMessage(
  config: FeishuConfig,
  messageId: string
): Promise<{ content: string; msgType: string; senderId?: string; senderOpenId?: string } | null> {
  const token = await getTenantAccessToken(config);
  const response = await axios.get(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { card_msg_content_type: 'user_card_content' },
      timeout: 10_000,
    }
  );

  if (response.data?.code !== 0) return null;

  const item = response.data?.data?.items?.[0] || response.data?.data;
  if (!item) return null;

  const msgType = item.msg_type || 'text';
  const rawContent = item.body?.content || '';

  // 解析 text 类型消息
  let text = '';
  if (msgType === 'text') {
    try {
      const parsed = JSON.parse(rawContent);
      text = parsed.text || '';
    } catch {
      text = rawContent;
    }
  }

  return {
    content: text,
    msgType,
    senderId: item.sender?.id,
    senderOpenId: item.sender?.id_type === 'open_id' ? item.sender?.id : undefined,
  };
}

/** 验证飞书 Webhook 签名（兼容旧接口） */
export function verifyWebhookSignature(
  config: FeishuConfig,
  timestamp: string,
  signature: string,
  rawBody: string
): boolean {
  const crypto = require('crypto');
  const stringToSign = `${timestamp}${rawBody}`;
  const key = `${config.appId}${config.appSecret}`;
  const hmac = crypto.createHmac('sha256', key).update(stringToSign).digest('base64');
  return hmac === signature;
}

/** 添加表情回应（reaction） */
export async function addReaction(
  config: FeishuConfig,
  messageId: string,
  emoji: string = 'thumbsup'
): Promise<boolean> {
  const token = await getTenantAccessToken(config);
  try {
    const response = await axios.post(
      `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reactions`,
      {
        reaction_type: {
          emoji: {
            emoji_type: emoji,
          },
        },
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15_000,
      }
    );

    if (response.data?.code === 0) {
      logger.info('Feishu reaction added', { messageId, emoji });
      return true;
    } else {
      logger.warn('Feishu reaction failed', { messageId, emoji, msg: response.data?.msg });
      return false;
    }
  } catch (err: any) {
    logger.debug('Feishu reaction error (non-critical)', { messageId, emoji, error: err.message });
    return false;
  }
}

/** 引用回复消息（在用户消息下方回复，带引用效果） */
export async function sendReplyText(
  config: FeishuConfig,
  messageId: string,
  text: string
): Promise<string> {
  const token = await getTenantAccessToken(config);

  const response = await axios.post(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`,
    {
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    }
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu reply failed: ${response.data?.msg}`);
  }

  logger.info('Feishu reply message sent', { messageId });
  return response.data?.data?.message_id || '';
}

/** 发送文本消息（兼容旧接口，默认用 open_id） */
export async function sendTextMessage(
  config: FeishuConfig,
  receiveId: string,
  text: string
): Promise<void> {
  await sendText(config, receiveId, 'open_id', text);
}

/**
 * 发送自定义消息（用于状态回执卡片等）
 *   msgType: "text" | "post" | "interactive" ...
 *   content: 已 JSON.stringify 后的字符串
 */
export async function sendMessage(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'chat_id',
  msgType: string,
  content: string,
): Promise<string> {
  const token = await getTenantAccessToken(config);
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    { receive_id: receiveId, msg_type: msgType, content },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      params: { receive_id_type: receiveIdType },
      timeout: 30_000,
    },
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu sendMessage failed: ${JSON.stringify(response.data)}`);
  }

  logger.debug('Feishu custom message sent', { msgType, receiveId, receiveIdType });
  return response.data?.data?.message_id || '';
}

/**
 * 通过 reply 引用发送（用于状态回执，让回执和用户消息在同一个会话线程里）
 *   messageId: 用户发的那条消息的 message_id
 *   msgType:   "text" | "post" | "interactive" ...
 *   content:   已 JSON.stringify 后的字符串
 */
export async function replyMessage(
  config: FeishuConfig,
  messageId: string,
  msgType: string,
  content: string,
): Promise<string> {
  const token = await getTenantAccessToken(config);
  const response = await axios.post(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`,
    { msg_type: msgType, content },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    },
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu replyMessage failed: ${JSON.stringify(response.data)}`);
  }

  logger.debug('Feishu reply message sent', { messageId, msgType });
  return response.data?.data?.message_id || '';
}

/**
 * 编辑消息（用于流式打字机效果）
 *   messageId: 需要编辑的消息的 message_id（机器人自己发的那条消息）
 *   content:   已 JSON.stringify 后的新内容（例如 "{\"text\":\"你好\"}"）
 *
 * 飞书文档：PUT /open-apis/im/v1/messages/{message_id}
 * 请求体只需 content 字段（不可修改 msg_type）
 */
export async function updateMessage(
  config: FeishuConfig,
  messageId: string,
  content: string,
): Promise<boolean> {
  const token = await getTenantAccessToken(config);
  try {
    const response = await axios.put(
      `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`,
      { content },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10_000,
      },
    );

    if (response.data?.code === 0) {
      logger.debug('Feishu message updated', { messageId, contentLen: content.length });
      return true;
    }
    logger.warn('Feishu updateMessage failed', {
      messageId,
      code: response.data?.code,
      msg: response.data?.msg,
    });
    return false;
  } catch (err: any) {
    logger.warn('Feishu updateMessage error', {
      messageId,
      error: err.message,
      status: err.response?.status,
      data: err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : undefined,
    });
    return false;
  }
}

// ============================================================================
// CardKit API —— 飞书机器人流式回复（打字机效果）的官方推荐实现
// ============================================================================

/**
 * 构造卡片 JSON 2.0（用于流式回复）
 *  - schema: 2.0，无标题（只显示正文内容）
 *  - streaming_mode: true（启用流式更新模式）
 *  - update_multi: true（共享卡片）
 *  - body 中放一个 markdown 元素承载回复文本（支持图标、列表、加粗等排版）
 */
export function buildStreamingCardJSON(text: string): string {
  const card = {
    schema: '2.0',
    config: {
      update_multi: true,
      streaming_mode: true,
      summary: { content: text.slice(0, 50) },
      streaming_config: {
        print_frequency_ms: { default: 70, android: 70, ios: 70, pc: 70 },
        print_step: { default: 1, android: 1, ios: 1, pc: 1 },
        print_strategy: 'fast',
      },
    },
    body: {
      elements: [
        { tag: 'markdown', content: text, element_id: 'markdown_1' },
      ],
    },
  };
  return JSON.stringify(card);
}

/**
 * 创建卡片实体（CardKit v1）
 * POST /open-apis/cardkit/v1/cards
 * 返回 card_id（用于后续发送卡片消息 + 更新卡片内容）
 */
export async function createCardEntity(
  config: FeishuConfig,
  text: string,
): Promise<string | null> {
  const token = await getTenantAccessToken(config);
  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/cardkit/v1/cards',
      {
        type: 'card_json',
        data: buildStreamingCardJSON(text),
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
    );

    if (response.data?.code === 0) {
      const cardId = response.data?.data?.card_id;
      logger.info('Feishu card entity created', { cardId });
      return cardId;
    }
    logger.warn('Feishu createCardEntity failed', {
      code: response.data?.code,
      msg: response.data?.msg,
    });
    return null;
  } catch (err: any) {
    logger.warn('Feishu createCardEntity error', {
      error: err.message,
      status: err.response?.status,
      data: err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : undefined,
    });
    return null;
  }
}

/**
 * 发送卡片实体消息（通过 reply 接口引用用户消息，形成上下文链）
 * POST /open-apis/im/v1/messages/{message_id}/reply
 * msg_type: interactive
 * content: { "type": "card", "data": { "card_id": "..." } }
 */
export async function replyCardEntity(
  config: FeishuConfig,
  messageId: string,
  cardId: string,
): Promise<string> {
  const content = JSON.stringify({ type: 'card', data: { card_id: cardId } });
  const token = await getTenantAccessToken(config);
  const response = await axios.post(
    `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`,
    { msg_type: 'interactive', content },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30_000,
    },
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu replyCardEntity failed: ${JSON.stringify(response.data)}`);
  }
  logger.debug('Feishu card entity message sent', { messageId, cardId });
  return response.data?.data?.message_id || '';
}

/**
 * 直接发送卡片实体消息（不引用，用于没有 message_id 的场景）
 */
export async function sendCardEntity(
  config: FeishuConfig,
  receiveId: string,
  receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'chat_id',
  cardId: string,
): Promise<string> {
  const content = JSON.stringify({ type: 'card', data: { card_id: cardId } });
  const token = await getTenantAccessToken(config);
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    { receive_id: receiveId, msg_type: 'interactive', content },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      params: { receive_id_type: receiveIdType },
      timeout: 30_000,
    },
  );

  if (response.data?.code !== 0) {
    throw new Error(`Feishu sendCardEntity failed: ${JSON.stringify(response.data)}`);
  }
  logger.debug('Feishu card entity message sent directly', { receiveId, cardId });
  return response.data?.data?.message_id || '';
}

/**
 * 更新卡片实体内容（流式打字机效果的核心）
 * PUT /open-apis/cardkit/v1/cards/{card_id}
 * sequence 必须严格递增（通过简单计数器维护即可）
 */
export async function updateCardEntity(
  config: FeishuConfig,
  cardId: string,
  sequence: number,
  text: string,
): Promise<boolean> {
  const token = await getTenantAccessToken(config);
  try {
    const response = await axios.put(
      `https://open.feishu.cn/open-apis/cardkit/v1/cards/${cardId}`,
      {
        card: {
          type: 'card_json',
          data: buildStreamingCardJSON(text),
        },
        sequence,
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10_000,
      },
    );

    if (response.data?.code === 0) {
      logger.debug('Feishu card entity updated', { cardId, sequence, textLen: text.length });
      return true;
    }
    logger.warn('Feishu updateCardEntity failed', {
      cardId,
      sequence,
      code: response.data?.code,
      msg: response.data?.msg,
    });
    return false;
  } catch (err: any) {
    logger.warn('Feishu updateCardEntity error', {
      cardId,
      sequence,
      error: err.message,
      status: err.response?.status,
      data: err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : undefined,
    });
    return false;
  }
}

/**
 * 关闭卡片的流式模式（流结束后调用）
 * 保持内容不变，仅把 streaming_mode 改为 false，让消息预览显示完整内容
 */
export async function finalizeCardEntity(
  config: FeishuConfig,
  cardId: string,
  sequence: number,
  finalText: string,
): Promise<boolean> {
  const token = await getTenantAccessToken(config);
  try {
    const card = {
      schema: '2.0',
      config: {
        update_multi: true,
        streaming_mode: false,
        summary: { content: finalText.slice(0, 50) },
      },
      body: {
        elements: [
          { tag: 'markdown', content: finalText, element_id: 'markdown_1' },
        ],
      },
    };

    const response = await axios.put(
      `https://open.feishu.cn/open-apis/cardkit/v1/cards/${cardId}`,
      {
        card: {
          type: 'card_json',
          data: JSON.stringify(card),
        },
        sequence,
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
    );

    if (response.data?.code === 0) {
      logger.info('Feishu card entity finalized', { cardId, sequence });
      return true;
    }
    logger.warn('Feishu finalizeCardEntity failed', { cardId, code: response.data?.code, msg: response.data?.msg });
    return false;
  } catch (err: any) {
    logger.warn('Feishu finalizeCardEntity error', {
      cardId,
      error: err.message,
      status: err.response?.status,
      data: err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : undefined,
    });
    return false;
  }
}
