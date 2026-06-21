import { useState, useEffect, FormEvent } from 'react';
import { knowledgeBaseApi } from '../api';
import type { KnowledgeBaseConfig, KnowledgeBaseType } from '../types';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Play, Pause, Database, Eye, EyeOff, X, CheckCircle, XCircle, Loader } from 'lucide-react';

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function typeLabel(t: KnowledgeBaseType): string {
  if (t === 'dify') return 'Dify';
  if (t === 'ragflow') return 'RAGFlow';
  return t;
}

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeBaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'dify' as KnowledgeBaseType,
    baseUrl: '',
    apiKey: '',
    description: ''
  });
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [formTestResult, setFormTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formTesting, setFormTesting] = useState(false);

  const loadList = async () => {
    try {
      setLoading(true);
      const res = await knowledgeBaseApi.list();
      if (res.data.success) setItems(res.data.data || []);
    } catch {
      toast.error('加载知识库配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const openCreate = () => {
    setFormData({ name: '', type: 'dify', baseUrl: '', apiKey: '', description: '' });
    setFormTestResult(null);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: KnowledgeBaseConfig) => {
    setFormData({
      name: item.name,
      type: item.type,
      baseUrl: item.baseUrl,
      apiKey: item.apiKey,
      description: item.description || ''
    });
    setFormTestResult(null);
    setEditingId(item.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.type || !formData.baseUrl || !formData.apiKey) {
      toast.error('请填写必填字段');
      return;
    }

    try {
      if (editingId) {
        const res = await knowledgeBaseApi.update(editingId, formData);
        if (res.data.success) {
          toast.success('更新成功');
          closeForm();
          loadList();
        } else {
          toast.error(res.data.error || '更新失败');
        }
      } else {
        const res = await knowledgeBaseApi.create(formData);
        if (res.data.success) {
          toast.success('创建成功');
          closeForm();
          loadList();
        } else {
          toast.error(res.data.error || '创建失败');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || '操作失败');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除「${name}」吗？此操作不可恢复。`)) return;
    try {
      const res = await knowledgeBaseApi.delete(id);
      if (res.data.success) {
        toast.success('删除成功');
        loadList();
      } else {
        toast.error(res.data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  const handleToggle = async (item: KnowledgeBaseConfig) => {
    try {
      const res = await knowledgeBaseApi.update(item.id, { enabled: !item.enabled });
      if (res.data.success) {
        toast.success(item.enabled ? '已禁用' : '已启用');
        loadList();
      }
    } catch {
      toast.error('操作失败');
    }
  };

  const handleFormTest = async () => {
    if (!formData.baseUrl || !formData.apiKey) {
      toast.error('请先填写 API 地址和 Key');
      return;
    }
    setFormTesting(true);
    setFormTestResult(null);
    try {
      const res = await knowledgeBaseApi.testConnection({
        type: formData.type,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey
      });
      setFormTestResult({
        success: res.data.success === true,
        message: res.data.message || (res.data.success ? '连接成功' : '连接失败')
      });
    } catch (err: any) {
      setFormTestResult({
        success: false,
        message: err.response?.data?.error || err.message || '连接失败'
      });
    } finally {
      setFormTesting(false);
    }
  };

  if (loading) return <div className="loading-state"><div className="loading-spinner" /><span>加载中...</span></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">知识库配置</h1>
        <p className="page-description">管理 Dify、RAGFlow 等知识库的应用配置（每个配置独立绑定一个应用 API 和 Key）</p>
      </div>

      <div className="card">
        <div className="card-title">
          <span>已配置 ({items.length})</span>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> 新建配置
          </button>
        </div>

        {items.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">💾</div>
            <div className="empty-state-title">暂无知识库配置</div>
            <div className="empty-state-desc">点击上方「新建配置」开始添加你的知识库应用</div>
          </div>
        )}

        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 20,
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  background: 'white',
                  opacity: item.enabled ? 1 : 0.7
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: item.type === 'dify' ? '#dbeafe' : '#ede9fe',
                      color: item.type === 'dify' ? '#2563eb' : '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Database size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                        {item.name}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="badge badge-info">{typeLabel(item.type)}</span>
                        {item.enabled ? (
                          <span className="badge badge-success">● 已启用</span>
                        ) : (
                          <span className="badge badge-warning">○ 已禁用</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}>
                      <Edit2 size={12} /> 编辑
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleToggle(item)}>
                      {item.enabled ? <Pause size={12} /> : <Play size={12} />}
                      {item.enabled ? '禁用' : '启用'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id, item.name)}>
                      <Trash2 size={12} /> 删除
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 46 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 60 }}>API 地址</span>
                    <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: 13 }}>
                      {item.baseUrl}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 60 }}>API Key</span>
                    <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: 13 }}>
                      {showKeyId === item.id ? item.apiKey : `${item.apiKey.slice(0, 4)}...${item.apiKey.slice(-4)}`}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => setShowKeyId(showKeyId === item.id ? null : item.id)}
                    >
                      {showKeyId === item.id ? <><EyeOff size={10} /> 隐藏</> : <><Eye size={10} /> 显示</>}
                    </button>
                  </div>
                  {item.description && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 60 }}>描述</span>
                      <span style={{ color: '#64748b', fontSize: 13 }}>{item.description}</span>
                    </div>
                  )}
                  <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                    创建于 {formatDate(item.createdAt)} · 更新于 {formatDate(item.updatedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
          onClick={closeForm}
        >
          <form
            onSubmit={(e) => { e.stopPropagation(); handleSubmit(e); }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 12,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 28,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#0f172a' }}>
                {editingId ? '编辑配置' : '新建配置'}
              </h3>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeForm(); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                }}
                aria-label="关闭"
              >
                <X size={18} style={{ color: '#94a3b8' }} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">知识库类型</label>
              <select
                className="form-input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as KnowledgeBaseType })}
                disabled={!!editingId}
              >
                <option value="dify">Dify</option>
                <option value="ragflow">RAGFlow (开发中)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">名称 *</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：公司知识库、产品问答助手"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                API 地址 * <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 12 }}>（Dify 应用 API 地址）</span>
              </label>
              <input
                className="form-input"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="例如：http://192.168.1.3"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">API Key *</label>
              <input
                type="password"
                className="form-input"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="输入应用 API Key"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">描述</label>
              <textarea
                className="form-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="选填：简要描述此配置的用途"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <button
                type="button"
                className={`btn ${formTestResult?.success === false ? 'btn-danger' : formTestResult?.success === true ? 'btn-success' : 'btn-outline'} btn-sm`}
                onClick={(e) => { e.stopPropagation(); handleFormTest(); }}
                disabled={formTesting || !formData.baseUrl || !formData.apiKey}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {formTesting ? (
                  <><Loader size={12} className="spinning" /> 测试中...</>
                ) : formTestResult?.success === true ? (
                  <><CheckCircle size={12} /> 连接成功</>
                ) : formTestResult?.success === false ? (
                  <><XCircle size={12} /> 连接失败，再试</>
                ) : (
                  <><Play size={12} /> 测试连接</>
                )}
              </button>
              {formTestResult && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: formTestResult.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${formTestResult.success ? '#86efac' : '#fca5a5'}`,
                    fontSize: 13,
                    color: formTestResult.success ? '#166534' : '#991b1b'
                  }}
                >
                  {formTestResult.message}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeForm(); }}
                className="btn btn-outline"
              >
                取消
              </button>
              <button type="submit" className="btn btn-primary">
                {editingId ? '保存更改' : '创建配置'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
