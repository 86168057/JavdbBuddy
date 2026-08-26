# JavdbBuddy — Javdb 全能助手

> JAVDB 一站式增强 Tampermonkey 用户脚本，集成 Emby / Jellyfin 入库状态同步、预览图查看、磁力链管理、多站点快捷搜索、免 VIP 热播/Top250/FC2PPV、全部评论、相关清单等功能。

[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-564141-brightgreen)](https://greasyfork.org/scripts/564141)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/86168057/JavdbBuddy)](https://github.com/86168057/JavdbBuddy)

---

## ✨ 功能特性

| 分类 | 功能 |
|------|------|
| **Emby / Jellyfin** | 详情页 & 列表页实时显示入库状态标签，一键跳转 Emby/Jellyfin 播放 |
| **预览图** | 列表页鼠标悬停放大封面图，详情页内嵌预览视频 |
| **磁力链管理** | 详情页双标签磁力页（JavDB + JavBus），列表页快捷按钮一键复制/跳转 |
| **多站点搜索** | 详情页一键搜索多个站点（JavDB、JavBus、MissAV 等） |
| **免 VIP 功能** | 热播排行、Top250、FC2PPV 免 VIP 查看 |
| **全部评论** | 突破限制加载所有评论 |
| **相关清单** | 免 VIP 查看相关清单 |
| **超级功能** | 导航栏集成「排行榜」快捷入口（热播 / Top250 / FC2） |
| **浮动按钮** | 返回顶部 ⬆ / 翻到底部 ⬇ 快捷浮动按钮 |
| **识图搜索** | 支持点击/拖拽/粘贴上传图片进行 Google 以图搜图 |
| **播放器模式** | MissAV / Jable 直链播放器 + HLS.js 播放器 |
| **在线搜索** | 多站点快捷搜索，支持番号一键跳转 |

## 📸 功能展示

<details>
<summary>点击展开截图</summary>

### 列表页
- 封面图悬停放大
- 磁力链快捷按钮
- 预览图 + 演员名字
- 短评快捷键

### 详情页
- Emby 入库状态标签 + 多网站搜索
- 双标签磁力页（JavDB + JavBus）
- 全部评论加载
- 相关清单免 VIP

### 超级功能
- 热播免 VIP
- Top250 免 VIP
- FC2 免 VIP

### 设置
- 通用设置界面

</details>

## 🚀 安装

### 前置要求

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展（Chrome / Firefox / Edge / Safari）
2. 确保 Tampermonkey 已启用

### 方式一：Greasy Fork 安装（推荐）

👉 [点击安装脚本](https://greasyfork.org/scripts/564141)

### 方式二：GitHub 直接安装

👉 [点击安装脚本](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/JavdbBuddy.user.js)

### 方式三：手动安装

1. 打开 Tampermonkey 控制面板
2. 点击「添加新脚本」
3. 将 `JavdbBuddy.user.js` 的全部内容粘贴进去
4. 保存

## ⚙️ 配置

安装后在 JavDB 页面右上角会出现 **⚙️ 设置** 按钮，点击可进入设置面板：

- **Emby / Jellyfin** — 填写服务器地址和 API Key，即可同步入库状态
- **预览图** — 开启/关闭列表页封面悬停放大
- **磁力链** — 配置磁力链显示和复制行为
- **搜索站点** — 自定义快捷搜索的站点列表
- **播放器** — 配置直链播放和静音策略

## 🌐 支持站点

| 站点 | 域名 | 功能 |
|------|------|------|
| JavDB | javdb.com | 全部功能 |
| JavBus | javbus.com | 磁力链、Cookie 复用 |
| Sehuatang | sehuatang.net | 全部功能 |
| MissAV | missav.ws | 直链播放器、播放器模式 |
| Jable | jable.tv | 直链播放器、播放器模式 |

## 📋 依赖

| 依赖 | 用途 |
|------|------|
| [blueimp-md5](https://github.com/blueimp/JavaScript-MD5) | MD5 哈希计算 |
| [Preact](https://preactjs.com/) | UI 渲染 |
| [GM_xhr more parallel](https://greasyfork.org/scripts/515994) | 增强 GM_xmlhttpRequest 并发能力 |
| [HLS.js](https://github.com/video-dev/hls.js/) | HLS 视频流播放（直链模式） |

## 📄 许可证

[MIT License](LICENSE) — 潇洒公子

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⭐ 支持

如果这个脚本对你有帮助，欢迎给个 Star ⭐ 鼓励一下！
