import type { LayoutContribution } from '@eclipse-docks/core';
import { contributionRegistry, extensionRegistry, SYSTEM_LAYOUTS } from '@eclipse-docks/core';
import './wattmonitor-map-layout.js';

// Registered here, not in the async loader: Docks renders the layout before extensions finish loading.
contributionRegistry.registerContribution(SYSTEM_LAYOUTS, {
  id: 'wattmonitor-map',
  name: 'WattMonitor Karte',
  label: 'WattMonitor Karte',
  icon: 'map',
  component: 'wattmonitor-map-layout',
} as LayoutContribution);

extensionRegistry.registerExtension({
  id: 'extension-wattmonitor-map',
  name: 'WattMonitor Karte',
  description: 'MapLibre-based fullscreen map showing renewable energy data for all WattMonitor municipalities.',
  loader: () => import('./wattmonitor-map-loader.js'),
  icon: 'map',
});
