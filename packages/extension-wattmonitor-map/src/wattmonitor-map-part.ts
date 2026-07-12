import { customElement, html, css, unsafeCSS, state } from '@eclipse-docks/core/externals/lit';
import { DocksPart } from '@eclipse-docks/core';
import maplibregl from 'maplibre-gl';
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { DEFAULT_MUNICIPALITY_KEYS } from './municipalities.js';
import { USE_MOCK_DATA, loadingSignal, lastUpdateSignal, errorCountSignal } from './map-status.js';
import countryBoundariesUrl from './countries.geojson?url';
import stateBoundariesUrl from './state-boundaries.geojson?url';

/** Shape of a single data point returned by /api/getdata */
export interface WattMonitorDataPoint {
  Gemeindeschluessel: string;
  Zeitpunkt: string;
  VerbrauchSumme: number;
  ErzeugungSumme: number;
  ErzeugungBiomasseProzent: number;
  ErzeugungPvProzent: number;
  ErzeugungWasserProzent: number;
  ErzeugungWindProzent: number;
  ErzeugungSonstigeProzent: number;
  VerbrauchKommuneProzent: number;
  VerbrauchPrivatProzent: number;
  VerbrauchGewerbeProzent: number;
  ErzeugungBiomasse: number;
  ErzeugungPv: number;
  ErzeugungWasser: number;
  ErzeugungWind: number;
  ErzeugungSonstige: number;
  VerbrauchKommune: number;
  VerbrauchPrivat: number;
  VerbrauchGewerbe: number;
  Windrichtung: number;
  Windstaerke: number;
  Temperatur: number;
  Bedeckungsgrad: number;
  Niederschlag: number;
}

// NOTE: The WattMonitor backend does not send CORS headers for external origins.
// Mock data is used until the operator enables cross-origin access.
// Toggle USE_MOCK_DATA in map-status.ts to switch to live data.
const API_BASE = 'https://wattmonitor.ewe-netz.de';
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 min

const STATE_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08',
  '09', '10', '11', '12', '13', '14', '15', '16',
] as const;

const MUNICIPALITY_BOUNDARY_URLS: Record<string, string> = {
  '01': new URL('./municipality-boundaries/01.geojson', import.meta.url).href,
  '02': new URL('./municipality-boundaries/02.geojson', import.meta.url).href,
  '03': new URL('./municipality-boundaries/03.geojson', import.meta.url).href,
  '04': new URL('./municipality-boundaries/04.geojson', import.meta.url).href,
  '05': new URL('./municipality-boundaries/05.geojson', import.meta.url).href,
  '06': new URL('./municipality-boundaries/06.geojson', import.meta.url).href,
  '07': new URL('./municipality-boundaries/07.geojson', import.meta.url).href,
  '08': new URL('./municipality-boundaries/08.geojson', import.meta.url).href,
  '09': new URL('./municipality-boundaries/09.geojson', import.meta.url).href,
  '10': new URL('./municipality-boundaries/10.geojson', import.meta.url).href,
  '11': new URL('./municipality-boundaries/11.geojson', import.meta.url).href,
  '12': new URL('./municipality-boundaries/12.geojson', import.meta.url).href,
  '13': new URL('./municipality-boundaries/13.geojson', import.meta.url).href,
  '14': new URL('./municipality-boundaries/14.geojson', import.meta.url).href,
  '15': new URL('./municipality-boundaries/15.geojson', import.meta.url).href,
  '16': new URL('./municipality-boundaries/16.geojson', import.meta.url).href,
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{ properties?: Record<string, unknown> }>;
};

let countryBoundariesPromise: Promise<unknown> | undefined;
let stateBoundariesPromise: Promise<FeatureCollection> | undefined;
const municipalityBoundariesByStatePromise = new Map<string, Promise<FeatureCollection>>();

function loadCountryBoundaries(): Promise<unknown> {
  if (!countryBoundariesPromise) {
    countryBoundariesPromise = fetch(countryBoundariesUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch country boundaries: HTTP ${response.status}`);
      }
      return response.json();
    });
  }
  return countryBoundariesPromise;
}

function loadStateBoundaries(): Promise<FeatureCollection> {
  if (!stateBoundariesPromise) {
    stateBoundariesPromise = fetch(stateBoundariesUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch state boundaries: HTTP ${response.status}`);
      }
      return response.json() as Promise<FeatureCollection>;
    });
  }
  return stateBoundariesPromise;
}

function loadMunicipalityBoundariesForState(stateCode: string): Promise<FeatureCollection> {
  const normalizedStateCode = stateCode.padStart(2, '0');
  const existingPromise = municipalityBoundariesByStatePromise.get(normalizedStateCode);
  if (existingPromise) {
    return existingPromise;
  }

  const url = MUNICIPALITY_BOUNDARY_URLS[normalizedStateCode];
  if (!url) {
    return Promise.reject(new Error(`No municipality boundary URL configured for state ${normalizedStateCode}`));
  }

  const requestPromise = fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch municipality boundaries for state ${normalizedStateCode}: HTTP ${response.status}`);
    }
    return response.json() as Promise<FeatureCollection>;
  });
  municipalityBoundariesByStatePromise.set(normalizedStateCode, requestPromise);
  return requestPromise;
}

/** Get the appropriate map style URL based on the current theme preference */
function getPreferredMapStyleUrl(): string {
  const isDark = document.documentElement.classList.contains('wa-dark');
  return isDark
    ? 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json'
    : 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_col.json';
}

function getFallbackMapStyle(): object {
  const isDark = document.documentElement.classList.contains('wa-dark');
  return {
    version: 8,
    name: 'wattmonitor-maintenance-fallback',
    sources: {},
    layers: [
      {
        id: 'fallback-background',
        type: 'background',
        paint: {
          'background-color': isDark ? '#0f172a' : '#e5e7eb',
        },
      },
    ],
  };
}

async function resolveMapStyleForCurrentTheme(): Promise<string | object> {
  const styleUrl = getPreferredMapStyleUrl();
  try {
    const response = await fetch(styleUrl, { method: 'GET', cache: 'no-store' });
    if (response.ok) {
      return styleUrl;
    }
    console.warn(`Basemap style endpoint unavailable (HTTP ${response.status}). Using fallback style.`);
  } catch (error) {
    console.warn('Basemap style endpoint unavailable. Using fallback style.', error);
  }
  return getFallbackMapStyle();
}



/** Deterministic mock data generator – varies per municipality key so markers get different colours. */
function generateMockData(key: string): WattMonitorDataPoint {
  // Improved seed: multiply by larger factors and square to increase variance
  const seed = key.split('').reduce((acc, c, i) => (acc * 31 + c.charCodeAt(0)) * (i + 1), 5381);
  const rng = (min: number, max: number, offset = 0) => {
    // Use multiple trigonometric functions with different phases to maximize variance
    const angle = (seed + offset) * 0.01;
    const v = Math.abs(Math.sin(angle) * Math.cos(angle * 1.7) * Math.tan(angle * 0.5 + 1)) * 10_000;
    return min + (v % (max - min));
  };

  const windPct  = Math.round(rng(5, 60, 1));     // Higher variance
  const pvPct    = Math.round(rng(10, 80, 2));    // Higher variance
  const biomPct  = Math.round(rng(0, 20, 3));
  const waterPct = Math.round(rng(0, 10, 4));     // Higher variance
  const total    = windPct + pvPct + biomPct + waterPct;
  const scale    = 100 / (total || 100);

  const erzSumme = Math.round(rng(1_000_000, 30_000_000, 5));
  const vrbSumme = Math.round(rng(3_000_000, 30_000_000, 6));
  const gwPct    = Math.round(rng(50, 80, 7));
  const privPct  = Math.round(rng(15, 35, 8));
  const komPct   = 100 - gwPct - privPct;

  return {
    Gemeindeschluessel: key,
    Zeitpunkt: new Date().toISOString(),
    ErzeugungSumme: erzSumme,
    VerbrauchSumme: vrbSumme,
    ErzeugungWindProzent:     Math.round(windPct  * scale),
    ErzeugungPvProzent:       Math.round(pvPct    * scale),
    ErzeugungBiomasseProzent: Math.round(biomPct  * scale),
    ErzeugungWasserProzent:   Math.round(waterPct * scale),
    ErzeugungSonstigeProzent: 0,
    ErzeugungWind:    Math.round(erzSumme * windPct  * scale / 100),
    ErzeugungPv:      Math.round(erzSumme * pvPct    * scale / 100),
    ErzeugungBiomasse:Math.round(erzSumme * biomPct  * scale / 100),
    ErzeugungWasser:  Math.round(erzSumme * waterPct * scale / 100),
    ErzeugungSonstige: 0,
    VerbrauchGewerbeProzent: gwPct,
    VerbrauchPrivatProzent:  privPct,
    VerbrauchKommuneProzent: komPct,
    VerbrauchGewerbe: Math.round(vrbSumme * gwPct   / 100),
    VerbrauchPrivat:  Math.round(vrbSumme * privPct / 100),
    VerbrauchKommune: Math.round(vrbSumme * komPct  / 100),
    Windrichtung:  Math.round(rng(0, 360, 9)),
    Windstaerke:   Math.round(rng(0, 8, 10) * 10) / 10,
    Temperatur:    Math.round(rng(8, 28, 11) * 10) / 10,
    Bedeckungsgrad:Math.round(rng(0, 100, 12)),
    Niederschlag:  0,
  };
}

function coverageColor(ratio: number): string {
  const isDark = document.documentElement.classList.contains('wa-dark');
  if (ratio >= 0.9) return isDark ? '#86efac' : '#16a34a';
  if (ratio >= 0.7) return isDark ? '#bbf7d0' : '#4ade80';
  if (ratio >= 0.5) return isDark ? '#fde047' : '#facc15';
  if (ratio >= 0.3) return isDark ? '#fdba74' : '#fb923c';
  return isDark ? '#fca5a5' : '#ef4444';
}

function fmtKwh(kwh: number): string {
  return (kwh / 1000).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' kWh';
}

function buildPopupHtml(municipalityName: string, d: WattMonitorDataPoint): string {
  const coverage = d.VerbrauchSumme > 0 ? d.ErzeugungSumme / d.VerbrauchSumme : 0;
  const covPct   = Math.round(coverage * 100);
  const color    = coverageColor(coverage);
  const ts       = new Date(d.Zeitpunkt).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const netSign = d.ErzeugungSumme >= d.VerbrauchSumme ? '+' : '';
  const netKwh  = d.ErzeugungSumme - d.VerbrauchSumme;

  return `
    <div style="font-family:system-ui,sans-serif;min-width:240px;padding:8px;color:var(--wa-color-text-normal);background:var(--wa-color-surface-raised);border-radius:4px;">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;color:var(--wa-color-text-normal);">${municipalityName}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="
          width:64px;height:64px;border-radius:50%;
          background:conic-gradient(${color} 0% ${covPct}%,var(--wa-color-neutral-fill-quiet) ${covPct}% 100%);
          display:flex;align-items:center;justify-content:center;">
          <div style="
            width:46px;height:46px;border-radius:50%;background:var(--wa-color-surface-raised);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:0.85rem;color:${color};">${covPct}&thinsp;%</div>
        </div>
        <div style="font-size:0.78rem;color:var(--wa-color-text-quiet);line-height:1.5;">
          Erneuerbar<br>regional<br><span style="font-size:0.7rem;">${ts}</span>
        </div>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:0.8rem;color:var(--wa-color-text-normal);">
        <tr style="background:var(--wa-color-success-fill-quiet);">
          <td style="padding:3px 5px;font-weight:600;">⚡ Erzeugung</td>
          <td style="padding:3px 5px;text-align:right;">${fmtKwh(d.ErzeugungSumme)}</td>
        </tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">💨 Wind</td>
            <td style="padding:2px 5px;text-align:right;">${d.ErzeugungWindProzent}&thinsp;%</td></tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">☀️ PV</td>
            <td style="padding:2px 5px;text-align:right;">${d.ErzeugungPvProzent}&thinsp;%</td></tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">🌿 Biomasse</td>
            <td style="padding:2px 5px;text-align:right;">${d.ErzeugungBiomasseProzent}&thinsp;%</td></tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">💧 Wasser</td>
            <td style="padding:2px 5px;text-align:right;">${d.ErzeugungWasserProzent}&thinsp;%</td></tr>
        <tr style="background:var(--wa-color-warning-fill-quiet);">
          <td style="padding:3px 5px;font-weight:600;">🏠 Verbrauch</td>
          <td style="padding:3px 5px;text-align:right;">${fmtKwh(d.VerbrauchSumme)}</td>
        </tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">🏭 Industrie</td>
            <td style="padding:2px 5px;text-align:right;">${d.VerbrauchGewerbeProzent}&thinsp;%</td></tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">🏘 Privat</td>
            <td style="padding:2px 5px;text-align:right;">${d.VerbrauchPrivatProzent}&thinsp;%</td></tr>
        <tr><td style="padding:2px 5px 2px 14px;color:var(--wa-color-text-quiet);">🏛 Kommunal</td>
            <td style="padding:2px 5px;text-align:right;">${d.VerbrauchKommuneProzent}&thinsp;%</td></tr>
        <tr style="border-top:1px solid var(--wa-color-surface-border);">
          <td style="padding:3px 5px;font-weight:600;">⚖️ Bilanz</td>
          <td style="padding:3px 5px;text-align:right;color:${netKwh >= 0 ? 'var(--wa-color-success-fill-loud)' : 'var(--wa-color-danger-fill-loud)'};">
            ${netSign}${fmtKwh(netKwh)}</td>
        </tr>
        <tr>
          <td style="padding:2px 5px;color:var(--wa-color-text-quiet);">🌡 Temperatur</td>
          <td style="padding:2px 5px;text-align:right;">${d.Temperatur.toFixed(1)}&thinsp;°C</td>
        </tr>
      </table>
    </div>`;
}

@customElement('wattmonitor-map-part')
export class WattmonitorMapPart extends DocksPart {
  /** DocksPart: no outer scroller – MapLibre manages its own scroll and touch gestures. */
  protected override scrollMode = 'none' as const;

  /** Inject MapLibre CSS into the shadow root alongside the part's own styles. */
  static override styles = [
    unsafeCSS(maplibreCss),
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      #wmm-map {
        width: 100%;
        height: 100%;
      }
      :host ::part(popup) {
        background: var(--wa-color-surface-raised) !important;
      }
      :host ::part(popup-content) {
        background: var(--wa-color-surface-raised) !important;
        color: var(--wa-color-text-normal) !important;
      }
    `,
  ];

  @state() private _mapReady = false;

  private _map?: maplibregl.Map;
  private _markers: maplibregl.Marker[] = [];
  private _openPopup?: maplibregl.Popup;
  private _refreshTimer?: ReturnType<typeof setInterval>;
  private _resizeObserver?: ResizeObserver;
  private _themeMutationObserver?: MutationObserver;
  private _data: Map<string, WattMonitorDataPoint> = new Map();
  private _initialCenter: [number, number] = [8.0, 53.35];
  private _initialZoom = 8.2;
  private _dynamicMunicipalityKeys = new Set<string>();
  private _removedDefaultMunicipalityKeys = new Set<string>();
  private _municipalityNamesByKey: Map<string, string> = new Map();
  private _dynamicMunicipalityPositions: Map<string, [number, number]> = new Map();
  private _loadedMunicipalityStates = new Set<string>();
  private _municipalityBoundaryData: FeatureCollection = { type: 'FeatureCollection', features: [] };
  private _municipalityHandlersBound = false;
  private _selectionLoadedFromPersistence = false;
  private readonly _municipalityHighlightPalette = [
    '#2563eb',
    '#16a34a',
    '#f97316',
    '#a21caf',
    '#0ea5e9',
    '#eab308',
  ];

  private _highlightedMunicipalityKeys(): string[] {
    return this._allMunicipalityKeys().filter((municipalityKey) => this._data.has(municipalityKey));
  }

  private _allMunicipalityKeys(): string[] {
    const activeDefaultKeys = [...DEFAULT_MUNICIPALITY_KEYS].filter(
      (municipalityKey) => !this._removedDefaultMunicipalityKeys.has(municipalityKey)
    );
    return [...activeDefaultKeys, ...this._dynamicMunicipalityKeys.values()];
  }

  private _normalizePersistedSelection(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((entry) => String(entry).trim())
      .filter((ags) => /^\d{8}$/.test(ags));
  }

  private _normalizePersistedCenter(value: unknown): [number, number] | undefined {
    if (!Array.isArray(value) || value.length < 2) {
      return undefined;
    }

    const lng = Number(value[0]);
    const lat = Number(value[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return undefined;
    }

    return [lng, lat];
  }

  private _normalizePersistedZoom(value: unknown): number | undefined {
    const zoom = Number(value);
    return Number.isFinite(zoom) ? zoom : undefined;
  }

  private async _restoreStateFromPersistence(): Promise<void> {
    if (this._selectionLoadedFromPersistence) {
      return;
    }

    this._selectionLoadedFromPersistence = true;

    try {
      const persisted = await this.getDialogSetting() as {
        selectedMunicipalityKeys?: unknown;
        mapView?: { center?: unknown; zoom?: unknown };
      } | undefined;
      const selection = this._normalizePersistedSelection(persisted?.selectedMunicipalityKeys);
      if (selection.length === 0) {
        // Keep default municipality selection if nothing was persisted.
      } else {
        const selectedKeys = new Set(selection);

        this._removedDefaultMunicipalityKeys = new Set(
          [...DEFAULT_MUNICIPALITY_KEYS].filter((ags) => !selectedKeys.has(ags))
        );

        this._dynamicMunicipalityKeys = new Set(
          [...selectedKeys].filter((ags) => !DEFAULT_MUNICIPALITY_KEYS.has(ags))
        );
      }

      const persistedCenter = this._normalizePersistedCenter(persisted?.mapView?.center);
      if (persistedCenter) {
        this._initialCenter = persistedCenter;
      }

      const persistedZoom = this._normalizePersistedZoom(persisted?.mapView?.zoom);
      if (persistedZoom !== undefined) {
        this._initialZoom = persistedZoom;
      }
    } catch (error) {
      console.warn('Failed to restore map state from persistence:', error);
    }
  }

  private _persistState(): void {
    const selectedMunicipalityKeys = Array.from(new Set(this._allMunicipalityKeys()));
    const center = this._map ? this._map.getCenter() : { lng: this._initialCenter[0], lat: this._initialCenter[1] };
    const zoom = this._map ? this._map.getZoom() : this._initialZoom;

    void this.setDialogSetting({
      selectedMunicipalityKeys,
      mapView: {
        center: [Number(center.lng.toFixed(6)), Number(center.lat.toFixed(6))],
        zoom: Number(zoom.toFixed(2)),
      },
    }).catch((error) => {
      console.warn('Failed to persist map state:', error);
    });
  }

  private _removeMunicipalitySelection(municipalityKey: string): void {
    if (DEFAULT_MUNICIPALITY_KEYS.has(municipalityKey)) {
      this._removedDefaultMunicipalityKeys.add(municipalityKey);
    } else {
      this._dynamicMunicipalityKeys.delete(municipalityKey);
      this._municipalityNamesByKey.delete(municipalityKey);
    }

    this._dynamicMunicipalityPositions.delete(municipalityKey);
    this._data.delete(municipalityKey);

    if (this._openPopup) {
      this._openPopup.remove();
      this._openPopup = undefined;
    }

    this._persistState();
    this._renderMarkers();
  }

  private _municipalityName(municipalityKey: string): string {
    return this._municipalityNamesByKey.get(municipalityKey) ?? `AGS ${municipalityKey}`;
  }

  private _stateCodeForMunicipalityKey(municipalityKey: string): string | undefined {
    const stateCode = municipalityKey.slice(0, 2);
    return STATE_CODES.includes(stateCode as (typeof STATE_CODES)[number]) ? stateCode : undefined;
  }

  private _syncKnownMunicipalityNamesFromFeatures(features: Array<{ properties?: Record<string, unknown> }>): void {
    const trackedKeys = new Set(this._allMunicipalityKeys());
    for (const feature of features) {
      const properties = feature.properties as Record<string, unknown> | undefined;
      const key = String(properties?.AGS ?? '').trim();
      if (!key || !trackedKeys.has(key)) {
        continue;
      }
      const name = String(properties?.GEN ?? '').trim();
      if (name) {
        this._municipalityNamesByKey.set(key, name);
      }
    }
  }

  private _extractVertexKeys(geometry: unknown): Set<string> {
    const vertices = new Set<string>();
    const coordinates = (geometry as { coordinates?: unknown } | undefined)?.coordinates;

    const walk = (node: unknown): void => {
      if (!Array.isArray(node)) {
        return;
      }
      if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
        const lng = Number(node[0]).toFixed(6);
        const lat = Number(node[1]).toFixed(6);
        vertices.add(`${lng},${lat}`);
        return;
      }
      for (const child of node) {
        walk(child);
      }
    };

    walk(coordinates);
    return vertices;
  }

  private _extractCoordinatePairs(geometry: unknown): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    const coordinates = (geometry as { coordinates?: unknown } | undefined)?.coordinates;

    const walk = (node: unknown): void => {
      if (!Array.isArray(node)) {
        return;
      }
      if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
        points.push([Number(node[0]), Number(node[1])]);
        return;
      }
      for (const child of node) {
        walk(child);
      }
    };

    walk(coordinates);
    return points;
  }

  private _resolveMunicipalityPosition(municipalityKey: string): [number, number] | undefined {
    const dynamicPosition = this._dynamicMunicipalityPositions.get(municipalityKey);
    if (dynamicPosition) {
      return dynamicPosition;
    }

    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let hasCoordinates = false;

    for (const feature of this._municipalityBoundaryData.features) {
      const properties = feature.properties as Record<string, unknown> | undefined;
      const key = String(properties?.AGS ?? '').trim();
      if (key !== municipalityKey) {
        continue;
      }

      const coordinates = this._extractCoordinatePairs((feature as { geometry?: unknown }).geometry);
      for (const [lng, lat] of coordinates) {
        hasCoordinates = true;
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    }

    if (!hasCoordinates) {
      return undefined;
    }

    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  }

  private _buildMunicipalityAdjacency(highlightedKeys: string[]): Map<string, Set<string>> {
    const highlightedSet = new Set(highlightedKeys);
    const municipalityVertexKeys = new Map<string, Set<string>>();

    for (const feature of this._municipalityBoundaryData.features) {
      const properties = feature.properties as Record<string, unknown> | undefined;
      const key = String(properties?.AGS ?? '').trim();
      if (!key || !highlightedSet.has(key)) {
        continue;
      }

      const featureVertices = this._extractVertexKeys((feature as { geometry?: unknown }).geometry);
      if (featureVertices.size === 0) {
        continue;
      }

      const existing = municipalityVertexKeys.get(key);
      if (existing) {
        for (const vertex of featureVertices) {
          existing.add(vertex);
        }
      } else {
        municipalityVertexKeys.set(key, featureVertices);
      }
    }

    const vertexToMunicipalities = new Map<string, string[]>();
    for (const [key, vertices] of municipalityVertexKeys.entries()) {
      for (const vertex of vertices) {
        const linked = vertexToMunicipalities.get(vertex);
        if (linked) {
          linked.push(key);
        } else {
          vertexToMunicipalities.set(vertex, [key]);
        }
      }
    }

    const adjacency = new Map<string, Set<string>>();
    for (const key of highlightedKeys) {
      adjacency.set(key, new Set<string>());
    }

    for (const linkedMunicipalities of vertexToMunicipalities.values()) {
      if (linkedMunicipalities.length < 2) {
        continue;
      }
      for (let i = 0; i < linkedMunicipalities.length; i += 1) {
        for (let j = i + 1; j < linkedMunicipalities.length; j += 1) {
          const a = linkedMunicipalities[i];
          const b = linkedMunicipalities[j];
          adjacency.get(a)?.add(b);
          adjacency.get(b)?.add(a);
        }
      }
    }

    return adjacency;
  }

  private _buildMunicipalityColorMap(highlightedKeys: string[]): Map<string, string> {
    const adjacency = this._buildMunicipalityAdjacency(highlightedKeys);
    const orderedKeys = [...highlightedKeys].sort((a, b) => {
      const degreeDiff = (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0);
      return degreeDiff !== 0 ? degreeDiff : a.localeCompare(b);
    });

    const colorMap = new Map<string, string>();
    for (const key of orderedKeys) {
      const usedByNeighbors = new Set(
        [...(adjacency.get(key) ?? new Set<string>())]
          .map((neighbor) => colorMap.get(neighbor))
          .filter((color): color is string => Boolean(color))
      );

      const selected = this._municipalityHighlightPalette.find((color) => !usedByNeighbors.has(color));
      if (selected) {
        colorMap.set(key, selected);
      } else {
        const fallbackIndex = Math.abs(
          key.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 17)
        ) % this._municipalityHighlightPalette.length;
        colorMap.set(key, this._municipalityHighlightPalette[fallbackIndex]);
      }
    }

    return colorMap;
  }

  private _updateMunicipalityHighlights(): void {
    if (!this._map || !this._map.getLayer('municipality-boundaries-highlight')) {
      return;
    }
    const keys = this._highlightedMunicipalityKeys();
    if (keys.length === 0) {
      this._map.setFilter('municipality-boundaries-highlight', ['==', ['get', 'AGS'], '__none__']);
      this._map.setPaintProperty('municipality-boundaries-highlight', 'fill-color', 'rgba(59, 130, 246, 0.35)');
      return;
    }

    const colorMap = this._buildMunicipalityColorMap(keys);
    const colorMatchExpression: unknown[] = ['match', ['get', 'AGS']];
    for (const key of keys) {
      colorMatchExpression.push(key, colorMap.get(key) ?? '#2563eb');
    }
    colorMatchExpression.push('#2563eb');

    this._map.setPaintProperty('municipality-boundaries-highlight', 'fill-color', colorMatchExpression);
    this._map.setFilter('municipality-boundaries-highlight', ['in', ['get', 'AGS'], ['literal', keys]]);
  }

  private _bindMunicipalityInteractionHandlers(): void {
    if (!this._map || this._municipalityHandlersBound) {
      return;
    }

    this._map.on('mouseenter', 'municipality-boundaries-fill', () => {
      this._map!.getCanvas().style.cursor = 'pointer';
    });
    this._map.on('mouseleave', 'municipality-boundaries-fill', () => {
      this._map!.getCanvas().style.cursor = '';
    });

    this._map.on('click', 'municipality-boundaries-fill', async (event) => {
      const feature = event.features?.[0];
      if (!feature?.properties) return;

      const properties = feature.properties as Record<string, unknown>;
      const key = String(properties.AGS ?? '').trim();
      if (!key) return;
      const name = String(properties.GEN ?? `AGS ${key}`);
      this._municipalityNamesByKey.set(key, name);

      if (this._removedDefaultMunicipalityKeys.has(key)) {
        this._removedDefaultMunicipalityKeys.delete(key);
      }

      // Always use the most recent click as marker position override.
      this._dynamicMunicipalityPositions.set(key, [event.lngLat.lng, event.lngLat.lat]);

      if (!DEFAULT_MUNICIPALITY_KEYS.has(key) && !this._dynamicMunicipalityKeys.has(key)) {
        this._dynamicMunicipalityKeys.add(key);
      }

      this._persistState();

      try {
        await this._fetchOne(key);
      } catch (error) {
        console.error(`Failed to load municipality data for ${key}:`, error);
      } finally {
        this._renderMarkers();
      }
    });

    this._map.on('dblclick', 'municipality-boundaries-fill', (event) => {
      const feature = event.features?.[0];
      if (!feature?.properties) return;

      const properties = feature.properties as Record<string, unknown>;
      const key = String(properties.AGS ?? '').trim();
      if (!key) return;

      if (!this._allMunicipalityKeys().includes(key)) {
        return;
      }

      event.preventDefault();
      this._removeMunicipalitySelection(key);
    });

    this._municipalityHandlersBound = true;
  }

  private async _loadMunicipalityBoundariesForVisibleStates(): Promise<void> {
    if (!this._map || !this._map.getLayer('state-boundaries-fill')) {
      return;
    }

    const visibleStates = this._map.queryRenderedFeatures(undefined, { layers: ['state-boundaries-fill'] });
    const statesFromViewport = Array.from(new Set(
      visibleStates
        .map((feature) => String((feature.properties as Record<string, unknown> | undefined)?.SN_L ?? '').padStart(2, '0'))
        .filter((stateCode) => STATE_CODES.includes(stateCode as (typeof STATE_CODES)[number]))
    ));

    const statesFromTrackedMunicipalities = this._allMunicipalityKeys()
      .map((municipalityKey) => this._stateCodeForMunicipalityKey(municipalityKey))
      .filter((stateCode): stateCode is string => Boolean(stateCode));

    const statesToLoad = Array.from(new Set([
      ...statesFromViewport,
      ...statesFromTrackedMunicipalities,
    ])).filter((stateCode) => !this._loadedMunicipalityStates.has(stateCode));

    if (statesToLoad.length === 0) {
      return;
    }

    const results = await Promise.allSettled(statesToLoad.map((stateCode) => loadMunicipalityBoundariesForState(stateCode)));
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const stateCode = statesToLoad[i];
      if (result.status === 'fulfilled') {
        this._loadedMunicipalityStates.add(stateCode);
        this._syncKnownMunicipalityNamesFromFeatures(result.value.features);
        this._municipalityBoundaryData.features.push(...result.value.features);
      } else {
        console.error(`Failed to load municipality boundaries for state ${stateCode}:`, result.reason);
      }
    }

    const municipalitySource = this._map.getSource('municipality-boundaries') as maplibregl.GeoJSONSource | undefined;
    municipalitySource?.setData(this._municipalityBoundaryData as unknown as object);
    this._updateMunicipalityHighlights();
    this._renderMarkers();
  }

  override async firstUpdated() {
    // DocksPart already calls super.firstUpdated — call it here too
    super.firstUpdated(new Map());

    await this._restoreStateFromPersistence();

    // Add theme-aware CSS for MapLibre popups
    const existingStyle = document.getElementById('wattmonitor-popup-styles');
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = 'wattmonitor-popup-styles';
      style.textContent = `
        .maplibregl-popup-content {
          background: var(--wa-color-surface-raised) !important;
          color: var(--wa-color-text-normal) !important;
        }
        .maplibregl-popup {
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
        }
        .maplibregl-popup-close-button {
          color: var(--wa-color-text-normal) !important;
          background: transparent !important;
          border: none !important;
          padding: 4px !important;
          font-size: 18px !important;
          opacity: 0.8 !important;
          cursor: pointer !important;
        }
        .maplibregl-popup-close-button:hover {
          opacity: 1 !important;
        }
      `;
      document.head.appendChild(style);
    }

    const container = this.renderRoot.querySelector<HTMLElement>('#wmm-map');
    if (!container) return;

    const initialStyle = await resolveMapStyleForCurrentTheme();

    this._map = new maplibregl.Map({
      container,
      style: initialStyle,
      center: this._initialCenter,
      zoom: this._initialZoom,
      attributionControl: false,
    });

    this._map.addControl(new maplibregl.NavigationControl(), 'top-right');
    this._map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    this._map.on('load', async () => {
      // Add country boundaries layer (first layer)
      try {
        const countryBoundaries = await loadCountryBoundaries();
        const stateBoundaries = await loadStateBoundaries();
        this._map!.addSource('country-boundaries', {
          type: 'geojson',
          data: countryBoundaries,
        });
        this._map!.addSource('state-boundaries', {
          type: 'geojson',
          data: stateBoundaries,
        });
        this._map!.addSource('municipality-boundaries', {
          type: 'geojson',
          data: this._municipalityBoundaryData,
        });
        // Get the first existing layer to insert country boundaries before it
        const existingLayers = this._map!.getStyle().layers;
        const beforeId = existingLayers && existingLayers.length > 0 ? existingLayers[0].id : undefined;

        // Add layers only after source is created, before all other layers

        this._map!.addLayer({
          id: 'country-boundaries-line',
          type: 'line',
          source: 'country-boundaries',
          paint: {
            'line-color': '#9090ff',
            'line-width': 2,
          },
        }, beforeId);

        this._map!.addLayer({
          id: 'state-boundaries-fill',
          type: 'fill',
          source: 'state-boundaries',
          paint: {
            'fill-color': 'rgba(0, 0, 0, 0)',
            'fill-opacity': 0,
          },
        });
        this._map!.addLayer({
          id: 'state-boundaries-line',
          type: 'line',
          source: 'state-boundaries',
          minzoom: 4,
          paint: {
            'line-color': 'rgba(147, 197, 253, 0.35)',
            'line-width': 1.2,
          },
        });

        this._map!.addLayer({
          id: 'municipality-boundaries-fill',
          type: 'fill',
          source: 'municipality-boundaries',
          paint: {
            'fill-color': 'rgba(0, 0, 0, 0)',
            'fill-opacity': 0,
          },
        });
        this._map!.addLayer({
          id: 'municipality-boundaries-highlight',
          type: 'fill',
          source: 'municipality-boundaries',
          minzoom: 7,
          paint: {
            'fill-color': 'rgba(59, 130, 246, 0.32)',
            'fill-opacity': 0.45,
          },
          filter: ['==', ['get', 'AGS'], '__none__'],
        });
        this._map!.addLayer({
          id: 'municipality-boundaries-line',
          type: 'line',
          source: 'municipality-boundaries',
          minzoom: 7,
          paint: {
            'line-color': 'rgba(96, 165, 250, 0.22)',
            'line-width': 0.8,
          },
        });

        this._bindMunicipalityInteractionHandlers();
        await this._loadMunicipalityBoundariesForVisibleStates();
        this._updateMunicipalityHighlights();
        this._map!.on('moveend', () => {
          void this._loadMunicipalityBoundariesForVisibleStates();
          this._persistState();
        });
      } catch (error) {
        console.error('Failed to load country boundaries:', error);
      }

      // Set up theme change listener
      this._themeMutationObserver = new MutationObserver(() => {
        if (this._map) {
          void resolveMapStyleForCurrentTheme().then((resolvedStyle) => {
            this._map!.setStyle(resolvedStyle);
            // Re-add layers after style change
            setTimeout(async () => {
            if (this._map && !this._map.getSource('country-boundaries')) {
              try {
                const countryBoundaries = await loadCountryBoundaries();
                const stateBoundaries = await loadStateBoundaries();
                this._map.addSource('country-boundaries', {
                  type: 'geojson',
                  data: countryBoundaries,
                });
                this._map.addSource('state-boundaries', {
                  type: 'geojson',
                  data: stateBoundaries,
                });
                this._map.addSource('municipality-boundaries', {
                  type: 'geojson',
                  data: this._municipalityBoundaryData,
                });
              } catch (error) {
                console.error('Failed to load country boundaries:', error);
              }
              const existingLayers = this._map.getStyle().layers;
              const beforeId = existingLayers && existingLayers.length > 0 ? existingLayers[0].id : undefined;

              this._map.addLayer({
                id: 'country-boundaries-fill',
                type: 'fill',
                source: 'country-boundaries',
                paint: {
                  'fill-color': 'rgba(0, 0, 0, 0)',
                  'fill-opacity': 0,
                },
              }, beforeId);
              this._map.addLayer({
                id: 'country-boundaries-line',
                type: 'line',
                source: 'country-boundaries',
                paint: {
                  'line-color': 'rgba(128, 128, 128, 0.5)',
                  'line-width': 1.5,
                },
              }, beforeId);

              this._map.addLayer({
                id: 'state-boundaries-fill',
                type: 'fill',
                source: 'state-boundaries',
                paint: {
                  'fill-color': 'rgba(0, 0, 0, 0)',
                  'fill-opacity': 0,
                },
              });
              this._map.addLayer({
                id: 'state-boundaries-line',
                type: 'line',
                source: 'state-boundaries',
                minzoom: 4,
                paint: {
                  'line-color': 'rgba(147, 197, 253, 0.35)',
                  'line-width': 1.2,
                },
              });

              this._map.addLayer({
                id: 'municipality-boundaries-fill',
                type: 'fill',
                source: 'municipality-boundaries',
                paint: {
                  'fill-color': 'rgba(0, 0, 0, 0)',
                  'fill-opacity': 0,
                },
              });
              this._map.addLayer({
                id: 'municipality-boundaries-highlight',
                type: 'fill',
                source: 'municipality-boundaries',
                minzoom: 7,
                paint: {
                  'fill-color': 'rgba(59, 130, 246, 0.32)',
                  'fill-opacity': 0.45,
                },
                filter: ['==', ['get', 'AGS'], '__none__'],
              });
              this._map.addLayer({
                id: 'municipality-boundaries-line',
                type: 'line',
                source: 'municipality-boundaries',
                minzoom: 7,
                paint: {
                  'line-color': 'rgba(96, 165, 250, 0.22)',
                  'line-width': 0.8,
                },
              });

              void this._loadMunicipalityBoundariesForVisibleStates();
              this._updateMunicipalityHighlights();
            }
            }, 100);
          });
        }
      });
      this._themeMutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      this._fetchAll();
      this._refreshTimer = setInterval(() => this._fetchAll(), REFRESH_INTERVAL_MS);
    });

    this._resizeObserver = new ResizeObserver(() => this._map?.resize());
    this._resizeObserver.observe(container);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._persistState();
    clearInterval(this._refreshTimer);
    this._resizeObserver?.disconnect();
    this._themeMutationObserver?.disconnect();
    this._map?.remove();
  }

  private async _fetchAll(): Promise<void> {
    loadingSignal.set(true);
    const results = await Promise.allSettled(
      this._allMunicipalityKeys().map((municipalityKey) => this._fetchOne(municipalityKey))
    );
    errorCountSignal.set(results.filter(r => r.status === 'rejected').length);
    loadingSignal.set(false);
    lastUpdateSignal.set(new Date());
    this._renderMarkers();
  }

  private async _fetchOne(municipalityKey: string): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 50));
      this._data.set(municipalityKey, generateMockData(municipalityKey));
      return;
    }
    const res = await fetch(`${API_BASE}/api/getdata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(municipalityKey),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: WattMonitorDataPoint[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty response');
    this._data.set(municipalityKey, data[0]);
  }

  private _renderMarkers(): void {
    if (!this._map) return;

    this._markers.forEach(mk => mk.remove());
    this._markers = [];

    for (const municipalityKey of this._allMunicipalityKeys()) {
      const d = this._data.get(municipalityKey);
      if (!d) continue;
      const position = this._resolveMunicipalityPosition(municipalityKey);
      if (!position) continue;
      const municipalityName = this._municipalityName(municipalityKey);

      const coverage = d.VerbrauchSumme > 0 ? d.ErzeugungSumme / d.VerbrauchSumme : 0;
      const color    = coverageColor(coverage);
      const pct      = Math.round(coverage * 100);
      const netKwh   = d.ErzeugungSumme - d.VerbrauchSumme;
      const netSign  = netKwh >= 0 ? '+' : '';

      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));background:var(--wa-color-surface-raised);padding:6px 4px;border-radius:6px;max-width:120px;';
      
      // Build energy source breakdown visually
      const sources = [
        { icon: '💨', pct: d.ErzeugungWindProzent, color: '#3b82f6' },
        { icon: '☀️', pct: d.ErzeugungPvProzent, color: '#fbbf24' },
        { icon: '🌿', pct: d.ErzeugungBiomasseProzent, color: '#10b981' },
        { icon: '💧', pct: d.ErzeugungWasserProzent, color: '#06b6d4' },
      ].filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
      
      const sourceBars = sources
        .map(s => `<div style="flex:${s.pct};background:${s.color};min-width:1px;"></div>`)
        .join('');
      
      const erzeugungMwh = (d.ErzeugungSumme / 1_000_000).toFixed(1);
      const verbrauchMwh = (d.VerbrauchSumme / 1_000_000).toFixed(1);
      const netMwh = (netKwh / 1_000_000).toFixed(1);
      
      el.innerHTML = `
        <div style="background:${color};color:#fff;border:2px solid var(--wa-color-surface-raised);border-radius:50%;
          width:42px;height:42px;display:flex;align-items:center;justify-content:center;
          font-size:0.72rem;font-weight:700;font-family:system-ui,sans-serif;
          text-align:center;line-height:1.1;">${pct}<br>%</div>
        <div style="display:flex;height:3px;width:42px;gap:1px;margin-top:2px;border-radius:2px;overflow:hidden;background:var(--wa-color-neutral-fill-quiet);">
          ${sourceBars}
        </div>
        <div style="display:flex;gap:3px;margin-top:2px;font-size:0.65rem;color:var(--wa-color-text-normal);">
          ${sources.map(s => `<span title="${s.pct}%">${s.icon}</span>`).join('')}
        </div>
        <div style="background:${color};color:#fff;font-size:0.65rem;font-family:system-ui,sans-serif;
          font-weight:600;padding:1px 5px;border-radius:3px;margin-top:3px;white-space:nowrap;text-align:center;">
          ${municipalityName}</div>
        <div style="font-size:0.6rem;color:var(--wa-color-text-quiet);margin-top:3px;text-align:center;line-height:1.3;border-top:1px solid var(--wa-color-surface-border);padding-top:2px;width:100%;">
          <div style="color:var(--wa-color-success-fill-loud);font-weight:600;">⚡ ${erzeugungMwh} MWh</div>
          <div>🏠 ${verbrauchMwh} MWh</div>
          <div style="color:${netKwh >= 0 ? 'var(--wa-color-success-fill-loud)' : 'var(--wa-color-danger-fill-loud)'};font-weight:600;">⚖️ ${netSign}${netMwh} MWh</div>
        </div>`;

      const popup = new maplibregl.Popup({ offset: 28, maxWidth: '320px', closeButton: true })
        .setHTML(buildPopupHtml(municipalityName, d));

      // Attach click listener BEFORE creating marker so it captures events properly
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._openPopup) {
          this._openPopup.remove();
        }
        popup.setLngLat(position).addTo(this._map!);
        this._openPopup = popup;
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(position)
        .addTo(this._map!);

      this._markers.push(marker);
    }

    this._updateMunicipalityHighlights();
  }

  protected override renderContent() {
    return html`
      <div id="wmm-map"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wattmonitor-map-part': WattmonitorMapPart;
  }
}
