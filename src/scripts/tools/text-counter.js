import { escapeHtml } from '../core/utils.js';

        (function() {
            const editor = document.getElementById('tcEditor');
            const targetInput = document.getElementById('tcTargetInput');
            const targetPills = document.querySelectorAll('.tc-target-pill');
            const progressBar = document.getElementById('tcProgressBar');
            const progressPercentEl = document.getElementById('tcProgressPercent');
            const progressDiffEl = document.getElementById('tcProgressDiff');
            const targetRangeAdviceEl = document.getElementById('tcTargetRangeAdvice');
            const manuscriptBadgeEl = document.getElementById('tcManuscriptBadge');
            const cursorPosEl = document.getElementById('tcCursorPos');
            const lastSavedEl = document.getElementById('tcLastSaved');
            const toastEl = document.getElementById('tcToast');

            // KPI Stats Elements
            const statTotalChars = document.getElementById('tcStatTotalChars');
            const statNoSpaceChars = document.getElementById('tcStatNoSpaceChars');
            const statLettersOnly = document.getElementById('tcStatLettersOnly');
            const statWordCount = document.getElementById('tcStatWordCount');
            const statLines = document.getElementById('tcStatLines');
            const statLinesSub = document.getElementById('tcStatLinesSub');
            const statParagraphs = document.getElementById('tcStatParagraphs');
            const statGenko400 = document.getElementById('tcStatGenko400');
            const statGenko200 = document.getElementById('tcStatGenko200');
            const statReadTime = document.getElementById('tcStatReadTime');
            const statSpeechTime = document.getElementById('tcStatSpeechTime');

            // Composition Elements
            const kanjiRateBadge = document.getElementById('tcKanjiRateBadge');
            const readabilityBox = document.getElementById('tcReadabilityBox');
            const countHiragana = document.getElementById('tcCountHiragana');
            const pctHiragana = document.getElementById('tcPctHiragana');
            const countKatakana = document.getElementById('tcCountKatakana');
            const pctKatakana = document.getElementById('tcPctKatakana');
            const countKanji = document.getElementById('tcCountKanji');
            const pctKanji = document.getElementById('tcPctKanji');
            const countAlpha = document.getElementById('tcCountAlpha');
            const pctAlpha = document.getElementById('tcPctAlpha');
            const countNumber = document.getElementById('tcCountNumber');
            const pctNumber = document.getElementById('tcPctNumber');
            const countSymbol = document.getElementById('tcCountSymbol');
            const pctSymbol = document.getElementById('tcPctSymbol');
            const countSpace = document.getElementById('tcCountSpace');
            const pctSpace = document.getElementById('tcPctSpace');
            const countNewline = document.getElementById('tcCountNewline');
            const pctNewline = document.getElementById('tcPctNewline');

            // Bar Segments
            const segHiragana = document.getElementById('tcSegHiragana');
            const segKatakana = document.getElementById('tcSegKatakana');
            const segKanji = document.getElementById('tcSegKanji');
            const segAlpha = document.getElementById('tcSegAlpha');
            const segNumber = document.getElementById('tcSegNumber');
            const segSymbol = document.getElementById('tcSegSymbol');
            const segSpace = document.getElementById('tcSegSpace');

            // Toolbar & Buttons
            const toolIndent = document.getElementById('tcToolIndent');
            const toolCleanLines = document.getElementById('tcToolCleanLines');
            const toolPunctToggle = document.getElementById('tcToolPunctToggle');
            const toolZenHanAlpha = document.getElementById('tcToolZenHanAlpha');
            const toolHanZenKana = document.getElementById('tcToolHanZenKana');
            const toolCaseToggle = document.getElementById('tcToolCaseToggle');
            const toolUndo = document.getElementById('tcToolUndo');
            const copyBtn = document.getElementById('tcCopyBtn');
            const saveTxtBtn = document.getElementById('tcSaveTxtBtn');
            const clearBtn = document.getElementById('tcClearBtn');
            const fileInput = document.getElementById('tcFileInput');
            const fontSizeSm = document.getElementById('tcFontSizeSm');
            const fontSizeMd = document.getElementById('tcFontSizeMd');
            const fontSizeLg = document.getElementById('tcFontSizeLg');

            // Snapshots
            const saveSnapshotBtn = document.getElementById('tcSaveSnapshotBtn');
            const snapshotListEl = document.getElementById('tcSnapshotList');

            // State & Undo History
            const undoStack = [];
            const MAX_UNDO = 40;
            let autoSaveTimer = null;

            function showToast(msg) {
                if (!toastEl) return;
                toastEl.textContent = msg;
                toastEl.classList.add('show');
                setTimeout(() => toastEl.classList.remove('show'), 2200);
            }

            function pushUndoState() {
                if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== editor.value) {
                    undoStack.push(editor.value);
                    if (undoStack.length > MAX_UNDO) undoStack.shift();
                    toolUndo.disabled = false;
                }
            }

            function updateCursorInfo() {
                const text = editor.value;
                const pos = editor.selectionStart || 0;
                const end = editor.selectionEnd || 0;
                const before = text.substring(0, pos);
                const lineNum = (before.match(/\n/g) || []).length + 1;
                const lastNl = before.lastIndexOf('\n');
                const colNum = lastNl === -1 ? pos + 1 : pos - lastNl;
                const selectedCount = Math.abs(end - pos);

                cursorPosEl.textContent = `カーソル: ${lineNum}行目 ${colNum}文字目 | 選択: ${selectedCount}文字`;
            }

            // Word Count Helper
            function countWords(text) {
                if (!text || !text.trim()) return 0;
                if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                    try {
                        const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
                        let count = 0;
                        for (const seg of segmenter.segment(text)) {
                            if (seg.isWordLike && seg.segment.trim().length > 0) {
                                count++;
                            }
                        }
                        return count;
                    } catch (e) {}
                }
                // Fallback word counter: count Japanese tokens & alphanumeric sequences
                const words = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF]+|[a-zA-Z0-9_-]+/g);
                return words ? words.length : 0;
            }

            // Halfwidth Kana to Fullwidth Map
            const kanaMap = {
                'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
                'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
                'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
                'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
                'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
                'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
                'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
                'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
                'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
                'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
                'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
                'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
                'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
                'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
                'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
                'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
                'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
                'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
                'ｰ': 'ー', '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・'
            };

            function calculateStats() {
                const text = editor.value;
                const target = parseInt(targetInput.value, 10) || 800;

                // 1. Array representation for accurate surrogate pair handling
                const chars = Array.from(text);
                const totalChars = chars.length;

                // No spaces & no newlines
                const noSpaceText = text.replace(/[\s\u3000\r\n\t]/g, '');
                const noSpaceCount = Array.from(noSpaceText).length;

                // Letters only (alphanumeric, Kanji, Hiragana, Katakana - excluding symbols/punctuation/spaces)
                const lettersOnlyMatches = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9Fa-zA-Z0-9ａ-ｚＡ-Ｚ０-９]/g) || [];
                const lettersOnlyCount = lettersOnlyMatches.length;

                // Words
                const wordCount = countWords(text);

                // Lines
                const allLines = text ? text.split(/\r\n|\r|\n/) : [];
                const totalLines = allLines.length;
                const nonEmptyLines = allLines.filter(l => l.trim().length > 0).length;

                // Paragraphs (continuous blocks)
                const paragraphs = text ? text.split(/\n+/).filter(p => p.trim().length > 0).length : 0;

                // Manuscript calculation (400 chars: 20 chars per line, line break on paragraph)
                let genkoLines = 0;
                if (allLines.length > 0) {
                    for (const line of allLines) {
                        const len = Array.from(line).length;
                        genkoLines += Math.ceil(len / 20) || 1;
                    }
                }
                const sheets400 = Math.floor(genkoLines / 20);
                const remainLines400 = genkoLines % 20;
                const genko200Approx = (noSpaceCount / 200).toFixed(1);

                // Reading & speech time
                const readTimeMin = (noSpaceCount / 500).toFixed(1);
                const speechTimeMin = (noSpaceCount / 300).toFixed(1);

                // Update KPI Elements
                statTotalChars.textContent = totalChars.toLocaleString();
                statNoSpaceChars.textContent = noSpaceCount.toLocaleString();
                statLettersOnly.textContent = lettersOnlyCount.toLocaleString();
                statWordCount.textContent = wordCount.toLocaleString();
                statLines.textContent = totalLines.toLocaleString();
                statLinesSub.textContent = `空行除く: ${nonEmptyLines} 行`;
                statParagraphs.textContent = paragraphs.toLocaleString();
                statGenko400.textContent = `${sheets400}枚 ${remainLines400}行`;
                statGenko200.textContent = `200字詰: 約${genko200Approx}枚 (総${genkoLines}行)`;
                statReadTime.textContent = `約 ${readTimeMin} 分`;
                statSpeechTime.textContent = `音読/発表: 約 ${speechTimeMin} 分`;
                manuscriptBadgeEl.textContent = `400字詰: ${sheets400}枚 ${remainLines400}行 (原稿用紙約 ${(genkoLines / 20).toFixed(1)} 枚分)`;

                // 2. Target Progress & Color
                const progressPct = target > 0 ? (noSpaceCount / target) * 100 : 0;
                const diff = target - noSpaceCount;
                const minTarget = Math.round(target * 0.9);
                const maxTarget = Math.round(target * 1.1);

                progressBar.style.width = `${Math.min(100, progressPct)}%`;
                progressPercentEl.textContent = `達成率: ${progressPct.toFixed(1)}%`;
                targetRangeAdviceEl.textContent = `レポート推奨目安: ${minTarget}〜${maxTarget}字 (±10%)`;

                if (diff > 0) {
                    if (noSpaceCount >= minTarget) {
                        progressDiffEl.textContent = `適正範囲内 (残り ${diff} 字)`;
                        progressDiffEl.style.color = 'var(--accent-green)';
                        progressDiffEl.style.borderColor = 'rgba(52, 211, 153, 0.4)';
                        progressDiffEl.style.backgroundColor = 'rgba(52, 211, 153, 0.12)';
                        progressBar.style.backgroundColor = 'var(--accent-green)';
                    } else {
                        progressDiffEl.textContent = `目標まで残り ${diff} 字`;
                        progressDiffEl.style.color = 'var(--accent-primary)';
                        progressDiffEl.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                        progressDiffEl.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
                        progressBar.style.backgroundColor = 'var(--accent-primary)';
                    }
                } else if (diff === 0) {
                    progressDiffEl.textContent = `目標達成`;
                    progressDiffEl.style.color = 'var(--accent-green)';
                    progressDiffEl.style.borderColor = 'rgba(52, 211, 153, 0.4)';
                    progressDiffEl.style.backgroundColor = 'rgba(52, 211, 153, 0.15)';
                    progressBar.style.backgroundColor = 'var(--accent-green)';
                } else {
                    const over = Math.abs(diff);
                    if (noSpaceCount <= maxTarget) {
                        progressDiffEl.textContent = `適正範囲内 (+${over}字)`;
                        progressDiffEl.style.color = 'var(--accent-green)';
                        progressDiffEl.style.borderColor = 'rgba(52, 211, 153, 0.4)';
                        progressDiffEl.style.backgroundColor = 'rgba(52, 211, 153, 0.12)';
                        progressBar.style.backgroundColor = 'var(--accent-green)';
                    } else {
                        progressDiffEl.textContent = `目標を +${over} 字 超過`;
                        progressDiffEl.style.color = 'var(--accent-red)';
                        progressDiffEl.style.borderColor = 'rgba(248, 113, 113, 0.4)';
                        progressDiffEl.style.backgroundColor = 'rgba(248, 113, 113, 0.12)';
                        progressBar.style.backgroundColor = 'var(--accent-amber)';
                    }
                }

                // 3. Character Breakdown
                const hiraganaMatches = text.match(/[\u3040-\u309F]/g) || [];
                const katakanaMatches = text.match(/[\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F]/g) || [];
                const kanjiMatches = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g) || [];
                const alphaMatches = text.match(/[a-zA-Zａ-ｚＡ-Ｚ]/g) || [];
                const numberMatches = text.match(/[0-9０-９]/g) || [];
                const symbolMatches = text.match(/[^\s\u3000\r\n\t\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9Fa-zA-Z0-9ａ-ｚＡ-Ｚ０-９]/g) || [];
                const spaceMatches = text.match(/[ \t\u3000]/g) || [];
                const newlineMatches = text.match(/[\r\n]/g) || [];

                const cHiragana = hiraganaMatches.length;
                const cKatakana = katakanaMatches.length;
                const cKanji = kanjiMatches.length;
                const cAlpha = alphaMatches.length;
                const cNumber = numberMatches.length;
                const cSymbol = symbolMatches.length;
                const cSpace = spaceMatches.length;
                const cNewline = newlineMatches.length;

                const baseTotal = totalChars || 1;
                const pHiragana = ((cHiragana / baseTotal) * 100).toFixed(1);
                const pKatakana = ((cKatakana / baseTotal) * 100).toFixed(1);
                const pKanji = ((cKanji / baseTotal) * 100).toFixed(1);
                const pAlpha = ((cAlpha / baseTotal) * 100).toFixed(1);
                const pNumber = ((cNumber / baseTotal) * 100).toFixed(1);
                const pSymbol = ((cSymbol / baseTotal) * 100).toFixed(1);
                const pSpace = ((cSpace / baseTotal) * 100).toFixed(1);
                const pNewline = ((cNewline / baseTotal) * 100).toFixed(1);

                countHiragana.textContent = cHiragana; pctHiragana.textContent = pHiragana;
                countKatakana.textContent = cKatakana; pctKatakana.textContent = pKatakana;
                countKanji.textContent = cKanji; pctKanji.textContent = pKanji;
                countAlpha.textContent = cAlpha; pctAlpha.textContent = pAlpha;
                countNumber.textContent = cNumber; pctNumber.textContent = pNumber;
                countSymbol.textContent = cSymbol; pctSymbol.textContent = pSymbol;
                countSpace.textContent = cSpace; pctSpace.textContent = pSpace;
                countNewline.textContent = cNewline; pctNewline.textContent = pNewline;

                segHiragana.style.width = `${pHiragana}%`;
                segKatakana.style.width = `${pKatakana}%`;
                segKanji.style.width = `${pKanji}%`;
                segAlpha.style.width = `${pAlpha}%`;
                segNumber.style.width = `${pNumber}%`;
                segSymbol.style.width = `${pSymbol}%`;
                segSpace.style.width = `${parseFloat(pSpace) + parseFloat(pNewline)}%`;

                // 4. Kanji Rate & Readability Advice
                const japaneseChars = cHiragana + cKatakana + cKanji;
                const kanjiRate = japaneseChars > 0 ? ((cKanji / japaneseChars) * 100) : 0;
                kanjiRateBadge.textContent = `漢字率: ${kanjiRate.toFixed(1)}%`;

                if (totalChars === 0) {
                    kanjiRateBadge.style.color = 'var(--text-muted)';
                    kanjiRateBadge.style.borderColor = 'var(--border-color)';
                    kanjiRateBadge.style.backgroundColor = 'transparent';
                    readabilityBox.innerHTML = `<strong>文章可読性診断:</strong> 本文を入力すると漢字率や文章バランスのアドバイスが表示されます。`;
                } else if (kanjiRate >= 25 && kanjiRate <= 35) {
                    kanjiRateBadge.style.color = 'var(--accent-green)';
                    kanjiRateBadge.style.borderColor = 'rgba(52, 211, 153, 0.4)';
                    kanjiRateBadge.style.backgroundColor = 'rgba(52, 211, 153, 0.12)';
                    readabilityBox.innerHTML = `<strong>適正 (漢字率 ${kanjiRate.toFixed(1)}%):</strong> レポート・文章として最も読みやすく、バランスの取れた漢字率です。`;
                } else if (kanjiRate > 35 && kanjiRate <= 45) {
                    kanjiRateBadge.style.color = 'var(--accent-amber)';
                    kanjiRateBadge.style.borderColor = 'rgba(251, 191, 36, 0.4)';
                    kanjiRateBadge.style.backgroundColor = 'rgba(251, 191, 36, 0.12)';
                    readabilityBox.innerHTML = `<strong>やや硬め (漢字率 ${kanjiRate.toFixed(1)}%):</strong> 学術論文や論理的なレポートに適したトーンです。`;
                } else if (kanjiRate > 45) {
                    kanjiRateBadge.style.color = 'var(--accent-red)';
                    kanjiRateBadge.style.borderColor = 'rgba(248, 113, 113, 0.4)';
                    kanjiRateBadge.style.backgroundColor = 'rgba(248, 113, 113, 0.12)';
                    readabilityBox.innerHTML = `<strong>漢字多め (漢字率 ${kanjiRate.toFixed(1)}%):</strong> 文章が硬く難解な印象を与える可能性があります。一部接続詞や補助動詞をひらがなにすると読みやすくなります。`;
                } else {
                    kanjiRateBadge.style.color = 'var(--accent-primary)';
                    kanjiRateBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                    kanjiRateBadge.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
                    readabilityBox.innerHTML = `<strong>ひらがな多め (漢字率 ${kanjiRate.toFixed(1)}%):</strong> 平易で読みやすい反面、フォーマルな文章としては少し口語的に見える場合があります。`;
                }

                // 5. Trigger debounced auto-save
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(() => {
                    saveToLocalStorage();
                }, 800);
            }

            function saveToLocalStorage() {
                try {
                    localStorage.setItem('workspace_tc_text', editor.value);
                    localStorage.setItem('workspace_tc_target', targetInput.value);
                    const now = new Date();
                    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                    lastSavedEl.textContent = `自動保存: ${timeStr}`;
                } catch (e) {}
            }

            function loadFromLocalStorage() {
                try {
                    const savedText = localStorage.getItem('workspace_tc_text');
                    const savedTarget = localStorage.getItem('workspace_tc_target');
                    if (savedText !== null) editor.value = savedText;
                    if (savedTarget !== null) {
                        targetInput.value = savedTarget;
                        highlightTargetPill(savedTarget);
                    }
                } catch (e) {}
            }

            function highlightTargetPill(num) {
                targetPills.forEach(pill => {
                    if (pill.dataset.targetNum === String(num)) {
                        pill.classList.add('active');
                    } else {
                        pill.classList.remove('active');
                    }
                });
            }

            // Snapshots Management
            function getSnapshots() {
                try {
                    return JSON.parse(localStorage.getItem('workspace_tc_snapshots') || '[]');
                } catch (e) {
                    return [];
                }
            }

            function saveSnapshots(list) {
                try {
                    localStorage.setItem('workspace_tc_snapshots', JSON.stringify(list));
                } catch (e) {}
            }

            function renderSnapshots() {
                const list = getSnapshots();
                if (!snapshotListEl) return;
                if (list.length === 0) {
                    snapshotListEl.innerHTML = `<div style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 6px;">保存されたスナップショットはありません</div>`;
                    return;
                }

                snapshotListEl.innerHTML = '';
                list.forEach((snap, idx) => {
                    const item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.justifyContent = 'space-between';
                    item.style.padding = '4px 8px';
                    item.style.background = 'var(--bg-panel)';
                    item.style.border = '1px solid var(--border-color)';
                    item.style.gap = '6px';

                    const info = document.createElement('div');
                    info.style.overflow = 'hidden';
                    info.style.textOverflow = 'ellipsis';
                    info.style.whiteSpace = 'nowrap';
                    info.style.flex = '1';
                    info.innerHTML = `<strong>${snap.date}</strong> <span style="color: var(--accent-primary); font-weight:700;">(${snap.chars}字)</span> <span style="color: var(--text-muted);">${escapeHtml(snap.preview)}</span>`;

                    const btnGroup = document.createElement('div');
                    btnGroup.style.display = 'flex';
                    btnGroup.style.gap = '4px';

                    const restoreBtn = document.createElement('button');
                    restoreBtn.className = 'btn btn-primary';
                    restoreBtn.style.padding = '1px 6px';
                    restoreBtn.style.fontSize = '10px';
                    restoreBtn.textContent = '復元';
                    restoreBtn.addEventListener('click', () => {
                        pushUndoState();
                        editor.value = snap.text;
                        calculateStats();
                        showToast('下書きスナップショットを復元しました');
                    });

                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-danger';
                    delBtn.style.padding = '1px 5px';
                    delBtn.style.fontSize = '10px';
                    delBtn.textContent = '×';
                    delBtn.addEventListener('click', () => {
                        const cur = getSnapshots();
                        cur.splice(idx, 1);
                        saveSnapshots(cur);
                        renderSnapshots();
                    });

                    btnGroup.appendChild(restoreBtn);
                    btnGroup.appendChild(delBtn);
                    item.appendChild(info);
                    item.appendChild(btnGroup);
                    snapshotListEl.appendChild(item);
                });
            }

            // EVENT LISTENERS
            let charCounterAnimationFrame = null;
            editor.addEventListener('input', () => {
                if (charCounterAnimationFrame) cancelAnimationFrame(charCounterAnimationFrame);
                charCounterAnimationFrame = requestAnimationFrame(() => {
                    calculateStats();
                    updateCursorInfo();
                });
            });

            editor.addEventListener('keyup', updateCursorInfo);
            editor.addEventListener('click', updateCursorInfo);
            editor.addEventListener('select', updateCursorInfo);

            targetInput.addEventListener('input', () => {
                highlightTargetPill(targetInput.value);
                calculateStats();
            });

            targetPills.forEach(pill => {
                pill.addEventListener('click', () => {
                    const num = pill.dataset.targetNum;
                    targetInput.value = num;
                    highlightTargetPill(num);
                    calculateStats();
                });
            });

            // Quick Format Tools
            toolIndent.addEventListener('click', () => {
                pushUndoState();
                const lines = editor.value.split(/\r?\n/);
                const indented = lines.map(line => {
                    if (line.trim().length === 0) return line;
                    const cleaned = line.replace(/^[ 　\t]+/, '');
                    return '　' + cleaned;
                });
                editor.value = indented.join('\n');
                calculateStats();
                showToast('段落先頭に全角字下げを適用しました');
            });

            toolCleanLines.addEventListener('click', () => {
                pushUndoState();
                let val = editor.value;
                // Trim trailing space from each line
                val = val.split(/\r?\n/).map(l => l.replace(/[ \t　]+$/, '')).join('\n');
                // Replace 3+ consecutive newlines with 2
                val = val.replace(/\n{3,}/g, '\n\n');
                editor.value = val;
                calculateStats();
                showToast('余分な空行・行末空白を整理しました');
            });

            if (toolPunctToggle) toolPunctToggle.addEventListener('click', () => {
                pushUndoState();
                let val = editor.value;
                const hasAcademic = val.includes('，') || val.includes('．');
                if (hasAcademic) {
                    // Convert to standard 「、」「。」
                    val = val.replace(/，/g, '、').replace(/．/g, '。');
                    showToast('句読点を標準「、」「。」に変換しました');
                } else {
                    // Convert to academic 「，」「．」
                    val = val.replace(/、/g, '，').replace(/。/g, '．');
                    showToast('句読点を学術・論文形式「，」「．」に変換しました');
                }
                editor.value = val;
                calculateStats();
            });

            if (toolZenHanAlpha) toolZenHanAlpha.addEventListener('click', () => {
                pushUndoState();
                let val = editor.value;
                // Convert fullwidth alphanumeric to halfwidth
                val = val.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                editor.value = val;
                calculateStats();
                showToast('全角英数字を半角に変換しました');
            });

            if (toolHanZenKana) toolHanZenKana.addEventListener('click', () => {
                pushUndoState();
                let val = editor.value;
                for (const [han, zen] of Object.entries(kanaMap)) {
                    val = val.split(han).join(zen);
                }
                editor.value = val;
                calculateStats();
                showToast('半角カタカナを全角に変換しました');
            });

            if (toolCaseToggle) toolCaseToggle.addEventListener('click', () => {
                pushUndoState();
                let val = editor.value;
                const hasLower = /[a-z]/.test(val);
                if (hasLower) {
                    val = val.toUpperCase();
                    showToast('英字を大文字に統一しました');
                } else {
                    val = val.toLowerCase();
                    showToast('英字を小文字に統一しました');
                }
                editor.value = val;
                calculateStats();
            });

            if (toolUndo) toolUndo.addEventListener('click', () => {
                if (undoStack.length > 0) {
                    editor.value = undoStack.pop();
                    calculateStats();
                    if (undoStack.length === 0) toolUndo.disabled = true;
                    showToast('直前の操作を取り消しました');
                }
            });

            if (copyBtn) copyBtn.addEventListener('click', () => {
                if (!editor.value) {
                    showToast('コピーする本文がありません');
                    return;
                }
                navigator.clipboard.writeText(editor.value).then(() => {
                    showToast('本文をクリップボードにコピーしました！');
                }).catch(() => {
                    editor.select();
                    document.execCommand('copy');
                    showToast('コピーしました');
                });
            });

            if (saveTxtBtn) saveTxtBtn.addEventListener('click', () => {
                const text = editor.value;
                if (!text) {
                    showToast('保存するテキストがありません');
                    return;
                }
                const now = new Date();
                const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
                const filename = `レポート_${statNoSpaceChars.textContent}字_${dateStr}.txt`;

                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                showToast(`${filename} をダウンロードしました`);
            });

            if (clearBtn) clearBtn.addEventListener('click', () => {
                if (!editor.value) return;
                if (confirm('入力中の本文をすべて消去しますか？\n（※「元に戻す」で復元可能です）')) {
                    pushUndoState();
                    editor.value = '';
                    calculateStats();
                    showToast('エディタをクリアしました');
                }
            });

            if (fileInput) fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    pushUndoState();
                    editor.value = evt.target.result || '';
                    calculateStats();
                    showToast(`ファイル「${file.name}」を読み込みました`);
                    fileInput.value = '';
                };
                reader.readAsText(file, 'utf-8');
            });

            // Drag and drop onto editor
            if (editor) {
                editor.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    editor.style.borderColor = 'var(--accent-primary)';
                });
                editor.addEventListener('dragleave', () => {
                    editor.style.borderColor = '';
                });
                editor.addEventListener('drop', (e) => {
                    e.preventDefault();
                    editor.style.borderColor = '';
                    const files = e.dataTransfer && e.dataTransfer.files;
                    if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            pushUndoState();
                            editor.value = evt.target.result || '';
                            calculateStats();
                            showToast(`ファイル「${file.name}」を読み込みました`);
                        };
                        reader.readAsText(file, 'utf-8');
                    }
                });
            }

            // Font size toggles
            if (fontSizeSm) fontSizeSm.addEventListener('click', () => {
                editor.style.fontSize = '12px';
                fontSizeSm.classList.add('btn-primary');
                fontSizeMd.classList.remove('btn-primary');
                fontSizeLg.classList.remove('btn-primary');
            });
            if (fontSizeMd) fontSizeMd.addEventListener('click', () => {
                editor.style.fontSize = '14px';
                fontSizeMd.classList.add('btn-primary');
                fontSizeSm.classList.remove('btn-primary');
                fontSizeLg.classList.remove('btn-primary');
            });
            if (fontSizeLg) fontSizeLg.addEventListener('click', () => {
                editor.style.fontSize = '17px';
                fontSizeLg.classList.add('btn-primary');
                fontSizeSm.classList.remove('btn-primary');
                fontSizeMd.classList.remove('btn-primary');
            });

            // Snapshot Save
            if (saveSnapshotBtn) saveSnapshotBtn.addEventListener('click', () => {
                const text = editor.value;
                if (!text.trim()) {
                    showToast('保存する下書き本文がありません');
                    return;
                }
                const now = new Date();
                const dateStr = `${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                const chars = Array.from(text.replace(/[\s\u3000\r\n\t]/g, '')).length;
                const preview = text.trim().substring(0, 30).replace(/\n/g, ' ') + '...';

                const list = getSnapshots();
                list.unshift({
                    date: dateStr,
                    chars: chars,
                    preview: preview,
                    text: text
                });
                if (list.length > 5) list.pop(); // keep last 5
                saveSnapshots(list);
                renderSnapshots();
                showToast('スナップショットを履歴に保存しました');
            });

            // Initial load & stats calculation
            loadFromLocalStorage();
            calculateStats();
            renderSnapshots();
        })();
