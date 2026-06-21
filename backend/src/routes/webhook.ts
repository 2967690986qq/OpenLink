import { Router, Request, Response } from 'express';
import { configStore } from '../config/store.js';
import { knowledgeBaseService } from '../services/knowledge-base.js';
import { dingTalkService } from '../services/dingtalk.js';
import { feishuService } from '../services/feishu/index.js';
import logger from '../utils/logger.js';
import type { DingTalkConfig, FeishuConfig, KnowledgeBaseConfig } from '../types/index.js';

const router = Router();

function findKnowledgeBase(knowledgeBaseId: string): KnowledgeBaseConfig | null {
  const knowledgeBases = configStore.get('knowledgeBases');
  const kb = knowledgeBases.find(k => k.id === knowledgeBaseId && k.enabled);
  return kb || null;
}

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

  const kb = findKnowledgeBase(channel.knowledgeBaseId);
  if (!kb) {
    logger.error('DingTalk webhook: knowledge base not found', { knowledgeBaseId: channel.knowledgeBaseId });
    return;
  }

  const chatResponse = await knowledgeBaseService.chat(kb, {
    knowledgeBaseId: kb.id,
    message: textContent,
    userId: `dingtalk_${senderId}`
  });

  const replyText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';
  await dingTalkService.sendTextMessage(dingtalkConfig, conversationId, replyText);

  logger.info('DingTalk webhook processed', { channelId, messageId: chatResponse.messageId });
}

async function processFeishuWebhook(req: Request, channelId: string): Promise<void> {
  const body = req.body;

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

  const kb = findKnowledgeBase(channel.knowledgeBaseId);
  if (!kb) {
    logger.error('Feishu webhook: knowledge base not found', { knowledgeBaseId: channel.knowledgeBaseId });
    return;
  }

  const chatResponse = await knowledgeBaseService.chat(kb, {
    knowledgeBaseId: kb.id,
    message: textContent,
    userId: `feishu_${senderId}`
  });

  const replyText = chatResponse.content || '抱歉，我暂时无法回答这个问题。';
  await feishuService.sendTextMessage(feishuConfig, senderId, replyText);

  logger.info('Feishu webhook processed', { channelId, messageId: chatResponse.messageId });
}

router.post('/dingtalk/:channelId', async (req: Request, res: Response) => {
  res.status(200).json({ success: true });
  try {
    await processDingTalkWebhook(req, req.params.channelId);
  } catch (error: any) {
    logger.error('DingTalk webhook processing failed', { error: error.message, stack: error.stack });
  }
});

router.post('/feishu/:channelId', async (req: Request, res: Response) => {
  const body = req.body;

  if (body?.challenge) {
    res.json({ challenge: body.challenge });
    return;
  }

  res.status(200).json({ success: true });

  try {
    await processFeishuWebhook(req, req.params.channelId);
  } catch (error: any) {
    logger.error('Feishu webhook processing failed', { error: error.message, stack: error.stack });
  }
});

router.post('/:channelId', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const channels = configStore.get('channels');
  const channel = channels.find(c => c.id === channelId);

  if (!channel || !channel.enabled) {
    res.status(404).json({ success: false, error: '频道不存在或已禁用' });
    return;
  }

  if (channel.platform === 'dingtalk') {
    res.status(200).json({ success: true });
    try {
      await processDingTalkWebhook(req, channelId);
    } catch (error: any) {
      logger.error('DingTalk webhook processing failed', { error: error.message });
    }
  } else if (channel.platform === 'feishu') {
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
    res.status(400).json({ success: false, error: `不支持的平台：${channel.platform}` });
  }
});

export default router;
