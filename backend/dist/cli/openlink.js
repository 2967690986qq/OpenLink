#!/usr/bin/env node
import { processManager } from './process-manager.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve project root by finding nearest parent with package.json that has "openlink" in name
let PROJECT_ROOT = path.resolve(__dirname, '../..');
while (!fs.existsSync(path.join(PROJECT_ROOT, 'package.json')) && path.dirname(PROJECT_ROOT) !== PROJECT_ROOT) {
    PROJECT_ROOT = path.dirname(PROJECT_ROOT);
}
// If backend has its own package.json that doesn't reference workspaces, go up one more level
try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    if (!pkgJson.workspaces && fs.existsSync(path.join(PROJECT_ROOT, '../package.json'))) {
        const parentPkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, '../package.json'), 'utf-8'));
        if (parentPkg.workspaces) {
            PROJECT_ROOT = path.dirname(PROJECT_ROOT);
        }
    }
}
catch { }
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const PID_FILE = path.join(DATA_DIR, 'gateway.pid');
const LOG_FILE = path.join(DATA_DIR, 'gateway.log');
const GATEWAY_PORT = 3000;
const FRONTEND_PORT = 5173;
async function main() {
    const command = process.argv[2];
    const args = process.argv.slice(3);
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    switch (command) {
        case 'start':
        case 'up':
            await cmdStart(args);
            break;
        case 'stop':
        case 'down':
            await cmdStop();
            break;
        case 'restart':
            await cmdRestart(args);
            break;
        case 'status':
            await cmdStatus();
            break;
        case 'logs':
            await cmdLogs(args);
            break;
        case 'config':
            await cmdConfig(args);
            break;
        case 'install':
            await cmdInstall();
            break;
        case 'build':
            await cmdBuild();
            break;
        case 'dev':
            await cmdDev();
            break;
        case '--help':
        case '-h':
        case undefined:
            printHelp();
            break;
        default:
            console.log(`Unknown command: ${command}\n`);
            printHelp();
            process.exit(1);
    }
}
function printHelp() {
    const help = `
   ██████  ██████  ███████ ███    ██ ██      ██ ███    ██ ██   ██ 
  ██    ██ ██   ██ ██      ████   ██ ██      ██ ████   ██ ██  ██  
  ██    ██ ██████  █████   ██ ██  ██ ██      ██ ██ ██  ██ █████   
  ██    ██ ██      ██      ██  ██ ██ ██      ██ ██  ██ ██ ██  ██  
   ██████  ██      ███████ ██   ████ ███████ ██ ██   ████ ██   ██ 

  AI Gateway for connecting Dify knowledge bases with DingTalk & Feishu bots.

  Usage:
    openlink <command> [options]

  Commands:
    start, up [--daemon]    Start the gateway (use --daemon for background)
    stop, down              Stop the gateway
    restart                 Restart the gateway
    status                  Show gateway status
    logs [--tail] [--lines N]  Show gateway logs
    config <key> [value]    View or edit configuration
    install                 Install dependencies and build
    build                   Build frontend and backend
    dev                     Start in development mode with live reload
    -h, --help              Show this help

  Examples:
    openlink install        # First-time setup: install deps + build
    openlink start --daemon # Start gateway in background
    openlink status         # Check if running
    openlink logs --tail    # Live log streaming
    openlink stop           # Stop the gateway
    openlink restart        # Restart the gateway
`;
    console.log(help);
}
async function cmdStart(args) {
    const daemonMode = args.includes('--daemon') || args.includes('-d');
    if (processManager.isRunning(PID_FILE)) {
        const pid = processManager.readPid(PID_FILE);
        console.log(`OpenLink Gateway is already running (PID: ${pid})`);
        console.log(`  UI:   http://localhost:${FRONTEND_PORT}`);
        console.log(`  API:  http://localhost:${GATEWAY_PORT}/health`);
        return;
    }
    console.log('Starting OpenLink Gateway...');
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Check if backend is built
    const backendDist = path.join(PROJECT_ROOT, 'backend/dist/index.js');
    if (!fs.existsSync(backendDist)) {
        console.log('Backend not built yet. Building...');
        await cmdBuild();
    }
    if (daemonMode) {
        await processManager.spawnDaemon('node', [backendDist], PID_FILE, LOG_FILE, { cwd: PROJECT_ROOT, env: { ...process.env, NODE_ENV: 'production' } });
        await processManager.waitForPort(GATEWAY_PORT, 15000);
        console.log('\n  OpenLink Gateway started!');
        console.log(`  PID: ${processManager.readPid(PID_FILE)}`);
        console.log(`  Logs: ${LOG_FILE}`);
        console.log(`  UI:   http://localhost:${FRONTEND_PORT}`);
        console.log(`  API:  http://localhost:${GATEWAY_PORT}/health`);
        console.log('\n  Use "openlink stop" to stop.');
    }
    else {
        console.log('\n  OpenLink Gateway starting in foreground...');
        console.log(`  UI:   http://localhost:${FRONTEND_PORT}`);
        console.log(`  API:  http://localhost:${GATEWAY_PORT}/health`);
        console.log('  Press Ctrl+C to stop.\n');
        process.env.NODE_ENV = 'production';
        const { spawn } = await import('child_process');
        const child = spawn('node', [backendDist], {
            cwd: PROJECT_ROOT,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
        });
        child.on('exit', (code) => {
            processManager.cleanupPid(PID_FILE);
            console.log(`Gateway exited with code ${code}`);
            process.exit(code || 0);
        });
        process.on('SIGINT', () => {
            console.log('\nStopping gateway...');
            child.kill('SIGTERM');
        });
    }
}
async function cmdStop() {
    const pid = processManager.readPid(PID_FILE);
    if (!pid) {
        console.log('OpenLink Gateway is not running.');
        return;
    }
    console.log(`Stopping OpenLink Gateway (PID: ${pid})...`);
    const killed = processManager.killProcess(pid);
    if (killed) {
        processManager.cleanupPid(PID_FILE);
        // Also kill any remaining processes on the ports
        processManager.killByPort(GATEWAY_PORT);
        processManager.killByPort(FRONTEND_PORT);
        console.log('Gateway stopped.');
    }
    else {
        console.log('Process not found (stale PID file). Cleaning up.');
        processManager.cleanupPid(PID_FILE);
        processManager.killByPort(GATEWAY_PORT);
        processManager.killByPort(FRONTEND_PORT);
    }
}
async function cmdRestart(args) {
    console.log('Restarting OpenLink Gateway...');
    await cmdStop();
    await new Promise(r => setTimeout(r, 2000));
    await cmdStart(args);
}
async function cmdStatus() {
    const pid = processManager.readPid(PID_FILE);
    const running = processManager.isRunning(PID_FILE);
    const portOpen = processManager.isPortOpen(GATEWAY_PORT);
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│            OpenLink Gateway Status                      │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│  Status      : ${running ? '\u001b[32m● RUNNING\u001b[0m' : '\u001b[31m○ STOPPED\u001b[0m'}`);
    console.log(`│  PID         : ${pid || 'N/A'}`);
    console.log(`│  Port (API)  : ${GATEWAY_PORT} ${portOpen ? '(\u001b[32mopen\u001b[0m)' : '(\u001b[31mclosed\u001b[0m)'}`);
    console.log(`│  Port (UI)   : ${FRONTEND_PORT}`);
    console.log(`│  Project Root: ${PROJECT_ROOT}`);
    console.log(`│  Config Dir  : ${DATA_DIR}`);
    console.log(`│  Log File    : ${LOG_FILE}`);
    console.log('└─────────────────────────────────────────────────────────┘');
    if (running) {
        console.log('\n  Access URLs:');
        console.log(`    Web UI : http://localhost:${FRONTEND_PORT}`);
        console.log(`    API    : http://localhost:${GATEWAY_PORT}/health`);
    }
    else {
        console.log('\n  Start the gateway with: \u001b[1mopenlink start --daemon\u001b[0m');
    }
}
async function cmdLogs(args) {
    const tail = args.includes('--tail') || args.includes('-f');
    const linesIdx = args.indexOf('--lines');
    const lines = linesIdx >= 0 ? parseInt(args[linesIdx + 1]) : 50;
    if (!fs.existsSync(LOG_FILE)) {
        console.log('No log file found. Start the gateway first with: openlink start');
        return;
    }
    if (tail) {
        console.log(`Tailing logs (Ctrl+C to exit)...\n`);
        const { spawn } = await import('child_process');
        const child = spawn('tail', ['-f', '-n', String(lines), LOG_FILE], { stdio: 'inherit' });
        process.on('SIGINT', () => child.kill());
    }
    else {
        const content = fs.readFileSync(LOG_FILE, 'utf-8');
        const linesArr = content.trim().split('\n').slice(-lines);
        console.log(linesArr.join('\n'));
        if (linesArr.length >= lines) {
            console.log(`\n... (showing last ${lines} lines)`);
        }
    }
}
async function cmdConfig(args) {
    const configFile = path.join(DATA_DIR, 'config.json');
    if (args.length === 0) {
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            console.log(JSON.stringify(config, null, 2));
        }
        else {
            console.log('No configuration file yet. Start the gateway to create one.');
        }
        return;
    }
    const key = args[0];
    const value = args[1];
    if (value === undefined) {
        console.log(`Usage: openlink config <key> <value>`);
        return;
    }
    let config = {};
    if (fs.existsSync(configFile)) {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
    // Support dot notation, e.g. gateway.port
    const keys = key.split('.');
    let obj = config;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]])
            obj[keys[i]] = {};
        obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = isNaN(Number(value)) ? value : Number(value);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log(`Updated: ${key} = ${value}`);
    console.log(`\nNote: Restart the gateway for changes to take effect.`);
}
async function cmdInstall() {
    console.log('Installing OpenLink Gateway dependencies...\n');
    const { execSync } = await import('child_process');
    try {
        console.log('[1/3] Installing dependencies...');
        execSync('npm install', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        console.log('\n[2/3] Building backend...');
        execSync('npm run build -w backend', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        console.log('\n[3/3] Building frontend...');
        execSync('npm run build -w frontend', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        console.log('\n  Installation complete!');
        console.log('  Start the gateway with: \u001b[1mopenlink start --daemon\u001b[0m');
        console.log('  Or run in dev mode with: \u001b[1mopenlink dev\u001b[0m');
    }
    catch (error) {
        console.error('Installation failed:', error.message);
        process.exit(1);
    }
}
async function cmdBuild() {
    console.log('Building OpenLink Gateway...\n');
    const { execSync } = await import('child_process');
    try {
        console.log('[1/2] Building backend...');
        execSync('npm run build -w backend', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        console.log('\n[2/2] Building frontend...');
        execSync('npm run build -w frontend', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        console.log('\n  Build complete!');
    }
    catch (error) {
        console.error('Build failed:', error.message);
        process.exit(1);
    }
}
async function cmdDev() {
    console.log('Starting OpenLink Gateway in development mode...');
    console.log(`  Backend:  http://localhost:${GATEWAY_PORT}`);
    console.log(`  Frontend: http://localhost:${FRONTEND_PORT}`);
    console.log('  Press Ctrl+C to stop.\n');
    const { spawn } = await import('child_process');
    const backend = spawn('npm', ['run', 'dev:backend'], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const frontend = spawn('npm', ['run', 'dev:frontend'], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const prefix = (name, color) => (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
            console.log(`  ${color}[${name}]\u001b[0m ${line}`);
        }
    };
    backend.stdout.on('data', prefix('BACKEND', '\u001b[36m'));
    backend.stderr.on('data', prefix('BACKEND', '\u001b[33m'));
    frontend.stdout.on('data', prefix('FRONTEND', '\u001b[35m'));
    frontend.stderr.on('data', prefix('FRONTEND', '\u001b[33m'));
    const cleanup = () => {
        console.log('\n  Stopping services...');
        backend.kill('SIGTERM');
        frontend.kill('SIGTERM');
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    backend.on('exit', (code) => {
        if (code !== 0 && code !== null)
            console.log(`Backend exited with code ${code}`);
    });
    frontend.on('exit', (code) => {
        if (code !== 0 && code !== null)
            console.log(`Frontend exited with code ${code}`);
    });
}
main().catch((err) => {
    console.error('\u001b[31mFatal error:\u001b[0m', err.message);
    process.exit(1);
});
