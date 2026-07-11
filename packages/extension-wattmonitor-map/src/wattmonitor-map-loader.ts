import { contributionRegistry, SYSTEM_LAYOUTS, TOOLBAR_BOTTOM, TOOLBAR_BOTTOM_CENTER, TOOLBAR_BOTTOM_END } from '@eclipse-docks/core';
import type { LayoutContribution, HTMLContribution } from '@eclipse-docks/core';
import './wattmonitor-map-layout.js';
import './wattmonitor-legend-widget.js';
import './wattmonitor-attribution-widget.js';
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

contributionRegistry.registerContribution(TOOLBAR_BOTTOM_CENTER, {
  label: 'Map Attribution',
  name: 'wattmonitor.attribution',
  slot: 'end',
  component: '<wattmonitor-attribution-widget></wattmonitor-attribution-widget>',
} as HTMLContribution);

export default function wattmonitorMapLoader() {}
