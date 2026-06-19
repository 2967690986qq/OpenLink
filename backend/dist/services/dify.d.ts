import { DifyConfig, DifyApp, ChatRequest, ChatResponse } from '../types/index.js';
export declare class DifyService {
    private getClient;
    testConnection(config: DifyConfig): Promise<{
        success: boolean;
        message: string;
    }>;
    listApps(config: DifyConfig): Promise<DifyApp[]>;
    chat(config: DifyConfig, request: ChatRequest): Promise<ChatResponse>;
    streamChat(config: DifyConfig, request: ChatRequest, onMessage: (content: string) => void): Promise<void>;
    getAppInfo(config: DifyConfig, appId: string): Promise<DifyApp | null>;
}
export declare const difyService: DifyService;
