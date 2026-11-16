import { setupDropZone } from '../core/utils.js';

        (function() {
            let currentImg = null;
            let isPipette = false;

            const drop = document.getElementById('chromaDrop');
            const input = document.getElementById('chromaInput');
            const colorPicker = document.getElementById('chromaColorPicker');
            const colorText = document.getElementById('chromaColorText');
            const pipetteBtn = document.getElementById('chromaPipetteBtn');
            const pipetteHint = document.getElementById('chromaPipetteHint');
            const tolInput = document.getElementById('chromaTol');
            const tolVal = document.getElementById('chromaTolVal');
            const smoothInput = document.getElementById('chromaSmooth');
            const smoothVal = document.getElementById('chromaSmoothVal');
            const downloadBtn = document.getElementById('chromaDownloadBtn');
            const canvas = document.getElementById('chromaCanvas');
            const placeholder = document.getElementById('chromaPlaceholder');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            setupDropZone(drop, input, (files) => {
                if (files && files[0]) handleFile(files[0]);
            });

            function handleFile(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        currentImg = img;
                        downloadBtn.disabled = false;
                        placeholder.classList.add('hidden');
                        canvas.classList.remove('hidden');
                        process();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            let chromaRaf = null;
            function scheduleProcess() {
                if (chromaRaf) cancelAnimationFrame(chromaRaf);
                chromaRaf = requestAnimationFrame(() => {
                    process();
                });
            }

            colorPicker.addEventListener('input', (e) => {
                colorText.value = e.target.value.toUpperCase();
                scheduleProcess();
            });

            tolInput.addEventListener('input', (e) => {
                tolVal.textContent = e.target.value + '%';
                scheduleProcess();
            });

            smoothInput.addEventListener('input', (e) => {
                smoothVal.textContent = e.target.value + '%';
                scheduleProcess();
            });

            pipetteBtn.addEventListener('click', () => {
                isPipette = !isPipette;
                if (isPipette) {
                    pipetteBtn.style.backgroundColor = 'var(--accent-primary)';
                    pipetteHint.classList.remove('hidden');
                } else {
                    pipetteBtn.style.backgroundColor = '';
                    pipetteHint.classList.add('hidden');
                }
            });

            canvas.addEventListener('click', (e) => {
                if (!isPipette || !currentImg) return;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = Math.floor((e.clientX - rect.left) * scaleX);
                const y = Math.floor((e.clientY - rect.top) * scaleY);

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(currentImg, 0, 0);

                const p = tempCtx.getImageData(x, y, 1, 1).data;
                const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase();
                colorPicker.value = hex;
                colorText.value = hex;

                isPipette = false;
                pipetteBtn.style.backgroundColor = '';
                pipetteHint.classList.add('hidden');
                process();
            });

            function process() {
                if (!currentImg) return;
                canvas.width = currentImg.naturalWidth;
                canvas.height = currentImg.naturalHeight;
                ctx.drawImage(currentImg, 0, 0);

                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;

                const hex = colorPicker.value;
                const targetR = parseInt(hex.slice(1, 3), 16);
                const targetG = parseInt(hex.slice(3, 5), 16);
                const targetB = parseInt(hex.slice(5, 7), 16);

                const tol = parseFloat(tolInput.value);
                const smooth = parseFloat(smoothInput.value);
                const maxDist = 441.67;

                for (let i = 0; i < data.length; i += 4) {
                    const dist = Math.sqrt((data[i] - targetR) ** 2 + (data[i + 1] - targetG) ** 2 + (data[i + 2] - targetB) ** 2);
                    const pct = (dist / maxDist) * 100;
                    if (pct <= tol) {
                        data[i + 3] = 0;
                    } else if (pct <= tol + smooth) {
                        data[i + 3] = Math.floor(data[i + 3] * ((pct - tol) / smooth));
                    }
                }
                ctx.putImageData(imgData, 0, 0);
            }

            downloadBtn.addEventListener('click', () => {
                if (!currentImg) return;
                const a = document.createElement('a');
                a.href = canvas.toDataURL('image/png');
                a.download = 'chromakey_output.png';
                a.click();
            });
        })();
