import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';
export class FeishuService {
    tokenCache = new Map();
    async getTenantAccessToken(config) {
        const cached = this.tokenCache.get(config.appId);
        if (cached && cached.expireTime > Date.now()) {
            return cached.token;
        }
        try {
            const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
                app_id: config.appId,
                app_secret: config.appSecret
            });
            const { tenant_access_token, expire } = response.data;
            if (tenant_access_token) {
                this.tokenCache.set(config.appId, {
                    token: tenant_access_token,
                    expireTime: Date.now() + (expire - 300) * 1000
                });
                logger.info('Feishu tenant access token obtained');
                return tenant_access_token;
            }
            throw new Error('No access token in response');
        }
        catch (error) {
            logger.error('Failed to get Feishu tenant access token', { error: error.message });
            throw new Error(`Failed to get access token: ${error.message}`);
        }
    }
    async sendMessage(config, receiveId, msgType, content) {
        try {
            const accessToken = await this.getTenantAccessToken(config);
            await axios.post('https://open.feishu.cn/open-apis/im/v1/messages', {
                receive_id: receiveId,
                msg_type: msgType,
                content: JSON.stringify({ text: content })
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: { receive_id_type: 'open_id' }
            });
            logger.info('Feishu message sent successfully', { receiveId });
        }
        catch (error) {
            logger.error('Failed to send Feishu message', { error: error.message });
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }
    async sendTextMessage(config, receiveId, text) {
        await this.sendMessage(config, receiveId, 'text', text);
    }
    async sendRichTextMessage(config, receiveId, title, content) {
        const richText = {
            title,
            content: [
                [
                    { tag: 'text', text: content }
                ]
            ]
        };
        await this.sendMessage(config, receiveId, 'post', JSON.stringify(richText));
    }
    verifyWebhookSignature(config, timestamp, signature, rawBody) {
        const stringToSign = `${timestamp}${rawBody}`;
        const key = `${config.appId}${config.appSecret}`;
        const hmac = crypto.createHmac('sha256', key).update(stringToSign).digest('base64');
        const expectedSignature = Buffer.from(hmac).toString('base64');
        return expectedSignature === signature;
    }
    async createWebhook(config, webhookName) {
        try {
            const accessToken = await this.getTenantAccessToken(config);
            const response = await axios.post('https://open.feishu.cn/open-apis/im/v1/menus', {
                name: webhookName,
                menus: []
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            logger.info('Feishu webhook created', { webhookName });
            return response.data?.data?.webhook_url || '';
        }
        catch (error) {
            logger.error('Failed to create Feishu webhook', { error: error.message });
            throw new Error(`Failed to create webhook: ${error.message}`);
        }
    }
    async getBotInfo(config) {
        try {
            const accessToken = await this.getTenantAccessToken(config);
            const response = await axios.get('https://open.feishu.cn/open-apis/bot/v3/info', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const botInfo = response.data?.data;
            if (botInfo) {
                return {
                    name: botInfo.app_name || botInfo.bot_name || 'Unknown',
                    openId: botInfo.open_id || ''
                };
            }
            return null;
        }
        catch (error) {
            logger.error('Failed to get Feishu bot info', { error: error.message });
            return null;
        }
    }
}
export const feishuService = new FeishuService();
