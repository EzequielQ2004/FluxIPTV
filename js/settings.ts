import { t } from './i18n.ts';
import { state, saveState, isPinConfigured, setPin, changePin, removePin, setPinContext } from './state.ts';
import { elements, openModal, closeModal, showToast, showConfirmModal, applyTheme, renderHistory } from './ui.ts';

function openSettings(): void {
    updateSettingsState();
    openModal(elements.settingsModal);
}

function closeSettings(): void {
    closeModal(elements.settingsModal);
    cancelChangePin();
}

function updateSettingsState(): void {
    var hasPin = isPinConfigured();
    document.getElementById('removePinRow')!.style.display = hasPin ? '' : 'none';
    document.getElementById('changePinBtn')!.textContent = hasPin ? t('settings.pin.changeBtn') : t('settings.pin.setBtn');
    (document.getElementById('themeSelect') as HTMLSelectElement).value = state.theme;
    (document.getElementById('kioskToggle') as HTMLInputElement).checked = state.kioskMode;
}

function showChangePinForm(): void {
    document.getElementById('changePinRow')!.style.display = 'none';
    var form = document.getElementById('changePinForm')!;
    form.style.display = '';
    if (isPinConfigured()) {
        document.getElementById('changeOldPin')!.style.display = '';
        (document.getElementById('changeOldPin') as HTMLInputElement).value = '';
        (document.getElementById('changeOldPin') as HTMLInputElement).focus();
    } else {
        document.getElementById('changeOldPin')!.style.display = 'none';
    }
    (document.getElementById('changeNewPin') as HTMLInputElement).value = '';
    (document.getElementById('changeConfirmPin') as HTMLInputElement).value = '';
    (document.getElementById('changeNewPin') as HTMLInputElement).focus();
}

function cancelChangePin(): void {
    document.getElementById('changePinForm')!.style.display = 'none';
    document.getElementById('changePinRow')!.style.display = '';
}

async function saveChangePin(): Promise<void> {
    var oldPin = (document.getElementById('changeOldPin') as HTMLInputElement).value;
    var newPin = (document.getElementById('changeNewPin') as HTMLInputElement).value;
    var confirmPin = (document.getElementById('changeConfirmPin') as HTMLInputElement).value;

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        showToast(t('settings.pin.invalidLength'), 'error');
        return;
    }
    if (newPin !== confirmPin) {
        showToast(t('settings.pin.mismatch'), 'error');
        return;
    }

    if (isPinConfigured()) {
        var ok = await changePin(oldPin, newPin);
        if (!ok) {
            showToast(t('settings.pin.currentIncorrect'), 'error');
            (document.getElementById('changeOldPin') as HTMLInputElement).value = '';
            (document.getElementById('changeOldPin') as HTMLInputElement).focus();
            return;
        }
    } else {
        await setPin(newPin);
    }

    cancelChangePin();
    updateSettingsState();
    showToast(t('settings.pin.saved'));
}

function removePinAction(): void {
    setPinContext('remove-pin');
    document.getElementById('pinModalTitle')!.textContent = t('settings.pin.removeTitle');
    document.getElementById('pinModalMessage')!.textContent = t('settings.pin.removeMessage');
    (document.getElementById('pinConfirmInput') as HTMLElement).style.display = 'none';
    (document.getElementById('pinInput') as HTMLInputElement).value = '';
    (document.getElementById('pinInput') as HTMLInputElement).placeholder = t('modal.pin.placeholder');
    document.getElementById('confirmPinBtn')!.textContent = t('settings.pin.removeBtn');
    closeSettings();
    openModal(elements.pinModal);
    (document.getElementById('pinInput') as HTMLInputElement).focus();
}

function clearHistory(): void {
    showConfirmModal(t('settings.history.clearConfirm'), function (confirmed: boolean) {
        if (!confirmed) return;
        state.history = [];
        saveState();
        renderHistory();
        showToast(t('settings.history.cleared'));
    });
}

function setupSettings(): void {
    document.getElementById('closeSettingsBtn')!.addEventListener('click', closeSettings);
    document.getElementById('changePinBtn')!.addEventListener('click', showChangePinForm);
    document.getElementById('cancelChangePinBtn')!.addEventListener('click', cancelChangePin);
    document.getElementById('saveChangePinBtn')!.addEventListener('click', saveChangePin);
    document.getElementById('removePinBtn')!.addEventListener('click', removePinAction);
    document.getElementById('clearHistoryBtn')!.addEventListener('click', clearHistory);

    (document.getElementById('themeSelect') as HTMLSelectElement).addEventListener('change', function (this: HTMLSelectElement) {
        state.theme = this.value;
        saveState();
        applyTheme();
    });

    (document.getElementById('kioskToggle') as HTMLInputElement).addEventListener('change', function (this: HTMLInputElement) {
        state.kioskMode = this.checked;
        saveState();
        var msg = this.checked ? t('settings.kiosk.enabled') : t('settings.kiosk.disabled');
        showToast(msg);
        var btn = document.getElementById('kioskBtn');
        if (btn) btn.classList.toggle('active', this.checked);
    });

    document.getElementById('settingsModal')!.addEventListener('click', function (e: MouseEvent) {
        if (e.target === this) closeSettings();
    });
}

export { openSettings, closeSettings, setupSettings, updateSettingsState };