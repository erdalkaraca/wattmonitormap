export interface Municipality {
  key: string;
  name: string;
  /** WGS-84 longitude */
  lng: number;
  /** WGS-84 latitude */
  lat: number;
}

/**
 * Municipalities supported by the WattMonitor backend.
 * Keys are official German Amtlicher Gemeindeschlüssel (AGS / Gemeindeschlüssel).
 * Coordinates verified against official geodata (WGS-84).
 */
export const MUNICIPALITIES: Municipality[] = [
  { key: '03401000', name: 'Delmenhorst',   lng:  8.6282, lat: 53.0510 },
  { key: '03402000', name: 'Emden',          lng:  7.2067, lat: 53.3669 },
  { key: '03403000', name: 'Oldenburg',      lng:  8.2145, lat: 53.1435 },
  { key: '03405000', name: 'Wilhelmshaven',  lng:  8.1033, lat: 53.5253 },
  { key: '03452002', name: 'Aurich',         lng:  7.5013, lat: 53.4700 },
  { key: '03462001', name: 'Wittmund',       lng:  7.7776, lat: 53.5771 },
];

/**
 * Default seed markers shown on startup.
 * Focuses on larger municipalities in the northwest region.
 */
export const DEFAULT_MUNICIPALITY_KEYS = new Set<string>([
  '03403000', // Oldenburg
  '03405000', // Wilhelmshaven
  '03402000', // Emden
  '03401000', // Delmenhorst
]);

export const DEFAULT_MUNICIPALITIES: Municipality[] = MUNICIPALITIES.filter((m) =>
  DEFAULT_MUNICIPALITY_KEYS.has(m.key)
);
