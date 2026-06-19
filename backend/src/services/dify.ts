import axios, { AxiosInstance } from 'axios';
import { DifyConfig, DifyApp, ChatRequest, ChatResponse } from '../types/index.js';
import logger from '../utils/logger.js';

export class DifyService {
  private getClient(config: DifyConfig): AxiosInstance {
    return axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async testConnection(config: DifyConfig): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.getClient(config);
      const response = await client.get('/api/info');
      logger.info('Dify connection test successful', { baseUrl: config.baseUrl });
      return {
        success: true,
        message: `Connected successfully. Dify version: ${response.data?.data?.version || 'unknown'}`
      };
    } catch (error: any) {
      logger.error('Dify connection test failed', { baseUrl: config.baseUrl, error: error.message });
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed'
      };
    }
  }

  async listApps(config: DifyConfig): Promise<DifyApp[]> {
    try {
      const client = this.getClient(config);

      // Try to get apps from different API endpoints
      // Dify v1 API structure
      const response = await client.get('/api/v1/apps', {
        params: { page: 1, limit: 50 }
      });

      if (response.data?.data) {
        return response.data.data.map((app: any) => ({
          id: app.id,
          name: app.name,
          description: app.description,
          icon: app.icon,
          status: app.status || 'normal'
        }));
      }

      return [];
    } catch (error: any) {
      logger.error('Failed to list Dify apps', { baseUrl: config.baseUrl, error: error.message });
      throw new Error(`Failed to list apps: ${error.response?.data?.message || error.message}`);
    }
  }

  async chat(config: DifyConfig, request: ChatRequest): Promise<ChatResponse> {
    try {
      const client = this.getClient(config);

      const response = await client.post('/api/chat-messages', {
        inputs: {},
        query: request.message,
        response_mode: 'blocking',
        conversation_id: request.conversationId || '',
        user: request.userId || 'gateway-user'
      });

      const data = response.data?.data;

      return {
        messageId: data?.message_id || Date.now().toString(),
        content: data?.answer || data?.content || '',
        conversationId: data?.conversation_id || '',
        usage: data?.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    } catch (error: any) {
      logger.error('Dify chat request failed', { appId: request.appId, error: error.message });
      throw new Error(`Chat failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async streamChat(
    config: DifyConfig,
    request: ChatRequest,
    onMessage: (content: string) => void
  ): Promise<void> {
    try {
      const client = this.getClient(config);

      const response = await client.post(
        '/api/chat-messages',
        {
          inputs: {},
          query: request.message,
          response_mode: 'streaming',
          conversation_id: request.conversationId || '',
          user: request.userId || 'gateway-user'
        },
        {
          responseType: 'stream'
        }
      );

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.event === 'message' || data.event === 'agent_message') {
                  onMessage(data.answer || data.content || '');
                }
                if (data.event === 'end') {
                  resolve();
                }
              } catch {}
            }
          }
        });

        response.data.on('error', reject);
        response.data.on('end', resolve);
      });
    } catch (error: any) {
      logger.error('Dify stream chat failed', { appId: request.appId, error: error.message });
      throw new Error(`Stream chat failed: ${error.message}`);
    }
  }

  async getAppInfo(config: DifyConfig, appId: string): Promise<DifyApp | null> {
    try {
      const client = this.getClient(config);
      const response = await client.get(`/api/v1/apps/${appId}`);

      if (response.data?.data) {
        const app = response.data.data;
        return {
          id: app.id,
          name: app.name,
          description: app.description,
          icon: app.icon,
          status: app.status || 'normal'
        };
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to get Dify app info', { appId, error: error.message });
      return null;
    }
  }
}

export const difyService = new DifyService();
