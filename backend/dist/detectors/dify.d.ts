import { DetectedService } from '../types/index.js';
export declare class DifyDetector {
    detectLocalServices(): Promise<DetectedService[]>;
    private isDifyService;
    private extractVersion;
    checkServiceHealth(baseUrl: string): Promise<boolean>;
}
export declare const difyDetector: DifyDetector;
