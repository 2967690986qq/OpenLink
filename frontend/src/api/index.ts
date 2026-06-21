import axios from 'axios';
import type { KnowledgeBaseConfig, ChannelConfig, ChatResponse, ApiResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('openlink_auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.setItem('openlink_auth_error', error.response?.data?.error || 'Authentication required');
    }
    return Promise.reject(error);
  }
);

export const knowledgeBaseApi = {
  list: () => api.get<ApiResponse<KnowledgeBaseConfig[]>>('/knowledge-base'),

  create: (data: { name: string; type: string; baseUrl: string; apiKey: string; description?: string }) =>
    api.post<ApiResponse<KnowledgeBaseConfig>>('/knowledge-base', data),

  update: (id: string, data: Partial<KnowledgeBaseConfig>) =>
    api.put<ApiResponse<KnowledgeBaseConfig>>(`/knowledge-base/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/knowledge-base/${id}`),

  test: (id: string) => api.post<ApiResponse>(`/knowledge-base/${id}/test`),

  // Test connection using config data directly (without saving first)
  testConnection: (data: { type: string; baseUrl: string; apiKey: string }) =>
    api.post<ApiResponse>(`/knowledge-base/test-connection`, data),

  chat: (id: string, data: { message: string; conversationId?: string; userId?: string }) =>
    api.post<ApiResponse<ChatResponse>>(`/knowledge-base/${id}/chat`, data)
};

export const channelApi = {
  list: () => api.get<ApiResponse<ChannelConfig[]>>('/channels'),

  create: (data: { platform: string; name: string; knowledgeBaseId: string; config: any }) =>
    api.post<ApiResponse<ChannelConfig>>('/channels', data),

  update: (id: string, data: Partial<ChannelConfig>) =>
    api.put<ApiResponse<ChannelConfig>>(`/channels/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/channels/${id}`),

  test: (id: string) => api.post<ApiResponse>(`/channels/${id}/test`),

  testPlatform: (platform: string, config: any) =>
    api.post<ApiResponse>(`/channels/test/${platform}`, config),

  getBot: (id: string) => api.get<ApiResponse>(`/channels/${id}/bot`),

  getWebhookUrl: (id: string) => api.get<ApiResponse>(`/channels/${id}/webhookUrl`),

  // 微信扫码相关
  generateQrCode: (baseUrl?: string) =>
    api.post<ApiResponse<{ sessionId: string; qrcode: string; qrcodeUrl: string; baseUrl: string }>>(
      '/channels/weixin/qrcode',
      { baseUrl }
    ),

  pollQrStatus: (sessionId: string) =>
    api.post<ApiResponse<{
      status: 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error';
      message?: string;
      account_id?: string;
      token?: string;
      base_url?: string;
    }>>('/channels/weixin/poll-status', { sessionId }),

  stopQrSession: (sessionId: string) =>
    api.post<ApiResponse>(`/channels/weixin/stop-qr/${sessionId}`)
};

export const configApi = {
  get: () => api.get<ApiResponse>('/config'),

  update: (data: any) => api.put<ApiResponse>('/config', data),

  getAll: () => api.get<ApiResponse>('/config/all'),

  reset: () => api.post<ApiResponse>('/config/reset', { confirm: true }),

  restart: () => api.post<ApiResponse>('/config/restart')
};

export default api;
