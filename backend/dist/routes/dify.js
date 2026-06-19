import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { difyService } from '../services/dify.js';
import { difyDetector } from '../detectors/dify.js';
import { configStore } from '../config/store.js';
import logger from '../utils/logger.js';
const router = Router();
// Get all Dify instances
router.get('/', (_req, res) => {
    const instances = configStore.get('difyInstances');
    res.json({ success: true, data: instances });
});
// Detect local Dify services
router.get('/detect', async (_req, res) => {
    try {
        const services = await difyDetector.detectLocalServices();
        res.json({ success: true, data: services });
    }
    catch (error) {
        logger.error('Dify detection failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Add a new Dify instance
router.post('/', (req, res) => {
    try {
        const { name, baseUrl, apiKey } = req.body;
        if (!name || !baseUrl || !apiKey) {
            res.status(400).json({ success: false, error: 'Missing required fields' });
            return;
        }
        const instance = {
            id: uuidv4(),
            name,
            baseUrl: baseUrl.replace(/\/$/, ''),
            apiKey,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const instances = configStore.get('difyInstances');
        instances.push(instance);
        configStore.set('difyInstances', instances);
        logger.info('Dify instance added', { id: instance.id, name });
        res.json({ success: true, data: instance });
    }
    catch (error) {
        logger.error('Failed to add Dify instance', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Update a Dify instance
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, baseUrl, apiKey, enabled } = req.body;
        const instances = configStore.get('difyInstances');
        const index = instances.findIndex(i => i.id === id);
        if (index === -1) {
            res.status(404).json({ success: false, error: 'Instance not found' });
            return;
        }
        instances[index] = {
            ...instances[index],
            name: name || instances[index].name,
            baseUrl: baseUrl ? baseUrl.replace(/\/$/, '') : instances[index].baseUrl,
            apiKey: apiKey || instances[index].apiKey,
            enabled: enabled !== undefined ? enabled : instances[index].enabled,
            updatedAt: new Date().toISOString()
        };
        configStore.set('difyInstances', instances);
        logger.info('Dify instance updated', { id });
        res.json({ success: true, data: instances[index] });
    }
    catch (error) {
        logger.error('Failed to update Dify instance', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Delete a Dify instance
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const instances = configStore.get('difyInstances');
        const filtered = instances.filter(i => i.id !== id);
        if (filtered.length === instances.length) {
            res.status(404).json({ success: false, error: 'Instance not found' });
            return;
        }
        configStore.set('difyInstances', filtered);
        logger.info('Dify instance deleted', { id });
        res.json({ success: true, message: 'Instance deleted' });
    }
    catch (error) {
        logger.error('Failed to delete Dify instance', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Test connection to a Dify instance
router.post('/:id/test', async (req, res) => {
    try {
        const { id } = req.params;
        const instances = configStore.get('difyInstances');
        const instance = instances.find(i => i.id === id);
        if (!instance) {
            res.status(404).json({ success: false, error: 'Instance not found' });
            return;
        }
        const result = await difyService.testConnection(instance);
        res.json({ success: result.success, message: result.message });
    }
    catch (error) {
        logger.error('Dify connection test failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get apps from a Dify instance
router.get('/:id/apps', async (req, res) => {
    try {
        const { id } = req.params;
        const instances = configStore.get('difyInstances');
        const instance = instances.find(i => i.id === id);
        if (!instance) {
            res.status(404).json({ success: false, error: 'Instance not found' });
            return;
        }
        const apps = await difyService.listApps(instance);
        res.json({ success: true, data: apps });
    }
    catch (error) {
        logger.error('Failed to list Dify apps', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// Send chat message to a Dify app
router.post('/:id/chat', async (req, res) => {
    try {
        const { id } = req.params;
        const { appId, message, conversationId, userId } = req.body;
        const instances = configStore.get('difyInstances');
        const instance = instances.find(i => i.id === id);
        if (!instance) {
            res.status(404).json({ success: false, error: 'Instance not found' });
            return;
        }
        const response = await difyService.chat(instance, {
            appId,
            message,
            conversationId,
            userId
        });
        res.json({ success: true, data: response });
    }
    catch (error) {
        logger.error('Dify chat failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;
