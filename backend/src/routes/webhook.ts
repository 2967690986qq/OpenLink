import { Router, Request, Response } from 'express';
import { configStore } from '../config/store.js';
import { difyService } from '../services/dify.js';
import { dingTalkService } from '../services/dingtalk.js';
import { feishuService } from '../services/feishu.js';
import logger from '../utils/logger.js';
import type { DingTalkConfig, FeishuConfig, DifyConfig } from '../types/index.js';

const router = Router();

// ─── Helper functions ───

function findDifyInstance(instanceId: string): DifyConfig | null {
  const instances = configStore.get('difyInstances');
  const instance = instances.find(i => i.id === instanceId && i.enabled);
  return instance || null;
}

function findAppApiKey(difyInstance: DifyConfig, appId: string): string | null {
  if (!appId) return null;

  // Check dedicated appApiKeys store first
  const appApiKeys = configStore.get('appApiKeys');
  if (appApiKeys && appApiKeys[appId]) {
    return appApiKeys[appId];
  }

  // Fallback to admin key (won't work for /v1/chat-messages in most cases)
  logger.warn('No app-specific API key found, using admin key as fallback (may fail)', {
    appId,
    difyInstanceId: difyInstance.id
  });
  return difyInstance.apiKey;
}

// ─── DingTalk webhook processing ───

async function processDingTalkWebhook(req: Request, channelId: string): Promise<void> {
  const channels = configStore.get('channels');
  const channel = channels.find(c => c.id === channelId);

  if (!channel || channel.platform !== 'dingtalk' || !channel.enabled) {
    logger.warn('DingTalk webhook: invalid/disabled channel', { channelId });
    return;
  }

  const dingtalkConfig = channel.config as DingTalkConfig;
  const body = req.body;

  const msgType = body?.msgtype;
  const textContent = body?.text?.content?.trim();
  const conversationId = body?.conversationId;
  const senderId = body?.senderStaffId || body?.senderId || 'unknown';

  if (!textContent || !conversationId) {
    logger.warn('DingTalk webhook: no text or conversationId', { channelId, msgType });
    return;
  }

  logger.info('DingTalk webhook received', { channelId, conversationId, senderId, msgType });

  const difyInstance = findDifyInstance(channel.difyInstanceId);
  if (!difyInstance) {
    logger.error('DingTalk webhook: Dify instance not found', { difyInstanceId: channel.difyInstanceId });
    return;
  }

  const appApiKey = findAppApiKey(difyInstance, channel.difyAppId);
  if (!appApiKey) {
    logger.error('DingTalk webhook: cannot resolve app API key', { difyAppId: channel.difyAppId });
    return;
  }

  const chatResponse = await difyService.chat(difyInstance, {
    appId: channel.difyAppId,
    message: textContent,
    userId: `dingtalk_${senderId}`
  }, appApiKey);

  const replyText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';
  await dingTalkService.sendTextMessage(dingtalkConfig, conversationId, replyText);

  logger.info('DingTalk webhook processed', { channelId, difyMessageId: chatResponse.messageId });
}

// ─── Feishu webhook processing ───

async function processFeishuWebhook(req: Request, channelId: string): Promise<void> {
  const body = req.body;

  // No event data — skip
  const event = body?.event;
  if (!event) {
    logger.warn('Feishu webhook: no event in body', { channelId });
    return;
  }

  const channels = configStore.get('channels');
  const channel = channels.find(c => c.id === channelId);

  if (!channel || channel.platform !== 'feishu' || !channel.enabled) {
    logger.warn('Feishu webhook: invalid/disabled channel', { channelId });
    return;
  }

  const feishuConfig = channel.config as FeishuConfig;

  // Verify signature if configured
  if (feishuConfig.verificationToken) {
    const headerToken = req.headers['x-lark-signature'] as string;
    const timestamp = req.headers['x-lark-request-timestamp'] as string;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (headerToken && timestamp) {
      const isValid = feishuService.verifyWebhookSignature(feishuConfig, timestamp, headerToken, rawBody);
      if (!isValid) {
        logger.warn('Feishu webhook: signature verification failed', { channelId });
        return;
      }
    }
  }

  const msgType = event?.message?.msg_type;
  const chatId = event?.message?.chat_id;
  const senderId = event?.sender?.sender_id?.open_id || event?.sender?.sender_id?.user_id || 'unknown';

  // Extract text content
  let textContent = '';
  if (msgType === 'text') {
    try {
      const msgContent = JSON.parse(event?.message?.content || '{}');
      textContent = msgContent.text?.trim() || '';
    } catch {
      textContent = event?.message?.content?.trim() || '';
    }
  } else if (msgType === 'post') {
    try {
      const msgContent = JSON.parse(event?.message?.content || '{}');
      const lines = msgContent.content || [];
      for (const line of lines) {
        for (const block of line) {
          if (block.tag === 'text') {
            textContent += block.text || '';
          }
        }
      }
      textContent = textContent.trim();
    } catch {
      textContent = '';
    }
  }

  if (!textContent || !chatId) {
    logger.warn('Feishu webhook: no text content or chat_id', { channelId, msgType });
    return;
  }

  logger.info('Feishu webhook received', { channelId, chatId, senderId, msgType });

  const difyInstance = findDifyInstance(channel.difyInstanceId);
  if (!difyInstance) {
    logger.error('Feishu webhook: Dify instance not found', { difyInstanceId: channel.difyInstanceId });
    return;
  }

  const appApiKey = findAppApiKey(difyInstance, channel.difyAppId);
  if (!appApiKey) {
    logger.error('Feishu webhook: cannot resolve app API key', { difyAppId: channel.difyAppId });
    return;
  }

  const chatResponse = await difyService.chat(difyInstance, {
    appId: channel.difyAppId,
    message: textContent,
    userId: `feishu_${senderId}`
  }, appApiKey);

  const replyText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';
  await feishuService.sendTextMessage(feishuConfig, senderId, replyText);

  logger.info('Feishu webhook processed', { channelId, difyMessageId: chatResponse.messageId });
}

// ─── Route definitions ───

/**
 * DingTalk-specific webhook endpoint.
 * POST /api/webhook/dingtalk/:channelId
 */
router.post('/dingtalk/:channelId', async (req: Request, res: Response) => {
  // DingTalk expects an immediate 200 OK
  res.status(200).json({ success: true });

  try {
    await processDingTalkWebhook(req, req.params.channelId);
  } catch (error: any) {
    logger.error('DingTalk webhook processing failed', { error: error.message, stack: error.stack });
  }
});

/**
 * Feishu-specific webhook endpoint.
 * POST /api/webhook/feishu/:channelId
 */
router.post('/feishu/:channelId', async (req: Request, res: Response) => {
  const body = req.body;

  // Feishu URL verification challenge
  if (body?.challenge) {
    res.json({ challenge: body.challenge });
    return;
  }

  // Respond immediately, process asynchronously
  res.status(200).json({ success: true });

  try {
    await processFeishuWebhook(req, req.params.channelId);
  } catch (error: any) {
    logger.error('Feishu webhook processing failed', { error: error.message, stack: error.stack });
  }
});

/**
 * Generic webhook endpoint — auto-detects platform from channel config.
 * POST /api/webhook/:channelId
 * 
 * This is the most convenient endpoint: just use the channel ID,
 * and the gateway handles platform dispatching internally.
 */
router.post('/:channelId', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channels = configStore.get('channels');
  const channel = channels.find(c => c.id === channelId);

  if (!channel || !channel.enabled) {
    res.status(404).json({ success: false, error: 'Channel not found or disabled' });
    return;
  }

  if (channel.platform === 'dingtalk') {
    // DingTalk expects immediate 200 OK
    res.status(200).json({ success: true });
    try {
      await processDingTalkWebhook(req, channelId);
    } catch (error: any) {
      logger.error('DingTalk webhook processing failed', { error: error.message });
    }
  } else if (channel.platform === 'feishu') {
    // Feishu challenge check
    if (req.body?.challenge) {
      res.json({ challenge: req.body.challenge });
      return;
    }
    res.status(200).json({ success: true });
    try {
      await processFeishuWebhook(req, channelId);
    } catch (error: any) {
      logger.error('Feishu webhook processing failed', { error: error.message });
    }
  } else {
    res.status(400).json({ success: false, error: `Unsupported platform: ${channel.platform}` });
  }
});

export default router;
