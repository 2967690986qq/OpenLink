import express from 'express';
import cors from 'cors';
import { configStore } from './config/store.js';
import logger from './utils/logger.js';
import difyRoutes from './routes/dify.js';
import channelRoutes from './routes/channels.js';
import configRoutes from './routes/config.js';

const app = express();
const config = configStore.get('gateway');

// Middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { query: req.query, body: req.body });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/dify', difyRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/config', configRoutes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: err.message });
});

// Start server
app.listen(config.port, config.host, () => {
  logger.info(`OpenLink Gateway started on ${config.host}:${config.port}`);
  logger.info(`Health check: http://${config.host}:${config.port}/health`);
  logger.info(`API docs: http://${config.host}:${config.port}/api/dify`);
});

export default app;
