import { customElement, html, css, unsafeCSS, state } from '@eclipse-docks/core/externals/lit';
import { DocksPart } from '@eclipse-docks/core';
import maplibregl from 'maplibre-gl';
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { DEFAULT_MUNICIPALITIES, type Municipality } from './municipalities.js';
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
function getMapStyle(): string {
  const isDark = document.documentElement.classList.contains('wa-dark');
  return isDark
    ? 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json'
    : 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_col.json';
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

function buildPopupHtml(m: Municipality, d: WattMonitorDataPoint): string {
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
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:6px;color:var(--wa-color-text-normal);">${m.name}</div>
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
  private _dynamicMunicipalities: Map<string, Municipality> = new Map();
  private _loadedMunicipalityStates = new Set<string>();
  private _municipalityBoundaryData: FeatureCollection = { type: 'FeatureCollection', features: [] };
  private _municipalityHandlersBound = false;

  private _allMunicipalities(): Municipality[] {
    return [...DEFAULT_MUNICIPALITIES, ...this._dynamicMunicipalities.values()];
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

      if (!DEFAULT_MUNICIPALITIES.some((m) => m.key === key) && !this._dynamicMunicipalities.has(key)) {
        this._dynamicMunicipalities.set(key, {
          key,
          name,
          lng: event.lngLat.lng,
          lat: event.lngLat.lat,
        });
      }

      const target = this._allMunicipalities().find((m) => m.key === key);
      if (!target) return;

      try {
        await this._fetchOne(target);
        this._renderMarkers();
      } catch (error) {
        console.error(`Failed to load municipality data for ${key}:`, error);
      }
    });

    this._municipalityHandlersBound = true;
  }

  private async _loadMunicipalityBoundariesForVisibleStates(): Promise<void> {
    if (!this._map || !this._map.getLayer('state-boundaries-fill')) {
      return;
    }

    const visibleStates = this._map.queryRenderedFeatures(undefined, { layers: ['state-boundaries-fill'] });
    const statesToLoad = Array.from(new Set(
      visibleStates
        .map((feature) => String((feature.properties as Record<string, unknown> | undefined)?.SN_L ?? '').padStart(2, '0'))
        .filter((stateCode) => STATE_CODES.includes(stateCode as (typeof STATE_CODES)[number]))
    )).filter((stateCode) => !this._loadedMunicipalityStates.has(stateCode));

    if (statesToLoad.length === 0) {
      return;
    }

    const results = await Promise.allSettled(statesToLoad.map((stateCode) => loadMunicipalityBoundariesForState(stateCode)));
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const stateCode = statesToLoad[i];
      if (result.status === 'fulfilled') {
        this._loadedMunicipalityStates.add(stateCode);
        this._municipalityBoundaryData.features.push(...result.value.features);
      } else {
        console.error(`Failed to load municipality boundaries for state ${stateCode}:`, result.reason);
      }
    }

    const municipalitySource = this._map.getSource('municipality-boundaries') as maplibregl.GeoJSONSource | undefined;
    municipalitySource?.setData(this._municipalityBoundaryData as unknown as object);
  }

  override firstUpdated() {
    // DocksPart already calls super.firstUpdated — call it here too
    super.firstUpdated(new Map());

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

    this._map = new maplibregl.Map({
      container,
      style: getMapStyle(),
      center: [8.0, 53.35],
      zoom: 8.2,
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
        this._map!.on('moveend', () => {
          void this._loadMunicipalityBoundariesForVisibleStates();
        });
      } catch (error) {
        console.error('Failed to load country boundaries:', error);
      }

      // Set up theme change listener
      this._themeMutationObserver = new MutationObserver(() => {
        if (this._map) {
          this._map.setStyle(getMapStyle());
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
            }
          }, 100);
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
    clearInterval(this._refreshTimer);
    this._resizeObserver?.disconnect();
    this._themeMutationObserver?.disconnect();
    this._map?.remove();
  }

  private async _fetchAll(): Promise<void> {
    loadingSignal.set(true);
    const results = await Promise.allSettled(
      this._allMunicipalities().map(m => this._fetchOne(m))
    );
    errorCountSignal.set(results.filter(r => r.status === 'rejected').length);
    loadingSignal.set(false);
    lastUpdateSignal.set(new Date());
    this._renderMarkers();
  }

  private async _fetchOne(m: Municipality): Promise<void> {
    if (USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 50));
      this._data.set(m.key, generateMockData(m.key));
      return;
    }
    const res = await fetch(`${API_BASE}/api/getdata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m.key),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: WattMonitorDataPoint[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty response');
    this._data.set(m.key, data[0]);
  }

  private _renderMarkers(): void {
    if (!this._map) return;

    this._markers.forEach(mk => mk.remove());
    this._markers = [];

    for (const m of this._allMunicipalities()) {
      const d = this._data.get(m.key);
      if (!d) continue;

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
          ${m.name}</div>
        <div style="font-size:0.6rem;color:var(--wa-color-text-quiet);margin-top:3px;text-align:center;line-height:1.3;border-top:1px solid var(--wa-color-surface-border);padding-top:2px;width:100%;">
          <div style="color:var(--wa-color-success-fill-loud);font-weight:600;">⚡ ${erzeugungMwh} MWh</div>
          <div>🏠 ${verbrauchMwh} MWh</div>
          <div style="color:${netKwh >= 0 ? 'var(--wa-color-success-fill-loud)' : 'var(--wa-color-danger-fill-loud)'};font-weight:600;">⚖️ ${netSign}${netMwh} MWh</div>
        </div>`;

      const popup = new maplibregl.Popup({ offset: 28, maxWidth: '320px', closeButton: true })
        .setHTML(buildPopupHtml(m, d));

      // Attach click listener BEFORE creating marker so it captures events properly
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._openPopup) {
          this._openPopup.remove();
        }
        popup.setLngLat([m.lng, m.lat]).addTo(this._map!);
        this._openPopup = popup;
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([m.lng, m.lat])
        .addTo(this._map!);

      this._markers.push(marker);
    }
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
