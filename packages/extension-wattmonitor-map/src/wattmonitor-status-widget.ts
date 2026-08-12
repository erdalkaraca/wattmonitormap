import { customElement, html } from '@eclipse-docks/core/externals/lit';
import { DocksElement, DocksWidget } from '@eclipse-docks/core';
import { RELOAD_REQUEST_EVENT, loadingSignal, lastUpdateSignal, errorCountSignal } from './map-status.js';

@customElement('wattmonitor-status-widget')
export class WattmonitorStatusWidget extends DocksElement {
  private _onRefreshClick = () => {
    window.dispatchEvent(new CustomEvent(RELOAD_REQUEST_EVENT));
  };

  protected override doBeforeUI() {
    // Watch all three status signals for changes and re-render when they update
    this.watch(loadingSignal, () => this.requestUpdate());
    this.watch(lastUpdateSignal, () => this.requestUpdate());
    this.watch(errorCountSignal, () => this.requestUpdate());
  }

  override render() {
    const loading     = loadingSignal.get();
    const lastUpdate  = lastUpdateSignal.get();
    const errorCount  = errorCountSignal.get();

    const ts = lastUpdate?.toLocaleTimeString('de-DE', {
      hour: '2-digit', minute: '2-digit',
    }) ?? '—';

    return html`
      <div style="
        display:flex;align-items:center;gap:8px;
        font-size:var(--wa-font-size-s);padding:0 var(--wa-space-s);
        color:var(--wa-color-text-normal);
        flex-wrap:nowrap;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">
        <wa-button
          size="s"
          appearance=${loading ? 'accent' : 'plain'}
          ?disabled=${loading}
          @click=${this._onRefreshClick}
          style="white-space:nowrap;"
        >
          <wa-icon name="refresh" style=${loading ? 'animation:wmm-refresh-spin 0.9s linear infinite;' : ''}></wa-icon>
          ${loading
            ? 'Lädt…'
            : errorCount > 0
              ? `Aktualisieren (${errorCount} Fehler)`
              : 'Aktuell'}
        </wa-button>
        <style>@keyframes wmm-refresh-spin{to{transform:rotate(360deg)}}</style>
        <span style="color:var(--wa-color-text-quiet);white-space:nowrap;">Stand: ${ts}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wattmonitor-status-widget': WattmonitorStatusWidget;
  }
}
