import { showToast, escapeHtml } from '../core/utils.js';

// Markdown プレビューのリンクと画像の URL 検査
// 許可するもの: http:、https:、相対パス、フラグメント、スキームなし、
// 画像のみ data:image/png など (data:image/svg+xml は許可しない)。
// それ以外のスキームは許可しない。判定は大文字小文字を区別しない。
// 検査だけのために HTML 実体参照を 1 回復号する。出力には復号した値は使わない。
function decodeEntitiesForUrlCheck(str) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#039': "'" };
    return str.replace(/&(?:#x([0-9A-Fa-f]+)|#(\d+)|(amp|lt|gt|quot|apos|#039));/g, (match, hex, dec, name) => {
        if (hex) {
            const code = parseInt(hex, 16);
            return Number.isNaN(code) ? '' : String.fromCodePoint(code);
        }
        if (dec) {
            const code = parseInt(dec, 10);
            return Number.isNaN(code) ? '' : String.fromCodePoint(code);
        }
        return named[name] || match;
    });
}

const ALLOWED_DATA_IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'x-icon']);

// 安全な URL の場合、空白を除去した元の文字列を返す。安全でない場合は null を返す。
// allowDataImage が true の場合だけ data:image/ を許可する (リンクでは許可しない)。
function sanitizeMarkdownUrl(rawUrl, allowDataImage) {
    if (typeof rawUrl !== 'string') return null;
    const trimmedRaw = rawUrl.replace(/^[\u0000-\u0020]+/, '').replace(/[\u0000-\u0020]+$/, '');
    if (!trimmedRaw) return null;
    const checked = decodeEntitiesForUrlCheck(trimmedRaw)
        .replace(/^[\u0000-\u0020]+/, '')
        .replace(/[\u0000-\u0020]+$/, '');
    if (!checked) return null;

    const colonIndex = checked.indexOf(':');
    if (colonIndex !== -1) {
        const beforeColon = checked.slice(0, colonIndex);
        // コロンの前に / ? # がある場合はスキームのコロンではない (相対パス内のコロン)。
        if (!beforeColon.includes('/') && !beforeColon.includes('?') && !beforeColon.includes('#')) {
            // スキーム内に制御文字や空白がある場合は許可しない。
            // 除去して再判定しない (例: "java\tscript:" は許可しない)。
            if (/[\u0000-\u0020]/.test(beforeColon)) return null;
            const scheme = beforeColon.toLowerCase();
            if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) return null;
            if (scheme === 'http' || scheme === 'https') return trimmedRaw;
            if (scheme === 'data' && allowDataImage) {
                const dataMatch = checked.match(/^data:image\/([a-z0-9.+-]+)[;,]/i);
                if (!dataMatch) return null;
                if (/[\u0000-\u0020]/.test(checked.slice(0, checked.indexOf(',')))) return null;
                if (!ALLOWED_DATA_IMAGE_TYPES.has(dataMatch[1].toLowerCase())) return null;
                return trimmedRaw;
            }
            return null;
        }
    }
    // スキームなし: 相対パス、フラグメント、スキームなしの URL は許可する。
    return trimmedRaw;
}

        function initMarkdownEditor() {
            const textarea = document.getElementById('mdTextarea');
            const preview = document.getElementById('mdPreviewContainer');
            const saveStatus = document.getElementById('mdSaveStatus');
            const templateSelect = document.getElementById('mdTemplateSelect');
            const applyTemplateBtn = document.getElementById('mdApplyTemplateBtn');
            const fileInput = document.getElementById('mdFileInput');
            const clearBtn = document.getElementById('mdClearBtn');

            // View Modes
            const btnModeSplit = document.getElementById('mdViewModeSplit');
            const btnModeEditor = document.getElementById('mdViewModeEditor');
            const btnModePreview = document.getElementById('mdViewModePreview');
            const editorGrid = document.getElementById('mdEditorGrid');
            const editorCol = document.getElementById('mdEditorCol');
            const previewCol = document.getElementById('mdPreviewCol');

            // Export / Action Buttons
            const copyDiscordBtn = document.getElementById('mdCopyDiscordBtn');
            const copyMdBtn = document.getElementById('mdCopyMdBtn');
            const copyRichHtmlBtn = document.getElementById('mdCopyRichHtmlBtn');
            const filenameInput = document.getElementById('mdFilenameInput');
            const downloadBtn = document.getElementById('mdDownloadBtn');

            // Meter & Stats
            const cursorInfo = document.getElementById('mdCursorInfo');
            const discordMeterText = document.getElementById('mdDiscordMeterText');
            const discordMeterBar = document.getElementById('mdDiscordMeterBar');
            const discordStatusBadge = document.getElementById('mdDiscordStatusBadge');

            const statTotalChars = document.getElementById('mdStatTotalChars');
            const statNoSpaceChars = document.getElementById('mdStatNoSpaceChars');
            const statWords = document.getElementById('mdStatWords');
            const statLines = document.getElementById('mdStatLines');
            const statReadTime = document.getElementById('mdStatReadTime');

            if (!textarea || !preview) return;

            // History Stack for Undo/Redo
            const history = [];
            let historyIndex = -1;
            const MAX_HISTORY = 50;

            function pushHistory() {
                const val = textarea.value;
                if (historyIndex >= 0 && history[historyIndex] === val) return;
                history.splice(historyIndex + 1);
                history.push(val);
                if (history.length > MAX_HISTORY) history.shift();
                historyIndex = history.length - 1;
                updateUndoRedoBtns();
            }

            function updateUndoRedoBtns() {
                const btnUndo = document.getElementById('mdBtnUndo');
                const btnRedo = document.getElementById('mdBtnRedo');
                if (btnUndo) btnUndo.disabled = historyIndex <= 0;
                if (btnRedo) btnRedo.disabled = historyIndex >= history.length - 1;
            }

            // Restore saved draft
            try {
                const saved = localStorage.getItem('md_editor_draft');
                if (saved) {
                    textarea.value = saved;
                }
            } catch(e) {}

            pushHistory();

            // RENDER MARKDOWN TO HTML
            function parseMarkdown(mdText) {
                if (!mdText || !mdText.trim()) {
                    return '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding-top: 40px;">マークダウンを入力すると、リアルタイムでプレビューが生成されます</div>';
                }

                let html = escapeHtml(mdText);

                // 1. Code blocks (```lang ... ```)
                html = html.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
                    return `<pre style="background: var(--bg-main); border: 1px solid var(--border-color); padding: 10px 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 8px 0;"><code>${code}</code></pre>`;
                });

                // 2. GitHub Callouts / Alerts (> [!NOTE] etc)
                html = html.replace(/^&gt;\s*\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:&gt;.*(?:\n|$))+)/gm, (_, type, body) => {
                    const cleanBody = body.replace(/^&gt;\s?/gm, '');
                    let color = '#3b82f6';
                    let label = 'NOTE';
                    if (type === 'TIP') { color = '#10b981'; label = 'TIP'; }
                    else if (type === 'IMPORTANT') { color = '#8b5cf6'; label = 'IMPORTANT'; }
                    else if (type === 'WARNING') { color = '#f59e0b'; label = 'WARNING'; }
                    else if (type === 'CAUTION') { color = '#ef4444'; label = 'CAUTION'; }
                    return `<div style="border-left: 4px solid ${color}; background: rgba(0,0,0,0.1); padding: 8px 12px; margin: 8px 0; border-radius: 0 4px 4px 0;"><strong style="color: ${color}; font-size: 11px;">[${label}]</strong><div style="margin-top: 4px;">${cleanBody}</div></div>`;
                });

                // 3. Blockquotes (&gt;)
                html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote style="border-left: 3px solid var(--accent-primary); padding-left: 10px; margin: 6px 0; color: var(--text-muted);">$1</blockquote>');

                // 4. Headings (# ~ ###)
                html = html.replace(/^### (.*$)/gm, '<h3 style="font-size: 15px; font-weight: 700; margin: 12px 0 6px 0; color: var(--text-heading); border-bottom: 1px dashed var(--border-color); padding-bottom: 4px;">$1</h3>');
                html = html.replace(/^## (.*$)/gm, '<h2 style="font-size: 17px; font-weight: 700; margin: 14px 0 6px 0; color: var(--text-heading); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">$1</h2>');
                html = html.replace(/^# (.*$)/gm, '<h1 style="font-size: 20px; font-weight: 800; margin: 16px 0 8px 0; color: var(--text-heading); border-bottom: 2px solid var(--accent-primary); padding-bottom: 6px;">$1</h1>');

                // 5. Horizontal Rules (---)
                html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 12px 0;">');

                // 6. Checkbox lists (- [ ] or - [x])
                html = html.replace(/^- \[ \] (.*)$/gm, '<div style="display: flex; align-items: center; gap: 6px; margin: 3px 0;"><input type="checkbox" disabled> <span>$1</span></div>');
                html = html.replace(/^- \[x\] (.*)$/gi, '<div style="display: flex; align-items: center; gap: 6px; margin: 3px 0;"><input type="checkbox" checked disabled> <span style="text-decoration: line-through; opacity: 0.7;">$1</span></div>');

                // 7. Unordered Lists (- or *)
                html = html.replace(/^[\-\*]\s+(.*)$/gm, '<li style="margin-left: 20px; list-style-type: disc;">$1</li>');

                // 8. Ordered Lists (1. 2. etc)
                html = html.replace(/^\d+\.\s+(.*)$/gm, '<li style="margin-left: 20px; list-style-type: decimal;">$1</li>');

                // 9. Discord Spoiler (||spoiler||)
                html = html.replace(/\|\|(.*?)\|\|/g, '<span style="background-color: #202225; color: #202225; padding: 1px 4px; border-radius: 3px; cursor: pointer;" onclick="this.style.color=\'#fff\'" title="クリックで表示">$1</span>');

                // 10. Inline Code (`code`)
                html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 11.5px;">$1</code>');

                // 11. Bold (**text**) & Italic (*text*) & Strike (~~text~~)
                html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
                html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

                // 12. Images & Links
                // 許可しないスキームのリンクは href を '#' に置き換える。
                // 許可しないスキームの画像は src を除去し、画像を表示しない。
                html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, src) => {
                    const safeSrc = sanitizeMarkdownUrl(src, true);
                    if (safeSrc === null) {
                        return `<img alt="${alt}" style="max-width: 100%; border-radius: 4px; margin: 6px 0;">`;
                    }
                    return `<img src="${safeSrc}" alt="${alt}" style="max-width: 100%; border-radius: 4px; margin: 6px 0;">`;
                });
                html = html.replace(/\[(.*?)\]\((.*?)\)/g, (_, text, href) => {
                    const safeHref = sanitizeMarkdownUrl(href, false);
                    const outHref = safeHref === null ? '#' : safeHref;
                    return `<a href="${outHref}" target="_blank" rel="noopener" style="color: var(--accent-primary); text-decoration: underline;">${text}</a>`;
                });

                // Line breaks (\n)
                html = html.replace(/\n/g, '<br>');

                return html;
            }

            // UPDATE STATS & PREVIEW & AUTOSAVE
            let updateTimer = null;
            function updateEditor() {
                const text = textarea.value;

                // Autosave
                try {
                    localStorage.setItem('md_editor_draft', text);
                    if (saveStatus) saveStatus.textContent = '自動保存: 有効';
                } catch(e) {}

                // Live Preview
                preview.innerHTML = parseMarkdown(text);

                // Stats calculation
                const totalChars = text.length;
                const noSpaceChars = text.replace(/\s/g, '').length;
                const lines = text ? text.split('\n').length : 0;
                const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                const readMinutes = Math.ceil(noSpaceChars / 500); // 約500文字/分

                if (statTotalChars) statTotalChars.textContent = totalChars.toLocaleString();
                if (statNoSpaceChars) statNoSpaceChars.textContent = noSpaceChars.toLocaleString();
                if (statWords) statWords.textContent = words.toLocaleString();
                if (statLines) statLines.textContent = lines.toLocaleString();
                if (statReadTime) statReadTime.textContent = `約 ${readMinutes} 分`;

                // Discord Meter (Limit 2,000)
                const discLimit = 2000;
                const remaining = discLimit - totalChars;
                const pct = Math.min(100, Math.max(0, (totalChars / discLimit) * 100));

                if (discordMeterText) {
                    discordMeterText.textContent = `${totalChars.toLocaleString()} / 2,000 文字 (残り ${remaining.toLocaleString()}字)`;
                    discordMeterText.style.color = totalChars > discLimit ? '#ef4444' : 'var(--text-heading)';
                }
                if (discordMeterBar) {
                    discordMeterBar.style.width = `${pct}%`;
                    discordMeterBar.style.backgroundColor = totalChars > discLimit ? '#ef4444' : (pct > 85 ? '#f59e0b' : 'var(--accent-primary)');
                }
                if (discordStatusBadge) {
                    if (totalChars === 0) {
                        discordStatusBadge.textContent = '1枠で投稿可能';
                        discordStatusBadge.style.backgroundColor = '';
                        discordStatusBadge.style.color = '';
                    } else if (totalChars <= discLimit) {
                        discordStatusBadge.textContent = '1枠で投稿可能';
                        discordStatusBadge.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
                        discordStatusBadge.style.color = '#22c55e';
                    } else {
                        const slots = Math.ceil(totalChars / discLimit);
                        discordStatusBadge.textContent = `要 ${slots}枠に分割投稿`;
                        discordStatusBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                        discordStatusBadge.style.color = '#ef4444';
                    }
                }
            }

            function updateCursorPos() {
                if (!cursorInfo) return;
                const pos = textarea.selectionStart || 0;
                const endPos = textarea.selectionEnd || 0;
                const val = textarea.value;

                const lines = val.substring(0, pos).split('\n');
                const lineNum = lines.length;
                const colNum = lines[lines.length - 1].length + 1;
                const selectedLen = Math.abs(endPos - pos);

                cursorInfo.textContent = `行: ${lineNum} 列: ${colNum} | 選択: ${selectedLen}文字`;
            }

            textarea.addEventListener('input', () => {
                updateEditor();
                clearTimeout(updateTimer);
                updateTimer = setTimeout(pushHistory, 400);
            });
            textarea.addEventListener('keyup', updateCursorPos);
            textarea.addEventListener('click', updateCursorPos);
            textarea.addEventListener('select', updateCursorPos);

            // TEXT INSERTION HELPER
            function wrapOrInsert(prefix, suffix = '', defaultText = '') {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const selected = text.substring(start, end) || defaultText;

                const replacement = prefix + selected + suffix;
                textarea.value = text.substring(0, start) + replacement + text.substring(end);
                
                const newCursorPos = start + prefix.length + selected.length;
                textarea.setSelectionRange(start + prefix.length, newCursorPos);
                textarea.focus();

                updateEditor();
                pushHistory();
            }

            function prependLine(prefix) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;

                const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = text.indexOf('\n', end);
                const actualEnd = lineEnd === -1 ? text.length : lineEnd;

                const targetText = text.substring(lineStart, actualEnd);
                const lines = targetText.split('\n');
                const modifiedLines = lines.map(line => prefix + line);
                const replacement = modifiedLines.join('\n');

                textarea.value = text.substring(0, lineStart) + replacement + text.substring(actualEnd);
                textarea.setSelectionRange(lineStart, lineStart + replacement.length);
                textarea.focus();

                updateEditor();
                pushHistory();
            }

            // TOOLBAR BUTTON HANDLERS
            const btnMap = {
                'mdBtnBold': () => wrapOrInsert('**', '**', '太字テキスト'),
                'mdBtnItalic': () => wrapOrInsert('*', '*', '斜体テキスト'),
                'mdBtnStrike': () => wrapOrInsert('~~', '~~', '打ち消しテキスト'),
                'mdBtnUnderline': () => wrapOrInsert('<u>', '</u>', '下線テキスト'),
                'mdBtnInlineCode': () => wrapOrInsert('`', '`', 'code'),
                'mdBtnH1': () => prependLine('# '),
                'mdBtnH2': () => prependLine('## '),
                'mdBtnH3': () => prependLine('### '),
                'mdBtnUl': () => prependLine('- '),
                'mdBtnOl': () => prependLine('1. '),
                'mdBtnTask': () => prependLine('- [ ] '),
                'mdBtnQuote': () => prependLine('> '),
                'mdBtnCodeBlock': () => wrapOrInsert('```typescript\n', '\n```', '// ここにコードを入力'),
                'mdBtnTable': () => wrapOrInsert('\n| 項目A | 項目B | 項目C |\n|---|---|---|\n| データ1 | データ2 | データ3 |\n'),
                'mdBtnHr': () => wrapOrInsert('\n---\n'),
                'mdBtnLink': () => wrapOrInsert('[', '](https://example.com)', 'リンクテキスト'),
                'mdBtnImage': () => wrapOrInsert('![', '](https://via.placeholder.com/600x300)', '画像名'),
                
                // Discord / GitHub
                'mdBtnDiscordSpoiler': () => wrapOrInsert('||', '||', 'ネタバレ注意'),
                'mdBtnDiscordSubtext': () => prependLine('-# '),
                'mdBtnDiscordTimestamp': () => wrapOrInsert(`<t:${Math.floor(Date.now()/1000)}:R>`),
                'mdBtnDiscordQuoteMulti': () => prependLine('>>> '),
                'mdBtnDiscordAnsi': () => wrapOrInsert('```ansi\n\u001b[31m赤色テキスト\u001b[0m\n```'),
                'mdBtnGhAlert': () => wrapOrInsert('> [!NOTE]\n> ここに補足注意事項を入力してください\n'),
                'mdBtnShieldsBadge': () => wrapOrInsert('![Badge](https://img.shields.io/badge/Status-Active-brightgreen)\n'),
                'mdBtnDetails': () => wrapOrInsert('<details>\n<summary>折りたたみを展開</summary>\n\n詳細なコンテンツがここに表示されます\n\n</details>\n'),

                // Text Formatting
                'mdBtnZenHanAlpha': () => {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const val = textarea.value;
                    const target = val.substring(start, end) || val;
                    const converted = target.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                    if (start !== end) {
                        textarea.value = val.substring(0, start) + converted + val.substring(end);
                    } else {
                        textarea.value = converted;
                    }
                    updateEditor();
                    pushHistory();
                    showToast('全角英数を半角に変換しました');
                },
                'mdBtnHanZenKana': () => {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const val = textarea.value;
                    const target = val.substring(start, end) || val;
                    const kanaMap = {
                        'ｶﾞ':'ガ','ｷﾞ':'ギ','ｸﾞ':'グ','ｹﾞ':'ゲ','ｺﾞ':'ゴ',
                        'ｻﾞ':'ザ','ｼﾞ':'ジ','ｽﾞ':'ズ','ｾﾞ':'ゼ','ｿﾞ':'ゾ',
                        'ﾀﾞ':'ダ','ﾁﾞ':'ヂ','ﾂﾞ':'ヅ','ﾃﾞ':'デ','ﾄﾞ':'ド',
                        'ﾊﾞ':'バ','ﾋﾞ':'ビ','ﾌﾞ':'ブ','ﾍﾞ':'ベ','ﾎﾞ':'ボ',
                        'ﾊﾟ':'パ','ﾋﾟ':'ピ','ﾌﾟ':'プ','ﾍﾟ':'ペ','ﾎﾟ':'ポ',
                        'ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ',
                        'ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
                        'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ',
                        'ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
                        'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
                        'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
                        'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ',
                        'ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
                        'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
                        'ﾜ':'ワ','ｦ':'ヲ','ﾝ':'ン','ｧ':'ァ','ｨ':'ィ',
                        'ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ','ｯ':'ッ','ｬ':'ャ',
                        'ｭ':'ュ','ｮ':'ョ','ｰ':'ー','ﾟ':'゜','ﾞ':'ﾞ'
                    };
                    const reg = new RegExp(Object.keys(kanaMap).join('|'), 'g');
                    const converted = target.replace(reg, s => kanaMap[s] || s);
                    if (start !== end) {
                        textarea.value = val.substring(0, start) + converted + val.substring(end);
                    } else {
                        textarea.value = converted;
                    }
                    updateEditor();
                    pushHistory();
                    showToast('半角カナを全角に変換しました');
                },
                'mdBtnCaseToggle': () => {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const val = textarea.value;
                    const target = val.substring(start, end) || val;
                    const isUpper = target === target.toUpperCase();
                    const converted = isUpper ? target.toLowerCase() : target.toUpperCase();
                    if (start !== end) {
                        textarea.value = val.substring(0, start) + converted + val.substring(end);
                    } else {
                        textarea.value = converted;
                    }
                    updateEditor();
                    pushHistory();
                    showToast(isUpper ? '小文字に変換しました' : '大文字に変換しました');
                },
                'mdBtnCleanLines': () => {
                    let val = textarea.value;
                    val = val.replace(/[ \t]+$/gm, '');
                    val = val.replace(/\n{3,}/g, '\n\n');
                    textarea.value = val;
                    updateEditor();
                    pushHistory();
                    showToast('連続空行および行末スペースを整理しました');
                },
                'mdBtnPunctToggle': () => {
                    let val = textarea.value;
                    if (val.includes('、') || val.includes('。')) {
                        val = val.replaceAll('、', '，').replaceAll('。', '．');
                        showToast('「，」「．」に変換しました');
                    } else {
                        val = val.replaceAll('，', '、').replaceAll('。', '．');
                        showToast('「、」「。」に変換しました');
                    }
                    textarea.value = val;
                    updateEditor();
                    pushHistory();
                }
            };

            Object.keys(btnMap).forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.addEventListener('click', btnMap[btnId]);
                }
            });

            // Undo / Redo Click Handlers
            const btnUndo = document.getElementById('mdBtnUndo');
            const btnRedo = document.getElementById('mdBtnRedo');
            if (btnUndo) {
                btnUndo.addEventListener('click', () => {
                    if (historyIndex > 0) {
                        historyIndex--;
                        textarea.value = history[historyIndex];
                        updateEditor();
                        updateUndoRedoBtns();
                    }
                });
            }
            if (btnRedo) {
                btnRedo.addEventListener('click', () => {
                    if (historyIndex < history.length - 1) {
                        historyIndex++;
                        textarea.value = history[historyIndex];
                        updateEditor();
                        updateUndoRedoBtns();
                    }
                });
            }

            // Keyboard Shortcuts inside Textarea
            textarea.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); btnMap['mdBtnBold'](); }
                    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); btnMap['mdBtnItalic'](); }
                    else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); btnMap['mdBtnLink'](); }
                    else if (e.key === 'z' || e.key === 'Z') {
                        if (e.shiftKey) {
                            e.preventDefault();
                            if (btnRedo) btnRedo.click();
                        } else {
                            e.preventDefault();
                            if (btnUndo) btnUndo.click();
                        }
                    } else if (e.key === 'y' || e.key === 'Y') {
                        e.preventDefault();
                        if (btnRedo) btnRedo.click();
                    }
                }
            });

            // VIEW MODE SWITCHING
            if (btnModeSplit && btnModeEditor && btnModePreview && editorGrid && editorCol && previewCol) {
                btnModeSplit.addEventListener('click', () => {
                    editorGrid.style.display = 'grid';
                    editorGrid.style.gridTemplateColumns = '1fr 1fr';
                    editorCol.style.display = 'block';
                    previewCol.style.display = 'block';
                    [btnModeSplit, btnModeEditor, btnModePreview].forEach(b => b.classList.remove('btn-primary'));
                    btnModeSplit.classList.add('btn-primary');
                });
                btnModeEditor.addEventListener('click', () => {
                    editorGrid.style.display = 'block';
                    editorCol.style.display = 'block';
                    previewCol.style.display = 'none';
                    [btnModeSplit, btnModeEditor, btnModePreview].forEach(b => b.classList.remove('btn-primary'));
                    btnModeEditor.classList.add('btn-primary');
                });
                btnModePreview.addEventListener('click', () => {
                    editorGrid.style.display = 'block';
                    editorCol.style.display = 'none';
                    previewCol.style.display = 'block';
                    [btnModeSplit, btnModeEditor, btnModePreview].forEach(b => b.classList.remove('btn-primary'));
                    btnModePreview.classList.add('btn-primary');
                });
            }

            // TEMPLATE INSERTION
            const TEMPLATES = {
                layout_callouts: `# GitHub コールアウト記法サンプル\n\n> [!NOTE]\n> ここは補足情報や重要知識を記載するノートエリアです。\n\n> [!TIP]\n> 作業効率を上げるTipsやヒントを記載します。\n\n> [!IMPORTANT]\n> 見落とし厳禁な開発ルールや手順です。\n\n> [!WARNING]\n> 警告事項や注意事項を記載します。\n\n> [!CAUTION]\n> 非推奨な操作やリスクのあるコマンドです。\n`,
                readme: `# プロジェクト名\n\n簡易的なプロジェクトの説明文をここに記載します。\n\n## 🚀 特徴\n\n- ✨ 軽量で高速な動作\n- 🎨 直感的なユーザーインターフェース\n- 📦 依存関係なし\n\n## 🛠️ 使い方\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## 📄 ライセンス\n\nMIT License\n`,
                release_note: `# リリースノート v1.2.0\n\n**リリース日:** 2026年9月12日\n\n### 🌟 新機能・改善\n- 音素データベースのパス一括置換ログ表示機能を追加\n- Markdownエディタのリアルタイムプレビューを強化\n\n### 🐛 バグ修正\n- ファイルドロップ時の文字化けを修正\n`,
                meeting_notes: `# ミーティング議事録\n\n**日時:** 2026/09/12 10:00 - 11:00\n**参加者:** 山田, 田中, 鈴木\n\n## 📋 議題\n1. 新機能の仕様確認\n2. スケジュール調整\n\n## 決定事項\n- [x] パス置換ログ機能の実装決定\n- [ ] 来週月曜日にα版リリース\n`,
                tech_spec: `# 技術仕様書: 音素DB解析モジュール\n\n## 1. 概要\n音素データベース (JSON) 内のファイルパスおよび音素パラメータを構造解析・変換するシステム。\n\n## 2. データ構造\n\`\`\`json\n{\n  "Version": "1.3.1",\n  "SongData": []\n}\n\`\`\`\n`,
                discord_post: `# 📢 お知らせフォーマット\n\nユーザーの皆様へ\n\n新機能アップデートを公開しました！\n\n-# 詳細は下記URLをご確認ください\n\n||https://example.com/update-info||\n`
            };

            if (applyTemplateBtn && templateSelect) {
                applyTemplateBtn.addEventListener('click', () => {
                    const key = templateSelect.value;
                    if (!key || !TEMPLATES[key]) {
                        showToast('テンプレートを選択してください');
                        return;
                    }
                    textarea.value = TEMPLATES[key];
                    updateEditor();
                    pushHistory();
                    showToast('定型テンプレートを適用しました');
                });
            }

            // FILE INPUT & CLEAR
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (filenameInput) filenameInput.value = file.name;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        textarea.value = event.target.result;
                        updateEditor();
                        pushHistory();
                        showToast(`「${file.name}」を読み込みました`);
                    };
                    reader.readAsText(file);
                    fileInput.value = '';
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    textarea.value = '';
                    updateEditor();
                    pushHistory();
                    showToast('エディタをクリアしました');
                });
            }

            // EXPORT & COPY HANDLERS
            if (copyMdBtn) {
                copyMdBtn.addEventListener('click', () => {
                    const val = textarea.value;
                    if (!val) { showToast('コピーするテキストがありません'); return; }
                    navigator.clipboard.writeText(val).then(() => showToast('Markdownテキストをコピーしました'));
                });
            }

            if (copyDiscordBtn) {
                copyDiscordBtn.addEventListener('click', () => {
                    const val = textarea.value;
                    if (!val) { showToast('コピーするテキストがありません'); return; }
                    navigator.clipboard.writeText(val).then(() => showToast('Discord形式テキストをコピーしました'));
                });
            }

            if (copyRichHtmlBtn) {
                copyRichHtmlBtn.addEventListener('click', () => {
                    const htmlContent = preview.innerHTML;
                    if (!htmlContent) { showToast('コピーするプレビューがありません'); return; }

                    try {
                        const blobInput = new Blob([htmlContent], { type: 'text/html' });
                        const blobText = new Blob([textarea.value], { type: 'text/plain' });
                        const item = new ClipboardItem({
                            'text/html': blobInput,
                            'text/plain': blobText
                        });
                        navigator.clipboard.write([item]).then(() => showToast('リッチテキスト(HTML)をクリップボードにコピーしました'));
                    } catch(e) {
                        navigator.clipboard.writeText(htmlContent).then(() => showToast('HTMLテキストをコピーしました'));
                    }
                });
            }

            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    const val = textarea.value;
                    if (!val) { showToast('保存するテキストがありません'); return; }
                    const fn = (filenameInput ? filenameInput.value.trim() : '') || 'document.md';
                    const blob = new Blob([val], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fn.endsWith('.md') ? fn : fn + '.md';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    showToast(`「${a.download}」を保存しました`);
                });
            }

            // Initial Update
            updateEditor();
            updateCursorPos();
        }

        // Initialize this tool safely (previously via initNewTools in app.js)
        try {
            initMarkdownEditor();
        } catch (e) {
            console.warn('Tool initialization skipped due to error:', e);
        }
