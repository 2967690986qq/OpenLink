import { Router } from 'express';
import { configStore } from '../config/store.js';
const router = Router();
// Get gateway config
router.get('/', (_req, res) => {
    const config = configStore.get('gateway');
    res.json({ success: true, data: config });
});
// Update gateway config
router.put('/', (req, res) => {
    try {
        const config = req.body;
        const currentConfig = configStore.get('gateway');
        const updatedConfig = { ...currentConfig, ...config };
        configStore.set('gateway', updatedConfig);
        res.json({ success: true, data: updatedConfig });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get all config (for backup/export)
router.get('/all', (_req, res) => {
    const config = configStore.getAll();
    res.json({ success: true, data: config });
});
// Reset config to defaults
router.post('/reset', (_req, res) => {
    configStore.reset();
    res.json({ success: true, message: 'Config reset to defaults' });
});
export default router;
