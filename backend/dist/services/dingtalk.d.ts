import { DingTalkConfig } from '../types/index.js';
interface DingTalkMessage {
    msgtype: string;
    text?: {
        content: string;
    };
    markdown?: {
        title: string;
        text: string;
    };
}
export declare class DingTalkService {
    private tokenCache;
    getAccessToken(config: DingTalkConfig): Promise<string>;
    sendMessage(config: DingTalkConfig, conversationId: string, message: DingTalkMessage): Promise<void>;
    sendTextMessage(config: DingTalkConfig, conversationId: string, content: string): Promise<void>;
    sendMarkdownMessage(config: DingTalkConfig, conversationId: string, title: string, text: string): Promise<void>;
    verifySignature(token: string, signature: string, timestamp: string, nonce: string): boolean;
    registerCallback(config: DingTalkConfig, callbackUrl: string, token: string, aesKey: string): Promise<void>;
    decryptCallbackData(encryptStr: string, aesKey: string): string;
}
export declare const dingTalkService: DingTalkService;
export {};
