import { extensionRegistry } from '@eclipse-docks/core';

extensionRegistry.registerExtension({
  id: 'extension-wattmonitor-map',
  name: 'WattMonitor Karte',
  description: 'MapLibre-based fullscreen map showing renewable energy data for all WattMonitor municipalities.',
  loader: () => import('./wattmonitor-map-loader.js'),
  icon: 'map',
});
