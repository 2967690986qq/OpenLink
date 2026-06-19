import { FeishuConfig } from '../types/index.js';
export declare class FeishuService {
    private tokenCache;
    getTenantAccessToken(config: FeishuConfig): Promise<string>;
    sendMessage(config: FeishuConfig, receiveId: string, msgType: string, content: string): Promise<void>;
    sendTextMessage(config: FeishuConfig, receiveId: string, text: string): Promise<void>;
    sendRichTextMessage(config: FeishuConfig, receiveId: string, title: string, content: string): Promise<void>;
    verifyWebhookSignature(config: FeishuConfig, timestamp: string, signature: string, rawBody: string): boolean;
    createWebhook(config: FeishuConfig, webhookName: string): Promise<string>;
    getBotInfo(config: FeishuConfig): Promise<{
        name: string;
        openId: string;
    } | null>;
}
export declare const feishuService: FeishuService;
