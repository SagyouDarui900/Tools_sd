import { showToast, escapeHtml } from '../core/utils.js';

        function initExpandUrlTool() {
            const inputEl = document.getElementById('expandUrlInput');
            const runBtn = document.getElementById('expandUrlRunBtn');
            const sampleBtn = document.getElementById('expandUrlSampleBtn');
            const clearBtn = document.getElementById('expandUrlClearBtn');
            const statusBadge = document.getElementById('expandUrlStatusBadge');
            const copyAllBtn = document.getElementById('expandUrlCopyAllBtn');
            const resultsContainer = document.getElementById('expandUrlResultsContainer');

            if (!inputEl || !resultsContainer) return;

            let lastExpandedFinalUrls = [];
            const isStaticHost = window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
            let serverApiAvailable = !isStaticHost;

            async function expandSingleUrl(urlStr) {
                let target = urlStr.trim();
                if (!target) return null;
                if (!/^https?:\/\//i.test(target)) {
                    target = 'https://' + target;
                }

                // Primary: Internal Express API (when running Node.js server)
                if (serverApiAvailable) {
                    try {
                        const res = await fetch('/api/expand-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: target })
                        });
                        if (res.ok) {
                            return await res.json();
                        }
                        if (res.status === 404 || res.status === 405) {
                            serverApiAvailable = false;
                        }
                    } catch(e) {
                        serverApiAvailable = false;
                    }
                }

                // Fallback: Public unshorten API for static hosting (GitHub Pages)
                try {
                    const res = await fetch(`https://unshorten.me/api/v2/unshorten?url=${encodeURIComponent(target)}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.unshortened_url) {
                            return {
                                originalUrl: target,
                                finalUrl: data.unshortened_url,
                                redirectCount: target !== data.unshortened_url ? 1 : 0,
                                chain: [target, data.unshortened_url],
                                status: 'success'
                            };
                        }
                    }
                } catch(e) {}

                return {
                    originalUrl: target,
                    finalUrl: target,
                    redirectCount: 0,
                    chain: [target],
                    status: 'fallback'
                };
            }

            async function runExpandAll(userTriggered = false) {
                const text = inputEl.value.trim();
                if (!text) {
                    resultsContainer.innerHTML = `
                        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); background-color: var(--bg-panel-secondary); border-radius: 4px; border: 1px dashed var(--border-color);">
                            <div style="font-size: 13px; font-weight: 600; color: var(--text-heading);">短縮URLを入力して解析開始</div>
                            <div style="font-size: 11.5px; margin-top: 4px;">bit.ly, t.co, tinyurl などの短縮URLを上に貼り付けてください</div>
                        </div>
                    `;
                    if (statusBadge) statusBadge.textContent = isStaticHost ? '静的環境モード (外部API経由 / 制限あり)' : '';
                    if (copyAllBtn) copyAllBtn.disabled = true;
                    if (userTriggered) showToast('短縮URLを入力してください');
                    return;
                }

                const urls = text.split(/[\r\n\s,]+/).map(u => u.trim()).filter(Boolean);
                if (urls.length === 0) return;

                resultsContainer.innerHTML = '';
                lastExpandedFinalUrls = [];
                if (statusBadge) statusBadge.textContent = `${urls.length}件の短縮URLを解析中...`;

                let failedCount = 0;
                for (let i = 0; i < urls.length; i++) {
                    const res = await expandSingleUrl(urls[i]);
                    if (res) {
                        if (res.status === 'fallback') failedCount++;
                        lastExpandedFinalUrls.push(res.finalUrl);
                        renderResultCard(res, i + 1);
                    }
                }

                if (statusBadge) {
                    statusBadge.textContent = failedCount > 0
                        ? `${urls.length}件処理 (${failedCount}件は静的環境/CORS制限により展開不可)`
                        : `${urls.length}件の短縮URLの展開が完了しました`;
                }
                if (copyAllBtn) copyAllBtn.disabled = false;
                if (userTriggered) {
                    showToast(failedCount > 0
                        ? `完了 (一部展開不可: 静的環境ではローカルサーバー実行を推奨)`
                        : `${urls.length}件の短縮URLを展開しました`);
                }
            }

            function renderResultCard(data, index) {
                const card = document.createElement('div');
                card.className = 'panel';
                card.style.backgroundColor = 'var(--bg-panel)';
                card.style.border = '1px solid var(--border-color)';
                card.style.borderRadius = '6px';
                card.style.padding = '14px';

                const isFallback = data.status === 'fallback';
                const isRedirected = data.redirectCount > 0;
                let parsedFinal = null;
                try {
                    parsedFinal = new URL(data.finalUrl);
                } catch(e) {}
                const isSafeHttp = parsedFinal && (parsedFinal.protocol === 'http:' || parsedFinal.protocol === 'https:');

                const statusBadgeStyle = isFallback
                    ? 'background-color: rgba(239,68,68,0.15); color: #ef4444;'
                    : (isRedirected ? 'background-color: rgba(34,197,94,0.15); color: #22c55e;' : 'opacity: 0.6;');
                const statusBadgeText = isFallback
                    ? '展開不可 (静的環境/CORS制限)'
                    : (isRedirected ? `転送あり (${data.redirectCount}回リダイレクト)` : 'ダイレクト');

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                        <div style="font-weight: 700; font-size: 13px; color: var(--text-heading); display: flex; align-items: center; gap: 8px;">
                            <span style="background-color: var(--accent-primary); color: #fff; font-size: 11px; padding: 1px 6px; border-radius: 3px; font-weight: 700;">#${index}</span>
                            <span style="word-break: break-all;">${escapeHtml(data.originalUrl)}</span>
                        </div>
                        <span class="badge" style="font-size: 11px; ${statusBadgeStyle}">
                            ${statusBadgeText}
                        </span>
                    </div>

                    <!-- FINAL DESTINATION -->
                    <div style="background-color: var(--bg-panel-secondary); padding: 10px 12px; border-radius: 4px; border: 1px solid var(--border-color); margin-bottom: 10px;">
                        <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;">展開後の到達URL (元の長URL)</div>
                        <div style="font-size: 13.5px; font-weight: 700; color: var(--accent-primary); word-break: break-all; line-height: 1.4; font-family: monospace;">
                            ${escapeHtml(data.finalUrl)}
                        </div>
                        ${parsedFinal ? `
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap;">
                                <span>ドメイン: <strong style="color: var(--text-heading);">${escapeHtml(parsedFinal.hostname)}</strong></span>
                                <span>プロトコル: <strong style="color: var(--text-heading);">${escapeHtml(parsedFinal.protocol)}</strong></span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- REDIRECT CHAIN STEPS -->
                    ${data.chain && data.chain.length > 1 ? `
                        <div style="margin-bottom: 10px;">
                            <details style="font-size: 12px; color: var(--text-muted);">
                                <summary style="cursor: pointer; font-weight: 600; color: var(--text-heading); margin-bottom: 6px; user-select: none;">
                                    リダイレクト経路履歴 (${data.chain.length}ステップ) を表示
                                </summary>
                                <div style="display: flex; flex-direction: column; gap: 4px; padding-left: 8px; border-left: 2px solid var(--accent-primary); margin-top: 6px;">
                                    ${data.chain.map((stepUrl, sIdx) => `
                                        <div style="font-family: monospace; font-size: 11.5px; word-break: break-all; padding: 2px 0;">
                                            <span style="color: var(--text-muted); font-weight: 700;">Step ${sIdx + 1}:</span>
                                            <span style="${sIdx === data.chain.length - 1 ? 'color: var(--accent-primary); font-weight: 700;' : 'color: var(--text-main);'}">${escapeHtml(stepUrl)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        </div>
                    ` : ''}

                    <!-- ACTIONS -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-copy-final" style="padding: 4px 12px; font-size: 11.5px;">
                            展開後URLをコピー
                        </button>
                        ${isSafeHttp ? `
                            <a href="${escapeHtml(data.finalUrl)}" target="_blank" rel="noopener noreferrer" class="btn" style="padding: 4px 12px; font-size: 11.5px; text-decoration: none;">
                                展開後ページを開く
                            </a>
                        ` : ''}
                    </div>
                `;

                resultsContainer.appendChild(card);

                // Copy button event
                card.querySelector('.btn-copy-final').addEventListener('click', () => {
                    navigator.clipboard.writeText(data.finalUrl).then(() => {
                        showToast('展開後のURLをコピーしました');
                    });
                });
            }

            if (runBtn) runBtn.addEventListener('click', () => runExpandAll(true));

            if (sampleBtn) {
                sampleBtn.addEventListener('click', () => {
                    inputEl.value = [
                        'https://tinyurl.com/2p8a4u6r',
                        'https://is.gd/S4Wz7E',
                        'https://x.gd/8Xf2l'
                    ].join('\n');
                    runExpandAll(true);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    inputEl.value = '';
                    resultsContainer.innerHTML = '';
                    if (statusBadge) statusBadge.textContent = '';
                    if (copyAllBtn) copyAllBtn.disabled = true;
                    lastExpandedFinalUrls = [];
                });
            }

            if (copyAllBtn) {
                copyAllBtn.addEventListener('click', () => {
                    if (!lastExpandedFinalUrls.length) return;
                    navigator.clipboard.writeText(lastExpandedFinalUrls.join('\n')).then(() => {
                        showToast(`${lastExpandedFinalUrls.length}件の展開後URLをコピーしました`);
                    });
                });
            }

            runExpandAll(false);
        }

        // Initialize this tool safely (previously via initNewTools in app.js)
        try {
            initExpandUrlTool();
        } catch (e) {
            console.warn('Tool initialization skipped due to error:', e);
        }
