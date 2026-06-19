# OpenLink Gateway

AI 网关服务，用于连接 Dify 知识库与钉钉、飞书等平台机器人。

参考 OpenClaw 的设计理念，提供类似的命令行工具和服务管理能力。

## 功能特性

- **Dify 实例管理** - 配置和管理多个 Dify API 实例
- **本地服务检测** - 自动扫描本地网络中的 Dify 服务
- **多平台机器人** - 支持钉钉、飞书等平台机器人集成
- **Web 配置界面** - 直观的网页管理界面
- **可扩展架构** - 易于添加更多知识库源和平台机器人
- **守护进程模式** - 后台运行，自动重启
- **日志管理** - 结构化日志，支持实时查看
- **进程管理** - PID 文件管理，优雅启动/停止

## 快速开始

### 方案一：一行命令安装（推荐）

```bash
bash /path/to/repo/scripts/install.sh

# 或者从远程安装（需要 GitHub 连接）
curl -fsSL https://raw.githubusercontent.com/your-org/openlink-gateway/main/scripts/install.sh | bash
```

### 方案二：手动安装

#### 前置要求

- **Node.js >= 18**
- **npm >= 9**

#### 安装步骤

```bash
# 1. 进入项目目录
cd /workspace

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 启动网关（后台运行）
./openlink start --daemon

# 5. 查看状态
./openlink status

# 6. 查看日志
./openlink logs --tail
```

启动后访问以下地址：
- **Web UI**: http://localhost:3000/ui/
- **API**: http://localhost:3000/api
- **健康检查**: http://localhost:3000/health

## 命令行工具 (openlink)

### 常用命令

```bash
./openlink install              # 安装依赖并构建
./openlink start --daemon       # 后台启动网关
./openlink start                # 前台启动网关
./openlink stop                 # 停止网关
./openlink restart              # 重启网关
./openlink status               # 查看状态
./openlink logs --tail          # 实时查看日志
./openlink logs --lines 100     # 查看最后 100 行日志
./openlink config --help        # 查看配置命令
./openlink dev                  # 开发模式（带热重载）
./openlink build                # 构建前端和后端
./openlink --help               # 查看所有命令
```

### 也可以使用 npm scripts

```bash
npm run start:daemon            # 等同于 openlink start --daemon
npm run stop                    # 等同于 openlink stop
npm run status                  # 等同于 openlink status
npm run logs                    # 等同于 openlink logs --tail
npm run restart                 # 等同于 openlink restart
npm run dev                     # 开发模式
npm run build                   # 构建
```

## 项目结构

```
openlink-gateway/
├── openlink                    # 命令行入口脚本
├── package.json                # 根 package（workspaces）
│
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── index.ts           # HTTP 服务器入口
│   │   ├── cli/
│   │   │   ├── openlink.ts    # CLI 主入口
│   │   │   └── process-manager.ts  # 进程管理
│   │   ├── services/           # 业务服务
│   │   │   ├── dify.ts        #   Dify API 调用
│   │   │   ├── dingtalk.ts    #   钉钉机器人
│   │   │   └── feishu.ts      #   飞书机器人
│   │   ├── detectors/
│   │   │   └── dify.ts        # 本地服务检测
│   │   ├── routes/             # Express 路由
│   │   │   ├── dify.ts        #   /api/dify
│   │   │   ├── channels.ts    #   /api/channels
│   │   │   └── config.ts      #   /api/config
│   │   ├── config/
│   │   │   └── store.ts       # JSON 配置存储
│   │   ├── utils/
│   │   │   └── logger.ts      # 日志工具
│   │   └── types/             # TypeScript 类型
│   └── package.json
│
├── frontend/                   # 前端 Web 界面
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── DifyPage.tsx   #   Dify 实例管理
│   │   │   ├── ChannelsPage.tsx  #   频道管理
│   │   │   ├── DetectPage.tsx #   服务检测
│   │   │   └── SettingsPage.tsx  #   设置页面
│   │   ├── components/         # 组件
│   │   ├── api/               # API 调用
│   │   ├── types/             # TypeScript 类型
│   │   ├── App.tsx            # 主应用
│   │   ├── main.tsx           # 入口
│   │   └── index.css           # 样式
│   └── package.json
│
├── scripts/                    # 辅助脚本
│   ├── install.sh              # 一键安装脚本
│   └── openlink-gateway.service  # systemd 服务配置
│
└── data/                       # 运行时数据（运行后自动创建）
    ├── config.json             #   持久化配置
    ├── gateway.pid             #   进程 PID 文件
    └── gateway.log             #   运行日志
```

## API 接口文档

### 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 服务健康状态 |
| GET | `/` | 服务信息与端点列表 |
| GET | `/ui/` | Web 管理界面 |

### Dify 实例管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/dify` | 获取所有已配置实例 |
| POST | `/api/dify` | 添加新实例 |
| PUT | `/api/dify/:id` | 更新实例 |
| DELETE | `/api/dify/:id` | 删除实例 |
| POST | `/api/dify/:id/test` | 测试连接可用性 |
| GET | `/api/dify/:id/apps` | 获取实例的应用列表 |
| POST | `/api/dify/:id/chat` | 发送对话消息 |
| GET | `/api/dify/detect` | 检测本地运行的 Dify 服务 |

### 频道管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/channels` | 获取所有频道 |
| POST | `/api/channels` | 添加新频道 |
| PUT | `/api/channels/:id` | 更新频道 |
| DELETE | `/api/channels/:id` | 删除频道 |
| POST | `/api/channels/:id/test` | 测试连接 |

### 网关配置

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/config` | 获取网关配置 |
| PUT | `/api/config` | 更新网关配置 |
| POST | `/api/config/reset` | 重置为默认值 |
| GET | `/api/config/all` | 导出全部配置 |

### 请求示例

```bash
# 添加 Dify 实例
curl -X POST http://localhost:3000/api/dify \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "本地 Dify",
    "baseUrl": "http://127.0.0.1",
    "apiKey": "app-your-api-key"
  }'

# 添加钉钉频道
curl -X POST http://localhost:3000/api/channels \
  -H 'Content-Type: application/json' \
  -d '{
    "platform": "dingtalk",
    "name": "钉钉客服机器人",
    "config": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret"
    }
  }'

# 发送对话消息
curl -X POST http://localhost:3000/api/dify/<instance-id>/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "你好，请介绍一下这个项目"
  }'
```

## 配置说明

### Dify 实例配置

```json
{
  "name": "生产环境 Dify",
  "baseUrl": "http://dify.example.com",
  "apiKey": "app-your-api-key-here"
}
```

### 钉钉频道配置

```json
{
  "platform": "dingtalk",
  "name": "客服机器人",
  "config": {
    "clientId": "dingding-client-id",
    "clientSecret": "dingding-client-secret",
    "botAppId": "optional-bot-app-id"
  }
}
```

### 飞书频道配置

```json
{
  "platform": "feishu",
  "name": "内部机器人",
  "config": {
    "appId": "cli_your_app_id",
    "appSecret": "your-app-secret"
  }
}
```

### 网关配置（/api/config）

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "corsOrigins": [
    "http://localhost:5173",
    "http://localhost:3001"
  ],
  "logLevel": "info"
}
```

## 扩展开发

### 添加新的知识库源

1. 在 `backend/src/services/` 创建新的服务类
2. 在 `backend/src/detectors/` 添加服务检测逻辑
3. 在 `backend/src/routes/` 添加对应的路由
4. 前端添加对应的页面组件

### 添加新的平台机器人

1. 在 `backend/src/services/` 创建新的服务类（参考 `feishu.ts`）
2. 更新 `frontend/src/pages/ChannelsPage.tsx` 添加表单支持
3. 更新类型定义 `frontend/src/types/index.ts`

### systemd 部署（Linux 服务器）

```bash
# 1. 将项目部署到服务器，例如 /opt/openlink-gateway
cd /opt && git clone <your-repo-url> openlink-gateway

# 2. 安装依赖并构建
cd openlink-gateway && npm install && npm run build

# 3. 安装 systemd 服务
sudo cp scripts/openlink-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload

# 4. 启动服务
sudo systemctl enable openlink-gateway
sudo systemctl start openlink-gateway

# 5. 查看状态
sudo systemctl status openlink-gateway
journalctl -u openlink-gateway -f
```

## 开发模式

```bash
# 开发模式（前后端同时运行，带热重载）
./openlink dev

# 或者分别运行
# 终端 1：后端
npm run dev -w backend

# 终端 2：前端
npm run dev -w frontend
```

- 后端开发地址: http://localhost:3000
- 前端开发地址: http://localhost:5173（通过 Vite 代理 API 请求）

## 常见问题

### 1. 如何修改端口？

```bash
./openlink config port 8080
# 或者通过 API
curl -X PUT http://localhost:3000/api/config \
  -H 'Content-Type: application/json' \
  -d '{"port": 8080}'

# 然后重启
./openlink restart
```

### 2. 找不到本地 Dify？

确保 Dify 在本地运行，常见端口有 80, 3000, 8000。使用 `./openlink status` 下的检测功能来自动扫描。

### 3. 如何完全重置配置？

```bash
./openlink stop
rm -rf /workspace/data
./openlink start --daemon
```

### 4. 机器人无法接收消息？

检查：
1. 平台 API Key 是否正确
2. 钉钉/飞书的回调 URL 是否可访问
3. 服务是否有权限访问外部网络

## License

MIT License
