import { signal } from '@eclipse-docks/core/externals/lit';

/**
 * Mock mode fallback.
 * Keep false in local dev when using the Vite `/api` proxy.
 */
export const USE_MOCK_DATA = false;

export const loadingSignal    = signal(true);
export const lastUpdateSignal = signal<Date | null>(null);
export const errorCountSignal = signal(0);
