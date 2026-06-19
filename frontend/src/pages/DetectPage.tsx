import { useState, useEffect } from 'react';
import { difyApi } from '../api';
import type { DetectedService } from '../types';
import { toast } from 'sonner';
import { Search, Server, CheckCircle, XCircle, Hash, Layers } from 'lucide-react';

export default function DetectPage() {
  const [services, setServices] = useState<DetectedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const handleDetect = async () => {
    setLoading(true);
    try {
      const res = await difyApi.detect();
      if (res.data.success && res.data.data) {
        setServices(res.data.data || []);
        setLastScan(new Date().toLocaleString());
        if (res.data.data.length === 0) {
          toast('未检测到 Dify 服务，请确认 Dify 正在运行');
        } else {
          toast.success(`检测到 ${res.data.data.length} 个 Dify 服务`);
        }
      }
    } catch {
      toast.error('检测失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { handleDetect(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">本地服务检测</h1>
        <p className="page-description">自动扫描本地网络中的 Dify 服务（并发扫描，约 2 秒完成）</p>
      </div>

      <div className="card">
        <div className="card-title">
          <span>检测结果 ({services.length})</span>
          <button className="btn btn-primary btn-sm" onClick={handleDetect} disabled={loading}>
            <Search size={14} />
            {loading ? '扫描中...' : '重新扫描'}
          </button>
        </div>

        {lastScan && (
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
            上次扫描：{lastScan}
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>正在扫描本地服务...</span>
          </div>
        )}

        {!loading && services.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">未检测到 Dify 服务</div>
            <div className="empty-state-desc">请确认 Dify 正在运行，并检查端口是否可访问</div>
          </div>
        )}

        {!loading && services.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>地址</th>
                  <th>端口</th>
                  <th>版本</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Server size={14} color="#64748b" />
                        {s.name}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>{s.url}</td>
                    <td><span className="badge badge-info">{s.port}</span></td>
                    <td style={{ fontSize: 13, color: '#64748b' }}>{s.version || '-'}</td>
                    <td>
                      <span className={`badge ${s.status === 'running' ? 'badge-success' : 'badge-warning'}`}>
                        {s.status === 'running' ? <><CheckCircle size={12} /> 运行中</> : <><XCircle size={12} /> 已停止</>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Scan scope info */}
        <div style={{
          marginTop: 20, padding: '16px 20px',
          background: '#f8fafc', borderRadius: 12,
          border: '1px solid #e2e8f0', fontSize: 13, color: '#64748b'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#475569' }}>扫描范围</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={12} />
              主机：localhost、127.0.0.1、host.docker.internal
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash size={12} />
              端口：80、443、8080、3000、5000、8000、9000
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={12} />
              路径：/、/api/info、/console/api/active-works
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
