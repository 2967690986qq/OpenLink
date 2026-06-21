/**
 * 微信二维码扫码登录 - 参考 Hermes 项目实现
 *
 * 使用腾讯官方 iLink API 实现微信个人号机器人。
 * 基础URL: https://ilinkai.weixin.qq.com
 * 流程：
 *   1. 调用 /ilink/bot/get_bot_qrcode 获取二维码
 *   2. 用户用微信扫码
 *   3. 轮询 /ilink/bot/get_qrcode_status 检查状态
 *   4. 确认后获取 ilink_bot_id / bot_token / baseurl
 *   5. 使用 getupdates 长轮询监听消息，sendmessage 发送回复
 */
import axios from 'axios';
import type { ChannelConfig, WeixinConfig } from '../types/index.js';
import { knowledgeBaseService } from './knowledge-base.js';
import { configStore } from '../config/store.js';
import logger from '../utils/logger.js';

// 腾讯官方 iLink 基础URL
const ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com';
const ILINK_APP_ID = 'bot';
const ILINK_APP_CLIENT_VERSION = (2 << 16) | (2 << 8) | 0;
const ILINK_API_TIMEOUT = 15_000;
const LONG_POLL_TIMEOUT = 35_000;

interface QrCodeSession {
  qrcode: string;
  qrcodeUrl: string;
  baseUrl: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
}

const activeQrSessions = new Map<string, QrCodeSession>();

const activeBotSessions = new Map<
  string,
  {
    baseUrl: string;
    token: string;
    accountId: string;
    stopFlag: { stopped: boolean };
    pollTimer?: NodeJS.Timeout;
    processedMsgIds: Set<string>;
    syncBuf: string;
    contextTokens: Map<string, string>;
  }
>();

const SESSION_EXPIRED_ERRCODE = -14;

/** 生成 iLink 请求头 */
function makeHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'iLink-App-Id': ILINK_APP_ID,
    'iLink-App-ClientVersion': String(ILINK_APP_CLIENT_VERSION),
    'X-WECHAT-UIN': Math.random().toString(36).slice(2, 12),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['AuthorizationType'] = 'ilink_bot_token';
  }
  return headers;
}

/** 生成二维码 */
export async function generateQrCode(
  sessionId: string,
  customBaseUrl?: string,
): Promise<{ qrcode: string; qrcodeUrl: string; baseUrl: string }> {
  const baseUrl = customBaseUrl?.trim() || ILINK_BASE_URL;

  const existing = activeQrSessions.get(sessionId);
  if (existing) {
    activeQrSessions.delete(sessionId);
  }

  try {
    const response = await axios.get(`${baseUrl}/ilink/bot/get_bot_qrcode`, {
      params: { bot_type: '3' },
      headers: makeHeaders(),
      timeout: ILINK_API_TIMEOUT,
    });

    const data = response.data || {};
    const qrcode = String(data.qrcode || '').trim();
    const qrcodeUrl = String(data.qrcode_img_content || '').trim();

    if (!qrcode) {
      throw new Error('iLink服务未返回有效的二维码数据');
    }

    const session: QrCodeSession = {
      qrcode,
      qrcodeUrl,
      baseUrl,
      status: 'pending',
    };

    activeQrSessions.set(sessionId, session);
    logger.info('Weixin QR code generated', { sessionId, baseUrl });
    return { qrcode, qrcodeUrl, baseUrl };
  } catch (err: any) {
    const errorMsg =
      err?.response?.data?.message ||
      err?.response?.statusText ||
      err?.message ||
      '网络错误';
    logger.error('Weixin QR code generation failed', { error: errorMsg });
    throw new Error(`获取二维码失败: ${errorMsg}`);
  }
}

/** 轮询二维码状态 */
export async function pollQrStatus(sessionId: string): Promise<{
  status: 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error';
  message?: string;
  account_id?: string;
  token?: string;
  base_url?: string;
  user_id?: string;
}> {
  const session = activeQrSessions.get(sessionId);
  if (!session) {
    return { status: 'error', message: '未找到二维码会话' };
  }

  try {
    const response = await axios.get(`${session.baseUrl}/ilink/bot/get_qrcode_status`, {
      params: { qrcode: session.qrcode },
      headers: makeHeaders(),
      timeout: ILINK_API_TIMEOUT,
    });

    const data = response.data || {};
    const status = String(data.status || 'wait');
    const redirectHost = String(data.redirect_host || '').trim();

    if (status === 'confirmed') {
      const accountId = String(data.ilink_bot_id || '').trim();
      const token = String(data.bot_token || '').trim();
      // data.baseurl 可能已经是完整 URL，避免重复添加 https://
      let baseUrl = session.baseUrl;
      if (data.baseurl) {
        const rawUrl = String(data.baseurl).trim();
        baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      }
      const userId = String(data.ilink_user_id || '').trim();

      if (!accountId || !token) {
        return { status: 'error', message: '扫码成功但凭证不完整' };
      }

      session.status = 'confirmed';
      activeQrSessions.delete(sessionId);

      logger.info('Weixin QR login successful', { sessionId, accountId });
      return {
        status: 'confirmed',
        account_id: accountId,
        token,
        base_url: baseUrl,
        user_id: userId,
      };
    }

    if (status === 'scaned' || status === 'scanned_but_redirect') {
      session.status = 'scanned';
      if (redirectHost) {
        session.baseUrl = `https://${redirectHost}`;
      }
      return { status: 'scanned', message: '已扫码，请在微信中确认' };
    }

    if (status === 'expired') {
      session.status = 'expired';
      activeQrSessions.delete(sessionId);
      return { status: 'expired', message: '二维码已过期，请重新获取' };
    }

    return { status: 'pending', message: '等待扫码...' };
  } catch (err: any) {
    const errorMsg = err?.message || '状态检查失败';
    logger.debug('Weixin QR status polling error', { sessionId, error: errorMsg });
    return { status: 'pending', message: '等待扫码...' };
  }
}

/** 停止二维码会话 */
export function stopQrSession(sessionId: string): void {
  activeQrSessions.delete(sessionId);
}

/** 发送文本消息到指定用户（参考 Hermes iLink sendmessage 协议） */
async function sendTextMessageByIlink(
  baseUrl: string,
  token: string,
  accountId: string,
  toUserId: string,
  text: string,
  contextToken?: string,
): Promise<{ success: boolean; sessionExpired: boolean; newContextToken?: string }> {
  const message: any = {
    from_user_id: '',
    to_user_id: toUserId,
    client_id: accountId,
    message_type: 2,
    message_state: 2,
    item_list: [{ type: 1, text_item: { text } }],
  };
  if (contextToken) {
    message.context_token = contextToken;
  }

  logger.info('Weixin sending message to iLink', {
    baseUrl: baseUrl.slice(0, 50),
    toUserId,
    accountId: accountId.slice(0, 8),
    textLength: text.length,
    hasContextToken: !!contextToken,
  });

  try {
    const response = await axios.post(
      `${baseUrl}/ilink/bot/sendmessage`,
      { msg: message, base_info: { channel_version: '2.2.0' } },
      {
        headers: makeHeaders(token),
        timeout: ILINK_API_TIMEOUT,
      },
    );
    
    const data = response.data || {};
    logger.info('Weixin send message response', {
      status: response.status,
      data: JSON.stringify(data).slice(0, 500),
    });

    const errcode = data.errcode;
    if (errcode === SESSION_EXPIRED_ERRCODE) {
      logger.warn('Weixin session expired, need re-login', { toUserId: toUserId.slice(0, 8) });
      return { success: false, sessionExpired: true };
    }

    const ret = data.ret;
    if (ret !== undefined && ret !== 0) {
      logger.warn('Weixin send message returned non-zero ret', { ret, errcode, errmsg: data.errmsg });
      return { success: false, sessionExpired: false };
    }

    return { success: true, sessionExpired: false };
  } catch (err: any) {
    logger.error('Weixin send message failed', {
      toUserId: toUserId.slice(0, 8),
      error: err?.message,
      responseData: err?.response?.data ? JSON.stringify(err.response.data).slice(0, 500) : null,
      status: err?.response?.status,
    });
    return { success: false, sessionExpired: false };
  }
}

/** 从 item_list 提取文本 */
function extractText(itemList: any[]): string {
  if (!itemList || !Array.isArray(itemList)) return '';
  for (const item of itemList) {
    if (item.type === 1 && item.text_item) {
      return String(item.text_item.text || '').trim();
    }
  }
  return '';
}

/** 处理一条微信消息 */
async function handleWeixinMessage(
  channelId: string,
  config: WeixinConfig,
  message: any,
): Promise<void> {
  const messageId = String(message.message_id || message.id || '').trim();
  const fromId = String(message.from_user_id || '').trim();
  const toId = String(message.to_user_id || message.touserid || '').trim();
  
  let senderId = fromId;
  if (!senderId || senderId === config.accountId) {
    senderId = toId;
  }
  
  const itemList = message.item_list || message.items || [];
  const content = extractText(itemList);

  if (!messageId || !senderId || !content) {
    logger.debug('Weixin message skipped: missing required fields', {
      messageId: !!messageId,
      senderId: !!senderId,
      contentLength: content?.length || 0,
    });
    return;
  }

  if (senderId === config.accountId) {
    return;
  }

  const session = activeBotSessions.get(channelId);
  if (session) {
    if (session.processedMsgIds.has(messageId)) return;
    session.processedMsgIds.add(messageId);

    if (message.context_token) {
      session.contextTokens.set(senderId, message.context_token);
    }
  }

  logger.info('Weixin message received', {
    channelId,
    messageId,
    sender: senderId,
    contentLength: content.length,
    contextToken: message.context_token ? 'present' : 'missing',
  });

  const channels: ChannelConfig[] = configStore.get('channels') || [];
  const channel = channels.find((c: ChannelConfig) => c.id === channelId);
  if (!channel || !channel.enabled) return;

  const knowledgeBases = configStore.get('knowledgeBases') || [];
  const kb = knowledgeBases.find((k: any) => k.id === channel.knowledgeBaseId && k.enabled);
  if (!kb) {
    logger.warn('Weixin channel: knowledge base not found', { channelId });
    return;
  }

  const contextToken = message.context_token || (session?.contextTokens.get(senderId));
  const originalToId = String(message.to_user_id || message.touserid || '').trim();
  const originalFromId = String(message.from_user_id || '').trim();
  
  const replyToId = originalFromId || senderId;

  try {
    const chatResponse = await knowledgeBaseService.chat(kb, {
      knowledgeBaseId: kb.id,
      message: content,
      userId: `weixin_${senderId}`,
    });

    const replyText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';

    logger.info('Weixin preparing reply', { 
      channelId, 
      messageId, 
      replyToId,
      originalFromId,
      originalToId,
      senderId,
      hasContextToken: !!contextToken,
    });

    const sendResult = await sendTextMessageByIlink(
      config.baseUrl || session?.baseUrl || ILINK_BASE_URL,
      config.token,
      config.accountId,
      replyToId,
      replyText,
      contextToken,
    );

    if (sendResult.success) {
      logger.info('Weixin reply sent', { channelId, messageId, replyLength: replyText.length });
    } else {
      logger.warn('Weixin reply failed', { channelId, messageId, sessionExpired: sendResult.sessionExpired });
    }
  } catch (err: any) {
    logger.error('Weixin chat failed', { channelId, error: err?.message });
  }
}

/** 启动微信消息监听（长轮询 getupdates，参考 Hermes 实现） */
export function startChannel(channelId: string, config: WeixinConfig): void {
  stopChannel(channelId);

  const baseUrl = config.baseUrl || ILINK_BASE_URL;
  const stopFlag = { stopped: false };
  const sessionData = {
    baseUrl,
    token: config.token,
    accountId: config.accountId,
    stopFlag,
    processedMsgIds: new Set<string>(),
    syncBuf: '',
    contextTokens: new Map<string, string>(),
  };
  activeBotSessions.set(channelId, sessionData);

  logger.info('Weixin channel starting', {
    channelId,
    accountId: config.accountId.slice(0, 8),
    baseUrl: baseUrl.slice(0, 50),
  });

  let isPolling = false;
  let pollCount = 0;

  const pollOnce = async () => {
    if (stopFlag.stopped || isPolling) return;
    isPolling = true;
    pollCount++;

    try {
      logger.info('Weixin polling for updates', { channelId, pollCount, syncBufLength: sessionData.syncBuf.length });
      
      const response = await axios.post(
        `${baseUrl}/ilink/bot/getupdates`,
        { get_updates_buf: sessionData.syncBuf, base_info: { channel_version: '2.2.0' } },
        {
          headers: makeHeaders(config.token),
          timeout: LONG_POLL_TIMEOUT,
        },
      );

      const data = response.data || {};
      logger.info('Weixin poll response received', { 
        channelId, 
        hasData: Object.keys(data).length > 0,
        msgCount: Array.isArray(data.msgs) ? data.msgs.length : 0 
      });

      const newSyncBuf = String(data.get_updates_buf || '').trim();
      if (newSyncBuf) {
        sessionData.syncBuf = newSyncBuf;
      }

      const messages = Array.isArray(data.msgs) ? data.msgs : [];
      logger.info('Weixin messages to process', { channelId, count: messages.length });
      
      for (const msg of messages) {
        logger.info('Weixin raw message', { channelId, message: JSON.stringify(msg).slice(0, 500) });
        await handleWeixinMessage(channelId, config, msg);
      }
    } catch (err: any) {
      // 忽略超时错误，这是长轮询的正常行为
      if (err?.code !== 'ECONNABORTED' && err?.code !== 'ETIMEDOUT') {
        logger.error('Weixin poll error', { channelId, error: err?.message, stack: err?.stack });
      } else {
        logger.info('Weixin poll timeout (normal)', { channelId });
      }
    } finally {
      isPolling = false;
      if (!stopFlag.stopped) {
        setTimeout(pollOnce, 1000);
      }
    }
  };

  sessionData.pollTimer = setTimeout(pollOnce, 1000) as unknown as NodeJS.Timeout;
}

/** 停止指定频道的监听 */
export function stopChannel(channelId: string): void {
  const session = activeBotSessions.get(channelId);
  if (session) {
    session.stopFlag.stopped = true;
    if (session.pollTimer) clearTimeout(session.pollTimer);
    activeBotSessions.delete(channelId);
    logger.info('Weixin channel stopped', { channelId });
  }
}

/** 停止所有频道连接 */
export function stopAllChannels(): void {
  for (const channelId of Array.from(activeBotSessions.keys())) {
    stopChannel(channelId);
  }
}

/** 停止所有二维码会话 */
export function stopAllQrSessions(): void {
  activeQrSessions.clear();
}
