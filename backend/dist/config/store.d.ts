import { GatewayConfig, DifyConfig, ChannelConfig } from '../types/index.js';
export interface StoreConfig {
    gateway: GatewayConfig;
    difyInstances: DifyConfig[];
    channels: ChannelConfig[];
}
declare class ConfigStore {
    private config;
    constructor();
    private loadConfig;
    private saveConfig;
    get<K extends keyof StoreConfig>(key: K): StoreConfig[K];
    set<K extends keyof StoreConfig>(key: K, value: StoreConfig[K]): void;
    getAll(): StoreConfig;
    reset(): void;
}
export declare const configStore: ConfigStore;
export default configStore;
