import axios from 'axios';
import type { DifyConfig, DifyApp, ChannelConfig, DetectedService, ApiResponse, ChatRequest, ChatResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

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

  create: (data: { platform: string; name: string; config: any }) =>
    api.post<ApiResponse<ChannelConfig>>('/channels', data),

  update: (id: string, data: Partial<ChannelConfig>) =>
    api.put<ApiResponse<ChannelConfig>>(`/channels/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse>(`/channels/${id}`),

  test: (id: string) => api.post<ApiResponse>(`/channels/${id}/test`),

  getBot: (id: string) => api.get<ApiResponse>(`/channels/${id}/bot`)
};

// Config APIs
export const configApi = {
  get: () => api.get<ApiResponse>('/config'),

  update: (data: any) => api.put<ApiResponse>('/config', data),

  getAll: () => api.get<ApiResponse>('/config/all'),

  reset: () => api.post<ApiResponse>('/config/reset')
};

export default api;
