import axios from 'axios';
import type { DifyConfig, DifyApp, ChannelConfig, DetectedService, ApiResponse, ChatRequest, ChatResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

// Auto-attach auth token from localStorage to every admin API request.
// The token is set by the user in Settings or during initial setup.
// If no token is stored, requests go through without auth header (open mode).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('openlink_auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// On 401/403 responses, redirect to a token setup prompt
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Store the error info so the UI can show a token setup dialog
      localStorage.setItem('openlink_auth_error', error.response?.data?.error || 'Authentication required');
    }
    return Promise.reject(error);
  }
);

// Dify APIs
export const difyApi = {
  list: () => api.get<ApiResponse<DifyConfig[]>>('/dify'),

  detect: () => api.get<ApiResponse<DetectedService[]>>('/dify/detect'),

  create: (data: { name: string; baseUrl: string; apiKey: string }) =>
    api.post<ApiResponse<DifyConfig>>('/dify', data),

  update: (id: string, data: Partial<DifyConfig>) =>
    api.put<ApiResponse<DifyConfig>>(`/dify/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/dify/${id}`),

  test: (id: string) => api.post<ApiResponse>(`/dify/${id}/test`),

  listApps: (id: string) => api.get<ApiResponse<DifyApp[]>>(`/dify/${id}/apps`),

  chat: (id: string, data: ChatRequest) =>
    api.post<ApiResponse<ChatResponse>>(`/dify/${id}/chat`, data)
};

// Channel APIs
export const channelApi = {
  list: () => api.get<ApiResponse<ChannelConfig[]>>('/channels'),

  create: (data: { platform: string; name: string; difyInstanceId: string; difyAppId: string; config: any; appApiKey?: string }) =>
    api.post<ApiResponse<ChannelConfig>>('/channels', data),

  update: (id: string, data: Partial<ChannelConfig>) =>
    api.put<ApiResponse<ChannelConfig>>(`/channels/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/channels/${id}`),

  test: (id: string) => api.post<ApiResponse>(`/channels/${id}/test`),

  getBot: (id: string) => api.get<ApiResponse>(`/channels/${id}/bot`),

  setAppApiKey: (id: string, appApiKey: string) =>
    api.post<ApiResponse>(`/channels/${id}/appApiKey`, { appApiKey }),

  getWebhookUrl: (id: string) => api.get<ApiResponse>(`/channels/${id}/webhookUrl`)
};

// Config APIs
export const configApi = {
  get: () => api.get<ApiResponse>('/config'),

  update: (data: any) => api.put<ApiResponse>('/config', data),

  getAll: () => api.get<ApiResponse>('/config/all'),

  reset: () => api.post<ApiResponse>('/config/reset', { confirm: true })
};

export default api;
