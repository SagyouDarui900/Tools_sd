import { addSuffixC, setupDropZone } from '../core/utils.js';

        (function() {
            const drop = document.getElementById('svgCropDrop');
            const input = document.getElementById('svgCropInput');
            const workspace = document.getElementById('svgCropWorkspace');
            const preview = document.getElementById('svgCropPreview');
            const viewboxEl = document.getElementById('svgCropViewbox');
            const paddingChk = document.getElementById('svgCropPaddingChk');
            const paddingRange = document.getElementById('svgCropPaddingRange');
            const downloadBtn = document.getElementById('svgCropDownloadBtn');
            const copyBtn = document.getElementById('svgCropCopyBtn');
            const calcContainer = document.getElementById('svgCropCalcContainer');

            let origSvgStr = '';
            let croppedSvgStr = '';
            let bbox = null;
            let filename = '';

            setupDropZone(drop, input, (files) => {
                if (files && files[0]) handleFile(files[0]);
            });

            function handleFile(file) {
                filename = file.name;
                const reader = new FileReader();
                reader.onload = (e) => {
                    origSvgStr = e.target.result;
                    processSvg();
                };
                reader.readAsText(file);
            }

            function processSvg() {
                calcContainer.innerHTML = '';
                const parser = new DOMParser();
                const doc = parser.parseFromString(origSvgStr, 'image/svg+xml');
                const svgEl = doc.documentElement;

                calcContainer.appendChild(svgEl.cloneNode(true));
                const calcSvg = calcContainer.querySelector('svg');
                calcSvg.removeAttribute('width');
                calcSvg.removeAttribute('height');

                try {
                    const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    while (calcSvg.firstChild) wrapper.appendChild(calcSvg.firstChild);
                    calcSvg.appendChild(wrapper);
                    bbox = wrapper.getBBox();

                    updateCroppedSvg();
                    drop.classList.add('hidden');
                    workspace.classList.remove('hidden');
                } catch (err) {}
            }

            function updateCroppedSvg() {
                if (!bbox) return;
                const p = paddingChk.checked ? parseInt(paddingRange.value) : 0;
                const newX = bbox.x - p;
                const newY = bbox.y - p;
                const newW = bbox.width + (p * 2);
                const newH = bbox.height + (p * 2);

                const newVb = `${Math.round(newX * 100) / 100} ${Math.round(newY * 100) / 100} ${Math.round(newW * 100) / 100} ${Math.round(newH * 100) / 100}`;
                viewboxEl.textContent = newVb;

                const parser = new DOMParser();
                const doc = parser.parseFromString(origSvgStr, 'image/svg+xml');
                const svg = doc.documentElement;
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.setAttribute('viewBox', newVb);

                croppedSvgStr = new XMLSerializer().serializeToString(doc);
                preview.innerHTML = croppedSvgStr;
            }

            paddingChk.addEventListener('change', (e) => {
                if (e.target.checked) paddingRange.classList.remove('hidden');
                else paddingRange.classList.add('hidden');
                updateCroppedSvg();
            });

            paddingRange.addEventListener('input', updateCroppedSvg);

            downloadBtn.addEventListener('click', () => {
                if (!croppedSvgStr) return;
                const blob = new Blob([croppedSvgStr], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = addSuffixC(filename || 'output.svg');
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            });

            copyBtn.addEventListener('click', () => {
                if (!croppedSvgStr) return;
                navigator.clipboard.writeText(croppedSvgStr);
            });
        })();
