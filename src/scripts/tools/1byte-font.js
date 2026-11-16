        (function() {
            const baseKanaToJis = {
                'ア':'3', 'イ':'e', 'ウ':'4', 'エ':'5', 'オ':'6',
                'カ':'t', 'キ':'g', 'ク':'h', 'ケ':':', 'コ':'b',
                'サ':'x', 'シ':'d', 'ス':'r', 'セ':'p', 'ソ':'c',
                'タ':'q', 'チ':'a', 'ツ':'z', 'テ':'w', 'ト':'s',
                'ナ':'u', 'ニ':'i', 'ヌ':'1', 'ネ':',', 'ノ':'k',
                'ハ':'f', 'ヒ':'v', 'フ':'2', 'ヘ':'^', 'ホ':'-',
                'マ':'j', 'ミ':'n', 'ム':']', 'メ':'/', 'モ':'m',
                'ヤ':'7', 'ユ':'8', 'ヨ':'9',
                'ラ':'o', 'リ':'l', 'ル':'.', 'レ':';', 'ロ':'\\',
                'ワ':'0', 'ヲ':'~', 'ン':'y',
                'ァ':'#', 'ィ':'E', 'ゥ':'$', 'ェ':'%', 'ォ':'&',
                'ャ':'\'', 'ュ':'(', 'ョ':')', 'ッ':'Z',
                'ー':'\\', '・':'/', '、':',', '。':'.'
            };

            const dakutenMap = {
                'ガ':'t@', 'ギ':'g@', 'グ':'h@', 'ゲ':':@', 'ゴ':'b@',
                'ザ':'x@', 'ジ':'d@', 'ズ':'r@', 'ゼ':'p@', 'ゾ':'c@',
                'ダ':'q@', 'ヂ':'a@', 'ヅ':'z@', 'デ':'w@', 'ド':'s@',
                'バ':'f@', 'ビ':'v@', 'ブ':'2@', 'ベ':'^@', 'ボ':'-@',
                'ヴ':'4@',
                'パ':'f[', 'ピ':'v[', 'プ':'2[', 'ペ':'^[', 'ポ':'-['
            };

            const input = document.getElementById('oneByteInput');
            const output = document.getElementById('oneByteOutput');
            const hasDakuten = document.getElementById('oneByteHasDakuten');
            const copyBtn = document.getElementById('oneByteCopyBtn');
            const clearBtn = document.getElementById('oneByteClearBtn');
            const inputClearBtn = document.getElementById('oneByteInputClearBtn');

            function convert() {
                let t = input.value;
                // Convert hiragana to katakana
                t = t.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));

                let res = '';
                for (let i = 0; i < t.length; i++) {
                    const char = t[i];
                    if (hasDakuten.checked && dakutenMap[char]) {
                        res += dakutenMap[char];
                    } else if (baseKanaToJis[char]) {
                        res += baseKanaToJis[char];
                    } else {
                        res += char;
                    }
                }
                output.value = res;
            }

            function clearAll() {
                input.value = '';
                output.value = '';
                input.focus();
            }

            input.addEventListener('input', convert);
            hasDakuten.addEventListener('change', convert);

            if (clearBtn) clearBtn.addEventListener('click', clearAll);
            if (inputClearBtn) inputClearBtn.addEventListener('click', clearAll);

            copyBtn.addEventListener('click', () => {
                if (output.value) {
                    navigator.clipboard.writeText(output.value);
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✅ コピー完了';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 1500);
                }
            });
        })();
