/**
 * Alternative architectures, siblings to the transformer.
 *
 * The app teaches the transformer because it is the incumbent. These nodes are
 * where the transformer stops being the only option. Each one names the
 * transformer cost it is trying to remove, the trick that replaces it, and the
 * new limit that comes back in exchange.
 */

import { outline } from '../outline';
import type { ConceptNode, Source } from '../schema';

const MAMBA: Source = {
  label: 'Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
  url: 'https://arxiv.org/abs/2312.00752',
};

export const architectureNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'mamba',
      title: 'Mamba',
      tag: 'state-space model',
      color: 'yellow',
      order: 3,
      track: 'beyond',
      parent: 'beyond',
      L0_oneLiner:
        'A language model without attention. Each token updates a fixed-size running state, so cost stops growing with the sequence length.',
      L0_analogy:
        'A river instead of a warehouse. You keep only what fits in a bucket you carry, and let the rest flow past.',
      prereqs: ['transformer'],
      leadsTo: [],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Attention costs grow with the square of the sequence.** Double the context and the grid quadruples. That is the cost every long-context architecture is trying to remove.',
        '**Mamba replaces the grid with a running state.** Each token updates a small fixed-size memory and moves on. Cost then grows linearly with the sequence, not quadratically.',
        '**The state is selective.** A gate learned from the input decides what to keep and what to drop for each token. That is what separates it from older linear-time recurrent networks.',
        '**It trains at transformer speed.** A parallel scan algorithm keeps training fast on modern hardware. Serving is where the linear cost turns into real savings.',
      ],
      flow: {
        caption: 'One token, one state update. No grid.',
        steps: [
          { id: 'x', label: 'Token in', kind: 'input', sub: 'one vector at a time' },
          {
            id: 'gate',
            label: 'Selective gates',
            kind: 'control',
            sub: 'decide what to keep and what to drop, for this token',
          },
          {
            id: 'state',
            label: 'Fixed-size state',
            kind: 'store',
            sub: 'every past token has already been folded into this',
          },
          { id: 'y', label: 'Output', kind: 'output', sub: 'the next hidden state, or the next token score' },
        ],
        note: 'Nothing is looked up again. Past tokens live only through the state, and the state is small.',
      },
    },
    L2_snags: [
      {
        q: 'Is it really as good as a transformer?',
        a: 'On short and medium context language benchmarks, small Mamba models match or beat similar-sized transformers. At very large sizes the picture is less settled. Exact copy-paste from earlier in the sequence is one place transformers still lead.',
      },
      {
        q: 'Does it have attention at all?',
        a: 'No. The whole point is to remove the token-to-token grid. Information moves through the running state, one step at a time. Anything that behaves like attention has to be reconstructed from the state.',
      },
      {
        q: 'Why is it called a state space model?',
        a: 'The math describes it as a small linear system carried between tokens. Systems of that shape have been studied for decades in control theory. What Mamba adds is a way to change the system for each token, so it reacts to what matters.',
      },
    ],
    L3_atScale: [
      {
        label: 'Cost per token at long context',
        here: 'linear',
        llama: 'quadratic in the sequence',
        note: 'This is the whole point.',
        source: MAMBA,
      },
      {
        label: 'KV cache size',
        here: 'none',
        llama: 'grows with every past token',
        note: 'A running state replaces the cache.',
      },
      {
        label: 'Published in',
        here: '2023',
        llama: '2017',
        source: MAMBA,
      },
    ],
    L4_underHood: `\`\`\`
h_t = A_t * h_{t-1} + B_t * x_t
y_t = C_t * h_t
\`\`\`

Three small matrices per step. A_t, B_t and C_t are computed from the input at that step, which is what makes the state selective. During training a parallel scan computes every h_t at once, so wall-clock speed stays close to a transformer.`,
  },
];
