// Global Toast Notification Helper
export function showToast(msg) {
    let toast = document.getElementById('tcToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'tcToast';
        toast.className = 'tc-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// Global HTML Escape Utility
export function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
}

// Global Safe URI Decoder (Fallback for deprecated unescape)
export function safeDecodeURI(str) {
    if (!str) return '';
    try {
        return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch {
        return str.replace(/%([0-9A-Fa-f]{2})/g, (match, hex) => {
            try {
                return String.fromCharCode(parseInt(hex, 16));
            } catch {
                return match;
            }
        });
    }
}

// PDF.js Worker Initialization
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export function addSuffixC(filename) {
    if (!filename) return 'output_c.png';
    const dot = filename.lastIndexOf('.');
    if (dot === -1) return filename + '_c';
    return filename.substring(0, dot) + '_c' + filename.substring(dot);
}

// Generic Drop Zone helper to eliminate drag-and-drop bugs across tools
export function setupDropZone(dropEl, inputEl, onFiles) {
    if (!dropEl) return;
    dropEl.addEventListener('click', () => {
        if (inputEl) inputEl.click();
    });
    dropEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropEl.classList.add('dragover');
    });
    dropEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropEl.classList.remove('dragover');
    });
    dropEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropEl.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFiles(e.dataTransfer.files);
        }
    });
    if (inputEl) {
        inputEl.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                onFiles(e.target.files);
            }
        });
    }
}

// RGB色距離 (0-100)。findDragFitBounds、findSmartBoundsBFS、getProcessedSpriteCanvas で共通利用する。
export function colorDistance(r, g, b, bgR, bgG, bgB) {
    return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2) / 441.67 * 100;
}
