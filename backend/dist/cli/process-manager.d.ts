export interface ProcessManagerOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}
declare class ProcessManager {
    readPid(pidFile: string): number | null;
    writePid(pidFile: string, pid: number): void;
    cleanupPid(pidFile: string): void;
    isRunning(pidFile: string): boolean;
    killProcess(pid: number): boolean;
    killByPort(port: number): void;
    isPortOpen(port: number): boolean;
    waitForPort(port: number, timeoutMs?: number): Promise<boolean>;
    spawnDaemon(command: string, args: string[], pidFile: string, logFile: string, options: ProcessManagerOptions): Promise<void>;
}
export declare const processManager: ProcessManager;
export default processManager;
