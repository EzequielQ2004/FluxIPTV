function navigateFocus(direction: number, axis: string): void {
    const activeEl = document.activeElement as HTMLElement | null;
    if (!activeEl) return;

    const inVerticalList = !!activeEl.closest('.channel-list, .history-bar');

    if (axis === 'horizontal' && inVerticalList) return;

    const container = axis === 'vertical'
        ? activeEl.closest('.channel-list, .history-bar')
        : activeEl.closest('.filter-tabs, .player-controls, .modal, .header-controls');

    if (!container) return;

    const focusable = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), ' +
        '.channel-item:not([tabindex="-1"]), ' +
        'input:not([disabled]):not([tabindex="-1"]), ' +
        'select:not([disabled]), a[href]'
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

export { navigateFocus };
