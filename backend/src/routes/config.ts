import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { configStore } from '../config/store.js';
import { GatewayConfig, ApiResponse } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

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

// Reset config to defaults — requires explicit confirmation to prevent accidental/malicious resets
router.post('/reset', (req: Request, res: Response) => {
  const { confirm } = req.body;

  if (!confirm) {
    res.status(400).json({
      success: false,
      error: 'Config reset requires confirmation. Send { "confirm": true } in request body.'
    } as ApiResponse);
    return;
  }

  configStore.reset();
  res.json({ success: true, message: 'Config reset to defaults' } as ApiResponse);
});

// Restart gateway — save config, fork restart, exit current process
router.post('/restart', (req: Request, res: Response) => {
  try {
    // Save any pending config changes from request body
    if (req.body && Object.keys(req.body).length > 0) {
      const currentConfig = configStore.get('gateway');
      configStore.set('gateway', { ...currentConfig, ...req.body });
    }

    const dataDir = path.join(PROJECT_ROOT, 'data');
    const pidFile = path.join(dataDir, 'gateway.pid');

    // Try to find the CLI entry point (works whether started via tsx or compiled node)
    const cliPath = path.join(PROJECT_ROOT, 'backend', 'src', 'cli', 'openlink.ts');
    const cliDistPath = path.join(PROJECT_ROOT, 'backend', 'dist', 'cli', 'openlink.js');

    let entryPoint: string;
    if (process.argv[0]?.includes('tsx') || process.argv[1]?.endsWith('.ts')) {
      entryPoint = cliPath;
    } else {
      entryPoint = cliDistPath;
    }

    const useNode = !entryPoint.endsWith('.ts');

    const child = spawn(
      useNode ? 'node' : 'npx',
      useNode ? [entryPoint, 'start', '--daemon'] : ['tsx', entryPoint, 'start', '--daemon'],
      {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
      }
    );

    child.unref();

    res.json({
      success: true,
      message: '服务正在重启，新进程已启动'
    } as ApiResponse);

    // Give the new process a moment to start before exiting
    setTimeout(() => process.exit(0), 1000);
  } catch (error: any) {
    res.status(500).json({ success: false, error: `重启失败: ${error.message}` } as ApiResponse);
  }
});

export default router;
