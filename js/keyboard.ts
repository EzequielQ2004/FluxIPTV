function navigateFocus(direction: number, axis: string): void {
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl) return;

    const inVerticalList = !!activeEl.closest('.channel-list, .history-bar');

    if (axis === 'horizontal' && inVerticalList) return;

    const container = axis === 'vertical'
        ? activeEl.closest('.channel-list, .history-bar, .player-controls, .modal, .header-controls')
        : activeEl.closest('.filter-tabs, .player-controls, .modal, .header-controls');

    if (!container) return;

    const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), ' +
        '.channel-item:not([tabindex="-1"]), ' +
        'input:not([disabled]):not([tabindex="-1"]), ' +
        'select:not([disabled]), a[href], [role="button"]:not([tabindex="-1"])'
    );

    const currentIndex = Array.from(focusable).indexOf(activeEl);
    if (currentIndex === -1) {
        if (focusable.length > 0) focusable[0].focus();
        return;
    }

    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < focusable.length) {
        focusable[newIndex].focus();
    }
}

function handleDpadSidebar(
    direction: 'left' | 'right',
    sidebar: HTMLElement,
    sidebarOverlay: HTMLElement,
    onOpen: () => void,
    onClose: () => void
): boolean {
    if (!document.body.classList.contains('tv-mode')) return false;

    const isOpen = sidebar.classList.contains('open');

    if (direction === 'left' && !isOpen) {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
        onOpen();
        return true;
    }

    if (direction === 'right' && isOpen) {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
        onClose();
        return true;
    }

    return false;
}

export { navigateFocus, handleDpadSidebar };
