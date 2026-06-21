import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { configStore } from './config/store.js';
import logger from './utils/logger.js';
import knowledgeBaseRoutes from './routes/knowledge-base.js';
import channelRoutes from './routes/channels.js';
import configRoutes from './routes/config.js';
import webhookRoutes from './routes/webhook.js';
import { authMiddleware } from './utils/auth.js';
import { feishuService } from './services/feishu/index.js';
import * as dingtalkService from './services/dingtalk/index.js';
import * as weixinService from './services/weixin.js';
import type { ChannelConfig, FeishuConfig, DingTalkConfig, WeixinConfig } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FRONTEND_DIST = path.join(PROJECT_ROOT, 'frontend/dist');

const app = express();
const config = configStore.get('gateway');
const PORT = parseInt(process.env.OPENLINK_PORT || String(config.port));
const HOST = process.env.OPENLINK_HOST || config.host;

app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(express.json());

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { query: req.query, body: req.body });
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'OpenLink Gateway',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (_req, res) => {
  res.redirect('/ui/');
});

app.use('/api/knowledge-base', authMiddleware, knowledgeBaseRoutes);
app.use('/api/dify', authMiddleware, knowledgeBaseRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/config', authMiddleware, configRoutes);

app.use('/api/webhook', webhookRoutes);

if (fs.existsSync(FRONTEND_DIST)) {
  app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), {
    maxAge: '1y',
    immutable: true
  }));

  app.use('/ui', express.static(FRONTEND_DIST, {
    index: 'index.html'
  }));

  // SPA catch-all: serve index.html for all frontend routes not matched above
  app.use((req, res) => {
    if (req.method === 'GET') {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    } else {
      res.status(404).json({ success: false, error: 'Not found' });
    }
  });

  logger.info(`Frontend UI served`);
} else {
  logger.warn('Frontend not built. Run `npm run build` to build the UI.');
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Frontend not built',
      message: 'Run `npm run build` to build the frontend UI.'
    });
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, HOST, async () => {
  logger.info('══════════════════════════════════════════════════════════');
  logger.info('    OpenLink Gateway is running!');
  logger.info(`    API Base   : http://${HOST}:${PORT}`);
  logger.info(`    Health     : http://${HOST}:${PORT}/health`);
  logger.info(`    Web UI     : http://${HOST}:${PORT}/ui/`);
  logger.info(`    Data Dir   : ${path.join(PROJECT_ROOT, 'data')}`);
  logger.info('══════════════════════════════════════════════════════════');

  // 启动时初始化所有已启用的频道
  await initializeChannels();

  // 优雅退出：停止所有频道连接
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await feishuService.stopAllChannels();
    await dingtalkService.stopAllChannels();
    weixinService.stopAllChannels();
    weixinService.stopAllQrSessions();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});

async function initializeChannels() {
  const channels = configStore.get('channels') as ChannelConfig[];
  const enabledChannels = channels.filter(c => c.enabled);

  let feishuCount = 0;
  let dingtalkCount = 0;
  let weixinCount = 0;

  for (const channel of enabledChannels) {
    try {
      if (channel.platform === 'feishu') {
        await feishuService.startChannel(channel.id, (channel.config as FeishuConfig));
        feishuCount++;
      } else if (channel.platform === 'dingtalk') {
        await dingtalkService.startChannel(channel.id, (channel.config as DingTalkConfig));
        dingtalkCount++;
      } else if (channel.platform === 'weixin') {
        weixinService.startChannel(channel.id, (channel.config as WeixinConfig));
        weixinCount++;
      }
    } catch (err: any) {
      logger.error(`Failed to initialize channel ${channel.name} (${channel.platform})`, { error: err.message });
    }
  }

  logger.info(`Initialized ${enabledChannels.length} channel(s) (feishu=${feishuCount}, dingtalk=${dingtalkCount}, weixin=${weixinCount})`);
}

export default app;
