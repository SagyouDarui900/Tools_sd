import { showToast, escapeHtml } from '../core/utils.js';

        function initYtThumbTool() {
            const inputEl = document.getElementById('ytThumbInput');
            const extractBtn = document.getElementById('ytThumbExtractBtn');
            const sampleBtn = document.getElementById('ytThumbSampleBtn');
            const clearBtn = document.getElementById('ytThumbClearBtn');
            const countBadge = document.getElementById('ytThumbCountBadge');
            const zipAllBtn = document.getElementById('ytThumbZipAllBtn');
            const resultsContainer = document.getElementById('ytThumbResultsContainer');

            if (!inputEl || !resultsContainer) return;

            let currentVideosData = [];

            // Extract Video IDs from text
            function extractYouTubeIds(text) {
                if (!text) return [];
                const lines = text.split(/[\r\n\s,]+/);
                const ids = [];
                const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                
                lines.forEach(line => {
                    const str = line.trim();
                    if (!str) return;
                    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
                        if (!ids.includes(str)) ids.push(str);
                    } else {
                        const match = str.match(regExp);
                        if (match && match[1] && !ids.includes(match[1])) {
                            ids.push(match[1]);
                        }
                    }
                });
                return ids;
            }

            // Fetch oEmbed title
            async function fetchVideoTitle(videoId) {
                try {
                    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                    if (res.ok) {
                        const data = await res.json();
                        return { title: data.title, author: data.author_name };
                    }
                } catch(e) {}
                return { title: `YouTube Video (${videoId})`, author: '' };
            }

            // Check image availability (e.g. maxresdefault dummy 120x90 check)
            function checkImageDimensions(url) {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, valid: (img.naturalWidth || img.width) > 120 });
                    };
                    img.onerror = () => {
                        resolve({ width: 0, height: 0, valid: false });
                    };
                    img.src = url;
                });
            }

            // Main extraction process
            async function runExtraction(userTriggered = false) {
                const rawText = inputEl.value.trim();
                const videoIds = extractYouTubeIds(rawText);

                resultsContainer.innerHTML = '';
                currentVideosData = [];

                if (videoIds.length === 0) {
                    if (countBadge) countBadge.textContent = '';
                    if (zipAllBtn) zipAllBtn.disabled = true;
                    if (userTriggered) showToast('有効なYouTube URLまたは動画IDが見つかりませんでした');
                    resultsContainer.innerHTML = `
                        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); background-color: var(--bg-panel-secondary); border-radius: 4px; border: 1px dashed var(--border-color);">
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-heading);">URLを入力してサムネイルを取得</div>
                            <div style="font-size: 11.5px; margin-top: 4px;">YouTubeの動画URL、Shorts、または動画IDを上に貼り付けてください</div>
                        </div>
                    `;
                    return;
                }

                if (countBadge) countBadge.textContent = `${videoIds.length}件の動画を解析中...`;

                for (let i = 0; i < videoIds.length; i++) {
                    const id = videoIds[i];
                    
                    // URLs
                    const maxresJpg = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
                    const sdJpg = `https://img.youtube.com/vi/${id}/sddefault.jpg`;
                    const hqJpg = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
                    const mqJpg = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

                    const maxresWebp = `https://i.ytimg.com/vi_webp/${id}/maxresdefault.webp`;
                    const hqWebp = `https://i.ytimg.com/vi_webp/${id}/hqdefault.webp`;

                    // Title & maxres check in parallel
                    const [meta, maxresCheck, sdCheck, hqCheck] = await Promise.all([
                        fetchVideoTitle(id),
                        checkImageDimensions(maxresJpg),
                        checkImageDimensions(sdJpg),
                        checkImageDimensions(hqJpg)
                    ]);

                    const bestJpg = maxresCheck.valid ? maxresJpg : (sdCheck.valid ? sdJpg : hqJpg);
                    const bestWebp = maxresCheck.valid ? maxresWebp : hqWebp;
                    const bestResolutionLabel = maxresCheck.valid ? `最高画質 (1920x1080)` : (sdCheck.valid ? `高画質 (640x480)` : `標準 (480x360)`);

                    const videoItem = {
                        id,
                        title: meta.title,
                        author: meta.author,
                        hasMaxRes: maxresCheck.valid,
                        bestJpg,
                        bestWebp,
                        maxresCheck,
                        sdCheck,
                        hqCheck,
                        maxresJpg,
                        sdJpg,
                        hqJpg,
                        mqJpg,
                        maxresWebp,
                        hqWebp
                    };

                    currentVideosData.push(videoItem);

                    renderVideoCard(videoItem);
                }

                if (countBadge) countBadge.textContent = `${videoIds.length}件の動画からサムネイルを取得しました`;
                if (zipAllBtn) zipAllBtn.disabled = false;
                if (userTriggered) showToast(`${videoIds.length}件のサムネイル画像を取得しました`);
            }

            // Render single video card UI
            function renderVideoCard(item) {
                const card = document.createElement('div');
                card.className = 'panel';
                card.style.backgroundColor = 'var(--bg-panel)';
                card.style.border = '1px solid var(--border-color)';
                card.style.borderRadius = '6px';
                card.style.padding = '14px';

                const defaultJpg = item.bestJpg;

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 240px;">
                            <div style="font-weight: 700; font-size: 14px; color: var(--text-heading); line-height: 1.4; margin-bottom: 4px;">
                                ${escapeHtml(item.title)}
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 10px;">
                                <span>${item.author ? '投稿者: ' + escapeHtml(item.author) : ''}</span>
                                <span>ID: <code style="color: var(--accent-primary); font-weight: 600;">${item.id}</code></span>
                            </div>
                        </div>
                        <a href="https://www.youtube.com/watch?v=${item.id}" target="_blank" class="btn" style="padding: 4px 10px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
                            YouTubeで動画を開く ↗
                        </a>
                    </div>

                    <div style="display: grid; grid-template-columns: minmax(280px, 1fr) 280px; gap: 16px;" class="yt-card-grid">
                        <!-- Left: Main Preview -->
                        <div>
                            <div style="position: relative; background-color: #000; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); text-align: center;">
                                <img id="previewImg_${item.id}" src="${defaultJpg}" style="max-width: 100%; max-height: 380px; object-fit: contain; vertical-align: middle;" alt="YouTube Thumbnail">
                                <span id="resBadge_${item.id}" style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: 600;">
                                    ${item.hasMaxRes ? '1080p (最高画質)' : '480p (標準)'}
                                </span>
                            </div>
                            <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
                                <button class="btn btn-primary btn-dl-jpg" style="padding: 5px 8px; font-size: 11.5px; flex: 1; min-width: 65px;">
                                    JPG保存
                                </button>
                                <button class="btn btn-dl-png" style="padding: 5px 8px; font-size: 11.5px; background-color: var(--accent-green); color: #fff; flex: 1; min-width: 65px;">
                                    PNG保存
                                </button>
                                <button class="btn btn-dl-webp" style="padding: 5px 8px; font-size: 11.5px; background-color: var(--accent-purple); color: #fff; flex: 1; min-width: 65px;">
                                    WebP保存
                                </button>
                                <button class="btn btn-copy-img" style="padding: 5px 8px; font-size: 11.5px; min-width: 50px;" title="画像をクリップボードにコピー">
                                    コピー
                                </button>
                            </div>
                        </div>

                        <!-- Right: Quality Selector Buttons -->
                        <div style="display: flex; flex-direction: column; gap: 8px; background-color: var(--bg-panel-secondary); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color);">
                            <div style="font-weight: 700; font-size: 11.5px; color: var(--text-heading); margin-bottom: 2px;">解像度・画質選択</div>

                            <button class="btn q-btn ${item.hasMaxRes ? 'active' : ''}" data-url="${item.maxresJpg}" data-webp="${item.maxresWebp}" data-label="最高画質 (1080p)" data-valid="${item.hasMaxRes}" style="text-align: left; padding: 8px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600;">最高画質 (MaxRes / 1080p)</div>
                                    <div style="font-size: 10px; color: var(--text-muted);">1920 × 1080 px</div>
                                </div>
                                <span class="badge" style="font-size: 10px; ${item.hasMaxRes ? 'background-color: rgba(34,197,94,0.15); color: #22c55e;' : 'opacity: 0.5;'}">
                                    ${item.hasMaxRes ? '利用可能' : '非対応'}
                                </span>
                            </button>

                            <button class="btn q-btn ${!item.hasMaxRes && item.sdCheck.valid ? 'active' : ''}" data-url="${item.sdJpg}" data-webp="${item.sdJpg}" data-label="高画質 (720p/SD)" data-valid="${item.sdCheck.valid}" style="text-align: left; padding: 8px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600;">高画質 (SD / 720p)</div>
                                    <div style="font-size: 10px; color: var(--text-muted);">640 × 480 px</div>
                                </div>
                                <span class="badge" style="font-size: 10px;">${item.sdCheck.valid ? '640px' : '標準'}</span>
                            </button>

                            <button class="btn q-btn ${!item.hasMaxRes && !item.sdCheck.valid ? 'active' : ''}" data-url="${item.hqJpg}" data-webp="${item.hqWebp}" data-label="中画質 (HQ)" data-valid="true" style="text-align: left; padding: 8px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600;">中画質 (HQ)</div>
                                    <div style="font-size: 10px; color: var(--text-muted);">480 × 360 px</div>
                                </div>
                                <span class="badge" style="font-size: 10px;">標準</span>
                            </button>

                            <button class="btn q-btn" data-url="${item.mqJpg}" data-webp="${item.mqJpg}" data-label="標準画質 (MQ)" data-valid="true" style="text-align: left; padding: 8px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 600;">小サイズ (MQ)</div>
                                    <div style="font-size: 10px; color: var(--text-muted);">320 × 180 px</div>
                                </div>
                                <span class="badge" style="font-size: 10px;">軽量</span>
                            </button>
                        </div>
                    </div>
                `;

                resultsContainer.appendChild(card);

                // Event Listeners for this card
                let selectedJpgUrl = defaultJpg;
                let selectedWebpUrl = item.bestWebp;
                let currentLabel = item.hasMaxRes ? '1080p' : 'HQ';

                const mainImg = card.querySelector(`#previewImg_${item.id}`);
                const resBadge = card.querySelector(`#resBadge_${item.id}`);

                // Quality switch buttons
                const qBtns = card.querySelectorAll('.q-btn');
                qBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const url = btn.getAttribute('data-url');
                        const webp = btn.getAttribute('data-webp');
                        const label = btn.getAttribute('data-label');
                        
                        selectedJpgUrl = url;
                        selectedWebpUrl = webp;
                        currentLabel = label;

                        if (mainImg) mainImg.src = url;
                        if (resBadge) resBadge.textContent = label;

                        qBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                });

                // Download JPG
                card.querySelector('.btn-dl-jpg').addEventListener('click', () => {
                    downloadCanvasImage(selectedJpgUrl, `yt_thumb_${item.id}.jpg`, 'image/jpeg');
                });

                // Download PNG
                card.querySelector('.btn-dl-png').addEventListener('click', () => {
                    downloadCanvasImage(selectedJpgUrl, `yt_thumb_${item.id}.png`, 'image/png');
                });

                // Download WebP
                card.querySelector('.btn-dl-webp').addEventListener('click', () => {
                    downloadCanvasImage(selectedWebpUrl || selectedJpgUrl, `yt_thumb_${item.id}.webp`, 'image/webp');
                });

                // Copy Image
                card.querySelector('.btn-copy-img').addEventListener('click', () => {
                    copyImageToClipboard(selectedJpgUrl);
                });
            }

            // Convert Blob to specific Image MIME Type (e.g. image/png)
            async function convertBlobToFormat(blob, targetMimeType = 'image/png') {
                if (!blob) return null;
                if (blob.type === targetMimeType) return blob;
                return new Promise((resolve) => {
                    const img = new Image();
                    const blobUrl = URL.createObjectURL(blob);
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            canvas.toBlob((converted) => {
                                URL.revokeObjectURL(blobUrl);
                                resolve(converted || blob);
                            }, targetMimeType, 0.95);
                        } catch (e) {
                            URL.revokeObjectURL(blobUrl);
                            resolve(blob);
                        }
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        resolve(blob);
                    };
                    img.src = blobUrl;
                });
            }

            // Canvas / Proxy download helper with format conversion (JPG, PNG, WebP)
            async function downloadCanvasImage(url, filename, format = 'image/jpeg') {
                try {
                    let blob = await fetchImageAsBlob(url);
                    if (blob) {
                        if (format !== blob.type) {
                            blob = await convertBlobToFormat(blob, format);
                        }
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = filename;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                        showToast(`${filename} を保存しました`);
                        return;
                    }
                } catch(e) {}

                // Direct fallback
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.target = '_blank';
                a.click();
            }

            // Copy Image to Clipboard as PNG
            async function copyImageToClipboard(url) {
                try {
                    const blob = await fetchImageAsBlob(url);
                    if (blob && navigator.clipboard && window.ClipboardItem) {
                        const pngBlob = await convertBlobToFormat(blob, 'image/png');
                        if (pngBlob) {
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                            showToast('サムネイル画像をクリップボードにコピーしました');
                            return;
                        }
                    }
                } catch(e) {}
                showToast('クリップボードへの画像コピーに失敗しました');
            }

            // ZIP All Best Thumbnails (supports PNG, JPG, WebP)
            if (zipAllBtn) {
                zipAllBtn.addEventListener('click', async () => {
                    if (!currentVideosData.length) return;
                    if (!window.JSZip) {
                        showToast('ZIPライブラリが読み込まれていません');
                        return;
                    }

                    const zipFormatSelect = document.getElementById('ytThumbZipFormat');
                    const targetExt = zipFormatSelect ? zipFormatSelect.value : 'png';
                    const targetMime = targetExt === 'png' ? 'image/png' : (targetExt === 'webp' ? 'image/webp' : 'image/jpeg');

                    showToast(`サムネイル一括ZIP (${targetExt.toUpperCase()}) を生成中...`);
                    const zip = new JSZip();

                    for (let i = 0; i < currentVideosData.length; i++) {
                        const item = currentVideosData[i];
                        const imgUrl = targetExt === 'webp' ? (item.bestWebp || item.bestJpg) : item.bestJpg;
                        try {
                            let blob = await fetchImageAsBlob(imgUrl);
                            if (blob) {
                                if (blob.type !== targetMime) {
                                    blob = await convertBlobToFormat(blob, targetMime);
                                }
                                const cleanTitle = (item.title || item.id).replace(/[\\/:*?"<>|]/g, '_').substring(0, 40);
                                zip.file(`${i + 1}_${cleanTitle}_${item.id}.${targetExt}`, blob);
                            }
                        } catch(e) {}
                    }

                    const zipContent = await zip.generateAsync({ type: 'blob' });
                    const zipUrl = URL.createObjectURL(zipContent);
                    const a = document.createElement('a');
                    a.href = zipUrl;
                    a.download = `youtube_thumbnails_${targetExt}_${Date.now()}.zip`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(zipUrl), 1500);
                    showToast(`ZIPアーカイブ (${targetExt.toUpperCase()}) をダウンロードしました`);
                });
            }

            async function fetchImageAsBlob(url) {
                // 1. Try direct CORS fetch first (works on GitHub Pages without server proxy)
                try {
                    const directRes = await fetch(url, { mode: 'cors' });
                    if (directRes.ok) {
                        return await directRes.blob();
                    }
                } catch(e) {}

                // 2. Fallback to server proxy when running with Express backend
                const isStaticOnlyHost = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
                if (!isStaticOnlyHost) {
                    try {
                        const proxyRes = await fetch('/api/proxy-image?url=' + encodeURIComponent(url));
                        if (proxyRes.ok) {
                            return await proxyRes.blob();
                        }
                    } catch(e) {}
                }

                // 3. Fallback to image element + canvas
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
                        } catch(err) {
                            resolve(null);
                        }
                    };
                    img.onerror = () => resolve(null);
                    img.src = url;
                });
            }

            // Extract Button Click
            if (extractBtn) {
                extractBtn.addEventListener('click', () => runExtraction(true));
            }

            // Sample Button Click
            if (sampleBtn) {
                sampleBtn.addEventListener('click', () => {
                    inputEl.value = [
                        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        'https://youtu.be/L_LUpnjgPso',
                        'https://www.youtube.com/shorts/5qap5aO4i9A'
                    ].join('\n');
                    runExtraction(true);
                });
            }

            // Clear Button
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    inputEl.value = '';
                    resultsContainer.innerHTML = '';
                    if (countBadge) countBadge.textContent = '';
                    if (zipAllBtn) zipAllBtn.disabled = true;
                });
            }

            // Real-time input listener (debounced)
            let debounceTimer = null;
            inputEl.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (inputEl.value.trim()) {
                        runExtraction(false);
                    }
                }, 400);
            });

            // Run initial empty prompt
            runExtraction(false);
        }

        // Initialize this tool safely (previously via initNewTools in app.js)
        try {
            initYtThumbTool();
        } catch (e) {
            console.warn('Tool initialization skipped due to error:', e);
        }
