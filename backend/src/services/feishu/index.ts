/**
 * 飞书服务统一入口
 * 负责频道生命周期管理（启动/停止/测试连接）
 */
import type { FeishuConfig, ChannelConfig } from '../../types/index.js';
import { startChannel, stopChannel, stopAllChannels, getActiveConnectionCount } from './monitor.js';
import { getBotInfo, getTenantAccessToken, sendTextMessage, verifyWebhookSignature } from './send.js';
import { clearDedupInstance } from './dedup.js';
import logger from '../../utils/logger.js';

export interface FeishuTestResult {
  success: boolean;
  message: string;
  botName?: string;
  botOpenId?: string;
}

/** 测试飞书连接（不保存配置，只验证连通性） */
export async function testConnection(config: FeishuConfig): Promise<FeishuTestResult> {
  try {
    const token = await getTenantAccessToken(config);
    if (!token) {
      return { success: false, message: '无法获取 tenant_access_token，请检查 appId 和 appSecret' };
    }

    // 尝试获取 Bot 信息
    const botInfo = await getBotInfo(config);
    return {
      success: true,
      message: `连接成功！机器人名称：${botInfo.name}，Open ID：${botInfo.openId}`,
      botName: botInfo.name,
      botOpenId: botInfo.openId,
    };
  } catch (err: any) {
    const detail = err.response?.data?.msg || err.message;
    return {
      success: false,
      message: `连接失败：${detail}`,
    };
  }
}

/** 启动频道（根据频道配置启动对应连接） */
export async function startFeishuChannel(channelId: string, config: FeishuConfig): Promise<void> {
  if (!config.appId || !config.appSecret) {
    logger.warn('Feishu channel missing appId or appSecret', { channelId });
    return;
  }

  const mode = config.connectionMode || 'websocket';
  logger.info('Starting Feishu channel', { channelId, mode });

  try {
    await startChannel(channelId, config);
  } catch (err: any) {
    logger.error('Failed to start Feishu channel', { channelId, error: err.message });
  }
}

/** 停止频道连接 */
export async function stopFeishuChannel(channelId: string): Promise<void> {
  await stopChannel(channelId);
  clearDedupInstance(channelId);
}

/** 初始化所有已启用的飞书频道 */
export async function initializeChannels(channels: ChannelConfig[]): Promise<void> {
  const feishuChannels = channels.filter(
    (c: ChannelConfig) => c.platform === 'feishu' && c.enabled
  );

  logger.info(`Initializing ${feishuChannels.length} Feishu channel(s)`);

  for (const channel of feishuChannels) {
    await startFeishuChannel(channel.id, channel.config as FeishuConfig);
  }
}

export const feishuService = {
  testConnection,
  startChannel: startFeishuChannel,
  stopChannel: stopFeishuChannel,
  initializeChannels,
  stopAllChannels,
  getActiveConnectionCount,
  getBotInfo,
  sendTextMessage,
  verifyWebhookSignature,
};
