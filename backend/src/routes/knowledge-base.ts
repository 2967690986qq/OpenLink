import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeBaseConfig, ApiResponse, ChatRequest, KnowledgeBaseType } from '../types/index.js';
import { knowledgeBaseService } from '../services/knowledge-base.js';
import { configStore } from '../config/store.js';
import logger from '../utils/logger.js';

const router = Router();

const SUPPORTED_TYPES: KnowledgeBaseType[] = ['dify', 'ragflow'];

router.get('/', (_req: Request, res: Response) => {
  const knowledgeBases = configStore.get('knowledgeBases');
  res.json({ success: true, data: knowledgeBases } as ApiResponse<KnowledgeBaseConfig[]>);
});

router.post('/types', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: SUPPORTED_TYPES.map(type => ({
      type,
      label: type === 'dify' ? 'Dify' : 'RAGFlow',
      supported: true,
      description: type === 'dify' ? 'Dify 应用（直接绑定应用级 API Key）' : 'RAGFlow 知识库（开发中）'
    }))
  } as ApiResponse);
});

// Test connection using config passed directly in body (without needing to save first)
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { type, baseUrl, apiKey } = req.body;

    if (!type || !baseUrl || !apiKey) {
      res.status(400).json({ success: false, error: '缺少必填字段（type, baseUrl, apiKey）' } as ApiResponse);
      return;
    }

    const config: KnowledgeBaseConfig = {
      id: '',
      name: '',
      type: type as KnowledgeBaseType,
      baseUrl,
      apiKey,
      enabled: true,
      createdAt: '',
      updatedAt: ''
    };

    const result = await knowledgeBaseService.testConnection(config);
    res.json({ success: result.success, message: result.message } as ApiResponse);
  } catch (error: any) {
    logger.error('Test connection failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, type, baseUrl, apiKey, description } = req.body;

    if (!name || !type || !baseUrl || !apiKey) {
      res.status(400).json({ success: false, error: '缺少必填字段（name, type, baseUrl, apiKey）' } as ApiResponse);
      return;
    }

    if (!SUPPORTED_TYPES.includes(type as KnowledgeBaseType)) {
      res.status(400).json({ success: false, error: `不支持的知识库类型：${type}` } as ApiResponse);
      return;
    }

    const kb: KnowledgeBaseConfig = {
      id: uuidv4(),
      name,
      type: type as KnowledgeBaseType,
      baseUrl: baseUrl.replace(/\/$/, ''),
      apiKey,
      description: description || '',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const knowledgeBases = configStore.get('knowledgeBases');
    knowledgeBases.push(kb);
    configStore.set('knowledgeBases', knowledgeBases);

    logger.info('Knowledge base config added', { id: kb.id, name, type });
    res.json({ success: true, data: kb } as ApiResponse<KnowledgeBaseConfig>);
  } catch (error: any) {
    logger.error('Failed to add knowledge base config', { error: error.message });
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, baseUrl, apiKey, description, enabled } = req.body;

    const knowledgeBases = configStore.get('knowledgeBases');
    const index = knowledgeBases.findIndex(k => k.id === id);

    if (index === -1) {
      res.status(404).json({ success: false, error: '知识库配置不存在' } as ApiResponse);
      return;
    }

    if (type && !SUPPORTED_TYPES.includes(type as KnowledgeBaseType)) {
      res.status(400).json({ success: false, error: `不支持的知识库类型：${type}` } as ApiResponse);
      return;
    }

    knowledgeBases[index] = {
      ...knowledgeBases[index],
      name: name || knowledgeBases[index].name,
      type: type || knowledgeBases[index].type,
      baseUrl: baseUrl ? baseUrl.replace(/\/$/, '') : knowledgeBases[index].baseUrl,
      apiKey: apiKey || knowledgeBases[index].apiKey,
      description: description !== undefined ? description : knowledgeBases[index].description,
      enabled: enabled !== undefined ? enabled : knowledgeBases[index].enabled,
      updatedAt: new Date().toISOString()
    };

    configStore.set('knowledgeBases', knowledgeBases);
    logger.info('Knowledge base config updated', { id });
    res.json({ success: true, data: knowledgeBases[index] } as ApiResponse<KnowledgeBaseConfig>);
  } catch (error: any) {
    logger.error('Failed to update knowledge base config', { error: error.message });
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const knowledgeBases = configStore.get('knowledgeBases');
    const filtered = knowledgeBases.filter(k => k.id !== id);

    if (filtered.length === knowledgeBases.length) {
      res.status(404).json({ success: false, error: '知识库配置不存在' } as ApiResponse);
      return;
    }

    configStore.set('knowledgeBases', filtered);
    logger.info('Knowledge base config deleted', { id });
    res.json({ success: true, message: '已删除' } as ApiResponse);
  } catch (error: any) {
    logger.error('Failed to delete knowledge base config', { error: error.message });
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const knowledgeBases = configStore.get('knowledgeBases');
    const kb = knowledgeBases.find(k => k.id === id);

    if (!kb) {
      res.status(404).json({ success: false, error: '知识库配置不存在' } as ApiResponse);
      return;
    }

    const result = await knowledgeBaseService.testConnection(kb);
    res.json({ success: result.success, message: result.message } as ApiResponse);
  } catch (error: any) {
    logger.error('Knowledge base connection test failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

router.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, conversationId, userId } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: '消息内容不能为空' } as ApiResponse);
      return;
    }

    const knowledgeBases = configStore.get('knowledgeBases');
    const kb = knowledgeBases.find(k => k.id === id);

    if (!kb) {
      res.status(404).json({ success: false, error: '知识库配置不存在' } as ApiResponse);
      return;
    }

    if (!kb.enabled) {
      res.status(400).json({ success: false, error: '该知识库配置已禁用' } as ApiResponse);
      return;
    }

    const chatRequest: ChatRequest = {
      knowledgeBaseId: id,
      message,
      conversationId,
      userId
    };

    const response = await knowledgeBaseService.chat(kb, chatRequest);
    res.json({ success: true, data: response } as ApiResponse);
  } catch (error: any) {
    logger.error('Knowledge base chat failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
});

export default router;
