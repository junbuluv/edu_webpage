// Calibrated parameter tuples for canonical AD-AS scenarios. Same
// philosophy as src/lib/islm/presets.ts: tune to textbook-recognizable
// equilibria, not historical accuracy.
//
// State vector matches ADASChart's State interface:
//   G   government spending
//   M   nominal money supply
//   Pe  expected price level (SRAS shifter)
//   Yn  natural rate of output

export interface ADASSnapshot {
  G: number;
  M: number;
  Pe: number;
  Yn: number;
}

export interface ADASPreset {
  id: string;
  label: string;
  state: ADASSnapshot;
  blurb: string;
}

export const ADAS_BASELINE: ADASSnapshot = {
  G: 100,
  M: 600,
  Pe: 2.5,
  Yn: 1000,
};

export const ADAS_PRESETS: ADASPreset[] = [
  {
    id: 'baseline',
    label: 'Baseline (calibrated)',
    state: { ...ADAS_BASELINE },
    blurb: 'Default calibration. AD and SRAS cross at Y ≈ Yn, P ≈ Pe.',
  },
  {
    id: 'demand-boom',
    label: 'Demand boom (consumer optimism + fiscal stimulus)',
    state: { G: 200, M: 700, Pe: 2.5, Yn: 1000 },
    blurb:
      'AD shifts right. Y rises above Yn (positive output gap); P also rises. Classic short-run boom.',
  },
  {
    id: 'oil-shock-1973',
    label: '1973 oil shock (supply contraction)',
    state: { G: 100, M: 600, Pe: 3.5, Yn: 900 },
    blurb:
      'SRAS shifts left (Pe up, Yn down). Stagflation: Y falls, P rises. Both AD-AS curves tell the same story.',
  },
  {
    id: 'demand-collapse-2008',
    label: '2008 demand collapse',
    state: { G: 100, M: 600, Pe: 2.5, Yn: 1000 },
    blurb:
      'Before Fed/Congress respond: AD shifts left as consumers and firms cut spending. Y falls below Yn; P falls.',
  },
  {
    id: 'pandemic-2020',
    label: '2020 pandemic (combined shock)',
    state: { G: 250, M: 1000, Pe: 2.8, Yn: 950 },
    blurb:
      'Huge fiscal + monetary response (AD strongly right) against supply-side disruptions (Yn down, Pe up). Net: Y stable but P rises noticeably.',
  },
];
