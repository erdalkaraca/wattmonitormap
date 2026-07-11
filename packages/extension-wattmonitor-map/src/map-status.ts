import { signal } from '@eclipse-docks/core/externals/lit';

/** Set to false once the WattMonitor backend has CORS enabled. */
export const USE_MOCK_DATA = true;

export const loadingSignal    = signal(true);
export const lastUpdateSignal = signal<Date | null>(null);
export const errorCountSignal = signal(0);
