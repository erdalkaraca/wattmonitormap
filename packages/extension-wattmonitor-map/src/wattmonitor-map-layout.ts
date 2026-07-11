import { customElement, html } from '@eclipse-docks/core/externals/lit';
import { DocksContainer } from '@eclipse-docks/core';
import {
  TOOLBAR_MAIN,
  TOOLBAR_MAIN_CENTER,
  TOOLBAR_MAIN_RIGHT,
  TOOLBAR_BOTTOM,
  TOOLBAR_BOTTOM_CENTER,
  TOOLBAR_BOTTOM_END,
} from '@eclipse-docks/core';
import './wattmonitor-map-part.js';

/**
 * Full-screen map layout for WattMonitor.
 * Mirrors the structural pattern of DocksStandardLayout but replaces
 * all sidebars and editor area with a single WattmonitorMapPart.
 */
@customElement('wattmonitor-map-layout')
export class WattmonitorMapLayout extends DocksContainer {
  override createRenderRoot() { return this; }

  override render() {
    return html`
      <style>
        *, *::before, *::after { box-sizing: border-box; }

        html { height: 100%; margin: 0; padding: 0; overflow: hidden; }

        body {
          height: 100%; width: 100%;
          margin: 0; padding: 0;
          overflow: hidden;
          display: flex; flex-direction: column;
        }

        wattmonitor-map-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
        }

        wattmonitor-map-layout .toolbar-top {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          align-items: center;
          border-bottom: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
          flex-shrink: 0;
          position: relative;
          z-index: 100;
        }

        wattmonitor-map-layout .toolbar-top > :nth-child(1) { justify-self: start; }
        wattmonitor-map-layout .toolbar-top > :nth-child(2) { justify-self: center; }
        wattmonitor-map-layout .toolbar-end { justify-self: end; }

        wattmonitor-map-layout .map-area {
          flex: 1;
          min-height: 0;
          position: relative;
        }

        wattmonitor-map-layout .toolbar-bottom {
          width: 100%;
          border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
          display: grid;
          grid-template-columns: 1fr 2fr auto;
          align-items: center;
          flex-shrink: 0;
          min-height: 32px;
          padding: 0 var(--wa-space-s);
        }
      </style>

      <div class="toolbar-top">
        <docks-toolbar id=${TOOLBAR_MAIN}></docks-toolbar>
        <docks-toolbar id=${TOOLBAR_MAIN_CENTER}></docks-toolbar>
        <docks-toolbar class="toolbar-end" id=${TOOLBAR_MAIN_RIGHT}></docks-toolbar>
      </div>

      <div class="map-area">
        <wattmonitor-map-part></wattmonitor-map-part>
      </div>

      <div class="toolbar-bottom">
        <docks-toolbar id=${TOOLBAR_BOTTOM}></docks-toolbar>
        <docks-toolbar id=${TOOLBAR_BOTTOM_CENTER}></docks-toolbar>
        <docks-toolbar id=${TOOLBAR_BOTTOM_END}></docks-toolbar>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wattmonitor-map-layout': WattmonitorMapLayout;
  }
}
