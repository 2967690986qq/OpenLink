import { useState, useEffect, FormEvent } from 'react';
import { channelApi, difyApi } from '../api';
import type { ChannelConfig, DifyConfig, DifyApp } from '../types';
import { toast } from 'sonner';
import { Plus, TestTube, Trash2, ToggleLeft, ToggleRight, Webhook, MessageSquare, Bot } from 'lucide-react';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [difyInstances, setDifyInstances] = useState<DifyConfig[]>([]);
  const [difyApps, setDifyApps] = useState<Record<string, DifyApp[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState<'dingtalk' | 'feishu'>('dingtalk');
  const [formData, setFormData] = useState({
    name: '', clientId: '', clientSecret: '', botAppId: '',
    appId: '', appSecret: '', difyInstanceId: '', difyAppId: '', appApiKey: ''
  });

  const loadChannels = async () => {
    try {
      const res = await channelApi.list();
      if (res.data.success) setChannels(res.data.data || []);
    } catch {
      toast.error('加载频道列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDifyInstances = async () => {
    try {
      const res = await difyApi.list();
      if (res.data.success) {
        const instances = res.data.data || [];
        setDifyInstances(instances);
        for (const inst of instances) {
          try {
            const r = await difyApi.listApps(inst.id);
            if (r.data.success) setDifyApps(prev => ({ ...prev, [inst.id]: r.data.data || [] }));
          } catch {
            setDifyApps(prev => ({ ...prev, [inst.id]: [] }));
          }
        }
      }
    } catch {
      toast.error('加载 Dify 实例失败');
    }
  };

  useEffect(() => { loadChannels(); loadDifyInstances(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      let config: any;
      if (platform === 'dingtalk') {
        config = { clientId: formData.clientId, clientSecret: formData.clientSecret, botAppId: formData.botAppId };
      } else {
        config = { appId: formData.appId, appSecret: formData.appSecret };
      }
      const res = await channelApi.create({ platform, name: formData.name,
        difyInstanceId: formData.difyInstanceId, difyAppId: formData.difyAppId, config });
      if (res.data.success && res.data.data && formData.appApiKey) {
        await channelApi.setAppApiKey(res.data.data.id, formData.appApiKey);
      }
      toast.success('频道创建成功');
      setFormData({ name: '', clientId: '', clientSecret: '', botAppId: '',
        appId: '', appSecret: '', difyInstanceId: '', difyAppId: '', appApiKey: '' });
      setShowForm(false);
      loadChannels();
    } catch {
      toast.error('创建频道失败');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除频道「${name}」吗？`)) return;
    try {
      await channelApi.delete(id);
      toast.success('频道已删除');
      loadChannels();
    } catch {
      toast.error('删除失败');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await channelApi.test(id);
      if (res.data.success) toast.success(res.data.message || '连接成功');
      else toast.error(res.data.error || '连接失败');
    } catch {
      toast.error('测试失败');
    }
  };

  const handleToggle = async (ch: ChannelConfig) => {
    try {
      await channelApi.update(ch.id, { enabled: !ch.enabled });
      toast.success(ch.enabled ? '已禁用' : '已启用');
      loadChannels();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleShowWebhook = async (id: string) => {
    try {
      const res = await channelApi.getWebhookUrl(id);
      if (res.data.success && res.data.data) {
        const url = res.data.data.webhookUrl || res.data.data.dingtalkUrl || res.data.data.feishuUrl;
        toast.message(
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Webhook URL</div>
            <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{url}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>请将此 URL 配置到平台回调地址</div>
          </div>
        );
      }
    } catch {
      toast.error('获取 Webhook URL 失败');
    }
  };

  const getPlatformName = (p: string) => ({ dingtalk: '钉钉', feishu: '飞书', wechat: '企业微信', wecom: '企业微信' }[p] || p);
  const getDifyName = (id: string) => difyInstances.find(i => i.id === id)?.name || id;
  const currentApps = formData.difyInstanceId ? (difyApps[formData.difyInstanceId] || []) : [];

  if (loading) return <div className="loading-state"><div className="loading-spinner" /><span>加载中...</span></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">频道管理</h1>
        <p className="page-description">配置钉钉/飞书机器人频道，并绑定 Dify 应用</p>
      </div>

      <div className="card">
        <div className="card-title">
          <span>已配置 ({channels.length})</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} /> {showForm ? '取消' : '添加频道'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ maxWidth: 560, marginBottom: 24 }}>
            {/* Platform selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['dingtalk', 'feishu'] as const).map(p => (
                <button type="button" key={p} onClick={() => setPlatform(p)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: `2px solid ${platform === p ? '#2563eb' : '#e2e8f0'}`,
                    background: platform === p ? '#eff6ff' : 'white',
                    color: platform === p ? '#2563eb' : '#64748b',
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}>
                  {p === 'dingtalk' ? <MessageSquare size={16} /> : <Bot size={16} />}
                  {p === 'dingtalk' ? '钉钉' : '飞书'}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">频道名称</label>
              <input className="form-input" value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="例如：客服机器人" required />
            </div>

            {/* Dify binding */}
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 12, marginBottom: 20, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>绑定 Dify</div>
              <div className="form-group">
                <label className="form-label">Dify 实例</label>
                <select className="form-input" value={formData.difyInstanceId}
                  onChange={e => setFormData(p => ({ ...p, difyInstanceId: e.target.value, difyAppId: '' }))} required>
                  <option value="">请选择 Dify 实例</option>
                  {difyInstances.map(i => <option key={i.id} value={i.id}>{i.name} ({i.baseUrl})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dify 应用</label>
                <select className="form-input" value={formData.difyAppId}
                  onChange={e => setFormData(p => ({ ...p, difyAppId: e.target.value }))} required
                  disabled={!formData.difyInstanceId}>
                  <option value="">{formData.difyInstanceId ? '请选择应用' : '请先选择 Dify 实例'}</option>
                  {currentApps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">应用 API Key</label>
                <input type="password" className="form-input" value={formData.appApiKey}
                  onChange={e => setFormData(p => ({ ...p, appApiKey: e.target.value }))}
                  placeholder="Dify 应用专属 Key，在应用「访问 API」页获取" required />
              </div>
            </div>

            {/* Platform config */}
            {platform === 'dingtalk' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Client ID</label>
                  <input className="form-input" value={formData.clientId}
                    onChange={e => setFormData(p => ({ ...p, clientId: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Secret</label>
                  <input type="password" className="form-input" value={formData.clientSecret}
                    onChange={e => setFormData(p => ({ ...p, clientSecret: e.target.value }))} required />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">App ID</label>
                  <input className="form-input" value={formData.appId}
                    onChange={e => setFormData(p => ({ ...p, appId: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">App Secret</label>
                  <input type="password" className="form-input" value={formData.appSecret}
                    onChange={e => setFormData(p => ({ ...p, appSecret: e.target.value }))} required />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary">保存</button>
          </form>
        )}

        {/* Empty */}
        {channels.length === 0 && !showForm && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">暂无频道</div>
            <div className="empty-state-desc">点击上方「添加频道」开始配置</div>
          </div>
        )}

        {/* Table */}
        {channels.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>名称</th><th>平台</th><th>绑定 Dify</th><th>状态</th><th style={{ width: 320 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {channels.map(ch => (
                  <tr key={ch.id}>
                    <td style={{ fontWeight: 600 }}>{ch.name}</td>
                    <td><span className="badge badge-info">{getPlatformName(ch.platform)}</span></td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{getDifyName(ch.difyInstanceId)}</td>
                    <td>
                      <span className={`badge ${ch.enabled ? 'badge-success' : 'badge-warning'}`}>
                        {ch.enabled ? '● 已启用' : '○ 已禁用'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleToggle(ch)}>
                          {ch.enabled ? <><ToggleRight size={14} /> 禁用</> : <><ToggleLeft size={14} /> 启用</>}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleTest(ch.id)}>
                          <TestTube size={14} /> 测试
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleShowWebhook(ch.id)}>
                          <Webhook size={14} /> Webhook
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ch.id, ch.name)}>
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
      </div>
    </div>
  );
}
