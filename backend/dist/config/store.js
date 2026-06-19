import fs from 'fs';
import path from 'path';
const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const defaultConfig = {
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
    config;
    constructor() {
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (!fs.existsSync(CONFIG_DIR)) {
                fs.mkdirSync(CONFIG_DIR, { recursive: true });
            }
            if (fs.existsSync(CONFIG_FILE)) {
                const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
                return { ...defaultConfig, ...JSON.parse(data) };
            }
        }
        catch (error) {
            console.error('Failed to load config:', error);
        }
        this.saveConfig(defaultConfig);
        return defaultConfig;
    }
    saveConfig(config) {
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Failed to save config:', error);
        }
    }
    get(key) {
        return this.config[key];
    }
    set(key, value) {
        this.config[key] = value;
        this.saveConfig(this.config);
    }
    getAll() {
        return this.config;
    }
    reset() {
        this.config = defaultConfig;
        this.saveConfig(this.config);
    }
}
export const configStore = new ConfigStore();
export default configStore;
