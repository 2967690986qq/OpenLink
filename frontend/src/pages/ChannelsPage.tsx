import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { channelApi, difyApi } from '../api';
import type { ChannelConfig, DifyConfig, DifyApp, DingTalkConfig, FeishuConfig } from '../types';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [difyInstances, setDifyInstances] = useState<DifyConfig[]>([]);
  const [difyApps, setDifyApps] = useState<Record<string, DifyApp[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState<'dingtalk' | 'feishu'>('dingtalk');
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    clientSecret: '',
    botAppId: '',
    appId: '',
    appSecret: '',
    difyInstanceId: '',
    difyAppId: '',
    appApiKey: ''
  });

  const loadChannels = async () => {
    try {
      const res = await channelApi.list();
      if (res.data.success) {
        setChannels(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
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
        // Load apps for each instance
        for (const instance of instances) {
          try {
            const appsRes = await difyApi.listApps(instance.id);
            if (appsRes.data.success) {
              setDifyApps(prev => ({ ...prev, [instance.id]: appsRes.data.data || [] }));
            }
          } catch {
            setDifyApps(prev => ({ ...prev, [instance.id]: [] }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load Dify instances:', error);
    }
  };

  useEffect(() => {
    loadChannels();
    loadDifyInstances();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      let config: DingTalkConfig | FeishuConfig;

      if (platform === 'dingtalk') {
        config = {
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          botAppId: formData.botAppId
        };
      } else {
        config = {
          appId: formData.appId,
          appSecret: formData.appSecret
        };
      }

      await channelApi.create({
        platform,
        name: formData.name,
        difyInstanceId: formData.difyInstanceId,
        difyAppId: formData.difyAppId,
        config
      });

      // Set app API key separately if provided
      if (formData.appApiKey) {
        const channelsRes = await channelApi.list();
        if (channelsRes.data.success) {
          const newChannel = (channelsRes.data.data || []).find(
            c => c.difyInstanceId === formData.difyInstanceId && c.difyAppId === formData.difyAppId
          );
          if (newChannel) {
            await channelApi.setAppApiKey(newChannel.id, formData.appApiKey);
          }
        }
      }

      setFormData({
        name: '',
        clientId: '',
        clientSecret: '',
        botAppId: '',
        appId: '',
        appSecret: '',
        difyInstanceId: '',
        difyAppId: '',
        appApiKey: ''
      });
      setShowForm(false);
      loadChannels();
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此频道吗？')) return;
    try {
      await channelApi.delete(id);
      loadChannels();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await channelApi.test(id);
      alert(res.data.success ? res.data.message : `测试失败: ${res.data.error}`);
    } catch (error) {
      alert('测试失败');
    }
  };

  const handleToggle = async (channel: ChannelConfig) => {
    try {
      await channelApi.update(channel.id, { enabled: !channel.enabled });
      loadChannels();
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const handleShowWebhookUrl = async (id: string) => {
    try {
      const res = await channelApi.getWebhookUrl(id);
      if (res.data.success && res.data.data) {
        const url = res.data.data.webhookUrl || res.data.data.dingtalkUrl || res.data.data.feishuUrl;
        alert(`Webhook URL:\n${url}\n\n请将此 URL 配置到对应平台的回调地址中。`);
      }
    } catch (error) {
      alert('获取 Webhook URL 失败');
    }
  };

  const getPlatformName = (p: string) => {
    const map: Record<string, string> = {
      dingtalk: '钉钉',
      feishu: '飞书',
      wechat: '企业微信',
      wecom: '企业微信'
    };
    return map[p] || p;
  };

  const getDifyInstanceName = (instanceId: string) => {
    const instance = difyInstances.find(i => i.id === instanceId);
    return instance?.name || instanceId;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  const currentApps = formData.difyInstanceId ? (difyApps[formData.difyInstanceId] || []) : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">频道管理</h1>
        <p className="page-description">配置钉钉、飞书等平台的机器人频道，并绑定 Dify 应用</p>
      </div>

      <div className="card">
        <div className="flex flex-between mb-16">
          <div className="card-title" style={{ margin: 0, padding: 0, border: 'none' }}>
            已配置的频道 ({channels.length})
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : '添加频道'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-16">
            <div className="form-item">
              <label className="form-label">平台</label>
              <select
                className="form-input"
                value={platform}
                onChange={e => setPlatform(e.target.value as 'dingtalk' | 'feishu')}
              >
                <option value="dingtalk">钉钉</option>
                <option value="feishu">飞书</option>
              </select>
            </div>
            <div className="form-item">
              <label className="form-label">频道名称</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：测试机器人"
                required
              />
            </div>

            {/* Dify binding section */}
            <div className="form-item">
              <label className="form-label">绑定 Dify 实例</label>
              <select
                className="form-input"
                value={formData.difyInstanceId}
                onChange={e => setFormData(prev => ({ ...prev, difyInstanceId: e.target.value, difyAppId: '' }))}
                required
              >
                <option value="">请选择 Dify 实例</option>
                {difyInstances.map(instance => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} ({instance.baseUrl})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-item">
              <label className="form-label">绑定 Dify 应用</label>
              <select
                className="form-input"
                value={formData.difyAppId}
                onChange={e => setFormData(prev => ({ ...prev, difyAppId: e.target.value }))}
                required
                disabled={!formData.difyInstanceId}
              >
                <option value="">请先选择 Dify 实例</option>
                {currentApps.map(app => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-item">
              <label className="form-label">应用 API Key (Dify App API Key)</label>
              <input
                type="password"
                className="form-input"
                value={formData.appApiKey}
                onChange={e => setFormData(prev => ({ ...prev, appApiKey: e.target.value }))}
                placeholder="每个 Dify 应用有独立的 API Key，用于对话接口鉴权"
                required
              />
              <small style={{ color: '#888', fontSize: '12px' }}>
                在 Dify 应用详情页的「API 访问」中获取 app-specific API Key
              </small>
            </div>

            {/* Platform config section */}
            {platform === 'dingtalk' ? (
              <>
                <div className="form-item">
                  <label className="form-label">Client ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.clientId}
                    onChange={e => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">Client Secret</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.clientSecret}
                    onChange={e => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">机器人 App ID (可选)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.botAppId}
                    onChange={e => setFormData(prev => ({ ...prev, botAppId: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-item">
                  <label className="form-label">App ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.appId}
                    onChange={e => setFormData(prev => ({ ...prev, appId: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">App Secret</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.appSecret}
                    onChange={e => setFormData(prev => ({ ...prev, appSecret: e.target.value }))}
                    required
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary">保存</button>
          </form>
        )}

        {channels.length === 0 ? (
          <div className="empty">暂无配置的频道，点击上方按钮添加</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>平台</th>
                <th>绑定 Dify</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(channel => (
                <tr key={channel.id}>
                  <td>{channel.name}</td>
                  <td>{getPlatformName(channel.platform)}</td>
                  <td>{getDifyInstanceName(channel.difyInstanceId)}</td>
                  <td>
                    <span className={`badge ${channel.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {channel.enabled ? '已启用' : '已禁用'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleToggle(channel)}
                      >
                        {channel.enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleTest(channel.id)}
                      >
                        测试
                      </button>
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleShowWebhookUrl(channel.id)}
                      >
                        Webhook
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(channel.id)}
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
      </div>
    </div>
  );
}
