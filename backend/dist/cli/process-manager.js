import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';
class ProcessManager {
    readPid(pidFile) {
        try {
            if (!fs.existsSync(pidFile))
                return null;
            const content = fs.readFileSync(pidFile, 'utf-8').trim();
            const pid = parseInt(content);
            if (isNaN(pid) || pid <= 0)
                return null;
            return pid;
        }
        catch {
            return null;
        }
    }
    writePid(pidFile, pid) {
        const dir = path.dirname(pidFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(pidFile, String(pid));
    }
    cleanupPid(pidFile) {
        try {
            if (fs.existsSync(pidFile)) {
                fs.unlinkSync(pidFile);
            }
        }
        catch {
            // ignore
        }
    }
    isRunning(pidFile) {
        const pid = this.readPid(pidFile);
        if (!pid)
            return false;
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    killProcess(pid) {
        try {
            // First try graceful termination
            process.kill(pid, 'SIGTERM');
            // Wait up to 5 seconds for graceful shutdown
            for (let i = 0; i < 50; i++) {
                try {
                    process.kill(pid, 0);
                }
                catch {
                    return true;
                }
                const wait = new Promise(r => setTimeout(r, 100));
                wait.then(() => { });
                // Simple busy wait fallback
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
            }
            // Force kill
            try {
                process.kill(pid, 'SIGKILL');
            }
            catch { }
            return true;
        }
        catch {
            return false;
        }
    }
    killByPort(port) {
        try {
            // Use lsof or ss to find processes using the port
            const { execSync } = require('child_process');
            let pids = [];
            if (process.platform === 'darwin' || process.platform === 'linux') {
                try {
                    const result = execSync(`lsof -t -i:${port}`, { encoding: 'utf-8' });
                    pids = result.trim().split('\n').map((p) => parseInt(p)).filter((p) => !isNaN(p));
                }
                catch {
                    try {
                        const result = execSync(`ss -tlnp 2>/dev/null | grep :${port}`, { encoding: 'utf-8' });
                        const match = result.match(/users:\(\(".*",pid=(\d+)/);
                        if (match && match[1])
                            pids.push(parseInt(match[1]));
                    }
                    catch { }
                }
            }
            for (const pid of pids) {
                if (pid !== process.pid) {
                    try {
                        process.kill(pid, 'SIGTERM');
                    }
                    catch { }
                }
            }
        }
        catch {
            // ignore
        }
    }
    isPortOpen(port) {
        try {
            const socket = net.connect({ port, host: '127.0.0.1', timeout: 2000 });
            return new Promise((resolve) => {
                socket.on('connect', () => {
                    socket.destroy();
                    resolve(true);
                });
                socket.on('error', () => resolve(false));
                socket.on('timeout', () => {
                    socket.destroy();
                    resolve(false);
                });
            });
        }
        catch {
            return false;
        }
    }
    async waitForPort(port, timeoutMs = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const open = await new Promise((resolve) => {
                    const socket = net.connect({ port, host: '127.0.0.1', timeout: 1500 });
                    socket.on('connect', () => {
                        socket.destroy();
                        resolve(true);
                    });
                    socket.on('error', () => resolve(false));
                    socket.on('timeout', () => {
                        socket.destroy();
                        resolve(false);
                    });
                });
                if (open)
                    return true;
            }
            catch { }
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }
    spawnDaemon(command, args, pidFile, logFile, options) {
        return new Promise((resolve, reject) => {
            const logDir = path.dirname(logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
            const child = spawn(command, args, {
                cwd: options.cwd,
                env: options.env,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true
            });
            child.stdout.pipe(logStream);
            child.stderr.pipe(logStream);
            child.on('error', (err) => {
                reject(new Error(`Failed to start ${command}: ${err.message}`));
            });
            child.on('spawn', () => {
                this.writePid(pidFile, child.pid);
                child.unref();
                resolve();
            });
        });
    }
}
export const processManager = new ProcessManager();
export default processManager;
