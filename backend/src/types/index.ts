export type KnowledgeBaseType = 'dify' | 'ragflow';

export interface KnowledgeBaseConfig {
  id: string;
  name: string;
  type: KnowledgeBaseType;
  baseUrl: string;
  apiKey: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DifyApp {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  status: 'normal' | 'archived';
  mode?: string;
}

export interface ChatMessage {
  messageId: string;
  appId: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
}

export interface ChatRequest {
  knowledgeBaseId: string;
  message: string;
  conversationId?: string;
  userId?: string;
  responseMode?: 'blocking' | 'streaming';
}

export interface ChatResponse {
  messageId: string;
  content: string;
  conversationId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChannelConfig {
  id: string;
  platform: 'dingtalk' | 'feishu' | 'weixin' | 'wecom';
  name: string;
  enabled: boolean;
  knowledgeBaseId: string;
  config: DingTalkConfig | FeishuConfig | WeixinConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DingTalkConfig {
  clientId: string;
  clientSecret: string;
  botAppId?: string;
  // 连接模式：stream（长连接，推荐，本地开发用）| webhook（需要公网回调）
  connectionMode?: 'stream' | 'webhook';
  // Webhook 模式专用
  webhookUrl?: string;
  signatureSecret?: string;
  // 消息去重窗口（毫秒），默认 30000
  dedupWindowMs?: number;
  // 状态回执配置
  statusReceipt?: StatusReceiptConfig;
  // 响应模式：blocking（同步返回，默认）| streaming（流式增量推送）
  responseMode?: 'blocking' | 'streaming';
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  botName?: string;
  // 连接模式：websocket（长连接，推荐，本地开发用）| webhook（需要公网回调）
  connectionMode?: 'websocket' | 'webhook';
  // Webhook 模式专用
  verificationToken?: string;
  encryptKey?: string;
  // 消息去重窗口（毫秒），默认 30000
  dedupWindowMs?: number;
  // 状态回执配置
  statusReceipt?: StatusReceiptConfig;
  // 响应模式：blocking（同步返回，默认）| streaming（流式增量推送）
  responseMode?: 'blocking' | 'streaming';
}

/** 状态回执配置（预处理通知卡片） */
export interface StatusReceiptConfig {
  // 全局开关
  enabled?: boolean;
  // 自定义 emoji 图标（Feishu 用表情字符串，如 "🤖" "⚡" "✨"）
  emoji?: string;
  // 自定义状态文案：处理中
  processingText?: string;
  // 自定义状态文案：完成
  doneText?: string;
  // 自定义状态文案：异常
  errorText?: string;
  // 自定义机器人名称（未配置时自动获取）
  botName?: string;
  // 回执发送延迟（毫秒），默认 0（即立即发送）
  delayMs?: number;
}

export interface WeixinConfig {
  accountId: string;
  token: string;
  baseUrl?: string; // iLink 基础URL，默认 https://ilink.example.com
  // 消息去重窗口（毫秒），默认 30000
  dedupWindowMs?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GatewayConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
  authToken?: string;
}
