import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { difyApi } from '../api';
import type { DifyConfig, DifyApp } from '../types';

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
    } catch (error) {
      console.error('Failed to load instances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await difyApi.create(formData);
      setFormData({ name: '', baseUrl: '', apiKey: '' });
      setShowForm(false);
      loadInstances();
    } catch (error) {
      console.error('Failed to create instance:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此实例吗？')) return;
    try {
      await difyApi.delete(id);
      loadInstances();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await difyApi.test(id);
      alert(res.data.success ? res.data.message : `测试失败: ${res.data.error}`);
    } catch (error) {
      alert('测试失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggle = async (instance: DifyConfig) => {
    try {
      await difyApi.update(instance.id, { enabled: !instance.enabled });
      loadInstances();
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const loadApps = async (instanceId: string) => {
    if (apps[instanceId]) return;
    try {
      const res = await difyApi.listApps(instanceId);
      if (res.data.success) {
        setApps(prev => ({ ...prev, [instanceId]: res.data.data || [] }));
      }
    } catch (error) {
      console.error('Failed to load apps:', error);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dify 实例管理</h1>
        <p className="page-description">管理您的 Dify API 实例和知识库配置</p>
      </div>

      <div className="card">
        <div className="flex flex-between mb-16">
          <div className="card-title" style={{ margin: 0, padding: 0, border: 'none' }}>
            已配置的实例 ({instances.length})
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : '添加实例'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-16">
            <div className="form-item">
              <label className="form-label">名称</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：本地 Dify"
                required
              />
            </div>
            <div className="form-item">
              <label className="form-label">API 地址</label>
              <input
                type="url"
                className="form-input"
                value={formData.baseUrl}
                onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="http://localhost:80"
                required
              />
            </div>
            <div className="form-item">
              <label className="form-label">API Key</label>
              <input
                type="password"
                className="form-input"
                value={formData.apiKey}
                onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="app-xxxxxxx"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">保存</button>
          </form>
        )}

        {instances.length === 0 ? (
          <div className="empty">暂无配置的实例，点击上方按钮添加</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>地址</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {instances.map(instance => (
                <tr key={instance.id}>
                  <td>{instance.name}</td>
                  <td>{instance.baseUrl}</td>
                  <td>
                    <span className={`badge ${instance.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {instance.enabled ? '已启用' : '已禁用'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleToggle(instance)}
                      >
                        {instance.enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleTest(instance.id)}
                        disabled={testingId === instance.id}
                      >
                        {testingId === instance.id ? '测试中...' : '测试'}
                      </button>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => loadApps(instance.id)}
                      >
                        应用
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(instance.id)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {Object.entries(apps).map(([instanceId, appList]) => (
          appList.length > 0 && (
            <div key={instanceId} style={{ marginTop: 16 }}>
              <h4>可用应用:</h4>
              <ul>
                {appList.map(app => (
                  <li key={app.id}>{app.name} - {app.description || '无描述'}</li>
                ))}
              </ul>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
