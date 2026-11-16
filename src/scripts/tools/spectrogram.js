import { showToast, setupDropZone } from '../core/utils.js';

        (function() {
            const drop = document.getElementById('specDropZone');
            const input = document.getElementById('specFileInput');
            const canvas = document.getElementById('specCanvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const placeholder = document.getElementById('specPlaceholder');
            const generateBtn = document.getElementById('specGenerateBtn');
            const progressSection = document.getElementById('specProgressSection');
            const progressBar = document.getElementById('specProgressBar');
            const progressPercent = document.getElementById('specProgressPercent');
            const statusText = document.getElementById('specStatusText');
            const audioSection = document.getElementById('specAudioSection');
            const audioPlayer = document.getElementById('specAudioPlayer');
            const downloadBtn = document.getElementById('specDownloadBtn');
            const filenameInput = document.getElementById('specFilenameInput');

            let currentImg = null;
            let currentAudioUrl = null;

            function getFormattedFilename() {
                const rawName = filenameInput ? filenameInput.value.trim() : '';
                const cleanName = rawName.replace(/[/\\?%*:|"<>]/g, '').trim();
                return (cleanName || 'spectrogram-art') + '.wav';
            }

            if (filenameInput) {
                filenameInput.addEventListener('input', () => {
                    downloadBtn.download = getFormattedFilename();
                });
            }

            setupDropZone(drop, input, (files) => {
                if (files && files[0]) loadImage(files[0]);
            });

            function loadImage(file) {
                if (filenameInput && file.name) {
                    const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                    filenameInput.value = `${base}_spectrogram`;
                    downloadBtn.download = getFormattedFilename();
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        currentImg = img;
                        renderPreview();
                        generateBtn.disabled = false;
                        placeholder.classList.add('hidden');
                        canvas.classList.remove('hidden');
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            function renderPreview() {
                if (!currentImg) return;
                const H = parseInt(document.getElementById('specResolution').value);
                const aspect = currentImg.width / currentImg.height;
                let W = Math.round(H * aspect);
                if (W > 1024) W = 1024;
                canvas.width = W;
                canvas.height = H;
                ctx.fillStyle = "black";
                ctx.fillRect(0, 0, W, H);
                ctx.filter = 'grayscale(100%)';
                ctx.drawImage(currentImg, 0, 0, W, H);
                ctx.filter = 'none';
            }

            const specResEl = document.getElementById('specResolution');
            if (specResEl) specResEl.addEventListener('change', renderPreview);

            generateBtn.addEventListener('click', () => {
                if (!currentImg) return;

                if (audioPlayer.src && audioPlayer.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audioPlayer.src);
                }

                progressSection.classList.remove('hidden');
                audioSection.classList.add('hidden');
                generateBtn.disabled = true;
                statusText.textContent = '合成アルゴリズムを実行中...';

                const duration = parseFloat(document.getElementById('specDuration').value);
                const H = parseInt(document.getElementById('specResolution').value);
                const minFreq = parseFloat(document.getElementById('specMinFreq').value);
                const maxFreq = parseFloat(document.getElementById('specMaxFreq').value);
                const scaleType = document.getElementById('specScale').value;
                const contrast = parseFloat(document.getElementById('specContrast').value);

                const W = canvas.width;
                const imgData = ctx.getImageData(0, 0, W, H).data;
                const pixels = new Float32Array(W * H);
                for (let i = 0; i < imgData.length; i += 4) {
                    pixels[i / 4] = (0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]) / 255.0;
                }

                // Inline Worker Script
                const workerScript = `
                self.onmessage = function(e) {
                    const { pixels, W, H, duration, sampleRate, minFreq, maxFreq, scaleType, contrast } = e.data;
                    const totalSamples = Math.floor(sampleRate * duration);
                    const buffer = new Float32Array(totalSamples);

                    for (let y = 0; y < H; y++) {
                        const yFrac = (H - 1 - y) / (H - 1);
                        let freq = scaleType === 'log' 
                            ? Math.max(20, minFreq) * Math.pow(maxFreq / Math.max(20, minFreq), yFrac)
                            : minFreq + (maxFreq - minFreq) * yFrac;

                        const phase = Math.random() * Math.PI * 2;
                        const omega = 2 * Math.PI * freq / sampleRate;

                        let i = 0;
                        for (let x = 0; x < W; x++) {
                            const endSample = Math.floor((x + 1) * totalSamples / W);
                            const samplesInChunk = endSample - i;
                            if (samplesInChunk <= 0) continue;

                            let lum = Math.pow(pixels[y * W + x], contrast);
                            let prevLum = x > 0 ? Math.pow(pixels[y * W + (x - 1)], contrast) : lum;

                            for (let j = 0; j < samplesInChunk; j++, i++) {
                                const currentAmp = prevLum + (lum - prevLum) * (j / samplesInChunk);
                                buffer[i] += currentAmp * Math.sin(i * omega + phase);
                            }
                        }
                        if (y % 10 === 0) self.postMessage({ type: 'progress', progress: y / H });
                    }

                    let maxVal = 0.001;
                    for (let i = 0; i < totalSamples; i++) {
                        if (Math.abs(buffer[i]) > maxVal) maxVal = Math.abs(buffer[i]);
                    }
                    for (let i = 0; i < totalSamples; i++) {
                        buffer[i] = (buffer[i] / maxVal) * 0.9;
                    }

                    // WAV encode
                    const wavBuffer = new ArrayBuffer(44 + buffer.length * 2);
                    const view = new DataView(wavBuffer);
                    function writeString(v, o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }

                    writeString(view, 0, 'RIFF');
                    view.setUint32(4, 36 + buffer.length * 2, true);
                    writeString(view, 8, 'WAVE');
                    writeString(view, 12, 'fmt ');
                    view.setUint32(16, 16, true);
                    view.setUint16(20, 1, true);
                    view.setUint16(22, 1, true);
                    view.setUint32(24, sampleRate, true);
                    view.setUint32(28, sampleRate * 2, true);
                    view.setUint16(32, 2, true);
                    view.setUint16(34, 16, true);
                    writeString(view, 36, 'data');
                    view.setUint32(40, buffer.length * 2, true);

                    let offset = 44;
                    for (let i = 0; i < buffer.length; i++, offset += 2) {
                        let s = Math.max(-1, Math.min(1, buffer[i]));
                        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                    }

                    self.postMessage({ type: 'done', wavBuffer: wavBuffer }, [wavBuffer]);
                };
                `;

                const blob = new Blob([workerScript], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                const worker = new Worker(workerUrl);

                worker.onmessage = (e) => {
                    if (e.data.type === 'progress') {
                        const pct = Math.round(e.data.progress * 100);
                        progressBar.style.width = pct + '%';
                        progressPercent.textContent = pct + '%';
                    } else if (e.data.type === 'done') {
                        progressBar.style.width = '100%';
                        progressPercent.textContent = '100%';

                        const wavBlob = new Blob([e.data.wavBuffer], { type: 'audio/wav' });
                        if (currentAudioUrl) {
                            URL.revokeObjectURL(currentAudioUrl);
                        }
                        const blobUrl = URL.createObjectURL(wavBlob);
                        currentAudioUrl = blobUrl;

                        audioPlayer.src = blobUrl;
                        downloadBtn.href = blobUrl;
                        downloadBtn.download = getFormattedFilename();

                        setTimeout(() => {
                            progressSection.classList.add('hidden');
                            audioSection.classList.remove('hidden');
                            generateBtn.disabled = false;
                        }, 300);

                        worker.terminate();
                        URL.revokeObjectURL(workerUrl);
                    }
                };

                worker.onerror = (err) => {
                    console.error('Spectrogram worker error:', err);
                    showToast('音声合成処理中にエラーが発生しました');
                    progressSection.classList.add('hidden');
                    generateBtn.disabled = false;
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                };

                worker.postMessage({
                    pixels, W, H, duration, sampleRate: 44100, minFreq, maxFreq, scaleType, contrast
                });
            });
        })();
