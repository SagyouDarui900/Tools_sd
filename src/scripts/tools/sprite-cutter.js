import { showToast, setupDropZone, colorDistance } from '../core/utils.js';

        (function() {
            const drop = document.getElementById('spriteDropZone');
            const input = document.getElementById('spriteFileInput');
            const bgMode = document.getElementById('spriteBgMode');
            const bgColorGroup = document.getElementById('spriteBgColorGroup');
            const bgColorPicker = document.getElementById('spriteBgColorPicker');
            const bgColorText = document.getElementById('spriteBgColorText');
            const bgPipetteBtn = document.getElementById('spriteBgPipetteBtn');
            const bgTolInput = document.getElementById('spriteBgTol');
            const dragModeSelect = document.getElementById('spriteDragMode');
            const fitPaddingInput = document.getElementById('spriteFitPadding');
            const wrapper = document.getElementById('spriteCanvasWrapper');
            const imgCanvas = document.getElementById('spriteImgCanvas');
            const overlayCanvas = document.getElementById('spriteOverlayCanvas');
            const ctxImg = imgCanvas.getContext('2d', { willReadFrequently: true });
            const ctxOverlay = overlayCanvas.getContext('2d');
            const listContainer = document.getElementById('spriteListContainer');
            const countBadge = document.getElementById('spriteCountBadge');
            const clearAllBtn = document.getElementById('spriteClearAllBtn');
            const sortOrderBtn = document.getElementById('spriteSortOrderBtn');
            const reverseBtn = document.getElementById('spriteReverseBtn');
            const filenameInput = document.getElementById('spriteFilename');
            const exportBtn = document.getElementById('spriteExportBtn');

            // Animation Preview Controls
            const animCanvas = document.getElementById('spriteAnimCanvas');
            const animCtx = animCanvas ? animCanvas.getContext('2d') : null;
            const animPlayBtn = document.getElementById('spriteAnimPlayBtn');
            const animFpsInput = document.getElementById('spriteAnimFps');
            const animFrameText = document.getElementById('spriteAnimFrameText');
            const animPrevBtn = document.getElementById('spriteAnimPrevBtn');
            const animNextBtn = document.getElementById('spriteAnimNextBtn');

            // Zoom & Maximize Controls
            const viewSection = document.getElementById('view-sprite-cutter');
            const maximizeBtn = document.getElementById('spriteMaximizeBtn');
            const maximizeIcon = document.getElementById('spriteMaximizeIcon');
            const maximizeText = document.getElementById('spriteMaximizeText');
            const zoomSelect = document.getElementById('spriteZoomSelect');
            const zoomInBtn = document.getElementById('spriteZoomInBtn');
            const zoomOutBtn = document.getElementById('spriteZoomOutBtn');
            const zoom100Btn = document.getElementById('spriteZoom100Btn');
            const zoomFitBtn = document.getElementById('spriteZoomFitBtn');
            const resolutionBadge = document.getElementById('spriteResolutionBadge');
            const canvasContainer = document.getElementById('spriteCanvasContainer');

            let currentImg = null;
            let sprites = []; // { id, rect: {x,y,w,h} }
            let history = [];
            let currentId = 0;
            let isDragging = false;
            let startX = 0, startY = 0, currentX = 0, currentY = 0;
            let isPipette = false;

            // Zoom & Fullscreen State
            let currentZoom = 1.0;
            let isMaximized = false;

            // Animation State
            let isPlayingAnim = false;
            let animCurrentFrame = 0;
            let animTimer = null;

            // Drag-and-drop reorder state
            let dragSourceIndex = null;

            function applyZoom(zoom, centerScroll = false) {
                if (!currentImg) {
                    currentZoom = zoom;
                    if (zoomSelect) zoomSelect.value = zoom.toString();
                    return;
                }

                currentZoom = Math.max(0.1, Math.min(16.0, zoom));

                if (wrapper) {
                    wrapper.style.width = Math.round(imgCanvas.width * currentZoom) + 'px';
                    wrapper.style.height = Math.round(imgCanvas.height * currentZoom) + 'px';
                }

                // Update select dropdown value if matching
                if (zoomSelect) {
                    let matched = false;
                    for (let opt of zoomSelect.options) {
                        if (Math.abs(parseFloat(opt.value) - currentZoom) < 0.05) {
                            zoomSelect.value = opt.value;
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        zoomSelect.value = '';
                    }
                }
            }

            function zoomToFit() {
                if (!currentImg || !canvasContainer) return;
                const containerW = canvasContainer.clientWidth - 32;
                const containerH = canvasContainer.clientHeight - 32;
                if (containerW <= 0 || containerH <= 0) return;

                const fitScale = Math.min(containerW / imgCanvas.width, containerH / imgCanvas.height);
                // 100%以上の場合は等倍で表示、画面より大きい場合は縮小フィット
                const finalScale = fitScale < 1.0 ? Math.floor(fitScale * 100) / 100 : 1.0;
                applyZoom(finalScale);
            }

            function toggleMaximize() {
                isMaximized = !isMaximized;
                if (isMaximized) {
                    viewSection.classList.add('sprite-view-maximized');
                    if (maximizeIcon) maximizeIcon.textContent = '🗗';
                    if (maximizeText) maximizeText.textContent = '縮小して戻す';
                } else {
                    viewSection.classList.remove('sprite-view-maximized');
                    if (maximizeIcon) maximizeIcon.textContent = '⛶';
                    if (maximizeText) maximizeText.textContent = 'ウィンドウ拡大';
                }

                setTimeout(() => {
                    zoomToFit();
                }, 120);
            }

            if (maximizeBtn) {
                maximizeBtn.addEventListener('click', toggleMaximize);
            }

            // Esc key to exit fullscreen
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isMaximized) {
                    toggleMaximize();
                }
            });

            // Zoom Controls Events
            if (zoomSelect) {
                zoomSelect.addEventListener('change', () => {
                    const val = parseFloat(zoomSelect.value);
                    if (!isNaN(val)) applyZoom(val);
                });
            }

            if (zoomInBtn) {
                zoomInBtn.addEventListener('click', () => {
                    const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 8.0];
                    let next = steps.find(s => s > currentZoom + 0.05) || (currentZoom * 1.5);
                    applyZoom(next);
                });
            }

            if (zoomOutBtn) {
                zoomOutBtn.addEventListener('click', () => {
                    const steps = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 8.0];
                    let prev = [...steps].reverse().find(s => s < currentZoom - 0.05) || (currentZoom * 0.75);
                    applyZoom(prev);
                });
            }

            if (zoom100Btn) {
                zoom100Btn.addEventListener('click', () => applyZoom(1.0));
            }

            if (zoomFitBtn) {
                zoomFitBtn.addEventListener('click', zoomToFit);
            }

            // Mouse wheel zoom (Ctrl + wheel or wheel in canvas)
            if (canvasContainer) {
                canvasContainer.addEventListener('wheel', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const delta = e.deltaY < 0 ? 1.2 : 0.833;
                        applyZoom(currentZoom * delta);
                    }
                }, { passive: false });
            }

            bgMode.addEventListener('change', () => {
                if (bgMode.value === 'color') bgColorGroup.classList.remove('hidden');
                else bgColorGroup.classList.add('hidden');
                render();
            });

            bgColorPicker.addEventListener('input', (e) => {
                bgColorText.value = e.target.value.toUpperCase();
                render();
            });

            bgColorText.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    bgColorPicker.value = val;
                    render();
                }
            });

            bgTolInput.addEventListener('input', () => {
                render();
            });

            bgPipetteBtn.addEventListener('click', () => {
                isPipette = !isPipette;
                bgPipetteBtn.style.backgroundColor = isPipette ? 'var(--accent-primary)' : '';
            });

            setupDropZone(drop, input, (files) => {
                if (files && files[0]) loadImage(files[0]);
            });

            function loadImage(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        currentImg = img;
                        imgCanvas.width = img.width;
                        imgCanvas.height = img.height;
                        overlayCanvas.width = img.width;
                        overlayCanvas.height = img.height;

                        if (resolutionBadge) {
                            resolutionBadge.textContent = `${img.width} × ${img.height} px`;
                        }

                        ctxImg.drawImage(img, 0, 0);
                        sprites = [];
                        history = [];
                        stopAnimation();
                        animCurrentFrame = 0;

                        // Fit to window or 100%
                        zoomToFit();
                        render();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            // Coordinate helper for mouse & touch
            function getCanvasCoords(e) {
                const rect = overlayCanvas.getBoundingClientRect();
                const scaleX = overlayCanvas.width / rect.width;
                const scaleY = overlayCanvas.height / rect.height;
                const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

                return {
                    x: Math.floor((clientX - rect.left) * scaleX),
                    y: Math.floor((clientY - rect.top) * scaleY)
                };
            }

            function handleCanvasStart(e) {
                if (!currentImg) return;
                if (e.type === 'touchstart') e.preventDefault(); // Prevent scrolling on touch drag

                const { x, y } = getCanvasCoords(e);

                if (isPipette) {
                    const p = ctxImg.getImageData(x, y, 1, 1).data;
                    const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
                    bgColorPicker.value = hex;
                    bgColorText.value = hex;
                    isPipette = false;
                    bgPipetteBtn.style.backgroundColor = '';
                    render();
                    return;
                }

                startX = x;
                startY = y;
                currentX = x;
                currentY = y;
                isDragging = true;
            }

            function handleCanvasMove(e) {
                if (!isDragging || !currentImg) return;
                if (e.type === 'touchmove') e.preventDefault();

                const { x, y } = getCanvasCoords(e);
                currentX = x;
                currentY = y;
                renderOverlay();
            }

            function handleCanvasEnd(e) {
                if (!isDragging) return;
                if (e && e.cancelable) e.preventDefault();
                isDragging = false;

                const rx = Math.max(0, Math.min(startX, currentX));
                const ry = Math.max(0, Math.min(startY, currentY));
                const rw = Math.min(imgCanvas.width - rx, Math.abs(currentX - startX));
                const rh = Math.min(imgCanvas.height - ry, Math.abs(currentY - startY));

                if (rw < 4 || rh < 4) {
                    // 単一クリック -> BFS連結成分自動輪郭切り出し
                    findSmartBoundsBFS(rx, ry);
                } else {
                    const dragMode = dragModeSelect ? dragModeSelect.value : 'fit';
                    if (dragMode === 'fit') {
                        // 火や光など複数の小さな離れたオブジェクトもまとめて1つの最小矩形に吸着フィット
                        const fitRect = findDragFitBounds(rx, ry, rw, rh);
                        addSprite(fitRect);
                    } else {
                        // ドラッグ枠そのまま切り出し
                        addSprite({ x: rx, y: ry, w: rw, h: rh });
                    }
                }
            }

            // Mouse Events
            overlayCanvas.addEventListener('mousedown', handleCanvasStart);
            overlayCanvas.addEventListener('mousemove', handleCanvasMove);
            overlayCanvas.addEventListener('mouseup', handleCanvasEnd);
            window.addEventListener('mouseup', (e) => {
                if (isDragging) handleCanvasEnd(e);
            });

            // Touch Events (Mobile/Tablet support)
            overlayCanvas.addEventListener('touchstart', handleCanvasStart, { passive: false });
            overlayCanvas.addEventListener('touchmove', handleCanvasMove, { passive: false });
            overlayCanvas.addEventListener('touchend', handleCanvasEnd, { passive: false });
            overlayCanvas.addEventListener('touchcancel', () => { isDragging = false; renderOverlay(); });


            // ドラッグ範囲内の全不透明ピクセル（前景）の最小外接矩形を計算（火・光・複数小オブジェクト統合）
            function findDragFitBounds(rx, ry, rw, rh) {
                const cropImgData = ctxImg.getImageData(rx, ry, rw, rh);
                const data = cropImgData.data;
                const isAlphaMode = bgMode.value === 'alpha';
                const hex = bgColorPicker.value;
                const bgR = parseInt(hex.slice(1, 3), 16);
                const bgG = parseInt(hex.slice(3, 5), 16);
                const bgB = parseInt(hex.slice(5, 7), 16);
                const tol = parseFloat(bgTolInput.value);

                let minLX = rw, maxLX = -1, minLY = rh, maxLY = -1;
                let foundPixel = false;

                for (let ly = 0; ly < rh; ly++) {
                    for (let lx = 0; lx < rw; lx++) {
                        const idx = (ly * rw + lx) * 4;
                        let isFg = false;
                        if (isAlphaMode) {
                            isFg = data[idx + 3] > 10;
                        } else {
                            const r = data[idx];
                            const g = data[idx + 1];
                            const b = data[idx + 2];
                            const dist = colorDistance(r, g, b, bgR, bgG, bgB);
                            isFg = dist > tol;
                        }

                        if (isFg) {
                            foundPixel = true;
                            if (lx < minLX) minLX = lx;
                            if (lx > maxLX) maxLX = lx;
                            if (ly < minLY) minLY = ly;
                            if (ly > maxLY) maxLY = ly;
                        }
                    }
                }

                if (!foundPixel) {
                    // 不透明ピクセルが見つからない場合はドラッグ枠そのまま
                    return { x: rx, y: ry, w: rw, h: rh };
                }

                const pad = Math.max(0, parseInt(fitPaddingInput ? fitPaddingInput.value : 0, 10) || 0);
                const fx = Math.max(0, rx + minLX - pad);
                const fy = Math.max(0, ry + minLY - pad);
                const right = Math.min(imgCanvas.width, rx + maxLX + 1 + pad);
                const bottom = Math.min(imgCanvas.height, ry + maxLY + 1 + pad);
                return {
                    x: fx,
                    y: fy,
                    w: Math.max(1, right - fx),
                    h: Math.max(1, bottom - fy)
                };
            }

            function findSmartBoundsBFS(clickX, clickY) {
                const w = imgCanvas.width;
                const h = imgCanvas.height;
                const imgData = ctxImg.getImageData(0, 0, w, h);
                const data = imgData.data;

                const isAlphaMode = bgMode.value === 'alpha';
                const hex = bgColorPicker.value;
                const bgR = parseInt(hex.slice(1, 3), 16);
                const bgG = parseInt(hex.slice(3, 5), 16);
                const bgB = parseInt(hex.slice(5, 7), 16);
                const tol = parseFloat(bgTolInput.value);

                function isForeground(idx) {
                    if (isAlphaMode) {
                        return data[idx + 3] > 10;
                    } else {
                        const r = data[idx];
                        const g = data[idx + 1];
                        const b = data[idx + 2];
                        const dist = colorDistance(r, g, b, bgR, bgG, bgB);
                        return dist > tol;
                    }
                }

                const clickIdx = (clickY * w + clickX) * 4;
                if (!isForeground(clickIdx)) return;

                const visited = new Uint8Array(w * h);
                const queue = [clickX, clickY];
                visited[clickY * w + clickX] = 1;

                let minX = clickX, maxX = clickX, minY = clickY, maxY = clickY;
                let head = 0;

                while (head < queue.length) {
                    const cx = queue[head++];
                    const cy = queue[head++];

                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    const neighbors = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1];
                    for (let i = 0; i < neighbors.length; i += 2) {
                        const nx = neighbors[i];
                        const ny = neighbors[i + 1];
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            const nIdx = ny * w + nx;
                            if (visited[nIdx] === 0) {
                                visited[nIdx] = 1;
                                if (isForeground(nIdx * 4)) {
                                    queue.push(nx, ny);
                                }
                            }
                        }
                    }
                }

                queue.length = 0;

                addSprite({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
            }

            function pushSpriteHistory() {
                history.push(JSON.stringify(sprites));
                if (history.length > 50) history.shift();
            }

            function addSprite(rect) {
                pushSpriteHistory();
                sprites.push({ id: currentId++, rect });
                render();
            }

            // 順番入れ替え（▲ / ▼）
            function moveSprite(index, direction) {
                const target = index + direction;
                if (target < 0 || target >= sprites.length) return;
                pushSpriteHistory();
                const temp = sprites[index];
                sprites[index] = sprites[target];
                sprites[target] = temp;
                render();
            }

            // 読順自動整列（左上→右下）
            function sortSpritesByReadingOrder() {
                if (sprites.length < 2) return;
                pushSpriteHistory();
                const avgH = sprites.reduce((acc, s) => acc + s.rect.h, 0) / sprites.length;
                const rowTol = avgH * 0.5;

                sprites.sort((a, b) => {
                    if (Math.abs(a.rect.y - b.rect.y) > rowTol) {
                        return a.rect.y - b.rect.y;
                    }
                    return a.rect.x - b.rect.x;
                });
                render();
            }

            // 順序反転（リバース）
            function reverseSprites() {
                if (sprites.length < 2) return;
                pushSpriteHistory();
                sprites.reverse();
                render();
            }

            if (sortOrderBtn) {
                sortOrderBtn.addEventListener('click', sortSpritesByReadingOrder);
            }

            if (reverseBtn) {
                reverseBtn.addEventListener('click', reverseSprites);
            }

            clearAllBtn.addEventListener('click', () => {
                if (!sprites.length) return;
                pushSpriteHistory();
                sprites = [];
                stopAnimation();
                animCurrentFrame = 0;
                render();
            });

            // スプライト単体を透過処理したオフスクリーンCanvasを生成（高速化キャッシュ付き）
            function getProcessedSpriteCanvas(s) {
                const isColorMode = bgMode.value === 'color';
                const cacheKey = `${s.id}_${s.rect.x}_${s.rect.y}_${s.rect.w}_${s.rect.h}_${isColorMode ? bgColorPicker.value + '_' + parseFloat(bgTolInput.value) : 'none'}`;
                if (s._cachedCanvas && s._cacheKey === cacheKey) {
                    return s._cachedCanvas;
                }

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = s.rect.w;
                tempCanvas.height = s.rect.h;
                const tempCtx = tempCanvas.getContext('2d');

                if (isColorMode) {
                    const hex = bgColorPicker.value;
                    const bgR = parseInt(hex.slice(1, 3), 16);
                    const bgG = parseInt(hex.slice(3, 5), 16);
                    const bgB = parseInt(hex.slice(5, 7), 16);
                    const tol = parseFloat(bgTolInput.value);

                    const cropImgData = ctxImg.getImageData(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
                    const d = cropImgData.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const dist = colorDistance(d[i], d[i + 1], d[i + 2], bgR, bgG, bgB);
                        if (dist <= tol) d[i + 3] = 0;
                    }
                    tempCtx.putImageData(cropImgData, 0, 0);
                } else {
                    tempCtx.drawImage(imgCanvas, s.rect.x, s.rect.y, s.rect.w, s.rect.h, 0, 0, s.rect.w, s.rect.h);
                }
                s._cachedCanvas = tempCanvas;
                s._cacheKey = cacheKey;
                return tempCanvas;
            }

            function render() {
                countBadge.textContent = `${sprites.length} 個選択中`;
                exportBtn.disabled = sprites.length === 0;

                renderOverlay();
                renderList();
                updateAnimPreview();
            }

            function renderOverlay() {
                ctxOverlay.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

                if (isDragging) {
                    const rx = Math.min(startX, currentX);
                    const ry = Math.min(startY, currentY);
                    const rw = Math.abs(currentX - startX);
                    const rh = Math.abs(currentY - startY);
                    ctxOverlay.fillStyle = 'rgba(0, 122, 204, 0.25)';
                    ctxOverlay.fillRect(rx, ry, rw, rh);
                    ctxOverlay.strokeStyle = '#007acc';
                    ctxOverlay.lineWidth = 2;
                    ctxOverlay.setLineDash([4, 3]);
                    ctxOverlay.strokeRect(rx, ry, rw, rh);
                    ctxOverlay.setLineDash([]);
                }

                sprites.forEach((s, idx) => {
                    ctxOverlay.strokeStyle = '#ef4444';
                    ctxOverlay.lineWidth = 2;
                    ctxOverlay.strokeRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);

                    // 連番インデックス描画
                    ctxOverlay.fillStyle = '#ef4444';
                    ctxOverlay.fillRect(s.rect.x, Math.max(0, s.rect.y - 16), 24, 16);
                    ctxOverlay.fillStyle = '#ffffff';
                    ctxOverlay.font = 'bold 10px monospace';
                    ctxOverlay.fillText(`#${idx + 1}`, s.rect.x + 3, Math.max(0, s.rect.y - 16) + 12);
                });
            }

            function renderList() {
                listContainer.innerHTML = '';
                if (sprites.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.textAlign = 'center';
                    empty.style.color = 'var(--text-muted)';
                    empty.style.fontSize = '12px';
                    empty.style.padding = '24px 8px';
                    empty.textContent = 'スプライト画像上のオブジェクトをクリックまたはドラッグで選択してください';
                    listContainer.appendChild(empty);
                    return;
                }

                sprites.forEach((s, idx) => {
                    const item = document.createElement('div');
                    item.className = 'sprite-item';
                    item.setAttribute('draggable', 'true');
                    item.dataset.index = idx;

                    const thumbCanvas = getProcessedSpriteCanvas(s);
                    const thumbUrl = thumbCanvas.toDataURL('image/png');

                    item.innerHTML = `
                        <div class="sprite-drag-handle" title="ドラッグして順番を入れ替え">⋮⋮</div>
                        <span class="sprite-order-badge">#${idx + 1}</span>
                        <div class="sprite-thumb checkerboard">
                            <img src="${thumbUrl}">
                        </div>
                        <div class="sprite-info">
                            <span>${s.rect.w}×${s.rect.h}px</span> (X:${s.rect.x}, Y:${s.rect.y})
                        </div>
                        <div class="sprite-actions">
                            <button class="sprite-btn-move btn-move-up" title="上へ移動 (連番繰り上げ)" ${idx === 0 ? 'disabled' : ''}>▲</button>
                            <button class="sprite-btn-move btn-move-down" title="下へ移動 (連番繰り下げ)" ${idx === sprites.length - 1 ? 'disabled' : ''}>▼</button>
                            <button class="btn btn-danger btn-delete-sprite" style="padding: 2px 6px; font-size: 10px; height: 22px;">削除</button>
                        </div>
                    `;

                    // 上へ移動
                    const upBtn = item.querySelector('.btn-move-up');
                    if (upBtn) {
                        upBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            moveSprite(idx, -1);
                        });
                    }

                    // 下へ移動
                    const downBtn = item.querySelector('.btn-move-down');
                    if (downBtn) {
                        downBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            moveSprite(idx, 1);
                        });
                    }

                    // 削除
                    const delBtn = item.querySelector('.btn-delete-sprite');
                    if (delBtn) {
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            pushSpriteHistory();
                            sprites = sprites.filter(sp => sp.id !== s.id);
                            if (sprites.length === 0) {
                                stopAnimation();
                                animCurrentFrame = 0;
                            }
                            render();
                        });
                    }

                    // HTML5 ドラッグ＆ドロップ並び替え
                    item.addEventListener('dragstart', (e) => {
                        dragSourceIndex = idx;
                        item.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                    });

                    item.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = item.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        if (e.clientY < midY) {
                            item.classList.add('drag-over-top');
                            item.classList.remove('drag-over-bottom');
                        } else {
                            item.classList.add('drag-over-bottom');
                            item.classList.remove('drag-over-top');
                        }
                    });

                    item.addEventListener('dragleave', () => {
                        item.classList.remove('drag-over-top', 'drag-over-bottom');
                    });

                    item.addEventListener('drop', (e) => {
                        e.preventDefault();
                        item.classList.remove('drag-over-top', 'drag-over-bottom');
                        const fromIdx = dragSourceIndex;
                        const toIdx = idx;

                        if (fromIdx !== null && fromIdx !== toIdx) {
                            pushSpriteHistory();
                            const moved = sprites.splice(fromIdx, 1)[0];
                            const rect = item.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            let insertIdx = e.clientY < midY ? toIdx : toIdx + 1;
                            if (fromIdx < insertIdx) insertIdx--;
                            sprites.splice(insertIdx, 0, moved);
                            render();
                        }
                    });

                    item.addEventListener('dragend', () => {
                        item.classList.remove('dragging');
                        document.querySelectorAll('.sprite-item').forEach(el => {
                            el.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
                        });
                        dragSourceIndex = null;
                    });

                    listContainer.appendChild(item);
                });
            }

            // 連番アニメーションプレビュー制御
            function updateAnimPreview() {
                if (!animCanvas || !animCtx) return;
                animCtx.clearRect(0, 0, animCanvas.width, animCanvas.height);

                if (sprites.length === 0) {
                    if (animFrameText) animFrameText.textContent = 'コマ: - / -';
                    if (isPlayingAnim) stopAnimation();
                    return;
                }

                if (animCurrentFrame >= sprites.length) {
                    animCurrentFrame = 0;
                } else if (animCurrentFrame < 0) {
                    animCurrentFrame = sprites.length - 1;
                }

                if (animFrameText) {
                    animFrameText.textContent = `コマ: ${animCurrentFrame + 1} / ${sprites.length}`;
                }

                const s = sprites[animCurrentFrame];
                if (!s) return;

                const processedCanvas = getProcessedSpriteCanvas(s);
                const cW = animCanvas.width;
                const cH = animCanvas.height;
                const scale = Math.min((cW - 4) / s.rect.w, (cH - 4) / s.rect.h);
                const dw = Math.round(s.rect.w * scale);
                const dh = Math.round(s.rect.h * scale);
                const dx = Math.round((cW - dw) / 2);
                const dy = Math.round((cH - dh) / 2);

                animCtx.imageSmoothingEnabled = false;
                animCtx.drawImage(processedCanvas, dx, dy, dw, dh);
            }

            let animLastTime = 0;
            function startAnimation() {
                if (sprites.length === 0) return;
                isPlayingAnim = true;
                if (animPlayBtn) {
                    animPlayBtn.textContent = '停止';
                    animPlayBtn.classList.remove('btn-primary');
                    animPlayBtn.classList.add('btn-danger');
                }
                const fps = Math.min(60, Math.max(1, parseInt(animFpsInput ? animFpsInput.value : 10, 10) || 10));
                const interval = 1000 / fps;

                if (animTimer) cancelAnimationFrame(animTimer);
                animLastTime = performance.now();

                function tick(now) {
                    if (!isPlayingAnim) return;
                    if (sprites.length === 0) {
                        stopAnimation();
                        return;
                    }
                    if (!document.hidden && now - animLastTime >= interval) {
                        animLastTime = now - ((now - animLastTime) % interval);
                        animCurrentFrame = (animCurrentFrame + 1) % sprites.length;
                        updateAnimPreview();
                    }
                    animTimer = requestAnimationFrame(tick);
                }
                animTimer = requestAnimationFrame(tick);
            }

            function stopAnimation() {
                isPlayingAnim = false;
                if (animTimer) {
                    cancelAnimationFrame(animTimer);
                    animTimer = null;
                }
                if (animPlayBtn) {
                    animPlayBtn.textContent = '再生';
                    animPlayBtn.classList.remove('btn-danger');
                    animPlayBtn.classList.add('btn-primary');
                }
            }

            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && isPlayingAnim) {
                    animLastTime = performance.now();
                }
            });

            if (animPlayBtn) {
                animPlayBtn.addEventListener('click', () => {
                    if (isPlayingAnim) {
                        stopAnimation();
                    } else {
                        startAnimation();
                    }
                });
            }

            if (animFpsInput) {
                animFpsInput.addEventListener('change', () => {
                    if (isPlayingAnim) {
                        startAnimation(); // restart with new fps
                    }
                });
            }

            if (animPrevBtn) {
                animPrevBtn.addEventListener('click', () => {
                    stopAnimation();
                    if (sprites.length > 0) {
                        animCurrentFrame = (animCurrentFrame - 1 + sprites.length) % sprites.length;
                        updateAnimPreview();
                    }
                });
            }

            if (animNextBtn) {
                animNextBtn.addEventListener('click', () => {
                    stopAnimation();
                    if (sprites.length > 0) {
                        animCurrentFrame = (animCurrentFrame + 1) % sprites.length;
                        updateAnimPreview();
                    }
                });
            }

            // ZIP連番エクスポート
            exportBtn.addEventListener('click', async () => {
                if (!sprites.length) return;
                if (typeof JSZip === 'undefined') {
                    showToast('ZIPライブラリの読み込みに失敗しました');
                    return;
                }
                const zip = new JSZip();
                const baseName = filenameInput.value.trim() || 'sprite';

                sprites.forEach((s, idx) => {
                    const tempCanvas = getProcessedSpriteCanvas(s);
                    const dataUrl = tempCanvas.toDataURL('image/png').split(',')[1];
                    const numStr = String(idx + 1).padStart(3, '0');
                    zip.file(`${baseName}_${numStr}.png`, dataUrl, { base64: true });
                });

                const content = await zip.generateAsync({ type: 'blob' });
                const zipUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = `${baseName}.zip`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
            });

            // Undo (Ctrl+Z)
            document.addEventListener('keydown', (e) => {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
                const spriteView = document.getElementById('view-sprite-cutter');
                if (!spriteView || !spriteView.classList.contains('active')) return;
                if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                    if (history.length) {
                        sprites = JSON.parse(history.pop());
                        render();
                    }
                }
            });

            // Background Switcher
            document.querySelectorAll('.sprite-bg-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.sprite-bg-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const bg = btn.dataset.bg;
                    const container = document.getElementById('spriteCanvasContainer');
                    container.classList.toggle('checkerboard', bg === 'checker');
                    container.style.backgroundColor = bg === 'checker' ? '' : bg;
                });
            });
        })();
