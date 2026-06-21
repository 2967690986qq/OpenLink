import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GatewayConfig, KnowledgeBaseConfig, ChannelConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface StoreConfig {
  gateway: GatewayConfig;
  knowledgeBases: KnowledgeBaseConfig[];
  channels: ChannelConfig[];
}

const defaultConfig: StoreConfig = {
  gateway: {
    port: 3000,
    host: '0.0.0.0',
    corsOrigins: ['http://localhost:5173', 'http://localhost:3001'],
    logLevel: 'info'
  },
  knowledgeBases: [],
  channels: []
};

function migrateConfig(data: any): StoreConfig {
  const result: StoreConfig = {
    gateway: data.gateway || defaultConfig.gateway,
    knowledgeBases: [],
    channels: []
  };

  if (Array.isArray(data.knowledgeBases) && data.knowledgeBases.length > 0) {
    result.knowledgeBases = data.knowledgeBases;
  } else if (Array.isArray(data.difyInstances) && data.difyInstances.length > 0) {
    result.knowledgeBases = data.difyInstances.map((inst: any) => ({
      id: inst.id,
      name: inst.name,
      type: 'dify',
      baseUrl: inst.baseUrl,
      apiKey: inst.apiKey,
      description: inst.description || '',
      enabled: inst.enabled !== undefined ? inst.enabled : true,
      createdAt: inst.createdAt || new Date().toISOString(),
      updatedAt: inst.updatedAt || new Date().toISOString()
    }));
  }

  if (Array.isArray(data.channels) && data.channels.length > 0) {
    result.channels = data.channels.map((ch: any) => ({
      id: ch.id,
      platform: ch.platform,
      name: ch.name,
      enabled: ch.enabled !== undefined ? ch.enabled : true,
      knowledgeBaseId: ch.knowledgeBaseId || ch.difyInstanceId || '',
      config: ch.config || {},
      createdAt: ch.createdAt || new Date().toISOString(),
      updatedAt: ch.updatedAt || new Date().toISOString()
    }));
  }

  return result;
}

class ConfigStore {
  private config: StoreConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): StoreConfig {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      if (fs.existsSync(CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        return migrateConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    this.saveConfig(defaultConfig);
    return JSON.parse(JSON.stringify(defaultConfig));
  }

  private saveConfig(config: StoreConfig): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  get<K extends keyof StoreConfig>(key: K): StoreConfig[K] {
    return this.config[key];
  }

  set<K extends keyof StoreConfig>(key: K, value: StoreConfig[K]): void {
    this.config[key] = value;
    this.saveConfig(this.config);
  }

  getAll(): StoreConfig {
    return this.config;
  }

  reset(): void {
    this.config = JSON.parse(JSON.stringify(defaultConfig));
    this.saveConfig(this.config);
  }
}

export const configStore = new ConfigStore();
export default configStore;
