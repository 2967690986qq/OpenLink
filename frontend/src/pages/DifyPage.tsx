import { useState, useEffect, FormEvent } from 'react';
import { difyApi } from '../api';
import type { DifyConfig, DifyApp } from '../types';
import { toast } from 'sonner';
import { Plus, TestTube, Trash2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';

export default function DifyPage() {
  const [instances, setInstances] = useState<DifyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', baseUrl: '', apiKey: '' });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [apps, setApps] = useState<Record<string, DifyApp[]>>({});

  const loadInstances = async () => {
    try {
      const res = await difyApi.list();
      if (res.data.success) {
        setInstances(res.data.data || []);
      }
    } catch {
      toast.error('加载实例列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInstances(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await difyApi.create(formData);
      toast.success('实例添加成功');
      setFormData({ name: '', baseUrl: '', apiKey: '' });
      setShowForm(false);
      loadInstances();
    } catch {
      toast.error('添加实例失败');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除实例「${name}」吗？`)) return;
    try {
      await difyApi.delete(id);
      toast.success('实例已删除');
      loadInstances();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await difyApi.test(id);
      if (res.data.success) {
        toast.success(res.data.message || '连接成功');
      } else {
        toast.error(res.data.error || '连接失败');
      }
    } catch {
      toast.error('连接测试失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (instance: DifyConfig) => {
    try {
      await difyApi.update(instance.id, { enabled: !instance.enabled });
      toast.success(instance.enabled ? '已禁用' : '已启用');
      loadInstances();
    } catch {
      toast.error('操作失败');
    }
  };

  const loadApps = async (instanceId: string) => {
    if (apps[instanceId]) {
      setApps(prev => { const n = { ...prev }; delete n[instanceId]; return n; });
      return;
    }
    try {
      const res = await difyApi.listApps(instanceId);
      if (res.data.success) {
        setApps(prev => ({ ...prev, [instanceId]: res.data.data || [] }));
      }
    } catch {
      toast.error('加载应用列表失败');
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Dify 实例</h1>
        <p className="page-description">管理 Dify API 实例，网关将通过这些实例访问 Dify 知识库</p>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div className="card-title">
          <span>已配置 ({instances.length})</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={14} />
            {showForm ? '取消' : '添加实例'}
          </button>
        </div>

        {/* Inline Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-16" style={{ maxWidth: 520 }}>
            <div className="form-group">
              <label className="form-label">名称</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：本地 Dify"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">API 地址</label>
              <input
                className="form-input"
                value={formData.baseUrl}
                onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="http://localhost:8000"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">API Key（管理员 Key）</label>
              <input
                type="password"
                className="form-input"
                value={formData.apiKey}
                onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="app-xxxxxxxxxxxx"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">保存</button>
          </form>
        )}

        {/* Empty State */}
        {!loading && instances.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">暂无实例</div>
            <div className="empty-state-desc">点击上方「添加实例」开始配置</div>
          </div>
        )}

        {/* Table */}
        {instances.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>地址</th>
                  <th>状态</th>
                  <th style={{ width: 280 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => (
                  <tr key={inst.id}>
                    <td style={{ fontWeight: 600 }}>{inst.name}</td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{inst.baseUrl}</td>
                    <td>
                      <span className={`badge ${inst.enabled ? 'badge-success' : 'badge-warning'}`}>
                        {inst.enabled ? '● 已启用' : '○ 已禁用'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleToggle(inst)}
                        >
                          {inst.enabled
                            ? <><ToggleRight size={14} /> 禁用</>
                            : <><ToggleLeft size={14} /> 启用</>
                          }
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleTest(inst.id)}
                          disabled={testingId === inst.id}
                        >
                          <TestTube size={14} />
                          {testingId === inst.id ? '测试中' : '测试'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => loadApps(inst.id)}
                        >
                          <ChevronDown size={14} />
                          应用 ({apps[inst.id]?.length || 0})
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(inst.id, inst.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Apps Panel */}
        {Object.entries(apps).map(([instanceId, appList]) => (
          appList.length > 0 && (
            <div key={instanceId} style={{
              marginTop: 16, padding: 16,
              background: '#f8fafc', borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                可用应用（{appList.length}）
              </div>
              {appList.map(app => (
                <div key={app.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'white', marginBottom: 4,
                  border: '1px solid #f1f5f9'
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{app.name}</div>
                    {app.description && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{app.description}</div>
                    )}
                  </div>
                  <span className="badge badge-info">{app.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
