import { escapeHtml, setupDropZone } from '../core/utils.js';

        (function() {
            let items = [];
            let fmt = 'png';
            let quality = 80;

            const drop = document.getElementById('imgConvDrop');
            const input = document.getElementById('imgConvInput');
            const list = document.getElementById('imgConvList');
            const startBtn = document.getElementById('imgConvStartBtn');
            const zipBtn = document.getElementById('imgConvZipBtn');
            const countEl = document.getElementById('imgConvCount');
            const clearBtn = document.getElementById('imgConvClearBtn');
            const qualityBox = document.getElementById('imgConvQualityBox');
            const qualityInput = document.getElementById('imgConvQuality');
            const qualityVal = document.getElementById('imgConvQualityVal');

            document.querySelectorAll('#imgConvFmtGroup button').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#imgConvFmtGroup button').forEach(b => b.classList.remove('btn-primary'));
                    btn.classList.add('btn-primary');
                    fmt = btn.dataset.fmt;
                    if (fmt === 'jpg' || fmt === 'webp') qualityBox.classList.remove('hidden');
                    else qualityBox.classList.add('hidden');
                });
            });

            qualityInput.addEventListener('input', (e) => {
                quality = parseInt(e.target.value);
                qualityVal.textContent = quality + '%';
            });

            setupDropZone(drop, input, handleFiles);

            function handleFiles(files) {
                Array.from(files).filter(f => f.type.startsWith('image/')).forEach(f => {
                    items.push({ file: f, status: 'pending', blob: null, url: null });
                });
                render();
            }

            clearBtn.addEventListener('click', () => {
                items.forEach(i => { if (i.url) URL.revokeObjectURL(i.url); });
                items = [];
                render();
            });

            startBtn.addEventListener('click', async () => {
                for (let item of items) {
                    if (item.status === 'done') continue;
                    try {
                        const blob = await convertImage(item.file, fmt, quality);
                        item.blob = blob;
                        if (item.url) URL.revokeObjectURL(item.url);
                        item.url = URL.createObjectURL(blob);
                        item.status = 'done';
                    } catch (err) {
                        item.status = 'error';
                    }
                }
                render();
            });

            zipBtn.addEventListener('click', async () => {
                if (typeof JSZip === 'undefined') return;
                const zip = new JSZip();
                items.filter(i => i.status === 'done' && i.blob).forEach(i => {
                    const baseName = i.file.name.substring(0, i.file.name.lastIndexOf('.')) || i.file.name;
                    zip.file(`${baseName}.${fmt === 'jpg' ? 'jpeg' : fmt}`, i.blob);
                });
                const content = await zip.generateAsync({ type: 'blob' });
                const zipUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = 'converted_images.zip';
                a.click();
                setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
            });

            function convertImage(file, format, q) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    const url = URL.createObjectURL(file);
                    img.onload = () => {
                        URL.revokeObjectURL(url);
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (format === 'jpg') {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        ctx.drawImage(img, 0, 0);
                        const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
                        canvas.toBlob(b => b ? resolve(b) : reject(), mime, q / 100);
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject();
                    };
                    img.src = url;
                });
            }

            function render() {
                countEl.textContent = `ファイル一覧 (${items.length}件)`;
                startBtn.disabled = !items.some(i => i.status === 'pending');
                zipBtn.disabled = !items.some(i => i.status === 'done');

                list.innerHTML = items.map(i => {
                    const baseName = i.file.name.replace(/\.[^/.]+$/, "") || i.file.name;
                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; border: 1px solid var(--border-color); background-color: var(--bg-panel);">
                        <span style="font-weight: 600; font-size: 11px;">${escapeHtml(i.file.name)}</span>
                        <div>
                            ${i.status === 'done' ? `<a href="${i.url}" download="${escapeHtml(baseName)}_conv.${escapeHtml(fmt)}" class="btn btn-primary" style="padding: 2px 6px; font-size: 10px;">保存</a>` : ''}
                            <span class="chip">${escapeHtml(i.status)}</span>
                        </div>
                    </div>
                `}).join('');
            }
        })();
