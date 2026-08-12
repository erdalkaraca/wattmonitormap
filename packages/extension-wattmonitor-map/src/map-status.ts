import { signal } from '@eclipse-docks/core/externals/lit';

export const RELOAD_REQUEST_EVENT = 'wattmonitor:reload-request';

export const loadingSignal    = signal(true);
export const lastUpdateSignal = signal<Date | null>(null);
export const errorCountSignal = signal(0);
