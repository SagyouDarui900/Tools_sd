import { showToast, escapeHtml, addSuffixC, setupDropZone } from '../core/utils.js';

        (function() {
            const drop = document.getElementById('pngCropDrop');
            const input = document.getElementById('pngCropInput');
            const results = document.getElementById('pngCropResults');

            setupDropZone(drop, input, handleFiles);

            function handleFiles(files) {
                Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);

                            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const bounds = getBoundingBox(imgData);
                            if (!bounds) {
                                showToast(`${file.name}: 削減可能な不透明ピクセルが見つかりませんでした`);
                                return;
                            }

                            const cropCanvas = document.createElement('canvas');
                            cropCanvas.width = bounds.w;
                            cropCanvas.height = bounds.h;
                            const cropCtx = cropCanvas.getContext('2d');
                            cropCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);

                            const cropUrl = cropCanvas.toDataURL('image/png');
                            const outName = addSuffixC(file.name);

                            renderCard(cropUrl, outName, bounds.w, bounds.h);
                        };
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            }

            function getBoundingBox(imgData) {
                const { data, width, height } = imgData;
                let minX = width, minY = height, maxX = -1, maxY = -1;
                let found = false;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const alpha = data[(y * width + x) * 4 + 3];
                        if (alpha > 0) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                            found = true;
                        }
                    }
                }
                if (!found) return null;
                return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
            }

            function renderCard(url, name, w, h) {
                const card = document.createElement('div');
                card.className = 'panel';
                card.style.margin = '0';
                card.innerHTML = `
                    <div class="checkerboard" style="border: 1px solid var(--border-color); height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                        <img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                    <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px;">${escapeHtml(name)} (${w}x${h}px)</div>
                    <a href="${url}" download="${escapeHtml(name)}" class="btn btn-primary" style="width: 100%; text-align: center;">保存</a>
                `;
                results.appendChild(card);
            }
        })();
