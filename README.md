# OpenLink Gateway

AI 网关服务，连接 Dify 知识库 ↔ 钉钉/飞书机器人，让用户在钉钉/飞书中直接与 Dify AI 对话。

## 功能特性

- **Dify 实例管理** - 配置和管理多个 Dify API 实例
- **渠道绑定** - 渠道与 Dify 实例/应用绑定，消息自动路由
- **Webhook 接入** - 钉钉/飞书机器人消息接收端点（支持自动路由）
- **Bearer Token 认证** - 管理 API 可选 Token 保护（Webhook 免认证）
- **日志脱敏** - 自动遮蔽 apiKey/secret/token 等敏感字段
- **本地服务检测** - 并发扫描本地网络中的 Dify 服务（~2s 完成）
- **Web 管理界面** - 直观的网页管理界面（React + Vite）
- **守护进程模式** - 后台运行，支持 start/stop/restart/status
- **可扩展架构** - 易于添加更多平台机器人

---

## 快速开始

### 前置要求

- **Node.js >= 18**
- **npm >= 9**

### 安装依赖

```bash
cd C:\Users\shq\Desktop\OpenLink-main
npm install
```

---

## 启动方式

### 方式一：开发模式（推荐）

前后端同时启动，支持热更新：

```bash
npm run dev
```

- 前端：**http://localhost:5173**（Vite 代理 API 请求到后端）
- 后端：**http://localhost:3000**
- 健康检查：**http://localhost:3000/health**

也可以分别启动（需要两个终端）：

```bash
# 终端 1：后端
npm run dev:backend

# 终端 2：前端
npm run dev:frontend
```

---

### 方式二：生产模式

```bash
# 1. 构建前后端
npm run build

# 2. 启动生产服务
npm run start
```

- 前端静态文件由后端直接提供服务
- 访问：**http://localhost:3000**

---

### 方式三：守护进程模式（后台常住）

```bash
# 启动守护进程
npm run gateway:start

# 查看运行状态
npm run gateway:status

# 查看实时日志
npm run gateway:logs

# 重启
npm run gateway:restart

# 停止
npm run gateway:stop
```

---

## 首次配置指南

启动后访问 **http://localhost:5173**（开发模式）或 **http://localhost:3000**（生产模式）。

### 第一步：添加 Dify 实例

1. 进入「Dify 实例」页面
2. 点击「添加实例」
3. 填写：
   - **名称**：如 `我的Dify`
   - **地址**：如 `http://localhost:8000`
   - **API Key**：Dify 控制台 → 右上角头像 → **设置 → API Key**（管理员 Key）
4. 点击「测试连接」验证，通过后保存

### 第二步：创建渠道（以钉钉为例）

1. 进入「渠道管理」页面
2. 点击「创建渠道」
3. 填写：
   - **平台**：选择 `钉钉`
   - **Dify 实例**：选择上一步创建的实例
   - **Dify 应用**：点击刷新加载应用列表，选择一个应用
   - **App API Key**：去 Dify 对应应用的 **「访问 API」** 页面复制（**不是管理员 Key**）
   - **Client ID / Client Secret**：在钉钉机器人后台获取
4. 保存后，复制页面显示的 **Webhook URL**，填到钉钉机器人后台的「消息接收地址」

### 第三步：验证链路

在钉钉群中 @ 机器人，发送消息，应该能收到 Dify 的回复。

---

## 项目结构

```
OpenLink-main/
├── backend/                    # 后端服务（Express + TypeScript）
│   ├── src/
│   │   ├── index.ts           # HTTP 服务器入口
│   │   ├── cli/
│   │   │   └── openlink.ts    # CLI 入口
│   │   ├── services/           # 业务服务
│   │   │   ├── dify.ts        #   Dify API 调用（admin/app 双 client）
│   │   │   ├── dingtalk.ts    #   钉钉机器人（解密/消息发送）
│   │   │   └── feishu.ts      #   飞书机器人（签名验证/消息发送）
│   │   ├── detectors/
│   │   │   └── dify.ts        # 本地服务并发检测
│   │   ├── routes/             # Express 路由
│   │   │   ├── dify.ts        #   /api/dify
│   │   │   ├── channels.ts     #   /api/channels
│   │   │   ├── config.ts       #   /api/config
│   │   │   └── webhook.ts     #   /api/webhook（新增）
│   │   ├── config/
│   │   │   └── store.ts       # JSON 配置存储
│   │   ├── utils/
│   │   │   ├── logger.ts       # 日志（含敏感字段脱敏）
│   │   │   └── auth.ts         # Bearer Token 认证中间件（新增）
│   │   └── types/             # TypeScript 类型定义
│   └── dist/                   # 构建输出
│
├── frontend/                   # 前端（React 18 + Vite）
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── DifyPage.tsx   #   Dify 实例管理
│   │   │   ├── ChannelsPage.tsx  #   渠道管理（含 Dify 绑定）
│   │   │   ├── DetectPage.tsx #   服务检测
│   │   │   └── SettingsPage.tsx  #   设置页面
│   │   ├── api/               # API 调用层（含 auth interceptor）
│   │   ├── types/             # TypeScript 类型
│   │   ├── App.tsx            # 主应用路由
│   │   └── main.tsx           # 入口
│   └── dist/                   # 构建输出
│
├── data/                       # 运行时数据（自动创建）
│   ├── config.json             #   持久化配置
│   └── gateway.pid             #   进程 PID 文件
├── scripts/                    # 辅助脚本
│   ├── install.sh              # 一键安装脚本
│   └── openlink-gateway.service  # systemd 服务配置
└── package.json                # Monorepo 根配置（workspaces）
```

---

## API 接口文档

### 系统端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 服务健康状态 |
| GET | `/` | 服务信息与端点列表 |

### Dify 实例管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/dify` | 获取所有已配置实例 |
| POST | `/api/dify` | 添加新实例 |
| PUT | `/api/dify/:id` | 更新实例 |
| DELETE | `/api/dify/:id` | 删除实例 |
| POST | `/api/dify/:id/test` | 测试连接可用性 |
| GET | `/api/dify/:id/apps` | 获取实例的应用列表 |
| POST | `/api/dify/:id/chat` | 发送对话消息（需 appApiKey） |
| GET | `/api/dify/detect` | 并发检测本地 Dify 服务 |

### 渠道管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/channels` | 获取所有渠道 |
| POST | `/api/channels` | 添加新渠道（需 difyInstanceId + difyAppId） |
| PUT | `/api/channels/:id` | 更新渠道 |
| DELETE | `/api/channels/:id` | 删除渠道 |
| POST | `/api/channels/:id/test` | 测试连接 |
| GET | `/api/channels/:id/bot` | 获取机器人信息 |
| POST | `/api/channels/:id/appApiKey` | 设置应用的 API Key |
| GET | `/api/channels/:id/webhookUrl` | 获取 Webhook 回调地址 |

### Webhook 接入（免认证）

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/webhook/dingtalk/:channelId` | 钉钉消息接收端点 |
| POST | `/api/webhook/feishu/:channelId` | 飞书消息接收端点 |
| POST | `/api/webhook/:channelId` | 通用端点（自动按平台路由） |

### 网关配置

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/config` | 获取网关配置 |
| PUT | `/api/config` | 更新网关配置（可设置 authToken） |
| POST | `/api/config/reset` | 重置为默认值（需 `{ "confirm": true }`） |
| GET | `/api/config/all` | 导出全部配置 |

---

## 认证说明

管理 API（`/api/dify`、`/api/channels`、`/api/config`）支持可选的 Bearer Token 认证：

1. 在「设置」页面或 via API 设置 `gateway.authToken`
2. 前端会自动从 `localStorage['openlink_auth_token']` 读取并附加到请求头
3. Webhook 端点（`/api/webhook/*`）**不需要认证**（平台回调无法携带自定义 header）
4. 不设 `authToken` 时为开放模式（无认证）

---

## curl 请求示例

```bash
# 添加 Dify 实例
curl -X POST http://localhost:3000/api/dify \
  -H "Content-Type: application/json" \
  -d '{
    "name": "本地Dify",
    "baseUrl": "http://127.0.0.1:8000",
    "apiKey": "app-xxxxxxxxxxxx"
  }'

# 添加渠道（绑定 Dify 实例和应用）
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "dingtalk",
    "name": "钉钉客服",
    "difyInstanceId": "<实例ID>",
    "difyAppId": "<应用ID>",
    "appApiKey": "app-xxxxxxxxxxxx",
    "config": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret"
    }
  }'

# 设置渠道的 App API Key
curl -X POST http://localhost:3000/api/channels/<channelId>/appApiKey \
  -H "Content-Type: application/json" \
  -d '{"appApiKey": "app-xxxxxxxxxxxx"}'

# 发送对话消息
curl -X POST http://localhost:3000/api/dify/<instanceId>/chat \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "<应用ID>",
    "message": "你好，请介绍一下这个项目",
    "appApiKey": "app-xxxxxxxxxxxx"
  }'
```

---

## 常见问题

### 1. 如何修改端口？

编辑 `data/config.json` 中的 `gateway.port`，或通过 API：

```bash
curl -X PUT http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"port": 8080}'
```

然后重启服务。

### 2. 日志中看到 `***` 是什么？

这是正常的——logger 会自动将 `apiKey`、`secret`、`token` 等敏感字段替换为 `***`，防止密钥泄露到日志文件。

### 3. 机器人无法接收消息？

检查：
1. Webhook URL 是否填到平台后台（钉钉/飞书）
2. 服务器防火墙是否开放了 3000 端口
3. 渠道的 `enabled` 是否为 `true`
4. 后端日志是否有 Webhook 请求记录

### 4. 如何完全重置配置？

```bash
npm run gateway:stop
rm data/config.json
npm run gateway:start
```

---

## License

MIT License
