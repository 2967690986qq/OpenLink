import { Router, Request, Response } from 'express';
import { configStore } from '../config/store.js';
import { GatewayConfig, ApiResponse } from '../types/index.js';

const router = Router();

// Get gateway config
router.get('/', (_req: Request, res: Response) => {
  const config = configStore.get('gateway');
  res.json({ success: true, data: config } as ApiResponse<GatewayConfig>);
});

// Update gateway config
router.put('/', (req: Request, res: Response) => {
  try {
    const config = req.body as Partial<GatewayConfig>;

    const currentConfig = configStore.get('gateway');
    const updatedConfig = { ...currentConfig, ...config };

    configStore.set('gateway', updatedConfig);
    res.json({ success: true, data: updatedConfig } as ApiResponse<GatewayConfig>);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

// Get all config (for backup/export)
router.get('/all', (_req: Request, res: Response) => {
  const config = configStore.getAll();
  res.json({ success: true, data: config } as ApiResponse);
});

// Reset config to defaults
router.post('/reset', (_req: Request, res: Response) => {
  configStore.reset();
  res.json({ success: true, message: 'Config reset to defaults' } as ApiResponse);
});

export default router;
