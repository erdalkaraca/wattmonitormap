import { customElement, html } from '@eclipse-docks/core/externals/lit';
import { DocksWidget } from '@eclipse-docks/core';

@customElement('wattmonitor-attribution-widget')
export class WattmonitorAttributionWidget extends DocksWidget {
  override render() {
    return html`
      <div style="
        font-size:var(--wa-font-size-xs);padding:0 var(--wa-space-s);
        color:var(--wa-color-text-quiet);font-family:system-ui,sans-serif;">
        © <a href="https://basemap.de" 
             target="_blank" rel="noopener noreferrer"
             style="color:var(--wa-color-text-quiet);text-decoration:underline;cursor:pointer;">
          basemap.de</a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wattmonitor-attribution-widget': WattmonitorAttributionWidget;
  }
}
