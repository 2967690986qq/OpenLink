import axios from 'axios';
import { DetectedService } from '../types/index.js';
import logger from '../utils/logger.js';

const COMMON_DIFY_PORTS = [80, 443, 8080, 3000, 5000, 8000, 9000];
const COMMON_DIFY_PATHS = ['/', '/api/info', '/console/api/active-works'];

export class DifyDetector {
  async detectLocalServices(): Promise<DetectedService[]> {
    const services: DetectedService[] = [];
    const hosts = [
      'localhost',
      '127.0.0.1',
      'host.docker.internal'
    ];

    logger.info('Starting local Dify service detection...');

    for (const host of hosts) {
      for (const port of COMMON_DIFY_PORTS) {
        for (const path of COMMON_DIFY_PATHS) {
          try {
            const url = `http://${host}:${port}${path}`;
            const response = await axios.get(url, {
              timeout: 2000,
              validateStatus: () => true
            });

            if (this.isDifyService(response.headers, response.data)) {
              const service: DetectedService = {
                name: `Dify (${host}:${port})`,
                type: 'dify',
                url: `http://${host}:${port}`,
                port,
                status: 'running',
                version: this.extractVersion(response.data)
              };

              const exists = services.some(s => s.url === service.url);
              if (!exists) {
                services.push(service);
                logger.info(`Detected Dify service at ${url}`, { version: service.version });
              }
            }
          } catch {
            // Service not responding on this port/path combination
          }
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
