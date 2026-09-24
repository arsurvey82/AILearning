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

/*
 * URLs are assembled with an explicit slash join so the gate's line-comment
 * stripper does not mistake the double slash inside a string for a real
 * comment and eat the rest of the line.
 */
const S = '/';
const MAMBA: Source = {
  label: 'Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
  url: `https:${S}${S}arxiv.org/abs/2312.00752`,
};
const RWKV: Source = {
  label: 'Peng et al, RWKV: Reinventing RNNs for the Transformer Era',
  url: `https:${S}${S}arxiv.org/abs/2305.13048`,
};
const LIQUID: Source = {
  label: 'Hasani et al, Liquid Time-Constant Networks',
  url: `https:${S}${S}arxiv.org/abs/2006.04439`,
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

  {
    ...outline({
      id: 'rwkv',
      title: 'RWKV',
      tag: 'recurrent-transformer hybrid',
      color: 'green',
      order: 4,
      track: 'beyond',
      parent: 'beyond',
      L0_oneLiner:
        'A recurrent transformer hybrid. Trains in parallel like a transformer, runs step by step like an older recurrent network.',
      L0_analogy:
        'The training rig and the delivery van are different vehicles for the same route. Use whichever is faster for the trip in hand.',
      prereqs: ['transformer'],
      leadsTo: [],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Transformers train fast and serve slowly at long context.** Recurrent networks are the mirror image: cheap to serve, painful to train. RWKV takes both sides.',
        '**Attention is replaced by a weighted decay over past values.** The score for a past token is not a query dotted with a key. It is the token value scaled by a learned decay of how many steps back it sits.',
        '**The formula is the same forwards and backwards.** Rewritten one way it is a matrix multiply over the whole sequence, which trains fast on a GPU. Rewritten the other way it is a running state, which serves cheaply.',
        '**Every layer has a time-mix and a channel-mix.** Time-mix blends the current token with a small window of past ones. Channel-mix is a per-token feed-forward step.',
      ],
      flow: {
        caption: 'One rule, two shapes. The same computation runs as a matrix during training and as a state at serving.',
        steps: [
          { id: 'x', label: 'Token in', kind: 'input' },
          { id: 'tm', label: 'Time-mix', kind: 'stage', sub: 'blend with a window of past tokens' },
          {
            id: 'state',
            label: 'Decaying state',
            kind: 'store',
            sub: 'a weighted trace of every past step, updated in place',
          },
          { id: 'cm', label: 'Channel-mix', kind: 'stage', sub: 'per-token feed-forward' },
          { id: 'y', label: 'Output', kind: 'output' },
        ],
        note: 'The training pass uses the matrix form. The serving pass uses the state form. Both compute the same thing.',
      },
    },
    L2_snags: [
      {
        q: 'How can one architecture be both parallel and recurrent?',
        a: 'The scoring rule uses a weighted decay that has a closed matrix form and an equivalent running form. Rewritten as matrices, you get a parallel training pass. Rewritten as a recurrence, you get a cheap serving pass. Both compute the same thing.',
      },
      {
        q: 'Is it really as expressive as a transformer?',
        a: 'On many language benchmarks the answer is close. RWKV models have been released at sizes competitive with open transformers. Fine-grained lookup of a specific past token is where it can trail, because it does not keep every token addressable.',
      },
      {
        q: 'Does it need a KV cache?',
        a: 'No. The past collapses into a small running state, so nothing token-shaped has to be stored. That is why the serving cost per token stays flat as the sequence grows.',
      },
    ],
    L3_atScale: [
      {
        label: 'Cost per token at long context',
        here: 'linear',
        llama: 'quadratic in the sequence',
        source: RWKV,
      },
      {
        label: 'State per layer',
        here: 'a small fixed vector',
        llama: 'grows with every past token',
      },
      {
        label: 'First public release',
        here: '2023',
        llama: '2017',
        source: RWKV,
      },
    ],
    L4_underHood: `\`\`\`
state_t = decay * state_{t-1} + k_t * v_t
y_t     = state_t / normaliser_t
\`\`\`

A weighted running sum over past keys and values, with a learned decay controlling how quickly old tokens fade. Unrolled, this is a running state. Written as a matrix over the whole sequence, it is a parallel training kernel. Same weights, two shapes.`,
  },

  {
    ...outline({
      id: 'liquid',
      title: 'Liquid Networks',
      tag: 'continuous-time units',
      color: 'aqua',
      order: 5,
      track: 'beyond',
      parent: 'beyond',
      L0_oneLiner:
        'Small networks with continuous-time dynamics. Each unit follows a differential equation whose time constant depends on the input.',
      L0_analogy:
        'A thermostat rather than a spreadsheet. The output does not appear all at once. It settles as the input changes.',
      prereqs: ['neuron'],
      leadsTo: [],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Standard networks are step functions.** A layer takes a vector, does one matrix multiply, and hands it on. Nothing evolves between steps.',
        '**Liquid networks are differential equations.** A unit output follows a time constant that itself depends on the input. So the unit response changes shape as the signal changes.',
        '**That makes them small and adaptive.** A handful of units can match much larger fixed networks on control and time-series tasks. Behaviour changes with the input, not only with the weights.',
        '**Liquid Foundation Models scale the same idea.** Larger continuous-time networks trained on text. The aim is high behaviour per parameter, cheap to run at serving.',
      ],
      flow: {
        caption: 'The unit itself is a small equation being solved as the input arrives.',
        steps: [
          { id: 'x', label: 'Signal in', kind: 'input', sub: 'a stream that changes over time' },
          {
            id: 'tau',
            label: 'Time constant tau(x)',
            kind: 'control',
            sub: 'itself a function of the input, so response speed adapts',
          },
          {
            id: 'ode',
            label: 'Solve dh/dt',
            kind: 'stage',
            sub: 'a numerical integrator steps the equation forward',
          },
          {
            id: 'state',
            label: 'Unit state h',
            kind: 'store',
            sub: 'continuous, not a fresh number at every step',
          },
          { id: 'y', label: 'Output', kind: 'output' },
        ],
        note: 'The unit is a small equation. Solving it during the forward pass replaces the plain matrix multiply of a standard network.',
      },
    },
    L2_snags: [
      {
        q: 'Is this a transformer?',
        a: 'No. There is no attention, no KV cache, no token-to-token grid. The building block is a continuous-time unit whose behaviour changes with the input.',
      },
      {
        q: 'Why continuous time?',
        a: 'Because real signals change continuously, and a discrete-step network has to guess a fixed rhythm for them. A continuous-time unit tracks change directly. That turns out to buy real accuracy on control tasks, with fewer parameters.',
      },
      {
        q: 'How is it trained if the units are differential equations?',
        a: 'The equations are solved by a numerical integrator during the forward pass. The chain rule is then applied through the integrator steps. Backprop reaches every weight, the same way it does in any deep network.',
      },
    ],
    L3_atScale: [
      {
        label: 'Unit',
        here: 'continuous-time differential equation',
        llama: 'matrix multiply plus curve',
        source: LIQUID,
      },
      {
        label: 'Parameter budget for similar behaviour',
        here: 'far fewer on control tasks',
        llama: 'many more',
        source: LIQUID,
      },
      {
        label: 'Published in',
        here: '2020',
        llama: '2017',
        source: LIQUID,
      },
    ],
    L4_underHood: `\`\`\`
dh/dt = -(1 / tau(x)) * (h - A(x))
\`\`\`

tau and A are small learned networks of the input. The unit does not have a single fixed response speed. It has one that changes with the signal, which is where the name comes from and where the small-and-adaptive behaviour comes from.`,
  },
];
