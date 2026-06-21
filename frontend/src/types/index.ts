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

export interface ChatRequest {
  knowledgeBaseId: string;
  message: string;
  conversationId?: string;
  userId?: string;
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
  connectionMode?: 'stream' | 'webhook';
  webhookUrl?: string;
  signatureSecret?: string;
  dedupWindowMs?: number;
  responseMode?: 'blocking' | 'streaming';
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  botName?: string;
  connectionMode?: 'websocket' | 'webhook';
  verificationToken?: string;
  encryptKey?: string;
  dedupWindowMs?: number;
  responseMode?: 'blocking' | 'streaming';
}

export interface WeixinConfig {
  accountId: string;
  token: string;
  baseUrl?: string;
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
