import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GatewayConfig, DifyConfig, ChannelConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface StoreConfig {
  gateway: GatewayConfig;
  difyInstances: DifyConfig[];
  channels: ChannelConfig[];
}

const defaultConfig: StoreConfig = {
  gateway: {
    port: 3000,
    host: '0.0.0.0',
    corsOrigins: ['http://localhost:5173', 'http://localhost:3001'],
    logLevel: 'info'
  },
  difyInstances: [],
  channels: []
};

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
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return { ...defaultConfig, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
    this.saveConfig(defaultConfig);
    return defaultConfig;
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
    this.config = defaultConfig;
    this.saveConfig(this.config);
  }
}

export const configStore = new ConfigStore();
export default configStore;
