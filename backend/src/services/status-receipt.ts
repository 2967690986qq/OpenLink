/**
 * 统一状态回执服务
 *
 * 功能：
 *   1. 用户发消息 → 网关先发送"消息已收到，AI正在处理"回执卡片
 *   2. 飞书：post 富文本卡片
 *   3. 钉钉：ActionCard markdown 卡片
 *
 * 回执结构：
 *   [emoji] [状态文本] | [机器人名]
 *   例：⚡ 处理中 | AI助手
 *
 * 可配置项（在各频道 config.statusReceipt）：
 *   - enabled:      开关
 *   - emoji:      左侧图标（默认 "⚡"）
 *   - processingText: "处理中" / "思考中" 等
 *   - doneText:   "已收到"（暂不发送，正式回复即代表完成）
 *   - errorText:  "异常"
 *   - botName:    机器人显示名
 *   - delayMs:    发送前等待时间（默认 0，立即发送）
 */

import type { FeishuConfig, DingTalkConfig, StatusReceiptConfig } from '../types/index.js';
import logger from '../utils/logger.js';

/** 统一的回执渲染结果：供各 IM 发送 */
export interface ReceiptPayload {
  feishu?: { msg_type: 'post'; content: any }; // 飞书 post 格式
  dingtalk?: { msgKey: string; msgParam: string }; // 钉钉 actionCard 格式
}

/** 默认回执配置 */
const DEFAULT_RECEIPT: Required<StatusReceiptConfig> = {
  enabled: true,
  emoji: '⚡',
  processingText: '消息已收到，AI 正在处理...',
  doneText: 'Done',
  errorText: '处理异常',
  botName: 'AI 助手',
  delayMs: 0,
};

/** 合并用户配置与默认值 */
export function resolveReceiptConfig(
  userConfig: StatusReceiptConfig | undefined): Required<StatusReceiptConfig> {
  const base: StatusReceiptConfig = userConfig || {};
  return {
    enabled: base.enabled !== false, // 默认开启
    emoji: base.emoji || DEFAULT_RECEIPT.emoji,
    processingText: base.processingText || DEFAULT_RECEIPT.processingText,
    doneText: base.doneText || DEFAULT_RECEIPT.doneText,
    errorText: base.errorText || DEFAULT_RECEIPT.errorText,
    botName: base.botName || DEFAULT_RECEIPT.botName,
    delayMs: typeof base.delayMs === 'number' ? base.delayMs : DEFAULT_RECEIPT.delayMs,
  };
}

/**
 * 渲染飞书 post 富文本卡片
 *
 * 结构（zh_cn）：
 *   {
 *     "title": "",
 *     "content": [
 *       [{ "tag": "text", "text": "⚡ 消息已收到，AI 正在处理... | AI 助手" }]
 *     ]
 *   }
 *
 * 为了让结构更清晰，我们也可以使用多行排版：
 *   ⚡ 处理中
 *   --------
 *   AI 助手
 */
export function renderFeishuPost(
  receipt: Required<StatusReceiptConfig>, status: 'processing' | 'done' | 'error' = 'processing') {
  const statusText = status === 'processing'
    ? receipt.processingText
    : status === 'done'
      ? receipt.doneText
      : receipt.errorText;

  // 第一行：emoji + 状态文本
  // 第二行：分隔线
  // 第三行：机器人名
  const content = {
    zh_cn: {
      title: '',
      content: [
        [
          { tag: 'text', text: `${receipt.emoji}  ${statusText}` },
        ],
        [
          { tag: 'text', text: `— ${receipt.botName}` },
        ],
      ],
    },
  };

  return {
    msg_type: 'post' as const,
    content: JSON.stringify(content),
  };
}

/**
 * 渲染钉钉 ActionCard 卡片（sampleMarkdown 格式）
 *
 * 钉钉支持的 msgKey 示例：sampleMarkdown
 *   content:
 *     ⚡ **消息已收到，AI 正在处理...**
 *     \n---
 *     \n*AI 助手*
 */
export function renderDingtalkActionCard(
  receipt: Required<StatusReceiptConfig>, status: 'processing' | 'done' | 'error' = 'processing') {
  const statusText = status === 'processing'
    ? receipt.processingText
    : status === 'done'
      ? receipt.doneText
      : receipt.errorText;

  const markdown = `${receipt.emoji} **${statusText}**\n\n---\n\n*${receipt.botName}*`;

  return {
    msgKey: 'sampleMarkdown',
    msgParam: JSON.stringify({ markdown_text: markdown, title: receipt.botName }),
  };
}

/**
 * 构建飞书状态回执
 *   返回 payload 的 msg_type / content 可直接用于 sendMessage / replyMessage
 */
export function buildFeishuReceipt(
  userConfig: StatusReceiptConfig | undefined,
  status: 'processing' | 'done' | 'error' = 'processing',
) {
  const receipt = resolveReceiptConfig(userConfig);
  return { receipt, payload: renderFeishuPost(receipt, status) };
}

/**
 * 构建钉钉状态回执
 *   返回 payload 的 msgKey / msgParam 可直接用于 sendCustomMessage
 */
export function buildDingtalkReceipt(
  userConfig: StatusReceiptConfig | undefined,
  status: 'processing' | 'done' | 'error' = 'processing',
) {
  const receipt = resolveReceiptConfig(userConfig);
  return { receipt, payload: renderDingtalkActionCard(receipt, status) };
}

/**
 * 统一发送状态回执（简化版：只需要你直接调用飞书/钉钉的发送接口
 * 我们这里返回 payload，由调用方使用自己的发送函数发送）
 */
export function buildReceipt(
  platform: 'feishu' | 'dingtalk',
  userConfig: StatusReceiptConfig | undefined,
  status: 'processing' | 'done' | 'error' = 'processing') {
  const receipt = resolveReceiptConfig(userConfig);
  if (platform === 'feishu') return { receipt, payload: renderFeishuPost(receipt, status) };
  return { receipt, payload: renderDingtalkActionCard(receipt, status) };
}

/** 判断是否启用回执 */
export function isReceiptEnabled(userConfig: StatusReceiptConfig | undefined): boolean {
  return resolveReceiptConfig(userConfig).enabled;
}

/** 工具：获取 bot 名称（优先使用用户配置，其次回退为默认值） */
export function getBotName(userConfig: StatusReceiptConfig | undefined, fallback?: string): string {
  return userConfig?.botName || fallback || DEFAULT_RECEIPT.botName;
}

logger.debug('Status receipt service loaded');

// 兼容：导出
export default {
  renderFeishuPost,
  renderDingtalkActionCard,
  buildReceipt,
  isReceiptEnabled,
  getBotName,
  resolveReceiptConfig,
};
