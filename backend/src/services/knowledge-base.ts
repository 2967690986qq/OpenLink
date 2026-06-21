import axios from 'axios';
import { KnowledgeBaseConfig, ChatRequest, ChatResponse } from '../types/index.js';
import logger from '../utils/logger.js';

/** Strip trailing /v1 or /api segments so we can append paths cleanly */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '').replace(/\/api\/?$/, '');
}

export class KnowledgeBaseService {
  async testConnection(config: KnowledgeBaseConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (config.type === 'dify') {
        const base = normalizeBaseUrl(config.baseUrl);
        // Try service API (/v1/info) first, fall back to admin API (/api/info)
        const paths = ['/v1/info', '/api/info'];
        let lastError: any;
        for (const infoPath of paths) {
          try {
            const response = await axios.get(`${base}${infoPath}`, {
              headers: { 'Authorization': `Bearer ${config.apiKey}` },
              timeout: 10000
            });
            const data = response.data;
            logger.info('Dify connection test successful', { baseUrl: base, path: infoPath });
            return {
              success: true,
              message: `连接成功！应用：${data?.name || '未知'}${data?.mode ? `（${data.mode}）` : ''}，作者：${data?.author_name || '未知'}`
            };
          } catch (err: any) {
            lastError = err;
          }
        }
        // All paths failed
        const httpCode = lastError?.response?.status;
        const detail = lastError?.response?.data?.message || lastError?.response?.data?.error || lastError?.message;
        return {
          success: false,
          message: httpCode ? `连接失败 (HTTP ${httpCode})：${detail}` : `连接失败：${detail}`
        };
      }

      if (config.type === 'ragflow') {
        const response = await axios.get(`${config.baseUrl}/api/v1/knowledge_base`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`
          },
          timeout: 15000
        });
        logger.info('RAGFlow connection test successful', { baseUrl: config.baseUrl });
        return {
          success: true,
          message: `RAGFlow 连接成功！知识库数量：${response.data?.data?.length || 0}`
        };
      }

      return { success: false, message: `不支持的知识库类型：${config.type}` };
    } catch (error: any) {
      logger.error('Knowledge base connection test failed', { type: config.type, baseUrl: config.baseUrl, error: error.message });
      const httpCode = error.response?.status;
      const detail = error.response?.data?.message || error.response?.data?.error || error.message;
      return {
        success: false,
        message: httpCode ? `连接失败 (HTTP ${httpCode})：${detail}` : `连接失败：${detail}`
      };
    }
  }

  async chat(config: KnowledgeBaseConfig, request: ChatRequest): Promise<ChatResponse> {
    try {
      if (config.type === 'dify') {
        // Try service API (/v1/chat-messages) first, fall back to admin API (/api/chat-messages)
        const base = normalizeBaseUrl(config.baseUrl);
        const chatPaths = ['/v1/chat-messages', '/api/chat-messages'];
        const payload = {
          inputs: {},
          query: request.message,
          response_mode: request.responseMode || 'blocking',
          conversation_id: request.conversationId || '',
          user: request.userId || 'gateway-user'
        };
        const headers = {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        };
        let lastError: any;
        for (const chatPath of chatPaths) {
          try {
            const response = await axios.post(`${base}${chatPath}`, payload, {
              headers,
              timeout: 60000
            });
            const data = response.data;
            return {
              messageId: data.message_id || Date.now().toString(),
              content: data.answer || '',
              conversationId: data.conversation_id || '',
              usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
              } : undefined
            };
          } catch (err: any) {
            lastError = err;
          }
        }
        throw new Error(`对话请求失败：${lastError?.response?.data?.message || lastError?.message}`);
      }

      if (config.type === 'ragflow') {
        const response = await axios.post(`${config.baseUrl}/api/v1/conversation`, {
          message: request.message,
          conversation_id: request.conversationId || undefined,
          user_id: request.userId || 'gateway-user'
        }, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        });

        const data = response.data;
        return {
          messageId: data.data?.message_id || Date.now().toString(),
          content: data.data?.answer || data.data?.content || data.answer || '',
          conversationId: data.data?.conversation_id || data.conversation_id || ''
        };
      }

      throw new Error(`不支持的知识库类型：${config.type}`);
    } catch (error: any) {
      logger.error('Knowledge base chat request failed', { type: config.type, error: error.message });
      throw new Error(`对话请求失败：${error.response?.data?.message || error.message}`);
    }
  }

  async chatStreaming(
    config: KnowledgeBaseConfig,
    request: ChatRequest,
    onChunk: (chunkText: string, fullText: string) => void
  ): Promise<ChatResponse> {
    try {
      if (config.type === 'dify') {
        const base = normalizeBaseUrl(config.baseUrl);
        const chatPaths = ['/v1/chat-messages', '/api/chat-messages'];
        const payload = {
          inputs: {},
          query: request.message,
          response_mode: 'streaming',
          conversation_id: request.conversationId || '',
          user: request.userId || 'gateway-user'
        };
        const headers = {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        };
        let lastError: any;
        for (const chatPath of chatPaths) {
          try {
            const response = await axios.post(`${base}${chatPath}`, payload, {
              headers,
              responseType: 'stream',
              timeout: 60000
            });
            let fullText = '';
            let messageId = '';
            let conversationId = '';
            let buffer = '';
            const stream: NodeJS.ReadableStream = response.data;
            for await (const rawChunk of stream) {
              buffer += rawChunk.toString();
              let sepIndex;
              while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
                const block = buffer.slice(0, sepIndex);
                buffer = buffer.slice(sepIndex + 2);
                const lines = block.split('\n');
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const jsonStr = line.slice('data: '.length).trim();
                  if (!jsonStr) continue;
                  try {
                    const eventData = JSON.parse(jsonStr);
                    const event = eventData.event;
                    if (event === 'message') {
                      const answer = eventData.answer || '';
                      if (answer) {
                        fullText += answer;
                        onChunk(answer, fullText);
                      }
                      if (eventData.message_id) messageId = eventData.message_id;
                      if (eventData.conversation_id) conversationId = eventData.conversation_id;
                    } else if (event === 'message_end') {
                      if (eventData.message_id) messageId = eventData.message_id;
                      if (eventData.conversation_id) conversationId = eventData.conversation_id;
                      return {
                        messageId: messageId || Date.now().toString(),
                        content: fullText,
                        conversationId: conversationId || ''
                      };
                    }
                  } catch {
                  }
                }
              }
            }
            return {
              messageId: messageId || Date.now().toString(),
              content: fullText,
              conversationId: conversationId || ''
            };
          } catch (err: any) {
            lastError = err;
          }
        }
        throw new Error(`流式对话请求失败：${lastError?.response?.data?.message || lastError?.message}`);
      }

      if (config.type === 'ragflow') {
        logger.info('ragflow streaming not supported, falling back to blocking chat');
        return this.chat(config, request);
      }

      throw new Error(`不支持的知识库类型：${config.type}`);
    } catch (error: any) {
      logger.error('Knowledge base chat streaming request failed', { type: config.type, error: error.message });
      throw new Error(`流式对话请求失败：${error.response?.data?.message || error.message}`);
    }
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
