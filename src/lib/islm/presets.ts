// Calibrated parameter triples for canonical macro scenarios in our
// IS-LM model. Numbers are tuned to land near textbook-recognizable
// equilibria, not to be historically faithful to the real economy.
// The narrative blurbs are deliberately specific so students see the
// mapping from "what happened" to "which knob moved."

export interface ISLMSnapshot {
  G: number;
  M: number;
  A0: number;
}

export interface ISLMPreset {
  id: string;
  label: string;
  state: ISLMSnapshot;
  blurb: string;
}

export const ISLM_BASELINE: ISLMSnapshot = { G: 100, M: 100, A0: 100 };

export const ISLM_PRESETS: ISLMPreset[] = [
  {
    id: 'baseline',
    label: 'Baseline (calibrated)',
    state: { ...ISLM_BASELINE },
    blurb: 'Default calibration. Use as your anchor before applying a shock.',
  },
  {
    id: 'volcker-1981',
    label: '1981 Volcker tightening',
    state: { G: 110, M: 50, A0: 100 },
    blurb:
      'Fed pushes M sharply down to fight 13% inflation. LM shifts left. r rises, Y falls. The textbook tight-money episode.',
  },
  {
    id: 'fiscal-2008',
    label: '2008 fiscal stimulus (ARRA)',
    state: { G: 180, M: 130, A0: 90 },
    blurb:
      "Congress lifts G; Fed accommodates with higher M; private confidence still soft (A0 a touch low). Net effect: Y recovers without r exploding.",
  },
  {
    id: 'pandemic-2020',
    label: '2020 pandemic response',
    state: { G: 200, M: 200, A0: 70 },
    blurb:
      'Massive fiscal + monetary expansion against a collapse in autonomous spending (lockdowns). Both IS and LM shift right while A0 falls.',
  },
  {
    id: 'fed-2022',
    label: '2022 Fed tightening',
    state: { G: 110, M: 70, A0: 110 },
    blurb:
      'Inflation forces the Fed to pull M down. Fiscal stays mildly supportive. r rises, Y softens but doesn’t crash.',
  },
];

export function findPreset(state: ISLMSnapshot): ISLMPreset | null {
  return (
    ISLM_PRESETS.find(
      (p) =>
        Math.abs(p.state.G - state.G) < 0.5 &&
        Math.abs(p.state.M - state.M) < 0.5 &&
        Math.abs(p.state.A0 - state.A0) < 0.5,
    ) ?? null
  );
}
