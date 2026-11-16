import { showToast, escapeHtml } from '../core/utils.js';

        function initReaperPathEditor() {
            const dropZone = document.getElementById('rpDropZone');
            const fileInput = document.getElementById('rpFileInput');
            const inputText = document.getElementById('rpInputText');
            const outputText = document.getElementById('rpOutputText');
            const optOwner = document.getElementById('rpOptOwner');
            const oldPathInput = document.getElementById('rpOldPath');
            const newPathInput = document.getElementById('rpNewPath');
            const applyBtn = document.getElementById('rpApplyBtn');
            const copyBtn = document.getElementById('rpCopyBtn');
            const downloadBtn = document.getElementById('rpDownloadBtn');
            const resetBtn = document.getElementById('rpResetBtn');
            const samplePhonemeBtn = document.getElementById('rpSamplePhonemeBtn');
            const summaryBox = document.getElementById('rpSummaryBox');
            const totalPathsEl = document.getElementById('rpTotalPaths');
            const replacedPathsEl = document.getElementById('rpReplacedPaths');
            const fileNameTag = document.getElementById('rpFileNameTag');
            const logPanel = document.getElementById('rpLogPanel');
            const logList = document.getElementById('rpLogList');
            const logBadge = document.getElementById('rpLogBadge');
            const clearLogBtn = document.getElementById('rpClearLogBtn');

            if (!inputText || !outputText) return;

            let loadedFileName = 'project.rpp';

            function updateReplacementLogs(origText, newText) {
                if (!logPanel || !logList) return;
                if (!origText.trim() || origText === newText) {
                    logPanel.classList.add('hidden');
                    logList.innerHTML = '';
                    if (logBadge) logBadge.textContent = '変更箇所: 0件';
                    return;
                }

                const origLines = origText.split(/\r?\n/);
                const newLines = newText.split(/\r?\n/);
                const logs = [];

                const maxLen = Math.max(origLines.length, newLines.length);
                const MAX_DIFF_LOGS = 500;
                for (let i = 0; i < maxLen; i++) {
                    const oldL = origLines[i] || '';
                    const newL = newLines[i] || '';
                    if (oldL !== newL) {
                        logs.push({
                            line: i + 1,
                            oldStr: oldL.trim(),
                            newStr: newL.trim()
                        });
                        if (logs.length >= MAX_DIFF_LOGS) break;
                    }
                }

                if (logs.length === 0) {
                    logPanel.classList.add('hidden');
                    return;
                }

                logPanel.classList.remove('hidden');
                if (logBadge) logBadge.textContent = `変更箇所: ${logs.length}件`;
                logList.innerHTML = '';

                logs.slice(0, 100).forEach(item => {
                    const card = document.createElement('div');
                    card.style.backgroundColor = 'var(--bg-main)';
                    card.style.border = '1px solid var(--border-color)';
                    card.style.borderRadius = '4px';
                    card.style.padding = '6px 10px';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                    card.style.gap = '3px';

                    card.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 10px;">
                            <span style="font-weight: 700;">Line ${item.line}</span>
                            <button class="btn btn-copy-line" style="padding: 1px 6px; font-size: 10px;">変更後パスをコピー</button>
                        </div>
                        <div style="color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 3px 6px; border-radius: 3px; word-break: break-all;">
                            - ${escapeHtml(item.oldStr)}
                        </div>
                        <div style="color: #22c55e; background: rgba(34, 197, 94, 0.08); padding: 3px 6px; border-radius: 3px; word-break: break-all; font-weight: 600;">
                            + ${escapeHtml(item.newStr)}
                        </div>
                    `;

                    card.querySelector('.btn-copy-line').addEventListener('click', () => {
                        navigator.clipboard.writeText(item.newStr).then(() => {
                            showToast(`Line ${item.line} の変更後パスをコピーしました`);
                        });
                    });

                    logList.appendChild(card);
                });

                if (logs.length > 100) {
                    const moreNotice = document.createElement('div');
                    moreNotice.style.textAlign = 'center';
                    moreNotice.style.color = 'var(--text-muted)';
                    moreNotice.style.padding = '6px';
                    moreNotice.style.fontSize = '11px';
                    moreNotice.textContent = `...他 ${logs.length - 100} 件の変更箇所があります`;
                    logList.appendChild(moreNotice);
                }
            }

            if (clearLogBtn) {
                clearLogBtn.addEventListener('click', () => {
                    if (logList) logList.innerHTML = '';
                    if (logPanel) logPanel.classList.add('hidden');
                    if (logBadge) logBadge.textContent = '変更箇所: 0件';
                    showToast('置換ログをクリアしました');
                });
            }

            function processRpp() {
                const text = inputText.value;
                if (resetBtn) {
                    resetBtn.classList.toggle('hidden', !text.trim());
                }

                if (!text.trim()) {
                    outputText.value = '';
                    if (summaryBox) summaryBox.classList.add('hidden');
                    updateReplacementLogs('', '');
                    return;
                }

                let newText = text;
                let pathCount = 0;
                let replacedCount = 0;

                // Path matching regex (matches both RPP quotes & JSON escaped paths)
                const pathRegex = /(["'])([a-zA-Z]:(?:\\[\\[a-zA-Z0-9_.\-\s\u3000-\u9fff]+|\\\/[^"'\r\n]+|\\[^"'\r\n]+)|\/[^"'\r\n]+)\1/g;
                const matches = text.match(pathRegex) || [];
                pathCount = matches.length;

                // 1. Replace username with owner (handles single backslash, double escaped backslash, and slashes)
                if (optOwner && optOwner.checked) {
                    // Windows single backslash: C:\Users\xxx\
                    newText = newText.replace(/([a-zA-Z]:\\Users\\)[^\\]+(\\)/gi, '$1owner$2');
                    // Windows double escaped backslash in JSON: C:\\Users\\xxx\\
                    newText = newText.replace(/([a-zA-Z]:\\\\Users\\\\)[^\\\\]+(\\\\)/gi, '$1owner$2');
                    // Mac/Linux slash: /Users/xxx/ & /home/xxx/
                    newText = newText.replace(/(\/Users\/)[^\/]+(\/)/gi, '$1owner$2');
                    newText = newText.replace(/(\/home\/)[^\/]+(\/)/gi, '$1owner$2');
                }

                // 2. Custom Path replacement
                if (oldPathInput && newPathInput) {
                    const oldVal = oldPathInput.value.trim();
                    const newVal = newPathInput.value.trim();
                    if (oldVal) {
                        newText = newText.replaceAll(oldVal, newVal);
                        // Also try replace escaped backslashes if input was single backslash in JSON
                        if (oldVal.includes('\\') && !oldVal.includes('\\\\')) {
                            const escapedOld = oldVal.replaceAll('\\', '\\\\');
                            const escapedNew = newVal.replaceAll('\\', '\\\\');
                            newText = newText.replaceAll(escapedOld, escapedNew);
                        }
                    }
                }

                if (text !== newText) {
                    const origLines = text.split('\n');
                    const newLines = newText.split('\n');
                    for (let i = 0; i < origLines.length; i++) {
                        if (origLines[i] !== newLines[i]) {
                            replacedCount++;
                        }
                    }
                }

                outputText.value = newText;
                if (summaryBox) summaryBox.classList.remove('hidden');
                if (totalPathsEl) totalPathsEl.textContent = pathCount.toLocaleString();
                if (replacedPathsEl) replacedPathsEl.textContent = replacedCount.toLocaleString();
                if (fileNameTag) fileNameTag.textContent = `ファイル: ${loadedFileName}`;

                updateReplacementLogs(text, newText);
            }

            let rppDebounce = null;
            function scheduleProcessRpp() {
                if (rppDebounce) clearTimeout(rppDebounce);
                rppDebounce = setTimeout(() => {
                    processRpp();
                }, 100);
            }

            inputText.addEventListener('input', scheduleProcessRpp);
            if (optOwner) optOwner.addEventListener('change', () => processRpp());
            if (oldPathInput) oldPathInput.addEventListener('input', scheduleProcessRpp);
            if (newPathInput) newPathInput.addEventListener('input', scheduleProcessRpp);
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    processRpp();
                    showToast('パス変換処理を実行しました');
                });
            }

            if (samplePhonemeBtn) {
                samplePhonemeBtn.addEventListener('click', () => {
                    const sampleJson = JSON.stringify({
                        "Version": "1.3.1",
                        "Name": "C:\\Users\\tsuru\\Videos\\音MAD素材\\シャニマス\\Vocal抽出\\斑鳩ルカ\\luca.json",
                        "SongData": [
                            {
                                "Path": "C:\\Users\\tsuru\\Videos\\音MAD素材\\シャニマス\\Vocal抽出\\斑鳩ルカ\\aiview-luca.wav",
                                "PlayTime": 146250,
                                "SamplingRate": 44100,
                                "Lyric": "息あいなびゅ 息いぇ",
                                "Children": [
                                    { "Name": "息", "Pitch": "", "Midicent": -1, "Path": null, "StartTime": 112.7, "EndTime": 412.4 },
                                    { "Name": "あ", "Pitch": "A#4", "Midicent": 7006.9, "Path": null, "StartTime": 404.0, "EndTime": 622.0 }
                                ]
                            }
                        ]
                    }, null, 2);

                    inputText.value = sampleJson;
                    loadedFileName = 'phoneme_db.json';
                    if (oldPathInput) oldPathInput.value = 'C:\\Users\\tsuru';
                    if (newPathInput) newPathInput.value = 'C:\\Users\\owner';
                    processRpp();
                    showToast('音素DBサンプルJSONを挿入しました');
                });
            }

            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    loadedFileName = file.name;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        inputText.value = event.target.result;
                        processRpp();
                        showToast(`「${file.name}」を読み込みました`);
                    };
                    reader.readAsText(file);
                    fileInput.value = '';
                });
            }

            if (dropZone) {
                dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
                dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
                dropZone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('drag-over');
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const file = e.dataTransfer.files[0];
                        loadedFileName = file.name;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            inputText.value = event.target.result;
                            processRpp();
                            showToast(`「${file.name}」を読み込みました`);
                        };
                        reader.readAsText(file);
                    }
                });
            }

            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const val = outputText.value;
                    if (!val) { showToast('コピーする変換結果がありません'); return; }
                    navigator.clipboard.writeText(val).then(() => showToast('変換後テキストをコピーしました'));
                });
            }

            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    const val = outputText.value;
                    if (!val) { showToast('保存するテキストがありません'); return; }
                    const isJson = loadedFileName.toLowerCase().endsWith('.json') || val.trim().startsWith('{');
                    const mimeType = isJson ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
                    const defaultName = isJson ? 'phoneme_db_modified.json' : 'project_modified.rpp';
                    const blob = new Blob([val], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = loadedFileName || defaultName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast(`「${a.download}」をダウンロードしました`);
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    inputText.value = '';
                    outputText.value = '';
                    if (oldPathInput) oldPathInput.value = '';
                    if (newPathInput) newPathInput.value = '';
                    if (summaryBox) summaryBox.classList.add('hidden');
                    resetBtn.classList.add('hidden');
                    loadedFileName = 'project.rpp';
                    if (fileInput) fileInput.value = '';
                    showToast('入力をクリアしました');
                });
            }
        }

        // Initialize this tool safely (previously via initNewTools in app.js)
        try {
            initReaperPathEditor();
        } catch (e) {
            console.warn('Tool initialization skipped due to error:', e);
        }
