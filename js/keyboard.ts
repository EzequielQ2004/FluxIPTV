function navigateFocus(direction: number, axis: string): void {
    const focusableElements = document.querySelectorAll<HTMLElement>(
        'button[tabindex="0"], .channel-item[tabindex="0"], .history-item[tabindex="0"], input'
    );

    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement as HTMLElement);

    if (currentIndex === -1) {
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
        return;
    }

    let newIndex = currentIndex;

    if (axis === 'vertical') {
        newIndex += direction;
    } else {
        newIndex += direction;
    }

    if (newIndex >= 0 && newIndex < focusableElements.length) {
        focusableElements[newIndex].focus();
    }
}

export { navigateFocus };
