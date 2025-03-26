# Todo List 应用

一个简单但功能完整的待办事项(Todo List)应用，使用现代前端技术栈构建，并可打包为桌面应用程序。

## 功能特点

- 添加新的待办事项
- 标记待办事项为已完成/未完成
- 删除待办事项
- 美观的UI界面和动画效果
- 响应式设计，适应不同屏幕尺寸
- 可作为桌面应用程序使用

## 技术栈

- **前端框架**: Vue 3
- **构建工具**: Vite
- **桌面应用框架**: Electron
- **打包工具**: Electron Builder
- **样式**: 纯CSS（无第三方UI库）

## 安装与使用

### 安装依赖

```bash
npm install
```

### 开发模式

启动前端开发服务器:

```bash
npm run dev
```

运行Electron应用（开发模式）:

```bash
npm run electron:dev
```

### 打包应用

构建生产版本:

```bash
npm run electron:build
```

打包后的文件将生成在 `dist_electron` 目录下:
- 安装程序: `Todo List-Setup-0.0.0.exe`
- 免安装版: `win-unpacked` 目录中的 `Todo List.exe`

## 项目结构

```
todolist/
├── dist/                 # 前端构建输出目录
├── dist_electron/        # Electron打包输出目录
├── electron/             # Electron主进程代码
│   └── main.js           # Electron入口文件
├── public/               # 公共资源
├── src/                  # 源代码
│   ├── assets/           # 静态资源
│   ├── components/       # 组件
│   │   └── TodoList.vue  # 待办事项列表组件
│   ├── App.vue           # 根组件
│   ├── main.js           # 前端入口
│   └── style.css         # 全局样式
├── index.html            # HTML模板
├── package.json          # 项目配置
└── vite.config.js        # Vite配置
```

## 使用方法

1. 在输入框中输入待办事项，按回车或点击"添加"按钮添加新项目
2. 点击复选框标记项目为已完成/未完成
3. 点击"×"按钮删除项目

## 开发者

您的名字 <your.email@example.com>

## 许可证

MIT
