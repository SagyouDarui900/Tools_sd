import { escapeHtml } from '../core/utils.js';

        (function() {
            const state = {
                characters: [],
                selectedIndex: 0
            };

            const GOJUON_MATRIX = [
                { title: "清音", data: [
                    ['あ', 'い', 'う', 'え', 'お'],
                    ['か', 'き', 'く', 'け', 'こ'],
                    ['さ', 'し', 'す', 'せ', 'そ'],
                    ['た', 'ち', 'つ', 'て', 'と'],
                    ['な', 'に', 'ぬ', 'ね', 'の'],
                    ['は', 'ひ', 'ふ', 'へ', 'ほ'],
                    ['ま', 'み', 'む', 'め', 'も'],
                    ['や', '', 'ゆ', '', 'よ'],
                    ['ら', 'り', 'る', 'れ', 'ろ'],
                    ['わ', 'を', 'ん', '息', '']
                ]},
                { title: "濁音・半濁音", data: [
                    ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
                    ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
                    ['だ', 'ぢ', 'づ', 'で', 'ど'],
                    ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
                    ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']
                ]},
                { title: "拗音", data: [
                    ['きゃ', 'きゅ', 'きょ'],
                    ['しゃ', 'しゅ', 'しょ'],
                    ['ちゃ', 'ちゅ', 'ちょ'],
                    ['にゃ', 'にゅ', 'にょ'],
                    ['ひゃ', 'ひゅ', 'ひょ'],
                    ['みゃ', 'みゅ', 'みょ'],
                    ['りゃ', 'りゅ', 'りょ'],
                    ['ぎゃ', 'ぎゅ', 'ぎょ'],
                    ['じゃ', 'じゅ', 'じょ'],
                    ['びゃ', 'びゅ', 'びょ'],
                    ['ぴゃ', 'ぴゅ', 'ぴょ']
                ]}
            ];

            const PREDEFINED_SET = new Set();
            GOJUON_MATRIX.forEach(g => g.data.forEach(r => r.forEach(p => { if (p) PREDEFINED_SET.add(p); })));

            const dropZone = document.getElementById('pdbDropZone');
            const fileInput = document.getElementById('pdbFileInput');
            const charSelectGroup = document.getElementById('pdbCharSelectGroup');
            const charSelect = document.getElementById('pdbCharSelect');
            const charCountChip = document.getElementById('pdbCharCountChip');
            const statsSummary = document.getElementById('pdbStatsSummary');
            const mainContent = document.getElementById('pdbMainContent');
            const resetBtn = document.getElementById('pdbResetBtn');

            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                handleFiles(e.dataTransfer.files);
            });

            charSelect.addEventListener('change', (e) => {
                state.selectedIndex = parseInt(e.target.value) || 0;
                renderUI();
            });

            resetBtn.addEventListener('click', () => {
                state.characters = [];
                state.selectedIndex = 0;
                charSelectGroup.classList.add('hidden');
                statsSummary.classList.add('hidden');
                mainContent.classList.add('hidden');
                resetBtn.classList.add('hidden');
                fileInput.value = '';
            });

            function handleFiles(files) {
                const promises = Array.from(files).map(file => {
                    return new Promise(resolve => {
                        if (!file.name.endsWith('.json')) return resolve();
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            try {
                                const json = JSON.parse(e.target.result);
                                processCharJSON(json, file.name);
                            } catch (err) {}
                            resolve();
                        };
                        reader.readAsText(file);
                    });
                });

                Promise.all(promises).then(() => {
                    if (state.characters.length > 0) {
                        state.selectedIndex = state.characters.length - 1; // 最新のファイルを選択
                        renderUI();
                    }
                });
            }

            function recalculateCharObj(charObj) {
                charObj.songs = [];
                charObj.phonemesMap = new Map();
                charObj.pitchesMap = new Map();
                charObj.totalPhonemes = 0;

                charObj.json.SongData.forEach(song => {
                    let fullPath = song.Path || "不明なパス";
                    let title = song.Path ? song.Path.split(/[\\/]/).pop() : "不明な楽曲";
                    const songInfo = { title, fullPath, playTime: song.PlayTime || 0, phonemeCount: 0, lyric: song.Lyric || '' };

                    if (song.Children && Array.isArray(song.Children)) {
                        songInfo.phonemeCount = song.Children.length;
                        song.Children.forEach(child => {
                            const name = child.Name ? child.Name.trim() : '';
                            if (!name) return;

                            charObj.totalPhonemes++;
                            if (!charObj.phonemesMap.has(name)) charObj.phonemesMap.set(name, { count: 0, pitches: new Set() });
                            const pData = charObj.phonemesMap.get(name);
                            pData.count++;

                            if (child.Pitch && child.Pitch.trim()) {
                                pData.pitches.add(child.Pitch);
                                charObj.pitchesMap.set(child.Pitch, (charObj.pitchesMap.get(child.Pitch) || 0) + 1);
                            }
                        });
                    }
                    charObj.songs.push(songInfo);
                });
            }

            function processCharJSON(json, filename) {
                if (!json.SongData || !Array.isArray(json.SongData)) return;

                const charObj = {
                    name: filename.replace(/\.json$/i, ''),
                    filename: filename,
                    json: json,
                    songs: [],
                    phonemesMap: new Map(),
                    pitchesMap: new Map(),
                    totalPhonemes: 0
                };

                recalculateCharObj(charObj);
                state.characters.push(charObj);
            }

            function removeSongFromChar(currentChar, idx) {
                currentChar.json.SongData.splice(idx, 1);
                recalculateCharObj(currentChar);
                renderUI();
            }

            const pdbDownloadJsonBtn = document.getElementById('pdbDownloadJsonBtn');
            if (pdbDownloadJsonBtn) {
                pdbDownloadJsonBtn.addEventListener('click', () => {
                    const currentChar = state.characters[state.selectedIndex];
                    if (!currentChar) return;
                    
                    // 一部の厳格なパーサーを持つ外部ツールでの読み込みエラー（クラッシュ）を防ぐため、コンパクトなJSON（改行・インデントなし）で出力します
                    const jsonStr = JSON.stringify(currentChar.json);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = currentChar.filename;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                });
            }

            function renderUI() {
                if (!state.characters.length) return;

                charSelectGroup.classList.remove('hidden');
                statsSummary.classList.remove('hidden');
                mainContent.classList.remove('hidden');
                resetBtn.classList.remove('hidden');

                // キャラクターセレクトボックス構築
                charSelect.innerHTML = state.characters.map((c, idx) => `
                    <option value="${idx}" ${idx === state.selectedIndex ? 'selected' : ''}>
                        ${escapeHtml(c.name)} (${c.songs.length}曲 / ${c.totalPhonemes.toLocaleString()}音素)
                    </option>
                `).join('');

                charCountChip.textContent = `${state.characters.length} キャラクター読み込み済み`;

                const currentChar = state.characters[state.selectedIndex];
                if (!currentChar) return;

                document.getElementById('pdbStatSongs').textContent = currentChar.songs.length;
                document.getElementById('pdbStatPhonemes').textContent = currentChar.totalPhonemes.toLocaleString();
                document.getElementById('pdbStatUnique').textContent = `${currentChar.phonemesMap.size} 種類`;

                renderGojuon(currentChar);
                renderPitchCanvas(currentChar);
                renderSongCards(currentChar);
            }

            function renderGojuon(currentChar) {
                const container = document.getElementById('pdbGojuonContainer');
                container.innerHTML = '';

                GOJUON_MATRIX.forEach(group => {
                    let html = `<div style="display: flex; flex-direction: column; gap: 4px; direction: ltr;">`;
                    html += `<label>${group.title}</label><div style="display: flex; gap: 4px;">`;

                    for (let i = group.data.length - 1; i >= 0; i--) {
                        let col = group.data[i];
                        html += `<div style="display: flex; flex-direction: column; gap: 4px; width: 44px;">`;
                        col.forEach(ph => {
                            if (!ph) {
                                html += `<div class="phoneme-cell" style="border-color: transparent; background: transparent;"></div>`;
                            } else {
                                const data = currentChar.phonemesMap.get(ph);
                                const count = data ? data.count : 0;
                                let cls = '';
                                if (count > 0 && count < 10) cls = 'count-low';
                                else if (count >= 10 && count < 50) cls = 'count-med';
                                else if (count >= 50) cls = 'count-high';

                                html += `<div class="phoneme-cell ${cls}" data-count="${count}">
                                    <span>${ph}</span>
                                    ${count > 0 ? `<span style="font-size: 9px; opacity: 0.8;">${count}</span>` : ''}
                                </div>`;
                            }
                        });
                        html += `</div>`;
                    }
                    html += `</div></div>`;
                    container.innerHTML += html;
                });

                // Other phonemes
                const otherContainer = document.getElementById('pdbOtherPhonemes');
                let otherHtml = '';
                Array.from(currentChar.phonemesMap.keys())
                    .filter(k => !PREDEFINED_SET.has(k))
                    .forEach(ph => {
                        const count = currentChar.phonemesMap.get(ph).count;
                        otherHtml += `<span class="chip">${escapeHtml(ph)}: ${count}</span>`;
                    });
                otherContainer.innerHTML = otherHtml || '<span style="color: var(--text-muted);">その他なし</span>';
            }

            function renderPitchCanvas(currentChar) {
                const canvas = document.getElementById('pdbPitchCanvas');
                if (!canvas) return;
                const parentW = canvas.parentElement ? (canvas.parentElement.clientWidth - 16) : 550;
                if (parentW > 100) {
                    canvas.width = parentW;
                }
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const entries = Array.from(currentChar.pitchesMap.entries());
                if (!entries.length) {
                    document.getElementById('pdbStatLowest').textContent = '-';
                    document.getElementById('pdbStatHighest').textContent = '-';
                    document.getElementById('pdbStatMost').textContent = '-';
                    return;
                }

                const PITCH_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
                function getPitchVal(pStr) {
                    const m = pStr.match(/([A-G]#?)(\d)/);
                    if (m) return parseInt(m[2]) * 12 + PITCH_ORDER.indexOf(m[1]);
                    return 0;
                }

                entries.sort((a, b) => getPitchVal(a[0]) - getPitchVal(b[0]));
                document.getElementById('pdbStatLowest').textContent = entries[0][0];
                document.getElementById('pdbStatHighest').textContent = entries[entries.length - 1][0];

                let maxCount = 0, mostPitch = '';
                entries.forEach(e => { if (e[1] > maxCount) { maxCount = e[1]; mostPitch = e[0]; } });
                document.getElementById('pdbStatMost').textContent = `${mostPitch} (${maxCount}回)`;

                // Draw Bar Chart
                const padding = 35;
                const w = canvas.width - padding * 2;
                const h = canvas.height - padding * 2;
                const barWidth = Math.max(4, Math.floor(w / entries.length) - 2);

                ctx.strokeStyle = '#484854';
                ctx.beginPath();
                ctx.moveTo(padding, canvas.height - padding);
                ctx.lineTo(canvas.width - padding, canvas.height - padding);
                ctx.stroke();

                entries.forEach((entry, idx) => {
                    const barH = Math.floor((entry[1] / maxCount) * h);
                    const x = padding + idx * (barWidth + 2);
                    const y = canvas.height - padding - barH;

                    ctx.fillStyle = '#007acc';
                    ctx.fillRect(x, y, barWidth, barH);

                    if (entries.length < 25 || idx % Math.ceil(entries.length / 15) === 0) {
                        ctx.fillStyle = '#808090';
                        ctx.font = '9px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(entry[0], x + barWidth / 2, canvas.height - padding + 12);
                    }
                });
            }

            function renderSongCards(currentChar) {
                const container = document.getElementById('pdbSongCards');
                container.innerHTML = currentChar.songs.map((song, idx) => `
                    <div class="panel" style="margin: 0; background-color: var(--bg-panel-secondary);">
                        <div class="flex-between mb-1">
                            <span style="font-weight: 700; word-break: break-all;">${escapeHtml(song.title)}</span>
                            <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                                <span class="chip">${song.phonemeCount} 音素</span>
                                <button class="btn btn-danger pdb-song-del-btn" data-idx="${idx}" style="padding: 2px 6px; font-size: 10px;">楽曲を削除</button>
                            </div>
                        </div>
                        <div style="font-size: 10px; color: var(--accent-primary); margin-bottom: 6px; word-break: break-all;">
                            ${escapeHtml(song.fullPath)}
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
                            再生時間: ${(song.playTime / 1000).toFixed(1)}s
                        </div>
                        <textarea readonly style="height: 50px; font-size: 10px; color: var(--text-muted); width: 100%; border: 1px solid var(--border-color); background-color: var(--bg-panel); padding: 4px; resize: none;">${escapeHtml(song.lyric || '歌詞データなし')}</textarea>
                    </div>
                `).join('');

                container.querySelectorAll('.pdb-song-del-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(e.currentTarget.dataset.idx);
                        const song = currentChar.songs[idx];
                        if (confirm(`以下の楽曲データ全体をJSONから削除しますか？\n\nファイル名: ${song.title}\nパス: ${song.fullPath}\n\n※ブラウザ上のデータのみ削除されます。保存するには後で「編集済みJSONを保存」を押してください。`)) {
                            removeSongFromChar(currentChar, idx);
                        }
                    });
                });
            }

            // Tabs
            document.querySelectorAll('.pdb-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.pdb-tab-btn').forEach(b => b.classList.remove('btn-primary'));
                    document.querySelectorAll('.pdb-tab-content').forEach(c => c.classList.add('hidden'));
                    btn.classList.add('btn-primary');
                    document.getElementById(btn.dataset.tab).classList.remove('hidden');
                    if (btn.dataset.tab === 'pdb-tab-pitch' && state.characters.length && state.characters[state.selectedIndex]) {
                        renderPitchCanvas(state.characters[state.selectedIndex]);
                    }
                });
            });

            window.addEventListener('resize', () => {
                const pitchTab = document.getElementById('pdb-tab-pitch');
                if (pitchTab && !pitchTab.classList.contains('hidden') && state.characters.length && state.characters[state.selectedIndex]) {
                    renderPitchCanvas(state.characters[state.selectedIndex]);
                }
            });
        })();
