import { useState, useEffect } from 'react';
import { difyApi } from '../api';
import type { DetectedService } from '../types';

export default function DetectPage() {
  const [services, setServices] = useState<DetectedService[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const handleDetect = async () => {
    setLoading(true);
    try {
      const res = await difyApi.detect();
      if (res.data.success) {
        setServices(res.data.data || []);
        setLastScan(new Date().toLocaleString());
      }
    } catch (error) {
      console.error('Detection failed:', error);
      alert('检测失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleDetect();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">本地服务检测</h1>
        <p className="page-description">自动扫描本地网络中的 Dify 服务</p>
      </div>

      <div className="card">
        <div className="flex flex-between mb-16">
          <div>
            {lastScan && <span>上次扫描: {lastScan}</span>}
          </div>
          <button className="btn btn-primary" onClick={handleDetect} disabled={loading}>
            {loading ? '扫描中...' : '重新扫描'}
          </button>
        </div>

        {loading ? (
          <div className="loading">正在扫描本地服务...</div>
        ) : services.length === 0 ? (
          <div className="empty">
            <p>未检测到本地 Dify 服务</p>
            <p style={{ fontSize: 12, marginTop: 8, color: '#999' }}>
              请确保 Dify 正在本地运行，并检查端口是否可访问
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>服务名称</th>
                <th>类型</th>
                <th>地址</th>
                <th>端口</th>
                <th>版本</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={index}>
                  <td>{service.name}</td>
                  <td>{service.type}</td>
                  <td>{service.url}</td>
                  <td>{service.port}</td>
                  <td>{service.version || '-'}</td>
                  <td>
                    <span className={`badge ${service.status === 'running' ? 'badge-success' : 'badge-warning'}`}>
                      {service.status === 'running' ? '运行中' : '已停止'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <h4 style={{ marginBottom: 8 }}>扫描范围</h4>
          <ul style={{ fontSize: 14, color: '#666' }}>
            <li>主机: localhost, 127.0.0.1, host.docker.internal</li>
            <li>端口: 80, 443, 8080, 3000, 5000, 8000, 9000</li>
            <li>路径: /, /api/info, /console/api/active-works</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
