import type { HTMLContribution, LayoutContribution } from '@eclipse-docks/core';
import { contributionRegistry, SYSTEM_ATTRIBUTIONS, SYSTEM_LAYOUTS, TOOLBAR_BOTTOM } from '@eclipse-docks/core';
import './wattmonitor-legend-widget.js';
import './wattmonitor-map-layout.js';
import './wattmonitor-status-widget.js';

contributionRegistry.registerContribution(SYSTEM_LAYOUTS, {
  id: 'wattmonitor-map',
  name: 'WattMonitor Karte',
  icon: 'map',
  component: { tag: 'wattmonitor-map-layout' },
} as LayoutContribution);

contributionRegistry.registerContribution(TOOLBAR_BOTTOM, {
  label: 'WattMonitor Status',
  name: 'wattmonitor.status',
  slot: 'start',
  component: '<wattmonitor-status-widget></wattmonitor-status-widget>',
} as HTMLContribution);

contributionRegistry.registerContribution(SYSTEM_ATTRIBUTIONS, {
  label: 'basemap.de',
  name: 'wattmonitor.about-attribution.basemapde',
  component: `
    <span>
      Base map tiles and map service attribution: <a href="https://basemap.de" target="_blank" rel="noopener noreferrer">basemap.de</a>
    </span>
  `,
} as HTMLContribution);

contributionRegistry.registerContribution(SYSTEM_ATTRIBUTIONS, {
  label: 'BKG VG250',
  name: 'wattmonitor.about-attribution.vg250',
  component: `
    <span>
      Municipality and state boundaries derived from <a href="https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-1-250-000-stand-31-12-vg250-31-12.html" target="_blank" rel="noopener noreferrer">BKG VG250 31.12</a>, licensed under <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer">dl-de/by-2-0</a>; data modified.
    </span>
  `,
} as HTMLContribution);

contributionRegistry.registerContribution(SYSTEM_ATTRIBUTIONS, {
  label: 'EWE NETZ',
  name: 'wattmonitor.about-attribution.ewe-netz',
  component: `
    <span>
      Grid and operational data: <a href="https://www.ewe-netz.de" target="_blank" rel="noopener noreferrer">EWE NETZ</a>.
    </span>
  `,
} as HTMLContribution);

export default function wattmonitorMapLoader() {}
