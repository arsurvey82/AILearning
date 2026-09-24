/**
 * The input side, as diggable terms with origins.
 *
 * Written so that following any chain of [[links]] bottoms out in ASSUMED words
 * within a few hops. tests/glossary.test.ts enforces that, so a term cannot be
 * mentioned and left undefined.
 *
 * Dates are the ones that separate concerns beginners fuse together. Attention
 * predates the transformer by three years, so it is not the transformer.
 * Backpropagation predates all of it and belongs to any neural network. The
 * context window is not a design preference, it is a consequence of a 2017
 * decision to throw the sequential reader away.
 */

import type { Term } from './schema';

export const TERMS: Term[] = [
  /* ---------------------------------------------------------------- the idea */
  {
    id: 'embedding',
    term: 'Embedding',
    plain:
      'Turning a [[token]] into a [[vector]], so that things which mean similar things end up near each other.',
    not: 'It is not the model understanding the word. Nothing in here knows what a cat is.',
    more: [
      'The whole trick is that meaning becomes location. Once words have positions, a computer can find related things by measuring the [[distance-idea]] between them, and it never has to know what any of them mean.',
      'This is the front door of a language model, and it is finished before any of the clever part begins.',
    ],
    see: ['token', 'vector', 'token-table', 'distance-idea'],
  },
  {
    id: 'distance-idea',
    term: 'Meaning as distance',
    plain:
      'If similar things are placed near each other, then measuring nearness is the same as asking how related two things are.',
    more: [
      'This is the one idea the rest depends on. It is also why a [[vector-store]] can search by meaning without anything in it understanding a single word.',
    ],
    origin: {
      kind: 'forced',
      because:
        'A computer can compare numbers and nothing else. If relatedness is going to be computable at all, it has to become arithmetic on positions.',
    },
    see: ['vector', 'embedding'],
  },

  /* ------------------------------------------------------------- the objects */
  {
    id: 'token',
    term: 'Token',
    plain: 'A chunk of text the model knows, with a [[token-id]] attached.',
    not: 'Not always a whole word. "animal" may arrive as "anim" plus "al", which is why it is called a token rather than a word.',
    more: [
      'The set of chunks a model knows is its [[vocabulary]], and it is fixed before training starts.',
    ],
    see: ['token-id', 'vocabulary', 'subword'],
  },
  {
    id: 'token-id',
    term: 'Token ID',
    plain: 'The row number a [[token]] has in the [[token-table]]. cat is 1598.',
    not: 'It is a locker label, not a measurement. cat is not 1598 units of anything, and 1599 is not its neighbour.',
    see: ['token', 'token-table'],
  },
  {
    id: 'vector',
    term: 'Vector',
    plain: 'A list of numbers, read as a position. [.24, -.05, -.23, .01] is a spot.',
    not: 'There is nothing intelligent inside it. The intelligence was in the placing, and that already happened.',
    see: ['component', 'dimension', 'distance-idea'],
  },
  {
    id: 'component',
    term: 'Component',
    plain: 'One number inside a [[vector]]. Four numbers, four components.',
    not: 'No single component means anything on its own. There is no "animal" component. Meaning is spread across many at once.',
    see: ['vector', 'dimension'],
  },
  {
    id: 'dimension',
    term: 'Dimension',
    plain:
      'How many [[component]]s each [[vector]] has. The width of every row, fixed by a person before anything is built.',
    more: [
      'More width means more elbow room: space for a word to sit near all of its relatives at once without being shoved next to strangers.',
      'Nobody derived the right number. The 2017 transformer paper used 512 and gives no reason for it. Everything since is that guess, scaled with budgets.',
    ],
    origin: {
      kind: 'fix',
      year: 1986,
      problem:
        'One slot per word, one switched on, the rest zero. With 100,000 words that is 100,000 [[component]]s, and every word sits exactly as far from every other. cat is no closer to dog than to Tuesday.',
      gained:
        'Squeezing down to a few hundred numbers with all of them in use. Sparse became dense, and nearness became possible at all.',
      source: {
        label: 'Rumelhart, Hinton and Williams, Learning representations by back-propagating errors',
        url: 'https://www.nature.com/articles/323533a0',
      },
    },
    see: ['one-hot', 'vector', 'component'],
  },
  {
    id: 'one-hot',
    term: 'One-hot',
    plain:
      'The older way: give every word its own slot, switch one on, leave the rest at zero.',
    not: 'It is not wrong, it is just useless for nearness. Every word is equidistant from every other, so no [[distance-idea]] survives.',
    more: [
      'This is the failure that [[dimension]] exists to fix, which is why dimension has nothing to do with transformers and predates them by thirty years.',
    ],
    see: ['dimension', 'distance-idea'],
  },
  {
    id: 'token-table',
    term: 'Token table',
    plain: 'One [[vector]] per [[token]], every row the same width. Also called the embedding matrix.',
    not: 'It is a lookup and a lookup only. Big, but dumb, and a small share of a real model.',
    see: ['token', 'vector', 'position-table', 'build-time'],
  },
  {
    id: 'position-table',
    term: 'Position table',
    plain: 'One [[vector]] per seat in the input, added on top of the [[token-table]] row.',
    more: [
      'Its height is the [[context-window]], and it has no reason to match the [[vocabulary]] size. One says which words exist, the other says how long an input can be.',
      'The numbers are deliberately small: a nudge, not a takeover. cat at the front and cat at the back must both still look mostly like cat.',
    ],
    origin: {
      kind: 'fix',
      year: 2017,
      problem:
        'The [[transformer]] looks at every [[token]] at once, like words tipped from a bag onto a table. Nothing inside a [[vector]] says which one came third, so "cat eat food" and "food eat cat" are the same pile.',
      gained: 'Order, added back as numbers, because the mechanism threw it away.',
      source: {
        label: 'Vaswani et al, Attention Is All You Need',
        url: 'https://arxiv.org/abs/1706.03762',
      },
    },
    see: ['transformer', 'context-window', 'token-table'],
  },
  {
    id: 'vocabulary',
    term: 'Vocabulary',
    plain: 'Every [[token]] the model knows, and nothing else.',
    origin: {
      kind: 'forced',
      because:
        'Computers hold numbers, not letters. Anything touching text has to decide what one unit is and how many exist. This is older than all of the rest and there is no version of the problem without it.',
    },
    see: ['token', 'subword'],
  },
  {
    id: 'subword',
    term: 'Subword',
    plain: 'Breaking an unknown word into known fragments so nothing is ever rejected.',
    origin: {
      kind: 'fix',
      year: 2016,
      problem: 'A fixed [[vocabulary]] meets a word it has never seen and has nothing to give.',
      gained: 'Worst case it falls back to letters, so every input is representable.',
      source: {
        label: 'Sennrich, Haddow and Birch, Neural Machine Translation of Rare Words with Subword Units',
        url: 'https://arxiv.org/abs/1508.07909',
      },
    },
    see: ['vocabulary', 'token'],
  },

  /* --------------------------------------------------------------- two times */
  {
    id: 'build-time',
    term: 'Build time',
    plain:
      'Once, before anything runs: decide the [[vocabulary]], write the settings, create the tables full of random numbers.',
    more: [
      'Everything is the right shape and the wrong values. Nothing means anything yet.',
      'The [[position-table]] is created here and used at every [[run-time]]. It is never "introduced during training".',
    ],
    see: ['run-time', 'training', 'token-table'],
  },
  {
    id: 'run-time',
    term: 'Run time',
    plain:
      'Every single time text goes in: text becomes [[token-id]]s, ids look up rows, position rows get added, and the result enters the first layer.',
    more: [
      'Both tables exist from [[build-time]]. Neither is used until now.',
      'Mixing these two up is where most confusion about language models comes from.',
    ],
    see: ['build-time', 'training'],
  },
  {
    id: 'training',
    term: 'Training',
    plain: '[[run-time]] repeated millions of times, with the numbers corrected after each run.',
    not: 'It is not a third kind of time. The machinery is identical to a normal run; the only difference is that afterwards something adjusts the numbers.',
    more: [
      'The correction step is [[backpropagation]], and it belongs to neural networks in general rather than to this architecture.',
      'When training finishes the numbers freeze. Typing at a finished model runs exactly the same machinery with nothing being corrected.',
    ],
    see: ['run-time', 'backpropagation', 'build-time'],
  },
  {
    id: 'mcculloch-pitts',
    term: 'McCulloch-Pitts neuron',
    plain:
      'The first mathematical neuron: weight the inputs, add them up, fire if the sum clears a bar.',
    not: 'Not a model of a real brain cell. It is a threshold gate that borrowed the word neuron and never gave it back.',
    more: [
      'Every neural network since is a rearrangement of this one idea. Learning was not part of it yet, that came later.',
    ],
    origin: {
      kind: 'fix',
      year: 1943,
      problem:
        'Nobody had a way to describe a nerve cell as a mathematical object. Without one, no argument about what a network of them could compute was possible.',
      gained:
        'A neuron reduced to a threshold gate, and the start of a field that could argue about what such gates can and cannot compute.',
      source: {
        label: 'McCulloch and Pitts, A Logical Calculus of the Ideas Immanent in Nervous Activity',
        url: 'https://link.springer.com/article/10.1007/BF02478259',
      },
    },
    see: ['backpropagation'],
  },
  {
    id: 'minsky-papert',
    term: 'Minsky-Papert Perceptrons',
    plain:
      'The 1969 book that proved a single layer of perceptrons cannot separate XOR.',
    not: 'Not a proof that neural networks in general cannot learn hard patterns. The book argued deeper stacks would not help either, and that part turned out to be wrong.',
    more: [
      'The reputation of the book slowed neural research for over a decade. When [[backpropagation]] arrived in 1986, the case it repaired was this one.',
    ],
    origin: {
      kind: 'fix',
      year: 1969,
      problem:
        'The perceptron had raised hopes far beyond what a single layer of them could actually compute. XOR was the standing counterexample and nobody had a rebuttal.',
      gained:
        'A proof that one layer cannot separate XOR, and the argument that stalled the field until backpropagation revived it.',
      source: {
        label: 'Minsky and Papert, Perceptrons',
        url: 'https://mitpress.mit.edu/9780262630221/perceptrons/',
      },
    },
    see: ['backpropagation'],
  },
  {
    id: 'backpropagation',
    term: 'Backpropagation',
    plain: 'The rule for working out which numbers to nudge, and in which direction, after a wrong answer.',
    not: 'Not part of the [[transformer]]. It is how any neural network is tuned, and it is older than all of this.',
    origin: {
      kind: 'fix',
      year: 1986,
      problem: 'A network with layers in the middle had no known way to assign blame for a mistake.',
      gained: 'A way to tune every number in a deep network, which made deep networks worth building.',
      source: {
        label: 'Rumelhart, Hinton and Williams, Learning representations by back-propagating errors',
        url: 'https://www.nature.com/articles/323533a0',
      },
    },
    see: ['training'],
  },

  /* ------------------------------------------------------------ architecture */
  {
    id: 'attention',
    term: 'Attention',
    plain:
      'Every [[token]] scores every other token, then pulls in a share of whichever ones score highest.',
    more: [
      'The scoring is a [[dot-product]] between what one token is looking for and what another offers.',
      'This is why a word lands somewhere different depending on its neighbours: bank next to river is not bank next to cash.',
    ],
    origin: {
      kind: 'fix',
      year: 2014,
      problem:
        'Older translators crushed a whole sentence into one fixed summary before writing any output, and long sentences did not survive the squeeze.',
      gained: 'Looking back at every word directly and choosing what matters, instead of relying on one summary.',
      source: {
        label: 'Bahdanau, Cho and Bengio, Neural Machine Translation by Jointly Learning to Align and Translate',
        url: 'https://arxiv.org/abs/1409.0473',
      },
    },
    see: ['dot-product', 'transformer'],
  },
  {
    id: 'dot-product',
    term: 'Dot product',
    plain: 'Two [[vector]]s in, one number out: multiply matching [[component]]s and add them up.',
    more: [
      'Large when two vectors point the same way, near zero when they are unrelated. It is the measuring tool everything else is built on.',
    ],
    see: ['vector', 'attention', 'distance-idea'],
  },
  {
    id: 'transformer',
    term: 'Transformer',
    plain: 'What you get when you keep [[attention]] and throw the left-to-right reader away.',
    more: [
      'Two consequences follow immediately, and both are worth knowing as consequences rather than features. Word order vanishes, so a [[position-table]] has to add it back. And everything must be present at once, so a [[context-window]] appears.',
    ],
    origin: {
      kind: 'fix',
      year: 2017,
      problem:
        'Reading a sentence one word at a time cannot be parallelised, so training was slow and long-range links were weak.',
      gained: 'Every position computed at once, which is what made training at scale affordable.',
      source: {
        label: 'Vaswani et al, Attention Is All You Need',
        url: 'https://arxiv.org/abs/1706.03762',
      },
    },
    see: ['attention', 'position-table', 'context-window'],
  },
  {
    id: 'context-window',
    term: 'Context window',
    plain: 'The most [[token]]s the model can have in front of it at once.',
    not: 'Not a product decision or a limit someone chose to be stingy. It is a side effect of the mechanism.',
    more: [
      'Because a [[transformer]] holds everything at once, there has to be a fixed number of seats, and the [[position-table]] has exactly that many rows and not one more.',
    ],
    origin: {
      kind: 'fix',
      year: 2017,
      problem: 'Holding every [[token]] at once means the number held has to be finite and decided in advance.',
      gained: 'Nothing. It is a cost, and most work since has been about paying less of it.',
    },
    see: ['transformer', 'position-table'],
  },

  /* --------------------------------------------------------------- adjacent */
  {
    id: 'vector-store',
    term: 'Vector store',
    plain:
      'A separate box of finished [[vector]]s with an index for finding near ones quickly.',
    not: 'Not part of the model. It is a search engine that searches by nearness instead of by keyword, and it never touches the model\'s insides.',
    more: [
      'One trap: a position only means anything against the model that produced it. Swap the model and every stored vector is scrap.',
    ],
    see: ['vector', 'distance-idea', 'embedding'],
  },
  {
    id: 'scaling',
    term: 'Scaling',
    plain: 'Making the model, the data and the compute bigger, in measured proportion.',
    origin: {
      kind: 'fix',
      year: 2020,
      problem: 'Nobody knew whether bigger reliably helped, or how to spend a budget between size and data.',
      gained:
        'It does help, predictably enough to plan with, which turned model building into budget arithmetic.',
      source: {
        label: 'Kaplan et al, Scaling Laws for Neural Language Models',
        url: 'https://arxiv.org/abs/2001.08361',
      },
    },
    see: ['dimension', 'training'],
  },
];

export const BY_ID = new Map(TERMS.map((t) => [t.id, t]));

/** A term whose origin is a dated fix, with the union already narrowed. */
export type DatedTerm = Term & {
  origin: Extract<NonNullable<Term['origin']>, { kind: 'fix' }>;
  year: number;
};

/** Everything with a dated origin, oldest first. This is the walk-back path. */
export function timeline(): DatedTerm[] {
  const dated = TERMS.filter(
    (t): t is Term & { origin: Extract<NonNullable<Term['origin']>, { kind: 'fix' }> } =>
      t.origin?.kind === 'fix',
  );
  return dated.map((t) => ({ ...t, year: t.origin.year })).sort((a, b) => a.year - b.year);
}

/** Things nobody chose. Worth separating: they have no alternative history. */
export function forced(): Term[] {
  return TERMS.filter((t) => t.origin?.kind === 'forced');
}
