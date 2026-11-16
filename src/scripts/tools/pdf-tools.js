import { showToast, escapeHtml, setupDropZone } from '../core/utils.js';

        (function() {
            const drop = document.getElementById('pdfDropZone');
            const input = document.getElementById('pdfFileInput');
            const modeSelect = document.getElementById('pdfModeSelect');
            const scaleSelect = document.getElementById('pdfScaleSelect');
            const progressSection = document.getElementById('pdfProgressSection');
            const progressBar = document.getElementById('pdfProgressBar');
            const progressPercent = document.getElementById('pdfProgressPercent');
            const resultSection = document.getElementById('pdfResultSection');
            const gallery = document.getElementById('pdfGallery');
            const zipBtn = document.getElementById('pdfZipBtn');

            let generatedImages = [];

            setupDropZone(drop, input, (files) => {
                if (files && files[0]) handleFile(files[0]);
            });

            function handleFile(file) {
                if (file.type !== 'application/pdf') return;
                processPdf(file);
            }

            async function processPdf(file) {
                resultSection.classList.add('hidden');
                gallery.innerHTML = '';
                generatedImages = [];
                progressSection.classList.remove('hidden');

                try {
                    const buf = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
                    const total = pdf.numPages;
                    const mode = modeSelect.value;

                    for (let i = 1; i <= total; i++) {
                        const page = await pdf.getPage(i);
                        if (mode === 'convert') {
                            await renderPageToImage(page, i, file.name);
                        } else {
                            await extractImagesFromPage(page, i, file.name);
                        }
                        const pct = Math.round((i / total) * 100);
                        progressBar.style.width = pct + '%';
                        progressPercent.textContent = `${i} / ${total} ページ完了`;
                    }
                    showResults();
                } catch (err) {
                    showToast('PDFの処理中にエラーが発生しました: ' + (err.message || '読み込み失敗'));
                } finally {
                    progressSection.classList.add('hidden');
                }
            }

            async function renderPageToImage(page, pageNum, filename) {
                const scale = parseFloat(scaleSelect.value);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: ctx, viewport }).promise;
                const baseName = filename.replace(/\.pdf$/i, '');
                const fname = `${baseName}_p${String(pageNum).padStart(3, '0')}.png`;
                generatedImages.push({ url: canvas.toDataURL('image/png'), name: fname });
            }

            async function extractImagesFromPage(page, pageNum, filename) {
                const ops = await page.getOperatorList();
                const baseName = filename.replace(/\.pdf$/i, '');
                for (let i = 0; i < ops.fnArray.length; i++) {
                    if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject || ops.fnArray[i] === pdfjsLib.OPS.paintInlineImageXObject) {
                        const imgName = ops.argsArray[i][0];
                        try {
                            const imgObj = await new Promise(res => page.objs.get(imgName, res));
                            if (imgObj) {
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = imgObj.width;
                                canvas.height = imgObj.height;

                                if (imgObj.bitmap) {
                                    ctx.drawImage(imgObj.bitmap, 0, 0);
                                    generatedImages.push({ url: canvas.toDataURL('image/png'), name: `${baseName}_p${pageNum}_img${i}.png` });
                                } else if (imgObj.data) {
                                    const imgData = new ImageData(new Uint8ClampedArray(imgObj.data), imgObj.width, imgObj.height);
                                    ctx.putImageData(imgData, 0, 0);
                                    generatedImages.push({ url: canvas.toDataURL('image/png'), name: `${baseName}_p${pageNum}_img${i}.png` });
                                }
                            }
                        } catch (e) {}
                    }
                }
            }

            function showResults() {
                resultSection.classList.remove('hidden');
                document.getElementById('pdfResultCount').textContent = `抽出結果 (${generatedImages.length}件)`;

                if (generatedImages.length === 0) {
                    gallery.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 24px 12px; color: var(--text-muted); font-size: 13px;">
                            抽出可能な画像が見つかりませんでした。「全ページを画像に変換」モードをお試しください。
                        </div>
                    `;
                    return;
                }

                generatedImages.forEach(img => {
                    const card = document.createElement('div');
                    card.className = 'panel';
                    card.style.margin = '0';
                    card.innerHTML = `
                        <div class="checkerboard" style="border: 1px solid var(--border-color); height: 100px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px;">
                            <img src="${img.url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                        </div>
                        <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(img.name)}</div>
                        <a href="${img.url}" download="${escapeHtml(img.name)}" class="btn btn-primary" style="width: 100%; text-align: center;">保存</a>
                    `;
                    gallery.appendChild(card);
                });
            }

            zipBtn.addEventListener('click', async () => {
                if (!generatedImages.length || typeof JSZip === 'undefined') return;
                const zip = new JSZip();
                generatedImages.forEach(img => {
                    zip.file(img.name, img.url.split(',')[1], { base64: true });
                });
                const content = await zip.generateAsync({ type: 'blob' });
                const zipUrl = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = zipUrl;
                a.download = 'pdf_images.zip';
                a.click();
                setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
            });
        })();
