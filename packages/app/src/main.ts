import { appLoaderService, contributionRegistry, type HTMLContribution, TOOLBAR_MAIN, TOOLBAR_LAYOUT_SWITCHER, TOOLBAR_LANGUAGE_SELECTOR, TOOLBAR_ACTIVE_PART_NAME } from '@eclipse-docks/core';

const logoUrl = `${import.meta.env.BASE_URL}logo-loading.svg`;

/** Which extensions the shell offers; keep in sync with `extension-*` / `@scope/extension-*` entries in package.json (auto side-effect-imported via resolveDepVersionsPlugin). */
contributionRegistry.registerContribution(TOOLBAR_MAIN, {
  label: 'Brand',
  slot: 'start',
  component: `<div style="display:flex;align-items:center;gap:0.75rem;margin:1rem;"><img src="${logoUrl}" alt="WattMonitorMap" style="height:32px;width:32px;"/><span style="font-weight:600;font-size:1.1rem;white-space:nowrap;">WattMonitor Map</span></div>`,
} as HTMLContribution);

const appRoot = document.getElementById('app-root') ?? document.body;
appLoaderService.registerApp(
  {
    layout: 'wattmonitor-map',
    name: 'WattMonitor Map',
    description: 'WattMonitor Map – Application built with Eclipse Docks.',
    remaps: [
      // Hide the layout switcher – this app always uses the map layout.
      { name: TOOLBAR_LAYOUT_SWITCHER, targets: [] },
      // Hide the language switcher – UI language is not user-configurable here.
      { name: TOOLBAR_LANGUAGE_SELECTOR, targets: [] },
      // Hide the active part name widget – not meaningful for a fullscreen map.
      { name: TOOLBAR_ACTIVE_PART_NAME, targets: [] },
    ],
    extensions: [
      '@eclipse-docks/extension-pwa',
      'extension-wattmonitor-map',
    ],
  },
  { autoStart: true, hostConfig: true, container: appRoot },
);
