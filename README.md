![](https://i0.hdslb.com/bfs/openplatform/d7548cc01e52b901380df4464022c2b7502b058e.png)
![](https://i0.hdslb.com/bfs/openplatform/4b88a1958038dfbafdad66566e2419c76513203a.png)
![](https://i0.hdslb.com/bfs/openplatform/e64530b5f4af8ca29ff539669f723254f900c282.png)

# Jira Bug Dashboard

这是一个高度定制化的 Jira Bug 管理看板，旨在提供比原版 Jira 更丝滑、直观的交互体验。

## 🚀 技术栈 (Technology Stack)

项目采用了现代化的前端技术栈，遵循高效、高性能和极简主义的设计原则：

- **项目架构**: 基于 **PNPM Monorepo** 管理，使用 **PNPM Catalogs** 统一控制依赖版本。
- **核心框架**: **Vue 3** (Composition API, `<script setup>`) + **TypeScript**。
- **构建工具**: **Vite 6**。
- **样式方案**: **UnoCSS** (即时原子化 CSS 引擎)，支持深色模式与响应式设计。
- **状态管理**: **Pinia**。
- **工具库**: **VueUse**,  **Vue I18n** (支持 ZH/EN)。
- **图标系统**: **Iconify** (本地化图标库安装，无网络依赖)。
- **规范审计**: **@antfu/eslint-config** + **simple-git-hooks**。

## ✨ 主要功能 (Key Features)

- 🎯 **个性化看板**: 专门展示与用户相关的 Jira Issue，支持多项目过滤。
- ⭐ **待办列表 (Todo List)**: 快捷星标功能，支持 LocalStorage 持久化任务清单。
- ⚡ **快捷流转**: 卡片式一键状态流转，内置二次确认安全保障。
- 👤 **智能人员分配**: 包含搜索功能的经办人选择，支持特定的显示名称映射
- 🔍 **深度详情**: 完整的 Issue 描述解析、评论互动及附件预览。
- 🌓 **极质视觉**: 完美适配深色模式，采用玻璃拟态 (Glassmorphism) 设计风格，流畅的动效反馈。