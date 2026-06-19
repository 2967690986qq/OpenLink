import axios from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger.js';
export class DingTalkService {
    tokenCache = new Map();
    async getAccessToken(config) {
        const cached = this.tokenCache.get(config.clientId);
        if (cached && cached.expireTime > Date.now()) {
            return cached.token;
        }
        try {
            const response = await axios.post('https://api.dingtalk.com/v1.0/oauth2/accessToken', { appKey: config.clientId, appSecret: config.clientSecret });
            const { accessToken, expireIn } = response.data;
            this.tokenCache.set(config.clientId, {
                token: accessToken,
                expireTime: Date.now() + (expireIn - 300) * 1000
            });
            logger.info('DingTalk access token obtained');
            return accessToken;
        }
        catch (error) {
            logger.error('Failed to get DingTalk access token', { error: error.message });
            throw new Error(`Failed to get access token: ${error.message}`);
        }
    }
    async sendMessage(config, conversationId, message) {
        try {
            const accessToken = await this.getAccessToken(config);
            await axios.post('https://api.dingtalk.com/v1.0/im/messages', {
                robotCode: config.botAppId,
                conversationId,
                msgParam: JSON.stringify(message),
                msgType: message.msgtype
            }, {
                headers: {
                    'x-acs-dingtalk-access-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            logger.info('DingTalk message sent successfully', { conversationId });
        }
        catch (error) {
            logger.error('Failed to send DingTalk message', { error: error.message });
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }
    async sendTextMessage(config, conversationId, content) {
        await this.sendMessage(config, conversationId, {
            msgtype: 'text',
            text: { content }
        });
    }
    async sendMarkdownMessage(config, conversationId, title, text) {
        await this.sendMessage(config, conversationId, {
            msgtype: 'markdown',
            markdown: { title, text }
        });
    }
    verifySignature(token, signature, timestamp, nonce) {
        const sortedStr = [token, timestamp, nonce].sort().join('');
        const hash = crypto.createHash('sha1').update(sortedStr).digest('hex');
        return hash === signature;
    }
    async registerCallback(config, callbackUrl, token, aesKey) {
        try {
            const accessToken = await this.getAccessToken(config);
            await axios.post('https://api.dingtalk.com/v1.0/callback/register', {
                callbackUrl,
                token,
                aesKey
            }, {
                headers: {
                    'x-acs-dingtalk-access-token': accessToken,
                    'Content-Type': 'application/json'
                }
            });
            logger.info('DingTalk callback registered successfully');
        }
        catch (error) {
            logger.error('Failed to register DingTalk callback', { error: error.message });
            throw new Error(`Failed to register callback: ${error.message}`);
        }
    }
    decryptCallbackData(encryptStr, aesKey) {
        const key = Buffer.from(aesKey + '=', 'base64');
        const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
        let decrypted = cipher.update(encryptStr, 'utf8', 'utf8');
        decrypted += cipher.final('utf8');
        return decrypted;
    }
}
export const dingTalkService = new DingTalkService();
