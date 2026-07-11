import { customElement, html } from '@eclipse-docks/core/externals/lit';
import { DocksElement, DocksWidget } from '@eclipse-docks/core';
import { USE_MOCK_DATA, loadingSignal, lastUpdateSignal, errorCountSignal } from './map-status.js';

@customElement('wattmonitor-status-widget')
export class WattmonitorStatusWidget extends DocksElement {
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
        ${loading
          ? html`<span style="color:var(--wa-color-text-quiet);white-space:nowrap;">⟳ Lädt…</span>`
          : errorCount > 0
            ? html`<span style="color:var(--wa-color-danger-fill-loud);white-space:nowrap;">⚠ ${errorCount} Fehler</span>`
            : html`<span style="color:var(--wa-color-success-fill-loud);white-space:nowrap;">✓ Aktuell</span>`}
        <span style="color:var(--wa-color-text-quiet);white-space:nowrap;">Stand: ${ts}</span>
        ${USE_MOCK_DATA ? html`<span style="color:var(--wa-color-brand-fill-loud);font-weight:600;white-space:nowrap;">[Mock]</span>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wattmonitor-status-widget': WattmonitorStatusWidget;
  }
}
