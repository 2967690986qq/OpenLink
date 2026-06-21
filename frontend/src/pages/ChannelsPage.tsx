import { useState, useEffect } from 'react';
import { channelApi, knowledgeBaseApi } from '../api';
import type { ChannelConfig } from '../types';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import {
  Plus,
  Trash2,
  Pencil,
  MessageSquare,
  Bot,
  Smartphone,
  Loader2,
  X,
  QrCode,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface PlatformCard {
  key: 'feishu' | 'dingtalk' | 'weixin';
  name: string;
  icon: any;
  description: string;
  accentColor: string;
}

const PLATFORMS: PlatformCard[] = [
  {
    key: 'feishu',
    name: '飞书',
    icon: MessageSquare,
    description: '通过 WebSocket 长连接接收消息，无需公网回调。',
    accentColor: '#4f46e5',
  },
  {
    key: 'dingtalk',
    name: '钉钉',
    icon: Bot,
    description: '通过 Stream 模式接收消息，无需公网回调。',
    accentColor: '#1677ff',
  },
  {
    key: 'weixin',
    name: '微信',
    icon: Smartphone,
    description: '通过扫码登录接收消息，无需任何 App ID。',
    accentColor: '#22c55e',
  },
];

// ========== 微信扫码弹窗 ==========
interface QrModalProps {
  onClose: () => void;
  onSuccess: (config: { accountId: string; token: string; baseUrl: string }) => void;
}

function WeixinQrModal({ onClose, onSuccess }: QrModalProps) {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<{ qrcodeUrl: string; sessionId: string; baseUrl: string } | null>(null);
  const [qrImgSrc, setQrImgSrc] = useState('');
  const [status, setStatus] = useState<'pending' | 'scanned' | 'confirmed' | 'expired' | 'error' | 'idle'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState(import.meta.env.VITE_ILINK_URL || '');

  useEffect(() => {
    generateQrCode();
    return () => {
      if (qrData?.sessionId) {
        channelApi.stopQrSession(qrData.sessionId).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateQrCode = async () => {
    setLoading(true);
    setStatus('pending');
    setErrorMsg('');
    setQrData(null);
    setQrImgSrc('');
    try {
      const res = await channelApi.generateQrCode(customBaseUrl || undefined);
      if (res.data.success) {
        const data = res.data.data!;
        // iLink API 返回 qrcode（token）和 qrcodeUrl / qrcode_img_content（扫码内容）
        // 使用 qrcode 库将扫码内容转换为二维码图片
        const qrPayload = data.qrcodeUrl || data.qrcode || '';
        if (!qrPayload) {
          setStatus('error');
          setErrorMsg('获取二维码失败：iLink服务未返回有效的二维码数据');
          setLoading(false);
          return;
        }
        // 用 qrcode 库生成二维码图片 DataURL
        try {
          const dataUrl = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 220,
            color: { dark: '#000', light: '#fff' },
          });
          setQrImgSrc(dataUrl);
        } catch {
          // 如果内容太长或格式不正确，降级使用公共二维码 API
          setQrImgSrc(
            `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(qrPayload)}`,
          );
        }
        setQrData({
          qrcodeUrl: qrPayload,
          sessionId: data.sessionId,
          baseUrl: data.baseUrl,
        });
        setStatus('pending');
        startPolling(data.sessionId);
      } else {
        setStatus('error');
        setErrorMsg(res.data.error || '获取二维码失败');
      }
    } catch (err: any) {
      setStatus('error');
      // axios 错误可能包含 response.data.error 或直接是 error.message
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || '获取二维码失败';
      setErrorMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    let pollCount = 0;
    const maxPolls = 60;
    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        setStatus('expired');
        return;
      }
      try {
        const res = await channelApi.pollQrStatus(sessionId);
        const result = res.data.data;
        if (result?.status === 'confirmed') {
          clearInterval(pollInterval);
          setStatus('confirmed');
          onSuccess({
            accountId: result.account_id || '',
            token: result.token || '',
            baseUrl: result.base_url || qrData?.baseUrl || '',
          });
        } else if (result?.status === 'scanned') {
          setStatus('scanned');
        } else if (result?.status === 'expired') {
          clearInterval(pollInterval);
          setStatus('expired');
        }
      } catch {
        // 网络错误，继续轮询
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  };

  const statusText = () => {
    switch (status) {
      case 'pending':
        return '等待扫码...';
      case 'scanned':
        return '已扫描，请在微信中确认';
      case 'confirmed':
        return '登录成功！';
      case 'expired':
        return '二维码已过期';
      case 'error':
        return errorMsg || '错误';
      default:
        return '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: 420,
          padding: 24,
          background: '#fff',
          borderRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>微信扫码登录</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
            marginBottom: 12,
            background: '#f8fafc',
          }}
        >
          {loading && <Loader2 size={32} className="spinning" style={{ margin: '0 auto' }} />}
          {!loading && qrImgSrc && status !== 'confirmed' && (
            <img
              src={qrImgSrc}
              alt="扫码二维码"
              style={{ maxWidth: 220, height: 'auto', borderRadius: 8 }}
            />
          )}
          {!loading && !qrData && status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <AlertCircle size={48} color="#ef4444" />
              <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', maxWidth: 200 }}>
                {errorMsg.includes('ENOTFOUND') ? (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>iLink 服务不可用</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      默认服务地址无法访问，请在下方输入您自己的 iLink 服务地址
                    </div>
                  </div>
                ) : (
                  <div>{errorMsg}</div>
                )}
              </div>
            </div>
          )}
          {!loading && status === 'confirmed' && <CheckCircle2 size={48} color="#10b981" />}
        </div>

        <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 12 }}>
          {statusText()}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
            iLink 服务地址（可选）
          </label>
          <input
            className="form-input"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder="https://your-ilink-server.com"
            style={{ fontSize: 13 }}
          />
        </div>

        {(status === 'expired' || status === 'error') && (
          <button className="btn btn-primary" onClick={generateQrCode} style={{ width: '100%' }}>
            <RefreshCwIcon /> 重新获取
          </button>
        )}
      </div>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

// ========== 创建频道弹窗 ==========
interface CreateModalProps {
  platform: 'feishu' | 'dingtalk' | 'weixin';
  onClose: () => void;
  onSuccess: () => void;
  editChannel?: ChannelConfig | null;
}

function CreateChannelModal({ platform, onClose, onSuccess, editChannel }: CreateModalProps) {
  const platformInfo = PLATFORMS.find((p) => p.key === platform)!;
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [name, setName] = useState(editChannel?.name || '');
  const [selectedKb, setSelectedKb] = useState(editChannel?.knowledgeBaseId || '');
  const [weixinConfig, setWeixinConfig] = useState<{ accountId: string; token: string; baseUrl: string } | null>(
    editChannel?.platform === 'weixin' ? ((editChannel.config as any) || null) : null
  );
  const [feishuConfig, setFeishuConfig] = useState(
    editChannel?.platform === 'feishu'
      ? { appId: (editChannel.config as any)?.appId || '', appSecret: (editChannel.config as any)?.appSecret || '' }
      : { appId: '', appSecret: '' }
  );
  const [dingtalkConfig, setDingtalkConfig] = useState(
    editChannel?.platform === 'dingtalk'
      ? {
          clientId: (editChannel.config as any)?.clientId || '',
          clientSecret: (editChannel.config as any)?.clientSecret || '',
        }
      : { clientId: '', clientSecret: '' }
  );
  const [responseMode, setResponseMode] = useState<'blocking' | 'streaming'>(
    ((editChannel?.config as any)?.responseMode as 'blocking' | 'streaming') || 'blocking'
  );
  const [showQr, setShowQr] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | 'pending'>('pending');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    knowledgeBaseApi.list().then((res) => {
      if (res.data.success) {
        setKnowledgeBases(res.data.data || []);
      }
    });
  }, []);

  const testConnection = async () => {
    if (platform === 'weixin') {
      setShowQr(true);
      return;
    }
    if (platform === 'feishu' && (!feishuConfig.appId || !feishuConfig.appSecret)) {
      toast.error('请填写 App ID 和 App Secret');
      return;
    }
    if (platform === 'dingtalk' && (!dingtalkConfig.clientId || !dingtalkConfig.clientSecret)) {
      toast.error('请填写 Client ID 和 Client Secret');
      return;
    }
    setTesting(true);
    setTestResult('pending');
    try {
      const config =
        platform === 'feishu' ? feishuConfig : platform === 'dingtalk' ? dingtalkConfig : weixinConfig;
      const res = await channelApi.testPlatform(platform, config);
      if (res.data.success) {
        setTestResult('success');
        toast.success('配置验证成功');
      } else {
        setTestResult('failed');
        toast.error(res.data.error || res.data.message || '配置验证失败');
      }
    } catch {
      setTestResult('failed');
      toast.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请填写频道名称');
      return;
    }
    if (!selectedKb) {
      toast.error('请选择知识库配置');
      return;
    }
    if (platform === 'feishu' && (!feishuConfig.appId || !feishuConfig.appSecret)) {
      toast.error('请填写飞书 App ID 和 App Secret');
      return;
    }
    if (platform === 'dingtalk' && (!dingtalkConfig.clientId || !dingtalkConfig.clientSecret)) {
      toast.error('请填写钉钉 Client ID 和 Client Secret');
      return;
    }
    if (platform === 'weixin' && (!weixinConfig || !weixinConfig.accountId)) {
      toast.error('请先完成微信扫码登录');
      return;
    }

    setSubmitting(true);
    try {
      let config: any = {};
      if (platform === 'feishu') config = { ...feishuConfig, responseMode };
      else if (platform === 'dingtalk') config = { ...dingtalkConfig, responseMode };
      else if (platform === 'weixin' && weixinConfig) config = weixinConfig;

      let res;
      if (editChannel) {
        res = await channelApi.update(editChannel.id, {
          name,
          knowledgeBaseId: selectedKb,
          config,
        });
      } else {
        res = await channelApi.create({
          platform,
          name,
          knowledgeBaseId: selectedKb,
          config,
        });
      }
      if (res.data.success) {
        toast.success(editChannel ? '频道更新成功' : '频道创建成功');
        onSuccess();
      } else {
        toast.error(res.data.error || (editChannel ? '更新失败' : '创建失败'));
      }
    } catch {
      toast.error(editChannel ? '更新频道失败' : '创建频道失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 520, padding: 24, background: '#fff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>
            {editChannel ? `编辑 ${platformInfo.name} 频道` : `配置 ${platformInfo.name}`}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">频道名称</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：客服机器人"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">知识库配置</label>
          <select
            className="form-input"
            value={selectedKb}
            onChange={(e) => setSelectedKb(e.target.value)}
            required
          >
            <option value="">请选择知识库配置</option>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name} ({kb.type.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* 飞书配置 */}
        {platform === 'feishu' && (
          <>
            <div
              style={{
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 600, color: '#5b21b6', marginBottom: 8, fontSize: 14 }}>
                📋 飞书开放平台配置步骤
              </div>
              <div style={{ color: '#6b21a8', fontSize: 13, lineHeight: 1.7 }}>
                <div>1. 登录 <a href="https://open.feishu.cn/app" target="_blank" rel="noopener noreferrer" style={{ color: '#5b21b6', textDecoration: 'underline' }}>飞书开放平台</a> → 创建企业自建应用</div>
                <div>2. 应用功能 → 机器人 → <b>启用机器人</b></div>
                <div>3. 事件与回调 → 订阅方式 → <b>使用长连接接收事件/回调</b></div>
                <div>4. 添加事件 → 搜索并添加 <code style={{ background: '#ede9fe', padding: '1px 6px', borderRadius: 3 }}>im.message.receive_v1</code></div>
                <div>5. 权限管理 → 开通 <code style={{ background: '#ede9fe', padding: '1px 6px', borderRadius: 3 }}>im:message</code> 权限</div>
                <div>6. 版本管理与发布 → 创建版本 → 发布到企业/个人可用范围</div>
                <div style={{ marginTop: 8, color: '#7c3aed', fontStyle: 'italic' }}>
                  💡 注意：无需配置公网回调地址，使用长连接模式本地即可接收消息。
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">飞书 App ID</label>
              <input
                className="form-input"
                value={feishuConfig.appId}
                onChange={(e) => setFeishuConfig({ ...feishuConfig, appId: e.target.value })}
                placeholder="cli_xxxxxxxxxxxxx"
              />
            </div>
            <div className="form-group">
              <label className="form-label">飞书 App Secret</label>
              <input
                type="password"
                className="form-input"
                value={feishuConfig.appSecret}
                onChange={(e) => setFeishuConfig({ ...feishuConfig, appSecret: e.target.value })}
                placeholder="appSecret"
              />
            </div>
            <div className="form-group">
              <label className="form-label">回复模式</label>
              <select
                className="form-input"
                value={responseMode}
                onChange={(e) => setResponseMode(e.target.value as 'blocking' | 'streaming')}
              >
                <option value="blocking">阻塞模式（等待完整回答后一次性显示）</option>
                <option value="streaming">流式模式（实时接收 Dify 响应，后端累积完整 answer 后回复）</option>
              </select>
            </div>
          </>
        )}

        {/* 钉钉配置 */}
        {platform === 'dingtalk' && (
          <>
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 8, fontSize: 14 }}>
                📋 钉钉开放平台配置步骤
              </div>
              <div style={{ color: '#1e3a8a', fontSize: 13, lineHeight: 1.7 }}>
                <div>1. 登录 <a href="https://open-dev.dingtalk.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', textDecoration: 'underline' }}>钉钉开发者后台</a> → 创建应用</div>
                <div>2. 基础信息 → 获取 <b>Client ID（AppKey）</b> 和 <b>Client Secret（AppSecret）</b></div>
                <div>3. 应用信息 → 应用首页 → 配置机器人</div>
                <div>4. 权限管理 → 开通消息接收相关权限</div>
                <div>5. Stream模式（长连接）：无需公网回调地址，由服务端自动建立连接</div>
                <div style={{ marginTop: 8, color: '#2563eb', fontStyle: 'italic' }}>
                  💡 注意：钉钉应用需要发布后其他用户才能使用机器人。
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">钉钉 Client ID</label>
              <input
                className="form-input"
                value={dingtalkConfig.clientId}
                onChange={(e) => setDingtalkConfig({ ...dingtalkConfig, clientId: e.target.value })}
                placeholder="钉钉应用ID"
              />
            </div>
            <div className="form-group">
              <label className="form-label">钉钉 Client Secret</label>
              <input
                type="password"
                className="form-input"
                value={dingtalkConfig.clientSecret}
                onChange={(e) => setDingtalkConfig({ ...dingtalkConfig, clientSecret: e.target.value })}
                placeholder="应用Secret"
              />
            </div>
            <div className="form-group">
              <label className="form-label">回复模式</label>
              <select
                className="form-input"
                value={responseMode}
                onChange={(e) => setResponseMode(e.target.value as 'blocking' | 'streaming')}
              >
                <option value="blocking">阻塞模式（等待完整回答后一次性显示）</option>
                <option value="streaming">流式模式（实时接收 Dify 响应，后端累积完整 answer 后回复）</option>
              </select>
            </div>
          </>
        )}

        {/* 微信配置 */}
        {platform === 'weixin' && (
          <div
            style={{
              padding: 16,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', marginBottom: 4 }}>
              <QrCode size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
              微信扫码登录
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#15803d', marginBottom: 12 }}>
              点击下方按钮打开扫码登录，扫码后自动获取账号信息。
            </div>
            <button className="btn btn-primary" onClick={() => setShowQr(true)}>
              <QrCode size={14} /> 打开扫码登录
            </button>
            {weixinConfig?.accountId && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #bbf7d0',
                  fontSize: 13,
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} /> 已获取账号信息（Account ID: {weixinConfig.accountId.slice(0, 8)}...）
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {platform !== 'weixin' && (
            <button
              className={`btn ${
                testResult === 'success' ? 'btn-success' : testResult === 'failed' ? 'btn-danger' : 'btn-outline'
              } btn-sm`}
              onClick={testConnection}
              disabled={testing}
            >
              {testing && <Loader2 size={14} className="spinning" />}
              {!testing && testResult === 'success' && <CheckCircle2 size={14} />}
              {!testing && testResult === 'failed' && <AlertCircle size={14} />}
              {!testing && '测试连接'}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSubmit} style={{ marginLeft: 'auto' }} disabled={submitting}>
            {submitting && <Loader2 size={14} className="spinning" />}
            {editChannel ? '保存修改' : <><Plus size={14} /> 创建频道</>}
          </button>
        </div>
      </div>

      {showQr && (
        <WeixinQrModal
          onClose={() => setShowQr(false)}
          onSuccess={(cfg) => {
            setWeixinConfig(cfg);
            setTimeout(() => setShowQr(false), 800);
          }}
        />
      )}
    </div>
  );
}

// ========== 主页面 ==========
export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [createPlatform, setCreatePlatform] = useState<'feishu' | 'dingtalk' | 'weixin' | null>(null);
  const [editingChannel, setEditingChannel] = useState<ChannelConfig | null>(null);

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

  useEffect(() => {
    loadChannels();
  }, []);

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

  const handleToggle = async (channel: ChannelConfig) => {
    try {
      await channelApi.update(channel.id, { enabled: !channel.enabled });
      toast.success(channel.enabled ? '已禁用' : '已启用');
      loadChannels();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleTest = async (id: string) => {
    toast.promise(
      (async () => {
        const res = await channelApi.test(id);
        if (!res.data.success) throw new Error(res.data.error || res.data.message || '测试失败');
      })(),
      {
        loading: '正在测试...',
        success: () => '连接测试成功',
        error: (err) => err.message,
      }
    );
  };

  const getPlatformInfo = (platform: string) => {
    return PLATFORMS.find((p) => p.key === platform) || PLATFORMS[0];
  };

  if (loading)
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <span>加载中...</span>
      </div>
    );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">频道管理</h1>
        <p className="page-description">
          配置飞书、钉钉、微信等频道，绑定知识库应用接收并回复消息。所有频道均使用长连接模式，无需公网IP或公网回调地址。
        </p>
      </div>

      {/* 平台选择 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          return (
            <div
              key={platform.key}
              onClick={() => {
                setEditingChannel(null);
                setCreatePlatform(platform.key);
              }}
              style={{
                background: '#fff',
                border: '2px solid #e5e7eb',
                borderRadius: 16,
                padding: 24,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              className="platform-card"
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${platform.accentColor}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Icon size={24} color={platform.accentColor} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                {platform.name}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{platform.description}</div>
              <div
                style={{
                  fontSize: 12,
                  color: platform.accentColor,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={16} /> 点击创建
              </div>
            </div>
          );
        })}
      </div>

      {/* 已配置频道列表 */}
      <div className="card">
        <div className="card-title">
          <span>已配置频道 ({channels.length})</span>
        </div>

        {channels.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">暂无频道</div>
            <div className="empty-state-desc">点击上方平台卡片配置一个新频道</div>
          </div>
        )}

        {channels.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {channels.map((channel) => {
              const platformInfo = getPlatformInfo(channel.platform);
              const Icon = platformInfo.icon;
              return (
                <div
                  key={channel.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: `${platformInfo.accentColor}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={20} color={platformInfo.accentColor} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{channel.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {platformInfo.name}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${channel.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {channel.enabled ? '● 已启用' : '○ 已禁用'}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                    <div style={{ marginBottom: 4 }}>绑定知识库</div>
                    <div style={{ color: '#1e293b', fontWeight: 500, fontSize: 13 }}>
                      {channel.knowledgeBaseId.slice(0, 8)}...
                    </div>
                    {(channel.platform === 'feishu' || channel.platform === 'dingtalk') && (
                      <div style={{ marginTop: 8 }}>
                        <div>回复模式</div>
                        <div style={{ color: '#1e293b', fontWeight: 500, fontSize: 13 }}>
                          {((channel.config as any)?.responseMode === 'streaming') ? '流式' : '阻塞'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setEditingChannel(channel);
                        setCreatePlatform(channel.platform as 'feishu' | 'dingtalk' | 'weixin');
                      }}
                    >
                      <Pencil size={14} /> 编辑
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => handleToggle(channel)}>
                      {channel.enabled ? '禁用' : '启用'}
                    </button>
                    {channel.platform !== 'weixin' && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleTest(channel.id)}>
                        测试
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(channel.id, channel.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 创建弹窗 */}
      {createPlatform && (
        <CreateChannelModal
          platform={createPlatform}
          editChannel={editingChannel}
          onClose={() => {
            setCreatePlatform(null);
            setEditingChannel(null);
          }}
          onSuccess={() => {
            setCreatePlatform(null);
            setEditingChannel(null);
            loadChannels();
          }}
        />
      )}
    </div>
  );
}
