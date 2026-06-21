import { useState, useEffect } from 'react';
import { configApi } from '../api';
import type { GatewayConfig } from '../types';
import { toast } from 'sonner';
import { Save, RotateCcw, Server, Globe, Bug, Key, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const res = await configApi.get();
      if (res.data.success) setConfig(res.data.data);
    } catch {
      toast.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await configApi.update(config);
      toast.success('设置已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    if (!config) return;
    if (!confirm('确认重启服务？重启期间服务将短暂不可用。')) return;
    setRestarting(true);
    try {
      await configApi.restart();
      toast.success('服务正在重启，请稍候...');
      setTimeout(() => {
        // Wait for the new server to come up, then reload
        window.location.href = `http://${config.host}:${config.port}/ui/`;
      }, 3000);
    } catch (err: any) {
      setRestarting(false);
      toast.error(err.response?.data?.error || '重启失败');
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置所有配置吗？此操作不可撤销。')) return;
    try {
      await configApi.reset();
      toast.success('配置已重置，正在重新加载...');
      loadConfig();
    } catch {
      toast.error('重置失败');
    }
  };

  if (loading) return <div className="loading-state"><div className="loading-spinner" /><span>加载中...</span></div>;
  if (!config) return <div className="empty-state"><div className="empty-state-title">无法加载配置</div></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">系统设置</h1>
        <p className="page-description">配置网关运行参数和安全选项</p>
      </div>

      {/* Gateway Config */}
      <div className="card">
        <div className="card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={16} /> 网关配置
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <div className="form-group">
            <label className="form-label">
              <Globe size={12} style={{ display: 'inline', marginRight: 4 }} />
              监听主机
            </label>
            <input className="form-input" value={config.host}
              onChange={e => setConfig({ ...config, host: e.target.value })} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>修改后需重启服务生效</div>
          </div>
          <div className="form-group">
            <label className="form-label">监听端口</label>
            <input type="number" className="form-input" value={config.port}
              onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>修改后需重启服务生效</div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <Bug size={12} style={{ display: 'inline', marginRight: 4 }} />
            日志级别
          </label>
          <select className="form-input" value={config.logLevel}
            onChange={e => setConfig({ ...config, logLevel: e.target.value })}>
            <option value="debug">Debug（调试）</option>
            <option value="info">Info（常规）</option>
            <option value="warn">Warning（警告）</option>
            <option value="error">Error（错误）</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">CORS 允许来源（逗号分隔）</label>
          <input className="form-input" value={config.corsOrigins.join(', ')}
            onChange={e => setConfig({
              ...config,
              corsOrigins: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            })} />
        </div>

        {/* Auth Token */}
        <div className="form-group" style={{
          padding: '16px', background: '#f8fafc', borderRadius: 12,
          border: '1px solid #e2e8f0'
        }}>
          <label className="form-label">
            <Key size={12} style={{ display: 'inline', marginRight: 4 }} />
            Bearer Token（可选）
          </label>
          <input type="password" className="form-input"
            value={config.authToken || ''}
            onChange={e => {
              const v = e.target.value;
              setConfig({ ...config, authToken: v || undefined });
              if (v) localStorage.setItem('openlink_auth_token', v);
              else localStorage.removeItem('openlink_auth_token');
            }}
            placeholder="设置后，所有管理 API 需要此 Token 鉴权（Webhook 免鉴权）" />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            留空则为开放模式。设置后前端会自动在请求头中附加此 Token。
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? '保存中...' : '保存设置'}
          </button>
          <button className="btn btn-outline" onClick={handleRestart} disabled={restarting}>
            <RefreshCw size={14} className={restarting ? 'spinning' : ''} />
            {restarting ? '重启中...' : '重启服务'}
          </button>
          <button className="btn btn-outline" onClick={handleReset}>
            <RotateCcw size={14} />
            重置配置
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">关于</div>
        <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#94a3b8' }}>版本</span>
            <span style={{ fontWeight: 500 }}>v1.0.0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#94a3b8' }}>名称</span>
            <span style={{ fontWeight: 500 }}>OpenLink Gateway</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: '#94a3b8' }}>功能</span>
            <span style={{ fontWeight: 500, textAlign: 'right' }}>Dify 知识库 ↔ 钉钉/飞书机器人</span>
          </div>
        </div>
      </div>
    </div>
  );
}
