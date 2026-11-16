import { showToast, escapeHtml, safeDecodeURI, addSuffixC, setupDropZone, colorDistance } from './utils.js';

// ==========================================================================
// 1. SYSTEM INITIALIZATION & NAVIGATION
// ==========================================================================

const themeBtn = document.getElementById('themeToggleBtn');
const themeLabel = document.getElementById('themeLabel');

try {
    const savedTheme = localStorage.getItem('workspace_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('theme-light');
        if (themeLabel) themeLabel.textContent = 'テーマ切替 (ライト)';
    } else {
        document.body.classList.remove('theme-light');
        if (themeLabel) themeLabel.textContent = 'テーマ切替 (ダーク)';
    }
} catch (e) {}

themeBtn.addEventListener('click', () => {
    if (document.body.classList.contains('theme-light')) {
        document.body.classList.remove('theme-light');
        themeLabel.textContent = 'テーマ切替 (ダーク)';
        try { localStorage.setItem('workspace_theme', 'dark'); } catch (e) {}
    } else {
        document.body.classList.add('theme-light');
        themeLabel.textContent = 'テーマ切替 (ライト)';
        try { localStorage.setItem('workspace_theme', 'light'); } catch (e) {}
    }
});

// Navigation Switcher & Mobile Menu & Desktop Wide Layout
const navBtns = document.querySelectorAll('.nav-btn');
const toolViews = document.querySelectorAll('.tool-view');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function toggleMobileSidebar(open) {
    if (!sidebar) return;
    if (open) {
        sidebar.classList.add('open');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    } else {
        sidebar.classList.remove('open');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    }
}

function setDesktopSidebar(collapsed, save = true) {
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed', collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const appLayout = document.getElementById('app-layout');
    if (appLayout) appLayout.classList.toggle('sidebar-collapsed', collapsed);

    if (sidebarToggleBtn) {
        sidebarToggleBtn.classList.toggle('active', collapsed);
        sidebarToggleBtn.title = collapsed 
            ? 'サイドバーを表示 (標準表示に戻す / Alt+M)' 
            : 'サイドバーを折りたたむ (画面を広く使う / Alt+M)';
    }

    if (save) {
        try { localStorage.setItem('workspace_sidebar_collapsed', collapsed ? 'true' : 'false'); } catch (e) {}
    }

    // Canvas and chart components redraw crisply when screen expands
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 60);
}

if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            toggleMobileSidebar(!sidebar.classList.contains('open'));
        } else {
            const isCollapsed = sidebar.classList.contains('collapsed');
            setDesktopSidebar(!isCollapsed);
        }
    });
}

// Keyboard Shortcut: Alt+M to toggle sidebar / wide view mode
window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (window.innerWidth <= 768) {
            toggleMobileSidebar(!sidebar.classList.contains('open'));
        } else {
            const isCollapsed = sidebar.classList.contains('collapsed');
            setDesktopSidebar(!isCollapsed);
        }
        return;
    }
    if (e.key === '[' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }
        e.preventDefault();
        if (window.innerWidth <= 768) {
            toggleMobileSidebar(!sidebar.classList.contains('open'));
        } else {
            const isCollapsed = sidebar.classList.contains('collapsed');
            setDesktopSidebar(!isCollapsed);
        }
    }
});

try {
    if (window.innerWidth > 768 && localStorage.getItem('workspace_sidebar_collapsed') === 'true') {
        setDesktopSidebar(true, false);
    }
} catch (e) {}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
        toggleMobileSidebar(false);
    });
}
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', () => {
        toggleMobileSidebar(false);
    });
}

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        navBtns.forEach(b => b.classList.remove('active'));
        toolViews.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        const targetEl = document.getElementById(target);
        if (targetEl) {
            targetEl.classList.add('active');
            // Notify any canvas/chart inside the newly shown view to redraw
            window.dispatchEvent(new Event('resize'));
        }

        // Close mobile sidebar on select
        toggleMobileSidebar(false);
    });
});
