import{F as e,a as t,b as n,c as r,r as i,v as a,x as o,z as s}from"./dist-hqylMtri.js";import{i as c,n as l,r as u,t as d}from"./map-status-c2S--ZD5.js";var f=class extends n{render(){return s`
      <div style="
        display:flex;align-items:center;gap:12px;
        font-size:var(--wa-font-size-s);padding:0 var(--wa-space-m);
        color:var(--wa-color-text-normal);font-family:system-ui,sans-serif;">
        <div style="font-weight:700;white-space:nowrap;">Regional erneuerbar</div>
        <div style="display:flex;align-items:center;gap:12px;">
          ${[`#16a34a,≥ 90 %`,`#4ade80,≥ 70 %`,`#facc15,≥ 50 %`,`#fb923c,≥ 30 %`,`#ef4444,< 30 %`].map(e=>{let[t,n]=e.split(`,`);return s`
              <div style="display:flex;align-items:center;gap:4px;">
                <div style="width:10px;height:10px;border-radius:50%;background:${t};flex-shrink:0;"></div>
                <span style="white-space:nowrap;">${n}</span>
              </div>`})}
        </div>
      </div>
    `}};f=a([e(`wattmonitor-legend-widget`)],f);var p=class extends i{constructor(...e){super(...e),this._onRefreshClick=()=>{window.dispatchEvent(new CustomEvent(d))}}doBeforeUI(){this.watch(c,()=>this.requestUpdate()),this.watch(u,()=>this.requestUpdate()),this.watch(l,()=>this.requestUpdate())}render(){let e=c.get(),t=u.get(),n=l.get(),r=t?.toLocaleTimeString(`de-DE`,{hour:`2-digit`,minute:`2-digit`})??`—`;return s`
      <div style="
        display:flex;align-items:center;gap:8px;
        font-size:var(--wa-font-size-s);padding:0 var(--wa-space-s);
        color:var(--wa-color-text-normal);
        flex-wrap:nowrap;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">
        <wa-button
          size="s"
          appearance=${e?`accent`:`plain`}
          ?disabled=${e}
          @click=${this._onRefreshClick}
          style="white-space:nowrap;"
        >
          <wa-icon name="refresh" style=${e?`animation:wmm-refresh-spin 0.9s linear infinite;`:``}></wa-icon>
          ${e?`Lädt…`:n>0?`Aktualisieren (${n} Fehler)`:`Aktuell`}
        </wa-button>
        <style>@keyframes wmm-refresh-spin{to{transform:rotate(360deg)}}</style>
        <span style="color:var(--wa-color-text-quiet);white-space:nowrap;">Stand: ${r}</span>
      </div>
    `}};p=a([e(`wattmonitor-status-widget`)],p),o.registerContribution(r,{label:`WattMonitor Status`,name:`wattmonitor.status`,slot:`start`,component:`<wattmonitor-status-widget></wattmonitor-status-widget>`}),o.registerContribution(t,{label:`basemap.de`,name:`wattmonitor.about-attribution.basemapde`,component:`
    <span>
      Base map tiles and map service attribution: <a href="https://basemap.de" target="_blank" rel="noopener noreferrer">basemap.de</a>
    </span>
  `}),o.registerContribution(t,{label:`BKG VG250`,name:`wattmonitor.about-attribution.vg250`,component:`
    <span>
      Municipality and state boundaries derived from <a href="https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-1-250-000-stand-31-12-vg250-31-12.html" target="_blank" rel="noopener noreferrer">BKG VG250 31.12</a>, licensed under <a href="https://www.govdata.de/dl-de/by-2-0" target="_blank" rel="noopener noreferrer">dl-de/by-2-0</a>; data modified.
    </span>
  `}),o.registerContribution(t,{label:`EWE NETZ`,name:`wattmonitor.about-attribution.ewe-netz`,component:`
    <span>
      Grid and operational data: <a href="https://www.ewe-netz.de" target="_blank" rel="noopener noreferrer">EWE NETZ</a>.
    </span>
  `});function m(){}export{m as default};