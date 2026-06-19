# OpenLink Gateway

AI 网关服务，用于连接 Dify 知识库与钉钉、飞书等平台机器人。

## 功能特性

- **Dify 实例管理** - 配置和管理多个 Dify API 实例
- **本地服务检测** - 自动扫描本地网络中的 Dify 服务
- **多平台机器人** - 支持钉钉、飞书等平台机器人集成
- **Web 配置界面** - 直观的网页管理界面
- **可扩展架构** - 易于添加更多知识库和平台支持

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: React + TypeScript + Vite
- **配置存储**: JSON 文件本地存储

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

这将同时启动后端 (http://localhost:3000) 和前端 (http://localhost:5173)。

### 生产构建

```bash
npm run build
npm run start
```

## 项目结构

```
openlink-gateway/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置管理
│   │   ├── detectors/      # 服务检测
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务服务
│   │   ├── types/          # TypeScript 类型
│   │   └── utils/          # 工具函数
│   └── package.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── api/           # API 调用
│   │   ├── pages/         # 页面组件
│   │   └── types/         # 类型定义
│   └── package.json
└── package.json           # 工作区配置
```

## API 接口

### Dify 实例

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/dify | 获取所有实例 |
| POST | /api/dify | 添加新实例 |
| PUT | /api/dify/:id | 更新实例 |
| DELETE | /api/dify/:id | 删除实例 |
| POST | /api/dify/:id/test | 测试连接 |
| GET | /api/dify/:id/apps | 获取应用列表 |
| POST | /api/dify/:id/chat | 发送对话消息 |
| GET | /api/dify/detect | 检测本地服务 |

### 频道管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/channels | 获取所有频道 |
| POST | /api/channels | 添加新频道 |
| PUT | /api/channels/:id | 更新频道 |
| DELETE | /api/channels/:id | 删除频道 |
| POST | /api/channels/:id/test | 测试连接 |

### 系统配置

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/config | 获取配置 |
| PUT | /api/config | 更新配置 |
| GET | /api/config/all | 导出所有配置 |
| POST | /api/config/reset | 重置配置 |

## 配置说明

### Dify 实例配置

```json
{
  "name": "本地 Dify",
  "baseUrl": "http://localhost:80",
  "apiKey": "app-xxxxxxx"
}
```

### 钉钉频道配置

```json
{
  "platform": "dingtalk",
  "name": "测试机器人",
  "config": {
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "botAppId": "your-bot-app-id"
  }
}
```

### 飞书频道配置

```json
{
  "platform": "feishu",
  "name": "测试机器人",
  "config": {
    "appId": "your-app-id",
    "appSecret": "your-app-secret"
  }
}
```

## 扩展开发

### 添加新的知识库

1. 在 `backend/src/services/` 创建新的服务类
2. 在 `backend/src/detectors/` 添加服务检测逻辑
3. 在 `backend/src/routes/` 添加对应的路由

### 添加新的平台机器人

1. 在 `backend/src/services/` 创建新的服务类
2. 更新 `frontend/src/pages/ChannelsPage.tsx` 添加表单支持
3. 更新类型定义

## License

MIT
