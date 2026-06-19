import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { configStore } from './config/store.js';
import logger from './utils/logger.js';
import difyRoutes from './routes/dify.js';
import channelRoutes from './routes/channels.js';
import configRoutes from './routes/config.js';
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
    res.json({
        service: 'OpenLink Gateway',
        endpoints: {
            api: '/api',
            dify: '/api/dify',
            channels: '/api/channels',
            config: '/api/config',
            health: '/health'
        },
        web_ui: `http://localhost:${PORT}/ui/`
    });
});
app.use('/api/dify', difyRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/config', configRoutes);
if (fs.existsSync(FRONTEND_DIST)) {
    // Serve static assets (JS/CSS) from root /assets so HTML references work
    app.use('/assets', express.static(path.join(FRONTEND_DIST, 'assets'), {
        maxAge: '1y',
        immutable: true
    }));
    // Serve index.html for SPA routing under /ui
    app.use('/ui', express.static(FRONTEND_DIST, {
        index: 'index.html'
    }));
    // All /ui/* paths serve index.html for SPA
    app.use('/ui/*', (_req, res) => {
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
    // Also serve root index.html (for /)
    app.use('/', express.static(FRONTEND_DIST, { index: 'index.html' }));
    logger.info(`Frontend UI served at /ui/`);
}
else {
    logger.warn('Frontend not built. Run `openlink build` or `npm run build` to build the UI.');
    app.use('/ui/*', (_req, res) => {
        res.status(404).json({
            success: false,
            error: 'Frontend not built',
            message: 'Run `openlink build` to build the frontend UI.'
        });
    });
}
app.use((err, _req, res, _next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: err.message });
});
app.listen(PORT, HOST, () => {
    logger.info('══════════════════════════════════════════════════════════');
    logger.info('    OpenLink Gateway is running!');
    logger.info(`    API Base   : http://${HOST}:${PORT}`);
    logger.info(`    Health     : http://${HOST}:${PORT}/health`);
    logger.info(`    Web UI     : http://${HOST}:${PORT}/ui/`);
    logger.info(`    Data Dir   : ${path.join(PROJECT_ROOT, 'data')}`);
    logger.info('══════════════════════════════════════════════════════════');
});
export default app;
