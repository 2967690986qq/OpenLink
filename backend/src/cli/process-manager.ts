import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import net from 'net';

export interface ProcessManagerOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

class ProcessManager {
  readPid(pidFile: string): number | null {
    try {
      if (!fs.existsSync(pidFile)) return null;
      const content = fs.readFileSync(pidFile, 'utf-8').trim();
      const pid = parseInt(content);
      if (isNaN(pid) || pid <= 0) return null;
      return pid;
    } catch {
      return null;
    }
  }

  writePid(pidFile: string, pid: number): void {
    const dir = path.dirname(pidFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(pidFile, String(pid));
  }

  cleanupPid(pidFile: string): void {
    try {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    } catch {
      // ignore
    }
  }

  isRunning(pidFile: string): boolean {
    const pid = this.readPid(pidFile);
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  killProcess(pid: number): boolean {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        return true;
      }
      try {
        process.kill(pid, 'SIGTERM');
        for (let i = 0; i < 50; i++) {
          try {
            process.kill(pid, 0);
          } catch {
            return true;
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
        try {
          process.kill(pid, 'SIGKILL');
        } catch {}
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  killByPort(port: number): void {
    try {
      const { execSync } = require('child_process');
      let pids: number[] = [];

      if (process.platform === 'win32') {
        try {
          const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
          const lines = result.trim().split('\n');
          for (const line of lines) {
            const match = line.trim().match(/(\d+)$/);
            if (match && match[1]) {
              const pid = parseInt(match[1]);
              if (!isNaN(pid) && !pids.includes(pid)) pids.push(pid);
            }
          }
        } catch {}
      } else {
        try {
          const result = execSync(`lsof -t -i:${port}`, { encoding: 'utf-8' });
          pids = result.trim().split('\n').map((p: string) => parseInt(p)).filter((p: number) => !isNaN(p));
        } catch {
          try {
            const result = execSync(`ss -tlnp 2>/dev/null | grep :${port}`, { encoding: 'utf-8' });
            const match = result.match(/users:\(\(".*",pid=(\d+)/);
            if (match && match[1]) pids.push(parseInt(match[1]));
          } catch {}
        }
      }

      for (const pid of pids) {
        if (pid !== process.pid) {
          try {
            if (process.platform === 'win32') {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } else {
              process.kill(pid, 'SIGTERM');
            }
          } catch {}
        }
      }
    } catch {
      // ignore
    }
  }

  isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const socket = net.connect({ port, host: '127.0.0.1', timeout: 2000 });
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  async waitForPort(port: number, timeoutMs: number = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const open = await new Promise<boolean>((resolve) => {
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
        if (open) return true;
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  spawnDaemon(
    command: string,
    args: string[],
    pidFile: string,
    logFile: string,
    options: ProcessManagerOptions
  ): Promise<void> {
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
        this.writePid(pidFile, child.pid!);
        child.unref();
        resolve();
      });
    });
  }
}

export const processManager = new ProcessManager();
export default processManager;
