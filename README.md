# Grainmap - 照片地图应用

Grainmap 是一个桌面应用，让你可以在地图上标记和记录你的照片故事。

## 功能特性

- 🗺️ **高德地图集成** - 使用高德地图API，默认显示海南省地图
- 📸 **照片管理** - 上传本地照片并与地图位置关联
- 🔄 **双向联动** - 点击侧边栏照片自动定位到地图位置，点击地图标记显示照片详情
- 🤖 **AI文案生成** - 集成 OpenAI、Claude 等 LLM 为照片生成诗词或介绍
- 👤 **用户系统** - 注册登录，数据隔离
- 💾 **本地存储** - 所有数据存储在本地 SQLite 数据库
- 📤 **数据导出/导入** - 支持备份和恢复数据，方便分享照片集合
- 🖥️ **跨平台** - 支持 Windows 和 macOS
- 📖 **安装指引** - 首次启动时提供图文并茂的安装向导

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **桌面框架**: Electron
- **地图**: 高德地图 JavaScript API
- **数据库**: SQLite (better-sqlite3)
- **构建工具**: Vite

## 项目结构

```
grainmap/
├── electron/              # Electron 主进程
│   ├── main.ts           # 主进程入口
│   ├── preload.ts        # 预加载脚本
│   ├── database.ts       # 数据库操作
│   └── tsconfig.json     # Electron TypeScript 配置
├── src/                  # 前端源代码
│   ├── components/       # React 组件
│   ├── pages/           # 页面组件
│   ├── types/           # TypeScript 类型定义
│   ├── App.tsx          # 应用入口
│   ├── main.tsx         # React 入口
│   └── index.css        # 全局样式
├── package.json         # 项目配置
├── vite.config.ts       # Vite 配置
├── tailwind.config.js   # Tailwind CSS 配置
└── tsconfig.json        # TypeScript 配置
```

## 安装和运行

### 前置要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动 Vite 开发服务器
npm run dev

# 启动 Electron（在另一个终端）
npm run electron:dev
```

### 构建应用

```bash
# 构建前端
npm run build

# 构建 Electron
npm run build:electron

# 打包应用（macOS）
npm run dist:mac

# 打包应用（Windows）
npm run dist:win
```

## 配置高德地图 API Key

在 `src/pages/Map.tsx` 中，将 `YOUR_AMAP_KEY` 替换为你的高德地图 API Key：

```typescript
const AMap = await AMapLoader.load({
  key: '你的高德地图API Key',
  version: '2.0',
  plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geocoder'],
});
```

获取 API Key: https://lbs.amap.com/

## 配置 AI 文案生成

1. 在设置页面选择 AI 提供商（OpenAI、Claude 或自定义 API）
2. 输入 API Key
3. 可选：自定义 API URL 和模型

支持的提供商：
- **OpenAI**: GPT-3.5-turbo, GPT-4 等
- **Claude**: Claude 3 Haiku, Sonnet, Opus 等
- **自定义**: 任何兼容 OpenAI API 格式的服务

## 数据存储

- **数据库**: `~/Library/Application Support/grainmap/grainmap.db` (macOS)
- **照片**: `~/Library/Application Support/grainmap/photos/{userId}/`

## 开发计划

- [x] 基础项目架构
- [x] 用户认证系统
- [x] 高德地图集成
- [x] 照片上传和标记
- [x] AI 文案生成
- [x] 数据导出/导入
- [x] 安装指引
- [x] 照片浏览体验优化
- [x] 分享功能
- [ ] 照片 EXIF 信息读取
- [ ] 地图样式自定义
- [ ] 批量导入照片

## License

MIT
