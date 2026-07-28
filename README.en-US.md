# JavdbBuddy (Javdb All-in-One Assistant)

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/86168057/JavdbBuddy/releases)
[![Greasy Fork](https://img.shields.io/badge/Greasy%20Fork-JavdbBuddy-orange)](https://greasyfork.org/scripts/564141)

A one-stop enhancement Tampermonkey userscript for JAVDB. It integrates Emby / Jellyfin library status synchronization, preview image viewing, magnet link management, multi-site quick search, VIP-bypass for Hot/Top250/FC2PPV, all reviews, related lists, and more.

---

## ✨ Features

| Feature | Description |
|------|------|
| 📋 **Emby / Jellyfin Library Status** | Real-time display of movie availability in Emby / Jellyfin servers on list and detail pages |
| 🖼️ **Preview Image Viewer** | One-click popup to view all preview images with full-screen browsing support |
| 🧲 **Magnet Link Management** | JAVDB + JAVBUS dual-tab magnet link popup with copy/download support |
| 👩 **Actress List** | Complete actress list displayed at the top of preview/magnet popups with clickable links |
| 🔍 **Multi-site Search** | One-click search on detail pages for 98Tang, BTSOW, JAVDB, JAVBUS, and Google |
| ⬆ **Back to Top/Bottom** | Floating buttons in the bottom right for quick page navigation |
| 📝 **Short Review Viewer** | One-click viewing of movie short reviews (requires JAVDB login) |
| 🔥 **VIP-Bypass Hot** | Access the Hot list without a VIP account |
| 🏆 **VIP-Bypass Top250** | Access the Top250 list without a VIP account |
| 🎥 **VIP-Bypass FC2PPV** | Access FC2PPV content without a VIP account |
| 💬 **All Reviews** | Load all reviews on the detail page |
| 📑 **Related Lists** | View related lists without a VIP account |
| 🖱️ **Cover Hover Zoom** | Automatic enlargement of cover images when hovering on the list page |

---

## 📦 Installation

### Method 1: Greasy Fork (Recommended)
Go to the [Greasy Fork page](https://greasyfork.org/scripts/564141) and click install.

### Method 2: GitHub Releases
Download the latest version from the [Releases page](https://github.com/86168057/JavdbBuddy/releases) and install via "Import from file" in Tampermonkey.

### Method 3: Manual Installation
1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open [JavdbBuddy_v1.0.0.js](https://github.com/86168057/JavdbBuddy/raw/main/JavdbBuddy_v1.0.0.js).
3. Tampermonkey will automatically prompt you to install.

---

## 🚀 Usage

### List Page

![List Page Quick Button Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/列表页快捷按钮效果展示.png)

- **Blue Button 🖼️ Preview**: Click to open the preview image popup.
- **Pink Button 🧲 Magnet**: Click to open the JAVDB + JAVBUS dual-tab magnet link popup.
- **Orange Button 📝 Short Review**: Click to retrieve movie short reviews.

![List Page Preview + Actress Name Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/列表页-预览图+演员名字-快捷键内容展示.png)

![List Page Magnet Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/列表页-磁力链-快捷键内容展示.png)

![List Page Short Review Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/列表页-短评-快捷键内容展示.png)

![List Page Cover Hover Zoom Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/列表页-封面图-鼠标悬停图片放大功能展示.png)

### Detail Page

![Detail Page Emby Status + Multi-site Search Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/详情页emby入库状态标签+中多网站搜索功能展示.png)

- **Emby / Jellyfin Status Tag**: Displays the library status of the movie in Emby / Jellyfin.
- **Multi-site Search Buttons**: Search for the movie across multiple platforms with one click.

![Detail Page Dual-tab Magnet Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/详情页-javdb+javbus-双标签磁力页展示.png)

- **JAVDB / JAVBUS Tabs**: Click to switch between magnet link lists from different sources.

![Detail Page Load All Reviews Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/详情页-短评-功能加载全部评论的功能展示.png)

![Detail Page VIP-Bypass Related Lists Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/详情页-相关清单-免vip功能展示.png)

### Super Feature Tabs

![Super Feature Hot VIP-Bypass Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/超级功能标签下的热播免VIP功能展示.png)

![Super Feature Top250 VIP-Bypass Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/超级功能标签下的top250免VIP功能展示.png)

![Super Feature FC2 VIP-Bypass Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/超级功能标签下的FC2免VIP功能展示.png)

### Settings Interface

![Settings General Interface Demo](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/展示图/设置中-通用设置-界面展示.png)

---

## 🔧 Media Server Configuration

1. Click the ⚙️ settings button in the bottom right of the page.
2. Select server type (Emby / Jellyfin) and enter the Name, Address, and API Key (supports multiple servers).
3. Click the "Sync Server" button; the script will automatically scan the media library to build an index.
4. Done! The list and detail pages will now show the Emby / Jellyfin library status.

---

## 📄 Script Info

- **Script Name**: JavdbBuddy (Javdb全能助手)
- **Version**: 1.0.0
- **Target Site**: javdb.com
- **Dependencies**: Requires a userscript manager like Tampermonkey / Violentmonkey.
- **License**: MIT License

---

## 🤝 Contribution

Issues and Pull Requests are welcome!

---

## 💖 Sponsorship

If this script helps you, feel free to support the developer:

| WeChat | Alipay |
|------|--------|
| ![WeChat QR](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/收款二维码/微信收款二维码.png) | ![Alipay QR](https://raw.githubusercontent.com/86168057/JavdbBuddy/main/收款二维码/支付宝收款二维码.png) |

---

## 📜 Changelog

### v1.0.0
- ✨ Added: Subtitle search and download (one-click Chinese subtitle search on list/detail pages with popup and direct download support).
- ✨ Added: "Subtitle" shortcut button on list page.
- ✨ Added: Subtitle match filtering and dark mode adaptation for detail pages.
- 🔧 Optimized: List page button layout now adapts to browser window size.

### v0.9.0
- ✨ Added: "Copy ID" shortcut on list page.
- ✨ Added: Caoliao Community search (Google site search).
- ✨ Added: Independent toggle for Emby / Jellyfin status tags.
- ✨ Added: Real-time polling for server connection status (automatic detection of server online/offline).
- ✨ Added: Full adaptation for site dark mode (Auto / System / Manual).
- 🔧 Optimized: Simplified status tag text ("Cannot Connect", "Not Added").
- 🔧 Optimized: Fixed list page status tag and date displaying on the same line.
- 🔧 Optimized: Fixed duplicate search buttons on detail page.
- 🔧 Optimized: Fixed tags disappearing when toggling switches.

### v0.8.0
- ✨ Added: **Jellyfin Server Support** — Real-time library status sync, supporting Emby and Jellyfin side-by-side.
- ✨ Added: Emby / Jellyfin data backup and recovery (supports custom backup paths and password encryption).
- ✨ Added: Display of item count for Emby / Jellyfin status badges on list/detail pages.
- ✨ Added: Settings interface now supports theme preview and server configuration testing.
- ✨ Added: Real-time synchronization — Page status updates automatically when media is added/removed from the server without manual refresh.
- ✨ Added: General Settings — Support for opening detail pages in new windows/popups, cover hover zoom, etc.
- 🔧 Optimized: JAVBUS now displays "No Data" and a badge count of 0 when no data is found.
- 🔧 Optimized: Back to top/bottom and settings buttons now appear earlier to avoid loading delays.
- 🔧 Optimized: Simplified Cloudflare detection logic to avoid false positives.
- 🔧 Optimized: Fixed occasional click errors on settings button.
- 🔧 Optimized: Fixed issue where backup path selection failed.

### v0.7.0
- ✨ Added: Multi-site search function.
- ✨ Added: VIP-bypass for Hot/Top250/FC2PPV.
- ✨ Added: Load all reviews function.
- ✨ Added: VIP-bypass for related lists.
- ✨ Added: Cover image hover zoom on list page.
- 🔧 Optimized: Comprehensive update of demonstration images.

### v0.6.0
- ✨ Added: Actor list color-coded by gender (Blue for male, Pink for female).
- ✨ Added: Automatic page refresh for library status after Emby sync.
- 🔧 Optimized: Popups no longer cause the page to jump back to the top.
- 🔧 Optimized: Specific reasons for retrieval failure are now displayed (Login / Auth / Timeout, etc.).
- 🔧 Optimized: Reduced request frequency to minimize Cloudflare challenges.
- 🔧 Optimized: Cached preview/magnet data + direct DOM extraction on detail pages (reducing extra requests).

### v0.5.0
- 🔧 Optimized: Script name changed to "JavdbBuddy" (Javdb全能助手), updated descriptions.
- 🔧 Optimized: Changed README image paths to GitHub absolute URLs.
- 🔧 Optimized: Added English @description.

### v0.4.1
- 🔧 Optimized: Script name changed to "JavdbBuddy" (Javdb全能助手), updated descriptions.
- 🔧 Optimized: Changed README image paths to GitHub absolute URLs.

### v0.4.0
- 🔧 Optimized: Repository renamed to JavdbBuddy, all link addresses updated.

### v0.3.0
- ✨ Added: Short review viewer (📝 button on list page).
- ✨ Added: Floating back to top/bottom buttons.
- ✨ Added: Integration of actor lists in preview/magnet popups.
- 🔧 Optimized: Accelerated caching for JAVDB/JAVBUS magnet links.
- 🎨 Optimized: Adaptive layout for list page buttons.

### v0.2.0
- ✨ Added: JAVDB + JAVBUS dual-tab magnet link popup.
- ✨ Added: Dual-tab magnet links on detail page.
- 🔧 Optimized: Magnet link data parsing compatibility.

### v0.1.0
- 🎉 First version release.
- ✨ Basic Emby library status display.
- ✨ Preview image viewer.
- ✨ Multi-site search function.
