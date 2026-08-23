// ==UserScript==
// @name         Javdb全能助手
// @name:en      JavdbBuddy
// @namespace    https://github.com/86168057/JavdbBuddy
// @version      1.2.3
// @description  JAVDB 一站式增强 Tampermonkey 用户脚本，集成 Emby / Jellyfin 入库状态同步、预览图查看、磁力链管理、多站点快捷搜索、免VIP热播/Top250/FC2PPV、全部评论、相关清单等功能。
// @description:en  JavdbBuddy - JAVDB All-in-One Assistant: Emby / Jellyfin library sync, preview images, magnet links, multi-site search, Hot/Top250/FC2PPV, all reviews, related lists
// @description:zh-CN  JAVDB + Emby / Jellyfin 联动脚本：实时同步入库状态、预览图查看、磁力链管理、多站点搜索、免VIP热播/Top250/FC2PPV、全部评论、相关清单
// @author       潇洒公子
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMGFjZWE7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM1MmJlODA7c3RvcC1vcGFjaXR5OjEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0idXJsKCNhKSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIwIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SkQ8L3RleHQ+PC9zdmc+
// @match        *://javdb.com/*
// @match        *://*.javdb.com/*
// @match        *://sehuatang.net/*
// @match        *://*.sehuatang.net/*
// @include      *://sehuatang.net/*
// @include      *://*.sehuatang.net/*
// @match        *://missav.ws/*
// @match        *://jable.tv/*
// @match        *://javbus.com/*
// @match        *://www.javbus.com/*

// @require      https://cdnjs.cloudflare.com/ajax/libs/blueimp-md5/2.19.0/js/md5.min.js
// @require      https://update.greasyfork.org/scripts/515994/1478507/gh_2215_make_GM_xhr_more_parallel_again.js
// @require      https://cdn.jsdelivr.net/npm/preact@10.25.4/dist/preact.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_download
// @connect      *
// @connect      localhost
// @connect      jdforrepam.com
// @connect      127.0.0.1
// @connect      192.168.0.0/16
// @connect      10.0.0.0/8
// @connect      172.16.0.0/12
// @connect      subtitlecat.com
// @connect      www.subtitlecat.com
// @connect      missav.ws
// @connect      jable.tv

// @run-at       document-start
// @license      MIT
// @homepage     https://github.com/86168057/JavdbBuddy
// @homepageURL  https://github.com/86168057/JavdbBuddy
// @website      https://github.com/86168057/JavdbBuddy
// @source       https://github.com/86168057/JavdbBuddy/blob/main/JavdbBuddy.user.js
// @supportURL   https://github.com/86168057/JavdbBuddy/issues
// @downloadURL https://raw.githubusercontent.com/86168057/JavdbBuddy/main/JavdbBuddy.user.js
// @updateURL https://raw.githubusercontent.com/86168057/JavdbBuddy/main/JavdbBuddy.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ========== JAVBUS 年龄验证 Cookie 捕获（供 javdb 页跨域请求复用，突破服务端验龄拦截） ==========
    if (location.hostname && location.hostname.indexOf('javbus') !== -1) {
        try {
            if (document.cookie) GM_setValue('jb_javbus_cookie', document.cookie);
        } catch (e) {}
        return; // javbus 页仅捕获 cookie，不执行 javdb 增强逻辑，避免冲突
    }

    // ========== JAVBUS 跨域请求 Cookie 头（优先复用浏览器已通过验龄的真实 cookie） ==========
    var JB_JAVBUS_COOKIE_HEADER = (function () {
        var c = '';
        try { c = GM_getValue('jb_javbus_cookie', ''); } catch (e) {}
        return c ? c : 'existmag=all';
    })();

    // ========== 全局 GM_xmlhttpRequest 并发控制 + 看门狗 ==========
    // 问题：长时间浏览时，预览图/磁力/字幕/无缝翻页/Emby 状态等会同时发起大量 GM_xmlhttpRequest，
    // 打满浏览器与 Tampermonkey 的连接通道后，新请求会一直排队、连超时都不触发，
    // 表现为"浏览一段时间后预览图加载不出来、磁力加载不出来"等所有请求类功能全部失效。
    // 解决：全局限制同时最多 JB_MAX_XHR 个请求，并对每个请求加看门狗——
    // 即使回调因浏览器休眠/扩展限流等原因全部丢失，也会强制释放并发槽位，防止永久卡死。
    let __jbOrigGM = GM_xmlhttpRequest;
    try { __jbOrigGM = GM_xmlhttpRequest.bind({}); } catch (e) {}
    const JB_MAX_XHR = 3;
    let __jbXhrActive = 0;
    const __jbXhrWaiters = [];

    function __jbXhrRun(details) {
        __jbXhrActive++;
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            __jbXhrActive--;
            __jbXhrPump();
        };
        // 看门狗：即使 onload/onerror/ontimeout 全部丢失，也强制释放槽位（防止通道被占满）
        setTimeout(release, 25000);
        const wrap = (cb) => {
            if (typeof cb !== 'function') return cb;
            return function(resp) {
                release();
                return cb.apply(this, arguments);
            };
        };
        const wrapped = Object.assign({}, details);
        wrapped.onload = wrap(details.onload);
        wrapped.onerror = wrap(details.onerror);
        wrapped.ontimeout = wrap(details.ontimeout);
        wrapped.onabort = wrap(details.onabort);
        try { __jbOrigGM(wrapped); } catch (err) { release(); }
    }
    function __jbXhrPump() {
        while (__jbXhrActive < JB_MAX_XHR && __jbXhrWaiters.length > 0) {
            __jbXhrRun(__jbXhrWaiters.shift());
        }
    }
    GM_xmlhttpRequest = function(details) {
        if (__jbXhrActive < JB_MAX_XHR) __jbXhrRun(details);
        else __jbXhrWaiters.push(details);
    };

    // ========== 在线播放器模式：当在播放站点中运行时，隐藏非播放器元素 ==========
    const PLAYER_MODE_SITES = ['missav.ws', 'jable.tv'];
    const _curHost = window.location.hostname;
    const _isPlaySite = PLAYER_MODE_SITES.some(s => _curHost.includes(s));
    const _isPlayerMode = _isPlaySite &&
                          new URLSearchParams(window.location.search).get('jb_player_mode') === '1';
    const _isDirectMode = _isPlaySite &&
                          new URLSearchParams(window.location.search).get('jb_direct_mode') === '1';

    if (_isPlaySite) {
        // ========== 直链模式预处理：在主世界拦截 eval 捕获 m3u8 地址 ==========
        // 必须在 document-start 阶段注入，早于页面脚本执行
        if (_isDirectMode) {
            window.__jb_m3u8_url = null;

            // 通过 unsafeWindow 覆盖主世界的 eval（页面脚本在主世界运行）
            const realWindow = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

            function checkSourceVars() {
                if (realWindow.__jb_m3u8_url) return;
                // MISSAV 把 m3u8 赋值给 source / source1280 / source842
                const vars = ['source', 'source1280', 'source842'];
                for (const v of vars) {
                    const val = realWindow[v];
                    if (val && typeof val === 'string' && val.includes('.m3u8')) {
                        realWindow.__jb_m3u8_url = val;
                        console.log('[JB Direct Mode] 从 ' + v + ' 捕获到 m3u8: ' + val);
                        break;
                    }
                }
            }

            // 覆盖主世界的 eval
            const _origEval = realWindow.eval;
            realWindow.eval = function(code) {
                const result = _origEval.call(this, code);
                checkSourceVars();
                return result;
            };

            // 也覆盖 setTimeout(string) 方式
            const _origSetTimeout = realWindow.setTimeout;
            realWindow.setTimeout = function(code, delay) {
                if (typeof code === 'string') {
                    const result = _origSetTimeout.call(this, function() { realWindow.eval(code); }, delay);
                    checkSourceVars();
                    return result;
                }
                return _origSetTimeout.apply(this, arguments);
            };

            console.log('[JB Direct Mode] 主世界 eval 拦截已就绪');
        }

        if (_isPlayerMode) {
            // ========== 播放器模式 ==========
            // 核心原则：不覆盖任何 JS API，让页面正常加载，延迟后再隐藏非播放器元素
            console.log('[JB Player Mode] 播放器模式已激活');

            // 判断当前是哪个站点
            const isMissav = _curHost.includes('missav.ws');
            const isJable = _curHost.includes('jable.tv');

            // ========== MISSAV 播放器模式 ==========
            if (isMissav) {
                function missavInit() {
                    // 查找主播放器视频（排除侧边栏预览）
                    const playerVideo = document.querySelector('video.player');
                    if (!playerVideo) return false;

                    // 视频已加载，注入播放器样式
                    const style = document.createElement('style');
                    style.id = 'jb-player-style';
                    style.textContent = `
                        /* 黑色背景 */
                        html, body { background: #000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
                        /* 播放器全屏 */
                        .plyr { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999998 !important; background: #000 !important; }
                        /* 视频全屏 */
                        video.player { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: contain !important; z-index: 999999 !important; background: #000 !important; }
                        /* 控制栏可见 */
                        .plyr__controls { z-index: 9999999 !important; }
                        /* 移除海报图 */
                        .plyr__poster { display: none !important; }
                        /* 隐藏预览视频 */
                        video.preview, .preview { display: none !important; }
                    `;
                    document.head.appendChild(style);

                    // 遍历 body 子元素，隐藏不包含播放器的
                    const plyrEl = document.querySelector('.plyr');
                    Array.from(document.body.children).forEach(child => {
                        if (plyrEl && child.contains(plyrEl)) return; // 保留包含播放器的
                        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') return;
                        if (child.classList.contains('trae-browser-inspect')) return;
                        child.style.display = 'none';
                    });

                    // 自动播放
                    if (playerVideo.paused) {
                        playerVideo.play().catch(() => {
                            const playBtn = document.querySelector('.plyr__control[data-plyr="play"]');
                            if (playBtn) playBtn.click();
                        });
                    }

                    // 隐藏播放器的兄弟元素
                    if (plyrEl) {
                        let parent = plyrEl.parentElement;
                        while (parent && parent !== document.body) {
                            Array.from(parent.children).forEach(sib => {
                                if (sib !== plyrEl && !sib.contains(plyrEl) && sib.tagName !== 'STYLE' && sib.tagName !== 'SCRIPT') {
                                    sib.style.display = 'none';
                                }
                            });
                            parent = parent.parentElement;
                        }
                    }

                    console.log('[JB Player Mode] MISSAV 播放器样式已注入');
                    return true;
                }

                // 等待视频加载
                let applied = false;
                const obs = new MutationObserver(() => {
                    if (applied) return;
                    if (document.querySelector('video.player')?.readyState >= 1) {
                        applied = true;
                        obs.disconnect();
                        missavInit();
                    }
                });
                if (document.body) obs.observe(document.body, { childList: true, subtree: true });
                else document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true }));
                setTimeout(() => { obs.disconnect(); if (!applied) { applied = true; missavInit(); } }, 10000);
            }

            // ========== Jable 播放器模式 ==========
            if (isJable) {
                function jableInit() {
                    // 查找视频播放器
                    const videoEl = document.querySelector('video') || document.querySelector('iframe[src*="embed"]');
                    if (!videoEl) return false;

                    const style = document.createElement('style');
                    style.id = 'jb-player-style';
                    style.textContent = `
                        html, body { background: #000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
                        /* 视频播放器区域全屏 */
                        .video-container, .video-wrapper, .player-container, [class*="video"], [class*="player"] {
                            position: fixed !important; top: 0 !important; left: 0 !important;
                            width: 100vw !important; height: 100vh !important; z-index: 999998 !important;
                            background: #000 !important;
                        }
                        video {
                            position: fixed !important; top: 0 !important; left: 0 !important;
                            width: 100vw !important; height: 100vh !important; object-fit: contain !important;
                            z-index: 999999 !important; background: #000 !important;
                        }
                    `;
                    document.head.appendChild(style);

                    // 隐藏非播放器元素
                    const playerContainer = videoEl.closest('.video-container, .video-wrapper, .player-container, [class*="video"], [class*="player"]') || videoEl;
                    Array.from(document.body.children).forEach(child => {
                        if (child.contains(playerContainer)) return;
                        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK') return;
                        if (child.classList.contains('trae-browser-inspect')) return;
                        child.style.display = 'none';
                    });

                    // 隐藏播放器容器的兄弟元素
                    if (playerContainer !== videoEl) {
                        let parent = playerContainer.parentElement;
                        while (parent && parent !== document.body) {
                            Array.from(parent.children).forEach(sib => {
                                if (sib !== playerContainer && !sib.contains(playerContainer) && sib.tagName !== 'STYLE' && sib.tagName !== 'SCRIPT') {
                                    sib.style.display = 'none';
                                }
                            });
                            parent = parent.parentElement;
                        }
                    }

                    // 自动播放
                    if (videoEl.tagName === 'VIDEO' && videoEl.paused) {
                        videoEl.play().catch(() => {});
                    }

                    console.log('[JB Player Mode] Jable 播放器样式已注入');
                    return true;
                }

                // 等待视频加载
                let jableApplied = false;
                const jableObs = new MutationObserver(() => {
                    if (jableApplied) return;
                    const v = document.querySelector('video');
                    if (v && v.readyState >= 1) {
                        jableApplied = true;
                        jableObs.disconnect();
                        jableInit();
                    }
                });
                if (document.body) jableObs.observe(document.body, { childList: true, subtree: true });
                else document.addEventListener('DOMContentLoaded', () => jableObs.observe(document.body, { childList: true, subtree: true }));
                setTimeout(() => { jableObs.disconnect(); if (!jableApplied) { jableApplied = true; jableInit(); } }, 10000);
            }
        }
        // ========== 直链模式：提取 m3u8 后替换整个页面为 hls.js 播放器 ==========
        if (_isDirectMode) {
            console.log('[JB Direct Mode] 直链模式已激活');

            // 立即注入启动遮罩（document-start 阶段就给反馈，避免窗口打开后长时间黑屏"没反应"）
            (function jbInjectBoot() {
                try {
                    const style = document.createElement('style');
                    style.textContent = '#jb-boot{position:fixed;inset:0;background:#000;z-index:2147483647;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px}#jb-boot .spin{width:42px;height:42px;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:jbBootSpin .8s linear infinite}#jb-boot .txt{color:#ddd;font-size:14px;font-family:Arial,sans-serif}@keyframes jbBootSpin{to{transform:rotate(360deg)}}';
                    (document.head || document.documentElement).appendChild(style);
                    const boot = document.createElement('div');
                    boot.id = 'jb-boot';
                    boot.innerHTML = '<div class="spin"></div><div class="txt">正在解析视频地址...</div>';
                    (document.body || document.documentElement).appendChild(boot);
                } catch (e) {}
            })();
            function jbRemoveBoot() { document.getElementById('jb-boot')?.remove(); }

            // 从页面脚本中提取 m3u8 地址
            function extractM3u8FromPage() {
                // 优先从 eval 拦截中获取（MISSAV 的 m3u8 被 eval 混淆，执行后才能获取到明文）
                const realWin = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
                if (realWin.__jb_m3u8_url) return realWin.__jb_m3u8_url;
                // 也检查主世界的 source 变量
                const vars = ['source', 'source1280', 'source842'];
                for (const v of vars) {
                    const val = realWin[v];
                    if (val && typeof val === 'string' && val.includes('.m3u8')) return val;
                }
                // 从脚本文本中提取
                const scripts = document.querySelectorAll('script');
                for (const s of scripts) {
                    const t = s.textContent || '';
                    // Jable: var hlsUrl = '...'
                    const jableMatch = t.match(/var\s+hlsUrl\s*=\s*'([^']+)'/);
                    if (jableMatch) return jableMatch[1];
                    // MISSAV: eval 混淆中包含 surrit.com
                    const surritMatch = t.match(/https?:\/\/[a-z0-9-]+\.surrit\.com\/[a-z0-9-]+\/playlist\.m3u8/);
                    if (surritMatch) return surritMatch[0];
                    // 通用: 直接匹配 m3u8 URL
                    const m3u8Match = t.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
                    if (m3u8Match) return m3u8Match[0];
                    // 兜底：静态解码 eval(function(p,a,c,k,e,d){...}) 混淆（不依赖 unsafeWindow 拦截，沙箱环境也能工作）
                    const evalMatch = t.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([^']+)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/);
                    if (evalMatch) {
                        try {
                            const encoded = evalMatch[1];
                            const base = parseInt(evalMatch[2]);
                            const keys = evalMatch[4].split('|');
                            let decoded = encoded;
                            for (let i = keys.length - 1; i >= 0; i--) {
                                const placeholder = i.toString(base);
                                decoded = decoded.replace(new RegExp('\\b' + placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), keys[i] || placeholder);
                            }
                            const decodedM3u8 = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8/);
                            if (decodedM3u8) return decodedM3u8[0];
                        } catch (e) {}
                    }
                }
                return null;
            }

            // 计算另一个站点的兜底播放链接
            function getFallbackUrl() {
                const codeMatch = location.pathname.match(/([A-Za-z]{2,6}-\d{2,5}[A-Za-z]?)/i);
                if (!codeMatch) return '';
                const code = codeMatch[1].toLowerCase();
                return _curHost.includes('missav')
                    ? 'https://jable.tv/videos/' + code + '/?jb_direct_mode=1'
                    : 'https://missav.ws/' + code + '/?jb_direct_mode=1';
            }

            // 直链模式加载失败提示页（附带另一站点兜底链接）
            function showDirectError() {
                jbRemoveBoot();
                const fb = getFallbackUrl();
                document.body.innerHTML = '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff6b6b;font-size:14px;font-family:Arial,sans-serif;text-align:center;">视频加载失败<br><span style="color:#aaa;font-size:12px;">该资源暂不可用</span>' +
                    (fb ? '<br><a href="' + fb + '" style="color:#4dc3ff;text-decoration:underline;font-size:13px;display:inline-block;margin-top:8px;">尝试另一个站点播放 &gt;</a>' : '') + '</div>';
                document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;background:#000;';
            }

            // 原地替换当前页面为 hls.js 播放器（不再另开新窗口，加载最快，且保留本窗口）
            function replaceWithPlayer(m3u8Url) {
                jbRemoveBoot();
                console.log('[JB Direct Mode] 提取到 m3u8: ' + m3u8Url);
                // 从 URL 中提取番号作为标题
                const codeMatch = location.pathname.match(/([A-Za-z]{2,6}-\d{2,5}[A-Za-z]?)/i);
                const title = codeMatch ? codeMatch[1].toUpperCase() : '播放器';
                const fallbackUrl = getFallbackUrl();

                document.open();
                document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.3/dist/hls.min.js"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #000; width: 100%; height: 100%; overflow: hidden; }
video { width: 100%; height: 100%; object-fit: contain; background: #000; }
.loading { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 16px; font-family: Arial, sans-serif; z-index: 10; }
.error { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff6b6b; font-size: 14px; font-family: Arial, sans-serif; z-index: 10; text-align: center; display: none; }
.unmute { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,.16); color: #fff; border: 1px solid rgba(255,255,255,.4); border-radius: 20px; padding: 8px 18px; font-size: 14px; font-family: Arial, sans-serif; cursor: pointer; z-index: 20; display: none; backdrop-filter: blur(4px); }
.unmute:hover { background: rgba(255,255,255,.28); }
</style>
</head>
<body>
<div class="loading" id="loading">加载中...</div>
<div class="error" id="error"></div>
<button class="unmute" id="unmute">🔇 已静音播放，点击开启声音</button>
<video id="video" controls autoplay playsinline></video>
<script>
var m3u8Url = '${m3u8Url}';
var fallbackUrl = '${fallbackUrl}';
var video = document.getElementById('video');
var loading = document.getElementById('loading');
var errorEl = document.getElementById('error');
var unmuteBtn = document.getElementById('unmute');

function showPlaybackError(msg) {
    loading.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.innerHTML = msg + (fallbackUrl ? '<br><a href="' + fallbackUrl + '" style="color:#4dc3ff;text-decoration:underline;font-size:13px;display:inline-block;margin-top:8px;">尝试另一个站点播放 &gt;</a>' : '');
}

// 默认 50% 音量
video.volume = 0.5;

// 自动播放策略：优先有声播放；被浏览器拦截时静音自动播放 + 顶部按钮一键开声音
function startPlayback() {
    video.play().catch(function() {
        video.muted = true;
        video.play().catch(function() {});
        unmuteBtn.style.display = 'block';
    });
}
unmuteBtn.addEventListener('click', function() {
    video.muted = false;
    if (video.volume === 0) video.volume = 0.5;
    video.play().catch(function() {});
    unmuteBtn.style.display = 'none';
});

var waitForHls = setInterval(function() {
    if (typeof Hls === 'undefined') return;
    clearInterval(waitForHls);
    if (Hls.isSupported()) {
        var hls = new Hls({ maxBufferSize: 30*1000*1000, maxBufferLength: 30 });
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() { loading.style.display = 'none'; startPlayback(); });
        hls.on(Hls.Events.ERROR, function(event, data) { if (data.fatal) { showPlaybackError('播放失败，资源暂不可用'); } });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', function() { loading.style.display = 'none'; startPlayback(); });
    } else {
        showPlaybackError('浏览器不支持 HLS 播放');
    }
}, 100);
<\/script>
</body>
</html>`);
                document.close();
            }

            // 等待页面加载后提取 m3u8
            function tryExtractAndPlay() {
                const m3u8Url = extractM3u8FromPage();
                if (m3u8Url) {
                    replaceWithPlayer(m3u8Url);
                    return true;
                }
                return false;
            }

            // 尝试提取，如果页面还没加载完就等待
            // 总等待 60 次 × 250ms ≈ 15 秒：慢网络下 MISSAV 的 eval 混淆脚本可能很晚才执行
            function startExtractLoop() {
                let attempts = 0;
                const timer = setInterval(() => {
                    attempts++;
                    if (tryExtractAndPlay()) { clearInterval(timer); return; }
                    if (attempts >= 60) {
                        clearInterval(timer);
                        showDirectError();
                    }
                }, 250);
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startExtractLoop);
            } else {
                startExtractLoop();
            }
        }
        // 无论是播放器模式还是直链模式，都不执行 JavDB 主脚本逻辑
        return;
    }

    // ========== 🔥 超级功能 导航菜单按钮参数 ==========
const JB_HOT_URL = '/advanced_search?laosiji_rank=playback&lsj_period=daily&lsj_filter_by=high_score';
const JB_TOP_URL = '/advanced_search?laosiji_rank=top&lsj_category=all';
    const JB_FC2_URL = '/advanced_search?type=3&score_min=0&d=1';

    // ⭐ document-start 立即执行的三件事：
    //   1. 隐藏 超级功能 页面（热播/Top250/FC2）的搜索表单，避免闪烁
    //   2. MutationObserver 第一时间修改导航栏元素（"排行榜"→"超级功能"、href 重定向）
    //   3. 不再使用 visibility:hidden 隐藏导航文字（避免修改后恢复不了的问题）

    const urlSearch = window.location.search;
    const isSpecialPage = urlSearch.includes('laosiji_rank=') || urlSearch.includes('type=3');

    // 1. 立即注入 CSS：超级功能页面隐藏搜索表单 + 超级功能下拉菜单 hover/click 支持
    const earlyStyle = document.createElement('style');
    earlyStyle.textContent = `
        .navbar-item.has-dropdown:hover .navbar-dropdown,
        .navbar-item.has-dropdown.is-active .navbar-dropdown {
            display: block !important;
        }
    `;
    if (isSpecialPage) {
        earlyStyle.textContent += `
            .section .container > .box { display: none !important; }
            .empty-message, #sort-toggle-btn { display: none !important; }
        `;
    }
    (document.head || document.documentElement).appendChild(earlyStyle);

    // ========== [新增] 全局排行榜菜单 ==========
    // 添加返回顶部浮动按钮（替换原紫色排行榜按钮）
    function addBackToTopFloatButton() {
        try {
            if (document.getElementById('emby-backtotop-btn')) return;

            const floatBtn = document.createElement('div');
            floatBtn.id = 'emby-backtotop-btn';
            floatBtn.innerHTML = '⬆';
            floatBtn.title = '返回顶部';
            floatBtn.style.cssText = `
                position: fixed;
                top: calc(50% - 40px);
                right: 16px;
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                cursor: pointer;
                z-index: 99999;
                box-shadow: 0 3px 8px rgba(102, 126, 234, 0.4);
                transition: all 0.3s;
                color: white;
                line-height: 1;
                opacity: 0.85;
            `;

            floatBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
                this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
            });
            floatBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            });

            floatBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            document.body.appendChild(floatBtn);

            // 翻到底部按钮
            const bottomBtn = document.createElement('div');
            bottomBtn.id = 'emby-tobottom-btn';
            bottomBtn.innerHTML = '⬇';
            bottomBtn.title = '翻到底部';
            bottomBtn.style.cssText = `
                position: fixed;
                top: calc(50% + 0px);
                right: 16px;
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                cursor: pointer;
                z-index: 99999;
                box-shadow: 0 3px 8px rgba(67, 233, 123, 0.4);
                transition: all 0.3s;
                color: white;
                line-height: 1;
                opacity: 0.85;
            `;

            bottomBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
                this.style.boxShadow = '0 6px 20px rgba(67, 233, 123, 0.6)';
            });
            bottomBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = '0 4px 12px rgba(67, 233, 123, 0.4)';
            });

            bottomBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            });

            document.body.appendChild(bottomBtn);

            console.log('JavdbBuddy: 浮动按钮已添加（⬆顶部 + ⬇底部）');
        } catch(e) {
            console.error('JavdbBuddy: 添加浮动按钮失败', e);
        }
    }

    // ========== 演员页收藏快捷按钮（已移除：用户希望使用网站原生按钮） ==========
    function initActorPageTools() {
        // 留空实现，保留函数以避免 initCheck 调用失败
    }

    // ========== 页面推广横幅（列表页顶部，关闭后 7 天内不再显示） ==========
    function addPromoBanner() {
        try {
            const dismissedUntil = GM_getValue('jb_promo_dismissed_until', 0);
            if (Date.now() < dismissedUntil) return;
            if (document.getElementById('jb-promo-banner')) return;

            // 目标位置：顶部导航栏内、ThePornDude 之后（紧邻右侧的识图/设置按钮之间）
            const navbar = document.querySelector('.navbar') || document.querySelector('.navbar-menu') || document.body;
            const tpd = ((nav) => {
                if (!nav) return null;
                if (nav !== document.body) {
                    const direct = Array.from(nav.querySelectorAll('.navbar-item, a, .nav-link, li a')).find(a => /PornDude/i.test(a.textContent || ''));
                    if (direct) return direct;
                }
                return null;
            })(navbar);
            if (!tpd) {
                // 导航栏尚未渲染完成时，等待片刻后重试一次（避免 DOMContentLoaded 前执行导致找不到锚点）
                if (!addPromoBanner._retried) {
                    addPromoBanner._retried = true;
                    setTimeout(addPromoBanner, 600);
                }
                return;
            }

            const banner = document.createElement('a');
            banner.id = 'jb-promo-banner';
            banner.href = 'https://invite.m78star.cn/#/register?code=mHlkrWyl';
            banner.target = '_blank';
            banner.rel = 'noopener noreferrer';
            banner.title = '🚀 机场 · 送 Emby 影视库';
            // 适配导航栏高度的紧凑横幅
            banner.style.cssText = 'position:relative;display:inline-flex;align-items:center;gap:8px;margin:2px 4px;padding:3px 12px;border-radius:14px;background:linear-gradient(120deg,#1a237e 0%,#4a148c 55%,#880e4f 100%);box-shadow:0 2px 8px rgba(74,20,140,0.35);color:#fff;text-decoration:none;font-size:12px;font-weight:bold;white-space:nowrap;line-height:1.5;overflow:hidden;';
            banner.innerHTML = `
                <span>🌌 M78星云机场</span>
                <span style="font-weight:400;opacity:0.9;">赠 Emby 影视库</span>
                <span style="display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#7c4dff,#536dfe);padding:2px 12px;border-radius:12px;">🚀 立即注册</span>
                <span id="jb-promo-close" title="关闭（7 天内不再显示）" style="position:absolute;top:-2px;right:5px;cursor:pointer;color:rgba(255,255,255,0.6);font-size:14px;line-height:1;user-select:none;" onclick="event.stopPropagation();event.preventDefault();">×</span>
            `;
            // 插入：ThePornDude 之后（顶栏左端 ThePornDude 与右端识图/设置之间）
            if (tpd) tpd.after(banner);
            const closeBtn = banner.querySelector('#jb-promo-close');
            if (closeBtn) {
                closeBtn.onmouseenter = () => { closeBtn.style.color = 'rgba(255,255,255,0.95)'; };
                closeBtn.onmouseleave = () => { closeBtn.style.color = 'rgba(255,255,255,0.6)'; };
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    GM_setValue('jb_promo_dismissed_until', Date.now() + 7 * 24 * 3600 * 1000);
                    banner.remove();
                };
            }
        } catch (e) {
            console.warn('JavdbBuddy: 添加推广横幅失败', e);
        }
    }

    // 尽早添加浮动按钮（不等待页面完全加载，页面一有可操作区域就显示）
    (function ensureFloatButtons() {
        const tryAdd = () => {
            if (document.body && document.getElementById('emby-backtotop-btn')) return true;
            if (document.body) { addBackToTopFloatButton(); return true; }
            return false;
        };
        if (tryAdd()) return;

        // 兜底轮询：每 80ms 检查一次，一旦 body 出现立即添加
        let intervalId = setInterval(() => {
            if (tryAdd()) {
                clearInterval(intervalId);
                if (obs) { obs.disconnect(); }
            }
        }, 80);

        // MutationObserver 快速响应：即使 documentElement 暂时为 null，也轮询等待它出现
        let obs;
        const startObserver = () => {
            if (document.documentElement) {
                obs = new MutationObserver(() => {
                    if (tryAdd()) {
                        obs.disconnect();
                        clearInterval(intervalId);
                    }
                });
                obs.observe(document.documentElement, { childList: true, subtree: true });
            } else {
                setTimeout(startObserver, 50);
            }
        };
        startObserver();

        document.addEventListener('DOMContentLoaded', () => {
            clearInterval(intervalId);
            if (obs) { obs.disconnect(); }
            tryAdd();
        });
    })();

    // ---------- 识图（Google 以图搜图，支持拖拽/点击/粘贴上传） ----------
    function jbOpenImageSearch() {
        // 作用域桥接：核心函数在更深层作用域，这里映射到 window 挂载的实例
        const showModal = window.jbShowModalFn;
        const showToast = window.jbShowToastFn;
        try {
            // 复用主弹窗
            showModal('🔍 识图 · Google 以图搜图', `
                <div id="jb-imgsearch-drop" style="border:2px dashed #9e9e9e;border-radius:14px;padding:36px 24px;text-align:center;cursor:pointer;transition:all .2s;background:#fafbfc;">
                    <div style="font-size:44px;margin-bottom:10px;">🖼️</div>
                    <div style="font-size:15px;color:#333;margin-bottom:6px;">点击选择 / 拖拽 / Ctrl+V 粘贴图片</div>
                    <div style="font-size:12px;color:#999;">支持 JPG / PNG / WebP / GIF<br>上传后自动在新标签页用 Google 以图搜图</div>
                </div>
                <input type="file" id="jb-imgsearch-file" accept="image/*" style="display:none;">
                <div id="jb-imgsearch-status" style="text-align:center;margin-top:14px;color:#666;font-size:13px;min-height:20px;"></div>
            `);
            // 不再预先打开标签页——上传完成后才打开，避免弹窗拦截
            const targetName = 'jb_google_lens_result';
            window.__jbImageSearchTab = null;

            const drop = document.getElementById('jb-imgsearch-drop');
            const fileInput = document.getElementById('jb-imgsearch-file');
            const status = document.getElementById('jb-imgsearch-status');
            if (!drop || !fileInput) return;

            const setHighlight = (on) => {
                drop.style.borderColor = on ? '#7c4dff' : '#9e9e9e';
                drop.style.background = on ? '#f1ebff' : '#fafbfc';
            };
            drop.onclick = () => fileInput.click();
            drop.ondragenter = (e) => { e.preventDefault(); e.stopPropagation(); setHighlight(true); };
            drop.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setHighlight(true); };
            drop.ondragleave = () => setHighlight(false);
            drop.ondrop = (e) => {
                e.preventDefault(); e.stopPropagation(); setHighlight(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) jbSearchImageByFile(f, status);
            };
            fileInput.onchange = () => {
                const f = fileInput.files && fileInput.files[0];
                if (f) jbSearchImageByFile(f, status);
            };
            // 粘贴支持：弹窗打开期间监听 Ctrl+V
            const pasteHandler = (e) => {
                if (!isModalVisible()) return;
                const items = e.clipboardData && e.clipboardData.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        e.preventDefault();
                        const blob = items[i].getAsFile();
                        if (blob) { if (status) status.innerHTML = '📋 已粘贴，正在上传...'; jbSearchImageByFile(blob, status); }
                        return;
                    }
                }
            };
            document.addEventListener('paste', pasteHandler);
            const watchClose = setInterval(() => { if (!isModalVisible()) { document.removeEventListener('paste', pasteHandler); clearInterval(watchClose); } }, 300);
        } catch (e) {
            console.warn('JavdbBuddy: 识图弹窗打开失败', e);
        }
    }

    // 通过 Google 搜图上传接口提交图片（上传完成后才打开新标签页，避免弹窗拦截和 403）
    function jbSearchImageByFile(file, statusEl) {
        try {
            if (!file || !/^image\//i.test(file.type || '')) {
                if (statusEl) statusEl.innerHTML = '⚠️ 请选择有效的图片文件';
                return;
            }
            if (statusEl) statusEl.innerHTML = '⏳ 正在上传识别...';

            const targetName = 'jb_google_lens_result';
            const form = document.createElement('form');
            form.method = 'POST';
            form.enctype = 'multipart/form-data';
            form.action = 'https://www.google.com/searchbyimage/upload';
            form.target = targetName;
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'file';
            input.name = 'encoded_image';
            input.accept = 'image/*';
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
            form.appendChild(input);

            document.body.appendChild(form);

            // 在 submit 前同步打开标签页（同一调用栈 = 用户手势，不会被拦截）
            const searchTab = window.open('about:blank', targetName);
            if (!searchTab) {
                form.remove();
                if (statusEl) statusEl.innerHTML = '⚠️ 浏览器阻止了弹出窗口，请允许本站弹出窗口后重试';
                return;
            }
            searchTab.document.write('<title>Google 识图</title><p style="font:14px Arial;color:#666;text-align:center;margin-top:20vh;">正在上传识别...</p>');
            searchTab.document.close();

            form.submit();
            form.remove();

            if (statusEl) statusEl.innerHTML = '✅ 已上传，正在新标签页打开 Google 识图...';
            setTimeout(() => { if (isModalVisible()) hideModal(); }, 800);
        } catch (e) {
            console.warn('JavdbBuddy: 识图提交失败', e);
            if (statusEl) statusEl.innerHTML = '⚠️ ' + (e.message || '识图提交失败');
        }
    }

    // ---------- 导航栏增强 ----------
    function jbAddNavigation() {
        const navbarEnd = document.querySelector('.navbar-end, .navbar-menu .navbar-end');
        if (!navbarEnd) return;

        // 避免重复添加
        if (document.querySelector('.jb-nav-item')) return;

        // 添加设置按钮（用 span 避免 <a href> 被 JAVDB 链接逻辑拦截）
        const settingsBtn = document.createElement('span');
        settingsBtn.className = 'navbar-item jb-nav-item';
        settingsBtn.id = 'jb-nav-settings';
        settingsBtn.style.cssText = 'padding: 0.5rem 0.75rem; font-size: 14px; cursor: pointer; user-select: none;';
        settingsBtn.innerHTML = `<span style="font-weight:bold;color:#3498db;">⚙️ 设置</span>`;
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[JB] 设置按钮被点击');
            // 优先打开「简约快速设置」列表（通用开关 + 更多设置入口）
            jbShowQuickSettings();
        });

        // 插入到 navbar-end 的第一个子元素之前（即"跟随系统"左侧）
        const firstChild = navbarEnd.firstElementChild;
        if (firstChild) {
            navbarEnd.insertBefore(settingsBtn, firstChild);
        } else {
            navbarEnd.appendChild(settingsBtn);
        }

        // 在设置按钮左侧插入"识图"按钮（Google 以图搜图，支持拖拽/点击上传）
        if (!document.getElementById('jb-nav-actor-updates')) {
            const actorBtn = document.createElement('span');
            actorBtn.className = 'navbar-item jb-nav-item';
            actorBtn.id = 'jb-nav-actor-updates';
            actorBtn.innerHTML = '<span style="font-weight:bold;color:#ff9800;">🔍 识图</span>';
            actorBtn.title = '上传图片后以图搜图（Google）';
            actorBtn.style.cssText = 'padding: 0.5rem 0.75rem; font-size: 14px; cursor: pointer; user-select: none;';
            actorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                jbOpenImageSearch();
            });
            // 插入到设置按钮左侧
            navbarEnd.insertBefore(actorBtn, settingsBtn);
        }

        console.log('[JB] 已注入 识图/设置 导航按钮（id=', settingsBtn.id, '/', (document.getElementById('jb-nav-actor-updates')||{}).id, '）');

        // Hook 网站原有导航按钮补充处理（MutationObserver 已在 document-start 处理了 href 重定向）
        jbHookOriginalNavButtons();
    }

    // ⚡ 快速设置面板：通用设置全部功能（开关+滑杆+下拉）+ 更多设置入口
    function jbShowQuickSettings() {
        // 作用域桥接：以下核心函数定义在更深层作用域，这里映射到 window 挂载的实例
        const initAutoPaging = window.jbInitAutoPagingFn;
        const applyListPageLinkTarget = window.jbApplyListPageLinkTargetFn;
        const applyAllLinksTarget = window.jbApplyAllLinksTargetFn;
        const applyListPagePopup = window.jbApplyListPagePopupFn;
        const refreshSubtitleIndicators = window.jbRefreshSubtitleIndicatorsFn;
        const refreshStatusIndicators = window.jbRefreshStatusIndicatorsFn;
        const jbApplyCardLayout = window.jbApplyCardLayoutFn;
        const jbPageZoomDefault = window.jbPageZoomDefaultFn;
        const showSettingsDialog = window.jbShowSettingsDialogFn;
        const showToast = window.jbShowToastFn;
        try {
            const openedPanel = document.getElementById('jb-quick-settings');
            if (openedPanel) {
                openedPanel.remove();
                return; // 再次点击“设置”按钮直接关闭，不重新打开。
            }
            const switches = [
                { k: 'jb_enable_autopaging', d: true, label: '无缝翻页（滚动自动加载）', apply: (v) => { if (v) { window.__jbAutopageInited = false; initAutoPaging(); } else { document.querySelector('.jb-autopage-scroll')?.remove(); } } },
                { k: 'jb_enable_hover_zoom', d: false, label: '悬浮大图', apply: () => {} },
                { k: 'jb_open_in_new_tab', d: false, label: '列表页新窗口打开', apply: () => applyListPageLinkTarget() },
                { k: 'jb_open_all_links_in_new_tab', d: true, label: '所有链接新窗口打开', apply: () => applyAllLinksTarget() },
                { k: 'jb_open_in_popup', d: false, label: '弹窗方式打开详情页', apply: () => applyListPagePopup() },
                { k: 'jb_enable_bt_search', d: true, label: 'BT 聚合磁力搜索', apply: () => {} },
                { k: 'jb_show_subtitle_search', d: false, label: '字幕搜索', apply: () => refreshSubtitleIndicators() },
                { k: 'jb_show_list_search', d: true, label: '列表快捷搜索(6 站)', apply: (v) => { document.querySelectorAll('.list-search-panel').forEach(el => { el.style.display = v ? '' : 'none'; }); } },
                { k: 'jb_show_emby_status', d: true, label: '显示 Emby 入库状态', apply: () => refreshStatusIndicators() },
                { k: 'jb_show_jellyfin_status', d: false, label: '显示 Jellyfin 入库状态', apply: () => refreshStatusIndicators() },
                { k: 'jb_portrait_cards', d: false, label: '竖图模式（封面竖版大图）', apply: () => jbApplyCardLayout() },
                { k: 'jb_card_fx', d: true, label: '卡片动画（悬停上浮）', apply: () => jbApplyCardLayout() },
            ];
            const rowHtml = switches.map(it => {
                const val = !!GM_getValue(it.k, it.d);
                return `<div class="jb-qk-row" data-k="${it.k}" data-d="${it.d}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;cursor:pointer;font-size:13px;color:#333;">
                    <span style="flex:1;line-height:1.3;">${it.label}</span><span class="jb-qk-sw" data-on="${val}" style="width:36px;height:20px;border-radius:10px;background:${val ? '#4CAF50' : '#cdd2da'};position:relative;flex:none;transition:background .15s;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06);"><span style="position:absolute;top:2px;${val ? 'right:2px' : 'left:2px'};width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.2);transition:left .15s,right .15s;"></span></span></div>`;
            }).join('');
            const cardCols = GM_getValue('jb_card_columns', 5);
            const pageZoom = GM_getValue('jb_page_zoom', jbPageZoomDefault());
            const previewMode = GM_getValue('jb_preview_mode', 'screenshot');
            const panelConfig = {
                'jb-card-columns': { input: 'jb-card-columns', val: cardCols, key: 'jb_card_columns', min: 2, max: 10, label: '卡片列数' },
                'jb-page-zoom': { input: 'jb-page-zoom', val: pageZoom, key: 'jb_page_zoom', min: 60, max: 100, label: '页面宽度', suffix: '%' },
            };
            const sliderHtml = Object.keys(panelConfig).map(id => {
                const cfg = panelConfig[id];
                return `<div style="padding:10px 14px;border-top:1px solid #f2f3f5;">
                    <div style="font-size:12px;color:#666;margin-bottom:6px;">${cfg.label}</div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <input type="range" id="${cfg.input}" min="${cfg.min}" max="${cfg.max}" value="${cfg.val}" style="flex:1;cursor:pointer;">
                        <span id="${cfg.input}-v" style="min-width:38px;text-align:center;color:#2196F3;font-weight:bold;">${cfg.val}${cfg.suffix || ''}</span>
                    </div></div>`;
            }).join('');
            const modeHtml = `<div style="padding:10px 14px;border-top:1px solid #f2f3f5;">
                <div style="font-size:12px;color:#666;margin-bottom:6px;">列表页预览方式</div>
                <select id="jb-qk-preview-mode" style="width:100%;height:32px;border:1px solid #d5dbe3;border-radius:6px;padding:0 6px;background:#fff;color:#333;font-size:13px;cursor:pointer;">
                    <option value="javdb" ${previewMode === 'javdb' ? 'selected' : ''}>JavDB 预览图（多图+演员）</option>
                    <option value="screenshot" ${previewMode === 'screenshot' ? 'selected' : ''}>外部截图长图（javstore / javfree）</option>
                </select></div>`;
            const panel = document.createElement('div');
            panel.id = 'jb-quick-settings';
            panel.style.cssText = 'position:fixed;z-index:2147483645;width:300px;background:#fff;border:1px solid #e2e5ea;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.18);overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,sans-serif;';
            panel.innerHTML = `<div style="padding:12px 14px;border-bottom:1px solid #eee;font-weight:bold;color:#172033;font-size:14px;display:flex;justify-content:space-between;align-items:center;">⚙️ 快速设置<span id="jb-qk-close" style="cursor:pointer;color:#999;font-size:16px;line-height:1;">✕</span></div>
                <div style="max-height:64vh;overflow-y:auto;">${rowHtml}${sliderHtml}${modeHtml}</div>
                <div id="jb-qk-more" style="display:flex;align-items:center;gap:6px;padding:12px 14px;border-top:1px solid #eee;cursor:pointer;color:#3498db;font-size:13px;font-weight:500;background:#f7f9fc;">更多设置 <span style="color:#999;">›</span></div>`;
            document.body.appendChild(panel);
            // 菜单锚定在“设置”按钮正下方，而不是固定贴在页面右侧。
            const settingsAnchor = document.getElementById('jb-nav-settings');
            if (settingsAnchor) {
                const rect = settingsAnchor.getBoundingClientRect();
                const panelWidth = 300;
                // 左边缘与设置按钮左边缘对齐；靠近屏幕边缘时仅做必要的防溢出处理。
                const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - panelWidth - 8));
                panel.style.top = Math.round(rect.bottom + 6) + 'px';
                panel.style.left = Math.round(left) + 'px';
                panel.style.right = 'auto';
            } else {
                panel.style.top = '70px';
                panel.style.right = '16px';
            }
            document.getElementById('jb-qk-close').onclick = () => panel.remove();
            panel.querySelectorAll('.jb-qk-row').forEach(row => {
                row.onmouseenter = () => row.style.background = '#f5f7fa';
                row.onmouseleave = () => row.style.background = '';
                row.onclick = () => {
                    const it = switches.find(x => x.k === row.dataset.k);
                    if (!it) return;
                    const nv = !GM_getValue(it.k, it.d);
                    GM_setValue(it.k, nv);
                    try { it.apply && it.apply(nv); } catch (e) {}
                    const sw = row.querySelector('.jb-qk-sw');
                    sw.style.background = nv ? '#4CAF50' : '#cdd2da';
                    const knob = sw.querySelector('span');
                    knob.style.left = ''; knob.style.right = '';
                    knob.style[nv ? 'right' : 'left'] = '2px';
                    sw.dataset.on = String(nv);
                };
            });
            Object.keys(panelConfig).forEach(id => {
                const cfg = panelConfig[id];
                const slider = document.getElementById(cfg.input);
                const valEl = document.getElementById(cfg.input + '-v');
                slider.addEventListener('input', () => {
                    valEl.textContent = slider.value + (cfg.suffix || '');
                    GM_setValue(cfg.key, parseInt(slider.value, 10));
                    if (cfg.key === 'jb_card_columns') { try { jbApplyCardLayout(); } catch (e) {} }
                });
            });
            const pm = document.getElementById('jb-qk-preview-mode');
            pm.addEventListener('change', () => { GM_setValue('jb_preview_mode', pm.value); showToast('预览方式已保存，刷新生效'); });
            document.getElementById('jb-qk-more').onclick = () => {
                panel.remove();
                const sd = (typeof showSettingsDialog === 'function' && showSettingsDialog) || window.showSettingsDialog;
                if (sd) sd(); else showToast('设置界面加载中，请刷新后重试');
            };
        } catch (e) { console.warn('JavdbBuddy: 快速设置打开失败', e); }
    }

    // 最外层作用域到核心库 showToast 的惰性桥接（调用时才读取 window 挂载，避免声明时机过早）
    const showToast = function () {
        return typeof window.jbShowToastFn === 'function'
            ? window.jbShowToastFn.apply(null, arguments)
            : undefined;
    };

    // 事件委托：兜底处理导航栏 设置/识图 按钮，即使用户脚本注入的元素被 JAVDB 重渲染也能响应
    document.addEventListener('click', (e) => {
        const el = e.target && e.target.closest ? e.target.closest('#jb-nav-actor-updates, #jb-nav-settings') : null;
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        console.log('[JB] 委托命中点击:', el.id);
        if (el.id === 'jb-nav-actor-updates') {
            try { jbOpenImageSearch(); }
            catch (err) { console.warn('JavdbBuddy: 识图失败', err); showToast('识图打开失败：' + (err.message || '未知错误')); }
        } else {
            try { jbShowQuickSettings(); }
            catch (err) { console.warn('JavdbBuddy: 设置打开失败', err); showToast('设置打开失败：' + (err.message || '未知错误')); }
        }
    }, true);

    // 点击设置面板外的空白区域关闭面板；面板内部操作不会被误关闭。
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('jb-quick-settings');
        if (!panel || panel.contains(e.target)) return;
        if (e.target?.closest && e.target.closest('#jb-nav-settings')) return;
        panel.remove();
    }, true);

    // 稳妥兜底：在油猴脚本菜单里注册 设置/识图 命令（即使导航栏按钮被其他扩展/脚本覆盖，也能从油猴菜单触发）
    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('⚙️ 打开设置', () => { try { jbShowQuickSettings(); } catch (err) { showToast('设置打开失败：' + (err.message || '')); } });
            GM_registerMenuCommand('🔍 识图（以图搜图）', () => { try { jbOpenImageSearch(); } catch (err) { showToast('识图打开失败：' + (err.message || '')); } });
        }
    } catch (e) {}

    // 尽早添加设置按钮（不等待页面完全加载，监听 navbar-end 出现即插入）
    (function ensureSettingsButton() {
        const tryAdd = () => {
            if (document.querySelector('.jb-nav-item')) return true;
            const navbarEnd = document.querySelector('.navbar-end, .navbar-menu .navbar-end');
            if (navbarEnd) { jbAddNavigation(); return true; }
            return false;
        };
        if (tryAdd()) return;

        // 兜底轮询：每 80ms 检查一次，一旦 navbar-end 出现立即添加
        let intervalId = setInterval(() => {
            if (tryAdd()) {
                clearInterval(intervalId);
                if (obs) { obs.disconnect(); }
            }
        }, 80);

        // MutationObserver 快速响应：即使 documentElement 暂时为 null，也轮询等待它出现
        let obs;
        const startObserver = () => {
            if (document.documentElement) {
                obs = new MutationObserver(() => {
                    if (tryAdd()) {
                        obs.disconnect();
                        clearInterval(intervalId);
                    }
                });
                obs.observe(document.documentElement, { childList: true, subtree: true });
            } else {
                setTimeout(startObserver, 50);
            }
        };
        startObserver();

        document.addEventListener('DOMContentLoaded', () => {
            clearInterval(intervalId);
            if (obs) { obs.disconnect(); }
            tryAdd();
        });
    })();

    // Hook 网站原有的导航按钮补充处理（仅处理 MutationObserver 覆盖不到的部分）
    function jbHookOriginalNavButtons() {
        // 1. "猜你喜歡" tab 替换为 Top250（照搬 JavdbBuddy）
        document.querySelectorAll('.main-tabs ul li, .tabs ul li').forEach(li => {
            if (li.textContent.includes('猜你喜歡') || li.textContent.includes('猜你喜欢')) {
                li.innerHTML = `<a href="${JB_TOP_URL}"><span>Top250</span></a>`;
            }
        });
    }

    // 2. MutationObserver 第一时间监控 DOM 变化，立即修改导航栏
    const jbNavObserver = new MutationObserver(() => {
        // 2a. "排行榜" → "🔥超级功能"
        document.querySelectorAll('.navbar-item.has-dropdown a.navbar-link').forEach(link => {
            if (link.textContent.trim() === '排行榜' && !link.dataset.jbDone) {
                link.innerHTML = '🔥<span style="color:#ff4444;font-weight:bold;text-shadow:0 0 8px rgba(255,68,68,0.5);">超级功能</span>';
                // 不修改 href，确保下拉菜单能正常展开
                link.dataset.jbDone = '1';

                const parent = link.closest('.navbar-item.has-dropdown');
                const dropdown = parent?.querySelector('.navbar-dropdown');
                if (dropdown && !dropdown.dataset.jbDone) {
                    dropdown.innerHTML = `
                        <a class="navbar-item" href="${JB_HOT_URL}">🔥 热播</a>
                        <a class="navbar-item" href="${JB_TOP_URL}">🏆 Top250</a>
                        <hr class="navbar-divider">
                        <a class="navbar-item" href="/tags?c10=1">有碼</a>
                        <a class="navbar-item" href="/tags?c10=2">無碼</a>
                        <a class="navbar-item" href="/tags?c10=3">歐美</a>
                        <a class="navbar-item" href="${JB_FC2_URL}">FC2</a>
                        <a class="navbar-item" href="/tags?c10=4">FANZA(DMM)成人獎</a>
                    `;
                    dropdown.dataset.jbDone = '1';
                }

                // 点击展开/收起下拉菜单
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    parent?.classList.toggle('is-active');
                });
            }
        });
        // 2b. 热播 / Top250 href 重定向
        document.querySelectorAll('a[href*="rankings/playback"]').forEach(a => {
            if (!a.dataset.jbDone) { a.setAttribute('href', JB_HOT_URL); a.dataset.jbDone = '1'; }
        });
        document.querySelectorAll('a[href*="rankings/top"]').forEach(a => {
            if (!a.dataset.jbDone) { a.setAttribute('href', JB_TOP_URL); a.dataset.jbDone = '1'; }
        });
        // 2c. FC2 href 重定向
        document.querySelectorAll('.navbar-item').forEach(el => {
            if (el.textContent.trim() === 'FC2' && !el.dataset.jbDone) {
                el.setAttribute('href', JB_FC2_URL);
                el.dataset.jbDone = '1';
            }
        });
        document.querySelectorAll('.tabs a').forEach(el => {
            if (el.textContent.trim() === 'FC2' && !el.dataset.jbDone) {
                el.setAttribute('href', JB_FC2_URL);
                el.dataset.jbDone = '1';
            }
        });
    });
    jbNavObserver.observe(document.documentElement, { childList: true, subtree: true });
    // 10 秒后清理观察器（防内存泄漏）
    setTimeout(() => jbNavObserver.disconnect(), 10000);

    // ⭐ 立即执行的测试日志
    console.log('%c✅ JAVDB全能助手 已加载', 'color: green; font-size: 16px; font-weight: bold;');
    console.log('当前 URL:', window.location.href);
    console.log('当前路径:', window.location.pathname);
    console.log('查询参数:', window.location.search);

    // 保存原始 GM_xmlhttpRequest 引用（必须在 CF_HANDLER 之前定义）
    const originalGMXHR = GM_xmlhttpRequest.bind({});

    // ========== [新增] 全局 Cloudflare 验证自动处理模块 ==========
    const CF_HANDLER = {
        isVerifying: false,
        verifyTab: null,
        pendingRequests: [],
        
        // 检测响应是否包含 Cloudflare 验证
        isCFChallenge(response) {
            if (!response || !response.responseText) return false;
            const html = response.responseText;
            return html.includes('cf-turnstile') || 
                   html.includes('challenge-form') ||
                   html.includes('Checking your browser') ||
                   html.includes('Just a moment') ||
                   html.includes('验证您是真人') ||
                   html.includes('正在检查您的浏览器') ||
                   (response.status === 403 && html.includes('cloudflare'));
        },
        
        // 自动后台打开验证页面
        async autoVerify(url) {
            if (this.isVerifying) {
                console.log('🛡️ 验证已在进行中，等待完成...');
                await this.waitForVerify();
                return true;
            }
            
            this.isVerifying = true;
            console.log('%c🛡️ 检测到 Cloudflare 验证，后台自动处理中...', 'color: orange; font-size: 14px;');
            
            // 在后台打开验证页面（使用 javdb 首页作为验证入口）
            const verifyUrl = 'https://javdb.com';
            this.verifyTab = window.open(verifyUrl, '_blank', 'noopener,noreferrer');
            
            if (!this.verifyTab) {
                console.warn('⚠️ 无法打开验证窗口，可能被浏览器阻止');
                this.isVerifying = false;
                return false;
            }
            
            // 等待验证完成（最多30秒）
            let checkCount = 0;
            const maxChecks = 30;
            
            while (checkCount < maxChecks) {
                await this.sleep(1000);
                checkCount++;
                
                try {
                    // 检查验证是否完成（通过测试请求）
                    const testResponse = await this.testRequest(url);
                    if (testResponse && !this.isCFChallenge(testResponse)) {
                        console.log('%c✅ Cloudflare 验证已通过！', 'color: green; font-size: 14px;');
                        this.closeVerifyTab();
                        this.isVerifying = false;
                        return true;
                    }
                } catch (e) {
                    // 继续等待
                }
            }
            
            console.warn('⚠️ 验证超时，关闭验证窗口');
            this.closeVerifyTab();
            this.isVerifying = false;
            return false;
        },
        
        // 测试请求是否通过（使用原始函数避免递归）
        testRequest(url) {
            return new Promise((resolve, reject) => {
                // 必须使用原始 GM_xmlhttpRequest，避免递归
                originalGMXHR({
                    method: 'HEAD',
                    url: url,
                    timeout: 5000,
                    onload: resolve,
                    onerror: reject,
                    ontimeout: reject
                });
            });
        },
        
        // 等待验证完成
        waitForVerify() {
            return new Promise(resolve => {
                const check = setInterval(() => {
                    if (!this.isVerifying) {
                        clearInterval(check);
                        resolve();
                    }
                }, 500);
            });
        },
        
        // 关闭验证标签页
        closeVerifyTab() {
            if (this.verifyTab && !this.verifyTab.closed) {
                try {
                    this.verifyTab.close();
                    console.log('🗑️ 已关闭验证标签页');
                } catch (e) {
                    console.log('无法自动关闭验证标签页');
                }
            }
            this.verifyTab = null;
        },
        
        // 延迟函数
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

    // ========== [新增] 包装 GM_xmlhttpRequest 自动处理 Cloudflare 验证 ==========
    // 注意：当前版本暂时禁用自动验证功能，避免递归问题
    // 如需启用 Cloudflare 自动验证，需要重新设计实现方案
    // GM_xmlhttpRequest = requestWithCFHandling;
    
    function requestWithCFHandling(options) {
        const originalOnload = options.onload;
        const originalOnerror = options.onerror;
        const url = options.url;
        
        options.onload = async function(response) {
            // 检测是否遇到 Cloudflare 验证
            if (CF_HANDLER.isCFChallenge(response)) {
                console.log('%c🛡️ 请求遇到 Cloudflare 验证，后台自动处理...', 'color: orange;', url);
                
                const verified = await CF_HANDLER.autoVerify(url);
                if (verified) {
                    // 验证通过，重试原请求（使用原始函数避免循环）
                    console.log('🔄 验证完成，重新发送请求:', url);
                    originalGMXHR({
                        ...options,
                        onload: originalOnload,
                        onerror: originalOnerror
                    });
                    return;
                }
            }
            
            // 正常响应或验证失败，调用原始回调
            if (originalOnload) {
                originalOnload(response);
            }
        };
        
        options.onerror = async function(error) {
            // 请求失败也可能是验证导致的
            console.log('⚠️ 请求失败，尝试检测是否是验证问题:', url);
            
            // 尝试快速测试
            try {
                const testResponse = await CF_HANDLER.testRequest(url);
                if (CF_HANDLER.isCFChallenge(testResponse)) {
                    console.log('%c🛡️ 检测到 Cloudflare 验证，后台自动处理...', 'color: orange;');
                    const verified = await CF_HANDLER.autoVerify(url);
                    if (verified) {
                        // 验证通过，重试原请求（使用原始函数）
                        console.log('🔄 验证完成，重新发送请求:', url);
                        originalGMXHR({
                            ...options,
                            onload: originalOnload,
                            onerror: originalOnerror
                        });
                        return;
                    }
                }
            } catch (e) {
                // 测试也失败，调用原始错误处理
            }
            
            if (originalOnerror) {
                originalOnerror(error);
            }
        };
        
        // 发送请求
        return GM_xmlhttpRequest(options);
    }

    // ========== [新增] 自动静默过 Cloudflare 验证 ==========
    function bypassCloudflare() {
        // 检测是否是 Cloudflare 验证页面（只检测真正需要等待的验证状态）
        const title = document.title || '';
        
        // 核心判断：页面标题是 CF 验证标题，或存在挑战表单
        const isCFPage = 
            title.includes('Just a moment') || 
            title.includes('请稍候') ||
            title.includes('Attention Required') ||
            document.querySelector('#challenge-form') !== null;
        
        if (isCFPage) {
            console.log('%c🛡️ Cloudflare 验证页面检测，等待自动完成...', 'color: orange; font-size: 14px;');
            
            // 尝试自动点击验证复选框（如果存在）
            const turnstileCheckbox = document.querySelector('.cf-turnstile input[type="checkbox"]') || 
                                     document.querySelector('input[type="checkbox"][name*="cf"]') ||
                                     document.querySelector('[data-cf-turnstile] input');
            
            if (turnstileCheckbox) {
                console.log('%c🖱️ 发现验证复选框，尝试自动点击...', 'color: blue;');
                setTimeout(() => {
                    turnstileCheckbox.click();
                    console.log('%c✅ 已自动点击验证复选框', 'color: green;');
                }, 1000);
            }
            
            // 尝试点击验证按钮
            const verifyBtn = document.querySelector('input[type="submit"]') || 
                             document.querySelector('.cf-browser-verification button') ||
                             document.querySelector('#challenge-form input[type="submit"]') ||
                             document.querySelector('button[type="submit"]');
            
            if (verifyBtn && !turnstileCheckbox) {
                setTimeout(() => {
                    verifyBtn.click();
                    console.log('%c✅ 已自动点击验证按钮', 'color: green;');
                }, 1500);
            }
            
            // 监听页面变化，一旦验证完成就继续执行
            let checkCount = 0;
            const maxChecks = 15; // 最多检查15次（约15秒）
            
            const checkInterval = setInterval(() => {
                checkCount++;
                const currentTitle = document.title || '';
                const isStillCF = currentTitle.includes('Just a moment') || 
                                  currentTitle.includes('请稍候') ||
                                  currentTitle.includes('Attention Required') ||
                                  document.querySelector('#challenge-form') !== null;
                
                if (!isStillCF || checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    if (!isStillCF) {
                        console.log('%c✅ Cloudflare 验证已通过，继续加载脚本...', 'color: green;');
                    } else {
                        console.log('%c⚠️ Cloudflare 验证超时，尝试直接加载脚本...', 'color: orange;');
                    }
                    initMainScript();
                }
            }, 1000);
            
            return true; // 表示正在等待验证
        }
        return false; // 不是验证页面
    }
    
    // 执行主脚本逻辑（等待 DOM 加载完成）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAfterDOMReady);
    } else {
        runAfterDOMReady();
    }

    function runAfterDOMReady() {
        // 立即尝试跳过 Cloudflare
        if (bypassCloudflare()) {
            console.log('等待 Cloudflare 验证完成...');
            // 如果检测到验证页面，延迟执行主逻辑
            return;
        }
        initMainScript();
    }
    
    // 主脚本入口函数
    function initMainScript() {
        if (window.__jb_init_done) {
            console.log('[JB] initMainScript 已执行过，跳过');
            return;
        }
        console.log('[JB] initMainScript 开始执行');
    
    try {
    // 立即检查页面类型
    const isDetailPage = window.location.pathname.startsWith('/v/');
    console.log('是否是详情页:', isDetailPage);
    if (isDetailPage) {
        console.log('✅ 详情页检测通过，将在2秒后添加双标签磁力链');
    } else {
        console.log('ℹ️ 非详情页，跳过双标签磁力链功能');
    }
    
    // 检查Tampermonkey是否正常运行
    console.log('Tampermonkey GM_xmlhttpRequest 可用:', typeof GM_xmlhttpRequest === 'function');
    console.log('Tampermonkey GM_getValue 可用:', typeof GM_getValue === 'function');

    // ========== [新增] JAVBUS 磁力链内存缓存 ==========
    const JAVBUS_CACHE = {};
    const JAVDB_CACHE = {};  // JAVDB 磁力链缓存
    const PREVIEW_CACHE = {};  // 预览图缓存：{ status: 'loading'|'loaded'|'error', imgList: [], actors: [] }
    
    // ========== [新增] 请求限流机制 ==========
    const REQUEST_QUEUE = [];
    const MAX_CONCURRENT_REQUESTS = 1; // 同时最多1个请求
    const REQUEST_DELAY = 5000; // 每个请求间隔5000ms
    let activeRequests = 0;
    let lastRequestTime = 0;
    let totalPreloadedCount = 0; // 页面总预加载计数
    const MAX_PRELOAD_ITEMS = 0; // 关闭后台预加载，仅用户点击时才请求（防验证）
    let queuePaused = false; // 检测到验证时暂停队列
    
    // 请求队列管理
    function queueRequest(requestFn) {
        return new Promise((resolve, reject) => {
            REQUEST_QUEUE.push({ requestFn, resolve, reject });
            processQueue();
        });
    }
    
    function processQueue() {
        if (queuePaused || activeRequests >= MAX_CONCURRENT_REQUESTS || REQUEST_QUEUE.length === 0) {
            return;
        }
        
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        
        if (timeSinceLastRequest < REQUEST_DELAY) {
            setTimeout(processQueue, REQUEST_DELAY - timeSinceLastRequest);
            return;
        }
        
        const { requestFn, resolve, reject } = REQUEST_QUEUE.shift();
        activeRequests++;
        lastRequestTime = Date.now();
        
        // 幂等释放 + 看门狗：即使 Promise 因回调丢失永不落定，
        // 25 秒后也强制释放槽位，防止整个请求队列永久卡死（表现为预览图/磁力点不动）
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            activeRequests--;
            setTimeout(processQueue, REQUEST_DELAY);
        };
        setTimeout(release, 25000);
        
        try {
            Promise.resolve()
                .then(requestFn)
                .then(resolve)
                .catch(reject)
                .finally(release);
        } catch (e) {
            reject(e);
            release();
        }
    }
    
    // 检测到CF验证时暂停队列并通知用户
    function handleCFDetection() {
        queuePaused = true;
        console.warn('%c🛡️ 检测到Cloudflare验证，暂停请求队列30秒...', 'color:orange;font-size:14px;');
        // 30秒后恢复，给用户时间手动验证
        setTimeout(() => {
            queuePaused = false;
            console.log('%c🛡️ 请求队列已恢复', 'color:green;font-size:14px;');
            processQueue();
        }, 30000);
    }


    // ========== [新增] 98堂自动搜索逻辑 ==========
    if (window.location.host.includes('sehuatang.net')) {
        if (window.location.search.includes('srchtxt=')) {
            const autoProcess = () => {
                // 第一步：检测并自动点击"满18岁"按钮（偶发性出现）
                const ageButton = Array.from(document.querySelectorAll('a, button, div')).find(el => 
                    el.textContent.includes('满18岁') || el.textContent.includes('please click here')
                );
                
                if (ageButton) {
                    console.log('98堂: 检测到年龄确认按钮，自动点击...');
                    ageButton.click();
                    // 点击后延迟执行搜索，确保页面已跳转
                    setTimeout(autoProcess, 800);
                    return;
                }
                
                // 第二步：自动点击搜索按钮（多种选择器兼容）
                const searchBtn = document.querySelector('button.pn') ||           // 优先尝试
                                  document.querySelector('button[type="submit"]') || 
                                  document.querySelector('button[name="searchsubmit"]') ||
                                  document.querySelector('.pn.pnc') ||
                                  document.querySelector('#searchsubmit') ||
                                  Array.from(document.querySelectorAll('button')).find(btn => 
                                      btn.textContent.includes('搜索') || btn.textContent.includes('搜 索')
                                  );
                
                if (searchBtn) {
                    console.log('98堂: 检测到搜索按钮，自动触发搜索...', searchBtn);
                    searchBtn.click();
                    return;
                }
                
                // 第三步：如果上述方法都失败，尝试表单提交
                const searchForm = document.querySelector('form[name="searchform"]') || 
                                   document.querySelector('form[id="search"]') ||
                                   document.querySelector('form');
                if (searchForm) {
                    console.log('98堂: 未找到按钮，尝试直接提交表单...');
                    searchForm.submit();
                    return;
                }
                
                console.warn('98堂: 未能找到搜索触发元素');
            };
            
            // 延迟执行，确保DOM完全加载
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => setTimeout(autoProcess, 300));
            } else {
                setTimeout(autoProcess, 300);
            }
        }
        return;
    }

    console.log('JavdbBuddy: 脚本启动');

    // 默认媒体服务器配置（空列表）
    const DEFAULT_SERVERS = [];

    // 缓存与索引
    let LIBRARY_INDEX = {};
    let JELLYFIN_LIBRARY_INDEX = {};
    let SYNC_ERROR = '';
    let JELLYFIN_SYNC_ERROR = '';
    // 启动时清除旧的错误缓存，让 verifyStatusBackground 实时检测连接状态
    (() => {
        const allServers = getServers();
        let changed = false;
        allServers.forEach(s => {
            if (s.lastError) { s.lastError = false; s.statusMsg = ''; changed = true; }
        });
        if (changed) saveServers(allServers);
        GM_setValue('emby_sync_error', '');
        GM_setValue('jellyfin_sync_error', '');
    })();
    try {
        LIBRARY_INDEX = JSON.parse(GM_getValue('emby_library_index', '{}'));
    } catch(e) {
        console.error('JavdbBuddy: 解析索引失败', e);
        LIBRARY_INDEX = {};
    }
    try {
        JELLYFIN_LIBRARY_INDEX = JSON.parse(GM_getValue('jellyfin_library_index', '{}'));
    } catch(e) {
        console.error('Jellyfin Checker: 解析索引失败', e);
        JELLYFIN_LIBRARY_INDEX = {};
    }

    let LAST_SYNC_TIME = GM_getValue('emby_last_sync', 0);
    let JELLYFIN_LAST_SYNC_TIME = GM_getValue('jellyfin_last_sync', 0);
    const SYNC_INTERVAL = 60 * 60 * 1000; // 每1小时自动同步一次

    // 获取服务器配置
    function getServers() {
        try {
            const saved = GM_getValue('emby_servers', null);
            return saved ? JSON.parse(saved) : DEFAULT_SERVERS;
        } catch(e) {
            return DEFAULT_SERVERS;
        }
    }

    function getServersByType(type) {
        return getServers().filter(s => (s.type || 'emby') === type);
    }

    // 保存服务器配置
    function saveServers(servers) {
        GM_setValue('emby_servers', JSON.stringify(servers));
        // 触发配置变更事件，通知页面重新检查
        GM_setValue('emby_config_changed', Date.now());
    }

    // 全量同步媒体库（Emby + Jellyfin）
    async function syncFullLibrary(manual = false) {
        await syncMediaLibrary('emby');
        await syncMediaLibrary('jellyfin');
        initCheck();
    }

    async function syncMediaLibrary(type) {
        const servers = getServersByType(type);
        const isEmby = type === 'emby';
        const indexVar = isEmby ? 'LIBRARY_INDEX' : 'JELLYFIN_LIBRARY_INDEX';
        const errorVar = isEmby ? 'SYNC_ERROR' : 'JELLYFIN_SYNC_ERROR';
        const lastSyncKey = isEmby ? 'emby_last_sync' : 'jellyfin_last_sync';
        const errorKey = isEmby ? 'emby_sync_error' : 'jellyfin_sync_error';
        const indexKey = isEmby ? 'emby_library_index' : 'jellyfin_library_index';

        if (servers.length === 0) {
            if (isEmby) SYNC_ERROR = '';
            else JELLYFIN_SYNC_ERROR = '';
            return;
        }

        if (isEmby) SYNC_ERROR = '';
        else JELLYFIN_SYNC_ERROR = '';

        console.log(`JavdbBuddy: 开始同步 ${type} 全量库...`);
        const newIndex = {};
        let totalCount = 0;
        let hasSuccess = false;

        for (const server of servers) {
            try {
                const items = await fetchAllMediaItems(server);
                if (Array.isArray(items)) {
                    hasSuccess = true;
                    server.lastError = false;
                    server.statusMsg = '在线已连接';
                    items.forEach(item => {
                        const code = extractCodeFromTitle(item.Name) || extractCodeFromTitle(item.Path);
                        if (code) {
                            newIndex[code.toUpperCase()] = {
                                itemId: item.Id,
                                serverId: item.ServerId,
                                serverUrl: server.url,
                                serverName: server.name
                            };
                            totalCount++;
                        }
                    });
                }
            } catch (e) {
                console.error(`JavdbBuddy: 同步 ${type} 服务器 ${server.name} 失败:`, e);
                server.lastError = true;
                server.statusMsg = e.toString() || '连接失败';
                if (isEmby) SYNC_ERROR = server.statusMsg;
                else JELLYFIN_SYNC_ERROR = server.statusMsg;
            }
        }

        // 保存所有服务器，保留其他类型的服务器配置不被覆盖
        const allServers = getServers();
        const otherServers = allServers.filter(s => (s.type || 'emby') !== type);
        saveServers([...otherServers, ...servers]);

        if (hasSuccess) {
            if (isEmby) SYNC_ERROR = '';
            else JELLYFIN_SYNC_ERROR = '';
        } else if (servers.length > 0) {
            if (isEmby && !SYNC_ERROR) SYNC_ERROR = '所有服务器连接失败';
            else if (!isEmby && !JELLYFIN_SYNC_ERROR) JELLYFIN_SYNC_ERROR = '所有服务器连接失败';
        }

        GM_setValue(errorKey, isEmby ? SYNC_ERROR : JELLYFIN_SYNC_ERROR);
        if (isEmby) {
            LIBRARY_INDEX = newIndex;
            GM_setValue(indexKey, JSON.stringify(LIBRARY_INDEX));
            LAST_SYNC_TIME = Date.now();
        } else {
            JELLYFIN_LIBRARY_INDEX = newIndex;
            GM_setValue(indexKey, JSON.stringify(JELLYFIN_LIBRARY_INDEX));
            JELLYFIN_LAST_SYNC_TIME = Date.now();
        }
        GM_setValue(lastSyncKey, Date.now());

        console.log(`JavdbBuddy: ${type} 全量同步完成，共计 ${totalCount} 个番号。`);
    }

    // 分页获取媒体服务器所有项目（Emby / Jellyfin API 兼容）
    function fetchAllMediaItems(server) {
        return new Promise((resolve, reject) => {
            const apiUrl = `${server.url}/Items?Recursive=true&IncludeItemTypes=Movie&Fields=Path&api_key=${server.apiKey}`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                timeout: 10000,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data.Items || []);
                        } catch (e) { reject('数据解析失败'); }
                    } else if (response.status === 401) {
                        reject('API Key 错误');
                    } else {
                        reject(`连接失败 (${response.status})`);
                    }
                },
                onerror: function() { reject('地址错误或无法连接'); },
                ontimeout: function() { reject('连接超时'); }
            });
        });
    }

    // 获取列表项中的详情页链接（兼容原生列表和 自定义列表）
    function getDetailLink(itemEl) {
        const link = itemEl.querySelector('a[href^="/v/"]');
        if (link) return link;
        if (itemEl.tagName === 'A' && itemEl.getAttribute('href')?.startsWith('/v/')) return itemEl;
        return null;
    }

    // 番号提取正则优化
    function extractCodeFromTitle(text) {
        if (!text) return null;
        text = text.trim();
        
        // 1. 匹配标准番号 (ABC-123, ABC_123, T28-123)
        const standardMatch = text.match(/([A-Z0-9]{2,12}[-_][A-Z0-9]{2,10}|[A-Z]{2,10}\d{3,6})/i);
        if (standardMatch) return standardMatch[1].toUpperCase();

        // 2. 匹配开头的一串字符（处理像 DigitalPlayground 或 012426_01 这种）
        const firstWordMatch = text.match(/^([a-z0-9_-]{3,25})/i);
        if (firstWordMatch) {
            const code = firstWordMatch[1];
            // 排除掉一些太通用的词
            if (!['THE', 'THIS', 'WHAT', 'WITH'].includes(code.toUpperCase())) {
                return code.toUpperCase();
            }
        }

        return null;
    }

    // 检查同步
    const embyNeedsSync = getServersByType('emby').length > 0 && Date.now() - LAST_SYNC_TIME > SYNC_INTERVAL;
    const jellyfinNeedsSync = getServersByType('jellyfin').length > 0 && Date.now() - JELLYFIN_LAST_SYNC_TIME > SYNC_INTERVAL;
    if (embyNeedsSync || jellyfinNeedsSync) {
        syncFullLibrary().catch(e => console.error('自动同步失败', e));
    }

    // 菜单
    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('🔄 立即同步媒体库', () => syncFullLibrary(manualSyncCallback));
            GM_registerMenuCommand('⚙️ 媒体服务器设置', showSettingsDialog);
        }
    } catch (e) {
        console.warn('[JB] GM_registerMenuCommand 不可用:', e);
    }

    function manualSyncCallback() {
        syncFullLibrary(true);
    }

    // 设置对话框
    function showSettingsDialog(activeTab = '') {
        const servers = getServers();

        // 辅助函数：生成单个服务器卡片HTML
        function renderServerCardHTML(server, index) {
            const shouldExpand = !server.url || !server.apiKey;
            const arrowIcon = shouldExpand ? '▲' : '▼';
            let statusHtml = '';
            if (server.lastError) {
                statusHtml = `<span style="margin-left:10px;padding:1px 6px;background:#ff9800;color:white;border-radius:3px;font-size:10px;font-weight:normal;">${server.statusMsg || '连接失败'}</span>`;
            } else if (server.statusMsg === '在线已连接') {
                statusHtml = `<span style="margin-left:10px;padding:1px 6px;background:#4CAF50;color:white;border-radius:3px;font-size:10px;font-weight:normal;">在线已连接</span>`;
            } else {
                statusHtml = `<span style="margin-left:10px;padding:1px 6px;background:#9e9e9e;color:white;border-radius:3px;font-size:10px;font-weight:normal;">待同步/未连接</span>`;
            }
            const serverType = server.type || 'emby';
            const typeLabel = serverType === 'emby' ? 'Emby' : 'Jellyfin';
            return `
            <div class="server-item" data-index="${index}" style="border:1px solid #ddd;margin-bottom:10px;border-radius:4px;">
                <div class="server-header" style="padding:12px 15px;background:#f8f9fa;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="const body = document.getElementById('server-body-${index}'); const arrow = document.getElementById('server-arrow-${index}'); body.style.display = body.style.display === 'none' ? 'block' : 'none'; arrow.textContent = body.style.display === 'none' ? '▼' : '▲';">
                    <div style="display:flex;align-items:center;">
                        <span style="margin-right:8px;padding:1px 6px;background:${serverType === 'emby' ? '#4CAF50' : '#673AB7'};color:white;border-radius:3px;font-size:10px;">${typeLabel}</span>
                        <strong style="font-size:14px;">${server.name || typeLabel}</strong>
                        ${statusHtml}
                    </div>
                    <span id="server-arrow-${index}" style="color:#999;font-size:12px;transition:transform 0.2s;">${arrowIcon}</span>
                </div>
                <div id="server-body-${index}" style="padding:15px;display:${shouldExpand ? 'block' : 'none'};">
                    <input type="hidden" id="type-${index}" value="${serverType}" />
                    <div style="margin-bottom:8px;">
                        <label style="display:inline-block;width:140px;font-weight:bold;">服务器名称：</label>
                        <input type="text" id="name-${index}" value="${server.name === '新服务器' || !server.name ? typeLabel : server.name}" placeholder="例如：主服务器" style="width:calc(100% - 150px);padding:5px;" />
                    </div>
                    <div style="margin-bottom:8px;">
                        <label style="display:inline-block;width:140px;font-weight:bold;">服务器地址：</label>
                        <input type="text" id="url-${index}" value="${server.url}" placeholder="例如：http://192.168.1.100:8096" style="width:calc(100% - 150px);padding:5px;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:inline-block;width:140px;font-weight:bold;">API Key：</label>
                        <input type="text" id="key-${index}" value="${server.apiKey}" placeholder="32位API密钥" style="width:calc(100% - 150px);padding:5px;" />
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="connect-server-btn" data-index="${index}" style="background:#2196F3;color:white;border:none;padding:5px 15px;border-radius:3px;cursor:pointer;">连接</button>
                        <button class="remove-server-btn" data-index="${index}" style="background:#f44336;color:white;border:none;padding:5px 15px;border-radius:3px;cursor:pointer;">删除</button>
                    </div>
                </div>
            </div>`;
        }

        const overlay = document.createElement('div');
        overlay.id = 'emby-settings-overlay';
        overlay.style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;';
        
        const version = typeof GM_info !== 'undefined' && GM_info.script?.version ? GM_info.script.version : '0.7.0';
        // 读取通用设置（必须在 HTML 模板之前定义，否则会导致 Temporal Dead Zone 错误）
        const enableHoverZoom = GM_getValue('jb_enable_hover_zoom', false);
        const openInNewTab = GM_getValue('jb_open_in_new_tab', false);
        const openAllLinksInNewTab = GM_getValue('jb_open_all_links_in_new_tab', true);
        const openInPopup = GM_getValue('jb_open_in_popup', false);
        const showEmbyStatus = GM_getValue('jb_show_emby_status', true);
        const showJellyfinStatus = GM_getValue('jb_show_jellyfin_status', false);
        const showSubtitleSearch = GM_getValue('jb_show_subtitle_search', false);
        const showListSearch = GM_getValue('jb_show_list_search', true);
        const enableAutoPaging = GM_getValue('jb_enable_autopaging', true);
        const enableBtSearch = GM_getValue('jb_enable_bt_search', true);
        const portraitCards = GM_getValue('jb_portrait_cards', false);
        const cardFx = GM_getValue('jb_card_fx', true);
        const cardColumns = GM_getValue('jb_card_columns', 5);
        const pageZoom = GM_getValue('jb_page_zoom', jbPageZoomDefault());
        const previewMode = GM_getValue('jb_preview_mode', 'screenshot');
        const webdavUrl = GM_getValue('jb_webdav_url', '');
        const webdavUser = GM_getValue('jb_webdav_user', '');
        const webdavPass = GM_getValue('jb_webdav_pass', '');
        let html = `
            <div style="background:white;border-radius:8px;width:800px;height:80vh;display:flex;overflow:hidden;font-family:sans-serif;color:#333;">
                <!-- 左侧分类栏 -->
                <div style="width:170px;background:#f8f9fa;border-right:1px solid #e0e0e0;display:flex;flex-direction:column;flex-shrink:0;">
                    <div style="padding:20px 16px;font-size:18px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">设置</div>
                    <div style="flex:1;overflow-y:auto;padding:10px 0;">
                        <div class="jb-setting-tab active" data-tab="tab-general" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#333;border-left:3px solid #2196F3;background:#e3f2fd;display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">⚙️</span><span>通用设置</span></div>
                        <div class="jb-setting-tab" data-tab="tab-emby" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#666;border-left:3px solid transparent;display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">🖥️</span><span>媒体服务器配置</span></div>
                        <div class="jb-setting-tab" data-tab="tab-backup" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#666;border-left:3px solid transparent;display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">☁️</span><span>备份与恢复</span></div>
                        <div class="jb-setting-tab" data-tab="tab-promo" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#666;border-left:3px solid transparent;display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">🚀</span><span>福利推荐</span></div>
                        <div class="jb-setting-tab" data-tab="tab-about" style="padding:10px 16px;cursor:pointer;font-size:14px;color:#666;border-left:3px solid transparent;display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">💖</span><span>关于打赏</span></div>
                    </div>
                    <div style="padding:12px 16px;border-top:1px solid #e0e0e0;color:#999;font-size:11px;text-align:center;">V${version}</div>
                </div>
                <!-- 右侧内容区 -->
                <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                    <div style="padding:15px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                        <span id="jb-setting-title" style="font-size:16px;font-weight:bold;color:#333;">通用设置</span>
                        <span id="close-settings-btn" style="cursor:pointer;font-size:24px;color:#999;line-height:1;user-select:none;">&times;</span>
                    </div>
                    <div id="jb-setting-content" style="flex:1;overflow-y:auto;padding:20px;">
                        <div id="tab-general" class="jb-tab-content">
                            <div style="display:flex;flex-direction:column;gap:15px;">
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-hover-zoom" ${enableHoverZoom ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>启用悬浮大图</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-open-new-tab" ${openInNewTab ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>启用列表页新窗口打开</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-open-all-links" ${openAllLinksInNewTab ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>启用所有连接都在新窗口打开</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-open-popup" ${openInPopup ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>弹窗方式打开详情页</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-show-emby-status" ${showEmbyStatus ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>显示 Emby 入库状态</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-show-jellyfin-status" ${showJellyfinStatus ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>显示 Jellyfin 入库状态</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-show-subtitle-search" ${showSubtitleSearch ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>启用字幕搜索</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-show-list-search" ${showListSearch ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>显示列表页快捷搜索按钮（6 个站点）</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-autopaging" ${enableAutoPaging ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>启用无缝翻页（列表页滚动自动加载下一页）</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-bt-search" ${enableBtSearch ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>启用BT聚合磁力搜索（磁力弹窗增加多站点搜索标签）</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-portrait-cards" ${portraitCards ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>竖图模式（封面切换为竖版大图）</span>
                                </label>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#555;">
                                    <input type="checkbox" id="jb-card-fx" ${cardFx ? 'checked' : ''} style="cursor:pointer;width:16px;height:16px;">
                                    <span>卡片动画（悬停上浮效果）</span>
                                </label>
                                <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#555;">
                                    <span style="white-space:nowrap;">卡片列数：</span>
                                    <input type="range" id="jb-card-columns" min="2" max="10" step="1" value="${cardColumns}" style="flex:1;max-width:220px;cursor:pointer;">
                                    <span id="jb-card-columns-value" style="min-width:22px;text-align:center;color:#2196F3;font-weight:bold;">${cardColumns}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#555;">
                                    <span style="white-space:nowrap;">页面宽度：</span>
                                    <input type="range" id="jb-page-zoom" min="60" max="100" step="1" value="${pageZoom}" style="flex:1;max-width:220px;cursor:pointer;">
                                    <span id="jb-page-zoom-value" style="min-width:38px;text-align:center;color:#2196F3;font-weight:bold;">${pageZoom}%</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:8px;font-size:14px;color:#555;margin-top:4px;">
                                    <span style="white-space:nowrap;">列表页预览方式：</span>
                                    <select id="jb-preview-mode" style="height:30px;border:1px solid #cbd5e1;border-radius:6px;padding:1px 6px;background:#fff;color:#172033;font-size:13px;cursor:pointer;">
                                        <option value="javdb" ${previewMode === 'javdb' ? 'selected' : ''}>JavDB 预览图（多图+演员）</option>
                                        <option value="screenshot" ${previewMode === 'screenshot' ? 'selected' : ''}>外部截图长图（javstore / javfree 两站）</option>
                                    </select>
                                </div>
                                </div>
                            </div>
                        </div>

                        <div id="tab-emby" class="jb-tab-content" style="display:none;">
                            <div style="margin-bottom:15px;color:#666;font-size:12px;">Emby 上次同步: ${LAST_SYNC_TIME ? new Date(LAST_SYNC_TIME).toLocaleString() : '尚未同步'} | Jellyfin 上次同步: ${JELLYFIN_LAST_SYNC_TIME ? new Date(JELLYFIN_LAST_SYNC_TIME).toLocaleString() : '尚未同步'}</div>
                            <div style="background:#f0f8ff;border-left:3px solid #2196F3;padding:12px;margin-bottom:15px;font-size:13px;line-height:1.6;">
                                <strong>📖 使用说明：</strong><br>
                                1. <strong>添加服务器</strong>：点击下方绿色按钮，选择服务器类型（Emby / Jellyfin），填写名称、地址和 API Key。<br>
                                2. <strong>获取 API Key</strong>：登录 Emby 后台 → 设置 → 高级 → API 密钥 → 新建；Jellyfin 后台 → 控制台 → 高级 → API 密钥 → 新建。<br>
                                3. <strong>保存并同步</strong>：点击下方蓝色按钮，脚本将<strong>立即连接</strong>所有已填写的服务器并<strong>全量抓取</strong>番号数据。只有同步成功后，页面才会显示入库状态。<br>
                                4. <strong>入库检查方式</strong>：脚本会同步服务器中所有视频的标题并建立本地索引，实现秒级比对。同时脚本具备<strong>实时秒同步</strong>能力，当您在服务器中<strong>增加或删除</strong>媒体视频后，页面状态也会实时感知并同步更新，无需手动干预。
                            </div>
                            <!-- Emby 区域 -->
                            <div style="margin-bottom:20px;">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #4CAF50;">
                                    <span style="padding:2px 8px;background:#4CAF50;color:white;border-radius:3px;font-size:12px;">Emby</span>
                                    <strong style="font-size:15px;">Emby 服务器配置</strong>
                                </div>
                                <div id="emby-server-list-container">`;
        servers.forEach((server, index) => {
            if ((server.type || 'emby') === 'emby') {
                html += renderServerCardHTML(server, index);
            }
        });
        html += `
                                </div>
                                <button id="add-emby-server-btn" style="background:#4CAF50;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;margin-top:10px;">➕ 添加 Emby 服务器</button>
                            </div>
                            <!-- Jellyfin 区域 -->
                            <div style="margin-bottom:20px;">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #673AB7;">
                                    <span style="padding:2px 8px;background:#673AB7;color:white;border-radius:3px;font-size:12px;">Jellyfin</span>
                                    <strong style="font-size:15px;">Jellyfin 服务器配置</strong>
                                </div>
                                <div id="jellyfin-server-list-container">`;
        servers.forEach((server, index) => {
            if ((server.type || 'emby') === 'jellyfin') {
                html += renderServerCardHTML(server, index);
            }
        });
        html += `
                                </div>
                                <button id="add-jellyfin-server-btn" style="background:#673AB7;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;margin-top:10px;">➕ 添加 Jellyfin 服务器</button>
                            </div>
                            <div style="display:flex;gap:10px;margin-top:15px;">
                                <button id="save-servers-btn" style="background:#2196F3;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;" title="保存所有服务器配置并立即同步媒体库">💾 保存并同步</button>
                            </div>
                        </div>

                        <div id="tab-backup" class="jb-tab-content" style="display:none;">
                            <div style="display:flex;flex-direction:column;gap:20px;">
                                <div>
                                    <h4 style="margin:0 0 10px 0;font-size:14px;color:#333;">☁️ WebDAV 备份</h4>
                                    <div style="display:flex;flex-direction:column;gap:10px;max-width:500px;">
                                        <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:4px;padding:10px 12px;font-size:12px;color:#555;line-height:1.6;">
                                            <div style="font-weight:bold;color:#333;margin-bottom:4px;">💡 地址填写说明</div>
                                            <div>• 通用格式：<code style="background:#e9ecef;padding:1px 4px;border-radius:3px;">http(s)://IP:端口/文件夹路径</code></div>
                                            <div>• <b>Alist 用户</b>：必须带 <code style="background:#e9ecef;padding:1px 4px;border-radius:3px;">/dav/</code> 路径，例如：<code style="background:#e9ecef;padding:1px 4px;border-radius:3px;">http://192.168.1.10:5244/dav/夸克网盘/备份</code></div>
                                            <div>• 若地址不含 <code style="background:#e9ecef;padding:1px 4px;border-radius:3px;">/dav/</code> 且端口为 5244，脚本会自动补全</div>
                                            <div>• 中文路径可直接粘贴，脚本会自动编码</div>
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <label style="display:inline-block;width:80px;font-size:13px;color:#666;">服务器地址：</label>
                                            <input type="text" id="jb-webdav-url" value="${webdavUrl.replace(/"/g,'&quot;')}" placeholder="https://dav.example.com/javdb/" style="flex:1;padding:8px;font-size:13px;border:1px solid #ddd;border-radius:4px;">
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <label style="display:inline-block;width:80px;font-size:13px;color:#666;">用户名：</label>
                                            <input type="text" id="jb-webdav-user" value="${webdavUser.replace(/"/g,'&quot;')}" placeholder="user" style="flex:1;padding:8px;font-size:13px;border:1px solid #ddd;border-radius:4px;">
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;">
                                            <label style="display:inline-block;width:80px;font-size:13px;color:#666;">密码：</label>
                                            <input type="password" id="jb-webdav-pass" value="${webdavPass.replace(/"/g,'&quot;')}" placeholder="password" style="flex:1;padding:8px;font-size:13px;border:1px solid #ddd;border-radius:4px;">
                                        </div>
                                        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                                            <button id="jb-webdav-save-btn" style="background:#607D8B;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;">💾 保存配置</button>
                                            <button id="jb-webdav-test-btn" style="background:#2196F3;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;">🔌 测试连接</button>
                                            <button id="jb-webdav-backup-btn" style="background:#FF9800;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;">⬆️ 备份到WebDAV</button>
                                            <button id="jb-webdav-restore-btn" style="background:#9C27B0;color:white;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-size:13px;">⬇️ 从WebDAV恢复</button>
                                        </div>
                                        <div id="jb-webdav-msg" style="font-size:13px;color:#666;min-height:20px;margin-top:5px;"></div>
                                    </div>
                                </div>
                                <div style="border-top:1px solid #eee;padding-top:15px;">
                                    <h4 style="margin:0 0 10px 0;font-size:14px;color:#333;">💾 本地备份与恢复</h4>
                                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                        <button id="backup-btn" style="background:#FF9800;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:13px;">📥 备份配置</button>
                                        <button id="restore-btn" style="background:#9C27B0;color:white;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-size:13px;">📤 恢复配置</button>
                                    </div>
                                </div>
                                <input type="file" id="restore-file-input" accept=".json" style="display:none;">
                            </div>
                        </div>

                        <div id="tab-promo" class="jb-tab-content" style="display:none;">
                            <div style="max-width:640px;margin:0 auto;">
                                <!-- 主推卡片 -->
                                <div style="background:linear-gradient(135deg,#1a237e 0%,#4a148c 60%,#880e4f 100%);border-radius:10px;padding:26px 24px;color:#fff;position:relative;overflow:hidden;">
                                    <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>
                                    <div style="position:absolute;bottom:-50px;right:30px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
                                    <div style="font-size:22px;font-weight:bold;margin-bottom:6px;">🌌 M78星云</div>
                                    <div style="font-size:14px;opacity:0.92;line-height:1.7;">看片党自用机场 · IEPL 专线直达，晚高峰 4K 畅快看</div>
                                    <div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:8px 14px;font-size:13px;">
                                        <span style="font-size:16px;">🎁</span>
                                        <span><b>购买套餐即赠：Emby 影视库 + 成人 Emby 影视库</b>，海量资源开箱即看</span>
                                    </div>
                                </div>

                                <!-- 卖点卡片 -->
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">
                                    <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:14px 16px;">
                                        <div style="font-size:13px;font-weight:bold;color:#333;margin-bottom:5px;">⚡ IEPL 专线极速</div>
                                        <div style="font-size:12px;color:#666;line-height:1.6;">中转 + IEPL 专线网络，峰值带宽高达 5Gbps，晚高峰播放 4K 无卡顿</div>
                                    </div>
                                    <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:14px 16px;">
                                        <div style="font-size:13px;font-weight:bold;color:#333;margin-bottom:5px;">🌍 20+ 全球节点</div>
                                        <div style="font-size:12px;color:#666;line-height:1.6;">港日新台美常用地区全覆盖，更有土耳其、乌克兰等稀有地区，解锁流媒体</div>
                                    </div>
                                    <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:14px 16px;">
                                        <div style="font-size:13px;font-weight:bold;color:#333;margin-bottom:5px;">📱 全平台无缝衔接</div>
                                        <div style="font-size:12px;color:#666;line-height:1.6;">安卓 / 苹果 / PC / 软路由全支持，提供一键客户端，小白也能轻松上手</div>
                                    </div>
                                    <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:14px 16px;">
                                        <div style="font-size:13px;font-weight:bold;color:#e65100;margin-bottom:5px;">🎁 双 Emby 影视库赠送</div>
                                        <div style="font-size:12px;color:#666;line-height:1.6;">购买套餐赠送 Emby 影视库 + 成人 Emby 影视库，配合本脚本入库状态显示，追片更爽</div>
                                    </div>
                                </div>

                                <!-- CTA -->
                                <div style="text-align:center;margin-top:20px;">
                                    <a href="https://invite.m78star.cn/#/register?code=mHlkrWyl" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#7c4dff,#536dfe);color:#fff;text-decoration:none;font-size:16px;font-weight:bold;padding:13px 38px;border-radius:24px;box-shadow:0 4px 14px rgba(124,77,255,0.35);transition:all 0.2s;">🚀 立即注册，领取 Emby 影视库</a>
                                    <p style="margin:12px 0 0 0;color:#999;font-size:12px;">注册后选择任意套餐购买即可获赠 · 老牌机场，稳定可靠</p>
                                </div>
                            </div>
                        </div>

                        <div id="tab-about" class="jb-tab-content" style="display:none;">
                            <div style="text-align:center;padding:10px 0 30px;">
                                <h3 style="margin:0 0 6px 0;color:#333;">JAVDB全能助手</h3>
                                <p style="margin:0 0 20px 0;color:#666;font-size:13px;">by: 潇洒公子</p>
                                <p style="margin:0 0 25px 0;color:#999;font-size:12px;">Version ${version}</p>
                                <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
                                    <div>
                                        <img src="https://raw.githubusercontent.com/86168057/JavdbBuddy/main/%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81/%E5%BE%AE%E4%BF%A1%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81.png" style="width:200px;height:200px;object-fit:contain;border:1px solid #eee;border-radius:4px;cursor:pointer;" alt="微信" onclick="const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999999;display:flex;align-items:center;justify-content:center;cursor:pointer;';d.onclick=()=>d.remove();const i=document.createElement('img');i.src=this.src;i.style.maxWidth='90vw';i.style.maxHeight='90vh';i.style.objectFit='contain';d.appendChild(i);document.body.appendChild(d);">
                                        <p style="margin:5px 0 0 0;color:#666;font-size:12px;">微信</p>
                                    </div>
                                    <div>
                                        <img src="https://raw.githubusercontent.com/86168057/JavdbBuddy/main/%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81/%E6%94%AF%E4%BB%98%E5%AE%9D%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81.png" style="width:200px;height:200px;object-fit:contain;border:1px solid #eee;border-radius:4px;cursor:pointer;" alt="支付宝" onclick="const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999999;display:flex;align-items:center;justify-content:center;cursor:pointer;';d.onclick=()=>d.remove();const i=document.createElement('img');i.src=this.src;i.style.maxWidth='90vw';i.style.maxHeight='90vh';i.style.objectFit='contain';d.appendChild(i);document.body.appendChild(d);">
                                        <p style="margin:5px 0 0 0;color:#666;font-size:12px;">支付宝</p>
                                    </div>
                                </div>
                                <div style="margin-top:20px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
                                    <a href="https://greasyfork.org/scripts?q=JavdbBuddy" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;color:#333;text-decoration:none;font-size:13px;transition:all 0.2s;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                        <span>油猴脚本</span>
                                    </a>
                                    <a href="https://github.com/86168057/JavdbBuddy" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;color:#333;text-decoration:none;font-size:13px;transition:all 0.2s;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"></path></svg>
                                        <span>GitHub 仓库</span>
                                    </a>
                                </div>
                                <p style="margin-top:20px;color:#e91e63;font-size:13px;">💖 感谢支持，如果觉得脚本好用，欢迎打赏一杯咖啡 ☕</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
        // 锁定背景滚动
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        // 分类切换逻辑
        const tabs = overlay.querySelectorAll('.jb-setting-tab');
        const contents = overlay.querySelectorAll('.jb-tab-content');
        const titleEl = overlay.querySelector('#jb-setting-title');
        const tabTitles = { 'tab-general': '通用设置', 'tab-emby': '媒体服务器配置', 'tab-backup': '备份与恢复', 'tab-promo': '福利推荐', 'tab-about': '关于打赏' };
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                tabs.forEach(t => { t.classList.remove('active'); t.style.background = 'transparent'; t.style.color = '#666'; t.style.borderLeftColor = 'transparent'; t.style.fontWeight = 'normal'; });
                tab.classList.add('active'); tab.style.background = '#e3f2fd'; tab.style.color = '#333'; tab.style.borderLeftColor = '#2196F3'; tab.style.fontWeight = 'bold';
                contents.forEach(c => c.style.display = 'none');
                const targetContent = overlay.querySelector('#' + target);
                if (targetContent) targetContent.style.display = 'block';
                if (titleEl) titleEl.textContent = tabTitles[target] || '';
            });
        });

        // 如果传入了 activeTab，自动切换到该标签页
        if (activeTab) {
            const targetTab = overlay.querySelector(`.jb-setting-tab[data-tab="${activeTab}"]`);
            if (targetTab) targetTab.click();
        }

        // 自动保存逻辑 (不再包含未连接成功的服务器)
        const autoSave = () => {
            let changed = false;
            const newServers = [];
            servers.forEach((s, index) => {
                const name = document.getElementById(`name-${index}`)?.value.trim();
                const url = document.getElementById(`url-${index}`)?.value.trim();
                const apiKey = document.getElementById(`key-${index}`)?.value.trim();
                
                if (url && apiKey) {
                    const normalizedUrl = url.replace(/\/$/, '');
                    // 如果地址没变且没有错误，或者它是之前连接成功的，我们保留
                    // 如果地址变了，我们不在此处保存它为"已验证"状态
                    if (normalizedUrl === s.url && apiKey === s.apiKey) {
                        newServers.push({
                            ...s,
                            name: name || 'emby'
                        });
                    }
                }
            });
            saveServers(newServers);
        };

        // 点击背景自动保存并关闭
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                autoSave();
                overlay.remove();
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
            }
        };
        
        document.getElementById('close-settings-btn').onclick = () => {
            autoSave();
            overlay.remove();
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
        function addServerByType(type) {
            const newIndex = servers.length;
            const defaultName = type === 'emby' ? 'emby' : 'jellyfin';
            servers.push({ url: '', apiKey: '', name: defaultName, type: type });
            saveServers(servers);
            const containerId = type === 'emby' ? 'emby-server-list-container' : 'jellyfin-server-list-container';
            const container = document.getElementById(containerId);
            if (!container) return;
            const statusHtml = `<span style="margin-left:10px;padding:1px 6px;background:#9e9e9e;color:white;border-radius:3px;font-size:10px;font-weight:normal;">待同步/未连接</span>`;
            const typeLabel = type === 'emby' ? 'Emby' : 'Jellyfin';
            const bgColor = type === 'emby' ? '#4CAF50' : '#673AB7';
            const itemHtml = `
            <div class="server-item" style="border:1px solid #ddd;margin-bottom:10px;border-radius:4px;">
                <div class="server-header" style="padding:12px 15px;background:#f8f9fa;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" onclick="const body = document.getElementById('server-body-${newIndex}'); const arrow = document.getElementById('server-arrow-${newIndex}'); body.style.display = body.style.display === 'none' ? 'block' : 'none'; arrow.textContent = body.style.display === 'none' ? '▼' : '▲';">
                    <div style="display:flex;align-items:center;">
                        <span style="margin-right:8px;padding:1px 6px;background:${bgColor};color:white;border-radius:3px;font-size:10px;">${typeLabel}</span>
                        <strong style="font-size:14px;">${defaultName}</strong>
                        ${statusHtml}
                    </div>
                    <span id="server-arrow-${newIndex}" style="color:#999;font-size:12px;transition:transform 0.2s;">▲</span>
                </div>
                <div id="server-body-${newIndex}" style="padding:15px;display:block;">
                    <input type="hidden" id="type-${newIndex}" value="${type}" />
                    <div style="margin-bottom:8px;">
                        <label style="display:inline-block;width:140px;font-weight:bold;">服务器名称：</label>
                        <input type="text" id="name-${newIndex}" value="${defaultName}" placeholder="例如：主服务器" style="width:calc(100% - 150px);padding:5px;" />
                    </div>
                    <div style="margin-bottom:8px;">
                        <label style="display:inline-block;width:140px;font-weight:bold;">服务器地址：</label>
                        <input type="text" id="url-${newIndex}" value="" placeholder="例如：http://192.168.1.100:8096" style="width:calc(100% - 150px);padding:5px;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="display:inline-block;width:140px;font-weight:bold;">API Key：</label>
                        <input type="text" id="key-${newIndex}" value="" placeholder="32位API密钥" style="width:calc(100% - 150px);padding:5px;" />
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="connect-server-btn" data-index="${newIndex}" style="background:#2196F3;color:white;border:none;padding:5px 15px;border-radius:3px;cursor:pointer;">连接</button>
                        <button class="remove-server-btn" data-index="${newIndex}" style="background:#f44336;color:white;border:none;padding:5px 15px;border-radius:3px;cursor:pointer;">删除</button>
                    </div>
                </div>
            </div>`;
            container.insertAdjacentHTML('beforeend', itemHtml);
            const newConnectBtn = overlay.querySelector(`.connect-server-btn[data-index="${newIndex}"]`);
            const newRemoveBtn = overlay.querySelector(`.remove-server-btn[data-index="${newIndex}"]`);
            if (newConnectBtn) newConnectBtn.onclick = function() { handleConnect(this); };
            if (newRemoveBtn) newRemoveBtn.onclick = function() { handleRemove(this); };
        }

        document.getElementById('add-emby-server-btn').onclick = () => addServerByType('emby');
        document.getElementById('add-jellyfin-server-btn').onclick = () => addServerByType('jellyfin');
        document.getElementById('save-servers-btn').onclick = () => {
            const newServers = [];
            servers.forEach((_, index) => {
                const url = document.getElementById(`url-${index}`)?.value.trim() || '';
                if (url) {
                    newServers.push({
                        url: url.replace(/\/$/, ''),
                        apiKey: document.getElementById(`key-${index}`)?.value.trim() || '',
                        name: document.getElementById(`name-${index}`)?.value.trim() || 'emby',
                        type: document.getElementById(`type-${index}`)?.value || 'emby'
                    });
                }
            });
            saveServers(newServers);
            overlay.remove();
            syncFullLibrary(true);
        };
        
        // 备份配置
        document.getElementById('backup-btn').onclick = () => {
            const config = {
                servers: getServers(),
                libraryIndex: LIBRARY_INDEX,
                jellyfinLibraryIndex: JELLYFIN_LIBRARY_INDEX,
                lastSyncTime: LAST_SYNC_TIME,
                jellyfinLastSyncTime: JELLYFIN_LAST_SYNC_TIME,
                backupTime: new Date().toISOString()
            };
            const json = JSON.stringify(config, null, 2);
            const defaultName = `javdb-emby-backup-${new Date().toISOString().slice(0,10)}.json`;

            // 优先尝试 File System Access API，让用户选择保存路径
            // Tampermonkey 隔离上下文中 window 不是真顶层 window，必须用 unsafeWindow 访问浏览器原生 API
            const realWindow = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
            if (typeof realWindow.showSaveFilePicker === 'function') {
                let pickerPromise;
                try {
                    pickerPromise = realWindow.showSaveFilePicker({
                        suggestedName: defaultName,
                        types: [{
                            description: 'JSON 文件',
                            accept: { 'application/json': ['.json'] }
                        }]
                    });
                } catch (err) {
                    console.warn('[JavdbBuddy] showSaveFilePicker 同步调用失败:', err);
                }
                if (pickerPromise) {
                    pickerPromise.then(async handle => {
                        const writable = await handle.createWritable();
                        await writable.write(json);
                        await writable.close();
                    }).catch(err => {
                        if (err.name !== 'AbortError') {
                            console.warn('[JavdbBuddy] showSaveFilePicker 后续失败，fallback 到默认下载:', err);
                            fallbackDownload(json, defaultName);
                        }
                    });
                    return;
                }
            }

            fallbackDownload(json, defaultName);
        };

        function fallbackDownload(json, defaultName) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultName;
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // 恢复配置
        document.getElementById('restore-btn').onclick = () => {
            document.getElementById('restore-file-input').click();
        };
        
        document.getElementById('restore-file-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    if (config.servers) {
                        GM_setValue('emby_servers', JSON.stringify(config.servers));
                    }
                    if (config.libraryIndex) {
                        GM_setValue('emby_library_index', JSON.stringify(config.libraryIndex));
                        LIBRARY_INDEX = config.libraryIndex;
                    }
                    if (config.jellyfinLibraryIndex) {
                        GM_setValue('jellyfin_library_index', JSON.stringify(config.jellyfinLibraryIndex));
                        JELLYFIN_LIBRARY_INDEX = config.jellyfinLibraryIndex;
                    }
                    if (config.lastSyncTime) {
                        GM_setValue('emby_last_sync', config.lastSyncTime);
                        LAST_SYNC_TIME = config.lastSyncTime;
                    }
                    if (config.jellyfinLastSyncTime) {
                        GM_setValue('jellyfin_last_sync', config.jellyfinLastSyncTime);
                        JELLYFIN_LAST_SYNC_TIME = config.jellyfinLastSyncTime;
                    }
                    overlay.remove();
                    showSettingsDialog('tab-emby');
                } catch (err) {
                    console.error('配置文件格式错误：', err);
                }
            };
            reader.readAsText(file);
        };

        // 通用设置变更即时保存
        document.getElementById('jb-hover-zoom')?.addEventListener('change', (e) => {
            GM_setValue('jb_enable_hover_zoom', e.target.checked);
        });
        document.getElementById('jb-open-new-tab')?.addEventListener('change', (e) => {
            GM_setValue('jb_open_in_new_tab', e.target.checked);
            // 立即应用到当前页面
            applyListPageLinkTarget();
        });
        document.getElementById('jb-open-all-links')?.addEventListener('change', (e) => {
            GM_setValue('jb_open_all_links_in_new_tab', e.target.checked);
            // 立即应用到当前页面
            applyAllLinksTarget();
        });
        document.getElementById('jb-open-popup')?.addEventListener('change', (e) => {
            GM_setValue('jb_open_in_popup', e.target.checked);
            // 立即应用到当前页面
            applyListPagePopup();
        });
        document.getElementById('jb-show-emby-status')?.addEventListener('change', (e) => {
            GM_setValue('jb_show_emby_status', e.target.checked);
            refreshStatusIndicators();
        });
        document.getElementById('jb-show-jellyfin-status')?.addEventListener('change', (e) => {
            GM_setValue('jb_show_jellyfin_status', e.target.checked);
            refreshStatusIndicators();
        });
        document.getElementById('jb-show-subtitle-search')?.addEventListener('change', (e) => {
            GM_setValue('jb_show_subtitle_search', e.target.checked);
            refreshSubtitleIndicators();
        });
        document.getElementById('jb-show-list-search')?.addEventListener('change', (e) => {
            GM_setValue('jb_show_list_search', e.target.checked);
            // 立即生效：显示/隐藏所有列表页搜索面板（一个开关同时控制 6 个站点）
            document.querySelectorAll('.list-search-panel').forEach(el => {
                el.style.display = e.target.checked ? '' : 'none';
            });
        });
        document.getElementById('jb-autopaging')?.addEventListener('change', (e) => {
            GM_setValue('jb_enable_autopaging', e.target.checked);
            // 立即应用到当前页面
            if (e.target.checked) {
                window.__jbAutopageInited = false;
                initAutoPaging();
            } else {
                const loader = document.querySelector('.jb-autopage-scroll');
                if (loader) loader.remove();
            }
        });
        document.getElementById('jb-bt-search')?.addEventListener('change', (e) => {
            GM_setValue('jb_enable_bt_search', e.target.checked);
            showToast('设置已保存，刷新页面后生效');
        });
        document.getElementById('jb-portrait-cards')?.addEventListener('change', (e) => {
            GM_setValue('jb_portrait_cards', e.target.checked);
            jbApplyCardLayout(); // 立即生效
        });
        document.getElementById('jb-card-fx')?.addEventListener('change', (e) => {
            GM_setValue('jb_card_fx', e.target.checked);
            jbApplyCardLayout(); // 立即生效
        });
        document.getElementById('jb-card-columns')?.addEventListener('input', (e) => {
            const v = Math.min(10, Math.max(2, parseInt(e.target.value, 10) || 5));
            const label = document.getElementById('jb-card-columns-value');
            if (label) label.textContent = v;
            GM_setValue('jb_card_columns', v);
            jbApplyCardLayout(); // 拖动即时预览
        });
        document.getElementById('jb-page-zoom')?.addEventListener('input', (e) => {
            const v = Math.min(100, Math.max(60, parseInt(e.target.value, 10) || 100));
            const label = document.getElementById('jb-page-zoom-value');
            if (label) label.textContent = v + '%';
            GM_setValue('jb_page_zoom', v);
            jbApplyCardLayout(); // 拖动即时预览
        });
        document.getElementById('jb-preview-mode')?.addEventListener('change', (e) => {
            GM_setValue('jb_preview_mode', e.target.value);
            showToast(e.target.value === 'screenshot' ? '已切换为外部截图长图预览' : '已切换为 JavDB 预览图');
        });
        // WebDAV 配置保存
        document.getElementById('jb-webdav-save-btn')?.addEventListener('click', () => {
            const url = document.getElementById('jb-webdav-url')?.value.trim() || '';
            const user = document.getElementById('jb-webdav-user')?.value.trim() || '';
            const pass = document.getElementById('jb-webdav-pass')?.value || '';
            GM_setValue('jb_webdav_url', url);
            GM_setValue('jb_webdav_user', user);
            GM_setValue('jb_webdav_pass', pass);
            const msg = document.getElementById('jb-webdav-msg');
            if (msg) { msg.textContent = '✅ WebDAV 配置已保存'; msg.style.color = '#4CAF50'; }
            setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
        });

        // WebDAV 备份
        document.getElementById('jb-webdav-backup-btn')?.addEventListener('click', async () => {
            const msgEl = document.getElementById('jb-webdav-msg');
            if (msgEl) { msgEl.textContent = '⬆️ 正在备份到 WebDAV...'; msgEl.style.color = '#666'; }
            const result = await backupToWebDAV();
            if (msgEl) {
                msgEl.textContent = result.success ? '✅ ' + result.message : '❌ ' + result.message;
                msgEl.style.color = result.success ? '#4CAF50' : '#f44336';
            }
            setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 5000);
        });

        // WebDAV 恢复
        document.getElementById('jb-webdav-restore-btn')?.addEventListener('click', async () => {
            const msgEl = document.getElementById('jb-webdav-msg');
            if (msgEl) { msgEl.textContent = '⬇️ 正在从 WebDAV 恢复...'; msgEl.style.color = '#666'; }
            const result = await restoreFromWebDAV();
            if (msgEl) {
                msgEl.textContent = result.success ? '✅ ' + result.message + '，即将刷新' : '❌ ' + result.message;
                msgEl.style.color = result.success ? '#4CAF50' : '#f44336';
            }
            if (result.success) setTimeout(() => window.location.reload(), 800);
        });

        // WebDAV 测试连接
        document.getElementById('jb-webdav-test-btn')?.addEventListener('click', async () => {
            const msgEl = document.getElementById('jb-webdav-msg');
            if (msgEl) { msgEl.textContent = '🔌 正在测试连接...'; msgEl.style.color = '#666'; }
            const result = await testWebDAVConnection();
            if (msgEl) {
                msgEl.textContent = result.success ? '✅ ' + result.message : '❌ ' + result.message;
                msgEl.style.color = result.success ? '#4CAF50' : '#f44336';
            }
        });

        async function handleConnect(btn) {
            const index = parseInt(btn.getAttribute('data-index'));
            const name = document.getElementById(`name-${index}`)?.value.trim() || 'emby';
            const url = document.getElementById(`url-${index}`)?.value.trim();
            const apiKey = document.getElementById(`key-${index}`)?.value.trim();
            const serverType = document.getElementById(`type-${index}`)?.value || 'emby';
            const typeLabel = serverType === 'emby' ? 'Emby' : 'Jellyfin';

            if (!url || !apiKey) {
                console.warn('JavdbBuddy: 请填写完整的服务器地址和 API Key');
                return;
            }

            const originalText = btn.textContent;
            btn.textContent = '连接中...';
            btn.disabled = true;
            btn.style.opacity = '0.7';

            const tempServer = {
                url: url.replace(/\/$/, ''),
                apiKey: apiKey,
                name: name,
                type: serverType
            };

            try {
                const items = await new Promise((resolve, reject) => {
                    const apiUrl = `${tempServer.url}/Items?Recursive=true&IncludeItemTypes=Movie&Fields=Path&Limit=1&api_key=${tempServer.apiKey}`;
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: apiUrl,
                        timeout: 3000,
                        onload: function(response) {
                            if (response.status === 200) {
                                try {
                                    const data = JSON.parse(response.responseText);
                                    resolve(data.Items || []);
                                } catch (e) { reject('数据解析失败'); }
                            } else if (response.status === 401) {
                                reject(`${typeLabel} API Key 错误`);
                            } else {
                                reject(`连接失败 (${response.status})`);
                            }
                        },
                        onerror: function() { reject(`${typeLabel}服务器地址错误或未连接`); },
                        ontimeout: function() { reject(`${typeLabel}服务器连接超时`); }
                    });
                });

                servers[index] = {
                    ...tempServer,
                    lastError: false,
                    statusMsg: '在线已连接'
                };
                saveServers(servers);

                syncFullLibrary(false);

                overlay.remove();
                showSettingsDialog('tab-emby');
                initCheck();
            } catch (e) {
                servers[index].statusMsg = e.toString();
                servers[index].lastError = true;

                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';

                const statusTag = document.querySelector(`#server-body-${index}`).previousElementSibling.querySelector('span[id^="server-arrow-"]').previousElementSibling;
                if (statusTag) {
                    statusTag.innerHTML = `<span style="margin-left:10px;padding:1px 6px;background:#ff9800;color:white;border-radius:3px;font-size:10px;font-weight:normal;">${e.toString()}</span>`;
                }
            }
        }
        
        function handleRemove(btn) {
            const idx = parseInt(btn.getAttribute('data-index'));
            servers.splice(idx, 1);
            saveServers(servers);
            overlay.remove();
            showSettingsDialog('tab-emby');
        }

        overlay.querySelectorAll('.connect-server-btn').forEach(btn => {
            btn.onclick = function() { handleConnect(this); };
        });
        
        overlay.querySelectorAll('.remove-server-btn').forEach(btn => {
            btn.onclick = function() { handleRemove(this); };
        });
    }
    window.jbShowSettingsDialogFn = showSettingsDialog;

    // 样式
    const style = document.createElement('style');
    style.textContent = `
        .emby-status {
            display: inline-block;
            margin-left: 8px;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            vertical-align: middle;
            line-height: 1.5;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
            min-width: max-content !important;
            overflow: visible !important;
        }
        .emby-status-wrap {
            display: inline-flex !important;
            flex-direction: row !important;
            align-items: center;
            gap: 4px;
            flex-wrap: wrap;
            vertical-align: middle;
            min-width: fit-content !important;
            width: auto !important;
            flex-shrink: 0 !important;
        }
        .panel-block .emby-status-wrap {
            flex-shrink: 0 !important;
            min-width: fit-content !important;
        }
        .panel-block .value {
            white-space: nowrap !important;
            flex-shrink: 0 !important;
            min-width: max-content !important;
        }
        /* 字幕状态标签 */
        .subtitle-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            vertical-align: middle;
            line-height: 1.5;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
            cursor: pointer;
        }
        .subtitle-status.has-sub {
            background-color: #2196F3;
            color: white;
        }
        .subtitle-status.no-sub {
            background-color: #9e9e9e;
            color: white;
        }
        .subtitle-status.searching {
            background-color: #ffc107;
            color: #333;
        }
        /* 字幕结果弹窗 */
        .subtitle-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .subtitle-modal-window {
            background: #fff;
            color: #333;
            border-radius: 8px;
            width: 600px;
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: sans-serif;
            border: 1px solid #e0e0e0;
        }
        .subtitle-modal-header {
            padding: 15px 20px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .subtitle-modal-header span { font-size: 16px; font-weight: bold; }
        .subtitle-modal-close {
            cursor: pointer; font-size: 24px; color: #999; line-height: 1;
        }
        .subtitle-modal-body {
            padding: 15px 20px;
            overflow-y: auto;
            flex: 1;
        }
        .subtitle-item {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
            transition: all 0.2s;
        }
        .subtitle-item:hover {
            border-color: #2196F3;
            background: #f5f9ff;
        }
        .subtitle-item-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
            font-size: 14px;
        }
        .subtitle-item-meta {
            font-size: 12px;
            color: #666;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        .subtitle-item-source {
            color: #2196F3;
            font-size: 12px;
            margin-top: 4px;
        }
        .subtitle-item a {
            color: #2196F3;
            text-decoration: none;
        }
        .subtitle-item a:hover {
            text-decoration: underline;
        }
        /* 暗色模式适配 */
        html.is-dark .subtitle-modal-window,
        html.dark .subtitle-modal-window,
        body.is-dark .subtitle-modal-window,
        body.dark .subtitle-modal-window,
        [data-theme="dark"] .subtitle-modal-window {
            background: #1e1e1e !important;
            color: #e0e0e0 !important;
            border-color: #333 !important;
        }
        html.is-dark .subtitle-modal-header,
        html.dark .subtitle-modal-header,
        body.is-dark .subtitle-modal-header,
        body.dark .subtitle-modal-header,
        [data-theme="dark"] .subtitle-modal-header {
            border-bottom-color: #333 !important;
        }
        html.is-dark .subtitle-modal-close,
        html.dark .subtitle-modal-close,
        body.is-dark .subtitle-modal-close,
        body.dark .subtitle-modal-close,
        [data-theme="dark"] .subtitle-modal-close {
            color: #aaa !important;
        }
        html.is-dark .subtitle-item,
        html.dark .subtitle-item,
        body.is-dark .subtitle-item,
        body.dark .subtitle-item,
        [data-theme="dark"] .subtitle-item {
            border-color: #333 !important;
            background: #2a2a2a !important;
        }
        html.is-dark .subtitle-item:hover,
        html.dark .subtitle-item:hover,
        body.is-dark .subtitle-item:hover,
        body.dark .subtitle-item:hover,
        [data-theme="dark"] .subtitle-item:hover {
            border-color: #2196F3 !important;
            background: #1a2733 !important;
        }
        html.is-dark .subtitle-item-name,
        html.dark .subtitle-item-name,
        body.is-dark .subtitle-item-name,
        body.dark .subtitle-item-name,
        [data-theme="dark"] .subtitle-item-name {
            color: #e0e0e0 !important;
        }
        html.is-dark .subtitle-item-meta,
        html.dark .subtitle-item-meta,
        body.is-dark .subtitle-item-meta,
        body.dark .subtitle-item-meta,
        [data-theme="dark"] .subtitle-item-meta {
            color: #aaa !important;
        }
        html.is-dark .subtitle-item-source,
        html.dark .subtitle-item-source,
        body.is-dark .subtitle-item-source,
        body.dark .subtitle-item-source,
        [data-theme="dark"] .subtitle-item-source {
            color: #64b5f6 !important;
        }
        .emby-status.exists {
            background-color: #4CAF50;
            color: white;
            cursor: pointer !important;
        }
        .emby-status.not-exists {
            background-color: #f44336;
            color: white;
        }
        .emby-status.not-added {
            background-color: #9e9e9e;
            color: white;
        }
        .emby-status.error {
            background-color: #ff9800;
            color: white;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .grid-item, .movie-list .item { position: relative; }
        .grid-item .tags .emby-status,
        .movie-list .item .tags .emby-status {
            margin-right: 5px;
            margin-bottom: 5px;
        }
        /* 新增：第二行工具栏容器 */
        .emby-status-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 3px;
            margin-top: 5px;
            width: 100%;
        }
        .emby-tools-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 5px;
            width: 100%;
        }
        .emby-tools-row .emby-status, 
        .emby-tools-row .preview-toggle-btn, 
        .emby-tools-row .magnet-toggle-btn,
        .emby-tools-row .review-toggle-btn,
        .emby-tools-row .online-play-btn,
        .emby-tools-row .copy-code-btn,
        .emby-tools-row .jb-subtitle-btn {
            margin: 0 !important;
            padding: 2px 6px !important;
            font-size: clamp(9px, 1.2vw, 12px) !important;
            height: auto !important;
            min-height: 20px !important;
            line-height: 1.4 !important;
            white-space: nowrap;
        }
        
        /* 响应式：极小屏幕下缩小文字 */
        @media screen and (max-width: 480px) {
            .emby-tools-row .preview-toggle-btn,
            .emby-tools-row .magnet-toggle-btn,
            .emby-tools-row .review-toggle-btn,
            .emby-tools-row .online-play-btn,
            .emby-tools-row .copy-code-btn,
            .emby-tools-row .jb-subtitle-btn {
                font-size: 9px !important;
                padding: 1px 3px !important;
            }
        }
        
        /* 悬浮封面放大 */
        .jb-hover-zoom-img {
            position: fixed;
            z-index: 999999;
            border-radius: 8px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.45);
            pointer-events: none;
            opacity: 0;
            transform: scale(0.9);
            transition: opacity 0.25s ease, transform 0.25s ease;
            max-width: 650px;
            max-height: 930px;
            object-fit: contain;
            background: #000;
            border: 2px solid rgba(255,255,255,0.15);
        }
        .jb-hover-zoom-img.visible {
            opacity: 1;
            transform: scale(1.35);
        }

        /* 演员名单弹窗头部样式 */
        .actor-header-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            background: linear-gradient(135deg, #667eea22, #764ba222);
            border-radius: 8px;
            border: 1px solid #667eea33;
            align-items: center;
        }
        .actor-header-bar .actor-label {
            font-size: 12px;
            color: #666;
            font-weight: bold;
        }
        .actor-header-bar .actor-link {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            text-decoration: none;
            border: 1px solid transparent;
            transition: all 0.2s;
            margin: 0 2px;
        }
        .actor-header-bar .actor-link:hover {
            background: rgba(0,0,0,0.08);
            transform: translateY(-1px);
        }
        .actor-header-bar .actor-female {
            color: #e91e63 !important;
            background: rgba(233,30,99,0.08);
            border-color: rgba(233,30,99,0.2);
        }
        .actor-header-bar .actor-female:hover {
            background: rgba(233,30,99,0.15);
        }
        .actor-header-bar .actor-male {
            color: #2196f3 !important;
            background: rgba(33,150,243,0.08);
            border-color: rgba(33,150,243,0.2);
        }
        .actor-header-bar .actor-male:hover {
            background: rgba(33,150,243,0.15);
        }
        .actor-header-bar .actor-unknown {
            color: #888 !important;
        }
        
        /* 全屏查看器托盘图标样式 */
        .viewer-controls {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 1000001;
        }
        .viewer-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            backdrop-filter: blur(5px);
        }
        .viewer-btn:hover {
            background: rgba(255,255,255,0.4);
            transform: scale(1.1);
        }
        
        /* 弹窗样式 */
        #emby-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 2147483650;
            display: none;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
        }
        #emby-modal-window {
            background: white;
            width: 80%;
            max-width: 1000px;
            max-height: 85vh;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            animation: emby-modal-in 0.3s ease-out;
            overscroll-behavior: contain;
        }
        @keyframes emby-modal-in {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #emby-modal-header {
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #emby-modal-title {
            font-weight: bold;
            font-size: 16px;
            color: #333;
        }
        #emby-modal-close {
            cursor: pointer;
            font-size: 24px;
            color: #999;
            line-height: 1;
        }
        #emby-modal-close:hover { color: #333; }
        #emby-modal-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }
        
        .preview-toggle-btn, .magnet-toggle-btn, .review-toggle-btn {
            display: inline-flex;
            align-items: center;
            padding: 2px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            cursor: pointer;
            line-height: 20px;
            height: 24px;
            transition: all 0.2s;
            position: relative;
        }
        .preview-toggle-btn { background-color: #2196F3; }
        .preview-toggle-btn:hover { background-color: #1976D2; }
        .magnet-toggle-btn { background-color: #E91E63; }
        .magnet-toggle-btn:hover { background-color: #C2185B; }
        .review-toggle-btn {
            display: inline-flex;
            align-items: center;
            background-color: #FF9800;
            color: white;
        }
        .review-toggle-btn:hover {
            background-color: #F57C00;
        }
        
        /* 短评按钮角标（显示数量） */
        .review-toggle-btn .badge {
            position: absolute;
            top: -6px;
            right: -6px;
            background: #4CAF50;
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        
        /* 短评弹窗列表卡片 */
        .review-modal-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .review-item-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 12px 14px;
            border-left: 4px solid #FF9800;
        }
        .review-user-label {
            font-weight: bold;
            font-size: 13px;
            color: #e91e63;
            margin-bottom: 6px;
        }
        .review-text {
            font-size: 13px;
            color: #444;
            line-height: 1.6;
            word-break: break-word;
        }
        
        /* 磁力链按钮角标 */
        .magnet-toggle-btn .badge {
            position: absolute;
            top: -6px;
            right: -6px;
            background: #4CAF50;
            color: white;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .magnet-toggle-btn .badge.no-magnet {
            background: #9e9e9e;
        }
        
        /* 弹窗内容排版优化 */
        .modal-images-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: flex-start;
            align-items: flex-start;
        }
        .modal-images-grid img {
            height: 120px; /* 固定小图高度 */
            width: auto;
            object-fit: cover;
            border-radius: 4px;
            background: #f0f0f0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.2s;
        }
        .modal-images-grid img:hover { 
            transform: scale(1.05); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10;
        }
        
        /* 图片查看器 */
        #image-viewer-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.95);
            z-index: 9999999;
            display: none;
            align-items: center;
            justify-content: center;
        }
        #image-viewer-container {
            position: relative;
            max-width: 100vw;
            max-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: auto;
        }
        #image-viewer-img {
            display: block;
            transition: transform 0.2s;
            cursor: zoom-in;
        }
        #image-viewer-img.zoomed {
            cursor: zoom-out;
        }
        .viewer-btn {
            position: absolute;
            background: rgba(255,255,255,0.9);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            z-index: 10;
        }
        .viewer-btn:hover {
            background: white;
            transform: scale(1.1);
        }
        #viewer-close {
            top: 20px;
            right: 20px;
        }
        #viewer-prev {
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
        }
        #viewer-next {
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
        }
        .viewer-controls {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
        }
        
        /* 夸克按钮样式 */
        .modal-btn-quark { 
            background: #00CCAB !important; 
            color: white !important;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .modal-btn-quark:hover { background: #00B398 !important; }
        .quark-icon {
            width: 14px;
            height: 14px;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="white" d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm0 819.2c-169.7 0-307.2-137.5-307.2-307.2S342.3 204.8 512 204.8s307.2 137.5 307.2 307.2-137.5 307.2-307.2 307.2z"/></svg>');
            background-size: contain;
            display: inline-block;
        }

        .modal-magnet-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .modal-magnet-item {
            display: flex;
            align-items: center;
            padding: 12px 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #eee;
        }
        .modal-magnet-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
            overflow: hidden;
        }
        .modal-magnet-name {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .modal-magnet-meta {
            font-size: 12px;
            color: #666;
            font-family: monospace;
        }
        .modal-magnet-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-top: 2px;
        }
        .modal-tag {
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }
        .modal-tag.is-warning { background: #ffdd57; color: rgba(0,0,0,0.7); }
        .modal-tag.is-info { background: #209cee; color: white; }
        .modal-tag.is-success { background: #23d160; color: white; }
        .modal-tag.is-primary { background: #00d1b2; color: white; }
        
        .modal-magnet-btns {
            display: flex;
            gap: 8px;
        }
        .modal-btn {
            padding: 5px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            border: none;
            transition: all 0.2s;
        }
        .modal-btn-copy { background: #4CAF50; color: white; }
        .modal-btn-copy:hover { background: #43A047; }
        .modal-btn-dl { background: #E91E63; color: white; }
        .modal-btn-dl:hover { background: #C2185B; }
        
        .preview-loading {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }

        /* 在线播放按钮 */
        .online-play-btn {
            display: inline-flex;
            align-items: center;
            padding: 2px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            cursor: pointer;
            line-height: 20px;
            height: 24px;
            transition: all 0.2s;
            background-color: #9C27B0;
            border: none;
        }
        .online-play-btn:hover {
            background-color: #7B1FA2;
        }
    `;
    document.head.appendChild(style);

    // 所有脚本自建界面使用站点主题变量；JavDB 不同版本分别使用 class 或 data-theme 标记主题。
    const themeStyle = document.createElement('style');
    themeStyle.id = 'jb-theme-style';
    themeStyle.textContent = `
        #jb-quick-settings, #emby-modal-window, #emby-settings-overlay > div, #jb-popup-overlay > div {
            color: #333;
        }
        #jb-quick-settings input, #jb-quick-settings select { color-scheme: light; }
        html.is-dark #jb-quick-settings, html.dark #jb-quick-settings,
        body.is-dark #jb-quick-settings, body.dark #jb-quick-settings,
        [data-theme="dark"] #jb-quick-settings,
        html.is-dark #emby-modal-window, html.dark #emby-modal-window,
        body.is-dark #emby-modal-window, body.dark #emby-modal-window,
        [data-theme="dark"] #emby-modal-window,
        html.is-dark #emby-settings-overlay > div, html.dark #emby-settings-overlay > div,
        body.is-dark #emby-settings-overlay > div, body.dark #emby-settings-overlay > div,
        [data-theme="dark"] #emby-settings-overlay > div,
        html.is-dark #jb-popup-overlay > div, html.dark #jb-popup-overlay > div,
        body.is-dark #jb-popup-overlay > div, body.dark #jb-popup-overlay > div,
        [data-theme="dark"] #jb-popup-overlay > div {
            background: #1f2937 !important;
            color: #e5e7eb !important;
            border-color: #374151 !important;
        }
        html.is-dark #jb-quick-settings input, html.dark #jb-quick-settings input,
        body.is-dark #jb-quick-settings input, body.dark #jb-quick-settings input,
        [data-theme="dark"] #jb-quick-settings input,
        html.is-dark #jb-quick-settings select, html.dark #jb-quick-settings select,
        body.is-dark #jb-quick-settings select, body.dark #jb-quick-settings select,
        [data-theme="dark"] #jb-quick-settings select {
            background: #111827 !important; color: #e5e7eb !important; border-color: #4b5563 !important; color-scheme: dark;
        }
        html.is-dark #jb-quick-settings [style*="border-top"], html.dark #jb-quick-settings [style*="border-top"],
        body.is-dark #jb-quick-settings [style*="border-top"], body.dark #jb-quick-settings [style*="border-top"],
        [data-theme="dark"] #jb-quick-settings [style*="border-top"] { border-top-color: #374151 !important; }
        html.is-dark #jb-quick-settings .jb-qk-row, html.dark #jb-quick-settings .jb-qk-row,
        body.is-dark #jb-quick-settings .jb-qk-row, body.dark #jb-quick-settings .jb-qk-row,
        [data-theme="dark"] #jb-quick-settings .jb-qk-row { color: #e5e7eb !important; }
        html.is-dark #jb-quick-settings #jb-qk-more, html.dark #jb-quick-settings #jb-qk-more,
        body.is-dark #jb-quick-settings #jb-qk-more, body.dark #jb-quick-settings #jb-qk-more,
        [data-theme="dark"] #jb-quick-settings #jb-qk-more { background: #111827 !important; border-top-color: #374151 !important; }
        html.is-dark #emby-modal-header, html.dark #emby-modal-header,
        body.is-dark #emby-modal-header, body.dark #emby-modal-header,
        [data-theme="dark"] #emby-modal-header { background: #111827 !important; border-bottom-color: #374151 !important; }
        html.is-dark #emby-modal-title, html.dark #emby-modal-title,
        body.is-dark #emby-modal-title, body.dark #emby-modal-title,
        [data-theme="dark"] #emby-modal-title { color: #f3f4f6 !important; }
        html.is-dark #emby-modal-close, html.dark #emby-modal-close,
        body.is-dark #emby-modal-close, body.dark #emby-modal-close { color: #9ca3af !important; }
        html.is-dark #jb-imgsearch-drop, html.dark #jb-imgsearch-drop,
        body.is-dark #jb-imgsearch-drop, body.dark #jb-imgsearch-drop,
        [data-theme="dark"] #jb-imgsearch-drop { background: #111827 !important; border-color: #6b7280 !important; color: #e5e7eb !important; }
        html.is-dark .jb-series-row, html.dark .jb-series-row,
        body.is-dark .jb-series-row, body.dark .jb-series-row,
        [data-theme="dark"] .jb-series-row { color: #aeb8c7 !important; }
        html.is-dark .review-item-card, html.dark .review-item-card,
        body.is-dark .review-item-card, body.dark .review-item-card,
        [data-theme="dark"] .review-item-card,
        html.is-dark .modal-magnet-item, html.dark .modal-magnet-item,
        body.is-dark .modal-magnet-item, body.dark .modal-magnet-item,
        [data-theme="dark"] .modal-magnet-item { background: #263244 !important; border-color: #3d4b5f !important; }
        html.is-dark .modal-magnet-name, html.dark .modal-magnet-name,
        body.is-dark .modal-magnet-name, body.dark .modal-magnet-name,
        [data-theme="dark"] .modal-magnet-name { color: #f3f4f6 !important; }
        html.is-dark .modal-magnet-meta, html.dark .modal-magnet-meta,
        body.is-dark .modal-magnet-meta, body.dark .modal-magnet-meta,
        [data-theme="dark"] .modal-magnet-meta { color: #b7c0ce !important; }
        html.is-dark .jb-ranking-shell, html.dark .jb-ranking-shell,
        body.is-dark .jb-ranking-shell, body.dark .jb-ranking-shell,
        [data-theme="dark"] .jb-ranking-shell,
        html.is-dark .jb-bt-panel, html.dark .jb-bt-panel,
        body.is-dark .jb-bt-panel, body.dark .jb-bt-panel,
        [data-theme="dark"] .jb-bt-panel,
        html.is-dark .jop-app, html.dark .jop-app,
        body.is-dark .jop-app, body.dark .jop-app,
        [data-theme="dark"] .jop-app { color: #e5e7eb !important; }
        html.is-dark .jb-bt-sort, html.dark .jb-bt-sort,
        body.is-dark .jb-bt-sort, body.dark .jb-bt-sort,
        [data-theme="dark"] .jb-bt-sort,
        html.is-dark .jb-bt-list, html.dark .jb-bt-list,
        body.is-dark .jb-bt-list, body.dark .jb-bt-list,
        [data-theme="dark"] .jb-bt-list,
        html.is-dark .jb-bt-item, html.dark .jb-bt-item,
        body.is-dark .jb-bt-item, body.dark .jb-bt-item { background: #1f2937 !important; color: #d1d5db !important; border-color: #374151 !important; }
        html.is-dark .jop-button, html.dark .jop-button,
        body.is-dark .jop-button, body.dark .jop-button,
        [data-theme="dark"] .jop-button { background: #263244 !important; color: #e5e7eb !important; border-color: #4b5563 !important; }
        html.is-dark .jop-checkbox-custom, html.dark .jop-checkbox-custom,
        body.is-dark .jop-checkbox-custom, body.dark .jop-checkbox-custom,
        [data-theme="dark"] .jop-checkbox-custom { background: #111827 !important; border-color: #4b5563 !important; }
        html.is-dark .jb-login-panel, html.dark .jb-login-panel,
        body.is-dark .jb-login-panel, body.dark .jb-login-panel,
        [data-theme="dark"] .jb-login-panel,
        html.is-dark .jb-fc2-panel, html.dark .jb-fc2-panel,
        body.is-dark .jb-fc2-panel, body.dark .jb-fc2-panel,
        [data-theme="dark"] .jb-fc2-panel { background: #1f2937 !important; color: #e5e7eb !important; }
        html.is-dark .jb-login-panel input, html.dark .jb-login-panel input,
        body.is-dark .jb-login-panel input, body.dark .jb-login-panel input,
        [data-theme="dark"] .jb-login-panel input { background: #111827 !important; color: #e5e7eb !important; border-color: #4b5563 !important; }
        html.is-dark .javdb-api-shell-title, html.dark .javdb-api-shell-title,
        body.is-dark .javdb-api-shell-title, body.dark .javdb-api-shell-title,
        [data-theme="dark"] .javdb-api-shell-title,
        html.is-dark .javdb-api-shell-toolbar-label, html.dark .javdb-api-shell-toolbar-label,
        body.is-dark .javdb-api-shell-toolbar-label, body.dark .javdb-api-shell-toolbar-label { color: #d1d5db !important; }
        html.is-dark .javdb-api-shell-toolbar a, html.dark .javdb-api-shell-toolbar a,
        body.is-dark .javdb-api-shell-toolbar a, body.dark .javdb-api-shell-toolbar a,
        [data-theme="dark"] .javdb-api-shell-toolbar a,
        html.is-dark .javdb-api-shell-pagination a, html.dark .javdb-api-shell-pagination a,
        body.is-dark .javdb-api-shell-pagination a, body.dark .javdb-api-shell-pagination a,
        [data-theme="dark"] .javdb-api-shell-pagination a { background: #263244 !important; color: #e5e7eb !important; border-color: #4b5563 !important; }
        html.is-dark .jop-setting-label, html.dark .jop-setting-label,
        body.is-dark .jop-setting-label, body.dark .jop-setting-label,
        [data-theme="dark"] .jop-setting-label { color: #e5e7eb !important; }
    `;
    document.head.appendChild(themeStyle);

    // ========== 在线播放功能 ==========
    // 在线播放站点配置
    const ONLINE_PLAY_SITES = [
        {
            name: 'MISSAV',
            getUrl: (code) => `https://missav.ws/${code}/`,
            // MISSAV 用 eval 混淆嵌入 m3u8 地址，需要解析
            extractM3u8: (html) => {
                // 方案1：直接在 HTML 中搜索 surrit.com 的 playlist.m3u8 链接（最可靠）
                const surritMatch = html.match(/https?:\/\/[a-z0-9-]+\.surrit\.com\/[a-z0-9-]+\/playlist\.m3u8/);
                if (surritMatch) return surritMatch[0];
                // 方案2：搜索其他可能的 m3u8 链接
                const m3u8Match = html.match(/https?:\/\/[^\s'"\\]+\.m3u8[^\s'"\\]*/);
                if (m3u8Match) return m3u8Match[0];
                // 方案3：解析 eval 混淆代码
                // eval(function(p,a,c,k,e,d){...}('encoded_str', base, count, 'key1|key2|...'.split('|'),0,{}))
                const evalPattern = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([^']+)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/;
                const evalMatch = html.match(evalPattern);
                if (evalMatch) {
                    const encoded = evalMatch[1];
                    const base = parseInt(evalMatch[2]);
                    const keys = evalMatch[4].split('|');
                    // 将编码字符串中的占位符替换为 keys 中对应的值
                    let decoded = encoded;
                    for (let i = keys.length - 1; i >= 0; i--) {
                        const placeholder = i.toString(base);
                        decoded = decoded.replace(new RegExp('\\b' + placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), keys[i] || placeholder);
                    }
                    const decodedM3u8 = decoded.match(/https?:\/\/[^\s'"\\]+\.m3u8/);
                    if (decodedM3u8) return decodedM3u8[0];
                }
                return null;
            }
        },
        {
            name: 'Jable',
            getUrl: (code) => `https://jable.tv/videos/${code}/`,
            // Jable 的 m3u8 地址明文写在 var hlsUrl = '...' 中
            extractM3u8: (html) => {
                const m3u8Match = html.match(/var\s+hlsUrl\s*=\s*'([^']+)'/);
                return m3u8Match ? m3u8Match[1] : null;
            }
        }
    ];

    // 提取视频直链（通过 GM_xmlhttpRequest 请求页面 HTML 并解析）
    function fetchVideoM3u8(site, videoCode, callback) {
        const targetUrl = site.getUrl(videoCode);
        GM_xmlhttpRequest({
            method: 'GET',
            url: targetUrl,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'User-Agent': navigator.userAgent
            },
            timeout: 10000,
            onload: function(response) {
                if (response.status !== 200) {
                    callback(null, `请求失败 (${response.status})`);
                    return;
                }
                const html = response.responseText || '';
                const m3u8Url = site.extractM3u8(html);
                if (m3u8Url) {
                    callback(m3u8Url, null);
                } else {
                    callback(null, '未能提取到视频地址');
                }
            },
            onerror: function() {
                callback(null, '网络请求失败');
            },
            ontimeout: function() {
                callback(null, '请求超时');
            }
        });
    }

    // 打开 HLS 原生播放器弹窗
    function openHLSPlayer(m3u8Url) {
        const w = window.open('', 'jb_player_' + Date.now(), 'width=1060,height=680,top=80,left=200,scrollbars=no,resizable=yes');
        if (!w) { alert('弹窗被拦截，请允许弹出窗口'); return; }
        w.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>播放器</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.3/dist/hls.min.js"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #000; width: 100%; height: 100%; overflow: hidden; }
video { width: 100%; height: 100%; object-fit: contain; background: #000; }
.loading { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 16px; font-family: Arial, sans-serif; z-index: 10; }
.error { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff6b6b; font-size: 14px; font-family: Arial, sans-serif; z-index: 10; text-align: center; display: none; }
</style>
</head>
<body>
<div class="loading" id="loading">加载中...</div>
<div class="error" id="error"></div>
<video id="video" controls autoplay></video>
<script>
var video = document.getElementById('video');
var loading = document.getElementById('loading');
var errorEl = document.getElementById('error');
var m3u8Url = '${m3u8Url}';
if (Hls.isSupported()) {
    var hls = new Hls({ maxBufferSize: 30*1000*1000, maxBufferLength: 30 });
    hls.loadSource(m3u8Url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function() { loading.style.display = 'none'; video.play().catch(function(){}); });
    hls.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
            loading.style.display = 'none';
            errorEl.style.display = 'block';
            errorEl.textContent = '播放失败: ' + data.type;
        }
    });
} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = m3u8Url;
    video.addEventListener('loadedmetadata', function() { loading.style.display = 'none'; video.play().catch(function(){}); });
} else {
    loading.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = '浏览器不支持 HLS 播放';
}
<\/script>
</body>
</html>`);
        w.document.close();
    }

    // 直链播放：点击后直连目标站点，不做任何预检测，秒开播放窗口
    function showDirectPlayer(videoCode, siteName) {
        const site = ONLINE_PLAY_SITES.find(s => s.name === siteName) || ONLINE_PLAY_SITES[0];
        const targetUrl = site.getUrl(videoCode);
        const separator = targetUrl.includes('?') ? '&' : '?';
        // 800ms 防连点：避免一次点击排队多个播放窗口
        if (showDirectPlayer._lastOpen && Date.now() - showDirectPlayer._lastOpen < 800) return;
        showDirectPlayer._lastOpen = Date.now();
        // 关键：必须在用户点击的同步调用栈中打开窗口，否则会被弹窗拦截器静默拦截（导致点击无反应）
        // 固定窗口名：重复点击复用同一窗口导航，不再叠加开新窗
        const playerWin = window.open(targetUrl + separator + 'jb_direct_mode=1', 'jb_player_win', 'width=1060,height=680,top=' + Math.max(0, Math.round((screen.height - 680) / 2)) + ',left=' + Math.max(0, Math.round((screen.width - 1060) / 2)) + ',scrollbars=no,resizable=yes');
        if (!playerWin) {
            showToast('弹窗被浏览器拦截，请在地址栏允许本站弹出式窗口后重试');
        } else {
            try { playerWin.focus(); } catch (e) {}
        }
    }

    // 简易提示
    function showToast(msg) {
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 24px;border-radius:6px;z-index:2147483650;font-size:14px;font-family:Arial,sans-serif;pointer-events:none;transition:opacity 0.3s;';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2000);
    }
    window.jbShowToastFn = showToast;

    // 在容器中添加在线播放按钮（直链播放，优先MISSAV）
    function addOnlinePlayButton(container, videoCode) {
        if (!videoCode || container.querySelector('.online-play-btn')) return;

        const btn = document.createElement('span');
        btn.className = 'online-play-btn';
        btn.innerHTML = '▶ 播放';
        btn.title = '点击播放';
        btn.style.cssText = 'cursor:pointer;padding:2px 8px;color:#8bc34a;';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 优先MISSAV，直接打开播放
            showDirectPlayer(videoCode, 'MISSAV');
        };
        container.appendChild(btn);
    }

    // 详情页预览图按钮（与列表页预览图功能一致，跟随"列表页预览方式"设置）
    function addDetailPreviewButton(container, videoCode) {
        if (!videoCode || container.querySelector('.detail-preview-btn')) return;

        const btn = document.createElement('span');
        btn.className = 'detail-preview-btn';
        btn.innerHTML = '🖼️ 预览图';
        btn.title = '查看预览图';
        btn.style.cssText = 'cursor:pointer;padding:2px 8px;color:#42a5f5;';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (GM_getValue('jb_preview_mode', 'screenshot') === 'screenshot') {
                // 外部截图长图模式（javstore 优先，javfree 兜底）
                showScreenshotPreview(videoCode, null);
            } else {
                // JavDB 预览图模式（详情页直接从 DOM 提取）
                fetchPreviewImages(null, videoCode);
            }
        };
        container.appendChild(btn);
    }

    // ========== 字幕搜索功能 ==========
    // 缓存搜索结果避免重复请求
    const SUBTITLE_CACHE = {};

    function searchSubtitles(videoCode, callback) {
        if (!videoCode) { callback([]); return; }
        const cacheKey = videoCode.toUpperCase();
        if (SUBTITLE_CACHE[cacheKey] !== undefined) {
            callback(SUBTITLE_CACHE[cacheKey]);
            return;
        }
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://www.subtitlecat.com/index.php?search=${encodeURIComponent(videoCode)}`,
            headers: { 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
            timeout: 15000,
            onload: function(response) {
                const html = response.responseText || '';
                const results = [];
                const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
                const rows = html.match(rowRegex) || [];
                rows.forEach(row => {
                    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
                    if (cells.length >= 4) {
                        const nameMatch = cells[0].match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
                        if (nameMatch) {
                            const subName = nameMatch[2].trim();
                            const source = (cells[0].match(/\(translated from ([^)]+)\)/) || [])[1] || '';
                            // 只保留文件名包含当前番号的字幕
                            if (subName.toUpperCase().includes(cacheKey)) {
                                // 尝试提取语言信息（保留 img 的 alt/title）
                                let langs = '';
                                const langMatches = cells[3].match(/alt="([^"]+)"|title="([^"]+)"/g);
                                if (langMatches) {
                                    langs = langMatches.map(m => m.match(/"([^"]+)"/)?.[1] || '').filter(Boolean).join(', ');
                                }
                                if (!langs) {
                                    langs = cells[3].replace(/<[^>]+>/g, '').trim();
                                }
                                const lowerLangs = langs.toLowerCase();
                                const isChinese = source === 'Chinese' ||
                                    lowerLangs.includes('chinese') || lowerLangs.includes('中文') ||
                                    lowerLangs.includes('zh-cn') || lowerLangs.includes('zh-tw') ||
                                    lowerLangs.includes('简体') || lowerLangs.includes('繁体');
                                // 只展示包含中文的字幕
                                if (isChinese) {
                                    results.push({
                                        url: 'https://www.subtitlecat.com/' + nameMatch[1],
                                        name: subName,
                                        source: source,
                                        size: cells[1].replace(/<[^>]+>/g, '').trim(),
                                        downloads: cells[2].replace(/<[^>]+>/g, '').trim(),
                                        languages: langs
                                    });
                                }
                            }
                        }
                    }
                });
                SUBTITLE_CACHE[cacheKey] = results;
                callback(results);
            },
            onerror: function() { callback([]); },
            ontimeout: function() { callback([]); }
        });
    }

    function downloadSubtitle(detailUrl, videoCode) {
        // 先弹出提示，让用户知道正在处理
        const toast = document.createElement('div');
        toast.textContent = '正在获取下载链接...';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 16px;border-radius:4px;z-index:9999999;font-size:13px;white-space:nowrap;';
        document.body.appendChild(toast);

        GM_xmlhttpRequest({
            method: 'GET',
            url: detailUrl,
            headers: { 'Accept': 'text/html' },
            timeout: 15000,
            onload: function(response) {
                toast.remove();
                const html = response.responseText || '';
                let downloadPath = '';

                // 方式1: 找所有 .srt 链接，优先选包含中文标识的
                const srtMatches = html.match(/href="([^"]+\.srt)"/g) || [];
                for (const match of srtMatches) {
                    const path = match.match(/href="([^"]+)"/)?.[1];
                    if (!path) continue;
                    const idx = html.indexOf(match);
                    const nearby = html.substring(Math.max(0, idx - 300), idx + 50).toLowerCase();
                    if (nearby.includes('chinese') || nearby.includes('zh-cn') || nearby.includes('zh-tw') || nearby.includes('中文') || nearby.includes('简体') || nearby.includes('繁体')) {
                        downloadPath = path;
                        break;
                    }
                }

                // 方式2: 如果没找到中文标识的，取第一个 .srt 链接
                if (!downloadPath && srtMatches.length > 0) {
                    downloadPath = srtMatches[0].match(/href="([^"]+)"/)?.[1];
                }

                // 方式3: 尝试匹配 markdown 格式 [Download](...)
                if (!downloadPath) {
                    const mdMatch = html.match(/\[Download\]\(([^)]+\.srt)\)/);
                    if (mdMatch) downloadPath = mdMatch[1];
                }

                if (downloadPath) {
                    const fullUrl = downloadPath.startsWith('http') ? downloadPath : 'https://www.subtitlecat.com' + downloadPath;
                    // 用 iframe 方式触发下载，避免弹窗拦截
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = fullUrl;
                    document.body.appendChild(iframe);
                    setTimeout(() => {
                        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                    }, 5000);
                } else {
                    // 未找到直接下载链接，打开详情页让用户手动下载
                    window.open(detailUrl, '_blank');
                }
            },
            onerror: function() {
                toast.remove();
                window.open(detailUrl, '_blank');
            },
            ontimeout: function() {
                toast.remove();
                window.open(detailUrl, '_blank');
            }
        });
    }

    function showSubtitleResults(videoCode, results, isSearching) {
        let overlay = document.getElementById('subtitle-modal-overlay');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'subtitle-modal-overlay';
        overlay.className = 'subtitle-modal-overlay';
        let bodyHtml = '';
        if (isSearching) {
            bodyHtml = `<div style="text-align:center;padding:40px;color:#999;">
                <div style="font-size:32px;margin-bottom:15px;">⏳</div>
                <div style="font-size:15px;">正在搜索 ${videoCode} 的字幕...</div>
            </div>`;
        } else if (!results || results.length === 0) {
            bodyHtml = `<div style="text-align:center;padding:30px;color:#999;">
                <div style="font-size:48px;margin-bottom:10px;">😿</div>
                <div style="font-size:16px;margin-bottom:8px;">未找到字幕</div>
                <div style="font-size:13px;">没有搜索到 ${videoCode} 的中文字幕</div>
            </div>`;
        } else {
            const count = results.length;
            bodyHtml = `<div style="margin-bottom:10px;font-size:13px;color:#666;">找到 ${count} 个字幕（${videoCode}）</div>`;
            results.forEach(item => {
                const langText = item.languages || (item.source ? item.source : '未知语言');
                const sourceText = item.source ? `翻译来源: ${item.source}` : '';
                bodyHtml += `
                <div class="subtitle-item">
                    <div class="subtitle-item-name">${item.name}</div>
                    <div class="subtitle-item-meta">
                        <span>📦 ${item.size || '未知大小'}</span>
                        <span>⬇️ ${item.downloads || '0 downloads'}</span>
                        <span>🌐 ${langText}</span>
                    </div>
                    ${sourceText ? `<div class="subtitle-item-source">${sourceText}</div>` : ''}
                    <button class="subtitle-download-btn" data-url="${item.url}" data-code="${videoCode}" style="margin-top:8px;padding:5px 14px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;">📥 下载字幕</button>
                </div>`;
            });
        }
        overlay.innerHTML = `
            <div class="subtitle-modal-window">
                <div class="subtitle-modal-header">
                    <span>字幕搜索结果</span>
                    <span class="subtitle-modal-close">&times;</span>
                </div>
                <div class="subtitle-modal-body">${bodyHtml}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.subtitle-modal-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.querySelectorAll('.subtitle-download-btn').forEach(btn => {
            btn.onclick = () => downloadSubtitle(btn.dataset.url, btn.dataset.code);
        });
    }

    // 状态显示逻辑
    function addStatusIndicator(container, videoCode, itemEl = null, insertBefore = null, serverType = 'emby') {
        if (!videoCode) return;

        // 独立开关控制
        if (serverType === 'emby' && !GM_getValue('jb_show_emby_status', true)) return;
        if (serverType === 'jellyfin' && !GM_getValue('jb_show_jellyfin_status', false)) return;

        // 移除旧的显示状态（如果存在）
        const oldStatus = container.querySelector(`.emby-status[data-type="${serverType}"]`);
        if (oldStatus) {
            oldStatus.remove();
        }

        const servers = getServersByType(serverType);
        const statusDiv = document.createElement('span');
        statusDiv.dataset.type = serverType;

        const isEmby = serverType === 'emby';
        const libraryIndex = isEmby ? LIBRARY_INDEX : JELLYFIN_LIBRARY_INDEX;
        const syncError = isEmby ? SYNC_ERROR : JELLYFIN_SYNC_ERROR;
        const lastSync = isEmby ? LAST_SYNC_TIME : JELLYFIN_LAST_SYNC_TIME;

        // 先插入到容器（确保 isConnected 为 true，后续 render 才能正常工作）
        if (insertBefore) {
            container.insertBefore(statusDiv, insertBefore);
        } else {
            container.appendChild(statusDiv);
        }

        // 优先处理状态异常情况
        if (servers.length === 0) {
            renderStatusMessage(statusDiv, '未添加服务器', 'not-added', serverType);
        } else if (syncError) {
            renderStatusMessage(statusDiv, syncError, 'error', serverType);
        } else if (Object.keys(libraryIndex).length === 0 && lastSync === 0) {
            renderStatusMessage(statusDiv, '请点击设置并同步服务器', 'error', serverType);
            verifyStatusBackground(statusDiv, videoCode, false, serverType);
        } else {
            const info = libraryIndex[videoCode.toUpperCase()];
            if (info) {
                renderExists(statusDiv, info, serverType);
                verifyStatusBackground(statusDiv, videoCode, true, serverType);
            } else {
                renderNotExists(statusDiv, serverType);
                verifyStatusBackground(statusDiv, videoCode, false, serverType);
            }
        }
    }

    // 弹窗管理
    function initModal() {
        if (document.getElementById('emby-modal-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'emby-modal-overlay';
        overlay.innerHTML = `
            <div id="emby-modal-window">
                <div id="emby-modal-header">
                    <div id="emby-modal-title"></div>
                    <div id="emby-modal-close">&times;</div>
                </div>
                <div id="emby-modal-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) hideModal(); };
        document.getElementById('emby-modal-close').onclick = hideModal;
    }

    function showModal(title, contentHtml) {
        modalClosed = false;
        initModal();
        document.body.dataset.savedScrollY = window.scrollY;
        const overlay = document.getElementById('emby-modal-overlay');
        document.getElementById('emby-modal-title').textContent = title;
        document.getElementById('emby-modal-body').innerHTML = contentHtml;
        overlay.style.display = 'flex';
        // 锁定背景滚动
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
    }
    window.jbShowModalFn = showModal;

    // 标记当前模态框是否已关闭（防止请求完成后自动再弹窗）
    let modalClosed = false;

    function hideModal() {
        modalClosed = true;
        const overlay = document.getElementById('emby-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        // 恢复背景滚动
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
    window.jbHideModalFn = hideModal;

    // 检查模态框是否仍然打开用于显示内容
    function isModalVisible() {
        const overlay = document.getElementById('emby-modal-overlay');
        return overlay && overlay.style.display === 'flex';
    }

    // 图片查看器
    function initImageViewer() {
        if (document.getElementById('image-viewer-overlay')) return;
        const viewer = document.createElement('div');
        viewer.id = 'image-viewer-overlay';
        viewer.innerHTML = `
            <button class="viewer-btn" id="viewer-close">&times;</button>
            <button class="viewer-btn" id="viewer-prev">&lt;</button>
            <button class="viewer-btn" id="viewer-next">&gt;</button>
            <div id="image-viewer-container">
                <img id="image-viewer-img" />
            </div>
            <div class="viewer-controls">
                <button class="viewer-btn" id="viewer-zoom-in">+</button>
                <button class="viewer-btn" id="viewer-zoom-out">-</button>
                <button class="viewer-btn" id="viewer-reset">⟲</button>
            </div>
        `;
        document.body.appendChild(viewer);

        let currentImages = [];
        let currentIndex = 0;
        let scale = 1;

        const img = document.getElementById('image-viewer-img');
        const overlay = document.getElementById('image-viewer-overlay');

        function showImage(index) {
            currentIndex = index;
            scale = 1;
            img.src = currentImages[index];
            img.style.transform = `scale(${scale})`;
            img.classList.remove('zoomed');
            // 移除尺寸限制，显示原图大小
            img.style.maxWidth = 'none';
            img.style.maxHeight = 'none';
        }

        // 鼠标滚轮切换图片
        overlay.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                // 向上滚轮：上一张
                if (currentIndex > 0) showImage(currentIndex - 1);
            } else {
                // 向下滚轮：下一张
                if (currentIndex < currentImages.length - 1) showImage(currentIndex + 1);
            }
        }, { passive: false });

        document.getElementById('viewer-close').onclick = () => {
            overlay.style.display = 'none';
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
        };

        document.getElementById('viewer-prev').onclick = () => {
            if (currentIndex > 0) showImage(currentIndex - 1);
        };

        document.getElementById('viewer-next').onclick = () => {
            if (currentIndex < currentImages.length - 1) showImage(currentIndex + 1);
        };

        document.getElementById('viewer-zoom-in').onclick = () => {
            scale = Math.min(scale + 0.5, 3);
            img.style.transform = `scale(${scale})`;
        };

        document.getElementById('viewer-zoom-out').onclick = () => {
            scale = Math.max(scale - 0.5, 0.5);
            img.style.transform = `scale(${scale})`;
        };

        document.getElementById('viewer-reset').onclick = () => {
            scale = 1;
            img.style.transform = `scale(${scale})`;
        };

        img.onclick = () => {
            if (scale === 1) {
                scale = 2;
                img.classList.add('zoomed');
            } else {
                scale = 1;
                img.classList.remove('zoomed');
            }
            img.style.transform = `scale(${scale})`;
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
                document.documentElement.style.overflow = '';
                document.documentElement.style.height = '';
                document.body.style.overflow = '';
                document.body.style.height = '';
            }
        };

        window.openImageViewer = (images, index) => {
            currentImages = images;
            showImage(index);
            overlay.style.display = 'flex';
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.height = '100%';
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100%';
        };
    }

    // 预加载预览图数据（后台静默加载 + 缓存）
    function preloadPreviewData(itemEl, videoCode) {
        if (PREVIEW_CACHE[videoCode] && PREVIEW_CACHE[videoCode].status === 'loaded') return;
        if (PREVIEW_CACHE[videoCode] && PREVIEW_CACHE[videoCode].status === 'loading') return;
        
        PREVIEW_CACHE[videoCode] = { status: 'loading', imgList: [], actors: [] };
        
        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;
        
        // 如果已在详情页，从 DOM 直接提取
        if (window.location.pathname.startsWith('/v/')) {
            const doc = document;
            const imgList = parsePreviewImages(doc, window.location.href);
            const actors = parseActorsFromDoc(doc);
            PREVIEW_CACHE[videoCode] = { status: 'loaded', imgList, actors };
            return;
        }
        
        // 否则后台请求
        queueRequest(() => {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: detailLink.href,
                    timeout: 15000,
                    onload: function(response) {
                        const errorMsg = detectResponseError(response);
                        if (errorMsg) {
                            PREVIEW_CACHE[videoCode] = { status: 'error', imgList: [], actors: [], errorMsg };
                            resolve();
                            return;
                        }
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const imgList = parsePreviewImages(doc, detailLink.href);
                        const actors = parseActorsFromDoc(doc);
                        PREVIEW_CACHE[videoCode] = { status: 'loaded', imgList, actors };
                        resolve();
                    },
                    onerror: function() {
                        PREVIEW_CACHE[videoCode] = { status: 'error', imgList: [], actors: [], errorMsg: '请求失败' };
                        resolve();
                    },
                    ontimeout: function() {
                        PREVIEW_CACHE[videoCode] = { status: 'error', imgList: [], actors: [], errorMsg: '请求超时' };
                        resolve();
                    }
                });
            });
        });
    }

    // 添加预览图切换按钮
    function addPreviewToggle(container, itemEl, videoCode) {
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'preview-toggle-btn';
        toggleBtn.textContent = '🖼️ 预览图';
        
        // 按钮进入视口时预加载预览图（限制总预加载数防验证；截图长图模式无需预加载 JavDB）
        const preloadObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    preloadObserver.unobserve(entry.target);
                    if (GM_getValue('jb_preview_mode', 'screenshot') !== 'javdb') return;
                    if (totalPreloadedCount >= MAX_PRELOAD_ITEMS) return;
                    totalPreloadedCount++;
                    preloadPreviewData(itemEl, videoCode);
                }
            });
        }, { rootMargin: '100px' });
        preloadObserver.observe(toggleBtn);

        toggleBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (GM_getValue('jb_preview_mode', 'screenshot') === 'screenshot') {
                // 外部截图长图模式（javstore 优先，javfree 兜底）
                showScreenshotPreview(videoCode, itemEl);
            } else {
                // 原有 JavDB 预览图模式
                fetchPreviewImages(itemEl, videoCode);
            }
        };
        container.appendChild(toggleBtn);
    }

    // 添加磁力链切换按钮（列表页双标签版本）
    function addMagnetToggle(container, itemEl, videoCode) {
        const toggleBtn = document.createElement('span');
        toggleBtn.className = 'magnet-toggle-btn';
        toggleBtn.textContent = '🧲 磁力链';

        // [新增] 后台预加载 JAVBUS + JAVDB 磁力链 - 按钮进入视口时提前加载（限制总预加载数防验证）
        const needPreload = (!JAVBUS_CACHE[videoCode] || !JAVDB_CACHE[videoCode]);
        if (needPreload) {
            const preloadObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        preloadObserver.unobserve(entry.target);
                        if (totalPreloadedCount >= MAX_PRELOAD_ITEMS) return;
                        totalPreloadedCount++;
                        // 预加载 JAVBUS
                        if (!JAVBUS_CACHE[videoCode]) {
                            preloadJavbusData(videoCode);
                        }
                        // 预加载 JAVDB
                        if (!JAVDB_CACHE[videoCode]) {
                            preloadJavdbData(itemEl, videoCode);
                        }
                    }
                });
            }, { rootMargin: '100px' });
            preloadObserver.observe(toggleBtn);
        }

        toggleBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            showDualMagnetModalForList(videoCode, itemEl);
        };
        container.appendChild(toggleBtn);
    }

    // 复制番号按钮
    function addCopyCodeButton(container, videoCode) {
        if (container.querySelector('.copy-code-btn')) return;
        const btn = document.createElement('span');
        btn.className = 'copy-code-btn';
        btn.textContent = '📋 复制番号';
        btn.title = '复制番号到剪贴板';
        btn.style.cssText = 'display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 3px; font-size: 12px; cursor: pointer; background-color: #607D8B; color: white; white-space: nowrap; transition: all 0.2s;';
        btn.onmouseenter = () => { btn.style.backgroundColor = '#455A64'; };
        btn.onmouseleave = () => { btn.style.backgroundColor = '#607D8B'; };
        btn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            navigator.clipboard.writeText(videoCode).then(() => {
                btn.textContent = '✅ 已复制';
                setTimeout(() => { btn.textContent = '📋 复制番号'; }, 1500);
            }).catch(() => {
                // fallback
                const ta = document.createElement('textarea');
                ta.value = videoCode;
                ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                btn.textContent = '✅ 已复制';
                setTimeout(() => { btn.textContent = '📋 复制番号'; }, 1500);
            });
        };
        container.appendChild(btn);
    }

    // 详情页数据请求统一排队、去重并缓存。旧实现会为每张卡片同时 fetch，长列表很容易触发 JavDB 限流。
    let __jbFetchActive = 0;
    let __jbFetchLastAt = 0;
    let __jbFetchPausedUntil = 0;
    const __jbFetchQueue = [];
    const __jbDetailHtmlCache = new Map();
    function jbInvalidateDetailCache(url) {
        if (url) __jbDetailHtmlCache.delete(url);
    }
    const JB_DETAIL_REQUEST_GAP = 1200;
    function jbFetchWithLimit(url) {
        if (!url) return Promise.reject(new Error('详情页地址为空'));
        if (__jbDetailHtmlCache.has(url)) return Promise.resolve(__jbDetailHtmlCache.get(url));
        return new Promise((resolve, reject) => {
            const queued = __jbFetchQueue.find(item => item.url === url);
            if (queued) {
                queued.waiters.push({ resolve, reject });
                return;
            }
            __jbFetchQueue.push({ url, resolve, reject, waiters: [] });
            jbDrainFetchQueue();
        });
    }
    function jbDrainFetchQueue() {
        if (__jbFetchActive >= 1 || !__jbFetchQueue.length) return;
        if (Date.now() < __jbFetchPausedUntil) {
            setTimeout(jbDrainFetchQueue, __jbFetchPausedUntil - Date.now());
            return;
        }
        const wait = Math.max(0, JB_DETAIL_REQUEST_GAP - (Date.now() - __jbFetchLastAt));
        if (wait) { setTimeout(jbDrainFetchQueue, wait); return; }
        const item = __jbFetchQueue.shift();
        __jbFetchActive++;
        __jbFetchLastAt = Date.now();
        fetch(item.url, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } })
            .then(r => {
                if (!r.ok) {
                    if (r.status === 429) {
                        __jbFetchPausedUntil = Date.now() + 30000;
                        handleCFDetection();
                    }
                    throw new Error('HTTP ' + r.status);
                }
                return r.text();
            })
            .then(t => {
                __jbDetailHtmlCache.set(item.url, t);
                item.resolve(t);
                item.waiters.forEach(w => w.resolve(t));
            })
            .catch(e => {
                item.reject(e);
                item.waiters.forEach(w => w.reject(e));
            })
            .finally(() => { __jbFetchActive--; setTimeout(jbDrainFetchQueue, JB_DETAIL_REQUEST_GAP); });
    }

    function jbExtractSeriesFromDoc(doc) {
        if (!doc) return '';
        // JavDB 详情页：系列字段的 value 通常包含 /series/ 链接。
        const seriesLink = doc.querySelector('.video-meta-panel .panel-block a[href*="/series/"], .movie-panel-info .panel-block a[href*="/series/"], a[href*="/series/"]');
        if (seriesLink) return (seriesLink.textContent || '').replace(/\s+/g, ' ').trim();
        const blocks = doc.querySelectorAll('.video-meta-panel .panel-block, .movie-panel-info .panel-block, .panel-block');
        for (const block of blocks) {
            const label = block.querySelector('strong, .label, dt');
            const labelText = (label?.textContent || '').trim();
            if (!/系列|シリーズ|series/i.test(labelText)) continue;
            const value = block.querySelector('.value, dd') || block;
            const text = (value.textContent || '').replace(/^[^:：]*[:：]\s*/, '').replace(/\s+/g, ' ').trim();
            if (text && !/^(无|無|none|n\/a)$/i.test(text)) return text;
        }
        return '';
    }

    // 系列行：紧贴番号+标题下方、短评按钮上方；没有系列时明确显示“系列：无”。
    function jbAddSeriesRow(container, itemEl, videoCode) {
        const row = document.createElement('div');
        row.className = 'jb-series-row';
        row.style.cssText = 'display:block;width:100%;margin:0 0 4px;font-size:11px;color:#888;line-height:1.4;white-space:normal;overflow-wrap:anywhere;';
        row.textContent = '系列：加载中…';
        container.insertBefore(row, container.firstChild);
        const detailUrl = jbGetDetailUrl(itemEl, videoCode);
        if (!detailUrl) { row.textContent = '系列：无'; return; }
        jbFetchWithLimit(detailUrl).then(html => {
            if (!row.isConnected) return;
            const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
            row.textContent = '系列：' + (jbExtractSeriesFromDoc(doc) || '无');
        }).catch(() => { if (row.isConnected) row.textContent = '系列：无'; });
    }

    // 添加短评按钮
    function addShortReviewButton(container, itemEl, videoCode) {
        if (container.querySelector('.review-toggle-btn')) return;
        
        const btn = document.createElement('span');
        btn.className = 'review-toggle-btn';
        btn.textContent = '📝 短评';
        btn.title = '查看短评';
        btn.style.cssText = 'position: relative;';
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            fetchShortReviews(itemEl, videoCode);
        };
        
        container.appendChild(btn);
    }

    // ========== JavDB 账户操作（想看 / 看过 / 存入清单，需登录 JAVDB）==========

    // 获取当前页面 CSRF Token（JavDB 为 Rails 应用，写操作需要）
    function jbGetCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    // 获取详情页链接：优先列表项，其次当前详情页，最后按番号在页内匹配
    function jbGetDetailUrl(itemEl, videoCode) {
        try {
            if (itemEl) {
                const link = getDetailLink(itemEl);
                if (link && link.href) return link.href;
            }
            if (window.location.pathname.startsWith('/v/')) return window.location.href.split(/[?#]/)[0];
            if (videoCode && typeof thumbFindDetailLinkByCode === 'function') {
                const found = thumbFindDetailLinkByCode(videoCode);
                if (found && found.href) return found.href;
            }
        } catch (e) {}
        return null;
    }

    // 构造一个可被 getDetailLink 识别的合成列表项（详情页上下文使用）
    function jbMakeSyntheticItem(detailPath) {
        const el = document.createElement('div');
        const a = document.createElement('a');
        a.setAttribute('href', detailPath); // 属性必须以 /v/ 开头才能被 getDetailLink 识别
        el.appendChild(a);
        return el;
    }

    // 获取影片标题（列表项 / 详情页）
    function jbGetVideoTitle(itemEl, code) {
        try {
            if (itemEl) {
                const box = itemEl.querySelector('a.box');
                if (box && box.getAttribute('title')) return box.getAttribute('title').trim();
                const t = itemEl.querySelector('.video-title');
                if (t) return t.textContent.replace(code || '', '').trim();
            }
            if (window.location.pathname.startsWith('/v/')) {
                const h = document.querySelector('.video-meta-panel .title, .panel .title, h2.title, .current-title');
                if (h) return h.textContent.trim();
            }
        } catch (e) {}
        return '';
    }

    function jbEscapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
    }

    // 列表页账户按钮的页面级状态缓存；详情页和列表页都以 JavDB 返回的表单为准。
    const JB_ACCOUNT_STATE = Object.create(null);
    function jbSetAccountButtonState(btn, type, active) {
        if (!btn) return;
        btn.dataset.active = active ? '1' : '0';
        const labels = {
            want: active ? '✅ 已想看' : '👀 想看',
            watched: active ? '✅ 已看过' : '⭐ 看过',
            list: active ? '📑 已存' : '📑 存入清单'
        };
        const colors = { want: '#4CAF50', watched: '#2E7D32', list: '#4CAF50' };
        btn.textContent = labels[type] || btn.textContent;
        btn.style.backgroundColor = active ? colors[type] : '#9E9E9E';
    }
    function jbPublishAccountState(videoCode, patch) {
        const key = String(videoCode || '').toUpperCase();
        JB_ACCOUNT_STATE[key] = Object.assign({}, JB_ACCOUNT_STATE[key] || {}, patch);
        document.querySelectorAll('.jb-account-actions').forEach(container => {
            if (String(container.dataset.jbCode || '').toUpperCase() !== key) return;
            ['want', 'watched', 'list'].forEach(type => {
                if (JB_ACCOUNT_STATE[key][type] !== undefined) {
                    jbSetAccountButtonState(container.querySelector(`[data-jb-account-type="${type}"]`), type, JB_ACCOUNT_STATE[key][type]);
                }
            });
        });
    }
    function jbFormIsRemoval(form) {
        if (!form) return false;
        const method = form.querySelector('input[name="_method"]')?.value || '';
        const action = form.getAttribute('action') || '';
        return /^(delete|destroy)$/i.test(method) || /(?:remove|destroy|unwant|unwatch)/i.test(action) || /移除|取消|刪除|删除|已加入|已看过|已看過/.test(form.textContent || '');
    }
    function jbLoadAccountState(itemEl, videoCode) {
        const key = String(videoCode || '').toUpperCase();
        if (!key || JB_ACCOUNT_STATE[key]?._loading) return;
        const detailUrl = jbGetDetailUrl(itemEl, videoCode);
        if (!detailUrl) return;
        JB_ACCOUNT_STATE[key] = Object.assign({}, JB_ACCOUNT_STATE[key] || {}, { _loading: true });
        jbFetchWithLimit(detailUrl).then(html => {
            const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
            const wantForm = doc.querySelector('form[action*="want_to_watch"], form[action*="want-watch"]');
            const reviewForm = doc.querySelector('#new_review, #edit_review, form[action*="/reviews"], form[id*="review"]');
            const checkedScore = reviewForm?.querySelector('[name="video_review[score]"]:checked, [name="review[score]"]:checked, [name="score"]:checked, select option:checked');
            const score = checkedScore?.value || reviewForm?.querySelector('[name="video_review[score]"], [name="review[score]"], [name="score"]')?.value || '';
            const listForms = Array.from(doc.querySelectorAll('form[action*="simple_list"], form[action*="/lists"]'));
            const patch = {
                want: !!wantForm && jbFormIsRemoval(wantForm),
                watched: !!score && Number(score) > 0,
                list: listForms.some(jbFormIsRemoval)
            };
            // 某些 JavDB 版本没有 want 表单，而是通过按钮文本表达当前状态。
            if (!wantForm) patch.want = [...doc.querySelectorAll('a,button')].some(el => /取消想看|已想看/.test(el.textContent || ''));
            jbPublishAccountState(videoCode, patch);
        }).catch(() => {}).finally(() => {
            if (JB_ACCOUNT_STATE[key]) JB_ACCOUNT_STATE[key]._loading = false;
        });
    }

    // 提交 Rails button_to 表单（自动携带 authenticity_token，支持 _method 覆写）
    async function jbSubmitRailsForm(form, baseUrl) {
        const { csrfToken, action, params } = jbBuildFormRequest(form, baseUrl);
        const res = await fetch(action, {
            method: 'POST',
            body: params.toString(),
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-CSRF-Token': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'text/javascript, application/javascript, application/json'
            }
        });
        if (!res.ok && res.status !== 302) throw new Error('HTTP ' + res.status);
        return res;
    }

    // 解析 Rails 表单为提交请求（提取表单内嵌的 authenticity_token，而非当前页面 meta token）
    function jbBuildFormRequest(form, baseUrl) {
        const action = new URL(form.getAttribute('action') || '', baseUrl || location.origin).href;
        const params = new URLSearchParams();
        let csrfToken = jbGetCsrfToken();
        form.querySelectorAll('input, textarea, select').forEach(el => {
            if (!el.name || el.type === 'submit' || el.type === 'button') return;
            if (el.type === 'radio' && !el.checked) return;
            if (el.type === 'checkbox' && !el.checked) return;
            params.append(el.name, el.value || '');
            // 表单内嵌的 authenticity_token 优先（详情页抓取场景）
            if (el.name === 'authenticity_token' && el.value) csrfToken = el.value;
        });
        return { csrfToken, action, params };
    }

    // 从抓取到的详情页 HTML 文档中提取其 CSRF token（跨页面提交时使用）
    function jbGetDetailCsrf(doc, fallback) {
        try {
            const meta = doc.querySelector('meta[name="csrf-token"]');
            if (meta && meta.getAttribute('content')) return meta.getAttribute('content');
        } catch (e) {}
        // 兜底：从表单内嵌 token 解析
        try {
            const t = doc.querySelector('input[name="authenticity_token"]');
            if (t && t.value) return t.value;
        } catch (e) {}
        return fallback || '';
    }

    // 用「原生表单提交」执行 Rails 操作（与详情页按钮行为一致）：把待提交的表单克隆进当前文档，
    // 经由隐藏 iframe 做一次真正的浏览器导航 POST（完整请求头 + 表单字段 + 会话 token），
    // 从而绕开手工 fetch/XHR 导致的 500（token、Accept、字段错配均不会再生效）。
    function jbNativeSubmitForm(form, csrfToken, baseUrl) {
        return new Promise(resolve => {
            try {
                const clone = document.createElement('form');
                clone.style.display = 'none';
                clone.method = 'post';
                clone.action = new URL(form.getAttribute('action') || '/', baseUrl || location.href).href;
                let method = 'post';
                const seen = new Set();
                form.querySelectorAll('input, textarea, select, button').forEach(el => {
                    // 跳过普通按钮，但保留 named="commit" 的提交按钮值（Rails 提交时常常需要）
                    if (!el.name) return;
                    if (el.type === 'button' || el.type === 'image') return;
                    if (el.type === 'submit' && el.name !== 'commit') return;
                    if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
                    const inp = document.createElement('input');
                    inp.type = 'hidden';
                    inp.name = el.name;
                    inp.value = el.value || '';
                    // authenticity_token：表单内嵌值优先；否则用传入的会话 token 补齐
                    if (el.name === 'authenticity_token' && !el.value && csrfToken) inp.value = csrfToken;
                    clone.appendChild(inp);
                    seen.add(el.name);
                    if (el.name === '_method') method = el.value || 'post';
                });
                if (!seen.has('authenticity_token') && csrfToken) {
                    const a = document.createElement('input');
                    a.type = 'hidden'; a.name = 'authenticity_token'; a.value = csrfToken;
                    clone.appendChild(a);
                }
                const m = clone.querySelector('input[name="_method"]');
                if (m && /^(delete|patch|put)$/i.test(m.value)) { clone.method = 'post'; method = m.value.toLowerCase(); }
                document.body.appendChild(clone);
                const iframe = document.createElement('iframe');
                iframe.name = 'jb_native_submit'; iframe.style.display = 'none';
                document.body.appendChild(iframe);
                clone.target = iframe.name;
                setTimeout(() => {
                    try { clone.submit(); } catch (e) { console.warn('JavdbBuddy: 原生提交失败', e); }
                    setTimeout(() => { iframe.remove(); clone.remove(); resolve(); }, 3500);
                }, 30);
            } catch (e) {
                console.warn('JavdbBuddy: 原生提交构造失败', e);
                resolve();
            }
        });
    }
    function jbCopyText(text) {
        return new Promise(resolve => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => resolve(true)).catch(() => resolve(jbCopyFallback(text)));
            } else {
                resolve(jbCopyFallback(text));
            }
        });
    }
    function jbCopyFallback(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (e) { return false; }
    }

    // ===== 想看按钮（点击切换 加入/取消） =====
    function addWantWatchButton(container, itemEl, videoCode) {
        if (container.querySelector('.want-watch-btn')) return;
        const btn = document.createElement('span');
        btn.className = 'want-watch-btn';
        btn.textContent = '👀 想看';
        btn.title = '加入/取消想看（需登录 JAVDB）';
        btn.setAttribute('data-ok', '0');
        btn.dataset.jbAccountType = 'want';
        btn.style.cssText = 'display:inline-flex;align-items:center;padding:2px 8px;border-radius:3px;font-size:12px;cursor:pointer;background-color:#9E9E9E;color:white;white-space:nowrap;transition:all 0.2s;';
        if (JB_ACCOUNT_STATE[String(videoCode).toUpperCase()]?.want !== undefined) jbSetAccountButtonState(btn, 'want', JB_ACCOUNT_STATE[String(videoCode).toUpperCase()].want);
        btn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            jbToggleWantWatch(itemEl, videoCode, btn);
        };
        container.appendChild(btn);
    }

    async function jbToggleWantWatch(itemEl, videoCode, btn) {
        const detailUrl = jbGetDetailUrl(itemEl, videoCode);
        if (!detailUrl) { showToast('未找到详情页链接'); return; }
        const origText = btn.textContent;
        const origActive = btn.dataset.active === '1';
        btn.textContent = '⏳ 请稍候...';
        btn.style.pointerEvents = 'none';
        try {
            // 每次都抓取详情页最新状态，保证与详情页按钮完全同步（在详情页取消/加入后回到列表，这里也能读到最新状态）
            const html = await jbFetchWithLimit(detailUrl);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            if (!doc.querySelector('a[href*="logout"], a[href*="sign_out"], [data-user-menu], .user-menu')) {
                showToast('此功能需要先登录 JAVDB 账号');
                jbSetAccountButtonState(btn, 'want', origActive);
                btn.textContent = origActive ? '✅ 已想看' : origText;
                btn.style.pointerEvents = '';
                return;
            }
            const form = doc.querySelector('form[action*="want_to_watch"], form[action*="want-watch"]');
            if (!form) {
                showToast('未找到想看表单，请到详情页操作');
                jbSetAccountButtonState(btn, 'want', origActive);
                btn.textContent = origActive ? '✅ 已想看' : origText;
                btn.style.pointerEvents = '';
                return;
            }
            // 使用 fetch AJAX 提交（与详情页 data-remote 行为一致）
            await jbSubmitRailsForm(form, detailUrl);
            jbInvalidateDetailCache(detailUrl);
            // 操作后重新读取详情页确认最终状态
            const html2 = await jbFetchWithLimit(detailUrl);
            const doc2 = new DOMParser().parseFromString(html2, 'text/html');
            const form2 = doc2.querySelector('form[action*="want_to_watch"], form[action*="want-watch"]');
            const active = form2 ? jbFormIsRemoval(form2) : false;
            jbPublishAccountState(videoCode, { want: active });
            jbSetAccountButtonState(btn, 'want', active);
            showToast(active ? '已加入想看' : '已取消想看');
        } catch (err) {
            showToast('操作失败：' + (err.message || '网络错误'));
            jbSetAccountButtonState(btn, 'want', origActive);
            btn.textContent = origActive ? '✅ 已想看' : origText;
        }
        btn.style.pointerEvents = '';
    }

    // ===== 看过按钮（星级评分弹窗） =====
    function addWatchedButton(container, itemEl, videoCode) {
        if (container.querySelector('.watched-btn')) return;
        const btn = document.createElement('span');
        btn.className = 'watched-btn';
        btn.textContent = '⭐ 看过';
        btn.title = '标记看过并评分（需登录 JAVDB）';
        btn.style.cssText = 'display:inline-flex;align-items:center;padding:2px 8px;border-radius:3px;font-size:12px;cursor:pointer;background-color:#9E9E9E;color:white;white-space:nowrap;transition:all 0.2s;';
        btn.dataset.jbAccountType = 'watched';
        if (JB_ACCOUNT_STATE[String(videoCode).toUpperCase()]?.watched !== undefined) jbSetAccountButtonState(btn, 'watched', JB_ACCOUNT_STATE[String(videoCode).toUpperCase()].watched);
        btn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            jbMarkWatched(itemEl, videoCode, btn);
        };
        container.appendChild(btn);
    }

    async function jbMarkWatched(itemEl, videoCode, btn) {
        const detailUrl = jbGetDetailUrl(itemEl, videoCode);
        if (!detailUrl) { showToast('未找到详情页链接'); return; }
        const origText = btn.textContent;
        btn.textContent = '⏳ 请稍候...';
        btn.style.pointerEvents = 'none';
        let form = null;
        let loggedIn = false;
        let detailCsrf = jbGetCsrfToken();
        try {
            const html = await jbFetchWithLimit(detailUrl);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            loggedIn = !!doc.querySelector('a[href*="logout"], a[href*="sign_out"], [data-user-menu], .user-menu');
            const removalForm = Array.from(doc.querySelectorAll('form[action*="/reviews"], form[id*="review"]')).find(jbFormIsRemoval);
            form = doc.querySelector('#new_review, #edit_review, form[action*="/reviews"], form[id*="review"]');
            detailCsrf = jbGetDetailCsrf(doc, detailCsrf);
            if (loggedIn && btn.dataset.active === '1' && removalForm) {
                await jbSubmitRailsForm(removalForm, detailUrl);
                jbInvalidateDetailCache(detailUrl);
                jbPublishAccountState(videoCode, { watched: false });
                jbSetAccountButtonState(btn, 'watched', false);
                showToast('已取消看过');
                btn.style.pointerEvents = '';
                return;
            }
        } catch (e) {}
        btn.textContent = origText;
        btn.style.pointerEvents = '';
        if (!loggedIn) { showToast('此功能需要先登录 JAVDB 账号'); return; }
        if (!form) { showToast('未找到评分表单，请到详情页操作'); return; }
        // 星级选择弹窗
        jbShowStarPicker(videoCode, async (score) => {
            btn.textContent = '⏳ 提交中...';
            btn.style.pointerEvents = 'none';
            try {
                // 在解析出的评分表单上覆盖分数，再用原生表单提交（真正的浏览器 POST，与详情页评分一致）
                const scoreEls = form.querySelectorAll('[name="video_review[score]"], [name="review[score]"], [name="score"]');
                scoreEls.forEach(scoreEl => {
                    if (scoreEl.type === 'radio' || scoreEl.type === 'checkbox') scoreEl.checked = scoreEl.value === String(score);
                    else scoreEl.value = String(score);
                });
                await jbSubmitRailsForm(form, detailUrl);
                jbInvalidateDetailCache(detailUrl);
                jbPublishAccountState(videoCode, { watched: true });
                jbSetAccountButtonState(btn, 'watched', true);
                showToast('已标记看过（' + score + ' 星）');
            } catch (err) {
                showToast('操作失败：' + (err.message || '网络错误'));
                jbSetAccountButtonState(btn, 'watched', btn.dataset.active === '1');
                btn.textContent = btn.dataset.active === '1' ? '✅ 已看过' : origText;
            }
            btn.style.pointerEvents = '';
        });
    }

    // 星级选择弹窗（复用主弹窗）
    function jbShowStarPicker(videoCode, onSubmit) {
        showModal(videoCode + ' - 看过评分', `
            <div style="text-align:center;padding:24px 0;">
                <div style="color:#666;font-size:14px;margin-bottom:18px;">点击星星为影片评分（将标记为看过）</div>
                <div id="jb-star-picker" style="display:flex;justify-content:center;gap:12px;font-size:36px;cursor:pointer;user-select:none;">
                    ${[1, 2, 3, 4, 5].map(i => `<span data-score="${i}" style="color:#d5d8de;transition:color .15s;">★</span>`).join('')}
                </div>
                <div id="jb-star-hint" style="color:#999;font-size:12px;margin-top:12px;height:16px;"></div>
                <div style="color:#bbb;font-size:11px;margin-top:6px;">短评可留空 · 需已登录 JAVDB</div>
            </div>`);
        const picker = document.getElementById('jb-star-picker');
        if (!picker) return;
        const stars = picker.querySelectorAll('span');
        const hint = document.getElementById('jb-star-hint');
        const hints = { 1: '很差', 2: '不好', 3: '一般', 4: '很好', 5: '極好' };
        stars.forEach(star => {
            const score = parseInt(star.dataset.score, 10);
            star.onmouseenter = () => {
                stars.forEach(s => { s.style.color = parseInt(s.dataset.score, 10) <= score ? '#ffc107' : '#d5d8de'; });
                if (hint) hint.textContent = score + ' 星 · ' + hints[score];
            };
            star.onclick = () => { hideModal(); onSubmit(score); };
        });
        picker.onmouseleave = () => {
            stars.forEach(s => { s.style.color = '#d5d8de'; });
            if (hint) hint.textContent = '';
        };
    }

    // ===== 存入清单按钮 =====
    function addSaveListButton(container, itemEl, videoCode) {
        if (container.querySelector('.save-list-btn')) return;
        const btn = document.createElement('span');
        btn.className = 'save-list-btn';
        btn.textContent = '📑 存入清单';
        btn.title = '存入清单（需登录 JAVDB）';
        btn.style.cssText = 'display:inline-flex;align-items:center;padding:2px 8px;border-radius:3px;font-size:12px;cursor:pointer;background-color:#9E9E9E;color:white;white-space:nowrap;transition:all 0.2s;';
        btn.dataset.jbAccountType = 'list';
        if (JB_ACCOUNT_STATE[String(videoCode).toUpperCase()]?.list !== undefined) jbSetAccountButtonState(btn, 'list', JB_ACCOUNT_STATE[String(videoCode).toUpperCase()].list);
        btn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            jbSaveToList(itemEl, videoCode, btn);
        };
        container.appendChild(btn);
    }

    async function jbSaveToList(itemEl, videoCode, btn) {
        const detailUrl = jbGetDetailUrl(itemEl, videoCode);
        if (!detailUrl) { showToast('未找到详情页链接'); return; }
        const origText = btn.textContent;
        btn.textContent = '⏳ 请稍候...';
        btn.style.pointerEvents = 'none';
        try {
            // 优先抓取详情页的「存入清单」下拉，保证与详情页按钮看到的是同一批清单（含"移除"态）
            const html = await jbFetchWithLimit(detailUrl);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            if (!doc.querySelector('a[href*="logout"], a[href*="sign_out"], [data-user-menu], .user-menu')) {
                showToast('此功能需要先登录 JAVDB 账号');
                btn.textContent = origText;
                btn.style.pointerEvents = '';
                return;
            }
            let forms = Array.from(doc.querySelectorAll('form[action*="simple_list"], form[action*="/lists"]'));
            if (!forms.length) {
                // 兜底：从专用接口取
                const uuidMatch = detailUrl.match(/\/v\/([a-zA-Z0-9]+)/);
                const r2 = await fetch(location.origin + '/users/simple_lists?vid=' + (uuidMatch ? uuidMatch[1] : ''), { credentials: 'same-origin', headers: { 'X-CSRF-Token': jbGetCsrfToken() } });
                const ct = r2.headers.get('content-type') || '';
                if (r2.redirected || (r2.url && r2.url.includes('/login')) || !ct.includes('json')) { showToast('请先登录 JAVDB 账号'); return; }
                const data = await r2.json();
                const wrap = document.createElement('div');
                wrap.innerHTML = data.lists || '';
                forms = Array.from(wrap.querySelectorAll('form'));
            }
            jbShowListPicker(videoCode, forms, detailUrl, btn);
        } catch (err) {
            showToast('加载清单失败：' + (err.message || '网络错误'));
        }
        btn.textContent = origText;
        btn.style.pointerEvents = '';
    }

    // 清单选择弹窗（每张表单对应一个清单；底部提供"新建清单"，与详情页入口一致）
    function jbShowListPicker(videoCode, forms, detailUrl, btn) {
        let itemsHtml = '';
        if (!forms || !forms.length) {
            itemsHtml = '<div style="color:#999;font-size:13px;text-align:center;padding:14px 6px;">当前还没有清单，可新建后存入</div>';
        } else {
            forms.forEach((f, i) => {
                const label = (f.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50) || ('清单 ' + (i + 1));
                itemsHtml += `<div class="jb-list-item" data-idx="${i}" style="padding:10px 14px;margin:6px 0;background:#f5f6f8;border:1px solid #e4e6ea;border-radius:6px;cursor:pointer;font-size:13px;color:#333;transition:all .15s;display:flex;align-items:center;gap:8px;">
                    <span style="color:#9C27B0;">${label.includes('移除') || label.includes('刪') ? '✔' : '＋'}</span><span>${jbEscapeHtml(label)}</span></div>`;
            });
        }
        // 新建清单条目（前往详情页使用原生新建表单，行为与详情页入口一致）
        const createRow = detailUrl
            ? `<div id="jb-list-create" style="margin:8px 0 4px;padding:11px 14px;border:1px dashed #9C27B0;border-radius:6px;cursor:pointer;font-size:13px;color:#9C27B0;font-weight:500;transition:all .15s;display:flex;align-items:center;gap:8px;"><span>＋</span><span>新建清单</span></div>`
            : '';
        const hint = (forms && forms.length)
            ? '<div style="color:#999;font-size:11px;text-align:center;margin-top:4px;">点击清单名称即可存入 · 带移除标记的点击后将移出</div>'
            : '';
        showModal(videoCode + ' - 存入清单', `<div style="max-height:56vh;overflow-y:auto;padding:4px 6px;">${itemsHtml}${createRow}${hint}</div>`);
        document.querySelectorAll('#emby-modal-body .jb-list-item').forEach(el => {
            el.onmouseenter = () => { el.style.background = '#ede7f6'; el.style.borderColor = '#9C27B0'; };
            el.onmouseleave = () => { el.style.background = '#f5f6f8'; el.style.borderColor = '#e4e6ea'; };
            el.onclick = async () => {
                const f = forms[parseInt(el.dataset.idx, 10)];
                if (!f) return;
                el.style.opacity = '0.5';
                el.style.pointerEvents = 'none';
                try {
                    await jbSubmitRailsForm(f, detailUrl);
                    const listActive = !jbFormIsRemoval(f);
                    jbInvalidateDetailCache(detailUrl);
                    jbPublishAccountState(videoCode, { list: listActive });
                    jbSetAccountButtonState(btn, 'list', listActive);
                    showToast(listActive ? '清单操作成功' : '已移出清单');
                    hideModal();
                } catch (err) {
                    showToast('操作失败：' + (err.message || '网络错误'));
                    el.style.opacity = '';
                    el.style.pointerEvents = '';
                }
            };
        });
        const createBtn = document.getElementById('jb-list-create');
        if (createBtn) {
            createBtn.onmouseenter = () => { createBtn.style.background = '#f3e7ff'; };
            createBtn.onmouseleave = () => { createBtn.style.background = ''; };
            createBtn.onclick = () => {
                hideModal();
                window.open(detailUrl, '_blank');
                showToast('已打开详情页，请在右下角清单下拉中新建');
            };
        }
    }

    // 检测响应错误类型，返回具体原因描述
    function detectResponseError(response) {
        if (!response || !response.responseText) {
            if (response && response.status === 0) return '请求被阻止，请检查网络连接';
            return '未知错误';
        }
        const html = response.responseText;
        // 检测 Cloudflare 验证 → 自动暂停队列
        if (html.includes('cf-turnstile') || html.includes('challenge-form') ||
            html.includes('Checking your browser') || html.includes('Just a moment') ||
            html.includes('验证您是真人') || html.includes('正在检查您的浏览器') ||
            (response.status === 403 && html.includes('cloudflare'))) {
            handleCFDetection();
            return '触发了 Cloudflare 安全验证，请手动刷新 javdb.com 完成验证后重试';
        }
        // 检测需要登录（同时覆盖 redirect 跟随前后两种情况）
        // 情况1: followRedirects=false 时直接收到 302/301
        if (response.status === 302 || response.status === 301) {
            const headers = (response.responseHeaders || '').toLowerCase();
            if (headers.includes('location') && headers.includes('login')) {
                return '需要登录 JAVDB 账号才能查看此内容';
            }
        }
        // 情况2: followRedirects=true（默认）时 status 为 200，但 finalUrl 指向登录页
        const finalUrl = response.finalUrl || '';
        if (finalUrl && (finalUrl.includes('/sign_in') || finalUrl.includes('/login') ||
            finalUrl.includes('/phone') || finalUrl.includes('/verify'))) {
            return '需要登录 JAVDB 账号才能查看此内容';
        }
        // 情况3: 响应内容本身就是手机号/登录页面（某些站点直接返回 200 登录页）
        // 手机验证页面特征
        if ((html.includes('手机号') && html.includes('短信验证码')) ||
            (html.includes('手机号登录') || html.includes('手机验证'))) {
            return '当前需要登录 JAVDB 账号或完成手机验证才能查看此内容';
        }
        // 登录页面特征（包含登录表单）
        if (html.includes('action="/sign_in"') || html.includes('action="/login"') ||
            (html.includes('sign_in') && html.includes('password') && html.includes('submit'))) {
            return '需要登录 JAVDB 账号才能查看此内容';
        }
        // 检测 IP/请求被限制
        if (html.includes('请求太频繁') || html.includes('rate limit') || 
            html.includes('too many requests') || response.status === 429) {
            handleCFDetection();
            return '请求过于频繁，请稍后再试';
        }
        if (response.status === 403) return '请求被拒绝，可能触发了网站安全限制';
        if (response.status === 404) return '页面未找到（404）';
        if (response.status === 500) return '服务器内部错误（500）';
        if (response.status === 502 || response.status === 503) return '服务暂时不可用，请稍后重试';
        return null;
    }

    // ===== 收藏演员更新检查 =====
    // 快照结构: { [actorPath]: { code, name, avatar, date } }，code 为上次见过的最新作品番号
    function jbGetActorSnapshot() {
        try { return GM_getValue('jb_actor_updates_snapshot', {}) || {}; } catch (e) { return {}; }
    }

    // 获取收藏演员列表（4 个演员库：推荐/有码/无码/欧美，含分页，最多 5 页/库）
    async function jbFetchFavoriteActors() {
        const actors = new Map(); // path -> actor（去重）
        const libs = ['/actors', '/actors/censored', '/actors/uncensored', '/actors/western'];
        let loggedIn = false;
        for (const lib of libs) {
            for (let page = 1; page <= 5; page++) {
                const url = `${location.origin}${lib}?favorite=1${page > 1 ? '&page=' + page : ''}`;
                let html;
                try {
                    const res = await fetch(url, { credentials: 'same-origin' });
                    if (!res.ok) break;
                    html = await res.text();
                } catch (e) { break; }
                const doc = new DOMParser().parseFromString(html, 'text/html');
                if (doc.querySelector('a[href*="logout"], a[href="/logout"]')) loggedIn = true;
                // 关键修复：未登录时 JavDB 会忽略 favorite 参数并返回【全站】演员列表（700+ 个），
                // 必须在第一个库的第一页就检测登录态并立即终止，绝不能把全站演员误当收藏处理
                if (lib === libs[0] && page === 1 && !loggedIn) {
                    throw new Error('请先登录 JAVDB 账号（未登录时无法获取收藏演员列表）');
                }
                const boxes = doc.querySelectorAll('.actor-box');
                if (!boxes.length) break;
                boxes.forEach(box => {
                    const a = box.querySelector('a[href^="/actors/"]');
                    const strong = box.querySelector('strong');
                    const img = box.querySelector('img.avatar');
                    if (!a || !strong) return;
                    const path = a.getAttribute('href');
                    if (actors.has(path)) return;
                    actors.set(path, {
                        path,
                        name: strong.textContent.trim(),
                        avatar: img ? img.getAttribute('src') : null
                    });
                });
                const nextLink = doc.querySelector(`.pagination a[href*="page=${page + 1}"]`);
                if (!nextLink) break;
            }
        }
        if (!loggedIn) throw new Error('请先登录 JAVDB 账号（未登录时无法获取收藏演员列表）');
        return Array.from(actors.values());
    }

    // 获取演员页最新作品（前 limit 部）
    async function jbFetchActorLatestMovies(actorPath, limit = 6) {
        const res = await fetch(location.origin + actorPath, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const items = doc.querySelectorAll('.movie-list .item');
        const movies = [];
        items.forEach(item => {
            if (movies.length >= limit) return;
            const a = item.querySelector('a.box');
            const codeEl = item.querySelector('.video-title strong');
            const metaEl = item.querySelector('.meta, .video-date');
            const img = item.querySelector('.cover img');
            if (!a || !codeEl) return;
            movies.push({
                url: a.getAttribute('href'),
                title: a.getAttribute('title') || (item.querySelector('.video-title') ? item.querySelector('.video-title').textContent.trim() : ''),
                code: codeEl.textContent.trim(),
                date: metaEl ? metaEl.textContent.trim() : '',
                cover: img ? img.getAttribute('src') : null
            });
        });
        return movies;
    }

    // 主流程：检查收藏演员更新并弹窗展示
    async function jbCheckFavoriteActorUpdates() {
        showModal('收藏演员更新', '<div class="preview-loading">⏳ 正在获取收藏演员列表...（需已登录 JavDB）</div>');
        let actors;
        try {
            actors = await jbFetchFavoriteActors();
        } catch (e) {
            if (isModalVisible()) document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading" style="color:#e74c3c;">⚠️ ' + jbEscapeHtml(e.message || '网络错误') + '</div>';
            return;
        }
        if (!actors.length) {
            if (isModalVisible()) document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading">未获取到收藏演员。<br><span style="font-size:12px;color:#999;">请先在 JavDB 演员页点击"收藏"，并确保已登录账号</span></div>';
            return;
        }

        const snapshot = jbGetActorSnapshot();
        const isFirstCheck = Object.keys(snapshot).length === 0;
        const updates = [];
        let checked = 0;
        const total = actors.length;

        const updateProgress = () => {
            if (!isModalVisible()) return;
            const bar = document.querySelector('.jb-au-progress-bar');
            const text = document.querySelector('.jb-au-progress-text');
            if (bar) bar.style.width = Math.round(checked / total * 100) + '%';
            if (text) text.textContent = `正在检查演员 ${checked} / ${total}`;
        };

        const checkOne = async (actor) => {
            try {
                const movies = await jbFetchActorLatestMovies(actor.path, 6);
                if (movies.length) {
                    const snap = snapshot[actor.path];
                    let newMovies = [];
                    if (!snap || !snap.code) {
                        // 该演员首次入快照：首次检查只记基线，不视为更新；之后出现视为全部新作品
                        if (!isFirstCheck) newMovies = movies.slice(0, 3);
                    } else {
                        for (const m of movies) {
                            if (m.code === snap.code) break;
                            newMovies.push(m);
                        }
                    }
                    snapshot[actor.path] = { code: movies[0].code, name: actor.name, avatar: actor.avatar, date: movies[0].date };
                    if (!isFirstCheck && newMovies.length) updates.push({ actor, newMovies });
                } else {
                    snapshot[actor.path] = { code: '', name: actor.name, avatar: actor.avatar, date: '' };
                }
            } catch (e) { /* 单个演员失败忽略 */ }
            checked++;
            updateProgress();
        };

        showModal('收藏演员更新', `
            <div style="padding:10px 4px;">
                <div style="font-size:14px;color:#555;margin-bottom:10px;">共 <b>${total}</b> 位收藏演员</div>
                <div style="background:#e8eaf0;border-radius:8px;height:10px;overflow:hidden;margin-bottom:8px;"><div class="jb-au-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#ff6d8f,#ff9d5c);transition:width .3s;"></div></div>
                <div class="jb-au-progress-text" style="font-size:13px;color:#888;">正在检查演员 0 / ${total}</div>
            </div>`);

        const queue = actors.slice();
        const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
            while (queue.length) {
                const actor = queue.shift();
                await checkOne(actor);
            }
        });
        await Promise.all(workers);

        if (!isModalVisible()) return;
        const body = document.getElementById('emby-modal-body');
        if (!body) return;

        if (isFirstCheck) {
            GM_setValue('jb_actor_updates_snapshot', snapshot);
            body.innerHTML = `<div class="preview-loading">✅ 已建立基线（${total} 位演员）<br><span style="font-size:12px;color:#999;">这些演员有新作品时，再次点击即可查看更新</span></div>`;
            return;
        }

        if (!updates.length) {
            GM_setValue('jb_actor_updates_snapshot', snapshot);
            body.innerHTML = '<div class="preview-loading">🎉 暂无更新<br><span style="font-size:12px;color:#999;">收藏的演员都没有新作品</span></div>';
            return;
        }

        // 有更新：渲染结果（等用户点"已读"才写快照，期间重新打开仍可见）
        let html = `<div style="margin-bottom:12px;font-size:13px;color:#555;">发现 <b style="color:#e91e63;">${updates.length}</b> 位演员有新作品：</div>`;
        updates.forEach(({ actor, newMovies }) => {
            html += `
            <div style="margin-bottom:18px;border:1px solid #eee;border-radius:10px;overflow:hidden;">
                <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#faf7f8;">
                    ${actor.avatar ? `<img src="${jbEscapeHtml(actor.avatar)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;">` : ''}
                    <a href="${jbEscapeHtml(actor.path)}" target="_blank" style="font-weight:bold;color:#d81b60;text-decoration:none;font-size:14px;">${jbEscapeHtml(actor.name)}</a>
                    <span style="font-size:12px;color:#999;">+${newMovies.length} 部新作品</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:10px;">
                    ${newMovies.slice(0, 6).map(m => `
                    <a href="${jbEscapeHtml(m.url)}" target="_blank" style="display:block;text-decoration:none;color:inherit;border:1px solid #eee;border-radius:8px;overflow:hidden;">
                        ${m.cover ? `<img src="${jbEscapeHtml(m.cover)}" style="width:100%;aspect-ratio:2.6/1;object-fit:cover;display:block;">` : ''}
                        <div style="padding:6px 8px;">
                            <div style="font-weight:bold;color:#e91e63;font-size:12px;">${jbEscapeHtml(m.code)}</div>
                            <div style="font-size:11px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${jbEscapeHtml(m.title)}">${jbEscapeHtml(m.title)}</div>
                            ${m.date ? `<div style="font-size:11px;color:#999;margin-top:2px;">${jbEscapeHtml(m.date)}</div>` : ''}
                        </div>
                    </a>`).join('')}
                </div>
            </div>`;
        });
        html += `<button id="jb-au-markread" style="background:#e91e63;color:white;border:none;padding:9px 24px;border-radius:6px;cursor:pointer;font-size:13px;">✅ 全部已读（下次不再提醒）</button>`;
        body.innerHTML = html;
        document.getElementById('jb-au-markread')?.addEventListener('click', () => {
            GM_setValue('jb_actor_updates_snapshot', snapshot);
            hideModal();
            showToast('已标记为已读');
        });
    }

    // 获取短评并弹窗（通过 JAVDB 短评 API）
    function fetchShortReviews(itemEl, videoCode) {
        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;

        showModal(`${videoCode} - 短评`, '<div class="preview-loading">正在获取短评...</div>');

        // 使用 JAVDB 短评完整列表页（/reviews/lastest 只返回3条，/reviews 返回全部）
        const baseUrl = detailLink.href.split(/[?#]/)[0].replace(/\/+$/, '');
        const reviewUrl = baseUrl + '/reviews';

        GM_xmlhttpRequest({
            method: 'GET',
            url: reviewUrl,
            timeout: 10000,
            onload: function(response) {
                if (!isModalVisible()) return;
                // 先检测错误
                const errorMsg = detectResponseError(response);
                if (errorMsg) {
                    // 404 时尝试回退到 外部API 获取短评
                    if (response.status === 404 && typeof jbApi !== 'undefined') {
                        const movieId = baseUrl.split('/').pop();
                        jbApi.getReviews(movieId, 1, 20).then(dataList => {
                            if (!isModalVisible()) return;
                            if (!dataList || dataList.length === 0) {
                                document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading">暂无短评</div>';
                                return;
                            }
                            let floorIndex = 1;
                            const panel = document.getElementById('emby-modal-body');
                            panel.innerHTML = '';
                            jbDisplayReviews(dataList, panel, () => floorIndex++);
                        }).catch(() => {
                            if (!isModalVisible()) return;
                            document.getElementById('emby-modal-body').innerHTML = `<div class="preview-loading" style="color:#e74c3c;">⚠️ ${errorMsg}</div>`;
                        });
                        return;
                    }
                    document.getElementById('emby-modal-body').innerHTML = `<div class="preview-loading" style="color:#e74c3c;">⚠️ ${errorMsg}</div>`;
                    return;
                }
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const reviews = parseReviewsFromDoc(doc);
                
                if (reviews.length === 0) {
                    document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading">暂无短评</div>';
                } else {
                    showReviewModal(videoCode, reviews);
                }
            },
            onerror: function() {
                if (!isModalVisible()) return;
                document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading" style="color:#e74c3c;">⚠️ 请求失败，请确认已登录 JAVDB</div>';
            },
            ontimeout: function() {
                if (!isModalVisible()) return;
                document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading" style="color:#e74c3c;">⚠️ 请求超时，请检查网络后重试</div>';
            }
        });
    }

    // 解析短评（基于 JAVDB API 返回的 HTML 结构）
    function parseReviewsFromDoc(doc) {
        const reviews = [];
        
        // 查找 dt.review-item 容器
        const items = doc.querySelectorAll('dt.review-item');
        
        items.forEach(item => {
            // 跳过"更多短评"提示行
            if (item.classList.contains('more')) return;
            
            const titleEl = item.querySelector('.review-title');
            if (!titleEl) return;
            
            // 提取用户名（.review-title 中的第一个文本节点，排除了子元素）
            let userName = '匿名用户';
            for (let child of titleEl.childNodes) {
                if (child.nodeType === 3) { // TEXT_NODE
                    const t = child.textContent.trim();
                    if (t.length > 0 && t.length < 30) {
                        userName = t;
                        break;
                    }
                }
            }
            
            // 提取日期
            const timeEl = titleEl.querySelector('.time');
            const date = timeEl ? timeEl.textContent.trim() : '';
            
            // 提取星级（计算亮星数量）
            const starsEl = titleEl.querySelector('.score-stars');
            let starStr = '';
            if (starsEl) {
                const goldStars = starsEl.querySelectorAll('i.icon-star:not(.gray)');
                const goldCount = goldStars.length;
                starStr = '★'.repeat(goldCount) + '☆'.repeat(5 - goldCount);
            }
            
            // 提取评论正文
            const contentEl = item.querySelector('.content p, .content');
            const text = contentEl ? contentEl.textContent.trim() : '';
            
            if (text && text.length > 0) {
                reviews.push({ 
                    user: userName, 
                    text: text,
                    star: starStr,
                    date: date
                });
            }
        });
        
        return reviews;
    }

    // 显示短评弹窗
    function showReviewModal(videoCode, reviews) {
        let html = `<div class="review-modal-list">`;
        reviews.forEach((review, index) => {
            const userEncoded = review.user.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const textEncoded = review.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const starDisplay = review.star || '';
            const dateDisplay = review.date ? `<span class="review-date">📅 ${review.date}</span>` : '';
            html += `
            <div class="review-item-card">
                <div class="review-user-label">👤 ${userEncoded} ${starDisplay ? '<span style="color:#f59e0b;">' + starDisplay + '</span>' : ''} ${dateDisplay}</div>
                <div class="review-text">${textEncoded}</div>
            </div>
            `;
        });
        html += '</div>';
        showModal(`${videoCode} - 短评 (${reviews.length}条)`, html);
    }

    // [新增] 后台预加载 JAVBUS 磁力链数据（不阻塞 UI）
    function preloadJavbusData(videoCode) {
        if (!videoCode) return;
        if (JAVBUS_CACHE[videoCode] && JAVBUS_CACHE[videoCode].status === 'loaded') return;
        
        JAVBUS_CACHE[videoCode] = { status: 'loading', data: null };
        
        const url = `https://www.javbus.com/${videoCode}`;
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.javbus.com/',
                'Cookie': JB_JAVBUS_COOKIE_HEADER
            },
            onload: function(response) {
                try {
                    if (response.status !== 200) {
                        JAVBUS_CACHE[videoCode] = { status: 'error', data: null };
                        return;
                    }
                    const html = response.responseText;
                    const gidMatch = html.match(/var\s+gid\s*=\s*(\d+)\s*;/);
                    const ucMatch = html.match(/var\s+uc\s*=\s*(\d+)\s*;/);
                    const imgMatch = html.match(/var\s+img\s*=\s*'([^']+)'\s*;/);
                    
                    if (gidMatch && ucMatch && imgMatch) {
                        const gid = gidMatch[1];
                        const uc = ucMatch[1];
                        const img = imgMatch[1];
                        const apiUrl = `https://www.javbus.com/ajax/uncledatoolsbyajax.php?gid=${gid}&lang=zh&img=${encodeURIComponent(img)}&uc=${uc}`;
                        
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: apiUrl,
                            timeout: 15000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                                'Referer': url,
                                'Cookie': JB_JAVBUS_COOKIE_HEADER,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            onload: function(apiResponse) {
                                if (apiResponse.status !== 200) {
                                    // 失败时尝试直接从 HTML 解析
                                    JAVBUS_CACHE[videoCode] = { status: 'error', data: null, html: html };
                                    return;
                                }
                                const apiHtml = apiResponse.responseText;
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(`<table><tbody>${apiHtml}</tbody></table>`, 'text/html');
                                const rows = doc.querySelectorAll('tr');
                                const magnetData = [];
                                rows.forEach(row => {
                                    const cells = row.querySelectorAll('td');
                                    if (cells.length >= 3) {
                                        const nameLink = cells[0].querySelector('a');
                                        const sizeLink = cells[1].querySelector('a');
                                        const dateLink = cells[2].querySelector('a');
                                        if (nameLink && nameLink.href.startsWith('magnet:')) {
                                            const nameText = nameLink.textContent.trim();
                                            const nameHTML = cells[0].innerHTML;
                                            magnetData.push({
                                                name: nameText,
                                                size: sizeLink ? sizeLink.textContent.trim() : '',
                                                date: dateLink ? dateLink.textContent.trim() : '',
                                                magnetUrl: nameLink.href,
                                                hasSub: nameHTML.includes('字幕') || nameText.includes('字幕'),
                                                hasHD: nameHTML.includes('高清') || nameText.includes('高清')
                                            });
                                        }
                                    }
                                });
                                magnetData.sort((a, b) => (b.hasSub ? 1 : 0) - (a.hasSub ? 1 : 0));
                                JAVBUS_CACHE[videoCode] = { status: 'loaded', data: magnetData };
                            },
                            onerror: function() {
                                JAVBUS_CACHE[videoCode] = { status: 'error', data: null, html: html };
                            },
                            ontimeout: function() {
                                JAVBUS_CACHE[videoCode] = { status: 'error', data: null, html: html };
                            }
                        });
                    } else {
                        JAVBUS_CACHE[videoCode] = { status: 'error', data: null, html: html };
                    }
                } catch (e) {
                    JAVBUS_CACHE[videoCode] = { status: 'error', data: null };
                }
            },
            onerror: function() {
                JAVBUS_CACHE[videoCode] = { status: 'error', data: null };
            },
            ontimeout: function() {
                JAVBUS_CACHE[videoCode] = { status: 'error', data: null };
            }
        });
    }

    // [新增] 后台预加载 JAVDB 磁力链数据
    function preloadJavdbData(itemEl, videoCode) {
        if (!videoCode || !itemEl) return;
        if (JAVDB_CACHE[videoCode] && JAVDB_CACHE[videoCode].status === 'loaded') return;

        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;

        JAVDB_CACHE[videoCode] = { status: 'loading', data: null };

        GM_xmlhttpRequest({
            method: 'GET',
            url: detailLink.href,
            timeout: 15000,
            onload: function(response) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    const magnetList = parseMagnetItems(doc);
                    JAVDB_CACHE[videoCode] = { status: 'loaded', data: magnetList };
                } catch (e) {
                    JAVDB_CACHE[videoCode] = { status: 'error', data: null };
                }
            },
            onerror: function() {
                JAVDB_CACHE[videoCode] = { status: 'error', data: null };
            },
            ontimeout: function() {
                JAVDB_CACHE[videoCode] = { status: 'error', data: null };
            }
        });
    }

    // 列表页双标签磁力弹窗（集成演员名单）
    function showDualMagnetModalForList(videoCode, itemEl) {
        // 创建双标签弹窗HTML，顶部预留演员栏位
        let html = `
        <div id="actor-header-magnet" style="margin-bottom: 10px;"></div>
        <div class="dual-magnet-modal" style="padding: 0;">
            <!-- 标签切换按钮 -->
            <div class="dual-magnet-tabs" style="display: flex; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
                <button id="javdb-tab-btn" class="dual-tab-btn active" style="flex: 1; padding: 12px; border: none; background: #fff; color: #333; font-weight: bold; cursor: pointer; border-bottom: 3px solid #ff6b6b;">
                    🔥 JAVDB 磁力链
                    <span id="javdb-count" style="background: #ff6b6b; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 5px;">加载中...</span>
                </button>
                <button id="javbus-tab-btn" class="dual-tab-btn" style="flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;">
                    🧲 JAVBUS 磁力链
                    <span id="javbus-count" style="background: #999; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 5px;">加载中...</span>
                </button>
                ${GM_getValue('jb_enable_bt_search', true) ? `
                <button id="bt-tab-btn" class="dual-tab-btn" style="flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;">
                    🌐 BT聚合搜索
                </button>` : ''}
            </div>

            <!-- JAVDB 内容区域 -->
            <div id="javdb-content" class="tab-content" style="display: block;">
                <div id="javdb-loading" class="preview-loading">正在获取 JAVDB 磁力链...</div>
                <div id="javdb-magnet-list" class="modal-magnet-list" style="display: none;"></div>
            </div>

            <!-- JAVBUS 内容区域 -->
            <div id="javbus-content" class="tab-content" style="display: none;">
                <div id="javbus-loading" class="preview-loading">正在获取 JAVBUS 磁力链...</div>
                <div id="javbus-magnet-list" class="modal-magnet-list" style="display: none;"></div>
            </div>

            <!-- BT聚合搜索内容区域 -->
            <div id="bt-content" class="tab-content" style="display: none;"></div>
        </div>
        `;

        showModal(`${videoCode} - 磁力链接`, html);

        // 后台获取详情页并提取演员名单
        const detailLink = getDetailLink(itemEl);
        if (detailLink) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: detailLink.href,
                timeout: 10000,
                onload: function(response) {
                    if (!isModalVisible()) return;
                    try {
                        const errorMsg = detectResponseError(response);
                        if (errorMsg) {
                            const actorHeader = document.getElementById('actor-header-magnet');
                            if (actorHeader) {
                                actorHeader.innerHTML = `<span style="color:#e74c3c;font-size:12px;">⚠️ ${errorMsg}</span>`;
                            }
                            return;
                        }
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const actors = parseActorsFromDoc(doc);
                        const actorHeader = document.getElementById('actor-header-magnet');
                        if (actorHeader && actors.length > 0) {
                            actorHeader.innerHTML = renderActorHeaderHTML(actors);
                        }
                    } catch(e) {
                        // 静默失败，不影响磁力链功能
                    }
                },
                onerror: function() {},
                ontimeout: function() {}
            });
        }

        // 绑定标签切换事件
        setTimeout(() => {
            const javdbTabBtn = document.getElementById('javdb-tab-btn');
            const javbusTabBtn = document.getElementById('javbus-tab-btn');
            const javdbContent = document.getElementById('javdb-content');
            const javbusContent = document.getElementById('javbus-content');

            if (javdbTabBtn) {
                javdbTabBtn.onclick = () => {
                    javdbTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #fff; color: #333; font-weight: bold; cursor: pointer; border-bottom: 3px solid #ff6b6b;';
                    javbusTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;';
                    if (btTabBtn) btTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;';
                    javdbContent.style.display = 'block';
                    javbusContent.style.display = 'none';
                    if (btContent) btContent.style.display = 'none';
                };
            }

            if (javbusTabBtn) {
                javbusTabBtn.onclick = () => {
                    javbusTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #fff; color: #333; font-weight: bold; cursor: pointer; border-bottom: 3px solid #667eea;';
                    javdbTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;';
                    if (btTabBtn) btTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;';
                    javbusContent.style.display = 'block';
                    javdbContent.style.display = 'none';
                    if (btContent) btContent.style.display = 'none';
                };
            }

            const btTabBtn = document.getElementById('bt-tab-btn');
            const btContent = document.getElementById('bt-content');
            if (btTabBtn) {
                btTabBtn.onclick = () => {
                    btTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #fff; color: #333; font-weight: bold; cursor: pointer; border-bottom: 3px solid #9c27b0;';
                    javdbTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;';
                    javbusTabBtn.style.cssText = 'flex: 1; padding: 12px; border: none; background: #f5f5f5; color: #666; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent;';
                    btContent.style.display = 'block';
                    javdbContent.style.display = 'none';
                    javbusContent.style.display = 'none';
                    renderBtSearchPanel(btContent, videoCode);
                };
            }

            // 同时加载 JAVDB 和 JAVBUS 数据
            loadJavdbMagnetsForList(itemEl, videoCode);
            loadJavbusMagnetsForList(videoCode);
        }, 100);
    }

    // 加载 JAVDB 磁力链（列表页弹窗用）
    function loadJavdbMagnetsForList(itemEl, videoCode) {
        const detailLink = getDetailLink(itemEl);
        const loadingDiv = document.getElementById('javdb-loading');
        const listDiv = document.getElementById('javdb-magnet-list');
        const countSpan = document.getElementById('javdb-count');

        if (!detailLink) {
            if (loadingDiv) loadingDiv.textContent = '无法获取详情页链接';
            if (countSpan) {
                countSpan.textContent = '0';
                countSpan.style.background = '#999';
            }
            return;
        }

        // ====== [优先] 检查 JAVDB 缓存 ======
        const cached = JAVDB_CACHE[videoCode];
        if (cached && cached.status === 'loaded' && cached.data) {
            if (listDiv) {
                listDiv.innerHTML = renderMagnetListHTML(cached.data);
                listDiv.style.display = 'block';
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
            if (countSpan) {
                countSpan.textContent = cached.data.length;
                countSpan.style.background = cached.data.length > 0 ? '#ff6b6b' : '#999';
            }
            return;
        }

        // 缓存未命中或正在加载，不等预加载，直接请求
        doJavdbDirectRequest(detailLink, loadingDiv, listDiv, countSpan, videoCode);
    }

    // [提取] JAVDB 直接请求逻辑
    function doJavdbDirectRequest(detailLink, loadingDiv, listDiv, countSpan, videoCode) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: detailLink.href,
            timeout: 15000,
            onload: function(response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const magnetList = parseMagnetItems(doc);

                // ====== 保存到 JAVDB 缓存 ======
                if (videoCode) {
                    JAVDB_CACHE[videoCode] = { status: 'loaded', data: magnetList };
                }

                if (listDiv) {
                    if (magnetList.length > 0) {
                        listDiv.innerHTML = renderMagnetListHTML(magnetList);
                        listDiv.style.display = 'block';
                        if (loadingDiv) loadingDiv.style.display = 'none';
                    } else {
                        if (loadingDiv) {
                            loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">未找到磁力链接</div>';
                        }
                    }
                }

                if (countSpan) {
                    countSpan.textContent = magnetList.length;
                    countSpan.style.background = magnetList.length > 0 ? '#ff6b6b' : '#999';
                }
            },
            onerror: function() {
                if (loadingDiv) {
                    loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">获取失败，请检查网络</div>';
                }
                if (countSpan) {
                    countSpan.textContent = '错误';
                    countSpan.style.background = '#e74c3c';
                }
            },
            ontimeout: function() {
                if (loadingDiv) {
                    loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">请求超时</div>';
                }
                if (countSpan) {
                    countSpan.textContent = '超时';
                    countSpan.style.background = '#e74c3c';
                }
            }
        });
    }

    // 加载 JAVBUS 磁力链（列表页弹窗用）- 使用详情页相同的逻辑
    function loadJavbusMagnetsForList(videoCode) {
        const loadingDiv = document.getElementById('javbus-loading');
        const listDiv = document.getElementById('javbus-magnet-list');
        const countSpan = document.getElementById('javbus-count');

        if (listDiv) listDiv.dataset.loaded = 'loading';

        // ====== [优先] 检查缓存 ======
        const cached = JAVBUS_CACHE[videoCode];
        if (cached && cached.status === 'loaded' && cached.data) {
            if (listDiv) {
                listDiv.innerHTML = renderMagnetListHTML(cached.data);
                listDiv.style.display = 'block';
                listDiv.dataset.loaded = 'true';
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
            if (countSpan) {
                countSpan.textContent = cached.data.length;
                countSpan.style.background = cached.data.length > 0 ? '#667eea' : '#999';
            }
            return;
        }
        
        // 缓存未命中或正在加载中，不等预加载，直接请求
        doJavbusRequest(videoCode, loadingDiv, listDiv, countSpan);
    }

    // [提取] JAVBUS 实际请求逻辑
    function doJavbusRequest(videoCode, loadingDiv, listDiv, countSpan) {
        const url = `https://www.javbus.com/${videoCode}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.javbus.com/',
                'Cookie': JB_JAVBUS_COOKIE_HEADER
            },
            onload: function(response) {
                try {
                    const html = response.responseText;

                    if (response.status !== 200) {
                        if (loadingDiv) {
                            loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无数据</div>';
                        }
                        if (countSpan) {
                            countSpan.textContent = '0';
                            countSpan.style.background = '#999';
                        }
                        return;
                    }

                    // 使用详情页相同的正则提取变量
                    const gidMatch = html.match(/var\s+gid\s*=\s*(\d+)\s*;/);
                    const ucMatch = html.match(/var\s+uc\s*=\s*(\d+)\s*;/);
                    const imgMatch = html.match(/var\s+img\s*=\s*'([^']+)'\s*;/);

                    if (gidMatch && ucMatch && imgMatch) {
                        const gid = gidMatch[1];
                        const uc = ucMatch[1];
                        const img = imgMatch[1];

                        // 调用 API 获取磁力链
                        const apiUrl = `https://www.javbus.com/ajax/uncledatoolsbyajax.php?gid=${gid}&lang=zh&img=${encodeURIComponent(img)}&uc=${uc}`;

                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: apiUrl,
                            timeout: 15000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                                'Referer': url,
                                'Cookie': JB_JAVBUS_COOKIE_HEADER,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            onload: function(apiResponse) {
                                if (apiResponse.status !== 200) {
                                    fallbackLoadJavbusFromHTML(html, loadingDiv, listDiv, countSpan, videoCode);
                                    return;
                                }

                                const apiHtml = apiResponse.responseText;

                                // 使用详情页相同的解析方式：用 table 包装
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(`<table><tbody>${apiHtml}</tbody></table>`, 'text/html');
                                const rows = doc.querySelectorAll('tr');

                                const magnetData = [];
                                rows.forEach(row => {
                                    const cells = row.querySelectorAll('td');
                                    if (cells.length >= 3) {
                                        const nameCell = cells[0];
                                        const sizeCell = cells[1];
                                        const dateCell = cells[2];

                                        const nameLink = nameCell.querySelector('a');
                                        const sizeLink = sizeCell.querySelector('a');
                                        const dateLink = dateCell.querySelector('a');

                                        if (nameLink && nameLink.href.startsWith('magnet:')) {
                                            const nameText = nameLink.textContent.trim();
                                            const sizeText = sizeLink ? sizeLink.textContent.trim() : '';
                                            const dateText = dateLink ? dateLink.textContent.trim() : '';

                                            // 从 nameCell 的 HTML 中提取标签
                                            const nameHTML = nameCell.innerHTML;
                                            const hasHD = nameHTML.includes('高清') || nameText.includes('高清');
                                            const hasSub = nameHTML.includes('字幕') || nameText.includes('字幕');

                                            magnetData.push({
                                                name: nameText,
                                                size: sizeText,
                                                date: dateText,
                                                magnetUrl: nameLink.href,
                                                hasSub: hasSub,
                                                hasHD: hasHD
                                            });
                                        }
                                    }
                                });

                                // 排序：有字幕的排在前面
                                magnetData.sort((a, b) => {
                                    if (a.hasSub && !b.hasSub) return -1;
                                    if (!a.hasSub && b.hasSub) return 1;
                                    return 0;
                                });

                                // ====== 保存到缓存 ======
                                JAVBUS_CACHE[videoCode] = { status: 'loaded', data: magnetData };

                                if (listDiv) {
                                    if (magnetData.length > 0) {
                                        listDiv.innerHTML = renderMagnetListHTML(magnetData);
                                        listDiv.style.display = 'block';
                                        listDiv.dataset.loaded = 'true';
                                        if (loadingDiv) loadingDiv.style.display = 'none';
                                    } else {
                                        if (loadingDiv) {
                                            loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">未找到磁力链接</div>';
                                        }
                                    }
                                }

                                if (countSpan) {
                                    countSpan.textContent = magnetData.length;
                                    countSpan.style.background = magnetData.length > 0 ? '#667eea' : '#999';
                                }
                            },
                            onerror: function() {
                                fallbackLoadJavbusFromHTML(html, loadingDiv, listDiv, countSpan, videoCode);
                            },
                            ontimeout: function() {
                                fallbackLoadJavbusFromHTML(html, loadingDiv, listDiv, countSpan, videoCode);
                            }
                        });
                    } else {
                        // 尝试直接从 HTML 解析
                        fallbackLoadJavbusFromHTML(html, loadingDiv, listDiv, countSpan, videoCode);
                    }
                } catch (error) {
                    console.error('加载 JAVBUS 磁力链失败:', error);
                    if (loadingDiv) {
                        loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无数据</div>';
                    }
                }
            },
            onerror: function() {
                if (loadingDiv) {
                    loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无数据</div>';
                }
                if (countSpan) {
                    countSpan.textContent = '0';
                    countSpan.style.background = '#999';
                }
            },
            ontimeout: function() {
                if (loadingDiv) {
                    loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无数据</div>';
                }
                if (countSpan) {
                    countSpan.textContent = '0';
                    countSpan.style.background = '#999';
                }
            }
        });
    }

    // 回退：从 HTML 解析 JAVBUS 磁力链
    function fallbackLoadJavbusFromHTML(html, loadingDiv, listDiv, countSpan, videoCode) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const magnetLinks = doc.querySelectorAll('a[href^="magnet:"]');

            const magnetData = [];
            magnetLinks.forEach((link, index) => {
                const magnetUrl = link.href;
                const name = link.textContent.trim() || `磁力链接 ${index + 1}`;
                const row = link.closest('tr');

                let size = '';
                let date = '';
                let hasSub = false;
                let hasHD = false;

                if (row) {
                    const tds = row.querySelectorAll('td');
                    if (tds.length >= 2) size = tds[1]?.textContent.trim() || '';
                    if (tds.length >= 3) date = tds[2]?.textContent.trim() || '';

                    hasSub = row.textContent.includes('字幕') || row.textContent.includes('Sub');
                    hasHD = row.textContent.includes('高清') || row.textContent.includes('HD');
                }

                magnetData.push({ name, magnetUrl, size, date, hasSub, hasHD });
            });

            magnetData.sort((a, b) => (b.hasSub ? 1 : 0) - (a.hasSub ? 1 : 0));

            // ====== 保存到缓存 ======
            if (videoCode) {
                JAVBUS_CACHE[videoCode] = { status: 'loaded', data: magnetData };
            }

            if (listDiv) {
                if (magnetData.length > 0) {
                    listDiv.innerHTML = renderMagnetListHTML(magnetData);
                    listDiv.style.display = 'block';
                    listDiv.dataset.loaded = 'true';
                    if (loadingDiv) loadingDiv.style.display = 'none';
                } else {
                    if (loadingDiv) {
                        loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">未找到磁力链接</div>';
                    }
                }
            }

            if (countSpan) {
                countSpan.textContent = magnetData.length;
                countSpan.style.background = magnetData.length > 0 ? '#667eea' : '#999';
            }
        } catch (error) {
            console.error('回退解析 JAVBUS 失败:', error);
            if (loadingDiv) {
                loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无数据</div>';
            }
        }
    }

    // 渲染磁力链列表 HTML
    // 标签背景色映射
    const TAG_COLORS = {
        'is-success': { bg: '#2ecc71', text: 'white' },
        'is-info': { bg: '#3498db', text: 'white' },
        'is-warning': { bg: '#ffdd57', text: 'rgba(0,0,0,0.7)' },
        'is-primary': { bg: '#00d1b2', text: 'white' }
    };

    function renderMagnetListHTML(magnetList) {
        if (!magnetList || magnetList.length === 0) {
            return '<div style="text-align: center; padding: 20px; color: #999;">未找到磁力链接</div>';
        }

        let html = '';
        magnetList.forEach(m => {
            let tagsHtml = '';
            
            // 优先使用 tags 数组（来自 parseMagnetItems 的丰富标签）
            if (m.tags && m.tags.length > 0) {
                tagsHtml = m.tags.map(t => {
                    const colorKey = t.className.split(' ').find(c => TAG_COLORS[c]) || '';
                    const colors = TAG_COLORS[colorKey] || { bg: '#666', text: 'white' };
                    return `<span style="background: ${colors.bg}; color: ${colors.text}; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px;">${t.text}</span>`;
                }).join('');
            } else {
                // 后备：使用布尔字段
                if (m.hasSub) tagsHtml += '<span class="modal-tag is-success" style="background: #2ecc71; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px;">字幕</span>';
                if (m.hasHD) tagsHtml += '<span class="modal-tag is-info" style="background: #3498db; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px;">高清</span>';
            }

            // 兼容 meta 字段（parseMagnetItems 的合并格式）以及 size/date 字段（JAVBUS 的分立格式）
            const metaText = [m.size, m.date].filter(Boolean).join(' | ') || m.meta || '';

            html += `
                <div class="modal-magnet-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0; background: #fafafa; margin-bottom: 8px; border-radius: 6px;">
                    <div class="modal-magnet-info" style="flex: 1; min-width: 0;">
                        <div class="modal-magnet-name" title="${m.name}" style="font-weight: 500; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.name}</div>
                        <div class="modal-magnet-meta" style="font-size: 12px; color: #666; margin-bottom: 6px;">${metaText}</div>
                        <div class="modal-magnet-tags">${tagsHtml}</div>
                    </div>
                    <div class="modal-magnet-btns" style="margin-left: 10px;">
                        <button class="modal-btn modal-btn-copy" onclick="const btn=this; navigator.clipboard.writeText('${m.magnetUrl}').then(() => { const old=btn.textContent; btn.textContent='已复制'; btn.style.background='#2e7d32'; setTimeout(()=>{btn.textContent=old; btn.style.background='';}, 1000); })" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; transition: all 0.2s;">复制</button>
                        <button class="modal-btn modal-btn-dl" onclick="window.open('${m.magnetUrl}', '_blank')" style="padding: 8px 16px; background: #E91E63; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; transition: all 0.2s;">下载</button>
                    </div>
                </div>`;
        });

        return html;
    }
    
    // 检查磁力链是否可用
    function checkMagnetAvailability(toggleBtn, itemEl) {
        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;
            
        GM_xmlhttpRequest({
            method: 'GET',
            url: detailLink.href,
            timeout: 5000,
            onload: function(response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const magnetItems = doc.querySelectorAll('#magnets-content .item, #magnets-content tr, .magnet-links .item');
                    
                const badge = toggleBtn.querySelector('.badge');
                if (magnetItems.length > 0) {
                    // 有磁力链，显示数量
                    badge.textContent = magnetItems.length > 9 ? '9+' : magnetItems.length;
                    badge.classList.remove('no-magnet');
                } else {
                    // 无磁力链，显示"0"
                    badge.textContent = '0';
                    badge.classList.add('no-magnet');
                }
            },
            onerror: function() {
                // 请求失败，隐藏角标
                const badge = toggleBtn.querySelector('.badge');
                if (badge) badge.style.display = 'none';
            },
            ontimeout: function() {
                const badge = toggleBtn.querySelector('.badge');
                if (badge) badge.style.display = 'none';
            }
        });
    }
        
    // 预加载磁力链数据（后台静默加载 + 请求队列 + 只加载可见区域）
    function preloadMagnetLinks(toggleBtn, itemEl, videoCode, callback) {
        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;
        
        // 使用 IntersectionObserver 监听可见性
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 元素可见时才预加载
                    observer.unobserve(entry.target); // 只加载一次
                    
                    // 将请求放入队列
                    queueRequest(() => {
                        return new Promise((resolve, reject) => {
                            GM_xmlhttpRequest({
                                method: 'GET',
                                url: detailLink.href,
                                timeout: 8000,
                                onload: function(response) {
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(response.responseText, 'text/html');
                                    const magnetList = parseMagnetItems(doc);
                                        
                                    // 更新角标
                                    const badge = toggleBtn.querySelector('.badge');
                                    if (magnetList.length > 0) {
                                        badge.textContent = magnetList.length > 9 ? '9+' : magnetList.length;
                                        badge.classList.remove('no-magnet');
                                    } else {
                                        badge.textContent = '0';
                                        badge.classList.add('no-magnet');
                                    }
                                        
                                    // 回调缓存数据
                                    callback(magnetList);
                                    resolve();
                                },
                                onerror: function() {
                                    const badge = toggleBtn.querySelector('.badge');
                                    if (badge) badge.style.display = 'none';
                                    callback([]);
                                    resolve();
                                },
                                ontimeout: function() {
                                    const badge = toggleBtn.querySelector('.badge');
                                    if (badge) badge.style.display = 'none';
                                    callback([]);
                                    resolve();
                                }
                            });
                        });
                    });
                }
            });
        }, {
            rootMargin: '200px' // 提前200px开始加载
        });
        
        observer.observe(itemEl);
    }
        
    // 解析磁力链项（提取为独立函数）
    function parseMagnetItems(doc) {
        const magnetItems = doc.querySelectorAll('#magnets-content .item, #magnets-content tr, .magnet-links .item');
        let magnetList = [];
            
        magnetItems.forEach(item => {
            const linkEl = item.querySelector('a[href^="magnet:"]') || (item.tagName === 'A' && item.href.startsWith('magnet:') ? item : null);
            if (linkEl) {
                const magnetUrl = linkEl.href;
                let name = item.querySelector('.name')?.textContent.trim() || 
                           item.querySelector('.magnet-name')?.textContent.trim() ||
                           linkEl.title || 
                           item.textContent.trim().split('\n')[0];
                                        
                let meta = item.querySelector('.meta')?.textContent.trim() || 
                           item.querySelector('.size')?.textContent.trim() || 
                           item.querySelector('.date')?.textContent.trim() || '';
            
                // 提取有效标签（严格过滤）
                let tags = [];
                item.querySelectorAll('.tag').forEach(tag => {
                    const text = tag.textContent.trim();
                    // 白名单机制：只保留真正的资源属性标签
                    const validTags = ['字幕', '高清', '无码', '有码', '中文', '无修正'];
                    if (validTags.some(v => text.includes(v)) && !meta.includes(text)) {
                        let className = 'modal-tag';
                        if (tag.classList.contains('is-warning')) className += ' is-warning';
                        else if (tag.classList.contains('is-info')) className += ' is-info';
                        else if (tag.classList.contains('is-success')) className += ' is-success';
                        else if (tag.classList.contains('is-primary')) className += ' is-primary';
                        tags.push({ text, className });
                    }
                });
                                        
                // ====== 从 meta 中提取 size 和 date ======
                let size = '';
                let date = '';
                let hasHD = tags.some(t => t.text.includes('高清'));
                
                if (meta) {
                    // meta 可能包含 "7.54GB | 1個文件" 或 "7.54GB | 2026-05-12" 等格式
                    const metaParts = meta.split('|').map(s => s.trim());
                    metaParts.forEach(part => {
                        if (/\d+(\.\d+)?\s*(MB|GB|TB|KB|MiB|GiB)/i.test(part)) {
                            size = part;
                        } else if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(part)) {
                            date = part;
                        }
                    });
                    
                    // 单值情况：meta 本身就是一个大小或日期
                    if (!size && !date) {
                        if (/\d+(\.\d+)?\s*(MB|GB|TB)/i.test(meta)) {
                            size = meta;
                        } else if (/^\d{4}[-\/]\d/.test(meta)) {
                            date = meta;
                        }
                    }
                }
                
                magnetList.push({
                    name,
                    meta,
                    magnetUrl,
                    tags,
                    size,
                    date,
                    hasHD,
                    hasSub: tags.some(t => t.text.includes('字幕'))
                });
            }
        });
            
        // 排序：有字幕的排在最前面
        magnetList.sort((a, b) => (b.hasSub ? 1 : 0) - (a.hasSub ? 1 : 0));
            
        return magnetList;
    }
        
    // 快速显示磁力链弹窗（使用缓存数据）
    function showMagnetModal(videoCode, magnetList) {
        let html = '<div class="modal-magnet-list">';
        magnetList.forEach(m => {
            let tagsHtml = m.tags.map(t => `<span class="${t.className}">${t.text}</span>`).join('');
            html += `
                <div class="modal-magnet-item">
                    <div class="modal-magnet-info">
                        <div class="modal-magnet-name" title="${m.name}">${m.name}</div>
                        <div class="modal-magnet-meta">${m.meta}</div>
                        <div class="modal-magnet-tags">${tagsHtml}</div>
                    </div>
                    <div class="modal-magnet-btns">
                        <button class="modal-btn modal-btn-copy" onclick="const btn=this; navigator.clipboard.writeText('${m.magnetUrl}').then(() => { const old=btn.textContent; btn.textContent='已复制'; btn.style.background='#2e7d32'; setTimeout(()=>{btn.textContent=old; btn.style.background='';}, 1000); })">复制</button>
                        <button class="modal-btn modal-btn-dl" onclick="window.open('${m.magnetUrl}', '_blank')">下载</button>
                    </div>
                </div>`;
        });
            
        if (magnetList.length === 0) {
            html += '<div class="preview-loading">未找到磁力链接，请确认是否需要登录查看</div>';
        }
        html += '</div>';
            
        showModal(`${videoCode} - 磁力链接`, html);
    }
    
    // 列表页搜索站点配置
    const SEARCH_SITES = [
        { name: '98堂', url: 'https://sehuatang.net/search.php?mod=forum&srchtxt={code}', format: 'query' },
        { name: 'BTSOW', url: 'https://btsow.pics/search/{code}', format: 'path' },
        { name: 'JAVLib', url: 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={code}', format: 'query' },
        { name: 'JAVBUS', url: 'https://javbus.com/{code}', format: 'path' },
        { name: '草榴社区', url: 'https://www.google.com/search?q={code}%20site:t66y.com', format: 'query' },
        { name: '谷歌搜索', url: 'https://www.google.com/search?q={code}', format: 'query' }
    ];

    // 为列表页添加搜索按钮
    function addListPageSearchButtons(container, videoCode) {
        if (!videoCode) return;

        // 防止重复添加
        if (container.querySelector('.list-search-panel')) return;

        const searchPanel = document.createElement('div');
        searchPanel.className = 'list-search-panel';
        searchPanel.style.cssText = 'display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; width: 100%;';

        const buttonColors = [
            { bg: '#dc3545', hover: '#c82333' },
            { bg: '#007bff', hover: '#0056b3' },
            { bg: '#28a745', hover: '#218838' },
            { bg: '#ffc107', hover: '#e0a800', text: '#000' },
            { bg: '#6f42c1', hover: '#5a32a3' },
            { bg: '#17a2b8', hover: '#138496' }
        ];

        SEARCH_SITES.forEach((site, index) => {
            const btn = document.createElement('button');
            btn.textContent = site.name;
            const color = buttonColors[index] || { bg: '#6c757d', hover: '#5a6268' };
            btn.style.cssText = `padding: 2px 6px; background-color: ${color.bg}; color: ${color.text || 'white'}; border: none; border-radius: 3px; cursor: pointer; font-size: clamp(9px, 1.1vw, 11px); font-weight: 500; transition: all 0.2s; white-space: nowrap;`;

            btn.addEventListener('mouseenter', function() { this.style.backgroundColor = color.hover; });
            btn.addEventListener('mouseleave', function() { this.style.backgroundColor = color.bg; });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = site.format === 'path' ? site.url.replace('{code}', videoCode) : site.url.replace('{code}', encodeURIComponent(videoCode));
                window.open(url, '_blank');
            });
            searchPanel.appendChild(btn);
        });

        container.appendChild(searchPanel);
    }

    // 获取磁力链并弹窗
    function fetchMagnetLinks(itemEl, videoCode) {
        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;

        showModal(`${videoCode} - 磁力链接`, '<div class="preview-loading">正在获取磁力链...</div>');

        GM_xmlhttpRequest({
            method: 'GET',
            url: detailLink.href,
            // 关键：必须设置超时。否则请求一旦挂起会永久占用对 javdb.com 的连接，
            // 累积打满浏览器每域名 6 连接上限后，磁力/预览图/短评全部无限排队（表现为怎么点都没反应）
            timeout: 12000,
            onload: function(response) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                
                // 更加全面的选择器适配
                const magnetItems = doc.querySelectorAll('#magnets-content .item, #magnets-content tr, .magnet-links .item');
                let magnetList = [];
                
                magnetItems.forEach(item => {
                    const linkEl = item.querySelector('a[href^="magnet:"]') || (item.tagName === 'A' && item.href.startsWith('magnet:') ? item : null);
                    if (linkEl) {
                        const magnetUrl = linkEl.href;
                        let name = item.querySelector('.name')?.textContent.trim() || 
                                   item.querySelector('.magnet-name')?.textContent.trim() ||
                                   linkEl.title || 
                                   item.textContent.trim().split('\n')[0];
                                        
                        let meta = item.querySelector('.meta')?.textContent.trim() || 
                                   item.querySelector('.size')?.textContent.trim() || 
                                   item.querySelector('.date')?.textContent.trim() || '';
                
                        // 提取有效标签（严格过滤）
                        let tags = [];
                        // 方法1：查找.tag类的元素（JavDB格式）
                        item.querySelectorAll('.tag').forEach(tag => {
                            const text = tag.textContent.trim();
                            const validTags = ['字幕', '高清', '无码', '有码', '中文', '无修正'];
                            if (validTags.some(v => text.includes(v)) && !meta.includes(text)) {
                                let className = 'modal-tag';
                                if (tag.classList.contains('is-warning')) className += ' is-warning';
                                else if (tag.classList.contains('is-info')) className += ' is-info';
                                else if (tag.classList.contains('is-success')) className += ' is-success';
                                else if (tag.classList.contains('is-primary')) className += ' is-primary';
                                tags.push({ text, className });
                            }
                        });
                        
                        // 方法2：查找有title属性包含"包含"或"磁力"的元素（JavBus格式）
                        if (tags.length === 0) {
                            item.querySelectorAll('[title*="包含"], [title*="磁力"]').forEach(tag => {
                                const text = tag.textContent.trim();
                                const validTags = ['字幕', '高清', '无码', '有码', '中文', '无修正'];
                                if (validTags.some(v => text.includes(v)) && !meta.includes(text)) {
                                    let className = 'modal-tag is-primary'; // JavBus标签使用绿色
                                    tags.push({ text, className });
                                }
                            });
                        }
                                        
                        magnetList.push({
                            name,
                            meta,
                            magnetUrl,
                            tags,
                            hasSub: tags.some(t => t.text.includes('字幕'))
                        });
                    }
                });
                
                // 排序：有字幕的排在最前面
                magnetList.sort((a, b) => (b.hasSub ? 1 : 0) - (a.hasSub ? 1 : 0));
                
                let html = '<div class="modal-magnet-list">';
                magnetList.forEach(m => {
                    let tagsHtml = m.tags.map(t => `<span class="${t.className}">${t.text}</span>`).join('');
                    html += `
                        <div class="modal-magnet-item">
                            <div class="modal-magnet-info">
                                <div class="modal-magnet-name" title="${m.name}">${m.name}</div>
                                <div class="modal-magnet-meta">${m.meta}</div>
                                <div class="modal-magnet-tags">${tagsHtml}</div>
                            </div>
                            <div class="modal-magnet-btns">
                                <button class="modal-btn modal-btn-copy" onclick="const btn=this; navigator.clipboard.writeText('${m.magnetUrl}').then(() => { const old=btn.textContent; btn.textContent='已复制'; btn.style.background='#2e7d32'; setTimeout(()=>{btn.textContent=old; btn.style.background='';}, 1000); })">复制</button>
                            </div>
                        </div>`;
                });
                
                if (magnetList.length === 0) {
                    html += '<div class="preview-loading">未找到磁力链接，请确认是否需要登录查看</div>';
                }
                html += '</div>';
                if (isModalVisible()) document.getElementById('emby-modal-body').innerHTML = html;
            },
            onerror: function() {
                if (isModalVisible()) document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading">网络请求失败，请稍后重试</div>';
            },
            ontimeout: function() {
                if (isModalVisible()) document.getElementById('emby-modal-body').innerHTML = '<div class="preview-loading">请求超时，请稍后重试</div>';
            }
        });
    }

    // 获取预览图并弹窗（先查缓存，再回退到请求；详情页直接从 DOM 提取）
    function fetchPreviewImages(itemEl, videoCode) {
        showModal(`${videoCode} - 预览图`, '<div class="preview-loading">正在加载预览图...</div>');

        // 如果已经在详情页，直接从当前 DOM 提取
        if (window.location.pathname.startsWith('/v/')) {
            const imgList = parsePreviewImages(document, window.location.href);
            const actors = parseActorsFromDoc(document);
            if (!isModalVisible()) return;
            if (imgList.length === 0) {
                const actorHeader = renderActorHeaderHTML(actors);
                document.getElementById('emby-modal-body').innerHTML = (actorHeader || '') + '<div class="preview-loading">未找到预览图</div>';
            } else {
                showPreviewModal(videoCode, imgList, actors);
            }
            // 也写入缓存
            PREVIEW_CACHE[videoCode] = { status: 'loaded', imgList, actors };
            return;
        }

        // 检查缓存
        const cached = PREVIEW_CACHE[videoCode];
        if (cached) {
            if (cached.status === 'loaded') {
                if (!isModalVisible()) return;
                if (cached.imgList && cached.imgList.length > 0) {
                    showPreviewModal(videoCode, cached.imgList, cached.actors);
                } else {
                    const actorHeader = renderActorHeaderHTML(cached.actors);
                    document.getElementById('emby-modal-body').innerHTML = (actorHeader || '') + '<div class="preview-loading">未找到预览图</div>';
                }
                return;
            }
            if (cached.status === 'loading') {
                // 正在加载中，等待完成
                const pollInterval = setInterval(() => {
                    if (!isModalVisible()) { clearInterval(pollInterval); return; }
                    const cur = PREVIEW_CACHE[videoCode];
                    if (cur.status === 'loaded') {
                        clearInterval(pollInterval);
                        if (!isModalVisible()) return;
                        if (cur.imgList && cur.imgList.length > 0) {
                            showPreviewModal(videoCode, cur.imgList, cur.actors);
                        } else {
                            const actorHeader = renderActorHeaderHTML(cur.actors);
                            document.getElementById('emby-modal-body').innerHTML = (actorHeader || '') + '<div class="preview-loading">未找到预览图</div>';
                        }
                    } else if (cur.status === 'error') {
                        clearInterval(pollInterval);
                        if (!isModalVisible()) return;
                        document.getElementById('emby-modal-body').innerHTML = `<div class="preview-loading" style="color:#e74c3c;">⚠️ ${cur.errorMsg || '获取失败'}</div>`;
                    }
                }, 200);
                return;
            }
            if (cached.status === 'error') {
                // 之前失败，重新请求
            }
        }

        // 发起请求
        preloadPreviewData(itemEl, videoCode);
        
        // 轮询等待缓存
        const pollInterval = setInterval(() => {
            if (!isModalVisible()) { clearInterval(pollInterval); return; }
            const cur = PREVIEW_CACHE[videoCode];
            if (!cur) return;
            if (cur.status === 'loaded') {
                clearInterval(pollInterval);
                if (!isModalVisible()) return;
                if (cur.imgList && cur.imgList.length > 0) {
                    showPreviewModal(videoCode, cur.imgList, cur.actors);
                } else {
                    const actorHeader = renderActorHeaderHTML(cur.actors);
                    document.getElementById('emby-modal-body').innerHTML = (actorHeader || '') + '<div class="preview-loading">未找到预览图</div>';
                }
            } else if (cur.status === 'error') {
                clearInterval(pollInterval);
                if (!isModalVisible()) return;
                document.getElementById('emby-modal-body').innerHTML = `<div class="preview-loading" style="color:#e74c3c;">⚠️ ${cur.errorMsg || '获取失败'}</div>`;
            }
        }, 200);
    }
    
    // 预加载预览图（后台静默加载 + 请求队列 + 只加载可见区域）
    function preloadPreviewImages(itemEl, callback) {
        const detailLink = getDetailLink(itemEl);
        if (!detailLink) return;
        
        // 使用 IntersectionObserver 监听可见性
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 元素可见时才预加载
                    observer.unobserve(entry.target); // 只加载一次
                    
                    // 将请求放入队列
                    queueRequest(() => {
                        return new Promise((resolve, reject) => {
                            GM_xmlhttpRequest({
                                method: 'GET',
                                url: detailLink.href,
                                timeout: 10000,
                                onload: function(response) {
                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(response.responseText, 'text/html');
                                    const imgList = parsePreviewImages(doc, detailLink.href);
                                    callback(imgList);
                                    resolve();
                                },
                                onerror: function() {
                                    callback([]);
                                    resolve();
                                },
                                ontimeout: function() {
                                    callback([]);
                                    resolve();
                                }
                            });
                        });
                    });
                }
            });
        }, {
            rootMargin: '200px' // 提前200px开始加载
        });
        
        observer.observe(itemEl);
    }
    
    // 从已解析的文档中提取完整演员名单（含性别标记）
    function parseActorsFromDoc(doc) {
        const actors = [];
        const panels = doc.querySelectorAll('.panel-block, .movie-panel-info .panel-block');
        for (let panel of panels) {
            const strong = panel.querySelector('strong');
            if (!strong) continue;
            const label = strong.textContent;
            
            // 检测面板类型：女性演员/男优
            let defaultGender = 'unknown';
            if (label.includes('演員') || label.includes('演员')) {
                defaultGender = 'female';
            } else if (label.includes('男優') || label.includes('男优')) {
                defaultGender = 'male';
            } else {
                continue; // 不相关面板跳过
            }
            
            const actorLinks = panel.querySelectorAll('a');
            actorLinks.forEach(link => {
                const text = link.textContent.trim();
                if (text) {
                    // 检测性别：检查链接本身的文本、链接的相邻元素、以及整个面板的内容
                    let gender = defaultGender;
                    
                    // 方法1：检查链接文本中的符号
                    if (text.match(/[\u2642\u2640♂♀]/)) {
                        if (text.includes('♂') || text.includes('\u2642')) gender = 'male';
                        if (text.includes('♀') || text.includes('\u2640')) gender = 'female';
                    } else {
                        // 方法2：检查链接的下一个兄弟节点（JAVDB 常用 <span>♂</span> 跟在 <a> 后面）
                        const next = link.nextElementSibling || link.nextSibling;
                        if (next) {
                            const nextText = next.textContent || '';
                            if (nextText.includes('♂') || nextText.includes('\u2642')) gender = 'male';
                            else if (nextText.includes('♀') || nextText.includes('\u2640')) gender = 'female';
                        }
                    }
                    
                    const cleanName = text.replace(/[♀♂\u2642\u2640]/g, '').trim();
                    if (cleanName.length > 0) {
                        const href = link.getAttribute('href');
                        const fullUrl = href ? (href.startsWith('http') ? href : new URL(href, 'https://javdb.com').href) : null;
                        actors.push({ name: cleanName, url: fullUrl, gender: gender });
                    }
                }
            });
            // 如果通过链接没找到，检查 .value 容器
            if (actorLinks.length === 0) {
                const value = panel.querySelector('.value');
                if (value) {
                    const text = value.textContent.trim();
                    if (text) {
                        // 从容器文本中检测性别符号
                        const hasMale = text.match(/[\u2642♂]/);
                        const hasFemale = text.match(/[\u2640♀]/);
                        let gender = defaultGender;
                        if (hasMale && !hasFemale) gender = 'male';
                        else if (hasFemale && !hasMale) gender = 'female';
                        actors.push({ name: text.replace(/[♀♂\u2642\u2640]/g, '').trim(), url: null, gender: gender });
                    }
                }
            }
            // 不 break，继续查找其他面板（女性+男性都收集）
        }
        return actors;
    }
    
    // 生成演员名单 HTML（已支持按性别区分颜色）
    function renderActorHeaderHTML(actors) {
        if (!actors || actors.length === 0) return '';
        let html = '<div class="actor-header-bar">';
        html += '<span class="actor-label">🌟 演员：</span>';
        actors.forEach(actor => {
            // 根据性别设置颜色：女性粉色、男性蓝色、未知灰色
            const genderClass = actor.gender === 'female' ? 'actor-female' : (actor.gender === 'male' ? 'actor-male' : 'actor-unknown');
            if (actor.url) {
                html += `<a href="${actor.url}" target="_blank" class="actor-link ${genderClass}">${actor.name}</a>`;
            } else {
                html += `<span class="actor-link ${genderClass}" style="cursor:default;">${actor.name}</span>`;
            }
        });
        html += '</div>';
        return html;
    }
    
    // 解析预览图（提取为独立函数）
    function parsePreviewImages(doc, baseUrl) {
        const sampleContainer = doc.querySelector('.tile-images, .sample-images');
        const imgList = [];

        if (sampleContainer) {
            // 优先提取 <a> 标签中的大图链接，避免重复抓取缩略图
            sampleContainer.querySelectorAll('a').forEach(el => {
                if (el.href && (el.href.match(/\.(jpg|jpeg|png|webp)$/i) || el.href.includes('img.php'))) {
                    let src = el.href;
                    if (src.startsWith('//')) src = 'https:' + src;
                    else if (src.startsWith('/')) src = new URL(src, baseUrl).href;
                    if (!imgList.includes(src)) {
                        imgList.push(src);
                    }
                }
            });
            
            // 如果没有找到，尝试直接提取 <img> 标签
            if (imgList.length === 0) {
                sampleContainer.querySelectorAll('img').forEach(img => {
                    let src = img.src || img.dataset.src;
                    if (src) {
                        if (src.startsWith('//')) src = 'https:' + src;
                        else if (src.startsWith('/')) src = new URL(src, baseUrl).href;
                        // 过滤掉明显的缩略图
                        if (!src.includes('thumb') && !src.includes('small') && !imgList.includes(src)) {
                            imgList.push(src);
                        }
                    }
                });
            }
        }
        
        return imgList;
    }
    
    // 快速显示预览图弹窗（使用缓存数据）
    function showPreviewModal(videoCode, imgList, actors) {
        initImageViewer();
        let html = '';
        // 集成演员名单到顶部
        if (actors && actors.length > 0) {
            html += renderActorHeaderHTML(actors);
        }
        html += '<div class="modal-images-grid">';
        imgList.forEach((src, index) => {
            // 使用数据属性存储图片信息，避免字符串转义问题
            html += `<img src="${src}" data-index="${index}" class="preview-image" style="cursor: pointer;" />`;
        });
        html += '</div>';
        showModal(`${videoCode} - 预览图 (${imgList.length}张)`, html);
        
        // 添加点击事件
        setTimeout(() => {
            document.querySelectorAll('.preview-image').forEach(img => {
                img.onclick = () => {
                    const index = parseInt(img.dataset.index);
                    window.openImageViewer(imgList, index);
                };
            });
        }, 100);
    }

    function renderExists(statusDiv, info, serverType = 'emby') {
        const label = serverType === 'emby' ? 'Emby已入库' : 'Jellyfin已入库';
        if (!statusDiv.isConnected) {
            const el = document.querySelector(`.emby-status[data-type="${serverType}"]`);
            if (!el) return; statusDiv = el;
        }
        statusDiv.className = 'emby-status exists';
        statusDiv.textContent = label;

        const servers = getServers();
        const currentServer = servers.find(s => s.name === info.serverName) || { url: info.serverUrl };
        const finalUrl = currentServer.url || info.serverUrl;
        const detailPath = serverType === 'emby'
            ? `/web/index.html#!/item?id=${info.itemId}&serverId=${info.serverId}`
            : `/web/index.html#!/details?id=${info.itemId}&serverId=${info.serverId}`;

        statusDiv.title = `点击打开${serverType === 'emby' ? 'EMBY' : 'Jellyfin'}\n服务器: ${info.serverName}`;
        statusDiv.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            window.open(`${finalUrl}${detailPath}`, '_blank');
        };
    }

    function renderNotExists(statusDiv, serverType = 'emby') {
        const label = serverType === 'emby' ? 'Emby未入库' : 'Jellyfin未入库';
        if (!statusDiv.isConnected) {
            const el = document.querySelector(`.emby-status[data-type="${serverType}"]`);
            if (!el) return; statusDiv = el;
        }
        statusDiv.className = 'emby-status not-exists';
        statusDiv.textContent = label;
        statusDiv.title = '未在服务器中找到，点击打开设置';
        statusDiv.style.cursor = 'pointer';
        statusDiv.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            showSettingsDialog('tab-emby');
        };
    }

    // 新增：渲染状态消息（如未添加服务器、连接失败）
    function renderStatusMessage(statusDiv, message, type, serverType = 'emby') {
        const prefix = serverType === 'emby' ? 'Emby' : 'Jellyfin';
        // 简化长错误消息
        const shorten = (msg) => {
            if (msg.includes('未添加服务器')) return '未添加';
            if (msg.includes('地址错误') || msg.includes('无法连接') || msg.includes('连接超时') || msg.includes('连接失败') || msg.includes('所有服务器') || msg.includes('连接出错')) return '无法连接';
            if (msg.includes('返回数据异常')) return '数据异常';
            if (msg.includes('API Key')) return 'API Key 错误';
            if (msg.includes('配置不完整')) return '配置不完整';
            return msg;
        };
        const shortMsg = shorten(message);
        const label = shortMsg.startsWith(prefix) || shortMsg.startsWith('点击') ? shortMsg : prefix + shortMsg;
        // 确保 statusDiv 仍然在 DOM 中，如果已脱离则通过 data-type 重新定位
        const el = statusDiv.isConnected ? statusDiv : document.querySelector(`.emby-status[data-type="${serverType}"]`);
        if (!el) return;
        el.className = `emby-status ${type}`;
        el.textContent = label;
        el.title = label;
        el.style.cursor = 'pointer';
        el.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            showSettingsDialog('tab-emby');
        };
    }

    // 请求队列：限制并发 GM_xmlhttpRequest 数量，防止限流导致回调丢失
    const xhrQueue = [];
    let xhrRunning = 0;
    const MAX_CONCURRENT_XHR = 3;

    function enqueueXhr(fn) {
        xhrQueue.push(fn);
        processXhrQueue();
    }
    function processXhrQueue() {
        while (xhrRunning < MAX_CONCURRENT_XHR && xhrQueue.length > 0) {
            xhrRunning++;
            const fn = xhrQueue.shift();
            // 幂等释放 + 看门狗：即使回调因浏览器休眠/扩展限流等原因丢失，
            // 20 秒后也会强制释放槽位，防止队列永久卡死（表现为后续所有状态验证都不再刷新）
            const release = (() => {
                let released = false;
                return () => {
                    if (released) return;
                    released = true;
                    xhrRunning--;
                    processXhrQueue();
                };
            })();
            setTimeout(release, 20000);
            fn(release);
        }
    }

    // 后台验证状态（实时同步关键）；同一番号同一服务器的在飞请求去重，避免队列被重复验证淹没
    function verifyStatusBackground(statusDiv, videoCode, cachedExists, serverType = 'emby') {
        const servers = getServersByType(serverType);
        if (servers.length === 0) return;

        const firstServer = servers[0];

        if (!firstServer.url || !firstServer.apiKey) {
            renderStatusMessage(statusDiv, '服务器配置不完整', 'error', serverType);
            return;
        }

        const verifyKey = serverType + ':' + videoCode.toUpperCase();
        if (!verifyStatusBackground._inflight) verifyStatusBackground._inflight = new Set();
        if (verifyStatusBackground._inflight.has(verifyKey)) return;
        verifyStatusBackground._inflight.add(verifyKey);

        const apiUrl = `${firstServer.url}/Items?searchTerm=${encodeURIComponent(videoCode)}&Recursive=true&IncludeItemTypes=Movie&Limit=1&api_key=${firstServer.apiKey}`;

        const isEmby = serverType === 'emby';
        const indexVar = isEmby ? LIBRARY_INDEX : JELLYFIN_LIBRARY_INDEX;
        const syncError = isEmby ? SYNC_ERROR : JELLYFIN_SYNC_ERROR;
        const indexKey = isEmby ? 'emby_library_index' : 'jellyfin_library_index';

        enqueueXhr(function(done) {
            const finish = () => { verifyStatusBackground._inflight.delete(verifyKey); done(); };
            GM_xmlhttpRequest({
            method: 'GET',
            url: apiUrl,
            timeout: 1500,
            onload: function(response) {
                if (response.status !== 200) {
                    let msg = `连接出错 (${response.status})`;
                    if (response.status === 401) msg = `${serverType === 'emby' ? 'Emby' : 'Jellyfin'} API Key 错误`;
                    firstServer.lastError = true;
                    firstServer.statusMsg = msg;
                    renderStatusMessage(statusDiv, msg, 'error', serverType);
                    finish(); return;
                }
                // 连接成功，清除错误状态
                firstServer.lastError = false;
                firstServer.statusMsg = '';
                try {
                    const data = JSON.parse(response.responseText);
                    const nowExists = data.Items && data.Items.length > 0;

                    if (cachedExists && !nowExists) {
                        if (isEmby) {
                            delete LIBRARY_INDEX[videoCode.toUpperCase()];
                            GM_setValue(indexKey, JSON.stringify(LIBRARY_INDEX));
                        } else {
                            delete JELLYFIN_LIBRARY_INDEX[videoCode.toUpperCase()];
                            GM_setValue(indexKey, JSON.stringify(JELLYFIN_LIBRARY_INDEX));
                        }
                        renderNotExists(statusDiv, serverType);
                    } else if (!cachedExists && nowExists) {
                        const item = data.Items[0];
                        const newInfo = {
                            itemId: item.Id,
                            serverId: item.ServerId,
                            serverUrl: firstServer.url,
                            serverName: firstServer.name
                        };
                        if (isEmby) {
                            LIBRARY_INDEX[videoCode.toUpperCase()] = newInfo;
                            GM_setValue(indexKey, JSON.stringify(LIBRARY_INDEX));
                        } else {
                            JELLYFIN_LIBRARY_INDEX[videoCode.toUpperCase()] = newInfo;
                            GM_setValue(indexKey, JSON.stringify(JELLYFIN_LIBRARY_INDEX));
                        }
                        renderExists(statusDiv, newInfo, serverType);
                    }
                } catch (e) {
                    renderStatusMessage(statusDiv, `${serverType === 'emby' ? 'Emby' : 'Jellyfin'}返回数据异常`, 'error', serverType);
                }
                finish();
            },
            onerror: function() {
                firstServer.lastError = true;
                firstServer.statusMsg = '地址错误或无法连接';
                renderStatusMessage(statusDiv, '地址错误或无法连接', 'error', serverType);
                finish();
            },
            ontimeout: function() {
                firstServer.lastError = true;
                firstServer.statusMsg = '连接超时';
                renderStatusMessage(statusDiv, '连接超时', 'error', serverType);
                finish();
            }
        });
        });
    }

    // 标记已处理的元素，避免重复处理（使用无连字符名称，避免 DOMStringMap 在某些浏览器中抛 SyntaxError）
    const PROCESSED_MARK = 'jb_processed';

    // ========== 卡片布局增强（移植自 JAV老司机-新：竖图模式/卡片动画/卡片列数/页面宽度） ==========
    // 仅在 JavDB 站点的列表页生效；无缝翻页新增卡片会通过 MutationObserver 重新应用
    const jbIsMobileUA = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const jbPageZoomDefault = () => {
        // 2K 及以上大屏默认 86%，小屏 100%（照搬原版 getPageZoomDefault）
        const long = Math.max(window.screen?.width || 0, window.screen?.height || 0);
        return long && long < 2560 ? 100 : 86;
    }
    window.jbPageZoomDefaultFn = jbPageZoomDefault;

    function jbCardLayoutEnsureStyle() {
        if (document.getElementById('jb-card-layout-style')) return;
        const style = document.createElement('style');
        style.id = 'jb-card-layout-style';
        style.textContent = `
            /* 卡片列数：CSS 变量控制 grid 列数（覆盖原生 cols-N） */
            .movie-list.h{display:grid!important;grid-template-columns:repeat(var(--jb-card-columns,4),minmax(0,1fr))!important;gap:14px!important;align-items:stretch!important}
            /* 卡片动画（默认开启）：悬停上浮 + 阴影加深 */
            .movie-list .item > a.box{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important;transform:translateZ(0)!important;will-change:transform!important}
            .movie-list .item > a.box:hover{border-color:rgba(37,99,235,.35)!important;box-shadow:0 10px 24px rgba(15,23,42,.16)!important;transform:translateY(-4px) scale(1.018)!important;z-index:2!important}
            /* 卡片动画关闭：移除位移动画，仅保留封面图轻微放大 */
            html[data-jb-card-fx="off"] .movie-list .item > a.box{transition:none!important;will-change:auto!important;transform:none!important}
            html[data-jb-card-fx="off"] .movie-list .item > a.box:hover{transform:none!important;box-shadow:0 1px 4px rgba(15,23,42,.08)!important;border-color:rgba(148,163,184,.35)!important}
            html[data-jb-card-fx="off"] .movie-list .item > a.box:hover .cover img{transform:scale(1.06)!important}
            .movie-list .item > a.box .cover img{transition:transform .22s ease!important}
            /* 竖图模式：封面切换为 380:538 竖版比例，图片右对齐裁剪 */
            html.jb-portrait-mode .movie-list .item > a.box .cover{aspect-ratio:380/538!important;background:#f1f5f9!important}
            html.jb-portrait-mode .movie-list .item > a.box .cover img{object-fit:cover!important;object-position:right center!important}
        `;
        document.head.appendChild(style);
    }

    // 竖图模式：横图缩略图换成竖版大图，记录原始 src 便于切回
    function jbApplyPortraitImages(on) {
        document.querySelectorAll('.movie-list .item img').forEach(img => {
            if (!img.dataset.jbThumbSrc) img.dataset.jbThumbSrc = img.src || '';
            if (on) {
                if (/\/thumbs\//.test(img.dataset.jbThumbSrc)) {
                    img.src = img.dataset.jbThumbSrc.replace('/thumbs/', '/covers/');
                }
            } else {
                if (img.src !== img.dataset.jbThumbSrc) img.src = img.dataset.jbThumbSrc;
            }
        });
    }

    // 统一应用入口：列数 + 页面宽度 + 竖图 + 动画开关
    function jbApplyCardLayout() {
        if (jbIsMobileUA()) return; // 移动端不启用，保持原生布局
        if (!document.querySelector('.movie-list.h')) return;
        jbCardLayoutEnsureStyle();

        // 1. 卡片列数（2-10，默认 5）
        const columns = Math.min(10, Math.max(2, parseInt(GM_getValue('jb_card_columns', 5), 10) || 5));
        document.querySelectorAll('.movie-list.h').forEach(el => {
            el.style.setProperty('--jb-card-columns', String(columns));
        });

        // 2. 页面宽度（60-100%）
        const zoom = Math.min(100, Math.max(60, parseInt(GM_getValue('jb_page_zoom', jbPageZoomDefault()), 10) || jbPageZoomDefault()));
        document.querySelectorAll('body > section > div').forEach(el => {
            el.style.setProperty('zoom', '1');
            el.style.setProperty('width', zoom + '%', 'important');
            el.style.setProperty('max-width', 'none', 'important');
            el.style.setProperty('margin-left', 'auto', 'important');
            el.style.setProperty('margin-right', 'auto', 'important');
            el.style.setProperty('box-sizing', 'border-box', 'important');
        });

        // 3. 竖图模式（默认关闭）
        const portrait = GM_getValue('jb_portrait_cards', false);
        document.documentElement.classList.toggle('jb-portrait-mode', !!portrait);
        jbApplyPortraitImages(!!portrait);

        // 4. 卡片动画（默认开启）：关闭时在 html 上标记
        const cardFx = GM_getValue('jb_card_fx', true);
        if (cardFx) document.documentElement.removeAttribute('data-jb-card-fx');
        else document.documentElement.setAttribute('data-jb-card-fx', 'off');
    }
    window.jbApplyCardLayoutFn = jbApplyCardLayout;

    // 监听列表 DOM 变化（无缝翻页新增卡片后重新应用列数/竖图）
    (function jbWatchCardLayout() {
        const start = () => {
            if (!document.body) return setTimeout(start, 100);
            const obs = new MutationObserver(() => {
                clearTimeout(window.__jbCardLayoutTimer);
                window.__jbCardLayoutTimer = setTimeout(jbApplyCardLayout, 120);
            });
            obs.observe(document.body, { childList: true, subtree: true });
        };
        start();
    })();

    function initCheck() {
        if (document.hidden) return; // 页面隐藏时不执行
        console.log('JavdbBuddy: 执行页面扫描');

        // 防御性执行：任何阶段出错只跳过该阶段，绝不中断后续功能（教训：一个未定义函数曾导致列表页快捷键全部消失）
        const safe = (label, fn) => {
            try { fn(); } catch (e) { console.error(`JavdbBuddy: [阶段异常] ${label}`, e); }
        };

        // 应用列表页链接 target 设置
        safe('链接target', applyListPageLinkTarget);
        // 应用弹窗方式打开详情页
        safe('弹窗打开详情页', applyListPagePopup);
        // 应用所有链接 target 设置
        safe('全局链接target', applyAllLinksTarget);
        // 初始化悬浮封面放大
        safe('悬浮封面放大', initHoverZoom);
        // 应用卡片布局增强（竖图/动画/列数/页面宽度）
        safe('卡片布局', jbApplyCardLayout);
        // 初始化无缝翻页（瀑布流）
        safe('无缝翻页', initAutoPaging);
        // 列表页顶部推广横幅（有 id 防重复）
        safe('推广横幅', addPromoBanner);
        // 演员页关注按钮
        safe('演员页工具', initActorPageTools);

        // 详情页
        if (window.location.pathname.startsWith('/v/')) {
            console.log('JavdbBuddy: 检测到详情页，开始查找番号元素');

            // 多种方式查找番号元素
            const blocks = document.querySelectorAll('.video-meta-panel .panel-block, .movie-panel-info .panel-block, .panel-block');
            console.log(`JavdbBuddy: 找到 ${blocks.length} 个 panel-block`);

            let foundCode = false;
            for (let block of blocks) {
                // 跳过已处理的块
                if (block.dataset[PROCESSED_MARK]) continue;

                const strongEl = block.querySelector('strong');
                console.log('JavdbBuddy: 检查 panel-block, strong 内容:', strongEl?.textContent);

                if (strongEl && (strongEl.textContent.includes('番號') || strongEl.textContent.includes('番号'))) {
                    const val = block.querySelector('.value');
                    console.log('JavdbBuddy: 找到番号块，value:', val?.textContent);

                    if (val) {
                        foundCode = true;

                        // 强制番号不换行、不被flex压缩，从根源解决竖排问题
                        val.style.whiteSpace = 'nowrap';
                        val.style.flexShrink = '0';
                        val.style.minWidth = 'max-content';
                        val.style.display = 'inline-block';
                        val.style.wordBreak = 'keep-all';
                        block.style.flexWrap = 'wrap';

                        const videoCode = val.textContent.trim().replace(/[^\w\-]/g, '');

                        // 清理已存在的容器和提示（防止重复添加）
                        block.querySelectorAll('.emby-status-wrap').forEach(el => el.remove());

                        const copyBtn = block.querySelector('.copy-to-clipboard');

                        // 创建一个 inline-flex 容器来水平排列两个标签，避免竖排
                        const statusWrap = document.createElement('span');
                        statusWrap.className = 'emby-status-wrap';
                        statusWrap.style.cssText = 'display: inline-flex !important; flex-direction: row !important; gap: 4px; align-items: center; margin-left: 4px; flex-wrap: wrap; vertical-align: middle; min-width: fit-content; flex-shrink: 0 !important;';
                        if (copyBtn) copyBtn.after(statusWrap);
                        else {
                            const val = block.querySelector('.value');
                            if (val) val.after(statusWrap);
                            else block.appendChild(statusWrap);
                        }
                        addStatusIndicator(statusWrap, videoCode, null, null, 'emby');
                        addStatusIndicator(statusWrap, videoCode, null, null, 'jellyfin');

                        // 详情页字幕状态标签
                        if (GM_getValue('jb_show_subtitle_search', false)) {
                            const subBtn = document.createElement('span');
                            subBtn.className = 'subtitle-status searching';
                            subBtn.textContent = '🔄 字幕';
                            subBtn.title = '正在搜索字幕...';
                            statusWrap.appendChild(subBtn);
                            searchSubtitles(videoCode, (results) => {
                                if (!subBtn.isConnected) return;
                                if (results.length > 0) {
                                    subBtn.className = 'subtitle-status has-sub';
                                    subBtn.textContent = `🈶 字幕(${results.length})`;
                                    subBtn.title = `点击查看 ${results.length} 个字幕结果`;
                                } else {
                                    subBtn.className = 'subtitle-status no-sub';
                                    subBtn.textContent = '❌ 无字幕';
                                    subBtn.title = '点击查看搜索结果';
                                }
                                subBtn.onclick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    showSubtitleResults(videoCode, results);
                                };
                            });
                        }

                        // 详情页在线播放按钮
                        addOnlinePlayButton(statusWrap, videoCode);

                        // 详情页预览图按钮
                        addDetailPreviewButton(statusWrap, videoCode);

                        // 为详情页番号块添加网站搜索按钮
                        // 先清理 block 后面可能残留的旧搜索面板（after 插入的是兄弟节点，querySelector 查不到）
                        let next = block.nextElementSibling;
                        while (next && next.classList.contains('detail-search-panel')) {
                            const toRemove = next;
                            next = next.nextElementSibling;
                            toRemove.remove();
                        }
                        if (!block.nextElementSibling || !block.nextElementSibling.classList.contains('detail-search-panel')) {
                            const detailSearchPanel = document.createElement('div');
                            detailSearchPanel.className = 'detail-search-panel';
                            detailSearchPanel.style.cssText = 'display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;';
                            const dColors = [
                                { bg: '#dc3545', hover: '#c82333', text: '#fff' },
                                { bg: '#007bff', hover: '#0056b3', text: '#fff' },
                                { bg: '#28a745', hover: '#218838', text: '#fff' },
                                { bg: '#ffc107', hover: '#e0a800', text: '#000' },
                                { bg: '#6f42c1', hover: '#5a32a3', text: '#fff' },
                                { bg: '#17a2b8', hover: '#138496', text: '#fff' }
                            ];
                            SEARCH_SITES.forEach((site, idx) => {
                                const btn = document.createElement('button');
                                btn.textContent = site.name;
                                const c = dColors[idx];
                                btn.style.cssText = `padding: 3px 8px; background-color: ${c.bg}; color: ${c.text}; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; white-space: nowrap;`;
                                btn.addEventListener('mouseenter', function() { this.style.backgroundColor = c.hover; });
                                btn.addEventListener('mouseleave', function() { this.style.backgroundColor = c.bg; });
                                btn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const url = site.format === 'path' ? site.url.replace('{code}', videoCode) : site.url.replace('{code}', encodeURIComponent(videoCode));
                                    window.open(url, '_blank');
                                });
                                detailSearchPanel.appendChild(btn);
                            });
                            block.after(detailSearchPanel);
                        }

                        // 标记为已处理
                        block.dataset[PROCESSED_MARK] = '1';

                        break;
                    }
                }
            }

            if (!foundCode) {
                console.log('JavdbBuddy: 未能通过 panel-block 找到番号，尝试其他方法');
            }
        }

        // 列表页 - 只处理未处理过的项目（兼容 .grid-item 和 .movie-list .item）
        const listItems = document.querySelectorAll('.grid-item:not([data-' + PROCESSED_MARK + ']), .movie-list .item:not([data-' + PROCESSED_MARK + '])');
        console.log('JavdbBuddy: 找到新列表项数量:', listItems.length);

        listItems.forEach((item, index) => {
            try {
                console.log(`JavdbBuddy: 处理第 ${index + 1} 个新列表项`);
                const titleDiv = item.querySelector('.video-title');
                const tags = item.querySelector('.tags');
                // 尝试多个选择器找到日期元素（JavDB 新版用 .video-date，旧版用 .meta 或 .date）
                const dateEl = item.querySelector('.video-date') || item.querySelector('.date') || item.querySelector('.meta');
                if (titleDiv && tags) {
                const code = extractCodeFromTitle(titleDiv.textContent) || titleDiv.textContent.trim().split(/\s+/)[0];
                if (!code || code.length <= 2) {
                    item.dataset[PROCESSED_MARK] = '1'; // 标记为已处理（即使无有效code）
                    return;
                }

                // 1. 入库状态标签：用 emby-status-wrap 包裹日期和标签同行显示
                if (dateEl) {
                    const existingWrap = dateEl.closest('.emby-status-wrap');
                    if (existingWrap) {
                        // 已包裹：只刷新标签，不重建 wrapper（避免孤儿 API 回调）
                        existingWrap.querySelectorAll('.emby-status').forEach(el => el.remove());
                        addStatusIndicator(existingWrap, code, item, null, 'emby');
                        addStatusIndicator(existingWrap, code, item, null, 'jellyfin');
                    } else {
                        // 首次：创建 wrapper 包裹日期
                        const statusWrap = document.createElement('span');
                        statusWrap.className = 'emby-status-wrap';
                        dateEl.before(statusWrap);
                        statusWrap.appendChild(dateEl);
                        addStatusIndicator(statusWrap, code, item, null, 'emby');
                        addStatusIndicator(statusWrap, code, item, null, 'jellyfin');
                    }
                }

                // 2. 其他工具按钮容器
                let toolsContainer = item.querySelector('.emby-tools-container');
                if (!toolsContainer) {
                    toolsContainer = document.createElement('div');
                    toolsContainer.className = 'emby-tools-container';
                    toolsContainer.style.cssText = 'margin-top: 5px; width: 100%; display: block;';
                    tags.after(toolsContainer);
                }

                // 3. 第一行快捷按钮：短评、预览图、磁力链、播放
                let toolsRow = toolsContainer.querySelector('.emby-tools-row');
                if (!toolsRow) {
                    toolsRow = document.createElement('div');
                    toolsRow.className = 'emby-tools-row';
                    toolsRow.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 3px; width: 100%; overflow: visible;';
                    toolsContainer.appendChild(toolsRow);

                    addShortReviewButton(toolsRow, item, code);
                    addPreviewToggle(toolsRow, item, code);
                    addMagnetToggle(toolsRow, item, code);
                    // 播放紧跟在第一排“磁力链”后面，避免被误排到第二行。
                    addOnlinePlayButton(toolsRow, code);

                    // 字幕搜索按钮（第一行末尾，磁力链后面）
                    if (GM_getValue('jb_show_subtitle_search', false)) {
                        const subBtn = document.createElement('button');
                        subBtn.className = 'jb-subtitle-btn';
                        subBtn.textContent = '字幕';
                        subBtn.title = '点击搜索字幕';
                        subBtn.style.cssText = 'padding: 2px 8px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 500; white-space: nowrap;';
                        subBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            showSubtitleResults(code, null, true);
                            searchSubtitles(code, (results) => {
                                showSubtitleResults(code, results);
                            });
                        });
                        toolsRow.appendChild(subBtn);
                    }
                }

                // 3.5 第二行快捷按钮：想看、看过、存入清单（播放已放到第一行磁力链后）
                let toolsRow2 = toolsContainer.querySelector('.emby-tools-row2');
                if (!toolsRow2) {
                    toolsRow2 = document.createElement('div');
                    toolsRow2.className = 'emby-tools-row2 jb-account-actions';
                    toolsRow2.dataset.jbCode = code;
                    toolsRow2.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 3px; width: 100%; margin-top: 3px; overflow: visible;';
                    // 插入到搜索面板之前，保证顺序：第一行 → 第二行 → 搜索行
                    const existingSearchPanel = toolsContainer.querySelector('.list-search-panel');
                    if (existingSearchPanel) toolsContainer.insertBefore(toolsRow2, existingSearchPanel);
                    else toolsContainer.appendChild(toolsRow2);

                    addWantWatchButton(toolsRow2, item, code);
                    addWatchedButton(toolsRow2, item, code);
                    addSaveListButton(toolsRow2, item, code);
                    addCopyCodeButton(toolsRow2, code);
                }

                // 列表页字幕搜索按钮（toolsRow 已存在时，检查并插入到磁力链后面）
                if (GM_getValue('jb_show_subtitle_search', false) && toolsRow && !toolsRow.querySelector('.jb-subtitle-btn')) {
                    const subBtn = document.createElement('button');
                    subBtn.className = 'jb-subtitle-btn';
                    subBtn.textContent = '字幕';
                    subBtn.title = '点击搜索字幕';
                    subBtn.style.cssText = 'padding: 2px 8px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 500; white-space: nowrap;';
                    subBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showSubtitleResults(code, null, true);
                        searchSubtitles(code, (results) => {
                            showSubtitleResults(code, results);
                        });
                    });
                    // 插入到磁力链按钮后面（如果有的话），否则追加到第一行末尾
                    const magnetBtn = toolsRow.querySelector('.magnet-toggle, [data-jb-magnet]');
                    if (magnetBtn && magnetBtn.nextSibling) {
                        toolsRow.insertBefore(subBtn, magnetBtn.nextSibling);
                    } else {
                        toolsRow.appendChild(subBtn);
                    }
                }

                // 4. 搜索按钮（第三行，受设置开关控制）
                if (GM_getValue('jb_show_list_search', true)) {
                    if (!toolsContainer.querySelector('.list-search-panel')) {
                        addListPageSearchButtons(toolsContainer, code);
                    }
                } else {
                    const existingPanel = toolsContainer.querySelector('.list-search-panel');
                    if (existingPanel) existingPanel.style.display = 'none';
                }

                // 只请求一次详情页，同时初始化三个账户按钮状态，确保与详情页同步。
                if (!item.dataset.jbAccountStateRequested) {
                    item.dataset.jbAccountStateRequested = '1';
                    jbLoadAccountState(item, code);
                }

                // 标记为已处理
                item.dataset[PROCESSED_MARK] = '1';
                } else {
                    console.log(`JavdbBuddy: 第 ${index + 1} 项缺少必要元素`, { titleDiv: !!titleDiv, tags: !!tags });
                }
            } catch (e) {
                console.error(`JavdbBuddy: 第 ${index + 1} 个列表项处理失败（不影响其他条目）`, e);
                item.dataset[PROCESSED_MARK] = '1'; // 出错也标记，避免死循环重试
            }
        });
    }

    // ========== 无缝翻页（瀑布流）：列表页滚动到底部自动加载下一页 ==========
    // 参考自 Greasy Fork JAV-JHS 脚本的 AutoPagePlugin，适配 JavdbBuddy 架构
    function initAutoPaging() {
        // 设置开关（默认开启）
        if (!GM_getValue('jb_enable_autopaging', true)) return;
        // 防止重复初始化
        if (window.__jbAutopageInited) return;

        // 仅在列表页生效（存在电影列表容器和分页导航）
        const container = document.querySelector('.movie-list');
        if (!container) return;

        // 跳过不适用的页面（搜索页、想要看/已看过、脚本自建的热播/Top250 免VIP页面）
        const href = location.href;
        if (['search?q', 'laosiji_rank=', '/want_watch_videos', '/watched_videos', 'advanced_search?type=100'].some(p => href.includes(p))) return;

        const nextLink = document.querySelector('.pagination-next');
        let nextUrl = nextLink ? nextLink.href : null;
        if (!nextUrl) return; // 没有下一页，无需瀑布流

        window.__jbAutopageInited = true;
        const preloadDistance = 500; // 距底部多远开始预加载
        const maxPage = 60; // JavDB 列表页码上限
        let isLoading = false;
        let currentPage = (function () {
            const m = href.match(/[?&]page=(\d+)/);
            return m ? parseInt(m[1], 10) : 1;
        })();
        const pageItems = [{ page: currentPage, top: 0, url: href }];

        // 注入样式（只注入一次）
        if (!document.getElementById('jb-autopage-style')) {
            const style = document.createElement('style');
            style.id = 'jb-autopage-style';
            style.textContent = `
                .jb-autopage-scroll { text-align: center; padding: 20px 0; font-size: 14px; color: #666; }
                .jb-autopage-scroll.jb-autopage-loading { color: #2196F3; }
                .jb-autopage-scroll.jb-autopage-error { color: #f44336; cursor: pointer; }
                .jb-autopage-scroll.jb-autopage-nomore { color: #4CAF50; }
            `;
            document.head.appendChild(style);
        }

        // 加载状态指示器（插在列表容器后面）
        const loader = document.createElement('div');
        loader.className = 'jb-autopage-scroll';
        container.parentNode.insertBefore(loader, container.nextSibling);
        const setState = (state, text) => {
            loader.className = 'jb-autopage-scroll' + (state ? ' ' + state : '');
            loader.textContent = text || '';
        };
        // 加载失败时点击重试
        loader.addEventListener('click', () => {
            if (loader.classList.contains('jb-autopage-error')) loadNextPage();
        });

        // 提取当前列表中所有条目的详情链接（用于重复检测）
        const getItemIds = (scope) => {
            const ids = [];
            (scope || document).querySelectorAll('.movie-list .item a[href^="/v/"]').forEach(a => {
                const id = a.getAttribute('href').split(/[?#]/)[0];
                if (id && !ids.includes(id)) ids.push(id);
            });
            return ids;
        };

        // 检测下一页内容是否与当前页重复（JavDB 超出页码限制时会返回重复内容，连续2条重复即判定）
        const isDuplicatePage = (currentIds, newIds) => {
            if (!currentIds.length || !newIds.length) return false;
            const current = new Set(currentIds);
            let consecutive = 0;
            for (const id of newIds) {
                if (current.has(id)) {
                    consecutive++;
                    if (consecutive >= 2) return true;
                } else {
                    consecutive = 0;
                }
            }
            return false;
        };

        // 滚动位置同步地址栏（刷新/分享时停留在当前所在页）
        const checkScrollPosition = () => {
            const y = window.scrollY;
            for (let i = pageItems.length - 1; i >= 0; i--) {
                if (y >= pageItems[i].top) {
                    if (currentPage !== pageItems[i].page) {
                        currentPage = pageItems[i].page;
                        history.replaceState({}, '', pageItems[i].url);
                    }
                    break;
                }
            }
        };

        const checkLoad = () => {
            if (!loader || !loader.isConnected) return;
            if (loader.getBoundingClientRect().top < window.innerHeight + preloadDistance) loadNextPage();
        };

        window.addEventListener('scroll', () => {
            // 运行中关闭开关后不再自动加载
            if (!GM_getValue('jb_enable_autopaging', true)) return;
            checkLoad();
            checkScrollPosition();
        }, { passive: true });

        const loadNextPage = () => {
            if (isLoading || !nextUrl) return;
            // 超出 JavDB 页码上限，主动停止
            const pageNumMatch = nextUrl.match(/[?&]page=(\d+)/);
            if (pageNumMatch && parseInt(pageNumMatch[1], 10) > maxPage) {
                nextUrl = null;
                setState('jb-autopage-nomore', '已加载到第 ' + maxPage + ' 页（JavDB 页码限制）');
                return;
            }
            isLoading = true;
            setState('jb-autopage-loading', '加载中...');
            GM_xmlhttpRequest({
                method: 'GET',
                url: nextUrl,
                headers: { 'Accept': 'text/html' },
                timeout: 15000,
                onload: (resp) => {
                    try {
                        if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
                        const doc = new DOMParser().parseFromString(resp.responseText, 'text/html');
                        const itemList = doc.querySelectorAll('.movie-list .item');
                        if (!itemList.length) throw new Error('下一页无内容');

                        // 重复检测
                        const currentIds = getItemIds(document);
                        const newIds = [];
                        itemList.forEach(item => {
                            const a = item.querySelector('a[href^="/v/"]');
                            if (a) newIds.push(a.getAttribute('href').split(/[?#]/)[0]);
                        });
                        if (isDuplicatePage(currentIds, newIds)) {
                            nextUrl = null;
                            setState('jb-autopage-nomore', '检测到重复内容（已达 JavDB 页码限制），已停止加载');
                            return;
                        }

                        // 记录本页顶部位置（用于滚动时同步地址栏）
                        pageItems.push({ page: currentPage + 1, top: container.scrollHeight, url: nextUrl });

                        // 追加条目到当前列表
                        itemList.forEach(item => container.appendChild(document.adoptNode(item)));

                        // 更新下一页链接（必须在 adoptNode 移走分页条之前从 doc 中提取，否则查不到）
                        const nl = doc.querySelector('.pagination-next');
                        nextUrl = nl ? nl.href : null;

                        // 用最新一页的分页条替换旧分页条（保留手动跳页能力）
                        const newPagination = doc.querySelector('.pagination');
                        if (newPagination) {
                            const old = document.querySelector('.pagination');
                            if (old) old.replaceWith(document.adoptNode(newPagination));
                            else container.after(document.adoptNode(newPagination));
                        }

                        setState('', '');
                        if (!nextUrl) setState('jb-autopage-nomore', '已经到底了');
                        // 注：追加的 DOM 变化会触发脚本已有的 MutationObserver，
                        // 自动为新条目补上 Emby/Jellyfin 入库状态、快捷按钮等增强功能
                    } catch (e) {
                        console.error('JavdbBuddy 无缝翻页加载失败:', e);
                        setState('jb-autopage-error', '加载失败，点击重试');
                    } finally {
                        isLoading = false;
                    }
                },
                onerror: () => {
                    isLoading = false;
                    setState('jb-autopage-error', '网络错误，点击重试');
                },
                ontimeout: () => {
                    isLoading = false;
                    setState('jb-autopage-error', '请求超时，点击重试');
                }
            });
        };

        // 首次进入页面自动检测是否需要加载
        setTimeout(checkLoad, 1000);
    }
    window.jbInitAutoPagingFn = initAutoPaging;

    // ========== BT 聚合磁力搜索（移植自 Greasy Fork JAV老司机-新，改造为：横向站点栏 + 纵向磁力列表） ==========
    const BT_SEARCH_ENGINES = [
        { key: 'sukebei', name: 'Sukebei', search: btSearchSukebei },
        { key: 'ciligou', name: 'CiliGou', search: btSearchCiligou },
        { key: 'u3c3', name: 'U3C3', search: btSearchU3C3 },
        { key: 'u9a9', name: 'U9A9', search: btSearchU9A9 },
        { key: 'sokitty', name: 'SoKitty', search: btSearchSokitty }
    ];
    const BT_SEARCH_CACHE = {}; // videoCode -> { engineKey: { status: 'loading'|'done'|'error', data: [], url } }

    function btFetch(url, headers, timeout, method, body, cookie) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: method || 'GET',
                url: url,
                headers: headers || {},
                data: body,
                cookie: cookie,
                timeout: timeout || 15000,
                onload: (r) => resolve({ ok: r.status >= 200 && r.status < 400, status: r.status, responseText: r.responseText, responseHeaders: r.responseHeaders, finalUrl: r.finalUrl || url }),
                onerror: () => resolve({ ok: false, status: 0, responseText: '' }),
                ontimeout: () => resolve({ ok: false, status: 0, responseText: '' })
            });
        });
    }

    function btDoc(html) { return new DOMParser().parseFromString(html, 'text/html'); }

    // 番号匹配（宽松：字母+数字，忽略分隔符与前导零）
    function btTitleMatches(title, keyword) {
        const rawTitle = String(title || '').toUpperCase();
        const compactKw = String(keyword || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!rawTitle || !compactKw) return false;
        const code = compactKw.match(/^([A-Z]{2,15})0*(\d{2,10})$/);
        if (code) {
            const number = code[2].replace(/^0+(?=\d)/, '');
            const pattern = new RegExp('(?:^|[^A-Z0-9])' + code[1] + '[\\s._-]*0*' + number + '(?!\\d)', 'i');
            return pattern.test(rawTitle);
        }
        return rawTitle.replace(/[^A-Z0-9]/g, '').includes(compactKw);
    }

    async function btSearchSukebei(code) {
        const base = 'https://sukebei.nyaa.si';
        const searchUrl = base + '/?f=0&c=0_0&q=' + encodeURIComponent(code);
        const r = await btFetch(searchUrl);
        if (!r.ok) return { url: searchUrl, data: [] };
        const doc = btDoc(r.responseText);
        const data = [...doc.querySelectorAll('tr.default, tr.success')].map(el => {
            const dateCell = el.querySelector('td:nth-child(5)');
            const detailHref = el.querySelector('td:nth-child(2)>a:nth-child(1)')?.getAttribute('href') || '';
            return {
                name: el.querySelector('td:nth-child(2)>a:nth-child(1)')?.getAttribute('title') || '',
                magnetUrl: el.querySelector('td:nth-child(3)>a:last-child')?.getAttribute('href') || '',
                size: el.querySelector('td:nth-child(4)')?.textContent?.trim() || '',
                date: dateCell?.textContent?.trim() || '',
                src: detailHref ? new URL(detailHref, base).href : searchUrl
            };
        }).filter(it => it.name && it.magnetUrl.startsWith('magnet:'));
        return { url: searchUrl, data };
    }

    // CiliGou 搜索：新站点带"点击验证"页（cf-im-under-attack），需先 POST act=challenge 建立 Cookie 才能取到真实页面；
    // 列表页不含磁力链接（链接为 /information/<ID>，ID 非磁力哈希），需逐个进入详情页提取真实 magnet。
    async function btSearchCiligou(code) {
        const base = 'https://ciligou.net';
        const encoded = btoa(unescape(encodeURIComponent(code))).replace(/=+$/, '');
        const searchUrl = base + '/search?word=' + encoded;

        let mirrorOrigin = null; // 解析出的镜像域（如 https://clg60.top）
        let jbCookie = null;     // act=challenge 返回的验证 Cookie，后续请求显式携带（防 Tampermonkey 不自动持久化）

        const isJsChallenge = (t) => !!t && t.includes('window.atob(');
        // 一级 JS 挑战：内容为 document.write(decodeURIComponent(window.atob("<b64>")))，解码后含 location.href 指向镜像域
        const jsRedirectOf = (t) => {
            if (!t) return null;
            const m = t.match(/window\.atob\("([^"]+)"\)/);
            if (!m) return null;
            try {
                const decoded = decodeURIComponent(atob(m[1]));
                const href = decoded.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
                return href ? href[1] : null;
            } catch (e) { return null; }
        };
        const isClickChallenge = (t) => !!t && (t.includes('challenge-c') || t.includes('cf-browser-verification'));

        // 可验证 GET：自动处理 一级 JS 挑战跳转 与 二级点击验证（POST act=challenge 建 Cookie）
        const ciliGet = async (url, tag) => {
            let r = await btFetch(url, { 'Referer': base + '/', 'Accept': 'text/html' }, 15000, 'GET', undefined, jbCookie);
            for (let i = 0; i < 3; i++) {
                if (r.ok && isJsChallenge(r.responseText)) {
                    const target = jsRedirectOf(r.responseText);
                    if (!target) break;
                    const next = new URL(target, url).href;
                    try { mirrorOrigin = new URL(next).origin; } catch (e) { }
                    r = await btFetch(next, { 'Referer': url, 'Accept': 'text/html' }, 15000, 'GET', undefined, jbCookie);
                    continue;
                }
                if (r.ok && isClickChallenge(r.responseText)) {
                    const challengeUrl = r.finalUrl || url;
                    const postR = await btFetch(challengeUrl, { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': challengeUrl, 'Accept': 'application/json' }, 10000, 'POST', 'act=challenge', jbCookie);
                    const sc = ((postR.responseHeaders || '').match(/set-cookie:\s*([^;\r\n]+)/i) || [])[1];
                    if (sc) jbCookie = sc;
                    r = await btFetch(postR.finalUrl || challengeUrl, { 'Referer': mirrorOrigin || base + '/', 'Accept': 'text/html' }, 15000, 'GET', undefined, jbCookie);
                    continue;
                }
                break;
            }
            return r;
        };

        const r = await ciliGet(searchUrl, 'search');
        if (!r.ok || isJsChallenge(r.responseText) || isClickChallenge(r.responseText)) {
            return { url: searchUrl, data: [] };
        }
        const doc = btDoc(r.responseText);
        const items = [...doc.querySelectorAll('#Search_list_wrapper li')].map(li => {
            const titleA = li.querySelector('a.SearchListTitle_result_title');
            if (!titleA) return null;
            const href = titleA.getAttribute('href') || '';
            if (!href) return null;
            const infoText = li.querySelector('.Search_list_info')?.textContent || '';
            const sizeMatch = infoText.match(/文件大小[：:]\s*([\d.,]+\s*(?:TiB|GiB|MiB|KiB|TB|GB|MB|KB|B))/i);
            const dateMatch = infoText.match(/创建时间[：:]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/);
            return {
                name: titleA.textContent.trim(),
                size: sizeMatch ? sizeMatch[1] : '',
                date: dateMatch ? dateMatch[1] : '',
                infoUrl: new URL(href, base).href
            };
        }).filter(Boolean);

        const data = [];
        for (const it of items) {
            // 控制详情请求量，最多取前 10 条
            if (data.length >= 10) break;
            // 详情页直接走镜像域，避免再触发一级 JS 挑战
            const detailUrl = mirrorOrigin ? it.infoUrl.replace(new URL(it.infoUrl).origin, mirrorOrigin) : it.infoUrl;
            const detailR = await ciliGet(detailUrl, 'detail:' + it.name.slice(0, 16));
            if (!detailR.ok) continue;
            const detailDoc = btDoc(detailR.responseText);
            const magnetA = detailDoc.querySelector('a[href^="magnet:"]');
            if (!magnetA) continue;
            data.push({
                name: it.name,
                magnetUrl: magnetA.getAttribute('href'),
                size: it.size,
                date: it.date,
                src: detailUrl
            });
        }
        return { url: searchUrl, data };
    }

    async function btSearchU3C3(code) {
        const base = 'https://www.u3c3.com';
        // 第一步：取首页搜索 token
        const home = await btFetch(base + '/', { 'Referer': base + '/' });
        if (!home.ok) return { url: base, data: [] };
        const homeDoc = btDoc(home.responseText);
        const searchScript = [...homeDoc.scripts].map(s => s.textContent || '').find(t => t.includes('function search21')) || '';
        const token = (searchScript.match(/^\s*var\s+nmefafej\s*=\s*["']([^"']+)["'];?/m) || [])[1] || '';
        if (!token) return { url: base, data: [] };
        // 第二步：带 token 搜索
        const searchUrl = base + '/?search2=' + encodeURIComponent(token) + '&search=' + encodeURIComponent(code);
        const r = await btFetch(searchUrl, { 'Referer': base + '/' });
        if (!r.ok) return { url: searchUrl, data: [] };
        const doc = btDoc(r.responseText);
        const norm = s => s.toUpperCase().replace(/[-_\s]/g, '');
        const kwNorm = norm(code);
        const data = [...doc.querySelectorAll('table.torrent-list tbody tr.default, table.torrent-list tbody tr.success')].map(row => {
            const titleA = row.querySelector('td:nth-child(2) a[href*="/view?id="]');
            const magnetA = row.querySelector('td:nth-child(3) a[href^="magnet:"]');
            const title = (titleA?.getAttribute('title') || titleA?.textContent || '').trim();
            if (!title || !magnetA?.getAttribute('href')) return null;
            if (kwNorm && !norm(title).includes(kwNorm)) return null;
            const href = titleA.getAttribute('href') || '';
            return {
                name: title,
                magnetUrl: magnetA.getAttribute('href'),
                size: row.querySelector('td:nth-child(4)')?.textContent?.trim() || '',
                date: row.querySelector('td:nth-child(5)')?.textContent?.trim() || '',
                src: href ? new URL(href, base).href : searchUrl
            };
        }).filter(Boolean);
        return { url: searchUrl, data };
    }

    async function btSearchU9A9(code) {
        const base = 'https://u9a9.com';
        const searchUrl = base + '/?type=2&search=' + encodeURIComponent(code);
        const r = await btFetch(searchUrl, { 'Referer': base + '/', 'Accept': 'text/html' });
        if (!r.ok) return { url: searchUrl, data: [] };
        const doc = btDoc(r.responseText);
        const data = [...doc.querySelectorAll('table.torrent-list tbody tr.default, table.torrent-list tbody tr.success')].map(el => {
            const titleA = el.querySelector('td:nth-child(2)>a:nth-child(1)');
            const magnetA = el.querySelector('td:nth-child(3) a[href^="magnet:"]');
            const href = titleA?.getAttribute('href') || '';
            return {
                name: (titleA?.getAttribute('title') || titleA?.textContent || '').trim(),
                magnetUrl: magnetA?.getAttribute('href') || '',
                size: el.querySelector('td:nth-child(4)')?.textContent?.trim() || '',
                date: el.querySelector('td:nth-child(5)')?.textContent?.trim() || '',
                src: href ? new URL(href, base).href : searchUrl
            };
        }).filter(it => it.name && it.magnetUrl.startsWith('magnet:') && btTitleMatches(it.name, code));
        return { url: searchUrl, data };
    }

    async function btSearchSokitty(code) {
        const base = 'https://w1.sokitty.me';
        const searchUrl = base + '/search?key=' + encodeURIComponent(code);
        const r = await btFetch(searchUrl, { 'Referer': base + '/' });
        if (!r.ok) return { url: searchUrl, data: [] };
        const doc = btDoc(r.responseText);
        const norm = s => s.toUpperCase().replace(/[-_\s]/g, '');
        const kwNorm = norm(code);
        const data = [];
        doc.querySelectorAll('.panel.search-panel').forEach(panel => {
            const titleA = panel.querySelector('h3.panel-title > a.list-title');
            if (!titleA) return;
            const href = titleA.getAttribute('href') || '';
            if (!href.startsWith('/bt/')) return;
            const hash = href.replace('/bt/', '');
            if (!hash) return;
            const title = titleA.textContent.trim();
            if (kwNorm && !norm(title).includes(kwNorm)) return;
            const infoItems = [...panel.querySelectorAll('.panel-footer .info-item')];
            data.push({
                name: title,
                magnetUrl: 'magnet:?xt=urn:btih:' + hash,
                size: (infoItems[0]?.textContent || '').trim(),
                date: (infoItems[2]?.textContent || '').trim(),
                src: base + href
            });
        });
        return { url: searchUrl, data };
    }

    // ==== 移植自原脚本的质量识别/排序/格式化辅助 ====
    function btHasCrackedCode(text) {
        const codePattern = /\b(?:UN|UC)\b/g;
        let match;
        while ((match = codePattern.exec(text))) {
            const before = text.slice(0, match.index);
            const after = text.slice(match.index + match[0].length);
            const adjacentNumber = /\d$/.test(before) || /^\d/.test(after);
            const adjacentSubtitle = /字幕$/.test(before) || /^字幕/.test(after);
            if (!adjacentNumber && !adjacentSubtitle) return true;
        }
        return false;
    }

    // 标题质量分类：中字 / 破解(无码) / 4K
    function btClassifyQuality(title) {
        const text = String(title || '');
        const hasCJK = /[\u4e00-\u9fff]/.test(text);
        const hasJP = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
        const isChinese = /(?:[^A-Za-z]|^)FHDC(?:[^A-Za-z]|$)/i.test(text) || /[-_]CH?(?:[^A-Za-z]|$)/.test(text)
            || /(?:中字|中文|字幕|中文字幕|繁体中字|繁体中文|繁体中文|繁字|自提|征用|微用|汉化|內嵌|内嵌|內封|内封|雙語|双语)/.test(text)
            || (hasCJK && !hasJP);
        const is4K = /(?:[^A-Za-z0-9]|^)(?:4K(?:UHD)?|2160P)(?:[^A-Za-z0-9]|$)/i.test(text);
        const isCracked = /(?:破解|破坏|破坏|损坏|无码|無碼)/.test(text)
            || /\b(?:uncensored|mosaic)\b/i.test(text) || btHasCrackedCode(text);
        return { isChinese, is4K, isCracked };
    }

    function btParseMagnetSize(value) {
        const match = String(value || '').replace(/,/g, '').match(/([\d.]+)\s*(TiB|GiB|MiB|KiB|TB|GB|MB|KB|B)?/i);
        if (!match) return 0;
        const number = parseFloat(match[1]);
        const unit = (match[2] || 'B').toUpperCase();
        const multipliers = { TIB: 1099511627776, TB: 1099511627776, GIB: 1073741824, GB: 1073741824, MIB: 1048576, MB: 1048576, KIB: 1024, KB: 1024, B: 1 };
        return Number.isFinite(number) ? number * (multipliers[unit] || 1) : 0;
    }

    function btParseTimestamp(value) {
        const text = String(value ?? '').trim();
        if (!text) return 0;
        if (/^\d{10,13}$/.test(text)) { const n = Number(text); return text.length === 10 ? n * 1000 : n; }
        const normalized = text.replace(/\//g, '-').replace(/(\d)\s+(\d{1,2}:\d{2})/, '$1T$2');
        const ts = Date.parse(normalized);
        return Number.isFinite(ts) ? ts : 0;
    }

    function btItemTimestamp(item) { return btParseTimestamp(item.timestamp) || btParseTimestamp(item.date); }

    function btFormatDate(item) {
        const raw = String(item?.date || '').trim();
        const match = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
        const ts = btItemTimestamp(item);
        return ts ? new Date(ts).toISOString().slice(0, 10) : '';
    }

    // 排序：大小 / 最新 / 最旧（同名保持原序）
    function btSortData(data, mode) {
        return [...data].map((item, index) => ({ item, index })).sort((a, b) => {
            const sizeDelta = btParseMagnetSize(b.item?.size) - btParseMagnetSize(a.item?.size);
            if (mode === 'size') return sizeDelta || a.index - b.index;
            const aTime = btItemTimestamp(a.item), bTime = btItemTimestamp(b.item);
            if (!aTime && !bTime) return sizeDelta || a.index - b.index;
            if (!aTime) return 1;
            if (!bTime) return -1;
            const timeDelta = mode === 'oldest' ? aTime - bTime : bTime - aTime;
            return timeDelta || sizeDelta || a.index - b.index;
        }).map(e => e.item);
    }

    // 从标题/磁力链提取番号，用于复制时的 &dn= 参数
    function btExtractCode(text) {
        if (!text) return null;
        const patterns = [
            /FC2[-\s_]?(?:PPV)?[-\s_]?(\d{6,9})/i,
            /([A-Z]{2,15})-(\d{2,10})(?:-(\d+))?/i,
            /([A-Z]{2,15})-([A-Z]{0,2}\d{2,10})/i,
            /^[A-Z0-9]+[-_](\d{6}[-_]\d{2,3})/i,
            /(\d{6}[-_]\d{2,3})[-_][A-Z0-9]+$/i,
            /(?<!\w)(\d{6}[-_]\d{2,3})(?!\w)/,
            /([A-Z]{1,2})(\d{3,4})/i
        ];
        for (const re of patterns) {
            const m = text.match(re);
            if (m) return m[0].toUpperCase();
        }
        return null;
    }

    // 渲染单个站点的磁力列表（纵向，样式对标原脚本 jav-nong-table）
    function btRenderItems(listEl, items, searchUrl) {
        listEl.innerHTML = '';
        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'jb-bt-status';
            empty.textContent = '无搜索结果 ';
            if (searchUrl) {
                const go = document.createElement('a');
                go.href = searchUrl;
                go.target = '_blank';
                go.textContent = '前往查看';
                go.style.cssText = 'color:#e74c3c;margin-left:6px;font-weight:bold;';
                empty.appendChild(go);
            }
            listEl.appendChild(empty);
            return;
        }
        items.forEach(m => {
            const item = document.createElement('div');
            item.className = 'jb-bt-item';
            item.dataset.maglink = m.magnetUrl;

            // 名称单元格：徽章 + 可点击标题（跳源站） + 日期
            const nameSpan = document.createElement('div');
            nameSpan.className = 'jb-bt-item-name';
            nameSpan.title = m.name;
            const { isChinese, is4K, isCracked } = btClassifyQuality(m.name);
            if (isChinese) {
                nameSpan.appendChild(btMakeBadge('[中字]', '#16a34a'));
                nameSpan.classList.add('tag-chinese');
            }
            if (isCracked) {
                nameSpan.appendChild(btMakeBadge('[破解]', '#be123c'));
                if (!isChinese) nameSpan.classList.add('tag-cracked');
            }
            if (is4K) {
                nameSpan.insertBefore(btMakeBadge('[4K]', '#2563eb'), nameSpan.firstChild);
                if (!isChinese) nameSpan.classList.add('tag-4k');
            }
            const titleLink = document.createElement('a');
            titleLink.href = m.src || m.magnetUrl;
            titleLink.target = '_blank';
            titleLink.textContent = m.name;
            nameSpan.appendChild(titleLink);
            const displayDate = btFormatDate(m);
            if (displayDate) {
                const dateSpan = document.createElement('span');
                dateSpan.className = 'jb-bt-item-date';
                dateSpan.textContent = displayDate;
                dateSpan.title = '收录时间：' + (m.date || '');
                nameSpan.appendChild(dateSpan);
            }

            const sizeSpan = document.createElement('div');
            sizeSpan.className = 'jb-bt-item-size';
            sizeSpan.textContent = m.size || '-';

            const btns = document.createElement('div');
            btns.className = 'jb-bt-item-btns';
            const copyBtn = document.createElement('a');
            copyBtn.href = 'javascript:void(0)';
            copyBtn.className = 'jb-bt-op copy';
            copyBtn.textContent = '复制';
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const dn = btExtractCode(m.name) || btExtractCode(m.magnetUrl);
                const text = dn ? m.magnetUrl + '&dn=' + encodeURIComponent(dn) : m.magnetUrl;
                (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(() => {
                    const ta = document.createElement('textarea');
                    ta.value = text; document.body.appendChild(ta); ta.select();
                    document.execCommand('copy'); ta.remove();
                });
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = '复制'; }, 1000);
            });
            const dlBtn = document.createElement('a');
            dlBtn.href = 'javascript:void(0)';
            dlBtn.className = 'jb-bt-op dl';
            dlBtn.textContent = '下载';
            dlBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const dn = btExtractCode(m.name);
                window.open(dn ? m.magnetUrl + '&dn=' + encodeURIComponent(dn) : m.magnetUrl, '_blank');
            });
            btns.appendChild(copyBtn);
            btns.appendChild(dlBtn);

            item.appendChild(nameSpan);
            item.appendChild(sizeSpan);
            item.appendChild(btns);
            listEl.appendChild(item);
        });
    }

    function btMakeBadge(text, color) {
        const badge = document.createElement('span');
        badge.textContent = text;
        badge.style.cssText = 'display:inline-block;margin-right:5px;padding:1px 5px;font-size:11px;font-weight:800;color:#fff;background:' + color + ';border-radius:4px;vertical-align:middle;flex-shrink:0;';
        return badge;
    }

    // BT 聚合搜索面板：横向站点栏（点击切换）+ 纵向磁力列表，带缓存
    function renderBtSearchPanel(container, videoCode) {
        if (!container || container.dataset.btInited === 'true') return;
        container.dataset.btInited = 'true';

        if (!document.getElementById('jb-bt-search-style')) {
            const style = document.createElement('style');
            style.id = 'jb-bt-search-style';
            style.textContent = `
                .jb-bt-bar { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 12px; align-items: center; }
                .jb-bt-chip { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 18px; background: #f0f2f5; color: #555; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all .2s; user-select: none; }
                .jb-bt-chip:hover { background: #e3e8f0; }
                .jb-bt-chip.active { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; box-shadow: 0 2px 8px rgba(102,126,234,.35); }
                .jb-bt-chip-badge { min-width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 9px; background: rgba(0,0,0,.12); font-size: 11px; padding: 0 5px; font-weight: normal; }
                .jb-bt-chip.active .jb-bt-chip-badge { background: rgba(255,255,255,.3); }
                .jb-bt-chip-badge.has { background: #4CAF50; color: #fff; }
                .jb-bt-sort { margin-left: auto; flex: 0 0 auto; height: 30px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 1px 6px; background: #fff; color: #172033; font-size: 12px; font-weight: 600; cursor: pointer; }
                .jb-bt-status { padding: 24px; text-align: center; color: #888; font-size: 13px; background: #f2f2f2; }
                .jb-bt-status.err { color: #e74c3c; }
                .jb-bt-list { border: 1px solid #efefef; background: #fff; }
                .jb-bt-item { display: flex; align-items: center; min-height: 34px; border-bottom: 1px solid #efefef; background: #fff; font-size: 13px; text-align: center; color: #666; }
                .jb-bt-item:last-child { border-bottom: none; }
                .jb-bt-item-name { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; padding: 4px 8px; text-align: left; white-space: nowrap; overflow: hidden; }
                .jb-bt-item-name > a { flex: 1 1 auto; min-width: 0; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; text-decoration: none; }
                .jb-bt-item-name > a:hover { color: #4A90E2; text-decoration: underline; }
                .jb-bt-item-name.tag-chinese { background: linear-gradient(90deg,#dcfce7 0%,#f0fdf4 55%,#fff 100%); border-left: 4px solid #16a34a; }
                .jb-bt-item-name.tag-cracked { background: linear-gradient(90deg,#ffe4e6 0%,#fff1f2 55%,#fff 100%); border-left: 4px solid #be123c; }
                .jb-bt-item-name.tag-4k { background: linear-gradient(90deg,#dbeafe 0%,#eff6ff 55%,#fff 100%); border-left: 4px solid #2563eb; }
                .jb-bt-item-date { flex: 0 0 auto; color: #7c8798; font-size: 11px; font-variant-numeric: tabular-nums; margin-left: 4px; }
                .jb-bt-item-size { flex: 0 0 80px; white-space: nowrap; text-align: center; padding: 4px 6px; border-left: 1px solid #efefef; }
                .jb-bt-item-btns { flex: 0 0 auto; display: flex; gap: 10px; padding: 4px 10px; border-left: 1px solid #efefef; }
                .jb-bt-op { cursor: pointer; font-size: 13px; text-decoration: none; }
                .jb-bt-op.copy { color: #08c; }
                .jb-bt-op.dl { color: #be185d; }
                .jb-bt-op:hover { text-decoration: underline; }
            `;
            document.head.appendChild(style);
        }

        const wrap = document.createElement('div');
        wrap.className = 'jb-bt-panel';
        const bar = document.createElement('div');
        bar.className = 'jb-bt-bar';
        // 排序下拉：大小/最新/最旧（默认大小，与原脚本一致）
        const sortSel = document.createElement('select');
        sortSel.className = 'jb-bt-sort';
        sortSel.title = '排序方式';
        [['size', '大小'], ['newest', '最新'], ['oldest', '最旧']].forEach(([v, t]) => sortSel.add(new Option(t, v)));
        sortSel.value = GM_getValue('jb_bt_sort', 'size');
        sortSel.addEventListener('change', () => {
            GM_setValue('jb_bt_sort', sortSel.value);
            renderList(activeKey(), true);
        });
        const list = document.createElement('div');
        list.className = 'jb-bt-list';

        const chips = {};
        BT_SEARCH_ENGINES.forEach((eng, i) => {
            const chip = document.createElement('div');
            chip.className = 'jb-bt-chip' + (i === 0 ? ' active' : '');
            chip.dataset.engine = eng.key;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = eng.name;
            const badge = document.createElement('span');
            badge.className = 'jb-bt-chip-badge';
            badge.textContent = '…';
            chip.appendChild(nameSpan);
            chip.appendChild(badge);
            chip.onclick = () => {
                bar.querySelectorAll('.jb-bt-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                loadEngine(eng.key);
            };
            chips[eng.key] = chip;
            bar.appendChild(chip);
        });

        bar.appendChild(sortSel);
        wrap.appendChild(bar);
        wrap.appendChild(list);
        container.appendChild(wrap);

        const activeKey = () => bar.querySelector('.jb-bt-chip.active')?.dataset.engine;

        function renderList(key, force) {
            const entry = (BT_SEARCH_CACHE[videoCode] || {})[key];
            const eng = BT_SEARCH_ENGINES.find(e => e.key === key);
            const badge = chips[key]?.querySelector('.jb-bt-chip-badge');
            if (entry && entry.status === 'done' && badge) {
                const n = entry.data.length;
                badge.textContent = n;
                badge.className = 'jb-bt-chip-badge' + (n > 0 ? ' has' : '');
            }
            if (key !== activeKey() && !force) return;
            if (!entry || entry.status === 'loading') {
                list.innerHTML = '';
                const st = document.createElement('div');
                st.className = 'jb-bt-status';
                st.textContent = '正在从 ' + eng.name + ' 搜索磁力链接... ';
                list.appendChild(st);
                return;
            }
            if (entry.status === 'error') {
                list.innerHTML = '';
                const st = document.createElement('div');
                st.className = 'jb-bt-status err';
                st.textContent = '请求 ' + eng.name + ' 失败（站点不可达或被拦截），可尝试其它站点 ';
                const refresh = document.createElement('a');
                refresh.href = 'javascript:void(0)';
                refresh.textContent = '🔄 刷新重试';
                refresh.style.cssText = 'color:#e74c3c;margin-left:8px;font-weight:bold;';
                refresh.addEventListener('click', () => {
                    delete BT_SEARCH_CACHE[videoCode][key];
                    loadEngine(key);
                });
                st.appendChild(refresh);
                list.appendChild(st);
                return;
            }
            btRenderItems(list, btSortData(entry.data, sortSel.value), entry.url);
        }

        function loadEngine(key) {
            BT_SEARCH_CACHE[videoCode] = BT_SEARCH_CACHE[videoCode] || {};
            if (!BT_SEARCH_CACHE[videoCode][key]) {
                const eng = BT_SEARCH_ENGINES.find(e => e.key === key);
                const entry = BT_SEARCH_CACHE[videoCode][key] = { status: 'loading' };
                Promise.resolve().then(() => eng.search(videoCode)).then(res => {
                    entry.status = 'done';
                    entry.data = res.data || [];
                    entry.url = res.url;
                }).catch(() => {
                    entry.status = 'error';
                }).finally(() => renderList(key));
            }
            renderList(key);
        }

        // 打开面板即自动搜索全部站点（并发受全局请求限流器控制），各自完成后更新徽标
        BT_SEARCH_ENGINES.forEach(eng => loadEngine(eng.key));
    }

    // ========== 外部截图长图预览（移植自 JAV老司机-新 的 Thumbnail/ImagePreview 模块） ==========
    // 与原有 JavDB 预览图（多图+演员）不同：从 javstore/javfree 搜索截图长图，全屏弹层展示（javstore 优先）
    const THUMB_SOURCES = ['javstore', 'javfree'];
    const THUMB_CACHE = {}; // code -> { url, source } | { url: null }(无结果)

    function thumbLookupCode(code) {
        const text = String(code || '').trim();
        const fc2 = text.match(/^(?:FC2[-_\s]?(?:PPV[-_\s]?)?)?(\d{6,9})$/i);
        return fc2 ? fc2[1] : text;
    }

    function thumbNormalizeUrl(url, baseUrl) {
        if (!url) return '';
        const absolute = /^https?:\/\//i.test(url) ? url : (baseUrl ? new URL(url, baseUrl).href : url);
        return absolute.replace(/^http:/, 'https:');
    }

    function thumbCodeMatched(text, code) {
        const nt = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const nc = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return !!nc && nt.includes(nc);
    }

    function thumbDetailMatched(doc, url, code) {
        const title = doc?.querySelector('title')?.textContent || '';
        const headings = [...(doc?.querySelectorAll('h1,h2,h3,.entry-title,.movie-title,.post-title') || [])].map(el => el.textContent || '').join(' ');
        const bodyText = (doc?.body?.textContent || '').slice(0, 5000);
        return thumbCodeMatched([url, title, headings, bodyText].join(' '), code);
    }

    function thumbIsJavfreePreviewImage(url, code) {
        const cleanUrl = String(url || '').split('?')[0];
        const lc = thumbLookupCode(code);
        const isFc2 = /^\d{6,9}$/.test(lc);
        const fc2Pattern = isFc2 ? new RegExp(lc + '_\\d+\\.(?:jpe?g|png|webp)$', 'i') : null;
        return thumbCodeMatched(cleanUrl, code) && (
            /-(?:1080p|demosaic)\.(?:jpe?g|png|webp)$/i.test(cleanUrl) || (isFc2 && fc2Pattern && fc2Pattern.test(cleanUrl))
        );
    }

    async function thumbJavfree(code) {
        code = thumbLookupCode(code);
        const searchUrl = 'https://javfree.me/search/' + encodeURIComponent(code);
        const r = await btFetch(searchUrl);
        if (!r.ok) return null;
        const doc = btDoc(r.responseText);
        const link = [...doc.querySelectorAll('.entry-title>a')].find(a => thumbCodeMatched([a.href, a.textContent].join(' '), code))?.href;
        if (!link) return null;
        const dr = await btFetch(link);
        if (!dr.ok) return null;
        const dDoc = btDoc(dr.responseText);
        if (!thumbDetailMatched(dDoc, link, code)) return null;
        const urls = [...dDoc.querySelectorAll('p > img[src]')]
            .map(img => thumbNormalizeUrl(img.getAttribute('src') || img.src || '', link))
            .filter(u => thumbIsJavfreePreviewImage(u, code));
        return urls.find(u => /-1080p\./i.test(u)) || urls.find(u => /-demosaic\./i.test(u)) || urls.find(u => /_1\.(?:jpe?g|png|webp)$/i.test(u)) || null;
    }

    async function thumbJavstore(code) {
        code = thumbLookupCode(code);
        const normalized = code.replace(/^fc2-?/i, '').replace(/-/g, '').toLowerCase();
        const searchUrl = 'https://javstore.net/search?q=' + encodeURIComponent(code);
        const sr = await btFetch(searchUrl);
        if (!sr.ok) return null;
        const searchDoc = btDoc(sr.responseText);
        const detailUrls = [];
        for (const link of searchDoc.querySelectorAll('a[href*="/"]')) {
            const href = link.getAttribute('href');
            if (!href) continue;
            if (href.startsWith('http') && !href.includes('javstore.net')) continue;
            const urlObj = new URL(href, searchUrl);
            if (!/javstore\.net$/i.test(urlObj.hostname)) continue;
            if (/^\/search(?:[/?#]|$)/i.test(urlObj.pathname)) continue;
            const pathLast = decodeURIComponent(urlObj.pathname.split('/').pop() || '').toLowerCase().replace(/-/g, '');
            const looksDetail = /\.html$/i.test(urlObj.pathname) || /^\/\d+[-/]/.test(urlObj.pathname);
            if (looksDetail && pathLast.includes(normalized) && !detailUrls.includes(urlObj.href)) detailUrls.push(urlObj.href);
        }
        for (const detailUrl of detailUrls.slice(0, 5)) {
            const dr = await btFetch(detailUrl);
            if (!dr.ok) continue;
            const dDoc = btDoc(dr.responseText);
            if (!thumbDetailMatched(dDoc, detailUrl, code)) continue;
            // CLICK HERE 链接指向大图
            for (const link of dDoc.querySelectorAll('a')) {
                if ((link.textContent || '').includes('CLICK HERE')) {
                    const imgUrl = link.href || '';
                    if (imgUrl) return thumbNormalizeUrl(imgUrl, detailUrl);
                }
            }
            const img = dDoc.querySelector('img[src*="_s.jpg"]');
            if (img) {
                let src = img.getAttribute('src') || '';
                if (!src.startsWith('http')) src = new URL(src, detailUrl).href;
                return thumbNormalizeUrl(src.replace(/_s\.jpg$/, '_l.jpg'), detailUrl);
            }
        }
        return null;
    }

    const THUMB_FETCHERS = { javstore: thumbJavstore, javfree: thumbJavfree };

    // 依次尝试来源（javstore 优先），命中即缓存；全部无结果也缓存（负缓存，避免重复请求）
    async function thumbGet(code, onSource) {
        if (THUMB_CACHE[code]) return THUMB_CACHE[code];
        for (const src of THUMB_SOURCES) {
            if (typeof onSource === 'function') onSource(src);
            let url = null;
            try { url = await THUMB_FETCHERS[src](code); } catch (e) { url = null; }
            if (url) {
                const result = { url, source: src };
                THUMB_CACHE[code] = result;
                return result;
            }
        }
        THUMB_CACHE[code] = { url: null };
        return { url: null };
    }

    // 原版样式（与 JAV老司机-新 的 .preview-overlay/.preview-img/.preview-toolbar/.preview-btn 一致，保留 javstore/javfree 高亮/错误态）
    function thumbEnsureStyle() {
        if (document.getElementById('jb-thumb-style')) return;
        const style = document.createElement('style');
        style.id = 'jb-thumb-style';
        style.textContent = `
            .preview-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;overflow:auto;cursor:zoom-out;backdrop-filter:blur(5px)}
            .preview-img{border-radius:4px;margin:50px auto 0;cursor:zoom-in;max-width:95vw;height:auto;display:block;box-shadow:0 0 20px rgba(0,0,0,0.5)}
            /* 长图顶部是资源站生成的文件信息，不展示；负 margin 抵消裁剪高度，使正文仍紧贴标题栏。 */
            .preview-img.source-javstore{clip-path:inset(82px 0 0 0);margin-top:-32px}
            .preview-img.source-javfree{clip-path:inset(45px 0 0 0);margin-top:-5px}
            .preview-img.zoomed{max-width:none;height:auto;cursor:zoom-out}
            .preview-toolbar{position:fixed;top:20px;right:20px;display:flex;gap:8px;z-index:2147483648;background:rgba(30,30,30,0.75);backdrop-filter:blur(10px);padding:6px 12px;border-radius:30px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 6px 18px rgba(0,0,0,0.25)}
            .preview-btn{border:none;color:#eee;font-size:13px;font-weight:450;cursor:pointer;padding:6px 14px;border-radius:24px;transition:all 0.2s ease;display:inline-flex;align-items:center;gap:6px;background:rgba(100,100,120,0.3);border:1px solid rgba(255,255,255,0.05);box-shadow:0 2px 4px rgba(0,0,0,0.1);letter-spacing:0.2px}
            .preview-btn:hover{background:rgba(140,140,160,0.4);transform:translateY(-2px);box-shadow:0 6px 12px rgba(0,0,0,0.2)}
            .preview-btn.javstore.active{background:#e74c3c;color:white;border-color:rgba(255,255,255,0.3);box-shadow:0 0 16px rgba(231,76,60,0.6);font-weight:500}
            .preview-btn.javfree.active{background:#2ecc71;color:white;border-color:rgba(255,255,255,0.3);box-shadow:0 0 16px rgba(46,204,113,0.6);font-weight:500}
            .preview-btn.action{background:rgba(100,100,120,0.3)}
            .preview-btn.action:hover{background:rgba(140,140,160,0.5)}
            .preview-btn:active{transform:translateY(0);box-shadow:0 2px 4px rgba(0,0,0,0.15)}
            .preview-btn.loading{opacity:0.55;pointer-events:none}
            .preview-error-tip{margin:auto;color:#eee;font-size:14px;font-family:Arial,sans-serif;text-align:center;line-height:1.8}
            .preview-error-tip a{color:#5dade2;text-decoration:underline;cursor:pointer;margin:0 4px}
            .preview-actor-bar{position:fixed;top:16px;left:12px;z-index:2147483649;display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:8px 10px;background:rgba(30,30,30,0.72);backdrop-filter:blur(10px);border-radius:14px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 6px 18px rgba(0,0,0,0.25);max-width:220px}
            .preview-actor-bar .pab-label{font-size:12px;color:#ddd;font-weight:bold;margin-right:2px;white-space:nowrap}
            .preview-actor-bar .pab-link{display:inline-flex;align-items:center;padding:3px 10px;border-radius:14px;font-size:12px;font-weight:500;text-decoration:none;border:1px solid transparent;transition:all .2s}
            .preview-actor-bar .pab-link:hover{transform:translateY(-1px)}
            .preview-actor-bar .pab-female{color:#ff8ba7!important;background:rgba(233,30,99,0.18);border-color:rgba(233,30,99,0.3)}
            .preview-actor-bar .pab-female:hover{background:rgba(233,30,99,0.28)}
            .preview-actor-bar .pab-male{color:#7fc4ff!important;background:rgba(33,150,243,0.18);border-color:rgba(33,150,243,0.3)}
            .preview-actor-bar .pab-male:hover{background:rgba(33,150,243,0.28)}
            .preview-actor-bar .pab-unknown{color:#aaa!important}
            .preview-actor-bar .pab-loading{font-size:12px;color:#bbb}
            .preview-actor-bar .pab-toggle{display:inline-flex;align-items:center;padding:3px 10px;border-radius:14px;font-size:12px;font-weight:500;cursor:pointer;color:#ffd166;background:rgba(255,209,102,0.15);border:1px solid rgba(255,209,102,0.3);transition:all .2s}
            .preview-actor-bar .pab-toggle:hover{background:rgba(255,209,102,0.3)}
            .preview-title-bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483649;display:flex;align-items:center;max-width:44vw;padding:9px 18px;background:rgba(30,30,30,0.72);backdrop-filter:blur(10px);border-radius:14px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 6px 18px rgba(0,0,0,0.25);color:#eee;font-size:13px;white-space:nowrap;overflow:hidden}
            .preview-title-bar .ptb-code{color:#ffd166;font-weight:bold;margin-right:10px;flex-shrink:0}
            .preview-title-bar .ptb-title{overflow:hidden;text-overflow:ellipsis}
            .preview-action-panel{position:fixed;right:20px;top:84px;z-index:2147483649;display:flex;flex-direction:column;gap:5px;padding:8px 6px;background:rgba(30,30,30,0.72);backdrop-filter:blur(10px);border-radius:14px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 6px 18px rgba(0,0,0,0.25);max-height:calc(100vh - 130px);overflow-y:auto}
            .preview-action-btn{display:flex;align-items:center;gap:6px;border:none;color:#eee;font-size:12px;font-weight:500;cursor:pointer;padding:7px 12px;border-radius:20px;transition:all .2s ease;background:rgba(100,100,120,0.3);border:1px solid rgba(255,255,255,0.05);white-space:nowrap;text-align:left;font-family:Arial,sans-serif}
            .preview-action-btn:hover{background:rgba(140,140,160,0.45);transform:translateX(-3px)}
            .preview-action-btn:active{transform:translateX(0)}
        `;
        document.head.appendChild(style);
    }

    // 全屏截图长图查看器（复刻原版交互：点击缩放/背景滚动锁定/ESC关闭/来源切换/新窗口/下载；不显示“正在获取”类文字，仅错误时有提示）
    function thumbShowOverlay(imgUrl, code, source, itemEl) {
        thumbEnsureStyle();
        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalBodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        // 上下文列表项：详情页打开时构造合成项，保证短评/磁力链等可用
        let ctxItemEl = itemEl;
        if (!ctxItemEl && window.location.pathname.startsWith('/v/')) {
            ctxItemEl = jbMakeSyntheticItem(window.location.pathname.split(/[?#]/)[0]);
        }

        // 顶部标题栏（番号 + 标题）
        const videoTitle = jbGetVideoTitle(itemEl, code);
        const titleBar = document.createElement('div');
        titleBar.className = 'preview-title-bar';
        titleBar.innerHTML = `<span class="ptb-code">${jbEscapeHtml(code)}</span><span class="ptb-title" title="${jbEscapeHtml(videoTitle)}">${jbEscapeHtml(videoTitle)}</span>`;

        // 右侧快捷操作面板（复制番号/短评/预览图/磁力链/想看/看过/存入清单/播放）
        const actionPanel = document.createElement('div');
        actionPanel.className = 'preview-action-panel';
        const addAction = (icon, text, onClick) => {
            const b = document.createElement('button');
            b.className = 'preview-action-btn';
            b.innerHTML = icon + ' ' + text;
            b.onclick = (e) => { e.stopPropagation(); onClick(b); };
            actionPanel.appendChild(b);
        };
        addAction('📋', '复制番号', async () => {
            const ok = await jbCopyText(code);
            showToast(ok ? '已复制：' + code : '复制失败');
        });
        addAction('📝', '短评', () => fetchShortReviews(ctxItemEl, code));
        addAction('🧲', '磁力链', () => showDualMagnetModalForList(code, ctxItemEl));
        addAction('👀', '想看', (b) => jbToggleWantWatch(ctxItemEl, code, b));
        addAction('✅', '看过', (b) => jbMarkWatched(ctxItemEl, code, b));
        addAction('📑', '存入清单', (b) => jbSaveToList(ctxItemEl, code, b));
        addAction('▶', '播放', () => showDirectPlayer(code, 'MISSAV'));

        // 顶部演员信息栏（异步拉取详情页解析，加载完成后注入；须在遮罩之后插入，避免被覆盖）
        const actorBar = document.createElement('div');
        actorBar.className = 'preview-actor-bar';
        actorBar.innerHTML = '<span class="pab-label">🌟 演员：</span><span class="pab-loading">加载中...</span>';

        const container = document.createElement('div');
        container.className = 'preview-overlay';
        const img = document.createElement('img');
        // 图片正文从标题栏下方开始显示，并通过来源专用裁剪隐藏资源站附带的文件信息。
        img.className = 'preview-img';
        img.onclick = (e) => {
            e.stopPropagation();
            img.classList.toggle('zoomed');
        };

        // 图片加载失败提示（防盗链或网络问题），可一键新窗口打开原图
        img.addEventListener('error', () => {
            img.style.display = 'none';
            const tip = document.createElement('div');
            tip.className = 'preview-error-tip';
            tip.innerHTML = '图片加载失败（站点防盗链或网络问题）<br>可尝试切换其它来源或';
            const openA = document.createElement('a');
            openA.textContent = '在新窗口打开原图';
            openA.href = 'javascript:void(0)';
            openA.onclick = (ev) => { ev.stopPropagation(); window.open(img.dataset.rawUrl || imgUrl); };
            tip.appendChild(openA);
            container.appendChild(tip);
        });

        const loadImg = (url, src) => {
            // 清理上一次的失败提示，恢复图片显示
            container.querySelectorAll('.preview-error-tip').forEach(el => el.remove());
            img.style.display = 'block';
            img.classList.remove('source-javstore', 'source-javfree');
            if (src === 'javstore' || src === 'javfree') img.classList.add('source-' + src);
            img.dataset.rawUrl = url;
            img.src = url;
        };
        loadImg(imgUrl, source);

        const toolbar = document.createElement('div');
        toolbar.className = 'preview-toolbar';
        const createButton = (text, icon, className, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'preview-btn ' + className;
            btn.innerHTML = icon + text;
            btn.onclick = onClick;
            return btn;
        };
        const setActiveSource = (activeSource) => {
            javstoreBtn.classList.toggle('active', activeSource === 'javstore');
            javfreeBtn.classList.toggle('active', activeSource === 'javfree');
        };
        // 来源切换时按钮显示加载态，未找到时轻量提示
        const switchSource = async (btn, fetcher, srcName) => {
            btn.classList.add('loading');
            let newUrl = null;
            try { newUrl = await fetcher(code); } catch (e) { newUrl = null; }
            btn.classList.remove('loading');
            if (newUrl) {
                loadImg(newUrl, srcName);
                setActiveSource(srcName);
            } else {
                showToast(srcName + ' 未找到预览图');
            }
        };
        const javstoreBtn = createButton('javstore', '🔴', 'javstore', (e) => {
            e.stopPropagation();
            switchSource(javstoreBtn, thumbJavstore, 'javstore');
        });
        const javfreeBtn = createButton('javfree', '🟢', 'javfree', (e) => {
            e.stopPropagation();
            switchSource(javfreeBtn, thumbJavfree, 'javfree');
        });
        const newWindowBtn = createButton('新窗口', '🌐', 'action', (e) => {
            e.stopPropagation();
            window.open(img.src);
        });
        const downloadBtn = createButton('下载', '⬇️', 'action', (e) => {
            e.stopPropagation();
            if (typeof GM_download === 'function') {
                GM_download(img.src, code + '.jpg');
            } else {
                const a = document.createElement('a');
                a.href = img.src; a.download = code + '.jpg'; a.click();
            }
        });
        if (source === 'javstore') javstoreBtn.classList.add('active');
        else if (source === 'javfree') javfreeBtn.classList.add('active');
        toolbar.appendChild(javstoreBtn);
        toolbar.appendChild(javfreeBtn);
        toolbar.appendChild(newWindowBtn);
        toolbar.appendChild(downloadBtn);
        container.appendChild(img);

        const closeOverlay = () => {
            if (container.parentNode) {
                container.remove();
                toolbar.remove();
                actorBar.remove();
                titleBar.remove();
                actionPanel.remove();
                document.documentElement.style.overflow = originalHtmlOverflow;
                document.body.style.overflow = originalBodyOverflow;
            }
        };
        container.onclick = closeOverlay;
        const escHandler = (e) => {
            if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
        document.body.appendChild(container);
        document.body.appendChild(toolbar);
        document.body.appendChild(actorBar); // 最后插入，确保层叠在最上层
        document.body.appendChild(titleBar);
        document.body.appendChild(actionPanel);

        // 异步获取演员信息并填充到顶部演员栏
        thumbFetchActors(code, itemEl, function(actors) {
            thumbRenderActors(actorBar, actors);
        });
    }

    // 渲染演员栏 HTML（dark 主题弹层用；左侧竖排展示，不遮挡中间预览图）
    function thumbRenderActors(el, actors) {
        if (!el || !el.parentNode) return; // 已关闭
        if (!actors || actors.length === 0) {
            el.innerHTML = '<span class="pab-label">🌟 演员：</span><span style="color:#999;font-size:12px;">未获取到</span>';
            return;
        }
        let html = '<span class="pab-label">🌟 演员：</span>';
        actors.forEach(actor => {
            const cls = actor.gender === 'female' ? 'pab-female' : (actor.gender === 'male' ? 'pab-male' : 'pab-unknown');
            if (actor.url) {
                html += `<a href="${actor.url}" target="_blank" class="pab-link ${cls}">${actor.name}</a>`;
            } else {
                html += `<span class="pab-link ${cls}" style="cursor:default;">${actor.name}</span>`;
            }
        });
        el.innerHTML = html;
    }

    // 异步获取演员信息（有缓存直接用；详情页从当前 DOM 提取；否则请求详情页解析）
    function thumbFetchActors(code, itemEl, callback) {
        const cachedActors = (PREVIEW_CACHE[code] && PREVIEW_CACHE[code].actors) || null;
        if (cachedActors && cachedActors.length > 0) {
            callback(cachedActors);
            return;
        }
        const finishActors = (actors) => {
            if (PREVIEW_CACHE[code]) PREVIEW_CACHE[code].actors = actors;
            else PREVIEW_CACHE[code] = { status: 'loaded', imgList: [], actors };
            callback(actors);
        };
        // 详情页：直接从当前 DOM 提取
        if (window.location.pathname.startsWith('/v/')) {
            finishActors(parseActorsFromDoc(document));
            return;
        }
        // 列表页：取详情链接（优先当前 item，找不到则按番号在页内匹配）
        const link = (itemEl && getDetailLink(itemEl)) || thumbFindDetailLinkByCode(code);
        if (!link || !link.href) { finishActors([]); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: link.href,
            timeout: 10000,
            onload: function(response) {
                try {
                    if (detectResponseError(response)) { finishActors([]); return; }
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    finishActors(parseActorsFromDoc(doc));
                } catch (e) { finishActors([]); }
            },
            onerror: function() { finishActors([]); },
            ontimeout: function() { finishActors([]); }
        });
    }

    // 在列表页按番号查找对应条目的详情链接
    function thumbFindDetailLinkByCode(code) {
        const nc = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!nc) return null;
        const candidates = document.querySelectorAll('.movie-list .item, .grid .item, .movie-item, .item, a[href^="/v/"]');
        for (const el of candidates) {
            const link = getDetailLink(el);
            if (!link) continue;
            const text = (el.getAttribute('title') || el.textContent || '');
            const ec = extractCodeFromTitle(text);
            if (ec && String(ec).toLowerCase().replace(/[^a-z0-9]/g, '').includes(nc)) return link;
        }
        return null;
    }

    // 入口：显示外部截图长图（仅转圈动画，不显示“正在获取”类文字；点击可取消）
    async function showScreenshotPreview(videoCode, itemEl) {
        thumbEnsureStyle();
        document.querySelector('.jb-thumb-loading')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'jb-thumb-loading';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);cursor:zoom-out;';
        const spinner = document.createElement('span');
        spinner.style.cssText = 'width:36px;height:36px;border:3px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:jbThumbSpin 0.8s linear infinite;';
        // 转圈动画 keyframes（随遮罩一起存在，避免全局污染）
        const kf = document.createElement('style');
        kf.textContent = '@keyframes jbThumbSpin{to{transform:rotate(360deg)}}';
        overlay.appendChild(spinner);
        let cancelled = false;
        overlay.onclick = () => { cancelled = true; overlay.remove(); kf.remove(); };
        document.body.appendChild(kf);
        document.body.appendChild(overlay);
        const result = await thumbGet(videoCode);
        overlay.remove();
        kf.remove();
        if (cancelled) return; // 用户已取消，不再自动弹出
        if (result.url) {
            thumbShowOverlay(result.url, videoCode, result.source, itemEl);
        } else {
            // 两站均无结果：用面板提示，附两站直达链接
            thumbEnsureStyle();
            const panel = document.createElement('div');
            panel.className = 'preview-overlay';
            panel.style.cursor = 'zoom-out';
            const tipBox = document.createElement('div');
            tipBox.className = 'preview-error-tip';
            tipBox.innerHTML = '❌ ' + videoCode + ' 两个来源均未找到预览图<br>可前往源站手动查找：';
            const links = [
                ['javstore.net', 'https://javstore.net/search?q=' + encodeURIComponent(thumbLookupCode(videoCode))],
                ['javfree.me', 'https://javfree.me/search/' + encodeURIComponent(thumbLookupCode(videoCode))]
            ];
            links.forEach(([name, url], i) => {
                const a = document.createElement('a');
                a.textContent = name;
                a.href = url;
                a.target = '_blank';
                a.onclick = (e) => e.stopPropagation();
                tipBox.appendChild(a);
                if (i < links.length - 1) tipBox.appendChild(document.createTextNode(' ·'));
            });
            // 无结果时同样展示演员信息
            const actorArea = document.createElement('div');
            actorArea.className = 'preview-actor-bar';
            actorArea.style.cssText = 'position:static;transform:none;margin:16px auto 0;max-width:85%;flex-direction:row;flex-wrap:wrap;justify-content:center;';
            actorArea.innerHTML = '<span class="pab-label">🌟 演员：</span><span class="pab-loading">加载中...</span>';
            tipBox.appendChild(actorArea);
            thumbFetchActors(videoCode, itemEl, function(actors) {
                thumbRenderActors(actorArea, actors);
            });
            const closeLine = document.createElement('div');
            closeLine.textContent = '点击任意处或按 ESC 关闭';
            closeLine.style.cssText = 'color:#777;font-size:12px;margin-top:10px;';
            tipBox.appendChild(closeLine);
            panel.appendChild(tipBox);
            panel.onclick = () => { panel.remove(); document.removeEventListener('keydown', escClose); };
            const escClose = (e) => {
                if (e.key === 'Escape') { panel.remove(); document.removeEventListener('keydown', escClose); }
            };
            document.addEventListener('keydown', escClose);
            document.body.appendChild(panel);
        }
    }

    // 实时刷新入库状态标签的显示/隐藏
    function refreshStatusIndicators() {
        const showEmby = GM_getValue('jb_show_emby_status', true);
        const showJellyfin = GM_getValue('jb_show_jellyfin_status', false);

        // 关闭时直接移除对应标签
        if (!showEmby) {
            document.querySelectorAll('.emby-status[data-type="emby"]').forEach(el => el.remove());
        }
        if (!showJellyfin) {
            document.querySelectorAll('.emby-status[data-type="jellyfin"]').forEach(el => el.remove());
        }

        // 清理空的状态容器（先恢复被包裹的日期元素，避免一起被删）
        document.querySelectorAll('.emby-status-wrap').forEach(el => {
            if (!el.querySelector('.emby-status')) {
                const innerDateEl = el.querySelector('.video-date, .date, .meta');
                if (innerDateEl) el.before(innerDateEl);
                el.remove();
            }
        });
        document.querySelectorAll('.emby-status-inline').forEach(el => {
            if (!el.querySelector('.emby-status')) el.remove();
        });

        // 如果任一开关开启，清除已处理标记并重新扫描
        // 注意：不清除 data-jb_processed 会导致已处理元素被跳过，所以仍然需要清除
        // 但需要先清理详情页已存在的旧搜索面板，避免重复
        if (showEmby || showJellyfin) {
            // 清理详情页已存在的旧搜索面板（防止重新扫描时重复创建）
            document.querySelectorAll('.detail-search-panel').forEach(el => el.remove());
            document.querySelectorAll('[data-jb_processed]').forEach(el => {
                el.removeAttribute('data-jb_processed');
            });
            initCheck();
        }
    }
    window.jbRefreshStatusIndicatorsFn = refreshStatusIndicators;

    function refreshSubtitleIndicators() {
        const showSubtitle = GM_getValue('jb_show_subtitle_search', false);
        if (!showSubtitle) {
            document.querySelectorAll('.subtitle-status').forEach(el => el.remove());
            document.querySelectorAll('.jb-subtitle-btn').forEach(el => el.remove());
        } else {
            // 清除字幕缓存（避免旧缓存影响重新扫描结果）
            Object.keys(SUBTITLE_CACHE).forEach(k => delete SUBTITLE_CACHE[k]);
            document.querySelectorAll('.detail-search-panel').forEach(el => el.remove());
            document.querySelectorAll('[data-jb_processed]').forEach(el => {
                el.removeAttribute('data-jb_processed');
            });
            initCheck();
        }
    }
    window.jbRefreshSubtitleIndicatorsFn = refreshSubtitleIndicators;

    // 启动
    const start = () => {
        try {
            console.log('JavdbBuddy: ========== 脚本启动 ==========');
            console.log('JavdbBuddy: 当前URL:', window.location.href);
            console.log('JavdbBuddy: 当前路径:', window.location.pathname);
            
            addBackToTopFloatButton(); // 添加返回顶部/底部浮动按钮
            addPromoBanner(); // 列表页顶部推广横幅
            initCheck();
            
            // 延迟执行在线观看面板，确保页面元素已加载
            console.log('JavdbBuddy: 准备添加在线观看面板...');
            // 立即执行一次
            setTimeout(() => {
                console.log('JavdbBuddy: 立即尝试添加在线观看面板');
                addOnlineWatchPanel();
            }, 0);
            setTimeout(() => {
                console.log('JavdbBuddy: 300ms - 尝试添加在线观看面板');
                addOnlineWatchPanel();
            }, 300);
            setTimeout(() => {
                console.log('JavdbBuddy: 1000ms - 尝试添加在线观看面板');
                addOnlineWatchPanel();
            }, 1000);
        } catch(e) {
            console.error('JavdbBuddy: 启动失败', e);
        }
    };

    // ========== 多网站搜索功能（直接移植自 JAV 添加跳转在线观看 脚本） ==========

    // 注入 CSS（原脚本样式，原样照搬）
 

    function addOnlineWatchPanel() {
        if (!window.location.pathname.startsWith('/v/')) return;
        if (document.querySelector('.jop-app')) return;

(o=>{if(typeof GM_addStyle=="function"){GM_addStyle(o);return}const e=document.createElement("style");e.textContent=o,document.head.append(e)})(' .jop-list{box-sizing:border-box;display:flex;flex-wrap:wrap;justify-content:flex-start;gap:10px;width:100%;height:100%;z-index:1;transition:right .2s ease-in-out;color:#000}.jop-button,.jop-button_def{position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:3px 10px;border-radius:4px;font-weight:500;font-size:14px;border:1px solid #dcdfe6;color:#606266;cursor:pointer}.jop-button_def{margin:10px 0;width:100px}.jop-button:visited{color:#606266}.jop-button:hover{text-decoration:none;color:#409eff;border:1px solid #c6e2ff;background-color:#ecf5ff}.jop-button_label{position:absolute;font-size:10px;padding:4px;border-radius:4px;top:-13px;right:-10px;line-height:.75;color:#67c23a;border:1px solid #e1f3d8;background:#fff}.jop-button_green{color:#fff!important;background-color:#67c23a}.jop-button_green:hover{color:#fff!important;background-color:#95d475}.jop-button_red{color:#fff!important;background-color:#f56c6c}.jop-button_red:hover{color:#fff!important;background-color:#f89898}.jop-loading{display:inline-block;width:14px;height:14px;margin-right:10px;border:2px dashed #dcdfe6;border-top-color:transparent;border-radius:100%;animation:btnLoading infinite 1s linear}@keyframes btnLoading{0%{transform:rotate(0)}to{transform:rotate(360deg)}}.jop-tag{padding:3px 6px;color:#409eff!important;background:#ecf5ff;border:1px solid #d9ecff;border-radius:4px}.jop-setting{margin-top:20px}.jop-setting-list{display:flex;flex-wrap:wrap}.jop-setting-title{margin:10px 0 5px;font-weight:700}.jop-setting-item{display:flex;height:20px;align-items:center;margin-right:15px;-webkit-user-select:none;user-select:none;cursor:pointer}.db-panel .movie-panel-info div.panel-block{padding:5.5px 12px}.db-panel .jop-app{padding:15px 12px}.lib-panel .jop-app{padding:20px 30px;margin-top:10px}input[type=checkbox],input[type=radio]{margin:0 0 0 5px;cursor:pointer}.jop-tooltip-container{position:relative;display:inline-block}.jop-tooltip{position:absolute;bottom:100%;left:50%;transform:translate(-50%);background-color:#333;color:#fff;padding:5px 10px;border-radius:4px;font-size:12px;white-space:nowrap;z-index:1000}.jop-setting-label{cursor:pointer}.jop-checkbox{display:inline-flex;align-items:center;cursor:pointer;margin-right:15px;-webkit-user-select:none;user-select:none}.jop-checkbox-input{position:absolute;opacity:0;cursor:pointer}.jop-checkbox-custom{position:relative;display:inline-block;width:16px;height:16px;background-color:#fff;border:1px solid #dcdfe6;border-radius:2px;transition:all .3s}.jop-checkbox-input:checked+.jop-checkbox-custom{background-color:#409eff;border-color:#409eff}.jop-checkbox-input:checked+.jop-checkbox-custom:after{content:"";position:absolute;top:1px;left:4px;width:5px;height:10px;border:solid white;border-width:0 2px 2px 0;transform:rotate(45deg)}.jop-checkbox-label{margin-left:3px;font-size:14px;color:#606266}.jop-checkbox:hover .jop-checkbox-custom{border-color:#409eff} ');
 
(function (preact) {
  'use strict';
 
  var f$1 = 0;
  function u$1(e2, t2, n, o2, i2, u2) {
    t2 || (t2 = {});
    var a2, c2, p2 = t2;
    if ("ref" in p2) for (c2 in p2 = {}, t2) "ref" == c2 ? a2 = t2[c2] : p2[c2] = t2[c2];
    var l2 = { type: e2, props: p2, key: n, ref: a2, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f$1, __i: -1, __u: 0, __source: i2, __self: u2 };
    if ("function" == typeof e2 && (a2 = e2.defaultProps)) for (c2 in a2) void 0 === p2[c2] && (p2[c2] = a2[c2]);
    return preact.options.vnode && preact.options.vnode(l2), l2;
  }
  const libSites = [
    {
      name: "javdb",
      enable: true,
      identifier: "a[href*='javdb']",
      querys: {
        panelQueryStr: ".video-meta-panel>.columns.is-desktop .panel.movie-panel-info",
        codeQueryStr: `[data-clipboard-text]`
      },
      method() {
        const columnVideoCover = document.querySelector(".column-video-cover");
        if (columnVideoCover) {
          columnVideoCover.style.width = "60%";
        }
        const panel = document.querySelector(
          ".video-meta-panel>.columns.is-desktop>.column:not(.column-video-cover)"
        );
        panel == null ? void 0 : panel.classList.add("db-panel");
      }
    },
    {
      name: "javbus",
      enable: true,
      identifier: "a[href*='javbus']",
      querys: {
        panelQueryStr: ".movie>div.info",
        codeQueryStr: `span[style="color:#CC0000;"]`
      },
      method() {
      }
    },
    {
      name: "javlib",
      enable: true,
      identifier: "img[src*='logo-top']",
      querys: {
        panelQueryStr: "#video_jacket_info #video_info",
        codeQueryStr: `#video_id td.text`
      },
      method() {
        const panel = document.querySelector("#video_info");
        panel == null ? void 0 : panel.classList.add("lib-panel");
      }
    }
  ];
  var _GM_getValue = /* @__PURE__ */ (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
  var _GM_setValue = /* @__PURE__ */ (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
  var _GM_xmlhttpRequest = /* @__PURE__ */ (() => typeof GM_xmlhttpRequest != "undefined" ? GM_xmlhttpRequest : void 0)();
  const siteList = [
    {
      name: "FANZA 動画",
      hostname: "dmm.co.jp",
      url: "https://www.dmm.co.jp/digital/videoa/-/detail/=/cid={{code}}/",
      // url: "https://video.dmm.co.jp/av/list/?key={{code}}",
      fetchType: "get",
      codeFormater: (preCode) => {
        const [pre, num] = preCode.split("-");
        const padNum = num.padStart(5, "0");
        if (pre.toLowerCase().startsWith("start")) {
          return `1${pre.toLowerCase()}${padNum}`;
        }
        return `${pre}${padNum}`;
      },
      domQuery: {}
    },
    {
      name: "Jable",
      hostname: "jable.tv",
      url: "https://jable.tv/videos/{{code}}/",
      fetchType: "get",
      domQuery: {
        subQuery: ".info-header",
        leakQuery: ".info-header"
      }
    },
    {
      name: "MISSAV",
      hostname: "missav.ws",
      url: "https://missav.ws/{{code}}/",
      fetchType: "get",
      domQuery: {
        // 标签区的第一个一般是字幕标签
        subQuery: '.space-y-2 a.text-nord13[href="https://missav.ws/chinese-subtitle"]',
        // 有个「切換無碼」按钮，藏在分享按钮旁边……
        leakQuery: ".order-first div.rounded-md a[href]:last-child"
      }
    },
    {
      name: "123av",
      hostname: "123av.com",
      url: "https://123av.com/zh/search?keyword={{code}}",
      fetchType: "parser",
      strictParser: true,
      domQuery: {
        linkQuery: `.detail>a[href*='v/']`,
        titleQuery: `.detail>a[href*='v/']`
      }
    },
    {
      // 有可能搜出仨：leakage subtitle 4k
      name: "Supjav",
      hostname: "supjav.com",
      url: "https://supjav.com/zh/?s={{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: `.posts.clearfix>.post>a.img[title]`,
        titleQuery: `h3>a[rel="bookmark"][itemprop="url"]`
      }
    },
    {
      name: "NETFLAV",
      hostname: "netflav5.com",
      url: "https://netflav5.com/search?type=title&keyword={{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: ".grid_0_cell>a[href^='/video?']",
        titleQuery: ".grid_0_cell>a[href^='/video?'] .grid_0_title"
      }
    },
    {
      name: "Avgle",
      hostname: "avgle.com",
      url: "https://avgle.com/search/videos?search_query={{code}}&search_type=videos",
      fetchType: "parser",
      domQuery: {
        linkQuery: ".container>.row .row .well>a[href]",
        titleQuery: ".container>.row .row .well .video-title"
      }
    },
    {
      name: "JAVHHH",
      hostname: "javhhh.com",
      url: "https://javhhh.com/v/?wd={{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: ".typelist>.i-container>a[href]",
        titleQuery: ".typelist>.i-container>a[href]"
      }
    },
    {
      name: "BestJP",
      hostname: "bestjavporn.com",
      url: "https://www3.bestjavporn.com/search/{{code}}",
      fetchType: "parser",
      domQuery: { linkQuery: "article.thumb-block>a", titleQuery: "article.thumb-block>a" }
    },
    {
      name: "JAVMENU",
      hostname: "javmenu.com",
      url: "https://javmenu.com/{{code}}",
      fetchType: "get",
      domQuery: {
        videoQuery: "a.nav-link[aria-controls='pills-0']"
      }
      // codeFormater: (preCode) => preCode.replace("-", ""),
    },
    {
      name: "Jav.Guru",
      hostname: "jav.guru",
      url: "https://jav.guru/?s={{code}}",
      fetchType: "parser",
      domQuery: { linkQuery: ".imgg>a[href]", titleQuery: ".inside-article>.grid1 a[title]" }
    },
    {
      name: "JAVMOST",
      hostname: "javmost.cx",
      url: "https://javmost.cx/search/{{code}}/",
      fetchType: "parser",
      domQuery: {
        linkQuery: ".card #myButton",
        titleQuery: ".card-block h4.card-title"
      }
    },
    {
      name: "HAYAV",
      hostname: "hayav.com",
      url: "https://hayav.com/video/{{code}}/",
      fetchType: "get",
      domQuery: {
        // subQuery: `.site__col>.entry-header>h1.entry-title`,
      }
    },
    {
      name: "AvJoy",
      hostname: "avjoy.me",
      url: "https://avjoy.me/search/videos/{{code}}",
      fetchType: "parser",
      domQuery: {
        titleQuery: `#wrapper .row .content-info span.content-title`,
        linkQuery: `#wrapper .row a[href^="/video/"]`
      }
    },
    {
      name: "JAVFC2",
      hostname: "javfc2.net",
      url: "https://javfc2.net/?s={{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: "article.loop-video>a[href]",
        titleQuery: "article.loop-video .entry-header"
      }
    },
    {
      name: "baihuse",
      hostname: "paipancon.com",
      url: "https://paipancon.com/search/{{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: "div.col>div.card>a[href]",
        // 然而这个不是 title，是图片，这个站居然 title 里不包含 code，反而图片包含
        titleQuery: "div.card img.card-img-top"
      }
    },
    {
      name: "GGJAV",
      hostname: "ggjav.com",
      url: "https://ggjav.com/main/search?string={{code}}",
      fetchType: "parser",
      domQuery: {
        listIndex: 1,
        // spaceCode: true,
        titleQuery: "div.columns.large-3.medium-6.small-12.item.float-left>div.item_title>a.gray_a",
        linkQuery: "div.columns.large-3.medium-6.small-12.item.float-left>div.item_title>a.gray_a"
      }
    },
    {
      name: "AV01",
      hostname: "www.av01.tv",
      url: "https://www.av01.tv/search/videos?search_query={{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: "div.well>a[href^='/video/']",
        titleQuery: "div.well>a[href^='/video/']"
      }
    },
    {
      name: "18sex",
      hostname: "18sex.org",
      url: "https://www.18sex.org/cn/search/{{code}}/",
      fetchType: "parser",
      domQuery: { linkQuery: ".white_link[href]", titleQuery: ".white_link>.card-title" }
    },
    {
      name: "highporn",
      hostname: "highporn.net",
      url: "https://highporn.net/search/videos?search_query={{code}}",
      fetchType: "parser",
      domQuery: { linkQuery: ".well>a[href]", titleQuery: ".well>a[href]>span.video-title" }
    },
    {
      // 套了个 cf_clearance 的 cookie，不好搞
      name: "evojav",
      hostname: "evojav.pro",
      url: "https://evojav.pro/video/{{code}}/",
      fetchType: "get",
      domQuery: {}
    },
    {
      name: "18av",
      hostname: "18av.mm-cg.com",
      url: "https://18av.mm-cg.com/zh/fc_search/all/{{code}}/1.html",
      fetchType: "parser",
      domQuery: { linkQuery: ".posts h3>a[href]", titleQuery: ".posts h3>a[href]" }
    },
    {
      name: "javgo",
      hostname: "javgo.to",
      url: "https://javgo.to/zh/v/{{code}}",
      fetchType: "get",
      domQuery: {}
    },
    {
      name: "javhub",
      hostname: "javhub.net",
      url: "https://javhub.net/search/{{code}}",
      fetchType: "parser",
      domQuery: { linkQuery: "a.card-text[href*='play']", titleQuery: "a.card-text[href*='play']" }
    },
    {
      name: "JavBus",
      hostname: "javbus.com",
      url: "https://javbus.com/{{code}}",
      fetchType: "get",
      domQuery: {},
      codeFormater: (preCode) => preCode.startsWith("MIUM") ? `${SP_PREFIX}${preCode}` : preCode
    },
    {
      name: "JavDB",
      hostname: "javdb.com",
      url: "https://javdb.com/search?q={{code}}",
      fetchType: "parser",
      domQuery: {
        linkQuery: ".movie-list>.item:first-child>a",
        titleQuery: ".video-title"
      }
    },
    {
      name: "JAVLib",
      hostname: "javlibrary.com",
      url: "https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={{code}}",
      fetchType: "false"
      // domQuery: {
      //   linkQuery: ".videothumblist .video[id]:first-child>a",
      //   titleQuery: ".videothumblist .video[id]:first-child>a>div.id",
      // },
    }
  ];
  const SP_PREFIX = "300";
  const gmGet = ({ url }) => {
    return new Promise((resolve, reject) => {
      _GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: (response) => resolve(response),
        onerror: (error) => reject(error)
      });
    });
  };
  const isCaseInsensitiveEqual = (str1, str2) => {
    if (!str1 || !str2) return false;
    return str1.toLowerCase() === str2.toLowerCase();
  };
  const isErrorCode = (resCode) => {
    return [404, 403].includes(resCode);
  };
  const getCode = (libItem) => {
    const { codeQueryStr } = libItem.querys;
    const codeNode = document.querySelector(codeQueryStr);
    if (!codeNode) return "";
    const codeText = libItem.name === "javdb" ? codeNode.dataset.clipboardText : codeNode.innerText.replace("复制", "");
    if (codeText.includes("FC2")) return codeText.split("-")[1];
    if (codeText.startsWith(SP_PREFIX)) return codeText.substring(3);
    return codeText;
  };
  const regEnum = {
    subtitle: /(中文|字幕|subtitle)/,
    leakage: /(无码|無碼|泄漏|泄露|Uncensored)/
  };
  const tagsQuery = ({
    leakageText,
    subtitleText
  }) => {
    const hasLeakage = regEnum.leakage.test(leakageText);
    const hasSubtitle = regEnum.subtitle.test(subtitleText);
    const tags = [];
    if (hasLeakage) tags.push("无码");
    if (hasSubtitle) tags.push("字幕");
    return tags.join(" ");
  };
  var t, r, u, i, o = 0, f = [], c = preact.options, e = c.__b, a = c.__r, v = c.diffed, l = c.__c, m = c.unmount, s = c.__;
  function d(n, t2) {
    c.__h && c.__h(r, n, o || t2), o = 0;
    var u2 = r.__H || (r.__H = { __: [], __h: [] });
    return n >= u2.__.length && u2.__.push({}), u2.__[n];
  }
  function h(n) {
    return o = 1, p(D, n);
  }
  function p(n, u2, i2) {
    var o2 = d(t++, 2);
    if (o2.t = n, !o2.__c && (o2.__ = [D(void 0, u2), function(n2) {
      var t2 = o2.__N ? o2.__N[0] : o2.__[0], r2 = o2.t(t2, n2);
      t2 !== r2 && (o2.__N = [r2, o2.__[1]], o2.__c.setState({}));
    }], o2.__c = r, !r.u)) {
      var f2 = function(n2, t2, r2) {
        if (!o2.__c.__H) return true;
        var u3 = o2.__c.__H.__.filter(function(n3) {
          return !!n3.__c;
        });
        if (u3.every(function(n3) {
          return !n3.__N;
        })) return !c2 || c2.call(this, n2, t2, r2);
        var i3 = o2.__c.props !== n2;
        return u3.forEach(function(n3) {
          if (n3.__N) {
            var t3 = n3.__[0];
            n3.__ = n3.__N, n3.__N = void 0, t3 !== n3.__[0] && (i3 = true);
          }
        }), c2 && c2.call(this, n2, t2, r2) || i3;
      };
      r.u = true;
      var c2 = r.shouldComponentUpdate, e2 = r.componentWillUpdate;
      r.componentWillUpdate = function(n2, t2, r2) {
        if (this.__e) {
          var u3 = c2;
          c2 = void 0, f2(n2, t2, r2), c2 = u3;
        }
        e2 && e2.call(this, n2, t2, r2);
      }, r.shouldComponentUpdate = f2;
    }
    return o2.__N || o2.__;
  }
  function y(n, u2) {
    var i2 = d(t++, 3);
    !c.__s && C(i2.__H, u2) && (i2.__ = n, i2.i = u2, r.__H.__h.push(i2));
  }
  function j$1() {
    for (var n; n = f.shift(); ) if (n.__P && n.__H) try {
      n.__H.__h.forEach(z), n.__H.__h.forEach(B$1), n.__H.__h = [];
    } catch (t2) {
      n.__H.__h = [], c.__e(t2, n.__v);
    }
  }
  c.__b = function(n) {
    r = null, e && e(n);
  }, c.__ = function(n, t2) {
    n && t2.__k && t2.__k.__m && (n.__m = t2.__k.__m), s && s(n, t2);
  }, c.__r = function(n) {
    a && a(n), t = 0;
    var i2 = (r = n.__c).__H;
    i2 && (u === r ? (i2.__h = [], r.__h = [], i2.__.forEach(function(n2) {
      n2.__N && (n2.__ = n2.__N), n2.i = n2.__N = void 0;
    })) : (i2.__h.forEach(z), i2.__h.forEach(B$1), i2.__h = [], t = 0)), u = r;
  }, c.diffed = function(n) {
    v && v(n);
    var t2 = n.__c;
    t2 && t2.__H && (t2.__H.__h.length && (1 !== f.push(t2) && i === c.requestAnimationFrame || ((i = c.requestAnimationFrame) || w)(j$1)), t2.__H.__.forEach(function(n2) {
      n2.i && (n2.__H = n2.i), n2.i = void 0;
    })), u = r = null;
  }, c.__c = function(n, t2) {
    t2.some(function(n2) {
      try {
        n2.__h.forEach(z), n2.__h = n2.__h.filter(function(n3) {
          return !n3.__ || B$1(n3);
        });
      } catch (r2) {
        t2.some(function(n3) {
          n3.__h && (n3.__h = []);
        }), t2 = [], c.__e(r2, n2.__v);
      }
    }), l && l(n, t2);
  }, c.unmount = function(n) {
    m && m(n);
    var t2, r2 = n.__c;
    r2 && r2.__H && (r2.__H.__.forEach(function(n2) {
      try {
        z(n2);
      } catch (n3) {
        t2 = n3;
      }
    }), r2.__H = void 0, t2 && c.__e(t2, r2.__v));
  };
  var k = "function" == typeof requestAnimationFrame;
  function w(n) {
    var t2, r2 = function() {
      clearTimeout(u2), k && cancelAnimationFrame(t2), setTimeout(n);
    }, u2 = setTimeout(r2, 100);
    k && (t2 = requestAnimationFrame(r2));
  }
  function z(n) {
    var t2 = r, u2 = n.__c;
    "function" == typeof u2 && (n.__c = void 0, u2()), r = t2;
  }
  function B$1(n) {
    var t2 = r;
    n.__c = n.__(), r = t2;
  }
  function C(n, t2) {
    return !n || n.length !== t2.length || t2.some(function(t3, r2) {
      return t3 !== n[r2];
    });
  }
  function D(n, t2) {
    return "function" == typeof t2 ? t2(n) : t2;
  }
  function g(n, t2) {
    for (var e2 in t2) n[e2] = t2[e2];
    return n;
  }
  function E(n, t2) {
    for (var e2 in n) if ("__source" !== e2 && !(e2 in t2)) return true;
    for (var r2 in t2) if ("__source" !== r2 && n[r2] !== t2[r2]) return true;
    return false;
  }
  function N(n, t2) {
    this.props = n, this.context = t2;
  }
  function M(n, e2) {
    function r2(n2) {
      var t2 = this.props.ref, r3 = t2 == n2.ref;
      return !r3 && t2 && (t2.call ? t2(null) : t2.current = null), E(this.props, n2);
    }
    function u2(e3) {
      return this.shouldComponentUpdate = r2, preact.createElement(n, e3);
    }
    return u2.displayName = "Memo(" + (n.displayName || n.name) + ")", u2.prototype.isReactComponent = true, u2.__f = true, u2;
  }
  (N.prototype = new preact.Component()).isPureReactComponent = true, N.prototype.shouldComponentUpdate = function(n, t2) {
    return E(this.props, n) || E(this.state, t2);
  };
  var T = preact.options.__b;
  preact.options.__b = function(n) {
    n.type && n.type.__f && n.ref && (n.props.ref = n.ref, n.ref = null), T && T(n);
  };
  var F = preact.options.__e;
  preact.options.__e = function(n, t2, e2, r2) {
    if (n.then) {
      for (var u2, o2 = t2; o2 = o2.__; ) if ((u2 = o2.__c) && u2.__c) return null == t2.__e && (t2.__e = e2.__e, t2.__k = e2.__k), u2.__c(n, t2);
    }
    F(n, t2, e2, r2);
  };
  var U = preact.options.unmount;
  function V(n, t2, e2) {
    return n && (n.__c && n.__c.__H && (n.__c.__H.__.forEach(function(n2) {
      "function" == typeof n2.__c && n2.__c();
    }), n.__c.__H = null), null != (n = g({}, n)).__c && (n.__c.__P === e2 && (n.__c.__P = t2), n.__c = null), n.__k = n.__k && n.__k.map(function(n2) {
      return V(n2, t2, e2);
    })), n;
  }
  function W(n, t2, e2) {
    return n && e2 && (n.__v = null, n.__k = n.__k && n.__k.map(function(n2) {
      return W(n2, t2, e2);
    }), n.__c && n.__c.__P === t2 && (n.__e && e2.appendChild(n.__e), n.__c.__e = true, n.__c.__P = e2)), n;
  }
  function P() {
    this.__u = 0, this.o = null, this.__b = null;
  }
  function j(n) {
    var t2 = n.__.__c;
    return t2 && t2.__a && t2.__a(n);
  }
  function B() {
    this.i = null, this.l = null;
  }
  preact.options.unmount = function(n) {
    var t2 = n.__c;
    t2 && t2.__R && t2.__R(), t2 && 32 & n.__u && (n.type = null), U && U(n);
  }, (P.prototype = new preact.Component()).__c = function(n, t2) {
    var e2 = t2.__c, r2 = this;
    null == r2.o && (r2.o = []), r2.o.push(e2);
    var u2 = j(r2.__v), o2 = false, i2 = function() {
      o2 || (o2 = true, e2.__R = null, u2 ? u2(c2) : c2());
    };
    e2.__R = i2;
    var c2 = function() {
      if (!--r2.__u) {
        if (r2.state.__a) {
          var n2 = r2.state.__a;
          r2.__v.__k[0] = W(n2, n2.__c.__P, n2.__c.__O);
        }
        var t3;
        for (r2.setState({ __a: r2.__b = null }); t3 = r2.o.pop(); ) t3.forceUpdate();
      }
    };
    r2.__u++ || 32 & t2.__u || r2.setState({ __a: r2.__b = r2.__v.__k[0] }), n.then(i2, i2);
  }, P.prototype.componentWillUnmount = function() {
    this.o = [];
  }, P.prototype.render = function(n, e2) {
    if (this.__b) {
      if (this.__v.__k) {
        var r2 = document.createElement("div"), o2 = this.__v.__k[0].__c;
        this.__v.__k[0] = V(this.__b, r2, o2.__O = o2.__P);
      }
      this.__b = null;
    }
    var i2 = e2.__a && preact.createElement(preact.Fragment, null, n.fallback);
    return i2 && (i2.__u &= -33), [preact.createElement(preact.Fragment, null, e2.__a ? null : n.children), i2];
  };
  var H = function(n, t2, e2) {
    if (++e2[1] === e2[0] && n.l.delete(t2), n.props.revealOrder && ("t" !== n.props.revealOrder[0] || !n.l.size)) for (e2 = n.i; e2; ) {
      for (; e2.length > 3; ) e2.pop()();
      if (e2[1] < e2[0]) break;
      n.i = e2 = e2[2];
    }
  };
  (B.prototype = new preact.Component()).__a = function(n) {
    var t2 = this, e2 = j(t2.__v), r2 = t2.l.get(n);
    return r2[0]++, function(u2) {
      var o2 = function() {
        t2.props.revealOrder ? (r2.push(u2), H(t2, n, r2)) : u2();
      };
      e2 ? e2(o2) : o2();
    };
  }, B.prototype.render = function(n) {
    this.i = null, this.l = /* @__PURE__ */ new Map();
    var t2 = preact.toChildArray(n.children);
    n.revealOrder && "b" === n.revealOrder[0] && t2.reverse();
    for (var e2 = t2.length; e2--; ) this.l.set(t2[e2], this.i = [1, 0, this.i]);
    return n.children;
  }, B.prototype.componentDidUpdate = B.prototype.componentDidMount = function() {
    var n = this;
    this.l.forEach(function(t2, e2) {
      H(n, e2, t2);
    });
  };
  var q = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, G = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, J = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, K = /[A-Z0-9]/g, Q = "undefined" != typeof document, X = function(n) {
    return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n);
  };
  preact.Component.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t2) {
    Object.defineProperty(preact.Component.prototype, t2, { configurable: true, get: function() {
      return this["UNSAFE_" + t2];
    }, set: function(n) {
      Object.defineProperty(this, t2, { configurable: true, writable: true, value: n });
    } });
  });
  var en = preact.options.event;
  function rn() {
  }
  function un() {
    return this.cancelBubble;
  }
  function on() {
    return this.defaultPrevented;
  }
  preact.options.event = function(n) {
    return en && (n = en(n)), n.persist = rn, n.isPropagationStopped = un, n.isDefaultPrevented = on, n.nativeEvent = n;
  };
  var ln = { enumerable: false, configurable: true, get: function() {
    return this.class;
  } }, fn = preact.options.vnode;
  preact.options.vnode = function(n) {
    "string" == typeof n.type && function(n2) {
      var t2 = n2.props, e2 = n2.type, u2 = {}, o2 = -1 === e2.indexOf("-");
      for (var i2 in t2) {
        var c2 = t2[i2];
        if (!("value" === i2 && "defaultValue" in t2 && null == c2 || Q && "children" === i2 && "noscript" === e2 || "class" === i2 || "className" === i2)) {
          var l2 = i2.toLowerCase();
          "defaultValue" === i2 && "value" in t2 && null == t2.value ? i2 = "value" : "download" === i2 && true === c2 ? c2 = "" : "translate" === l2 && "no" === c2 ? c2 = false : "o" === l2[0] && "n" === l2[1] ? "ondoubleclick" === l2 ? i2 = "ondblclick" : "onchange" !== l2 || "input" !== e2 && "textarea" !== e2 || X(t2.type) ? "onfocus" === l2 ? i2 = "onfocusin" : "onblur" === l2 ? i2 = "onfocusout" : J.test(i2) && (i2 = l2) : l2 = i2 = "oninput" : o2 && G.test(i2) ? i2 = i2.replace(K, "-$&").toLowerCase() : null === c2 && (c2 = void 0), "oninput" === l2 && u2[i2 = l2] && (i2 = "oninputCapture"), u2[i2] = c2;
        }
      }
      "select" == e2 && u2.multiple && Array.isArray(u2.value) && (u2.value = preact.toChildArray(t2.children).forEach(function(n3) {
        n3.props.selected = -1 != u2.value.indexOf(n3.props.value);
      })), "select" == e2 && null != u2.defaultValue && (u2.value = preact.toChildArray(t2.children).forEach(function(n3) {
        n3.props.selected = u2.multiple ? -1 != u2.defaultValue.indexOf(n3.props.value) : u2.defaultValue == n3.props.value;
      })), t2.class && !t2.className ? (u2.class = t2.class, Object.defineProperty(u2, "className", ln)) : (t2.className && !t2.class || t2.class && t2.className) && (u2.class = u2.className = t2.className), n2.props = u2;
    }(n), n.$$typeof = q, fn && fn(n);
  };
  var an = preact.options.__r;
  preact.options.__r = function(n) {
    an && an(n), n.__c;
  };
  var sn = preact.options.diffed;
  preact.options.diffed = function(n) {
    sn && sn(n);
    var t2 = n.props, e2 = n.__e;
    null != e2 && "textarea" === n.type && "value" in t2 && t2.value !== e2.value && (e2.value = null == t2.value ? "" : t2.value);
  };
  const Tooltip = ({ content, children }) => {
    const [isVisible, setIsVisible] = h(false);
    return /* @__PURE__ */ u$1(
      "div",
      {
        className: "jop-tooltip-container",
        onMouseEnter: () => setIsVisible(true),
        onMouseLeave: () => setIsVisible(false),
        children: [
          children,
          isVisible && content && /* @__PURE__ */ u$1("div", { className: "jop-tooltip", children: content })
        ]
      }
    );
  };
  const Checkbox = ({ label, value, tip, onChange }) => {
    const handleChange = (event) => {
      onChange(event.currentTarget.checked);
    };
    return /* @__PURE__ */ u$1("label", { className: "jop-checkbox", children: [
      /* @__PURE__ */ u$1(
        "input",
        {
          type: "checkbox",
          className: "jop-checkbox-input",
          checked: value,
          onChange: handleChange
        }
      ),
      /* @__PURE__ */ u$1("span", { className: "jop-checkbox-custom" }),
      /* @__PURE__ */ u$1(Tooltip, { content: tip || "", children: /* @__PURE__ */ u$1("span", { className: "jop-checkbox-label", children: label }) })
    ] });
  };
  const Setting = ({
    siteList: siteList2,
    setDisables,
    disables,
    multipleNavi,
    setMultipleNavi,
    hiddenError,
    setHiddenError
  }) => {
    const [showSetting, setShowSetting] = h(false);
    const hanleListChange = (item, isHidden) => {
      if (isHidden) {
        setDisables(disables.filter((disItem) => disItem !== item.name));
      } else {
        setDisables([...disables, item.name]);
      }
    };
    const handleNaviChange = (checked) => {
      setMultipleNavi(checked);
      _GM_setValue("multipleNavi", checked);
    };
    const handlehiddenErrorChange = (checked) => {
      setHiddenError(checked);
      _GM_setValue("hiddenError", checked);
    };
    return /* @__PURE__ */ u$1(preact.Fragment, { children: [
      !showSetting && /* @__PURE__ */ u$1("div", { className: "jop-button_def", onClick: () => setShowSetting(!showSetting), children: "设置" }),
      showSetting && /* @__PURE__ */ u$1(preact.Fragment, { children: [
        /* @__PURE__ */ u$1("div", { className: "jop-setting", children: [
          /* @__PURE__ */ u$1(Group, { title: "勾选默认展示", children: siteList2.map((item) => {
            const isHidden = disables.includes(item.name);
            return /* @__PURE__ */ u$1(
              Checkbox,
              {
                label: item.name,
                value: !isHidden,
                onChange: (checked) => hanleListChange(item, checked)
              }
            );
          }) }),
          /* @__PURE__ */ u$1(Group, { title: "其他设置", children: [
            /* @__PURE__ */ u$1(
              Checkbox,
              {
                label: "展示多个搜索结果",
                value: multipleNavi,
                tip: "一个站点内出现多条匹配结果时，打开后跳转搜索结果页",
                onChange: handleNaviChange
              }
            ),
            /* @__PURE__ */ u$1(
              Checkbox,
              {
                label: "隐藏失败结果",
                value: hiddenError,
                onChange: handlehiddenErrorChange
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ u$1(
          "div",
          {
            className: "jop-button_def",
            onClick: () => {
              setShowSetting(!showSetting);
            },
            children: "收起设置"
          }
        )
      ] })
    ] });
  };
  const Group = ({ title, children }) => {
    return /* @__PURE__ */ u$1(preact.Fragment, { children: [
      /* @__PURE__ */ u$1("h4", { className: "jop-setting-title", children: title }),
      /* @__PURE__ */ u$1("div", { className: "jop-setting-list", children })
    ] });
  };
  function videoPageParser(responseText, { subQuery, leakQuery, videoQuery }) {
    const doc = new DOMParser().parseFromString(responseText, "text/html");
    const subNode = subQuery ? doc.querySelector(subQuery) : "";
    const subNodeText = subNode ? subNode.innerHTML : "";
    const leakNode = leakQuery ? doc.querySelector(leakQuery) : null;
    const leakNodeText = leakNode ? leakNode.innerHTML : "";
    const videoNode = videoQuery ? doc.querySelector(videoQuery) : true;
    return {
      isSuccess: !!videoNode,
      tag: tagsQuery({ leakageText: leakNodeText, subtitleText: subNodeText })
    };
  }
  function searchPageCodeCheck(titleNodes, siteItem, CODE) {
    if (!titleNodes || titleNodes.length === 0) return { isSuccess: false, titleNodeText: "" };
    const codeRegex = /[a-zA-Z]{3,5}-\d{3,5}/;
    if (siteItem.strictParser) {
      const nodes = Array.from(titleNodes);
      const passNodes = nodes.filter((node) => {
        const nodeCode = node.outerHTML.match(codeRegex);
        return isCaseInsensitiveEqual(nodeCode == null ? void 0 : nodeCode[0], CODE);
      });
      const titleNodeText = passNodes.map((node) => node.outerHTML).join(" ");
      return {
        titleNodeText,
        isSuccess: passNodes.length > 0,
        multipleRes: passNodes.length > 1
      };
    } else {
      const titleNode = titleNodes[siteItem.domQuery.listIndex ?? 0];
      const titleNodeText = titleNode ? titleNode == null ? void 0 : titleNode.outerHTML : "";
      const matchCode = titleNodeText.match(codeRegex);
      const isSuccess = isCaseInsensitiveEqual(matchCode == null ? void 0 : matchCode[0], CODE);
      return { titleNodeText, isSuccess, multipleRes: titleNodes.length > 1 };
    }
  }
  function serachPageParser(responseText, siteItem, CODE) {
    const { linkQuery, titleQuery } = siteItem.domQuery;
    const doc = new DOMParser().parseFromString(responseText, "text/html");
    const titleNodes = titleQuery ? doc.querySelectorAll(titleQuery) : [];
    const { isSuccess, titleNodeText, multipleRes } = searchPageCodeCheck(titleNodes, siteItem, CODE);
    const linkNodes = linkQuery ? doc.querySelectorAll(linkQuery) : [];
    const linkNode = linkNodes[siteItem.domQuery.listIndex ?? 0];
    if (!isSuccess) {
      return { isSuccess: false };
    }
    const resultLinkText = linkNode.href.replace(linkNode.hostname, siteItem.hostname);
    return {
      isSuccess: true,
      resultLink: resultLinkText,
      multipleRes,
      tag: tagsQuery({ leakageText: titleNodeText, subtitleText: titleNodeText })
    };
  }
  const baseFetcher = async ({ siteItem, targetLink, CODE }) => {
    if (siteItem.fetchType === "false") {
      return Promise.resolve({
        isSuccess: true,
        resultLink: targetLink
      });
    }
    try {
      const response = await gmGet({ url: targetLink });
      if (isErrorCode(response.status)) {
        throw Error(String(response.status));
      }
      if (siteItem.fetchType === "get") {
        return {
          resultLink: targetLink,
          ...videoPageParser(response.responseText, siteItem.domQuery)
        };
      } else {
        return {
          ...serachPageParser(response.responseText, siteItem, CODE)
        };
      }
    } catch (error) {
      return {
        isSuccess: false
      };
    }
  };
  const javbleFetcher = async (args) => {
    const res = await baseFetcher(args);
    if (res.isSuccess) return res;
    const newLink = args.targetLink.slice(0, -1) + "-c/";
    return await baseFetcher({ ...args, targetLink: newLink });
  };
  const fetcher = (args) => {
    if (args.siteItem.name === "Jable") {
      return javbleFetcher(args);
    }
    return baseFetcher(args);
  };
  const SiteBtn = ({ siteItem, CODE, multipleNavi, hiddenError }) => {
    const { name, codeFormater } = siteItem;
    const formatCode = codeFormater ? codeFormater(CODE) : CODE;
    const originLink = siteItem.url.replace("{{code}}", formatCode);
    const [loading, setLoading] = h(false);
    const [fetchRes, setFetchRes] = h();
    y(() => {
      setLoading(true);
      fetcher({ siteItem, targetLink: originLink, CODE: formatCode }).then((res) => {
        setFetchRes(res);
        setLoading(false);
      });
    }, [fetcher, siteItem, CODE, originLink]);
    const multipleFlag = multipleNavi && (fetchRes == null ? void 0 : fetchRes.multipleRes);
    const tag = multipleFlag ? "多结果" : fetchRes == null ? void 0 : fetchRes.tag;
    const resultLink = multipleFlag ? originLink : fetchRes == null ? void 0 : fetchRes.resultLink;
    const colorClass = (fetchRes == null ? void 0 : fetchRes.isSuccess) ? "jop-button_green " : "jop-button_red ";
    if (hiddenError && !(fetchRes == null ? void 0 : fetchRes.isSuccess)) {
      return /* @__PURE__ */ u$1(preact.Fragment, {});
    }
    return /* @__PURE__ */ u$1(
      "a",
      {
        className: "jop-button " + (loading ? " " : colorClass),
        target: "_blank",
        href: !resultLink ? originLink : resultLink,
        children: [
          tag && /* @__PURE__ */ u$1("div", { className: "jop-button_label", children: tag }),
          /* @__PURE__ */ u$1("span", { children: name })
        ]
      }
    );
  };
  const App = M(function({ libItem, CODE }) {
    const DEF_DIS = [
      ...["AvJoy", "baihuse", "GGJAV", "AV01", "18sex", "highporn", "evojav", "HAYAV"],
      ...["JavBus", "JavDB", "JAVLib", "MISSAV_", "123av", "javhub", "javgo", "JAVMENU"]
    ];
    const [disables, setDisables] = h(_GM_getValue("disable", DEF_DIS));
    const [multipleNavi, setMultipleNavi] = h(_GM_getValue("multipleNavi", true));
    const [hiddenError, setHiddenError] = h(_GM_getValue("hiddenError", false));
    const list = siteList.filter(
      (siteItem) => !disables.includes(siteItem.name) && !siteItem.hostname.includes(libItem.name)
    );
    return /* @__PURE__ */ u$1(preact.Fragment, { children: [
      /* @__PURE__ */ u$1("div", { class: "jop-list", children: list.map((siteItem) => /* @__PURE__ */ u$1(
        SiteBtn,
        {
          siteItem,
          CODE,
          multipleNavi,
          hiddenError
        },
        siteItem.name
      )) }),
      /* @__PURE__ */ u$1(
        Setting,
        {
          siteList,
          setDisables: (disable) => {
            setDisables(disable);
            _GM_setValue("disable", disable);
          },
          multipleNavi,
          setMultipleNavi: (multipleNavi2) => {
            setMultipleNavi(multipleNavi2);
            _GM_setValue("multipleNavi", multipleNavi2);
          },
          disables,
          hiddenError,
          setHiddenError: (v2) => {
            setHiddenError(v2);
            _GM_setValue("hiddenError", v2);
          }
        }
      )
    ] });
  });
  function main() {
    const libItem = libSites.find((item) => document.querySelector(item.identifier));
    if (!libItem) {
      console.error("||jop 匹配站点失败");
      return;
    }
    const CODE = getCode(libItem);
    libItem.method();
    const panel = document.querySelector(libItem.querys.panelQueryStr);
    if (!panel) {
      console.error("||jop 插入界面失败");
      return;
    }
    const app = document.createElement("div");
    app.classList.add("jop-app");
    panel.append(app);
    preact.render(/* @__PURE__ */ u$1(App, { libItem, CODE }), app);
    console.log("||脚本挂载成功", CODE);
  }
  main();
 
})(preact);
    }


    // 多重启动策略确保兼容性
    function initScript() {
        console.log('JavdbBuddy: initScript 被调用, readyState=', document.readyState);
        start();
        
        // 额外的延迟重试（针对动态加载的页面）
        setTimeout(() => {
            console.log('JavdbBuddy: 5秒后重新尝试初始化');
            addOnlineWatchPanel();
            initCheck();
        }, 5000);
    }
    
    // 多种启动方式确保兼容性
    const startupMethods = [
        () => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    console.log('JavdbBuddy: DOMContentLoaded 触发');
                    setTimeout(initScript, 100);
                });
            }
        },
        () => {
            if (document.readyState === 'interactive') {
                console.log('JavdbBuddy: 页面处于 interactive 状态');
                setTimeout(initScript, 100);
            }
        },
        () => {
            window.addEventListener('load', () => {
                console.log('JavdbBuddy: window.load 触发');
                initScript();
            });
        },
        () => {
            if (document.readyState === 'complete') {
                console.log('JavdbBuddy: 页面已完全加载');
                initScript();
            }
        },
        () => {
            // 轮询检查，最多 20 次
            let pollCount = 0;
            const pollInterval = setInterval(() => {
                pollCount++;
                console.log(`JavdbBuddy: 轮询检查 #${pollCount}`);
                
                if (document.body && document.querySelector('.video-meta-panel, .movie-panel-info')) {
                    console.log('JavdbBuddy: 轮询检测到页面元素，开始初始化');
                    clearInterval(pollInterval);
                    initScript();
                } else if (pollCount >= 20) {
                    console.log('JavdbBuddy: 轮询达到上限，强制初始化');
                    clearInterval(pollInterval);
                    initScript();
                }
            }, 500);
        }
    ];
    
    // 执行所有启动方法
    console.log('JavdbBuddy: 开始执行所有启动方法');
    startupMethods.forEach((method, index) => {
        try {
            method();
        } catch(e) {
            console.error(`JavdbBuddy: 启动方法 ${index} 失败`, e);
        }
    });
    
    // 最后的兼容方案：直接延迟执行
    console.log('JavdbBuddy: 执行直接延迟启动');
    setTimeout(() => {
        console.log('JavdbBuddy: 1秒后直接启动');
        initScript();
    }, 1000);
    setTimeout(() => {
        console.log('JavdbBuddy: 3秒后直接启动');
        initScript();
    }, 3000);

    // 变动监听
    let timer;
    let buttonAttempts = 0; // 按钮添加尝试次数
    const MAX_BUTTON_ATTEMPTS = 10; // 最多尝试 10 次
    
    const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            initCheck();

            // 如果在线观看面板还未添加成功，继续尝试
            if (buttonAttempts < MAX_BUTTON_ATTEMPTS) {
                const existingPanel = document.querySelector('.jop-app');
                if (!existingPanel) {
                    console.log(`JavdbBuddy: 检测到 DOM 变化，第 ${buttonAttempts + 1} 次尝试添加面板`);
                    addOnlineWatchPanel();
                    buttonAttempts++;
                } else {
                    console.log('JavdbBuddy: 在线观看面板已存在，停止尝试');
                    buttonAttempts = MAX_BUTTON_ATTEMPTS; // 停止尝试
                }
            }
        }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 页面加载后持续轮询服务器状态（实时监测开关机）
    // 防卡死三原则：①连续 2 次相同结果才切换状态（防网络抖动误判）；②页面隐藏时暂停；③无状态标签时不请求
    let lastPingResult = {}; // { emby: true/false, jellyfin: true/false }
    let pingPendingResult = {}; // 连续计数中间结果
    let pingInFlight = {}; // 同一服务器同时只发一个 ping
    let lastRestoreInit = 0; // 恢复在线时全量重初始化的限流时间戳

    function applyPingResult(serverType, online) {
        // 防抖：需要连续 2 次相同结果才真正切换状态，避免服务器响应慢于超时导致的抖动
        if (pingPendingResult[serverType] !== online) {
            pingPendingResult[serverType] = online;
            return; // 第一次变化先记下，不生效
        }
        pingPendingResult[serverType] = undefined;
        const prev = lastPingResult[serverType];
        lastPingResult[serverType] = online;
        if (prev === undefined || prev === online) return;

        if (!online) {
            bulkUpdateStatus(serverType, '无法连接');
        } else {
            // 服务器恢复在线：只把显示"无法连接"的标签改为"未入库"，已入库的保留不动
            const prefix = serverType === 'emby' ? 'Emby' : 'Jellyfin';
            document.querySelectorAll(`.emby-status.error[data-type="${serverType}"]`).forEach(el => {
                el.className = 'emby-status not-exists';
                el.textContent = prefix + '未入库';
                el.title = prefix + '未入库';
            });
            // 触发重新检测：至少间隔 60 秒才允许一次全量重扫，防止反复重建请求洪峰
            if (Date.now() - lastRestoreInit > 60000) {
                lastRestoreInit = Date.now();
                document.querySelectorAll('.detail-search-panel').forEach(el => el.remove());
                document.querySelectorAll('[data-jb_processed]').forEach(el => el.removeAttribute('data-jb_processed'));
                initCheck();
            }
        }
    }

    function doDelayedReverify() {
        if (document.hidden) return; // 页面在后台时暂停轮询，回到前台会在 visibilitychange 立即补一次
        ['emby', 'jellyfin'].forEach(serverType => {
            const servers = getServersByType(serverType);
            if (servers.length === 0 || !servers[0].url || !servers[0].apiKey) return;
            // 页面上没有任何该类型状态标签时不需要请求（详情页/列表页未展示标签时）
            if (!document.querySelector(`.emby-status[data-type="${serverType}"]`)) return;
            if (pingInFlight[serverType]) return; // 同一服务器同时只发一个 ping
            pingInFlight[serverType] = true;
            const pingUrl = `${servers[0].url.replace(/\/$/, '')}/System/Info?api_key=${servers[0].apiKey}`;
            GM_xmlhttpRequest({
                method: 'GET', url: pingUrl, timeout: 6000,
                onload: function(r) {
                    pingInFlight[serverType] = false;
                    applyPingResult(serverType, r.status === 200);
                },
                onerror: function() {
                    pingInFlight[serverType] = false;
                    applyPingResult(serverType, false);
                },
                ontimeout: function() {
                    pingInFlight[serverType] = false;
                    applyPingResult(serverType, false);
                }
            });
        });
    }
    // 首次延迟检查，之后每 15 秒轮询（原 5 秒过于频繁，长时间多标签浏览会淹没 Tampermonkey 请求通道）
    setTimeout(doDelayedReverify, 3000);
    setInterval(doDelayedReverify, 15000);
    // 回到前台时立即补一次检查
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) doDelayedReverify();
    });
    function bulkUpdateStatus(serverType, msg) {
        const cls = (msg === '未入库') ? 'emby-status not-exists' : 'emby-status error';
        document.querySelectorAll(`.emby-status[data-type="${serverType}"]`).forEach(el => {
            const prefix = serverType === 'emby' ? 'Emby' : 'Jellyfin';
            el.className = cls;
            el.textContent = prefix + msg;
            el.title = prefix + msg;
        });
    }

    // 配置变更监听：当设置中添加/修改服务器后，立即重新检查所有标签
    let lastConfigChangeTime = GM_getValue('emby_config_changed', 0);
    setInterval(() => {
        const currentConfigChangeTime = GM_getValue('emby_config_changed', 0);
        if (currentConfigChangeTime > lastConfigChangeTime) {
            console.log('JavdbBuddy: 检测到配置变更，重新检查所有标签');
            lastConfigChangeTime = currentConfigChangeTime;
            
            // 重新加载配置和索引
            try {
                LIBRARY_INDEX = JSON.parse(GM_getValue('emby_library_index', '{}'));
            } catch(e) {
                LIBRARY_INDEX = {};
            }
            try {
                JELLYFIN_LIBRARY_INDEX = JSON.parse(GM_getValue('jellyfin_library_index', '{}'));
            } catch(e) {
                JELLYFIN_LIBRARY_INDEX = {};
            }

            // 重新执行检查
            initCheck();
        }
    }, 1000); // 每秒检查一次配置是否变更

    // ==================== 双标签磁力链功能 ====================
    function addDualTabsForMagnets() {
        console.log('JavdbBuddy: addDualTabsForMagnets()函数被调用');
        console.log('JavdbBuddy: 当前URL:', window.location.href);
        console.log('JavdbBuddy: 当前路径:', window.location.pathname);
        try {
            // 只在详情页显示
            if (!window.location.pathname.startsWith('/v/')) {
                console.log('JavdbBuddy: 不是详情页，跳过添加双标签磁力链');
                return;
            }
            
            // 防止重复添加
            if (document.querySelector('.javdb-dual-magnet-tabs')) {
                console.log('JavdbBuddy: 双标签磁力链已存在');
                return;
            }
            
            console.log('JavdbBuddy: 开始添加双标签磁力链');
            
            // 提取当前番号
            let videoCode = '';
            const codeMatch = document.body.textContent.match(/番[号號][:：]\s*([A-Z0-9\-]+)/i);
            if (codeMatch) {
                videoCode = codeMatch[1].trim();
            }
            if (!videoCode) {
                console.log('JavdbBuddy: 无法提取番号，跳过磁力链双标签');
                return;
            }
            console.log('JavdbBuddy: 双标签磁力链，番号:', videoCode);
            
            // ====== [新增] 立即后台预加载 JAVBUS 磁力链 ======
            preloadJavbusData(videoCode);
            
            // 查找磁力链区域的容器
            // JAVDB页面通常有一个标签页区域，包含"磁链"、"短评"、"相关清单"
            // 我们需要找到当前激活的磁力链内容区域
            const magnetTabContent = document.querySelector('#magnets') || 
                                    document.querySelector('[id*="magnet"]') ||
                                    document.querySelector('.magnet-list');
            
            if (!magnetTabContent) {
                console.log('JavdbBuddy: 未找到磁力链容器');
                return;
            }
            
            // 创建双标签界面（现代化设计）
            const dualTabsContainer = document.createElement('div');
            dualTabsContainer.className = 'javdb-dual-magnet-tabs';
            dualTabsContainer.style.cssText = `
                margin: 15px 0 10px 0;
                display: flex;
                gap: 8px;
                background: transparent;
                padding: 0;
            `;
            
            // JAVDB标签按钮
            const javdbTab = document.createElement('button');
            javdbTab.className = 'javdb-tab active';
            javdbTab.innerHTML = `🔥 JAVDB 磁力链 <span id="javdb-magnet-badge" style="
                position: absolute;
                top: -6px;
                right: -8px;
                background: #FF9800;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: none;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: bold;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 10;
            "></span>`;
            javdbTab.style.cssText = `
                padding: 6px 12px;
                border: none;
                background: white;
                color: #667eea;
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
                text-align: center;
                border-radius: 6px;
                transition: all 0.3s ease;
                margin: 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                position: relative;
                overflow: visible;
            `;
            
            // 添加微妙的内阴影效果
            javdbTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)';
            
            javdbTab.onclick = function() {
                showJAVDBMagnets();
                btMagnetsContainer.style.display = 'none';
                javdbTab.style.background = 'white';
                javdbTab.style.color = '#667eea';
                javdbTab.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                javbusTab.style.background = 'white';
                javbusTab.style.color = '#999';
                javbusTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                if (btTab) {
                    btTab.style.background = 'white';
                    btTab.style.color = '#999';
                    btTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }
                
                // 取消超时检查
                if (javdbLoadTimeout) {
                    clearTimeout(javdbLoadTimeout);
                    javdbLoadTimeout = null;
                }
            };
            
            // JAVBUS标签按钮
            const javbusTab = document.createElement('button');
            javbusTab.className = 'javdb-tab';
            javbusTab.innerHTML = `🧲 JAVBUS 磁力链 <span id="javbus-magnet-badge" style="
                position: absolute;
                top: -6px;
                right: -8px;
                background: #4CAF50;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: none;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: bold;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 10;
            "></span>`;
            javbusTab.style.cssText = `
                padding: 6px 12px;
                border: none;
                background: white;
                color: #999;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                text-align: center;
                border-radius: 6px;
                transition: all 0.3s ease;
                margin: 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                position: relative;
                overflow: visible;
            `;
            
            javbusTab.onclick = function() {
                showJAVBUSMagnets(videoCode);
                btMagnetsContainer.style.display = 'none';
                javbusTab.style.background = 'white';
                javbusTab.style.color = '#667eea';
                javbusTab.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                javdbTab.style.background = 'white';
                javdbTab.style.color = '#999';
                javdbTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                if (btTab) {
                    btTab.style.background = 'white';
                    btTab.style.color = '#999';
                    btTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }
            };
            
            // 添加悬停效果
            [javdbTab, javbusTab].forEach(tab => {
                tab.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
                });
                
                tab.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    if (this.classList.contains('active')) {
                        this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                    } else {
                        this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                    }
                });
            });
            
            dualTabsContainer.appendChild(javdbTab);
            dualTabsContainer.appendChild(javbusTab);
            
            // [新增] BT聚合搜索标签（横向站点栏 + 纵向磁力列表，移植自 JAV老司机-新）
            let btTab = null;
            if (GM_getValue('jb_enable_bt_search', true)) {
                btTab = document.createElement('button');
                btTab.className = 'javdb-tab';
                btTab.textContent = '🌐 BT聚合搜索';
                btTab.style.cssText = `
                    padding: 6px 12px;
                    border: none;
                    background: white;
                    color: #999;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 13px;
                    text-align: center;
                    border-radius: 6px;
                    transition: all 0.3s ease;
                    margin: 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    position: relative;
                    overflow: visible;
                `;
                btTab.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
                });
                btTab.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                });
                btTab.onclick = function() {
                    window.__dualMagnetHandling = true;
                    magnetTabContent.style.display = 'none';
                    javbusMagnetsContainer.style.display = 'none';
                    manualLoadBtn.style.display = 'none';
                    btMagnetsContainer.style.display = 'block';
                    renderBtSearchPanel(btMagnetsContainer, videoCode);
                    setTimeout(() => { window.__dualMagnetHandling = false; }, 0);
                    btTab.style.background = 'white';
                    btTab.style.color = '#667eea';
                    btTab.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                    javdbTab.style.background = 'white';
                    javdbTab.style.color = '#999';
                    javdbTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    javbusTab.style.background = 'white';
                    javbusTab.style.color = '#999';
                    javbusTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                };
                dualTabsContainer.appendChild(btTab);
            }
            
            // 插入到磁力链容器前面（作为兄弟元素，方便分别控制显隐）
            magnetTabContent.parentNode.insertBefore(dualTabsContainer, magnetTabContent);
            
            // 创建JAVBUS磁力链容器（初始隐藏，放在磁力链容器后面）
            const javbusMagnetsContainer = document.createElement('div');
            javbusMagnetsContainer.id = 'javbus-magnet-container';
            javbusMagnetsContainer.style.display = 'none';
            magnetTabContent.parentNode.insertBefore(javbusMagnetsContainer, magnetTabContent.nextSibling);
            
            // [新增] BT聚合搜索容器（初始隐藏）
            const btMagnetsContainer = document.createElement('div');
            btMagnetsContainer.id = 'bt-magnet-container';
            btMagnetsContainer.style.display = 'none';
            magnetTabContent.parentNode.insertBefore(btMagnetsContainer, javbusMagnetsContainer.nextSibling);
            
            // 添加手动加载按钮（如果自动加载失败）
            const manualLoadBtn = document.createElement('button');
            manualLoadBtn.textContent = '🔄 手动加载JAVBUS磁力链';
            manualLoadBtn.style.cssText = `
                margin-top: 10px;
                padding: 8px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            manualLoadBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            });
            manualLoadBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            });
            manualLoadBtn.addEventListener('click', function() {
                console.log('JavdbBuddy: 用户手动触发JAVBUS磁力链加载');
                javbusMagnetsContainer.innerHTML = '<p>正在从JAVBUS加载磁力链...</p>';
                javbusMagnetsContainer.style.display = 'block';
                fetchJAVBUSMagnets(videoCode, javbusMagnetsContainer);
                // 隐藏按钮
                this.style.display = 'none';
            });
            
            // 将按钮添加到 JAVBUS 容器后面
            javbusMagnetsContainer.parentNode.insertBefore(manualLoadBtn, javbusMagnetsContainer.nextSibling);
            
            // ====== 监听 JAVDB 原生标签切换 → 同步双标签显隐 ======
            // showJAVBUSMagnets 和 showJAVDBMagnets 操作 #magnets 显隐时设置标记，
            // 标记延迟清除，让 Observer 能区分"我们主动隐藏"和"JAVDB 原生标签切换"
            window.__dualMagnetHandling = false;
            
            function syncMagnetTabVisibility() {
                const isHidden = magnetTabContent.style.display === 'none' || 
                                 window.getComputedStyle(magnetTabContent).display === 'none' ||
                                 magnetTabContent.classList.contains('is-hidden');
                if (isHidden) {
                    // 非我们主动操作 → 原生标签切换，隐藏所有自定义元素
                    if (!window.__dualMagnetHandling) {
                        dualTabsContainer.style.display = 'none';
                        javbusMagnetsContainer.style.display = 'none';
                        manualLoadBtn.style.display = 'none';
                        btMagnetsContainer.style.display = 'none';
                    }
                } else {
                    // 切回磁链标签时，恢复显示双标签，默认显示 JAVDB 内容
                    dualTabsContainer.style.display = 'flex';
                    magnetTabContent.style.display = 'block';
                    javbusMagnetsContainer.style.display = 'none';
                    manualLoadBtn.style.display = 'none';
                    btMagnetsContainer.style.display = 'none';
                    // 重置标签按钮样式为 JAVDB 激活
                    javdbTab.classList.add('active');
                    javdbTab.style.background = 'white';
                    javdbTab.style.color = '#667eea';
                    javdbTab.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                    javbusTab.classList.remove('active');
                    javbusTab.style.background = 'white';
                    javbusTab.style.color = '#999';
                    javbusTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    if (btTab) {
                        btTab.style.background = 'white';
                        btTab.style.color = '#999';
                        btTab.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }
                }
            }
            const magnetTabObserver = new MutationObserver(syncMagnetTabVisibility);
            magnetTabObserver.observe(magnetTabContent, { 
                attributes: true, 
                attributeFilter: ['style', 'class'],
                subtree: false
            });
            // 初始执行一次
            syncMagnetTabVisibility();
            
            // 自动预加载JAVBUS磁力链数据（改进版）
            let retryCount = 0;
            const maxRetries = 3;
            
            function autoLoadJAVBUS() {
                console.log('JavdbBuddy: autoLoadJAVBUS()函数被调用');
                console.log('JavdbBuddy: 当前加载状态:', javbusMagnetsContainer.dataset.loaded);
                console.log('JavdbBuddy: 重试次数:', retryCount, '最大重试次数:', maxRetries);
                console.log('JavdbBuddy: 容器是否存在:', !!javbusMagnetsContainer);
                console.log('JavdbBuddy: 容器是否在DOM中:', document.body.contains(javbusMagnetsContainer));
                
                if (javbusMagnetsContainer.dataset.loaded === 'true') {
                    console.log('JavdbBuddy: JAVBUS磁力链数据已加载');
                    return;
                }
                
                if (retryCount >= maxRetries) {
                    console.log('JavdbBuddy: 自动加载JAVBUS磁力链失败，已达最大重试次数');
                    javbusMagnetsContainer.innerHTML = `
                        <div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                            <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                            <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                        </div>
                    `;
                    javbusMagnetsContainer.dataset.loaded = 'error';
                    const badge = document.getElementById('javbus-magnet-badge');
                    if (badge) { badge.textContent = '0'; badge.style.display = 'flex'; }
                    
                    // 显示手动加载按钮
                    if (manualLoadBtn) {
                        manualLoadBtn.style.display = 'block';
                    }
                    return;
                }
                
                console.log(`JavdbBuddy: 自动预加载JAVBUS磁力链数据（第${retryCount + 1}次尝试）`);
                console.log('JavdbBuddy: 番号:', videoCode);
                console.log('JavdbBuddy: 目标容器:', javbusMagnetsContainer.id);
                
                // 显示加载状态
                javbusMagnetsContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #666;">
                        <p>正在从JAVBUS加载磁力链...</p>
                        <p style="font-size: 12px; color: #999;">尝试 ${retryCount + 1}/${maxRetries}，请稍候</p>
                    </div>
                `;
                
                retryCount++;
                fetchJAVBUSMagnets(videoCode, javbusMagnetsContainer);
            }
            
            // 首次加载：延迟2秒确保页面完全加载
            console.log('JavdbBuddy: 设置自动预加载，2秒后执行');
            setTimeout(autoLoadJAVBUS, 2000);
            
            // 设置加载状态为false
            javbusMagnetsContainer.dataset.loaded = 'false';
            
            // 如果失败，2秒后重试
            const retryInterval = setInterval(() => {
                console.log('JavdbBuddy: 重试检查，当前状态:', javbusMagnetsContainer.dataset.loaded, '重试次数:', retryCount);
                if (javbusMagnetsContainer.dataset.loaded !== 'true' && javbusMagnetsContainer.dataset.loaded !== 'error' && retryCount < maxRetries) {
                    console.log('JavdbBuddy: 检测到加载失败，准备重试...');
                    setTimeout(autoLoadJAVBUS, 1000);
                } else {
                    console.log('JavdbBuddy: 停止重试检查');
                    clearInterval(retryInterval);
                }
            }, 3000); // 每3秒检查一次
            
            // 显示JAVDB磁力链（默认）
            function showJAVDBMagnets() {
                window.__dualMagnetHandling = true;
                magnetTabContent.style.display = 'block';
                javbusMagnetsContainer.style.display = 'none';
                setTimeout(() => { window.__dualMagnetHandling = false; }, 0);
            }
            
            // 检查JAVDB磁力链是否加载超时
            let javdbLoadTimeout = null;
            function checkJAVDBLoadTimeout() {
                if (magnetTabContent.textContent.includes('搜寻中')) {
                    console.log('JavdbBuddy: JAVDB磁力链加载超时，自动切换到JAVBUS');
                    // 自动切换到JAVBUS标签
                    javbusTab.click();
                }
            }
            
            // 设置10秒后检查JAVDB磁力链是否加载超时
            javdbLoadTimeout = setTimeout(checkJAVDBLoadTimeout, 10000);
            console.log('JavdbBuddy: 设置JAVDB磁力链加载超时检查（10秒后）');
            
            // 显示JAVBUS磁力链
            function showJAVBUSMagnets(code) {
                console.log('JavdbBuddy: showJAVBUSMagnets()函数被调用，番号:', code);
                window.__dualMagnetHandling = true;
                magnetTabContent.style.display = 'none';
                javbusMagnetsContainer.style.display = 'block';
                setTimeout(() => { window.__dualMagnetHandling = false; }, 0);
                
                // 如果已经通过 autoLoadJAVBUS 加载过，直接显示
                if (javbusMagnetsContainer.dataset.loaded === 'true') {
                    console.log('JavdbBuddy: JAVBUS磁力链数据已加载，直接显示');
                    return;
                }
                
                // 检查缓存（预加载完成的）
                const cached = JAVBUS_CACHE[code];
                if (cached && cached.status === 'loaded' && cached.data && cached.data.length > 0) {
                    renderMagnetData(cached.data, javbusMagnetsContainer);
                    javbusMagnetsContainer.dataset.loaded = 'true';
                    const badge = document.getElementById('javbus-magnet-badge');
                    if (badge) {
                        badge.textContent = cached.data.length;
                        badge.style.display = 'flex';
                    }
                    return;
                }
                // 缓存已标记为失败或空数据，直接显示“暂无数据”并显示角标 0
                if (cached && (cached.status === 'error' || (cached.status === 'loaded' && (!cached.data || cached.data.length === 0)))) {
                    javbusMagnetsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                        <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                        <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                    </div>`;
                    javbusMagnetsContainer.dataset.loaded = 'error';
                    const badge = document.getElementById('javbus-magnet-badge');
                    if (badge) {
                        badge.textContent = '0';
                        badge.style.display = 'flex';
                    }
                    return;
                }
                
                // 缓存未命中或正在加载，不等预加载，直接请求
                console.log('JavdbBuddy: JAVBUS磁力链数据未加载，开始加载');
                javbusMagnetsContainer.innerHTML = '<p>正在从JAVBUS加载磁力链...</p>';
                fetchJAVBUSMagnets(code, javbusMagnetsContainer);
            }
            
            // 更新JAVDB磁力链角标
            function updateJAVDBMagnetBadge() {
                const badge = document.getElementById('javdb-magnet-badge');
                if (!badge) return;
                // 计算原始磁力链数量
                const magnetLinks = magnetTabContent.querySelectorAll('a[href^="magnet:"]');
                const count = magnetLinks.length;
                if (count > 0) {
                    badge.textContent = count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
            // 延迟更新，等待页面动态加载
            setTimeout(updateJAVDBMagnetBadge, 1000);
            // 监听磁力链区域变化
            const observer = new MutationObserver(updateJAVDBMagnetBadge);
            observer.observe(magnetTabContent, { childList: true, subtree: true });
            
            console.log('JavdbBuddy: 双标签磁力链已添加');
            
        } catch (error) {
            console.error('JavdbBuddy: 添加双标签磁力链失败:', error);
        }
    }
    
    // 从<script>标签中提取磁力链数据
    function extractMagnetDataFromScripts(htmlDoc) {
        const scripts = htmlDoc.querySelectorAll('script');
        console.log('JavdbBuddy: 检查脚本数量:', scripts.length);
        let magnetData = [];
        
        for (let script of scripts) {
            const scriptContent = script.textContent || script.innerText;
            
            // 尝试多种常见数据格式（JAVBUS特有模式）
            const patterns = [
                /var\s+magnets\s*=\s*(\[[\s\S]*?\]);/,  // var magnets = [...];
                /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,  // window.__INITIAL_STATE__ = {...};
                /magnets:\s*(\[[\s\S]*?\])/,  // magnets: [...]
                /"magnets"\s*:\s*(\[[\s\S]*?\])/,  // "magnets": [...]
                /magnetList:\s*(\[[\s\S]*?\])/,  // magnetList: [...]
                /"magnetList"\s*:\s*(\[[\s\S]*?\])/,   // "magnetList": [...]
                /var\s+data\s*=\s*({[\s\S]*?});\s*\/\/\s*JAVBUS/,  // var data = {...}; // JAVBUS
                /data\s*=\s*({[\s\S]*?});\s*console\.log/,  // data = {...}; console.log
                /var\s+movie\s*=\s*({[\s\S]*?});/,  // var movie = {...};
                /"magnet_links"\s*:\s*(\[[\s\S]*?\])/,  // "magnet_links": [...]
                /magnet_links:\s*(\[[\s\S]*?\])/,  // magnet_links: [...]
                /"torrents"\s*:\s*(\[[\s\S]*?\])/,  // "torrents": [...]
                /torrents:\s*(\[[\s\S]*?\])/  // torrents: [...]
            ];
            
            for (let pattern of patterns) {
                const match = scriptContent.match(pattern);
                if (match) {
                    try {
                        let dataStr = match[1];
                        // 如果是对象，尝试从中提取磁力链数组
                        if (dataStr.startsWith('{')) {
                            const dataObj = JSON.parse(dataStr);
                            // 尝试从对象中找到磁力链数组
                            if (dataObj.magnets) magnetData = dataObj.magnets;
                            else if (dataObj.magnetList) magnetData = dataObj.magnetList;
                            else if (dataObj.magnet_links) magnetData = dataObj.magnet_links;
                            else if (dataObj.torrents) magnetData = dataObj.torrents;
                            else if (dataObj.data && Array.isArray(dataObj.data)) magnetData = dataObj.data;
                        } else {
                            // 直接是数组
                            magnetData = JSON.parse(dataStr);
                        }
                        
                        if (Array.isArray(magnetData) && magnetData.length > 0) {
                            console.log('JavdbBuddy: 从脚本中找到磁力链数据，模式:', pattern.toString());
                            // 标准化数据格式
                            return magnetData.map(item => ({
                                name: item.name || item.title || item.text || item.magnet_name || '未知',
                                size: item.size || item.fileSize || item.file_size || item.size_text || '未知',
                                date: item.date || item.time || item.timestamp || item.date_added || '未知',
                                magnetUrl: item.magnetUrl || item.magnet || item.magnet_url || item.url || '',
                                hasSub: item.hasSub || item.has_subtitle || false
                            }));
                        }
                    } catch (e) {
                        // JSON解析失败，尝试下一个模式
                        console.log('JavdbBuddy: 解析失败，尝试下一个模式');
                    }
                }
            }
        }
        
        return magnetData;
    }
    
    // 直接从HTML中提取磁力链接（备用方法）
    function extractMagnetsFromHTML(htmlDoc) {
        console.log('JavdbBuddy: 尝试直接从HTML中提取磁力链接');
        const magnetLinks = [];
        
        // 查找所有包含magnet:的链接
        const allLinks = htmlDoc.querySelectorAll('a[href^="magnet:"]');
        console.log('JavdbBuddy: 找到', allLinks.length, '个磁力链接');
        
        if (allLinks.length === 0) {
            console.log('JavdbBuddy: 未找到任何磁力链接，可能数据是动态加载的');
            // 尝试查找可能包含磁力链接的元素
            const possibleContainers = [
                htmlDoc.querySelector('.magnet-list'),
                htmlDoc.querySelector('#magnets'),
                htmlDoc.querySelector('.torrent-list'),
                htmlDoc.querySelector('[class*="magnet"]'),
                htmlDoc.querySelector('[id*="magnet"]')
            ];
            
            for (let container of possibleContainers) {
                if (container) {
                    console.log('JavdbBuddy: 找到可能的磁力链容器:', container.className, '内容长度:', container.innerHTML.length);
                    // 尝试在容器内查找磁力链接
                    const containerLinks = container.querySelectorAll('a[href^="magnet:"]');
                    console.log('JavdbBuddy: 容器内找到', containerLinks.length, '个磁力链接');
                }
            }
        }
        
        allLinks.forEach((link, index) => {
            const magnetUrl = link.href;
            let name = link.textContent.trim() || link.title || '磁力链接 ' + (index + 1);
            
            console.log(`JavdbBuddy: 磁力链接 ${index + 1}:`, name.substring(0, 50) + '...');
            
            // 尝试从父元素或兄弟元素中提取更多信息
            let size = '未知';
            let date = '未知';
            
            // 查找父元素或相邻元素中的元数据
            let parent = link.parentElement;
            if (parent) {
                const parentText = parent.textContent;
                
                // 尝试提取大小（如 "1.5GB", "500MB"）
                const sizeMatch = parentText.match(/(\d+\.?\d*\s*[GMK]B)/i);
                if (sizeMatch) size = sizeMatch[1];
                
                // 尝试提取日期（如 "2024-01-15", "2024/01/15"）
                const dateMatch = parentText.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
                if (dateMatch) date = dateMatch[1];
            }
            
            magnetLinks.push({
                name: name,
                size: size,
                date: date,
                magnetUrl: magnetUrl,
                hasSub: false // 无法从HTML直接判断是否有字幕
            });
        });
        
        console.log('JavdbBuddy: 从HTML提取完成，共', magnetLinks.length, '个磁力链接');
        return magnetLinks;
    }
    
    // 渲染磁力链数据到容器
    function renderMagnetData(data, container) {
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                    <p>没有找到磁力链数据</p>
                    <p style="font-size: 12px; color: #999;">可能需要登录JAVBUS查看</p>
                </div>
            `;
            return;
        }
        
        // 创建现代化表格
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            font-size: 14px;
        `;
        
        // 表头
        const thead = document.createElement('thead');
        thead.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        `;
        const headerRow = document.createElement('tr');
        const headers = ['磁力名稱', '檔案大小', '分享日期', '操作'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.cssText = `
                padding: 12px 15px;
                text-align: left;
                font-weight: 600;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            `;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // 表体
        const tbody = document.createElement('tbody');
        data.forEach((magnet, index) => {
            const row = document.createElement('tr');
            row.style.cssText = `
                transition: background-color 0.2s;
                background-color: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};
            `;
            
            // 悬停效果
            row.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f0f4ff';
            });
            row.addEventListener('mouseleave', function() {
                this.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
            });
            
            // 名称和标签
            const nameCell = document.createElement('td');
            nameCell.style.cssText = `
                padding: 12px 15px;
                border-bottom: 1px solid #e9ecef;
                max-width: 400px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-weight: 500;
            `;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = magnet.name || magnet.title || magnet.text || '未知';
            nameSpan.style.marginRight = '6px';
            nameCell.appendChild(nameSpan);
            
            // 添加标签
            if (magnet.hasHD) {
                const hdTag = document.createElement('span');
                hdTag.textContent = '高清';
                hdTag.style.cssText = `
                    background: #4CAF50;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-right: 6px;
                    display: inline-block;
                    vertical-align: middle;
                    border: 1px solid #388E3C;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                `;
                nameCell.appendChild(hdTag);
            }
            if (magnet.hasSub) {
                const subTag = document.createElement('span');
                subTag.textContent = '字幕';
                subTag.style.cssText = `
                    background: #2196F3;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    display: inline-block;
                    vertical-align: middle;
                    border: 1px solid #1976D2;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                `;
                nameCell.appendChild(subTag);
            }
            row.appendChild(nameCell);
            
            // 大小
            const sizeCell = document.createElement('td');
            sizeCell.textContent = magnet.size || magnet.fileSize || '未知';
            sizeCell.style.cssText = `
                padding: 12px 15px;
                border-bottom: 1px solid #e9ecef;
                color: #666;
            `;
            row.appendChild(sizeCell);
            
            // 日期
            const dateCell = document.createElement('td');
            dateCell.textContent = magnet.date || magnet.time || magnet.timestamp || '未知';
            dateCell.style.cssText = `
                padding: 12px 15px;
                border-bottom: 1px solid #e9ecef;
                color: #666;
            `;
            row.appendChild(dateCell);
            
            // 操作按钮
            const actionCell = document.createElement('td');
            actionCell.style.cssText = `
                padding: 12px 15px;
                border-bottom: 1px solid #e9ecef;
                text-align: center;
            `;
            
            // 复制按钮
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋 复制';
            copyBtn.style.cssText = `
                padding: 6px 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s;
            `;
            copyBtn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
            });
            copyBtn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = 'none';
            });
            copyBtn.addEventListener('click', function() {
                const magnetUrl = magnet.magnetUrl || magnet.magnet || magnet.url;
                if (magnetUrl) {
                    navigator.clipboard.writeText(magnetUrl).then(() => {
                        const oldText = copyBtn.textContent;
                        copyBtn.textContent = '✅ 已复制';
                        copyBtn.style.background = '#28a745';
                        setTimeout(() => {
                            copyBtn.textContent = oldText;
                            copyBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        }, 2000);
                    }).catch(() => {
                        // 备用复制方法
                        const textarea = document.createElement('textarea');
                        textarea.value = magnetUrl;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        
                        const oldText = copyBtn.textContent;
                        copyBtn.textContent = '✅ 已复制';
                        copyBtn.style.background = '#28a745';
                        setTimeout(() => {
                            copyBtn.textContent = oldText;
                            copyBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        }, 2000);
                    });
                }
            });
            
            actionCell.appendChild(copyBtn);
            row.appendChild(actionCell);
            
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        // 添加统计信息
        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = `
            margin-top: 10px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 4px solid #667eea;
            font-size: 12px;
            color: #666;
        `;
        statsDiv.innerHTML = `
            共找到 <strong>${data.length}</strong> 个磁力链接
        `;
        
        container.innerHTML = '';
        container.appendChild(table);
        container.appendChild(statsDiv);
    }
    
    // 处理JAVBUS年龄验证
    function passAgeVerification() {
        return new Promise((resolve) => {
            console.log('JavdbBuddy: 尝试通过JAVBUS年龄验证');
            
            // JAVBUS年龄验证机制：需要设置特定的cookie
            // 尝试多个可能的cookie组合
            const cookieAttempts = [
                'existmag=all',
                'agegate=1',
                'over18=1',
                'age_verified=1',
                'agecheck=1',
                'age=18',
                'over18=yes',
                'adult=1',
                'agegate=1; existmag=all',
                'over18=1; existmag=all'
            ];
            
            let currentIndex = 0;
            let ageVerified = false;
            
            function tryNextCookie() {
                if (currentIndex >= cookieAttempts.length) {
                    console.log('JavdbBuddy: 所有cookie尝试完毕，年龄验证状态:', ageVerified ? '通过' : '未通过');
                    resolve(ageVerified);
                    return;
                }
                
                const cookies = cookieAttempts[currentIndex];
                console.log(`JavdbBuddy: 尝试cookie组合 ${currentIndex + 1}/${cookieAttempts.length}:`, cookies);
                
                // 使用一个简单的测试URL
                const testUrl = 'https://www.javbus.com/SSIS-795';
                
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: testUrl,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Referer': 'https://www.javbus.com/',
                        'Cookie': cookies
                    },
                    // 必须显式设置超时，否则 ontimeout 永远不会触发，挂起请求会泄漏连接
                    timeout: 10000,
                    onload: function(response) {
                        console.log(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 响应状态:`, response.status);
                        
                        if (response.status !== 200) {
                            console.log(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 响应状态码不是200，尝试下一个`);
                            currentIndex++;
                            tryNextCookie();
                            return;
                        }
                        
                        // 检查响应中是否包含年龄验证内容
                        const hasAgeVerify = response.responseText.includes('你是否已經成年') || 
                                           response.responseText.includes('年龄验证') ||
                                           response.responseText.includes('age verification') ||
                                           response.responseText.includes('请确认您已年满18岁');
                        
                        const hasMagnetTable = response.responseText.includes('磁力名稱') || 
                                             response.responseText.includes('檔案大小') ||
                                             response.responseText.includes('magnet:') ||
                                             response.responseText.includes('torrent');
                        
                        console.log(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 年龄验证内容:`, hasAgeVerify);
                        console.log(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 磁力链内容:`, hasMagnetTable);
                        
                        // 如果没有年龄验证内容或包含磁力链内容，认为年龄验证通过
                        if (!hasAgeVerify || hasMagnetTable) {
                            console.log(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 年龄验证通过`);
                            ageVerified = true;
                            resolve(true);
                            return;
                        }
                        
                        // 尝试下一个cookie组合
                        currentIndex++;
                        tryNextCookie();
                    },
                    onerror: function(error) {
                        console.error(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 请求失败:`, error);
                        currentIndex++;
                        tryNextCookie();
                    },
                    ontimeout: function() {
                        console.error(`JavdbBuddy: Cookie组合 ${currentIndex + 1} 请求超时`);
                        currentIndex++;
                        tryNextCookie();
                    }
                });
            }
            
            // 开始尝试cookie组合
            tryNextCookie();
        });
    }
    
    // 获取JAVBUS磁力链数据
    async function fetchJAVBUSMagnets(videoCode, container) {
        // ====== [优先] 检查缓存 ======
        const cached = JAVBUS_CACHE[videoCode];
        if (cached && cached.status === 'loaded' && cached.data && cached.data.length > 0) {
            renderMagnetData(cached.data, container);
            container.dataset.loaded = 'true';
            const badge = document.getElementById('javbus-magnet-badge');
            if (badge) {
                badge.textContent = cached.data.length;
                badge.style.display = 'flex';
            }
            return;
        }
        
        const url = `https://www.javbus.com/${videoCode}`;
        console.log('JavdbBuddy: fetchJAVBUSMagnets()函数被调用');
        console.log('JavdbBuddy: 番号:', videoCode);
        console.log('JavdbBuddy: 容器ID:', container.id);
        console.log('JavdbBuddy: 正在获取JAVBUS磁力链:', url);
        
        // 角标更新辅助函数
        function updateJavbusBadge(count) {
            const badge = document.getElementById('javbus-magnet-badge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = 'flex';
            }
        }
        
        // 先显示加载中状态
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>🔄 正在从JAVBUS加载磁力链...</p>
                <p style="font-size: 12px; color: #999;">请稍候，正在获取数据...</p>
            </div>
        `;
        
        // 获取JAVBUS页面
        console.log('JavdbBuddy: 开始发送GM_xmlhttpRequest请求到:', url);
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.javbus.com/',
                'Cookie': JB_JAVBUS_COOKIE_HEADER
            },
            timeout: 20000,
            onload: function(response) {
                console.log('JavdbBuddy: GM_xmlhttpRequest onload回调被调用，状态码:', response.status);
                try {
                    console.log('JavdbBuddy: JAVBUS页面获取成功，状态码:', response.status);
                    console.log('JavdbBuddy: HTML长度:', response.responseText.length);
                    
                    if (response.status !== 200) {
                        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                            <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                            <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                        </div>`;
                        container.dataset.loaded = 'error';
                        updateJavbusBadge(0);
                        return;
                    }
                    
                    // 解析HTML
                    const html = response.responseText;
                    console.log('JavdbBuddy: HTML内容前200字符:', html.substring(0, 200));
                    
                    // 提取 gid, uc, img 变量
                    const gidMatch = html.match(/var\s+gid\s*=\s*(\d+)\s*;/);
                    const ucMatch = html.match(/var\s+uc\s*=\s*(\d+)\s*;/);
                    const imgMatch = html.match(/var\s+img\s*=\s*'([^']+)'\s*;/);
                    
                    if (gidMatch && ucMatch && imgMatch) {
                        const gid = gidMatch[1];
                        const uc = ucMatch[1];
                        const img = imgMatch[1];
                        console.log('JavdbBuddy: 提取到变量 - gid:', gid, 'uc:', uc, 'img:', img);
                        
                        // 调用API获取磁力链数据
                        const apiUrl = `https://www.javbus.com/ajax/uncledatoolsbyajax.php?gid=${gid}&lang=zh&img=${encodeURIComponent(img)}&uc=${uc}`;
                        console.log('JavdbBuddy: 调用API:', apiUrl);
                        
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: apiUrl,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                                'Referer': url,
                                'Cookie': JB_JAVBUS_COOKIE_HEADER,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            timeout: 15000,
                            onload: function(apiResponse) {
                                console.log('JavdbBuddy: API响应状态码:', apiResponse.status);
                                if (apiResponse.status !== 200) {
                                    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                                        <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                                        <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                                    </div>`;
                                    container.dataset.loaded = 'error';
                                    updateJavbusBadge(0);
                                    return;
                                }
                                
                                const apiHtml = apiResponse.responseText;
                                console.log('JavdbBuddy: API返回HTML长度:', apiHtml.length);
                                
                                // 解析API返回的HTML片段
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(`<table><tbody>${apiHtml}</tbody></table>`, 'text/html');
                                const rows = doc.querySelectorAll('tr');
                                
                                const magnetData = [];
                                rows.forEach(row => {
                                    const cells = row.querySelectorAll('td');
                                    if (cells.length >= 3) {
                                        const nameCell = cells[0];
                                        const sizeCell = cells[1];
                                        const dateCell = cells[2];
                                        
                                        // 提取名称和链接
                                        const nameLink = nameCell.querySelector('a');
                                        const sizeLink = sizeCell.querySelector('a');
                                        const dateLink = dateCell.querySelector('a');
                                        
                                        if (nameLink && nameLink.href.startsWith('magnet:')) {
                                            const nameText = nameLink.textContent.trim();
                                            const sizeText = sizeLink ? sizeLink.textContent.trim() : '';
                                            const dateText = dateLink ? dateLink.textContent.trim() : '';
                                            
                                            // 从nameCell的HTML中提取标签
                                            const nameHTML = nameCell.innerHTML;
                                            const hasHD = nameHTML.includes('高清') || nameText.includes('高清');
                                            const hasSub = nameHTML.includes('字幕') || nameText.includes('字幕');
                                            
                                            magnetData.push({
                                                name: nameText,
                                                size: sizeText,
                                                date: dateText,
                                                magnetUrl: nameLink.href,
                                                hasSub: hasSub,
                                                hasHD: hasHD
                                            });
                                        }
                                    }
                                });
                                
                                console.log('JavdbBuddy: 从API提取到磁力链数据数量:', magnetData.length);
                                
                                if (magnetData.length > 0) {
                                    // 对磁力链数据进行排序：有字幕的排在最前面
                                    magnetData.sort((a, b) => {
                                        if (a.hasSub && !b.hasSub) return -1;
                                        if (!a.hasSub && b.hasSub) return 1;
                                        return 0;
                                    });
                                    
                                    // ====== 保存到缓存 ======
                                    JAVBUS_CACHE[videoCode] = { status: 'loaded', data: magnetData };
                                    
                                    renderMagnetData(magnetData, container);
                                    container.dataset.loaded = 'true';
                                    
                                    // 更新JAVBUS磁力链角标
                                    const badge = document.getElementById('javbus-magnet-badge');
                                    if (badge) {
                                        badge.textContent = magnetData.length;
                                        badge.style.display = 'flex';
                                    }
                                } else {
                                    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                                        <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                                        <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                                    </div>`;
                                    container.dataset.loaded = 'error';
                                    updateJavbusBadge(0);
                                }
                            },
                            onerror: function(error) {
                                console.error('JavdbBuddy: API请求失败:', error);
                                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                                    <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                                    <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                                </div>`;
                                container.dataset.loaded = 'error';
                                updateJavbusBadge(0);
                            },
                            ontimeout: function() {
                                console.error('JavdbBuddy: API请求超时');
                                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                                    <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                                    <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                                </div>`;
                                container.dataset.loaded = 'error';
                                updateJavbusBadge(0);
                            }
                        });
                        
                    } else {
                        console.warn('JavdbBuddy: 无法提取gid/uc/img，回退到HTML解析');
                        // 回退到原有的HTML解析逻辑
                        fallbackParseMagnetsFromHTML(html, url, container);
                    }
                    
                } catch (error) {
                    console.error('JavdbBuddy: 解析JAVBUS页面失败:', error);
                    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                        <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                        <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                    </div>`;
                    container.dataset.loaded = 'error';
                    updateJavbusBadge(0);
                }
            },
            onerror: function(error) {
                console.error('JavdbBuddy: 获取JAVBUS页面失败:', error);
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                    <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                    <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                </div>`;
                container.dataset.loaded = 'error';
                updateJavbusBadge(0);
            },
            ontimeout: function() {
                console.error('JavdbBuddy: 获取JAVBUS页面超时');
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                    <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                    <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                </div>`;
                container.dataset.loaded = 'error';
                updateJavbusBadge(0);
            }
        });
        
        // 添加一个超时检查，如果请求长时间没有响应，显示错误
        setTimeout(() => {
            if (!container.dataset.loaded || container.dataset.loaded === 'false') {
                console.error('JavdbBuddy: GM_xmlhttpRequest请求长时间未响应，可能被阻止');
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                    <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                    <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
                </div>`;
                container.dataset.loaded = 'error';
                updateJavbusBadge(0);
            }
        }, 30000);
    }
    
    // 回退函数：从HTML解析磁力链（原有逻辑）
    function fallbackParseMagnetsFromHTML(html, url, container) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // 直接从HTML中提取磁力链数据
        const magnetLinks = doc.querySelectorAll('a[href^="magnet:"]');
        console.log('JavdbBuddy: 回退解析 - 找到磁力链接数量:', magnetLinks.length);
        
        if (magnetLinks.length === 0) {
            console.error('JavdbBuddy: 回退解析 - 未找到任何磁力链接');
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
            </div>`;
            container.dataset.loaded = 'error';
            const badge = document.getElementById('javbus-magnet-badge');
            if (badge) { badge.textContent = '0'; badge.style.display = 'flex'; }
            return;
        }
        
        // 提取磁力链数据
        const magnetData = [];
        
        for (let i = 0; i < magnetLinks.length; i++) {
            const magnetLink = magnetLinks[i];
            const row = magnetLink.closest('tr');
            
            if (row) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    const nameCell = cells[0];
                    const sizeCell = cells[1];
                    const dateCell = cells[2];
                    
                    // 提取名称和标签
                    const nameText = nameCell.textContent.trim();
                    const sizeText = sizeCell.textContent.trim();
                    const dateText = dateCell.textContent.trim();
                    
                    // 检查是否有高清和字幕标签
                    const hasHD = nameText.includes('高清');
                    const hasSub = nameText.includes('字幕');
                    
                    magnetData.push({
                        name: nameText,
                        size: sizeText,
                        date: dateText,
                        magnetUrl: magnetLink.href,
                        hasSub: hasSub,
                        hasHD: hasHD
                    });
                }
            }
        }
        
        console.log('JavdbBuddy: 回退解析 - 提取到磁力链数据数量:', magnetData.length);
        
        if (magnetData.length > 0) {
            // 对磁力链数据进行排序：有字幕的排在最前面
            magnetData.sort((a, b) => {
                if (a.hasSub && !b.hasSub) return -1;
                if (!a.hasSub && b.hasSub) return 1;
                return 0;
            });
            
            renderMagnetData(magnetData, container);
            container.dataset.loaded = 'true';
            
            // 更新JAVBUS磁力链角标
            const badge = document.getElementById('javbus-magnet-badge');
            if (badge) {
                badge.textContent = magnetData.length;
                badge.style.display = 'flex';
            }
        } else {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 4px;">
                <p style="font-weight: bold; margin-bottom: 8px;">暂无数据</p>
                <p style="font-size: 12px;">JAVBUS 未收录该影片或暂无可用的磁力链</p>
            </div>`;
            container.dataset.loaded = 'error';
            
            // 显示角标 0
            const badge = document.getElementById('javbus-magnet-badge');
            if (badge) {
                badge.textContent = '0';
                badge.style.display = 'flex';
            }
        }
    }
    
    // 延迟添加双标签磁力链（确保页面加载完成）
    addDualTabsForMagnets();

    // ================================================================
    // ========== JavdbBuddy 增强功能模块 ==========
    const JB_API_BASE = 'https://jdforrepam.com/api';

    // 照搬 JavdbBuddy 的签名函数：使用外部库 blueimp-md5（通过 @require 加载）
    function jbBuildSignature() {
        const curr = Math.floor(Date.now() / 1000);
        const stored = localStorage.getItem('jb_jdsignature');
        if (stored) {
            const parts = stored.split('.');
            if (parts.length === 3 && (curr - parseInt(parts[0])) <= 300) return stored;
        }
        const sign = `${curr}.lpw6vgqzsp.${md5(`${curr}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
        localStorage.setItem('jb_jdsignature', sign);
        return sign;
    }

    // 照搬 JavdbBuddy 的 gmRequest：只检查 HTTP 状态码，不检查 data.success，带3次重试
    function jbApiGetOnce(url, params, headers) {
        return new Promise((resolve, reject) => {
            let fullUrl = url;
            if (params && Object.keys(params).length) {
                const qs = new URLSearchParams(params).toString();
                fullUrl += (url.includes('?') ? '&' : '?') + qs;
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: fullUrl,
                headers: headers || {},
                timeout: 8000,
                onload: (resp) => {
                    try {
                        if (resp.status >= 200 && resp.status < 300) {
                            if (resp.responseText) {
                                try {
                                    resolve(JSON.parse(resp.responseText));
                                } catch (e) {
                                    resolve(resp.responseText);
                                }
                            } else {
                                resolve(resp.responseText || resp);
                            }
                        } else {
                            try {
                                const errorData = JSON.parse(resp.responseText);
                                reject(errorData);
                            } catch (e) {
                                reject(new Error(resp.responseText || `请求发生错误 ${resp.status}`));
                            }
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: (err) => reject(new Error('请求失败')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });
    }
    async function jbApiGet(url, params, headers) {
        let lastError;
        for (let i = 0; i < 3; i++) {
            try {
                return await jbApiGetOnce(url, params, headers);
            } catch (e) {
                lastError = e;
                if (i < 2) await new Promise(r => setTimeout(r, 500));
            }
        }
        throw lastError;
    }

    // 外部API 接口
    const jbApi = {
        // 获取热播排行
        async playback(period = 'daily', filterBy = 'high_score') {
            const sign = await jbBuildSignature();
            const url = `${JB_API_BASE}/v1/rankings/playback?period=${period}&filter_by=${filterBy}`;
            const res = await jbApiGet(url, null, { jdSignature: sign });
            return res.data?.movies || [];
        },
        // 获取 Top250（year 仅在 video_type 分类下生效，照搬原版参数映射）
        async top250(type = 'all', typeValue = '', page = 1, limit = 50, year = '') {
            const sign = await jbBuildSignature();
            let url = `${JB_API_BASE}/v1/movies/top?start_rank=1&type=${type}&type_value=${encodeURIComponent(typeValue)}&ignore_watched=false&page=${page}&limit=${limit}`;
            if (year) url += `&year=${encodeURIComponent(year)}`;
            const res = await jbApiGet(url, null, {
                'user-agent': 'Dart/3.5 (dart:io)',
                'accept-language': 'zh-TW',
                'host': 'jdforrepam.com',
                authorization: 'Bearer ' + (localStorage.getItem('jb_appAuthorization') || ''),
                jdsignature: sign
            });
            return res;
        },
        // 获取所有评论（分页）—— 照搬 JavdbBuddy：只发 jdSignature，不发 authorization
        async getReviews(movieId, pageNum = 1, pageSize = 20) {
            const sign = await jbBuildSignature();
            const url = `${JB_API_BASE}/v1/movies/${movieId}/reviews`;
            console.log('%c[JB] getReviews 请求:', 'color:#9b59b6;', url, 'movieId:', movieId, 'sign:', sign);
            const res = await jbApiGet(url, { page: pageNum, sort_by: 'hotly', limit: pageSize }, {
                jdSignature: sign
            });
            console.log('%c[JB] getReviews 响应:', 'color:#9b59b6;', res);
            return res.data?.reviews || [];
        },
        // 获取相关清单 —— 照搬 JavdbBuddy：只发 jdSignature，不发 authorization
        async related(movieId, page = 1, limit = 20) {
            const sign = await jbBuildSignature();
            const url = `${JB_API_BASE}/v1/lists/related?movie_id=${movieId}&page=${page}&limit=${limit}`;
            console.log('%c[JB] related 请求:', 'color:#9b59b6;', url, 'movieId:', movieId, 'sign:', sign);
            const res = await jbApiGet(url, null, {
                jdSignature: sign
            });
            console.log('%c[JB] related 响应:', 'color:#9b59b6;', res);
            const dataList = [];
            if (res.data?.lists) {
                res.data.lists.forEach(item => {
                    dataList.push({
                        relatedId: item.id,
                        name: item.name,
                        movieCount: item.movies_count,
                        collectionCount: item.collections_count,
                        viewCount: item.views_count,
                        createTime: item.created_at ? (typeof item.created_at === 'number' ? new Date(item.created_at * 1000).toLocaleDateString('zh-CN') : String(item.created_at)) : ''
                    });
                });
            }
            return dataList;
        },
        // 搜索影片（用于获取 movieId）
        async searchMovie(keyword) {
            const sign = await jbBuildSignature();
            const url = `${JB_API_BASE}/v2/search`;
            const res = await jbApiGet(url, {
                q: keyword, page: 1, type: 'movie', limit: 1,
                movie_type: 'all', from_recent: 'false', movie_filter_by: 'all', movie_sort_by: 'relevance'
            }, {
                'user-agent': 'Dart/3.5 (dart:io)',
                'accept-language': 'zh-TW',
                host: 'jdforrepam.com',
                jdsignature: sign
            });
            return res.data?.movies || [];
        },
        // 获取影片详情
        async getMovieDetail(movieId) {
            const sign = await jbBuildSignature();
            const url = `${JB_API_BASE}/v4/movies/${movieId}`;
            const res = await jbApiGet(url, null, { jdSignature: sign });
            if (!res.data) throw new Error(res.message || '获取详情失败');
            const movie = res.data.movie;
            const imgList = [];
            if (movie.preview_images) {
                movie.preview_images.forEach(item => {
                    imgList.push(item.large_url?.replace(/https:\/\/.*?\/rhe951l4q/g, 'https://c0.jdbstatic.com') || '');
                });
            }
            return {
                movieId: movie.id,
                actors: movie.actors || [],
                duration: movie.duration,
                title: movie.origin_title,
                carNum: movie.number,
                score: movie.score,
                releaseDate: movie.release_date,
                watchedCount: movie.watched_count,
                imgList: imgList
            };
        }
    };



    // ---------- 免VIP热播/Top250 壳页（移植自 JAV老司机-新 的 JavdbApiRanking 模块） ----------

    // 壳页样式：胶囊工具栏/状态条/分页（照搬原版 installRankingShell）
    function jbEnsureRankingShellStyle() {
        if (document.getElementById('jb-ranking-shell-style')) return;
        const style = document.createElement('style');
        style.id = 'jb-ranking-shell-style';
        style.textContent = `
            .javdb-api-shell{margin-top:10px!important}
            .javdb-api-shell-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin:8px 0 12px!important;flex-wrap:wrap!important}
            .javdb-api-shell-title{font-size:18px!important;font-weight:850!important;color:#1e293b!important}
            .javdb-api-shell-toolbar,.javdb-api-shell-pagination{display:flex!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important}
            .javdb-api-shell-toolbar{margin:8px 0 12px!important}
            .javdb-api-shell-pagination{justify-content:center!important;margin:16px 0 8px!important}
            .javdb-api-shell-toolbar-group{display:flex!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important;width:100%!important}
            .javdb-api-shell-toolbar-label{color:#64748b!important;font-size:12px!important;font-weight:850!important;min-width:34px!important}
            .javdb-api-shell-toolbar a,.javdb-api-shell-pagination a,.javdb-api-shell-pagination span{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:30px!important;padding:5px 12px!important;border:1px solid #dbe3ef!important;border-radius:7px!important;background:#fff!important;color:#334155!important;font-size:12px!important;font-weight:800!important;text-decoration:none!important}
            .javdb-api-shell-toolbar a.is-active,.javdb-api-shell-pagination a.is-active{border-color:#60a5fa!important;background:#eff6ff!important;color:#1d4ed8!important}
            .javdb-api-shell-status{margin:10px 0!important;padding:10px 12px!important;border:1px solid #e2e8f0!important;border-radius:8px!important;background:#f8fafc!important;color:#475569!important;font-size:13px!important;font-weight:700!important}
            .javdb-api-shell-status.is-error{border-color:#fecaca!important;background:#fff1f2!important;color:#be123c!important}
        `;
        document.head.appendChild(style);
    }

    // 构造壳页 URL（照搬原版 _apiRankingShellUrl）
    function jbRankingShellUrl(mode, next = {}) {
        const params = new URLSearchParams();
        params.set('laosiji_rank', mode); // 'top' | 'playback'
        if (mode === 'top') {
            params.set('lsj_category', next.category || 'all');
            if (next.year) params.set('lsj_year', next.year);
        } else if (mode === 'playback') {
            params.set('lsj_period', next.period || 'daily');
            params.set('lsj_filter_by', next.filterBy || 'high_score');
        }
        if (next.page && next.page > 1) params.set('lsj_page', String(next.page));
        return `/advanced_search?${params.toString()}`;
    }

    // 解析壳页 URL（照搬原版 _getApiRankingShellMode）
    function jbGetRankingShellMode() {
        if (window.location.pathname !== '/advanced_search') return null;
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('laosiji_rank');
        if (mode !== 'top' && mode !== 'playback') return null;
        return {
            mode,
            page: Math.max(1, parseInt(params.get('lsj_page') || '1', 10) || 1),
            category: params.get('lsj_category') || 'all',
            year: params.get('lsj_year') || '',
            period: params.get('lsj_period') || 'daily',
            filterBy: params.get('lsj_filter_by') || 'high_score'
        };
    }

    // 工具栏（照搬原版 _renderApiRankingToolbar）
    function jbRenderRankingToolbar(modeInfo) {
        if (modeInfo.mode === 'top') {
            const items = [['all', '全部'], ['0', '有码'], ['1', '无码'], ['2', '欧美'], ['3', 'FC2']];
            const categoryLinks = items.map(([category, label]) => {
                const active = modeInfo.category === category;
                const href = jbRankingShellUrl('top', { category, year: modeInfo.year, page: 1 });
                return `<a class="${active ? 'is-active' : ''}" href="${href}">${label}</a>`;
            }).join('');
            const currentYear = new Date().getFullYear();
            const allYearActive = !modeInfo.year;
            const allYearLink = `<a class="${allYearActive ? 'is-active' : ''}" href="${jbRankingShellUrl('top', { category: modeInfo.category, year: '', page: 1 })}">全部年份</a>`;
            const yearLinks = Array.from({ length: Math.max(0, currentYear - 2008 + 1) }, (_, i) => currentYear - i).map(year => {
                const value = String(year); const active = modeInfo.year === value;
                const href = jbRankingShellUrl('top', { category: modeInfo.category, year: value, page: 1 });
                return `<a class="${active ? 'is-active' : ''}" href="${href}">${value}</a>`;
            }).join('');
            return `<div class="javdb-api-shell-toolbar-group"><span class="javdb-api-shell-toolbar-label">分类</span> ${categoryLinks} </div><div class="javdb-api-shell-toolbar-group"><span class="javdb-api-shell-toolbar-label">年份</span> ${allYearLink}${yearLinks} </div>`;
        }
        const items = [['daily', '日榜'], ['weekly', '周榜'], ['monthly', '月榜']];
        const periodLinks = items.map(([period, label]) => {
            const active = modeInfo.period === period;
            const href = jbRankingShellUrl('playback', { period, filterBy: modeInfo.filterBy, page: 1 });
            return `<a class="${active ? 'is-active' : ''}" href="${href}">${label}</a>`;
        }).join('');
        const filters = [['high_score', '高评分']];
        const filterLinks = filters.map(([filterBy, label]) => {
            const active = modeInfo.filterBy === filterBy;
            const href = jbRankingShellUrl('playback', { period: modeInfo.period, filterBy, page: 1 });
            return `<a class="${active ? 'is-active' : ''}" href="${href}">${label}</a>`;
        }).join('');
        return `<div class="javdb-api-shell-toolbar-group"><span class="javdb-api-shell-toolbar-label">周期</span> ${periodLinks} </div><div class="javdb-api-shell-toolbar-group"><span class="javdb-api-shell-toolbar-label">排序</span> ${filterLinks} </div>`;
    }

    // 分页（照搬原版 _renderApiRankingPagination）
    function jbRenderRankingPagination(modeInfo, hasNext) {
        const page = modeInfo.page;
        const href = nextPage => jbRankingShellUrl(modeInfo.mode, modeInfo.mode === 'top'
            ? { category: modeInfo.category, year: modeInfo.year, page: nextPage }
            : { period: modeInfo.period, filterBy: modeInfo.filterBy, page: nextPage });
        const pages = modeInfo.mode === 'top'
            ? [1, 2, 3, 4, 5].map(item => `<a class="${item === page ? 'is-active' : ''}" href="${href(item)}">${item}</a>`).join('')
            : `<span>第 ${page} 页</span>`;
        return `<div class="javdb-api-shell-pagination"> ${page > 1 ? `<a href="${href(page - 1)}">上一页</a>` : ''}${pages}${hasNext ? `<a href="${href(page + 1)}">下一页</a>` : ''} </div>`;
    }

    // 卡片渲染（照搬原版 _renderApiRankingMovies：评分/评价人数/标签/封面域名替换）
    function jbRenderRankingMovies(movies) {
        const updateCover = value => String(value || '').replace(/https:\/\/.*?\/rhe951l4q/g, 'https://c0.jdbstatic.com');
        return movies.map(raw => {
            const item = raw?.movie || raw;
            const title = item?.origin_title || item?.title || '';
            const score = item?.score ? `<span class="value">${jbEscapeHtml(item.score)}分${item?.watched_count ? `, 由${jbEscapeHtml(item.watched_count)}人評價` : ''}</span>` : '';
            const tags = [
                item?.has_cnsub ? '<span class="tag is-warning">中文字幕</span>' : '',
                Number(item?.magnets_count || 0) > 0 ? '<span class="tag is-success">含磁鏈</span>' : '',
                Number(item?.magnets_count || 0) <= 0 ? '<span class="tag">無磁鏈</span>' : '',
                item?.new_magnets ? '<span class="tag is-info">今日新種</span>' : ''
            ].filter(Boolean).join('');
            const href = `/v/${jbEscapeHtml(item?.id || '')}`;
            return `<div class="item"><a href="${jbEscapeHtml(href)}" class="box" title="${jbEscapeHtml(title)}"><div class="cover "><img loading="lazy" src="${jbEscapeHtml(updateCover(item?.cover_url || item?.thumb_url || ''))}" alt=""></div><div class="video-title"><strong>${jbEscapeHtml(item?.number || '')}</strong> ${jbEscapeHtml(title)}</div><div class="score">${score}</div><div class="meta">${jbEscapeHtml(item?.release_date || '')}</div><div class="tags has-addons">${tags}</div></a></div>`;
        }).join('');
    }

    // 壳页主入口（照搬原版 _initApiRankingShellPage，登录逻辑复用本脚本 jbAutoLogin/jbShowLoginDialog）
    async function jbHandleRankingShellPage() {
        const modeInfo = jbGetRankingShellMode();
        if (!modeInfo) return;

        const container = document.querySelector('.section .container');
        if (!container || document.querySelector('.jb-ranking-shell')) return;

        // 页面标题与清理
        const h2 = document.querySelector('h2.section-title');
        if (h2) {
            const firstText = h2.childNodes[0];
            if (firstText && firstText.nodeType === 3) firstText.textContent = modeInfo.mode === 'top' ? 'Top250' : '热播';
            h2.style.marginBottom = '0';
        }
        document.querySelectorAll('.empty-message, .section .container > .box, #sort-toggle-btn').forEach(el => el.remove());

        jbEnsureRankingShellStyle();
        const title = modeInfo.mode === 'top' ? 'Top250' : '热播';
        container.innerHTML = `<div class="jb-ranking-shell javdb-api-shell"><div class="javdb-api-shell-head"><div class="javdb-api-shell-title"> ${title} </div></div><div class="javdb-api-shell-toolbar"> ${jbRenderRankingToolbar(modeInfo)} </div><div class="javdb-api-shell-status">正在加载 API 数据...</div><div class="movie-list h cols-4 vcols-8"></div><div class="javdb-api-shell-pagination-wrap"></div></div>`;
        const status = container.querySelector('.javdb-api-shell-status');
        const list = container.querySelector('.movie-list');
        const pagination = container.querySelector('.javdb-api-shell-pagination-wrap');

        // Top250 需要登录：无 token 先自动登录，失败弹登录框
        if (modeInfo.mode === 'top' && !localStorage.getItem('jb_appAuthorization')) {
            status.textContent = '🔐 Top250 需要登录，正在尝试自动登录...';
            const ok = await jbAutoLogin();
            if (ok) { window.location.reload(); return; }
            jbShowLoginDialog(true);
            return;
        }

        try {
            let movies = [], total = 0;
            if (modeInfo.mode === 'top') {
                // 参数映射（照搬原版）：all→all；分类→video_type；仅年份→year
                let type = 'all', typeValue = '';
                if (modeInfo.category && modeInfo.category !== 'all') { type = 'video_type'; typeValue = modeInfo.category; }
                else if (modeInfo.year) { type = 'year'; typeValue = modeInfo.year; }
                const res = await jbApi.top250(type, typeValue, modeInfo.page, 50, (modeInfo.category !== 'all' && modeInfo.year) ? modeInfo.year : '');
                if (res.success !== 1) throw Object.assign(new Error(res.message || 'Top250 请求失败'), { action: res.action });
                movies = Array.isArray(res.data?.movies) ? res.data.movies : [];
                total = Number(res.data?.total || 0);
            } else {
                // 热播：一次性取全量后前端切片分页（照搬原版）
                const all = await jbApi.playback(modeInfo.period);
                const limit = 40;
                const start = (modeInfo.page - 1) * limit;
                movies = all.slice(start, start + limit);
                total = all.length;
            }
            if (!movies.length) { status.textContent = '没有查询到数据。'; return; }
            list.innerHTML = jbRenderRankingMovies(movies);
            status.textContent = total ? `已加载 ${movies.length} 条数据，共 ${total} 条匹配` : `已加载 ${movies.length} 条数据`;
            const hasNext = modeInfo.mode === 'top' ? modeInfo.page < 5 : (total ? modeInfo.page * 40 < total : movies.length >= 40);
            pagination.innerHTML = jbRenderRankingPagination(modeInfo, hasNext);
            jbApplyCardLayout(); // 卡片列数/动画/竖图立即生效
        } catch (err) {
            console.error('[JB] 榜单请求失败:', err);
            // JWT 鉴权失效：清 token 重新自动登录
            if (err && (err.action === 'JWTVerificationError' || /JWT/i.test(String(err.message || '')))) {
                localStorage.removeItem('jb_appAuthorization');
                status.textContent = '登录已过期，正在尝试自动登录...';
                const ok = await jbAutoLogin();
                if (ok) { window.location.reload(); return; }
                jbShowLoginDialog(true);
                return;
            }
            status.classList.add('is-error');
            status.textContent = (err && err.message) || 'API 请求失败';
        }
    }

    // ---------- 自动登录 ----------
    async function jbAutoLogin() {
        const savedUser = localStorage.getItem('jb_saved_username');
        const savedPass = localStorage.getItem('jb_saved_password');
        if (!savedUser || !savedPass) {
            console.log('[JB] 没有保存的账号密码，无法自动登录');
            return false;
        }

        console.log('[JB] 正在用保存的账号自动登录:', savedUser);
        try {
            const sign = jbBuildSignature();
            const loginUrl = `${JB_API_BASE}/v1/sessions?username=${encodeURIComponent(savedUser)}&password=${encodeURIComponent(savedPass)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`;
            const res = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: loginUrl,
                    headers: {
                        'Content-Type': 'multipart/form-data; boundary=--dio-boundary-2210433284',
                        'user-agent': 'Dart/3.5 (dart:io)',
                        'accept-language': 'zh-TW',
                        'jdSignature': sign
                    },
                    timeout: 15000,
                    onload: (resp) => {
                        console.log('[JB] 登录接口响应状态:', resp.status);
                        try { resolve(JSON.parse(resp.responseText)); }
                        catch (e) { reject(new Error('解析响应失败: ' + (resp.responseText || '').substring(0, 200))); }
                    },
                    onerror: () => reject(new Error('请求失败')),
                    ontimeout: () => reject(new Error('请求超时'))
                });
            });

            console.log('[JB] 登录接口返回:', res);
            if (res.success === 1 && res.data?.token) {
                localStorage.setItem('jb_appAuthorization', res.data.token);
                console.log('[JB] 自动登录成功');
                return true;
            } else {
                console.log('[JB] 自动登录失败:', res.message || '未知错误');
            }
        } catch (e) {
            console.error('[JB] 自动登录异常:', e);
        }
        return false;
    }

    // ---------- Top250 登录对话框 ----------
    function jbShowLoginDialog(autoLoginFailed) {
        const container = document.querySelector('.section .container');
        if (!container) return;

        // 清理页面
        document.querySelectorAll('.empty-message, .section .container > .box, #sort-toggle-btn').forEach(el => el.remove());

        const h2 = document.querySelector('h2.section-title');
        if (h2) {
            const firstText = h2.childNodes[0];
            if (firstText && firstText.nodeType === 3) firstText.textContent = 'Top250';
        }

        if (document.querySelector('.jb-login-panel')) return;

        const savedUser = localStorage.getItem('jb_saved_username') || '';
        const savedPass = localStorage.getItem('jb_saved_password') || '';

        const panel = document.createElement('div');
        panel.className = 'jb-login-panel';
        panel.style.cssText = 'max-width:400px;margin:40px auto;padding:30px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
        panel.innerHTML = `
            <h3 style="margin:0 0 20px 0;color:#333;font-size:18px;text-align:center;">🔐 Top250 需要登录</h3>
            <p style="margin:0 0 15px 0;color:#666;font-size:13px;text-align:center;">该功能依赖移动端接口，请输入 JavDB 账号登录</p>
            ${autoLoginFailed ? '<p style="margin:0 0 15px 0;color:#e74c3c;font-size:13px;text-align:center;">自动登录失败，请手动登录</p>' : ''}
            <div style="margin-bottom:15px;">
                <input type="text" id="jb-login-user" placeholder="用户名 | 邮箱" value="${savedUser.replace(/"/g, '&quot;')}" style="width:100%;padding:12px 15px;border:1px solid #e0e0e0;border-radius:4px;box-sizing:border-box;font-size:14px;background:#f9f9f9;color:#333;">
            </div>
            <div style="margin-bottom:15px;">
                <input type="password" id="jb-login-pass" placeholder="密码" value="${savedPass.replace(/"/g, '&quot;')}" style="width:100%;padding:12px 15px;border:1px solid #e0e0e0;border-radius:4px;box-sizing:border-box;font-size:14px;background:#f9f9f9;color:#333;">
            </div>
            <div style="margin-bottom:15px;display:flex;align-items:center;gap:6px;">
                <input type="checkbox" id="jb-login-remember" checked style="cursor:pointer;">
                <label for="jb-login-remember" style="color:#666;font-size:13px;cursor:pointer;">记住密码（下次自动登录）</label>
            </div>
            <button id="jb-login-btn" style="width:100%;padding:12px;background:#4a8bfc;color:white;border:none;border-radius:4px;font-size:15px;cursor:pointer;">登录</button>
            <div id="jb-login-msg" style="margin-top:10px;text-align:center;color:#e74c3c;font-size:13px;display:none;"></div>
        `;
        container.appendChild(panel);

        document.getElementById('jb-login-btn')?.addEventListener('click', async () => {
            const username = document.getElementById('jb-login-user')?.value?.trim();
            const password = document.getElementById('jb-login-pass')?.value?.trim();
            const remember = document.getElementById('jb-login-remember')?.checked;
            const msgEl = document.getElementById('jb-login-msg');

            if (!username || !password) {
                if (msgEl) { msgEl.textContent = '请输入用户名和密码'; msgEl.style.display = 'block'; }
                return;
            }

            const btn = document.getElementById('jb-login-btn');
            if (btn) { btn.textContent = '登录中...'; btn.disabled = true; }

            try {
                const sign = jbBuildSignature();
                // 照搬 JavdbBuddy 的登录接口：/v1/sessions，参数通过 query string 传递
                const loginUrl = `${JB_API_BASE}/v1/sessions?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&device_uuid=04b9534d-5118-53de-9f87-2ddded77111e&device_name=iPhone&device_model=iPhone&platform=ios&system_version=17.4&app_version=official&app_version_number=1.9.29&app_channel=official`;
                const res = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: loginUrl,
                        headers: {
                            'Content-Type': 'multipart/form-data; boundary=--dio-boundary-2210433284',
                            'user-agent': 'Dart/3.5 (dart:io)',
                            'accept-language': 'zh-TW',
                            'jdSignature': sign
                        },
                        timeout: 15000,
                        onload: (resp) => {
                            try { resolve(JSON.parse(resp.responseText)); }
                            catch (e) { reject(new Error('解析响应失败: ' + (resp.responseText || '').substring(0, 200))); }
                        },
                        onerror: () => reject(new Error('请求失败')),
                        ontimeout: () => reject(new Error('请求超时'))
                    });
                });

                if (res.success === 1 && res.data?.token) {
                    localStorage.setItem('jb_appAuthorization', res.data.token);
                    if (remember) {
                        localStorage.setItem('jb_saved_username', username);
                        localStorage.setItem('jb_saved_password', password);
                    } else {
                        localStorage.removeItem('jb_saved_username');
                        localStorage.removeItem('jb_saved_password');
                    }
                    // 登录成功，刷新页面加载 Top250
                    window.location.reload();
                } else {
                    if (msgEl) { msgEl.textContent = res.message || '登录失败'; msgEl.style.display = 'block'; }
                    if (btn) { btn.textContent = '登录'; btn.disabled = false; }
                }
            } catch (e) {
                if (msgEl) { msgEl.textContent = e.message; msgEl.style.display = 'block'; }
                if (btn) { btn.textContent = '登录'; btn.disabled = false; }
            }
        });
    }

    // ---------- FC2PPV 增强 ----------
    function jbEnhanceFC2Page() {
        if (!window.location.href.includes('advanced_search?type=3')) return;
        const h2 = document.querySelector('h2.section-title');
        if (h2) {
            const firstText = h2.childNodes[0];
            if (firstText && firstText.nodeType === 3) {
                firstText.textContent = 'Fc2PPV';
            }
        }
        // 移除空的搜索结果提示，添加 FC2 第三方搜索入口
        const box = document.querySelector('.section .container > .box');
        if (box) box.remove();

        const container = document.querySelector('.section .container');
        if (container && !document.querySelector('.jb-fc2-panel')) {
            const panel = document.createElement('div');
            panel.className = 'jb-fc2-panel';
            panel.style.cssText = 'margin: 15px 0; padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);';
            panel.innerHTML = `
                <h3 style="margin:0 0 12px 0;color:#9b59b6;font-size:16px;">🍑 FC2PPV 第三方资源</h3>
                <p style="margin:0 0 10px 0;color:#666;font-size:13px;">点击下方链接可查看 FC2 影片的详细信息、预览图和磁力链：</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <a href="https://fc2ppvdb.com/" target="_blank" style="padding:8px 16px;background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">FC2PPVDB</a>
                    <a href="https://adult.contents.fc2.com/" target="_blank" style="padding:8px 16px;background:linear-gradient(135deg,#e74c3c,#c0392b);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">FC2官方</a>
                    <a href="https://123av.com/search?keyword=FC2-PPV" target="_blank" style="padding:8px 16px;background:linear-gradient(135deg,#3498db,#2980b9);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">123AV</a>
                </div>
            `;
            container.insertBefore(panel, container.firstChild);
        }
    }

    // ---------- 增强功能启动入口 ----------
    function jbInit() {
        console.log('%c✅ JavdbBuddy 增强功能启动', 'color: #9b59b6; font-size: 14px; font-weight: bold;');

        try { jbAddNavigation(); } catch (e) { console.error('[JB] 导航增强失败:', e); }
        try { jbEnhanceFC2Page(); } catch (e) { console.error('[JB] FC2增强失败:', e); }
        try { jbHandleRankingShellPage(); } catch (e) { console.error('[JB] 热播/Top250失败:', e); }

        // 详情页：短评 + 相关清单
        if (window.location.pathname.startsWith('/v/')) {
            jbSetupDetailTabs();
        }
    }

    // 设置详情页：短评 + 相关清单
    // 终极方案：彻底禁用 Stimulus movie-tab 控制器，在容器外部创建自定义标签栏
    // 核心修复：移除 data-controller 属性 → Stimulus 触发 disconnect() → 自动清除事件监听器
    function jbSetupDetailTabs() {
        const movieId = window.location.href.split("/").pop().split(/[?#]/)[0];
        if (!movieId) { console.error('[JB] 无法提取 movieId'); return; }
        console.log('%c[JB] movieId:', 'color:#9b59b6;', movieId);

        let retryCount = 0;
        const maxRetries = 80;
        const chk = setInterval(() => {
            retryCount++;
            const originalTabs = document.querySelector('.tabs.no-bottom');
            const tabsContainer = document.getElementById('tabs-container');
            const tabsUl = document.querySelector('.tabs ul');
            if (!originalTabs || !tabsContainer || !tabsUl) {
                if (retryCount >= maxRetries) { clearInterval(chk); console.error('[JB] 标签容器未找到'); }
                return;
            }
            clearInterval(chk);
            console.log('%c[JB] 标签容器就绪', 'color:#9b59b6;');

            // ① 先获取 Stimulus 控制器容器（必须在移除原始标签之前，因为移除后 originalTabs.parentElement 为 null）
            const movieTabContainer = document.querySelector('[data-controller*="movie-tab"]') || originalTabs.parentElement;

            // ② 从原始标签中提取文本信息（保留短评数量等）
            const origLis = tabsUl.querySelectorAll('li');
            let magnetsText = '磁鏈', reviewText = '短評', listsText = '相關清單';
            origLis.forEach(li => {
                const text = li.textContent.trim();
                if (text.includes('磁力') || text.includes('磁链') || text.includes('磁鏈')) magnetsText = text;
                else if (text.includes('短评') || text.includes('短評')) reviewText = text;
                else if (text.includes('相关') || text.includes('相關') || text.includes('清单') || text.includes('清單')) listsText = text;
            });

            // ③ 关键修复：彻底禁用 Stimulus movie-tab 控制器
            // 移除 data-controller 属性 → Stimulus 检测到属性变化 → 调用 disconnect() → 清除所有事件监听器
            // 同时移除所有子元素的 data-action 和 data-movie-tab-target 属性，防止事件委托匹配
            if (movieTabContainer) {
                movieTabContainer.removeAttribute('data-controller');
                movieTabContainer.querySelectorAll('[data-action]').forEach(el => el.removeAttribute('data-action'));
                movieTabContainer.querySelectorAll('[data-movie-tab-target]').forEach(el => el.removeAttribute('data-movie-tab-target'));
                console.log('%c[JB] Stimulus movie-tab 控制器已禁用（disconnect 触发）', 'color:#9b59b6;');
            }

            // ④ 彻底移除原始标签栏（不再仅隐藏，防止任何 JS 操作残留的原始标签）
            originalTabs.remove();
            console.log('%c[JB] 原始标签栏已从 DOM 移除', 'color:#9b59b6;');

            // ⑤ 在 movie-tab 控制器容器【外部】创建自定义标签栏
            // 使用 <span> 替代 <a>，避免 Turbo/Turbolinks 拦截 <a> 标签的点击事件
            const videoDetail = document.querySelector('div.video-detail') || movieTabContainer.parentElement;
            const newTabsBar = document.createElement('div');
            newTabsBar.id = 'jb-custom-tabs';
            newTabsBar.className = 'tabs no-bottom';
            newTabsBar.setAttribute('data-turbo', 'false');
            newTabsBar.setAttribute('data-turbolinks', 'false');
            // 注意：使用 <span> 替代 <a> 避免 Turbo 拦截，
            // 但必须加上 display:block;padding 来模拟 <a> 的样式，否则 JAVDB 的 CSS 不会应用在 span 上
            newTabsBar.innerHTML = `<ul>
                <li class="is-active" data-jb-tab="magnets"><span style="cursor:pointer;display:block;padding:12px 16px;">${magnetsText}</span></li>
                <li data-jb-tab="reviews"><span style="cursor:pointer;display:block;padding:12px 16px;">${reviewText}</span></li>
                <li data-jb-tab="lists"><span style="cursor:pointer;display:block;padding:12px 16px;">${listsText}</span></li>
            </ul>`;
            // 插入到 video-detail 下、movieTabContainer 之前（在 Stimulus 容器外部）
            videoDetail.insertBefore(newTabsBar, movieTabContainer);

            // 注入强制标签高亮样式：JAVDB 原版的 .tabs li.is-active a { border-bottom: 3px solid #0099e8; } 因使用 span 替代 a 而失效，
            // 改为在 li 本身上设置 border-bottom，添加 !important 确保不被覆盖
            const tabStyle = document.createElement('style');
            tabStyle.textContent = `
                #jb-custom-tabs.tabs.no-bottom ul li { border-bottom: 3px solid transparent !important; }
                #jb-custom-tabs.tabs.no-bottom ul li.is-active { border-bottom: 3px solid #0099e8 !important; }
                #jb-custom-tabs.tabs.no-bottom ul li.is-active span { color: #0099e8 !important; font-weight: 700 !important; }
            `;
            document.head.appendChild(tabStyle);
            console.log('%c[JB] 自定义标签栏已创建（在 movie-tab 容器外部，使用 span 替代 a）', 'color:#9b59b6;');

            // ⑥ 创建短评和相关清单的内容面板（插入到 tabs-container 中）
            const reviewPanel = document.getElementById('jb-review-area') || (() => {
                const div = document.createElement('div');
                div.id = 'jb-review-area';
                div.className = 'content-panel';
                div.style.display = 'none';
                tabsContainer.appendChild(div);
                return div;
            })();
            const relatedPanel = document.getElementById('jb-related-area') || (() => {
                const div = document.createElement('div');
                div.id = 'jb-related-area';
                div.className = 'content-panel';
                div.style.display = 'none';
                tabsContainer.appendChild(div);
                return div;
            })();

            // ⑦ 隐藏原始的 #reviews 和 #lists 面板（VIP专用的空面板）
            const origReviews = document.getElementById('reviews');
            const origLists = document.getElementById('lists');
            if (origReviews) origReviews.style.display = 'none';
            if (origLists) origLists.style.display = 'none';

            // ⑧ 懒加载标记
            let reviewsLoaded = false;
            let relatedLoaded = false;





            // ⑨ 标签切换逻辑
            const allNewTabs = newTabsBar.querySelectorAll('li');
            let currentTab = 'magnets'; // 记录当前激活的标签

            function switchTo(tabName) {
                currentTab = tabName;
                allNewTabs.forEach(t => t.classList.remove('is-active'));
                const activeTab = newTabsBar.querySelector(`[data-jb-tab="${tabName}"]`);
                if (activeTab) activeTab.classList.add('is-active');

                // 隐藏所有内容面板
                const magnetsContent = document.getElementById('magnets-content');
                const dualMagnetTabs = tabsContainer.querySelector('.javdb-dual-magnet-tabs');
                const magnetsDiv = document.getElementById('magnets');
                const javbusContainer = document.getElementById('javbus-magnet-container');
                [magnetsContent, dualMagnetTabs, magnetsDiv, javbusContainer, reviewPanel, relatedPanel, origReviews, origLists].forEach(el => {
                    if (el) el.style.display = 'none';
                });
                // 隐藏手动加载按钮
                const loadBtn = tabsContainer.querySelector('button');
                if (loadBtn) loadBtn.style.display = 'none';

                // 显示目标面板
                if (tabName === 'magnets') {
                    if (magnetsContent) magnetsContent.style.display = '';
                    if (dualMagnetTabs) dualMagnetTabs.style.display = '';
                    if (magnetsDiv) magnetsDiv.style.display = '';
                    if (javbusContainer) javbusContainer.style.display = '';
                    if (loadBtn) loadBtn.style.display = '';
                } else if (tabName === 'reviews') {
                    reviewPanel.style.display = 'block';
                    if (!reviewsLoaded) {
                        reviewsLoaded = true;
                        jbLoadReviews(reviewPanel, movieId);
                    }
                } else if (tabName === 'lists') {
                    relatedPanel.style.display = 'block';
                    if (!relatedLoaded) {
                        relatedLoaded = true;
                        jbLoadRelated(relatedPanel, movieId);
                    }
                }

                // 关键修复：延迟校验并强制纠正状态（防止其他 JS handler 覆盖我们的切换）
                forceVerifyState(tabName);
            }

            // 强制校验并纠正标签状态（延迟执行，确保在其他 handler 之后运行）
            // 使用 generation 计数器：只执行最新一次 switchTo 发出的校验，避免旧回调覆盖新切换状态
            let _verifyGen = 0;
            function forceVerifyState(expectedTab) {
                const gen = ++_verifyGen;
                const verify = () => {
                    // 只执行最新一次 switchTo 的校验，跳过旧回调
                    if (gen !== _verifyGen) return;

                    // 检查自定义标签栏的激活状态是否正确
                    const currentActive = newTabsBar.querySelector('li.is-active');
                    if (!currentActive || currentActive.dataset.jbTab !== expectedTab) {
                        console.log(`[JB] 状态被篡改，强制纠正: 期望=${expectedTab}, 实际=${currentActive?.dataset.jbTab}`);
                        allNewTabs.forEach(t => t.classList.remove('is-active'));
                        const correctTab = newTabsBar.querySelector(`[data-jb-tab="${expectedTab}"]`);
                        if (correctTab) correctTab.classList.add('is-active');
                    }

                    // 检查面板可见性是否正确
                    const magnetsDiv = document.getElementById('magnets');
                    if (expectedTab === 'magnets') {
                        if (magnetsDiv && magnetsDiv.style.display === 'none') magnetsDiv.style.display = '';
                        if (reviewPanel && reviewPanel.style.display !== 'none') reviewPanel.style.display = 'none';
                        if (relatedPanel && relatedPanel.style.display !== 'none') relatedPanel.style.display = 'none';
                    } else if (expectedTab === 'reviews') {
                        if (magnetsDiv && magnetsDiv.style.display !== 'none') magnetsDiv.style.display = 'none';
                        if (reviewPanel && reviewPanel.style.display !== 'block') reviewPanel.style.display = 'block';
                        if (relatedPanel && relatedPanel.style.display !== 'none') relatedPanel.style.display = 'none';
                    } else if (expectedTab === 'lists') {
                        if (magnetsDiv && magnetsDiv.style.display !== 'none') magnetsDiv.style.display = 'none';
                        if (reviewPanel && reviewPanel.style.display !== 'none') reviewPanel.style.display = 'none';
                        if (relatedPanel && relatedPanel.style.display !== 'block') relatedPanel.style.display = 'block';
                    }

                    // 隐藏原始残留面板
                    if (origReviews && origReviews.style.display !== 'none') origReviews.style.display = 'none';
                    if (origLists && origLists.style.display !== 'none') origLists.style.display = 'none';
                };

                // 多次延迟校验：10ms, 50ms, 150ms — 确保覆盖各种异步 handler 的时机
                setTimeout(verify, 10);
                setTimeout(verify, 50);
                setTimeout(verify, 150);
            }

            // ⑩ 给自定义标签绑定点击（capture 阶段 + span 冒泡兜底）
            allNewTabs.forEach(li => {
                li.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (li.classList.contains('is-active')) return; // 已经是激活标签，不重复切换
                    switchTo(li.dataset.jbTab);
                }, true);
                // span 兜底：防止某些浏览器/框架下 capture 不生效
                const span = li.querySelector('span');
                if (span) {
                    span.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (li.classList.contains('is-active')) return; // 已经是激活标签，不重复切换
                        switchTo(li.dataset.jbTab);
                    }, true);
                }
            });

            // ⑪ MutationObserver 监控：确保标签高亮 + 自定义标签栏始终可见 + Stimulus 属性不被恢复
            // 保护 is-active 类不被 JAVDB 原生 JS 移除
            function protectActiveTab() {
                const activeLi = newTabsBar.querySelector('li.is-active');
                if (!activeLi) {
                    // is-active 被完全清除了，恢复之
                    const correctLi = newTabsBar.querySelector(`[data-jb-tab="${currentTab}"]`);
                    if (correctLi) correctLi.classList.add('is-active');
                }
            }
            const observer = new MutationObserver(() => {
                protectActiveTab();
                if (newTabsBar.style.display === 'none') {
                    newTabsBar.style.display = '';
                }
                // 确保 Stimulus controller 属性不会被恢复
                if (movieTabContainer && movieTabContainer.hasAttribute('data-controller')) {
                    movieTabContainer.removeAttribute('data-controller');
                }
                // 确保原始残留面板始终隐藏
                if (origReviews && origReviews.style.display !== 'none') origReviews.style.display = 'none';
                if (origLists && origLists.style.display !== 'none') origLists.style.display = 'none';
            });
            // 监控自定义标签栏的所有属性变化（style + class + 子元素类变化）
            observer.observe(newTabsBar, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
            if (movieTabContainer) {
                observer.observe(movieTabContainer, { attributes: true, attributeFilter: ['data-controller'] });
            }
            // 监控原始残留面板的可见性
            if (origReviews) observer.observe(origReviews, { attributes: true, attributeFilter: ['style'] });
            if (origLists) observer.observe(origLists, { attributes: true, attributeFilter: ['style'] });

            console.log('%c[JB] 标签接管完成（Stimulus 已禁用 + 外部自定义标签栏）', 'color:#9b59b6;');
        }, 500);
    }

    // 加载评论 —— 照搬 JavdbBuddy：直接请求外部API，limit=20，底部"加载更多"
    async function jbLoadReviews(panel, movieId) {
        if (!panel) return;
        panel.innerHTML = '<div id="reviewsLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;">获取评论中...</div>';

        let dataList = null;
        try {
            dataList = await Promise.race([
                jbApi.getReviews(movieId, 1, 20),
                new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), 15000))
            ]);
        } catch (e) {
            console.error('获取评论失败:', e);
        } finally {
            const loading = panel.querySelector('#reviewsLoading');
            if (loading) loading.remove();
        }

        if (!dataList) {
            panel.innerHTML = `
                <div style="margin-top:15px;background-color:#ffffff;padding:10px;">
                    获取评论失败
                    <a id="retryFetchReviews" href="javascript:;" style="margin-left:10px;color:#1890ff;text-decoration:none;">重试</a>
                </div>
            `;
            const retryBtn = panel.querySelector('#retryFetchReviews');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    jbLoadReviews(panel, movieId);
                });
            }
            return;
        }
        if (dataList.length === 0) {
            panel.innerHTML = '<div style="margin-top:15px;background-color:#ffffff;padding:10px;">无评论</div>';
            return;
        }

        panel.innerHTML = '';
        let floorIndex = 1;
        jbDisplayReviews(dataList, panel, () => floorIndex++);

        // 更新标签上的短评数量
        const reviewTab = document.querySelector('#jb-custom-tabs li[data-jb-tab="reviews"] span');
        if (reviewTab) {
            const total = dataList.length < 20 ? dataList.length : dataList.length + '+';
            reviewTab.textContent = `短評(${total})`;
        }

        const reviewsFooter = document.createElement('div');
        reviewsFooter.id = 'jb-reviews-footer';
        panel.appendChild(reviewsFooter);

        if (dataList.length === 20) {
            reviewsFooter.innerHTML = `
                <button id="loadMoreReviews" style="width:100%;background-color:#e1f5fe;border:none;padding:10px;margin-top:10px;cursor:pointer;color:#0277bd;font-weight:bold;border-radius:4px;">
                    加载更多评论
                </button>
                <div id="reviewsEnd" style="display:none;text-align:center;padding:10px;color:#666;margin-top:10px;">已加载全部评论</div>
            `;
            let currentPage = 1;
            const loadMoreBtn = reviewsFooter.querySelector('#loadMoreReviews');
            loadMoreBtn.addEventListener('click', async () => {
                loadMoreBtn.textContent = '加载中...';
                loadMoreBtn.disabled = true;
                currentPage++;
                let moreData;
                try {
                    moreData = await jbApi.getReviews(movieId, currentPage, 20);
                } catch (e) {
                    console.error('加载更多评论失败:', e);
                } finally {
                    loadMoreBtn.textContent = '加载失败, 请点击重试';
                    loadMoreBtn.disabled = false;
                }
                if (moreData) {
                    jbDisplayReviews(moreData, panel, () => floorIndex++);
                    if (moreData.length < 20) {
                        loadMoreBtn.remove();
                        const endDiv = reviewsFooter.querySelector('#reviewsEnd');
                        if (endDiv) endDiv.style.display = '';
                    } else {
                        loadMoreBtn.textContent = '加载更多评论';
                        loadMoreBtn.disabled = false;
                    }
                }
            });
        } else {
            reviewsFooter.innerHTML = '<div style="text-align:center;padding:10px;color:#666;margin-top:10px;">已加载全部评论</div>';
        }
    }

    function jbDisplayReviews(dataList, container, getFloorIndex) {
        if (!dataList || !dataList.length) return;
        dataList.forEach(item => {
            const starsHtml = Array(item.score || 0).fill('<i class="icon-star"></i>').join('');
            const content = (item.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const dateStr = item.created_at ? new Date(item.created_at * 1000).toLocaleDateString('zh-CN') : '';
            const div = document.createElement('div');
            div.style.cssText = 'display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left:-10px;word-break:break-word;position:relative;';
            div.innerHTML = `
                <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${getFloorIndex()}楼</span>
                ${(item.username || '匿名').replace(/</g, '&lt;').replace(/>/g, '&gt;')} &nbsp;&nbsp;
                <span class="score-stars" style="color:#f59e0b;">${starsHtml}</span>
                <span style="color:#999;font-size:12px;">${dateStr}</span>
                &nbsp;&nbsp; 点赞:${item.likes_count || 0}
                <p style="margin-top:5px;">${content}</p>
            `;
            container.appendChild(div);
        });
    }

    // 加载相关清单 —— 照搬 JavdbBuddy：直接请求外部API，limit=20，底部"加载更多"
    async function jbLoadRelated(panel, movieId) {
        if (!panel) return;
        panel.innerHTML = '<div id="relatedLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;">获取清单中...</div>';

        let dataList = null;
        try {
            dataList = await Promise.race([
                jbApi.related(movieId, 1, 20),
                new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), 15000))
            ]);
        } catch (e) {
            console.error('获取清单失败:', e);
        } finally {
            const loading = panel.querySelector('#relatedLoading');
            if (loading) loading.remove();
        }

        if (!dataList) {
            panel.innerHTML = `
                <div style="margin-top:15px;background-color:#ffffff;padding:10px;">
                    获取清单失败
                    <a id="retryFetchRelateds" href="javascript:;" style="margin-left:10px;color:#1890ff;text-decoration:none;">重试</a>
                </div>
            `;
            const retryBtn = panel.querySelector('#retryFetchRelateds');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    jbLoadRelated(panel, movieId);
                });
            }
            return;
        }
        if (dataList.length === 0) {
            panel.innerHTML = '<div style="margin-top:15px;background-color:#ffffff;padding:10px;">无清单</div>';
            return;
        }

        panel.innerHTML = '';
        let floorIndex = 1;
        jbDisplayRelateds(dataList, panel, () => floorIndex++);

        const relatedFooter = document.createElement('div');
        relatedFooter.id = 'jb-related-footer';
        panel.appendChild(relatedFooter);

        if (dataList.length === 20) {
            relatedFooter.innerHTML = `
                <button id="loadMoreRelateds" style="width:100%;background-color:#e1f5fe;border:none;padding:10px;margin-top:10px;cursor:pointer;color:#0277bd;font-weight:bold;border-radius:4px;">
                    加载更多清单
                </button>
                <div id="relatedEnd" style="display:none;text-align:center;padding:10px;color:#666;margin-top:10px;">已加载全部清单</div>
            `;
            let currentPage = 1;
            const loadMoreBtn = relatedFooter.querySelector('#loadMoreRelateds');
            loadMoreBtn.addEventListener('click', async () => {
                loadMoreBtn.textContent = '加载中...';
                loadMoreBtn.disabled = true;
                currentPage++;
                let moreData;
                try {
                    moreData = await jbApi.related(movieId, currentPage, 20);
                } catch (e) {
                    console.error('加载更多清单失败:', e);
                } finally {
                    loadMoreBtn.textContent = '加载失败, 请点击重试';
                    loadMoreBtn.disabled = false;
                }
                if (moreData) {
                    jbDisplayRelateds(moreData, panel, () => floorIndex++);
                    if (moreData.length < 20) {
                        loadMoreBtn.remove();
                        const endDiv = relatedFooter.querySelector('#relatedEnd');
                        if (endDiv) endDiv.style.display = '';
                    } else {
                        loadMoreBtn.textContent = '加载更多清单';
                        loadMoreBtn.disabled = false;
                    }
                }
            });
        } else {
            relatedFooter.innerHTML = '<div style="text-align:center;padding:10px;color:#666;margin-top:10px;">已加载全部清单</div>';
        }
    }

    function jbDisplayRelateds(dataList, container, getFloorIndex) {
        if (!dataList || !dataList.length) return;
        dataList.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left:-10px;word-break:break-word;position:relative;';
            div.innerHTML = `
                <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${getFloorIndex()}</span>
                <span style="position:absolute;bottom:5px;right:10px;color:#999;font-size:12px;">创建时间: ${item.createTime || ''}</span>
                <p><a href="/lists/${item.relatedId}" target="_blank" style="color:#2e8abb">${(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a></p>
                <p style="margin-top:5px;">视频个数: ${item.movieCount || 0}</p>
                <p style="margin-top:5px;">收藏次数: ${item.collectionCount || 0} 被查看次数: ${item.viewCount || 0}</p>
            `;
            container.appendChild(div);
        });
    }

    // ========== [新增] 列表页链接在新窗口打开 ==========
    function applyListPageLinkTarget() {
        const enabled = GM_getValue('jb_open_in_new_tab', false);
        document.querySelectorAll('.grid-item > a[href^="/v/"], .movie-list .item > a[href^="/v/"]').forEach(link => {
            if (enabled) {
                link.setAttribute('target', '_blank');
            } else {
                link.removeAttribute('target');
            }
        });
    }
    window.jbApplyListPageLinkTargetFn = applyListPageLinkTarget;

    // ========== [新增] 所有链接在新窗口打开 ==========
    function applyAllLinksTarget() {
        const enabled = GM_getValue('jb_open_all_links_in_new_tab', true);
        document.querySelectorAll('a[href]:not([target]):not([href^="javascript:"]):not([href^="#"])').forEach(link => {
            if (enabled) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            } else {
                link.removeAttribute('target');
                link.removeAttribute('rel');
            }
        });
    }
    window.jbApplyAllLinksTargetFn = applyAllLinksTarget;

    // ========== [新增] 弹窗方式打开详情页 ==========
    function showPopupModal(url) {
        if (document.getElementById('jb-popup-overlay')) {
            document.getElementById('jb-popup-overlay').remove();
        }
        const overlay = document.createElement('div');
        overlay.id = 'jb-popup-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);';
        overlay.innerHTML = `
            <div style="background:white;width:90%;height:90%;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                <div style="padding:10px 15px;background:#f8f9fa;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                    <span style="font-weight:bold;font-size:14px;color:#333;">详情页弹窗</span>
                    <span id="jb-popup-close" style="cursor:pointer;font-size:24px;color:#999;line-height:1;">&times;</span>
                </div>
                <div style="flex:1;position:relative;overflow:hidden;">
                    <iframe src="${url}" style="width:100%;height:100%;border:none;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.querySelector('#jb-popup-close').onclick = () => overlay.remove();
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    function applyListPagePopup() {
        const enabled = GM_getValue('jb_open_in_popup', false);
        document.querySelectorAll('.grid-item > a[href^="/v/"], .movie-list .item > a[href^="/v/"]').forEach(link => {
            if (link.dataset.jbPopupBound) return;
            link.dataset.jbPopupBound = '1';
            link.addEventListener('click', function popupHandler(e) {
                if (GM_getValue('jb_open_in_popup', false)) {
                    e.preventDefault();
                    e.stopPropagation();
                    showPopupModal(link.href);
                }
            });
        });
    }
    window.jbApplyListPagePopupFn = applyListPagePopup;

    // ========== [新增] 悬浮封面放大 ==========
    function initHoverZoom() {
        if (!GM_getValue('jb_enable_hover_zoom', false)) return;
        if (document.getElementById('jb-hover-zoom-el')) return;

        const zoomImg = document.createElement('img');
        zoomImg.id = 'jb-hover-zoom-el';
        zoomImg.className = 'jb-hover-zoom-img';
        document.body.appendChild(zoomImg);

        let currentSrc = '';

        document.addEventListener('mouseover', (e) => {
            const cover = e.target.closest('.grid-item .cover img, .grid-item .cover-image img, .grid-item img[src*="/covers/"], .movie-list .item .cover img, .movie-list .item .cover-image img, .movie-list .item img[src*="/covers/"]');
            if (!cover) {
                // 鼠标移到非封面图区域时隐藏放大图
                if (currentSrc) {
                    currentSrc = '';
                    zoomImg.classList.remove('visible');
                }
                return;
            }
            let src = cover.getAttribute('data-src') || cover.getAttribute('src') || '';
            if (!src) return;
            // 尝试获取高清图：去掉缩略图后缀和尺寸参数
            src = src.replace(/_s(\.[^.]+)$/, '$1').replace(/\?w=\d+&h=\d+/, '').replace(/\?width=\d+&height=\d+/, '');
            currentSrc = src;
            zoomImg.src = src;
            zoomImg.classList.add('visible');
        });

        document.addEventListener('mousemove', (e) => {
            if (!currentSrc) return;
            // 检查鼠标当前位置是否仍在封面图上，防止封面图之间的空隙导致放大图不消失
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const stillOnCover = el && el.closest('.grid-item .cover img, .grid-item .cover-image img, .grid-item img[src*="/covers/"], .movie-list .item .cover img, .movie-list .item .cover-image img, .movie-list .item img[src*="/covers/"]');
            if (!stillOnCover) {
                currentSrc = '';
                zoomImg.classList.remove('visible');
                return;
            }
            // 获取图片实际渲染尺寸（考虑 CSS max-width/max-height 和 scale）
            const imgW = zoomImg.offsetWidth || 650;
            const imgH = zoomImg.offsetHeight || 930;
            const margin = 15;
            let x = e.clientX + 20;
            let y = e.clientY + 20;
            // 如果右侧超出浏览器边界，显示在鼠标左侧
            if (x + imgW + margin > window.innerWidth) {
                x = e.clientX - imgW - 20;
            }
            // 如果底部超出浏览器边界，显示在鼠标上方
            if (y + imgH + margin > window.innerHeight) {
                y = e.clientY - imgH - 20;
            }
            // 确保不超出左边界和上边界
            x = Math.max(margin, x);
            y = Math.max(margin, y);
            // 再次检查右下边界（窗口缩小时）
            x = Math.min(x, window.innerWidth - imgW - margin);
            y = Math.min(y, window.innerHeight - imgH - margin);
            zoomImg.style.left = x + 'px';
            zoomImg.style.top = y + 'px';
        });

        document.addEventListener('mouseout', (e) => {
            const cover = e.target.closest('.grid-item .cover img, .grid-item .cover-image img, .grid-item img[src*="/covers/"], .movie-list .item .cover img, .movie-list .item .cover-image img, .movie-list .item img[src*="/covers/"]');
            if (!cover) return;
            currentSrc = '';
            zoomImg.classList.remove('visible');
        });
    }

    // ========== [新增] WebDAV 备份与恢复 ==========
    function prepareWebDAVUrl(rawUrl) {
        let url = rawUrl.replace(/\/$/, '');
        if (!url) return url;
        // 对中文路径进行编码（保留 : / 等保留字符）
        url = encodeURI(url);
        // Alist 智能修正：默认端口5244且路径缺少 /dav/ 时自动补全
        if (url.includes(':5244') && !url.includes('/dav/')) {
            url = url.replace(/(:\/\/[^/]+)(\/|$)/, '$1/dav$2');
        }
        return url;
    }

    async function testWebDAVConnection() {
        const rawUrl = GM_getValue('jb_webdav_url', '');
        const user = GM_getValue('jb_webdav_user', '');
        const pass = GM_getValue('jb_webdav_pass', '');
        if (!rawUrl || !user) return { success: false, message: '配置不完整' };

        const url = prepareWebDAVUrl(rawUrl);
        const auth = btoa(user + ':' + pass);

        // 先尝试 PROPFIND（WebDAV 标准检测目录方法）
        try {
            await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'PROPFIND',
                    url: url + '/',
                    headers: {
                        'Authorization': 'Basic ' + auth,
                        'Depth': '0'
                    },
                    timeout: 10000,
                    onload: (resp) => {
                        if (resp.status === 207 || (resp.status >= 200 && resp.status < 300)) resolve();
                        else reject(new Error('HTTP ' + resp.status));
                    },
                    onerror: () => reject(new Error('请求失败')),
                    ontimeout: () => reject(new Error('超时'))
                });
            });
            return { success: true, message: '连接成功' };
        } catch (e) {
            // PROPFIND 不支持（如部分 Alist），fallback 到 GET 备份文件（200/404 都算通）
            try {
                await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url + '/javdb-buddy-backup.json',
                        headers: {
                            'Authorization': 'Basic ' + auth
                        },
                        timeout: 10000,
                        onload: (resp) => {
                            if (resp.status === 200 || resp.status === 404) resolve();
                            else reject(new Error('HTTP ' + resp.status));
                        },
                        onerror: () => reject(new Error('请求失败')),
                        ontimeout: () => reject(new Error('超时'))
                    });
                });
                return { success: true, message: '连接成功' };
            } catch (e2) {
                console.error('[JBD] WebDAV 测试连接失败:', e2, '请求URL:', url + '/');
                return { success: false, message: e2.message || '未知错误' };
            }
        }
    }

    async function backupToWebDAV() {
        const rawUrl = GM_getValue('jb_webdav_url', '');
        const user = GM_getValue('jb_webdav_user', '');
        const pass = GM_getValue('jb_webdav_pass', '');
        if (!rawUrl || !user) return { success: false, message: '配置不完整' };

        const url = prepareWebDAVUrl(rawUrl);
        const config = {
            servers: getServers(),
            libraryIndex: LIBRARY_INDEX,
            jellyfinLibraryIndex: JELLYFIN_LIBRARY_INDEX,
            lastSyncTime: LAST_SYNC_TIME,
            jellyfinLastSyncTime: JELLYFIN_LAST_SYNC_TIME,
            backupTime: new Date().toISOString()
        };
        const json = JSON.stringify(config, null, 2);
        const auth = btoa(user + ':' + pass);

        try {
            await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'PUT',
                    url: url + '/javdb-buddy-backup.json',
                    headers: {
                        'Authorization': 'Basic ' + auth,
                        'Content-Type': 'application/octet-stream'
                    },
                    data: json,
                    timeout: 20000,
                    onload: (resp) => {
                        if (resp.status >= 200 && resp.status < 300) resolve();
                        else reject(new Error('HTTP ' + resp.status + ' | URL: ' + url + '/javdb-buddy-backup.json'));
                    },
                    onerror: (err) => reject(new Error('请求失败: ' + (err && err.error ? err.error : '未知错误'))),
                    ontimeout: () => reject(new Error('超时'))
                });
            });
            return { success: true, message: '备份成功' };
        } catch (e) {
            console.error('[JBD] WebDAV 备份失败:', e, '请求URL:', url + '/javdb-buddy-backup.json');
            let msg = e.message || '未知错误';
            if (msg.includes('405')) {
                msg += '（Alist 用户请检查地址是否包含 /dav/ 路径）';
            }
            return { success: false, message: msg };
        }
    }

    async function restoreFromWebDAV() {
        const rawUrl = GM_getValue('jb_webdav_url', '');
        const user = GM_getValue('jb_webdav_user', '');
        const pass = GM_getValue('jb_webdav_pass', '');
        if (!rawUrl || !user) return { success: false, message: '配置不完整' };

        const url = prepareWebDAVUrl(rawUrl);
        const auth = btoa(user + ':' + pass);
        try {
            const text = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url + '/javdb-buddy-backup.json',
                    headers: {
                        'Authorization': 'Basic ' + auth
                    },
                    timeout: 20000,
                    onload: (resp) => {
                        if (resp.status >= 200 && resp.status < 300) resolve(resp.responseText);
                        else reject(new Error('HTTP ' + resp.status));
                    },
                    onerror: () => reject(new Error('请求失败')),
                    ontimeout: () => reject(new Error('超时'))
                });
            });
            const config = JSON.parse(text);
            if (config.servers) {
                GM_setValue('emby_servers', JSON.stringify(config.servers));
            }
            if (config.libraryIndex) {
                GM_setValue('emby_library_index', JSON.stringify(config.libraryIndex));
                LIBRARY_INDEX = config.libraryIndex;
            }
            if (config.jellyfinLibraryIndex) {
                GM_setValue('jellyfin_library_index', JSON.stringify(config.jellyfinLibraryIndex));
                JELLYFIN_LIBRARY_INDEX = config.jellyfinLibraryIndex;
            }
            if (config.lastSyncTime) {
                GM_setValue('emby_last_sync', config.lastSyncTime);
                LAST_SYNC_TIME = config.lastSyncTime;
            }
            if (config.jellyfinLastSyncTime) {
                GM_setValue('jellyfin_last_sync', config.jellyfinLastSyncTime);
                JELLYFIN_LAST_SYNC_TIME = config.jellyfinLastSyncTime;
            }
            return { success: true, message: '恢复成功' };
        } catch (e) {
            console.error('[JBD] WebDAV 恢复失败:', e, '请求URL:', url + '/javdb-buddy-backup.json');
            let msg = e.message || '未知错误';
            if (msg.includes('405')) {
                msg += '（Alist 用户请检查地址是否包含 /dav/ 路径）';
            }
            return { success: false, message: msg };
        }
    }

    // 将设置对话框暴露到全局，供 initMainScript 外部访问
    window.showSettingsDialog = showSettingsDialog;

    // ========== [新增] 打赏弹窗 ==========
    function showDonateDialog() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999999;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:white;padding:25px;border-radius:8px;max-width:520px;width:90%;text-align:center;font-family:sans-serif;">
                <h3 style="margin:0 0 10px 0;color:#333;">💖 感谢支持</h3>
                <p style="margin:0 0 15px 0;color:#666;font-size:13px;">如果觉得脚本好用，欢迎打赏一杯咖啡 ☕</p>
                <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
                    <div>
                        <img src="https://raw.githubusercontent.com/86168057/JavdbBuddy/main/%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81/%E5%BE%AE%E4%BF%A1%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81.png" style="width:200px;height:200px;object-fit:contain;border:1px solid #eee;border-radius:4px;" alt="微信">
                        <p style="margin:5px 0 0 0;color:#666;font-size:12px;">微信</p>
                    </div>
                    <div>
                        <img src="https://raw.githubusercontent.com/86168057/JavdbBuddy/main/%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81/%E6%94%AF%E4%BB%98%E5%AE%9D%E6%94%B6%E6%AC%BE%E4%BA%8C%E7%BB%B4%E7%A0%81.png" style="width:200px;height:200px;object-fit:contain;border:1px solid #eee;border-radius:4px;" alt="支付宝">
                        <p style="margin:5px 0 0 0;color:#666;font-size:12px;">支付宝</p>
                    </div>
                </div>
                <div style="margin-top:20px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
                    <a href="https://greasyfork.org/scripts?q=JavdbBuddy" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;color:#333;text-decoration:none;font-size:13px;transition:all 0.2s;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                        <span>油猴脚本</span>
                    </a>
                    <a href="https://github.com/86168057/JavdbBuddy" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;color:#333;text-decoration:none;font-size:13px;transition:all 0.2s;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"></path></svg>
                        <span>GitHub 仓库</span>
                    </a>
                </div>
                <button id="jb-donate-close" style="margin-top:20px;background:#666;color:white;border:none;padding:8px 30px;border-radius:4px;cursor:pointer;">关闭</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        document.getElementById('jb-donate-close')?.addEventListener('click', () => overlay.remove());
    }

    // 延迟启动增强功能
    // 缩短启动延迟，配合 setInterval 轮询即可在 DOM 就绪后尽快创建自定义标签
    // 同时临时禁用原始标签点击（仅限制无 id 的 .tabs.no-bottom，不影响自定义标签）
    (document.head || document.documentElement).appendChild(Object.assign(document.createElement('style'), {
        textContent: '.tabs.no-bottom:not(#jb-custom-tabs) { pointer-events: none; }'
    }));
    const isSpecialPage2 = window.location.search.includes('laosiji_rank=') || window.location.search.includes('type=3');
    setTimeout(jbInit, isSpecialPage2 ? 100 : 100);

        window.__jb_init_done = true;
        console.log('[JB] initMainScript 执行完成');
    } catch (initErr) {
        console.error('[JB] initMainScript 执行出错:', initErr);
        // 不设置 __jb_init_done，允许下次重试
    }
    } // initMainScript 函数结束

})();
