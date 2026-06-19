import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dingTalkService } from '../services/dingtalk.js';
import { feishuService } from '../services/feishu.js';
import { configStore } from '../config/store.js';
import logger from '../utils/logger.js';
const router = Router();
// Get all channels
router.get('/', (_req, res) => {
    const channels = configStore.get('channels');
    res.json({ success: true, data: channels });
});
// Add a new channel
router.post('/', (req, res) => {
    try {
        const { platform, name, config } = req.body;
        if (!platform || !name || !config) {
            res.status(400).json({ success: false, error: 'Missing required fields' });
            return;
        }
        if (!['dingtalk', 'feishu', 'wechat', 'wecom'].includes(platform)) {
            res.status(400).json({ success: false, error: 'Invalid platform' });
            return;
        }
        const channel = {
            id: uuidv4(),
            platform,
            name,
            enabled: true,
            config,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const channels = configStore.get('channels');
        channels.push(channel);
        configStore.set('channels', channels);
        logger.info('Channel added', { id: channel.id, platform, name });
        res.json({ success: true, data: channel });
    }
    catch (error) {
        logger.error('Failed to add channel', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update a channel
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, enabled, config } = req.body;
        const channels = configStore.get('channels');
        const index = channels.findIndex(c => c.id === id);
        if (index === -1) {
            res.status(404).json({ success: false, error: 'Channel not found' });
            return;
        }
        channels[index] = {
            ...channels[index],
            name: name || channels[index].name,
            enabled: enabled !== undefined ? enabled : channels[index].enabled,
            config: config || channels[index].config,
            updatedAt: new Date().toISOString()
        };
        configStore.set('channels', channels);
        logger.info('Channel updated', { id });
        res.json({ success: true, data: channels[index] });
    }
    catch (error) {
        logger.error('Failed to update channel', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Delete a channel
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const channels = configStore.get('channels');
        const filtered = channels.filter(c => c.id !== id);
        if (filtered.length === channels.length) {
            res.status(404).json({ success: false, error: 'Channel not found' });
            return;
        }
        configStore.set('channels', filtered);
        logger.info('Channel deleted', { id });
        res.json({ success: true, message: 'Channel deleted' });
    }
    catch (error) {
        logger.error('Failed to delete channel', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Test channel connection
router.post('/:id/test', async (req, res) => {
    try {
        const { id } = req.params;
        const channels = configStore.get('channels');
        const channel = channels.find(c => c.id === id);
        if (!channel) {
            res.status(404).json({ success: false, error: 'Channel not found' });
            return;
        }
        if (channel.platform === 'dingtalk') {
            const config = channel.config;
            await dingTalkService.getAccessToken(config);
            res.json({ success: true, message: 'DingTalk connection successful' });
        }
        else if (channel.platform === 'feishu') {
            const config = channel.config;
            await feishuService.getTenantAccessToken(config);
            res.json({ success: true, message: 'Feishu connection successful' });
        }
        else {
            res.status(400).json({ success: false, error: 'Unsupported platform' });
        }
    }
    catch (error) {
        logger.error('Channel test failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get bot info for a channel
router.get('/:id/bot', async (req, res) => {
    try {
        const { id } = req.params;
        const channels = configStore.get('channels');
        const channel = channels.find(c => c.id === id);
        if (!channel) {
            res.status(404).json({ success: false, error: 'Channel not found' });
            return;
        }
        if (channel.platform === 'dingtalk') {
            const config = channel.config;
            const token = await dingTalkService.getAccessToken(config);
            res.json({ success: true, data: { platform: 'dingtalk', token } });
        }
        else if (channel.platform === 'feishu') {
            const config = channel.config;
            const botInfo = await feishuService.getBotInfo(config);
            res.json({ success: true, data: { platform: 'feishu', ...botInfo } });
        }
        else {
            res.status(400).json({ success: false, error: 'Unsupported platform' });
        }
    }
    catch (error) {
        logger.error('Failed to get bot info', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;
