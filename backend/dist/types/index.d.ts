export interface DifyConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
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
}
export interface ChatMessage {
    messageId: string;
    appId: string;
    content: string;
    role: 'user' | 'assistant';
    createdAt: string;
}
export interface ChatRequest {
    appId: string;
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
    platform: 'dingtalk' | 'feishu' | 'wechat' | 'wecom';
    name: string;
    enabled: boolean;
    config: DingTalkConfig | FeishuConfig;
    createdAt: string;
    updatedAt: string;
}
export interface DingTalkConfig {
    clientId: string;
    clientSecret: string;
    botAppId?: string;
    webhookUrl?: string;
    signatureSecret?: string;
}
export interface FeishuConfig {
    appId: string;
    appSecret: string;
    botName?: string;
    webhookUrl?: string;
    verificationToken?: string;
}
export interface DetectedService {
    name: string;
    type: 'dify' | 'unknown';
    url: string;
    port: number;
    status: 'running' | 'stopped';
    version?: string;
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
}
