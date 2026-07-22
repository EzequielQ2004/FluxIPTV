import { describe, it, expect, beforeEach } from 'vitest';
import {
    getPinFailedAttempts,
    incrementPinFailedAttempts,
    resetPinFailedAttempts,
    getPinLockoutSeconds
} from '../js/state.ts';

beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => { store[k] = String(v); },
            removeItem: (k: string) => { delete store[k]; },
            clear: () => { for (const k in store) delete store[k]; },
        },
        writable: true,
        configurable: true,
    });
});

describe('getPinFailedAttempts', () => {
    it('returns 0 when no attempts in localStorage', () => {
        expect(getPinFailedAttempts()).toBe(0);
    });
});

describe('incrementPinFailedAttempts', () => {
    it('increments from 0 to 1', () => {
        incrementPinFailedAttempts();
        expect(getPinFailedAttempts()).toBe(1);
    });

    it('increments sequentially', () => {
        incrementPinFailedAttempts();
        incrementPinFailedAttempts();
        incrementPinFailedAttempts();
        expect(getPinFailedAttempts()).toBe(3);
    });
});

describe('resetPinFailedAttempts', () => {
    it('resets counter back to 0', () => {
        incrementPinFailedAttempts();
        incrementPinFailedAttempts();
        resetPinFailedAttempts();
        expect(getPinFailedAttempts()).toBe(0);
    });
});

describe('getPinLockoutSeconds', () => {
    it('returns 0 when fewer than 3 attempts', () => {
        expect(getPinLockoutSeconds()).toBe(0);
    });

    it('returns 1s for 3-4 attempts', () => {
        for (let i = 0; i < 3; i++) incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(1);
        incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(1);
    });

    it('returns 5s for 5-6 attempts', () => {
        for (let i = 0; i < 5; i++) incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(5);
        incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(5);
    });

    it('returns 30s for 7-9 attempts', () => {
        for (let i = 0; i < 7; i++) incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(30);
    });

    it('returns 300s for 10-14 attempts', () => {
        for (let i = 0; i < 10; i++) incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(300);
    });

    it('returns 1800s for 15+ attempts', () => {
        for (let i = 0; i < 15; i++) incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(1800);
        for (let i = 0; i < 10; i++) incrementPinFailedAttempts();
        expect(getPinLockoutSeconds()).toBe(1800);
    });
});
