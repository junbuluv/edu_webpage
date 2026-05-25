import ScenarioPlayer, { type Stage } from '@components/mdx/ScenarioPlayer';
import ISLMScenarioView from '@components/viz/ISLMScenarioView';

// Wraps ScenarioPlayer with IS-LM-specific stages. We can't pass a
// React render prop across the MDX/Astro JSX boundary, so this island
// is self-contained: MDX just drops in <ISLMScenarioDemo client:visible />.

interface ISLMState {
  G: number;
  M: number;
  A0: number;
  [k: string]: number;
}

const stages: Stage<ISLMState>[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    state: { G: 100, M: 100, A0: 100 },
    caption: 'Calibrated equilibrium. Anchor for comparison.',
  },
  {
    id: 'fiscal',
    label: 'Fiscal expansion (Congress raises G)',
    state: { G: 180, M: 100, A0: 100 },
    caption:
      'IS shifts right. Both Y and r rise. Investment is crowded out at the new equilibrium.',
  },
  {
    id: 'monetary',
    label: 'Monetary expansion (Fed raises M)',
    state: { G: 100, M: 180, A0: 100 },
    caption: 'LM shifts right. Y rises, r falls. The Fed-style result.',
  },
  {
    id: 'pessimism',
    label: 'Confidence collapse (autonomous spending falls)',
    state: { G: 100, M: 100, A0: 60 },
    caption:
      'IS shifts left. Y and r both fall. This is the canonical recession in IS-LM.',
  },
];

export default function ISLMScenarioDemo() {
  return (
    <ScenarioPlayer
      title="Four IS-LM shocks"
      stages={stages}
      render={(state) => <ISLMScenarioView state={state} />}
    />
  );
}
