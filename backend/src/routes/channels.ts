import { Router, Request, Response } from 'express';
import { configStore } from '../config/store.js';
import { feishuService } from '../services/feishu/index.js';
import * as dingtalkService from '../services/dingtalk/index.js';
import * as weixinService from '../services/weixin.js';
import type { ChannelConfig, FeishuConfig, DingTalkConfig, WeixinConfig } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/** 获取所有频道配置 */
router.get('/', (req: Request, res: Response) => {
  const channels = configStore.get('channels');
  res.json({
    success: true,
    data: channels,
  });
});

/** 获取单个频道配置 */
router.get('/:id', (req: Request, res: Response) => {
  const channels = configStore.get('channels');
  const channel = channels.find((c) => c.id === req.params.id);
  if (!channel) {
    res.status(404).json({ success: false, error: '频道不存在' });
    return;
  }
  res.json({ success: true, data: channel });
});

/** 创建频道 */
router.post('/', async (req: Request, res: Response) => {
  const { name, platform, config: platformConfig, knowledgeBaseId } = req.body || {};

  if (!name || !platform || !platformConfig || !knowledgeBaseId) {
    res.status(400).json({ success: false, error: '缺少必填参数: name, platform, config, knowledgeBaseId' });
    return;
  }

  if (!['feishu', 'dingtalk', 'weixin', 'wecom'].includes(platform)) {
    res.status(400).json({ success: false, error: `不支持的平台: ${platform}` });
    return;
  }

  // 验证知识库是否存在
  const knowledgeBases = configStore.get('knowledgeBases');
  if (!knowledgeBases.find((kb) => kb.id === knowledgeBaseId)) {
    res.status(400).json({ success: false, error: '知识库配置不存在' });
    return;
  }

  const newChannel: ChannelConfig = {
    id: uuidv4(),
    name,
    platform,
    enabled: true,
    knowledgeBaseId,
    config: platformConfig,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 保存
  const channels = configStore.get('channels');
  channels.push(newChannel);
  configStore.set('channels', channels);

  // 自动启动频道连接
  try {
    if (platform === 'feishu') {
      await feishuService.startChannel(newChannel.id, (newChannel.config as FeishuConfig));
    } else if (platform === 'dingtalk') {
      await dingtalkService.startChannel(newChannel.id, (newChannel.config as DingTalkConfig));
    } else if (platform === 'weixin') {
      weixinService.startChannel(newChannel.id, (newChannel.config as WeixinConfig));
    }
  } catch (err: any) {
    // 仅记录错误，不阻止创建
    console.error(`频道启动失败: ${err.message}`);
  }

  res.json({ success: true, data: newChannel });
});

/** 更新频道 */
router.put('/:id', async (req: Request, res: Response) => {
  const channels = configStore.get('channels');
  const channel = channels.find((c) => c.id === req.params.id);
  if (!channel) {
    res.status(404).json({ success: false, error: '频道不存在' });
    return;
  }

  const { name, enabled, config: platformConfig, knowledgeBaseId } = req.body || {};

  if (name !== undefined) channel.name = name;
  if (enabled !== undefined) channel.enabled = enabled;
  if (platformConfig !== undefined) channel.config = platformConfig;
  if (knowledgeBaseId !== undefined) channel.knowledgeBaseId = knowledgeBaseId;
  channel.updatedAt = new Date().toISOString();

  configStore.set('channels', channels);

  // 重启连接
  try {
    if (channel.platform === 'feishu') {
      await feishuService.stopChannel(channel.id);
      if (channel.enabled) {
        await feishuService.startChannel(channel.id, (channel.config as FeishuConfig));
      }
    } else if (channel.platform === 'dingtalk') {
      await dingtalkService.stopChannel(channel.id);
      if (channel.enabled) {
        await dingtalkService.startChannel(channel.id, (channel.config as DingTalkConfig));
      }
    } else if (channel.platform === 'weixin') {
      weixinService.stopChannel(channel.id);
      if (channel.enabled) {
        weixinService.startChannel(channel.id, (channel.config as WeixinConfig));
      }
    }
  } catch (err: any) {
    console.error(`频道重启失败: ${err.message}`);
  }

  res.json({ success: true, data: channel });
});

/** 删除频道 */
router.delete('/:id', async (req: Request, res: Response) => {
  const channels = configStore.get('channels');
  const channel = channels.find((c) => c.id === req.params.id);
  if (!channel) {
    res.status(404).json({ success: false, error: '频道不存在' });
    return;
  }

  // 停止频道连接
  try {
    if (channel.platform === 'feishu') {
      await feishuService.stopChannel(channel.id);
    } else if (channel.platform === 'dingtalk') {
      await dingtalkService.stopChannel(channel.id);
    } else if (channel.platform === 'weixin') {
      weixinService.stopChannel(channel.id);
    }
  } catch (err: any) {
    console.error(`停止频道失败: ${err.message}`);
  }

  const updatedChannels = channels.filter((c) => c.id !== req.params.id);
  configStore.set('channels', updatedChannels);
  res.json({ success: true });
});

/** 测试频道连接 */
router.post('/:id/test', async (req: Request, res: Response) => {
  const channels = configStore.get('channels') as any[];
  const channel = channels.find((c) => c.id === req.params.id);
  if (!channel) {
    res.status(404).json({ success: false, error: '频道不存在' });
    return;
  }

  try {
    let connected = false;
    if (channel.platform === 'feishu') {
      const result = await feishuService.testConnection(channel.config as FeishuConfig);
      connected = result?.success === true;
    } else if (channel.platform === 'dingtalk') {
      connected = await dingtalkService.testConnection(channel.config as DingTalkConfig);
    } else if (channel.platform === 'weixin') {
      connected = true;
    }

    res.json({ success: connected, message: connected ? '连接测试成功' : '连接测试失败' });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

/** 直接测试平台配置（不保存） */
router.post('/test/:platform', async (req: Request, res: Response) => {
  const platform = req.params.platform;
  const config = req.body;

  try {
    if (platform === 'feishu') {
      const result = await feishuService.testConnection(config as FeishuConfig);
      res.json({ success: result?.success === true, message: result?.message || (result?.success ? '飞书配置验证成功' : '飞书配置验证失败') });
    } else if (platform === 'dingtalk') {
      const ok = await dingtalkService.testConnection(config as DingTalkConfig);
      res.json({ success: ok, message: ok ? '钉钉配置验证成功' : '钉钉配置验证失败' });
    } else if (platform === 'weixin') {
      res.json({ success: true, message: '微信通过扫码配置' });
    } else {
      res.status(400).json({ success: false, error: `不支持的平台: ${platform}` });
    }
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// ============ 微信扫码相关 API ============

/** 生成微信二维码 */
router.post('/weixin/qrcode', async (req: Request, res: Response) => {
  const { sessionId, baseUrl } = req.body || {};
  const sid = sessionId || uuidv4();

  try {
    const result = await weixinService.generateQrCode(sid, baseUrl);
    res.json({ success: true, data: { sessionId: sid, ...result } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 轮询微信扫码状态 */
router.post('/weixin/poll-status', async (req: Request, res: Response) => {
  const { sessionId } = req.body || {};
  if (!sessionId) {
    res.status(400).json({ success: false, error: '缺少 sessionId' });
    return;
  }

  try {
    const result = await weixinService.pollQrStatus(sessionId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 停止微信扫码会话 */
router.post('/weixin/stop-qr/:sessionId', (req: Request, res: Response) => {
  weixinService.stopQrSession(req.params.sessionId);
  res.json({ success: true });
});

export default router;
