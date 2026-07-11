import { customElement, html } from '@eclipse-docks/core/externals/lit';
import { DocksWidget } from '@eclipse-docks/core';

@customElement('wattmonitor-legend-widget')
export class WattmonitorLegendWidget extends DocksWidget {
  override render() {
    return html`
      <div style="
        display:flex;align-items:center;gap:12px;
        font-size:var(--wa-font-size-s);padding:0 var(--wa-space-m);
        color:var(--wa-color-text-normal);font-family:system-ui,sans-serif;">
        <div style="font-weight:700;white-space:nowrap;">Regional erneuerbar</div>
        <div style="display:flex;align-items:center;gap:12px;">
          ${(['#16a34a,≥ 90 %', '#4ade80,≥ 70 %', '#facc15,≥ 50 %', '#fb923c,≥ 30 %', '#ef4444,< 30 %'] as const)
            .map(entry => { const [c, l] = entry.split(','); return html`
              <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;"></div>
                <span style="white-space:nowrap;">${l}</span>
              </div>`; })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wattmonitor-legend-widget': WattmonitorLegendWidget;
  }
}
