import { useState, useEffect } from 'react';
import { configApi } from '../api';
import type { GatewayConfig } from '../types';

export default function SettingsPage() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await configApi.get();
      if (res.data.success) {
        setConfig(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await configApi.update(config);
      alert('设置已保存');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置所有配置吗？')) return;
    try {
      await configApi.reset();
      loadConfig();
      alert('配置已重置');
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!config) {
    return <div className="empty">无法加载配置</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">系统设置</h1>
        <p className="page-description">配置网关运行参数</p>
      </div>

      <div className="card">
        <div className="card-title">网关配置</div>

        <div className="form-item">
          <label className="form-label">监听主机</label>
          <input
            type="text"
            className="form-input"
            value={config.host}
            onChange={e => setConfig({ ...config, host: e.target.value })}
          />
        </div>

        <div className="form-item">
          <label className="form-label">监听端口</label>
          <input
            type="number"
            className="form-input"
            value={config.port}
            onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })}
          />
        </div>

        <div className="form-item">
          <label className="form-label">日志级别</label>
          <select
            className="form-input"
            value={config.logLevel}
            onChange={e => setConfig({ ...config, logLevel: e.target.value })}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="form-item">
          <label className="form-label">CORS 允许的来源 (逗号分隔)</label>
          <input
            type="text"
            className="form-input"
            value={config.corsOrigins.join(', ')}
            onChange={e => setConfig({
              ...config,
              corsOrigins: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            })}
          />
        </div>

        <div className="flex gap-8">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
          <button className="btn btn-default" onClick={handleReset}>
            重置配置
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">关于</div>
        <p style={{ color: '#666' }}>
          OpenLink Gateway v1.0.0<br />
          AI 网关服务，用于连接 Dify 知识库与钉钉/飞书等平台机器人
        </p>
      </div>
    </div>
  );
}
