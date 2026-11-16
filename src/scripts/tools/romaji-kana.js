        (function() {
            const romajiMap = {
                'tsya': 'ちゃ', 'tsyu': 'ちゅ', 'tsyo': 'ちょ',
                'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
                'sha': 'しゃ', 'shi': 'し', 'shu': 'しゅ', 'she': 'しぇ', 'sho': 'しょ',
                'cha': 'ちゃ', 'chi': 'ち', 'chu': 'ちゅ', 'che': 'ちぇ', 'cho': 'ちょ',
                'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
                'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
                'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
                'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
                'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
                'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
                'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
                'tsu': 'つ', 'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
                'sa': 'さ', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
                'ta': 'た', 'ti': 'ち', 'tu': 'つ', 'te': 'て', 'to': 'と',
                'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
                'ha': 'は', 'hi': 'ひ', 'hu': 'ふ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
                'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
                'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
                'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
                'wa': 'わ', 'wo': 'を', 'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
                'za': 'ざ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
                'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
                'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
                'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
                'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お', '-': 'ー'
            };

            const input = document.getElementById('romajiInput');
            const output = document.getElementById('romajiOutput');
            const spacesChk = document.getElementById('romajiSpaces');
            const punctChk = document.getElementById('romajiPunct');
            const copyBtn = document.getElementById('romajiCopyBtn');
            const clearBtn = document.getElementById('romajiClearBtn');
            const inputClearBtn = document.getElementById('romajiInputClearBtn');

            const keys = Object.keys(romajiMap).sort((a, b) => b.length - a.length);

            function convert() {
                let t = input.value.toLowerCase();
                t = t.replace(/ā/g, 'あー').replace(/ī/g, 'いー').replace(/ū/g, 'うー').replace(/ē/g, 'えー').replace(/ō/g, 'おー');
                t = t.replace(/nn/g, 'ん');
                t = t.replace(/n(?=[bcdfghjklmpqrstvwxz]|$|\s|[!?,.'])/g, 'ん');
                t = t.replace(/([bcdfghjklmpqrstvwxyz])\1/g, 'っ$1');

                for (let key of keys) {
                    t = t.split(key).join(romajiMap[key]);
                }
                t = t.replace(/n/g, 'ん');

                if (spacesChk.checked) t = t.replace(/[ 　\t]/g, '');
                if (punctChk.checked) t = t.replace(/[.,!?。、！？()（）"']/g, '');

                output.value = t;
            }

            function clearAll() {
                input.value = '';
                output.value = '';
                input.focus();
            }

            input.addEventListener('input', convert);
            spacesChk.addEventListener('change', convert);
            punctChk.addEventListener('change', convert);

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
