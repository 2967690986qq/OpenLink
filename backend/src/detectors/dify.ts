import axios from 'axios';
import { DetectedService } from '../types/index.js';
import logger from '../utils/logger.js';

const COMMON_DIFY_PORTS = [80, 443, 8080, 3000, 5000, 8000, 9000];
const COMMON_DIFY_PATHS = ['/', '/api/info', '/console/api/active-works'];
const SCAN_TIMEOUT_MS = 2000;

export class DifyDetector {
  async detectLocalServices(): Promise<DetectedService[]> {
    const hosts = [
      'localhost',
      '127.0.0.1',
      'host.docker.internal'
    ];

    logger.info('Starting local Dify service detection (concurrent scan)...');

    // Build all scan targets upfront
    const scanTargets: { host: string; port: number; path: string; url: string }[] = [];
    for (const host of hosts) {
      for (const port of COMMON_DIFY_PORTS) {
        for (const path of COMMON_DIFY_PATHS) {
          scanTargets.push({
            host,
            port,
            path,
            url: `http://${host}:${port}${path}`
          });
        }
      }
    }

    // Scan all targets concurrently — worst case is now ~2s (single timeout)
    // instead of ~126s (serial sum of all timeouts)
    const results = await Promise.allSettled(
      scanTargets.map(async (target) => {
        const response = await axios.get(target.url, {
          timeout: SCAN_TIMEOUT_MS,
          validateStatus: () => true
        });

        if (this.isDifyService(response.headers, response.data)) {
          return {
            name: `Dify (${target.host}:${target.port})`,
            type: 'dify',
            url: `http://${target.host}:${target.port}`,
            port: target.port,
            status: 'running',
            version: this.extractVersion(response.data)
          } as DetectedService;
        }
        return null;
      })
    );

    // Collect successful detections, deduplicate by URL
    const services: DetectedService[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        const service = result.value;
        const exists = services.some(s => s.url === service.url);
        if (!exists) {
          services.push(service);
          logger.info(`Detected Dify service at ${service.url}`, { version: service.version });
        }
      }
    }

    logger.info(`Detection complete. Found ${services.length} Dify service(s)`);
    return services;
  }

  private isDifyService(headers: any, body: any): boolean {
    const serverHeader = headers['server'] || '';
    const contentType = headers['content-type'] || '';

    // Check for Nginx (common proxy for Dify)
    if (serverHeader.toLowerCase().includes('nginx')) {
      // Dify API responses typically contain specific patterns
      if (body && typeof body === 'object') {
        if (body.data?.name || body.data?.version || body.error) {
          return true;
        }
      }
    }

    // Check response body for Dify-specific patterns
    if (body && typeof body === 'object') {
      const bodyStr = JSON.stringify(body).toLowerCase();
      if (bodyStr.includes('dify') || bodyStr.includes('langgenius')) {
        return true;
      }
    }

    return false;
  }

  private extractVersion(body: any): string | undefined {
    if (body?.data?.version) {
      return body.data.version;
    }
    if (body?.version) {
      return body.version;
    }
    return undefined;
  }

  async checkServiceHealth(baseUrl: string): Promise<boolean> {
    try {
      const response = await axios.get(`${baseUrl}/api/info`, {
        timeout: 3000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const difyDetector = new DifyDetector();
