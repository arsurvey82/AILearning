/**
 * Continent 1. THE MODEL, minus the transformer subtree (see ./transformer.ts).
 *
 * Root, the maths underneath, and the nouns everything is built from.
 *
 * These are reference material rather than a path, a beginner should meet the
 * dot product *inside* an attention score, not as a prerequisite lecture. So
 * they are written to be looked up: short, concrete, and wired to the real toy
 * model where a real number is available.
 *
 * One correction carried over: the v1 prototype tagged the root "the machine".
 * The field-tested content answers exactly that, an LLM is a *model*.
 */

import { attention, dot } from '../../model/attention';
import { embed } from '../../model/embedding';
import { C_DIM, VOCAB, round2, tokenTable } from '../../model/toyModel';
import { outline } from '../outline';
import { SOURCES } from '../sources';
import type { ConceptNode } from '../schema';

export const rootNode: ConceptNode = {
  ...outline({
    id: 'llm',
    title: 'LLM',
    tag: 'a model, not a machine',
    color: 'blue',
    order: 0,
    track: 'model',
    L0_oneLiner:
      'A mathematical function with billions of tunable numbers, fitted to text until it can predict what comes next.',
    L0_analogy: 'Not an engine with moving parts. A very large equation that was tuned by example.',
    related: ['model', 'build', 'operations'],
  }),
  status: 'complete',
  snagsPlaytested: false,
  L1: {
    prose: [
      '**It is a function.** Text in, a probability for every possible next token out. Nothing more exotic than that.',
      '**The numbers were fitted, not written.** No one programmed grammar or facts. They are what lowering next-token prediction error produced.',
      '**Three things to understand it.** What it is made of, how it was made, and how it is run. The three continents on this map.',
      '**Everything it appears to *do* is something around it.** Tools, memory, retrieval: the model only ever emits text.',
    ],
    flow: {
      caption: 'The three continents, and what each answers.',
      steps: [
        { id: 'm', label: 'The Model', kind: 'stage', sub: 'what it is, maths, objects, architecture' },
        { id: 'b', label: 'The Build', kind: 'stage', sub: 'how it is made, data through alignment' },
        { id: 'o', label: 'The Operations', kind: 'stage', sub: 'how it is run, training and serving' },
      ],
      note: 'Start with the forward pass. The other two make far more sense once you have watched one input go through.',
    },
  },
  L2_snags: [
    {
      q: 'Is an LLM "a machine"?',
      a: 'No, it is a **model**: a mathematical function with billions of tunable numbers, fitted to data. Nothing mechanical is happening; it is arithmetic all the way down.',
    },
    {
      q: 'Does it know things, or look them up?',
      a: 'Neither exactly. There is no database to look in. Facts are distributed across the weights as a side effect of learning to predict text. That is also why it can be confidently wrong: nothing is stored as a retrievable record that could be checked.',
    },
    {
      q: 'Is it doing the same thing whether it is chatting or writing code?',
      a: 'Mechanically, identical. Predict the next token, append, repeat. What differs is the text it was trained on and what you put in the prompt.',
    },
  ],
  L3_atScale: [
    {
      label: 'Parameters',
      here: '<1,000',
      gpt2: '124 million',
      llama: '8 billion',
      source: SOURCES.gpt2Config,
    },
    {
      label: 'Trained on',
      here: 'nothing',
      gpt2: '40 GB of text',
      llama: '15T+ tokens',
      // Corrected 2026-08-05: GPT-2's published figure is corpus size, not tokens.
      note: 'The two are not directly comparable. OpenAI published GPT-2\'s corpus size, Meta published Llama 3\'s token count.',
      source: SOURCES.llama3Announcement,
    },
  ],
  L4_underHood: `\`\`\`python
def llm(token_ids) -> probabilities_over_vocabulary: ...
\`\`\`

That signature is the entire object. Everything else. The architecture, the training pipeline, the serving stack. Exists to make that function good and to make calling it affordable.`,
};

export const modelNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'model',
      title: 'The Model',
      tag: 'what it is',
      color: 'violet',
      order: 0,
      track: 'model',
      parent: 'llm',
      L0_oneLiner:
        'The internals: the maths it runs on, the objects it is built from, and the architecture where they flow.',
      L0_analogy: 'The engineering drawing rather than the factory or the delivery van.',
      leadsTo: ['build'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Three branches of maths do three jobs.** Linear algebra runs it, calculus teaches it, probability lets it speak.',
        '**A handful of nouns recur everywhere.** Parameters, tensors, matrices. Learn them once and the architecture stops looking like jargon.',
        '**The architecture is where they meet.** The transformer is how those objects are wired so that text goes in and a prediction comes out.',
      ],
      flow: {
        caption: 'How the three regions relate.',
        steps: [
          { id: 'f', label: 'Foundations', kind: 'input', sub: 'the maths: run, learn, speak' },
          { id: 'o', label: 'Core Objects', kind: 'store', sub: 'the nouns everything is built from' },
          { id: 't', label: 'The Transformer', kind: 'stage', sub: 'where they are wired together' },
        ],
        note: 'Foundations and Objects are reference. The Transformer is the path. Start there and come back here when a word is unfamiliar.',
      },
    },
    L2_snags: [
      {
        q: 'Do I need the maths before the architecture?',
        a: 'No, and it is usually the wrong order. Meet the dot product inside an attention score, where it has a job. Learning it in the abstract first is how people give up before reaching anything interesting.',
      },
      {
        q: 'Is the architecture the same across all these models?',
        a: 'Remarkably, yes. GPT-2 and modern models differ in size, normalisation choice, position encoding and activation, but a diagram of one is a diagram of the other. The scale changed far more than the design.',
      },
    ],
    L3_atScale: [
      { label: 'Distinct architectures', here: '1', llama: '1', note: 'Decoder-only transformers, essentially throughout.' },
    ],
    L4_underHood: `The architecture has been close to stable since 2018. The visible progress since then came from scale, data quality and post-training, not from a fundamentally different design. That is unusual in machine learning and worth noticing.`,
  },

  /* ---------------- Foundations ---------------- */

  {
    ...outline({
      id: 'foundations',
      title: 'Foundations',
      tag: 'the maths',
      color: 'blue',
      order: 0,
      track: 'model',
      parent: 'model',
      L0_oneLiner: 'Three branches of maths, doing three jobs: run, learn, speak.',
      L0_analogy: 'Grammar, feedback, and a way of hedging. Every language needs all three.',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Linear algebra runs it.** Every forward pass is matrix multiplies. This is what happens when you send a prompt.',
        '**Calculus teaches it.** Gradients say which way each weight should move. This happened once, during training, and never happens again.',
        '**Probability lets it speak.** The output is a distribution over every token, not a single answer.',
      ],
      flow: {
        caption: 'Which branch is active when.',
        steps: [
          { id: 'la', label: 'Linear algebra', kind: 'stage', sub: 'every request, forever' },
          { id: 'ca', label: 'Calculus', kind: 'stage', sub: 'training only, never at serving time' },
          { id: 'pr', label: 'Probability', kind: 'output', sub: 'the last step of every pass' },
        ],
        note: 'Calculus is absent from serving entirely. A deployed model does no learning.',
      },
    },
    L2_snags: [
      {
        q: 'How much maths do I actually need?',
        a: 'To understand what happens: what a vector is, that a matrix multiply combines numbers, that a gradient is a slope, and that softmax turns scores into percentages. To build one: considerably more. To use one well: less than you would think.',
      },
      {
        q: 'Is calculus involved when I send a prompt?',
        a: 'No. Serving is pure linear algebra plus a softmax. Gradients belong to training only. The weights are frozen the moment the model ships.',
      },
    ],
    L3_atScale: [
      { label: 'Operations per token', here: 'thousands', llama: 'billions of multiply-adds' },
    ],
    L4_underHood: `A useful check on where the cost goes: a forward pass costs roughly \`2 × parameters\` floating-point operations per token. An 8B model is about 16 billion operations to produce one word-piece, which is why this needs a GPU and why memory bandwidth, not arithmetic, ends up being the limit.`,
  },

  {
    ...outline({
      id: 'linalg',
      title: 'Linear Algebra',
      tag: 'how it RUNS',
      color: 'blue',
      order: 0,
      track: 'model',
      parent: 'foundations',
      L0_oneLiner:
        'Numbers in grids, multiplied together. A token becomes a vector; a layer\'s knowledge is a matrix; running the model is one multiply after another.',
      L0_analogy: 'Spreadsheet arithmetic, at a scale where the spreadsheet has billions of cells.',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Data is vectors.** A token, a position, an intermediate state, all lists of numbers.',
        '**Knowledge is matrices.** Every learned weight sits in a grid, and there is nowhere else for knowledge to be.',
        '**Computation is multiplication.** Vector times matrix gives a new vector. Repeat a few thousand times and that is the model.',
        '**GPUs exist for this one operation.** They are not general-purpose fast. They are specifically good at multiplying large grids of numbers in parallel.',
      ],
      flow: {
        caption: 'The one operation, repeated.',
        steps: [
          { id: 'v', label: 'Vector', kind: 'input', sub: 'the data flowing' },
          { id: 'm', label: 'Matrix', kind: 'store', sub: 'the learned weights' },
          { id: 'mm', label: 'Multiply', kind: 'stage', sub: 'combine them' },
          { id: 'v2', label: 'New vector', kind: 'output', sub: 'feeds the next multiply' },
        ],
        loop: 'The output becomes the input of the next layer. That is the entire forward pass.',
      },
    },
    L2_snags: [
      {
        q: 'Why is this what GPUs are for?',
        a: 'Because every output number in a matrix multiply is independent of the others. Thousands can be computed simultaneously. A CPU has a handful of fast cores; a GPU has thousands of slower ones, which is exactly the right shape for this.',
      },
      {
        q: 'Is there anything in a model that is not linear algebra?',
        a: 'Very little: the activation curves, softmax, and normalisation. Those small nonlinear pieces are load-bearing, without them the whole stack collapses to one matrix, but the overwhelming majority of the arithmetic is multiplication of grids.',
      },
    ],
    L3_atScale: [
      { label: 'Multiplies per token', here: 'thousands', llama: '~16 billion' },
    ],
    L4_underHood: `Everything reduces to \`C = A @ B\`. Attention is four of them plus a softmax; the feed-forward is two plus a curve; unembedding is one. The interesting engineering is not the operation but keeping the operands close to the arithmetic units, which is why "memory-bound" describes almost every serving workload.`,
  },

  {
    ...outline({
      id: 'vector',
      title: 'Vector',
      tag: 'foundation',
      color: 'blue',
      order: 0,
      track: 'model',
      parent: 'linalg',
      L0_oneLiner: 'An ordered list of numbers. One token\'s meaning is a vector.',
      L0_analogy: 'A colour is 3 numbers (R, G, B). A token is 48 of them here, 4,096 in a real model.',
      leadsTo: ['embedding'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Order matters and position is meaningful.** Dimension 7 means the same kind of thing for every token. That consistency is what makes comparison possible.',
        '**No single number means anything alone.** Meaning is the whole list, which is why you cannot read a vector the way you read a word.',
        '**Direction carries the meaning, not size.** Similar tokens point similar ways; that is what the dot product measures.',
        '**Nothing is human-labelled.** No dimension was assigned to "plural" or "animal". Whatever lowered the loss is what they became.',
      ],
      example: {
        caption: 'A real vector from the toy model.',
        compute: (input) => {
          const r = embed(input);
          const t = r.tokens[0];
          return {
            caption: `The first token's three vectors. What it is, where it sits, and the two added.`,
            totalDims: C_DIM,
            unit: 'dimensions',
            footnote: `A vector this model uses is ${C_DIM} numbers. Llama-3 uses 4,096.`,
            groups: t
              ? [
                  {
                    id: 'v',
                    label: `${t.letter} @ seat ${t.seat}`,
                    sublabel: 'three vectors, all the same width',
                    rows: [
                      {
                        label: 'token vector',
                        role: 'token' as const,
                        values: t.tokenVec,
                        sourceOf: (d) => `Dimension ${d} of what "${t.letter}" means. Nobody chose what this dimension represents.`,
                      },
                      {
                        label: 'position vector',
                        role: 'position' as const,
                        values: t.posVec,
                        sourceOf: (d) => `Dimension ${d} of "seat ${t.seat}". Same dimension index, different kind of information.`,
                      },
                      {
                        label: 'sum',
                        role: 'input' as const,
                        values: t.inputVec,
                        sourceOf: (d) => `${t.tokenVec[d]} + ${t.posVec[d]} = ${t.inputVec[d]}. Adding works because both live in the same space.`,
                      },
                    ],
                  },
                ]
              : [],
          };
        },
      },
    },
    L2_snags: [
      {
        q: 'What does one dimension mean?',
        a: 'Usually nothing you can name. Meaning is spread across many dimensions at once, and a single dimension typically participates in several unrelated concepts. Interpretability research is largely the effort to find directions that *do* correspond to something nameable.',
      },
      {
        q: 'Why can two vectors be added?',
        a: 'Because they live in the same space with the same dimension count and the same learned conventions. That is why a token vector and a position vector can be summed, and why you could not meaningfully add a vector from a different model.',
      },
      {
        q: 'Is a bigger vector always better?',
        a: 'More capacity, more cost, and diminishing returns. Every extra dimension multiplies through every matrix in the model, so width is one of the most expensive knobs there is.',
      },
    ],
    L3_atScale: [
      { label: 'Width', here: String(C_DIM), gpt2: '768', llama: '4,096' },
      { label: 'Bytes per vector at fp16', here: '96', gpt2: '1,536', llama: '8,192' },
    ],
    L4_underHood: `A vector here is a 1-D tensor of shape \`[C]\`. In practice you rarely see one alone. The model works on \`[batch, tokens, C]\`, and almost every performance question is about how that array is laid out in memory relative to the arithmetic units.`,
  },

  {
    ...outline({
      id: 'matrix',
      title: 'Matrix',
      tag: 'foundation',
      color: 'blue',
      order: 1,
      track: 'model',
      parent: 'linalg',
      L0_oneLiner: 'A grid of numbers, one block of learned weights. A layer stores what it knows as matrices.',
      L0_analogy: 'A lookup table where every entry was learned rather than written.',
      related: ['parameter'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Rows and columns, both meaningful.** In a projection matrix, each column defines one output dimension. The pattern that dimension responds to.',
        '**This is where knowledge physically lives.** "A 70B model" means 70 billion numbers, nearly all of them inside matrices like these.',
        '**A matrix is a transformation.** Multiplying by it moves a vector from one space into another, from meaning-space into query-space, for instance.',
        '**Shape determines what can connect to what.** A [48, 24] matrix consumes 48 numbers and produces 24, and that constraint is what makes the architecture fit together.',
      ],
      flow: {
        caption: 'What a projection matrix does to a vector.',
        steps: [
          { id: 'in', label: 'Vector in', kind: 'input', sub: '48 numbers' },
          { id: 'w', label: 'Matrix [48 × 24]', kind: 'store', sub: 'each column is one detector' },
          { id: 'out', label: 'Vector out', kind: 'output', sub: '24 numbers, a different space' },
        ],
      },
    },
    L2_snags: [
      {
        q: 'Is the embedding table a matrix?',
        a: 'Yes, [vocabulary, width]. What differs is how it is used: you index a row rather than multiplying through it. Mathematically indexing is equivalent to multiplying by a one-hot vector, which is why it is sometimes drawn as a multiply.',
      },
      {
        q: 'Why do people talk about rows for some matrices and columns for others?',
        a: 'It depends which side you multiply from, and conventions differ between papers and frameworks. Always check the shape rather than the prose. \`[in, out]\` and \`[out, in]\` are both common and confusing them is the most frequent bug in hand-written model code.',
      },
    ],
    L3_atScale: [
      { label: 'Largest matrix', here: `${VOCAB.length} × ${C_DIM}`, gpt2: '768 × 50,257', llama: '4,096 × 128,256' },
      { label: 'Matrices per block', here: '~6', llama: '~7' },
    ],
    L4_underHood: `\`\`\`python
W.shape          # (48, 24), consumes 48, produces 24
(x @ W).shape    # (24,)
\`\`\`

Shape mismatches are the most common error when writing model code by hand, and reading the shapes rather than the variable names is almost always the fastest way to find the bug.`,
  },

  {
    ...outline({
      id: 'matmul',
      title: 'Matrix × Vector',
      tag: 'foundation',
      color: 'blue',
      order: 2,
      track: 'model',
      parent: 'linalg',
      L0_oneLiner:
        'Multiply a vector by a matrix and get a new vector. This one operation, repeated billions of times, IS what the model does at runtime.',
      L0_analogy: 'Every output is a scorecard: how much does this input match each of my learned patterns?',
      prereqs: ['vector', 'matrix'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Each output number is one dot product.** The input vector against one column of the matrix.',
        '**So the outputs are independent of each other.** Nothing in output 3 depends on output 4, which is precisely why this parallelises across thousands of GPU cores.',
        '**Shapes must line up.** [48] times [48, 24] gives [24]. The shared 48 is what gets summed over and disappears.',
        '**Almost all of the model\'s time is here.** Attention, feed-forward, unembedding. All of it is this operation with different operands.',
      ],
      flow: {
        caption: 'One output number at a time.',
        steps: [
          { id: 'x', label: 'Input vector', kind: 'input', sub: '48 numbers' },
          { id: 'col', label: 'One column', kind: 'store', sub: 'also 48 numbers' },
          { id: 'dot', label: 'Dot product', kind: 'stage', sub: 'multiply pairwise, sum' },
          { id: 'o', label: 'One output number', kind: 'output' },
        ],
        loop: 'Repeat for every column, and every repetition is independent, which is what makes it fast.',
      },
    },
    L2_snags: [
      {
        q: 'Why is this fast on a GPU but slow on a CPU?',
        a: 'Because the outputs are independent. A CPU computes a few at a time very quickly; a GPU computes thousands at once more slowly each. For this shape of work the GPU wins by a wide margin.',
      },
      {
        q: 'What does "memory-bound" mean here?',
        a: 'That the arithmetic is not the limit, feeding it is. During generation, every weight must be read from memory to produce one token, and the multiply units finish before the next numbers arrive. Batching helps because the same weights serve many sequences per read.',
      },
    ],
    L3_atScale: [
      { label: 'Multiplies per token', here: 'thousands', llama: '~16 billion' },
      { label: 'What limits it', here: ', ', llama: 'memory bandwidth during generation' },
    ],
    L4_underHood: `\`\`\`python
out[j] = sum(x[i] * W[i][j] for i in range(len(x)))
\`\`\`

Nobody writes that loop. CuBLAS and friends implement it in tiled, cache-aware kernels. But that expression is the definition, and it makes clear why each \`out[j]\` can be computed independently.`,
  },

  {
    ...outline({
      id: 'dot-product',
      title: 'Dot Product',
      tag: 'foundation',
      color: 'blue',
      order: 3,
      track: 'model',
      parent: 'linalg',
      L0_oneLiner:
        'Multiply two vectors element by element and sum. One number meaning "how aligned are these?". The literal heart of an attention score.',
      L0_analogy: 'Comparing two lists of preferences and getting one number for how much you agree.',
      prereqs: ['vector'],
      leadsTo: ['attention-scores'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Pairwise multiply, then add it all up.** Two lists in, one number out.',
        '**Large and positive means aligned.** Near zero means unrelated. Negative means pointing opposite ways.',
        '**It is a similarity measure.** Which is exactly what attention needs. How well does this query match this key?',
        '**It grows with dimension count.** Summing over more terms gives bigger numbers, which is why attention divides by √(head width).',
      ],
      example: {
        caption: 'A real dot product from the attention computation.',
        compute: (input) => {
          const r = attention(input);
          const h = r.heads[0];
          const labels = r.embedding.tokens.map((t) => `${t.letter}@${t.seat}`);
          const q = h?.Q[0] ?? [];
          return {
            caption: `Token ${labels[0] ?? '?'}'s query, dotted against each key it may see.`,
            totalDims: q.length,
            unit: 'dimensions',
            footnote: labels[0]
              ? `Summing all ${q.length} products gives ${round2(dot(q, h?.K[0] ?? []))}. The raw match score for ${labels[0]} against itself.`
              : 'Type some letters into Run above.',
            groups: q.length
              ? [
                  {
                    id: 'd',
                    label: `${labels[0]} · ${labels[0]}`,
                    sublabel: 'the two vectors, and their products',
                    rows: [
                      {
                        label: 'query',
                        role: 'token' as const,
                        values: q,
                        sourceOf: (d) => `Dimension ${d} of the query.`,
                      },
                      {
                        label: 'key',
                        role: 'position' as const,
                        values: h?.K[0] ?? [],
                        sourceOf: (d) => `Dimension ${d} of the key.`,
                      },
                      {
                        label: 'product',
                        role: 'input' as const,
                        values: q.map((v, d) => round2(v * (h?.K[0]?.[d] ?? 0))),
                        sourceOf: (d) =>
                          `${q[d]} × ${h?.K[0]?.[d]} = ${round2((q[d] ?? 0) * (h?.K[0]?.[d] ?? 0))}. The dot product is every one of these added together.`,
                      },
                    ],
                  },
                ]
              : [],
          };
        },
      },
    },
    L2_snags: [
      {
        q: 'Why does this measure similarity?',
        a: 'Because matching signs multiply to positive and opposing signs to negative. Two vectors that agree dimension by dimension accumulate a large positive sum; two that disagree cancel toward zero.',
      },
      {
        q: 'Is it the same as cosine similarity?',
        a: 'Closely related. Cosine is the dot product divided by both lengths, so it measures angle only. Attention uses the raw dot product, so vector *magnitude* affects the score too, which the model can and does use.',
      },
      {
        q: 'Why does it need scaling in attention?',
        a: 'Because summing over more dimensions produces larger numbers. Over 128 dimensions the scores get large enough that softmax saturates into a near-hard maximum, and learning stalls. Dividing by √d keeps the spread stable.',
      },
    ],
    L3_atScale: [
      { label: 'Terms per dot product', here: '24', gpt2: '64', llama: '128' },
      { label: 'Dot products per layer', here: '72', llama: 'billions at long context' },
    ],
    L4_underHood: `\`\`\`python
dot(a, b) = sum(a[i] * b[i] for i in range(len(a)))
\`\`\`

Every matrix multiply is a grid of these. Recognising it in both places, one output cell of a projection, one attention score. Is most of what makes the architecture legible.`,
  },

  {
    ...outline({
      id: 'calculus',
      title: 'Calculus / Gradients',
      tag: 'how it LEARNS',
      color: 'aqua',
      order: 1,
      track: 'model',
      parent: 'foundations',
      L0_oneLiner:
        'A gradient is a slope answering one question: nudge this weight which way to be less wrong?',
      L0_analogy: 'Feeling which way the ground slopes downhill, in the dark, with billions of feet at once.',
      related: ['pretraining'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Training happens once and then stops.** None of this runs when you send a prompt.',
        '**Loss measures wrongness as one number.** Everything else is finding out how each weight contributed to it.',
        '**A gradient is one number per weight.** Which direction, and how strongly, that weight pushed the loss up.',
        '**Then take a small step downhill and repeat.** Hundreds of thousands of times.',
      ],
      flow: {
        caption: 'The training loop. Absent entirely at serving time.',
        steps: [
          { id: 'f', label: 'Forward', kind: 'stage', sub: 'predict' },
          { id: 'l', label: 'Loss', kind: 'control', sub: 'how wrong, as one number' },
          { id: 'b', label: 'Backward', kind: 'stage', sub: 'a gradient per weight' },
          { id: 'u', label: 'Step', kind: 'output', sub: 'move each weight a little' },
        ],
        loop: 'Repeat with the next batch until the budget runs out.',
      },
    },
    L2_snags: [
      {
        q: 'Does the model learn from my conversation?',
        a: 'No. Weights are frozen at serving time. Your conversation may later be curated into a training set by people, but nothing updates while you talk.',
      },
      {
        q: 'Why "downhill"?',
        a: 'Because loss is a height and you want it low. The gradient points uphill, so you step the other way, which is why it is called gradient *descent*.',
      },
    ],
    L3_atScale: [
      { label: 'Gradients per step', here: '<1,000', llama: '8 billion' },
      { label: 'Steps in a run', here: '0', llama: 'hundreds of thousands' },
    ],
    L4_underHood: `Reverse-mode automatic differentiation is what makes this affordable. Computing the gradient of one loss with respect to *all* parameters costs roughly the same as one forward pass, not one pass per parameter. Without that property, training a billion-parameter model would be arithmetically impossible.`,
  },

  {
    ...outline({
      id: 'derivative',
      title: 'Derivative (slope)',
      tag: 'foundation',
      color: 'aqua',
      order: 0,
      track: 'model',
      parent: 'calculus',
      L0_oneLiner: 'How much the error changes if you wiggle one weight. A steep slope means a big correction.',
      L0_analogy: 'How much the shower temperature changes per degree of tap movement.',
      leadsTo: ['backprop'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One weight at a time, conceptually.** If I increase this by a tiny amount, does the loss go up or down, and by how much?',
        '**Sign says direction, size says urgency.** Positive means increasing it makes things worse.',
        '**Near-zero slope means this weight barely matters** for this example, it will hardly move.',
        '**Nobody computes these one at a time.** Backprop gets all of them in a single backward pass.',
      ],
      flow: {
        caption: 'What a derivative answers, for one weight.',
        steps: [
          { id: 'w', label: 'One weight', kind: 'input', sub: 'currently 0.42, say' },
          { id: 'n', label: 'Nudge it', kind: 'stage', sub: 'by a tiny amount' },
          { id: 'l', label: 'Loss moves', kind: 'control', sub: 'up or down, by how much' },
          { id: 's', label: 'The slope', kind: 'output', sub: 'sign = direction, size = urgency' },
        ],
        note: 'Conceptually one weight at a time. Mechanically, backprop produces all of them together.',
      },
    },
    L2_snags: [
      {
        q: 'Could you not just try changing each weight and see?',
        a: 'That is finite differences, and it needs one forward pass per weight. For 8 billion weights that is 8 billion passes per step. Backprop gets the same answer in roughly one pass, which is the only reason any of this is possible.',
      },
      {
        q: 'What if the slope is zero?',
        a: 'Then that weight gets no update from that example. Persistent zero gradients are a real failure mode. It is what "dead ReLU" means, and part of why smoother activation curves are now preferred.',
      },
    ],
    L3_atScale: [{ label: 'Derivatives per step', here: '<1,000', llama: '8 billion' }],
    L4_underHood: `\`\`\`
∂L/∂w  ≈  (L(w + ε) − L(w)) / ε
\`\`\`

That definition is how you *check* a gradient implementation, never how you compute one. Frameworks apply the chain rule symbolically instead, and gradient-checking against this formula on a tiny model is the standard way to catch a bug in a hand-written backward pass.`,
  },

  {
    ...outline({
      id: 'backprop',
      title: 'Chain Rule → Backprop',
      tag: 'foundation',
      color: 'aqua',
      order: 1,
      track: 'model',
      parent: 'calculus',
      L0_oneLiner:
        'Multiply slopes backwards through the layers. Doing that for every weight at once IS backpropagation.',
      L0_analogy: 'Tracing blame backwards through a chain of handovers, splitting it at every junction.',
      prereqs: ['derivative'],
      leadsTo: ['gradient-descent'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The chain rule composes slopes.** If a affects b and b affects c, then a\'s effect on c is the product of the two.',
        '**So start at the loss and walk backwards.** Each layer receives the gradient of the loss with respect to its output and produces the gradient with respect to its input and its weights.',
        '**Every layer is a local calculation.** No layer needs to know anything about the rest of the network, only what arrives from the layer above.',
        '**Which is why the forward pass must be kept.** Computing a layer\'s gradients needs the activations it produced, so they are held in memory until the backward pass reaches them.',
      ],
      flow: {
        caption: 'Gradients flowing the other way.',
        steps: [
          { id: 'l', label: 'Loss', kind: 'input', sub: 'the starting gradient is 1' },
          { id: 'b3', label: 'Last layer', kind: 'stage', sub: 'weight grads + pass one back' },
          { id: 'b2', label: 'Middle layers', kind: 'stage', sub: 'same operation, repeated' },
          { id: 'b1', label: 'First layer', kind: 'output', sub: 'every weight now has a gradient' },
        ],
        note: 'Stored activations from the forward pass are consumed here, which is why training memory is dominated by them at long sequence lengths.',
      },
    },
    L2_snags: [
      {
        q: 'Why do gradients vanish in deep networks?',
        a: 'Because they are products. Multiply thirty numbers each smaller than one and you get something near zero, so the earliest layers receive almost no signal. Residual connections exist largely to give the gradient a path that avoids that product.',
      },
      {
        q: 'Why does training need so much more memory than inference?',
        a: 'Because every intermediate activation from the forward pass must be kept until the backward pass uses it. Inference can discard each layer\'s output as soon as the next layer consumes it; training cannot.',
      },
    ],
    L3_atScale: [
      { label: 'Cost vs forward pass', here: '~2×', llama: '~2×' },
      { label: 'Activation memory', here: 'trivial', llama: 'often larger than the weights' },
    ],
    L4_underHood: `Gradient checkpointing is the standard trade when activation memory runs out: keep only some layers' activations and recompute the rest during the backward pass. Roughly 30% more compute for a large reduction in memory, almost always worth it at scale.`,
  },

  {
    ...outline({
      id: 'gradient-descent',
      title: 'Gradient Descent',
      tag: 'foundation',
      color: 'aqua',
      order: 2,
      track: 'model',
      parent: 'calculus',
      L0_oneLiner:
        'Step downhill, repeat. The optimiser. SGD, then Adam, then AdamW, decides how big each step is.',
      L0_analogy: 'Walking downhill in fog: you cannot see the valley, only which way your feet slope.',
      prereqs: ['backprop'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Subtract the gradient, scaled by a learning rate.** That is plain SGD, and it works.',
        '**Momentum smooths the path.** Keep a running average of recent gradients so consistent directions accelerate and noisy ones cancel.',
        '**Adam adapts per weight.** Weights with consistently small gradients take larger steps, and vice versa, so one global learning rate suits every weight.',
        '**AdamW fixes weight decay.** It applies decay separately from the adaptive step, which turned out to matter and is now the default.',
      ],
      flow: {
        caption: 'What the optimiser holds per weight.',
        steps: [
          { id: 'g', label: 'Gradient', kind: 'input', sub: 'from backprop' },
          {
            id: 'st',
            label: 'Optimiser state',
            kind: 'store',
            sub: 'two extra numbers per weight',
            parts: [
              { id: 'm1', label: 'Momentum', sub: 'average of recent gradients', kind: 'store' },
              { id: 'm2', label: 'Variance', sub: 'average of recent squares', kind: 'store' },
            ],
          },
          { id: 'step', label: 'Scaled step', kind: 'output', sub: 'per-weight size' },
        ],
        note: 'Those two extra numbers per weight are why training memory is roughly triple the weights before activations.',
      },
    },
    L2_snags: [
      {
        q: 'Why not just use a big learning rate and finish faster?',
        a: 'Too large a step overshoots and the loss diverges rather than falling. Too small and it takes forever. Real runs warm up from near zero and then decay, which is a schedule rather than a single value.',
      },
      {
        q: 'Does it find the best possible weights?',
        a: 'No, and it does not try to. It finds a good local region. At this scale that turns out to be fine. The landscape has enormous numbers of roughly equivalent good solutions, and which one you land in matters less than that you land in one.',
      },
    ],
    L3_atScale: [
      { label: 'Optimiser memory', here: ', ', llama: '2 extra numbers per weight' },
      { label: 'Learning rate', here: ', ', llama: 'warmup then decay, ~1e-4 peak' },
    ],
    L4_underHood: `\`\`\`python
m = β1*m + (1-β1)*g            # momentum
v = β2*v + (1-β2)*g**2         # variance
w -= lr * m / (sqrt(v) + eps)  # adaptive step
w -= lr * wd * w               # decoupled decay, the "W" in AdamW
\`\`\`

The last line being separate from the adaptive step is the whole of AdamW. Folding decay into the gradient, as the original Adam did, makes it interact with the per-weight scaling in a way nobody intended.`,
  },

  {
    ...outline({
      id: 'probability',
      title: 'Probability',
      tag: 'how it SPEAKS',
      color: 'yellow',
      order: 2,
      track: 'model',
      parent: 'foundations',
      L0_oneLiner:
        'The output is not one word. It is a probability for every word in the vocabulary. That is why the same prompt can answer differently.',
      L0_analogy: 'A weather forecast rather than a prediction. 70% rain, not "it will rain".',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Every pass produces a full distribution.** One number per vocabulary slot, all summing to 1.',
        '**Then one is chosen.** That choice is sampling, and it is where randomness enters, not from the model, which is deterministic.',
        '**Which is why the same prompt varies.** Same distribution, different draw. Choose the top token every time and it is reproducible.',
        '**The distribution carries more than the answer.** Its spread is a rough signal of how sure the model is.',
      ],
      flow: {
        caption: 'From raw scores to a chosen word.',
        steps: [
          { id: 'l', label: 'Logits', kind: 'input', sub: 'raw, unnormalised' },
          { id: 's', label: 'Softmax', kind: 'stage', sub: 'to probabilities summing to 1' },
          { id: 'p', label: 'Sample', kind: 'control', sub: 'temperature, top-p' },
          { id: 't', label: 'One token', kind: 'output' },
        ],
      },
    },
    L2_snags: [
      {
        q: 'Is the model itself random?',
        a: 'No. Given identical input it produces an identical distribution every time. The randomness is entirely in the sampling step afterwards, which is why setting temperature to zero makes it reproducible.',
      },
      {
        q: 'Does a high probability mean it is right?',
        a: 'It means the model is confident, which is not the same thing. Confidence is calibrated on how text usually continues, not on truth. Confident and wrong is a normal, expected output.',
      },
    ],
    L3_atScale: [
      { label: 'Numbers per prediction', here: '3', gpt2: '50,257', llama: '128,256' },
    ],
    L4_underHood: `The entropy of the distribution is a cheap and useful signal: low entropy means the model sees essentially one continuation, high entropy means many are plausible. Some systems use it to decide when to fall back to retrieval or ask a clarifying question, though it measures the model's certainty rather than its correctness.`,
  },

  {
    ...outline({
      id: 'logits',
      title: 'Logits',
      tag: 'foundation',
      color: 'yellow',
      order: 0,
      track: 'model',
      parent: 'probability',
      L0_oneLiner: 'Raw, unnormalised scores, one per possible token. Straight out of the final matrix multiply.',
      L0_analogy: 'Judges\' raw marks before anyone converts them to percentages.',
      leadsTo: ['softmax'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One number per vocabulary slot.** For Llama-3 that is 128,256 numbers for every single token generated.',
        '**They can be negative, and they do not sum to anything.** Only their relative sizes carry meaning.',
        '**Differences matter, absolute values do not.** Add 5 to every logit and the resulting probabilities are identical.',
        '**This is where sampling controls act.** Temperature and top-p operate on logits, before softmax turns them into probabilities.',
      ],
      flow: {
        caption: 'Where logits sit in the readout.',
        steps: [
          { id: 'v', label: 'Final vector', kind: 'input', sub: 'one token, 48 wide' },
          { id: 'u', label: 'Unembed', kind: 'stage', sub: '× the vocabulary matrix' },
          { id: 'l', label: 'Logits', kind: 'store', sub: 'one raw score per slot' },
          { id: 's', label: 'To softmax', kind: 'output', sub: 'after temperature is applied' },
        ],
        note: 'Adding a constant to every logit changes nothing downstream, only the gaps between them carry meaning.',
      },
    },
    L2_snags: [
      {
        q: 'Why not have the model output probabilities directly?',
        a: 'Because unconstrained numbers are far easier to optimise. Forcing every output to be positive and to sum to 1 inside the network would constrain training badly. Softmax at the end is the cheap way to get the constraint without paying for it throughout.',
      },
      {
        q: 'What does a negative logit mean?',
        a: 'Just "less likely than a zero one". Since only differences matter, the sign carries no independent meaning. Softmax maps any real number to a positive probability.',
      },
      {
        q: 'Can I see them when using a hosted model?',
        a: 'Sometimes, and usually only the top few. APIs commonly expose log-probabilities for a handful of candidate tokens rather than the full 128,256. That is enough for confidence estimates and classification tricks, and not enough to reconstruct the distribution.',
      },
    ],
    L3_atScale: [{ label: 'Logits per token', here: '3', gpt2: '50,257', llama: '128,256' }],
    L4_underHood: `Because softmax is shift-invariant, every implementation subtracts the row maximum before exponentiating. It changes nothing mathematically and prevents overflow. A logit of 800 would otherwise produce infinity and poison the whole row.`,
  },

  {
    ...outline({
      id: 'softmax',
      title: 'Softmax',
      tag: 'foundation',
      color: 'yellow',
      order: 1,
      track: 'model',
      parent: 'probability',
      L0_oneLiner:
        'Squashes scores into probabilities that sum to 1. Also the exact step that turns attention scores into weights.',
      L0_analogy: 'Converting raw marks into percentages that must add up to 100.',
      prereqs: ['logits'],
      leadsTo: ['sampling'],
      related: ['attention-weights'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Exponentiate, then divide by the total.** Two steps, and that is all of it.',
        '**Exponentiating exaggerates differences.** A slightly higher score becomes a substantially higher probability.',
        '**It appears twice in the model.** Once inside every attention head, once at the very end. Same function, different job.',
        '**Temperature is a divisor applied first.** Dividing logits by a number greater than 1 flattens the distribution; less than 1 sharpens it.',
      ],
      flow: {
        caption: 'The same function, in both places it is used.',
        steps: [
          { id: 'in', label: 'Any real numbers', kind: 'input', sub: 'attention scores or logits' },
          { id: 'e', label: 'e ^ each', kind: 'stage', sub: 'all now positive' },
          { id: 'n', label: '÷ total', kind: 'stage', sub: 'now sums to 1' },
          { id: 'out', label: 'A distribution', kind: 'output' },
        ],
      },
    },
    L2_snags: [
      {
        q: 'Why is it called "soft" max?',
        a: 'Because it is a smooth version of picking the maximum. A hard max outputs 1 for the winner and 0 for everything else and has no useful gradient. Softmax approaches that as scores spread apart, while staying differentiable.',
      },
      {
        q: 'Can it output exactly zero?',
        a: 'Only for an input of minus infinity, which is exactly what attention masking uses. For any finite score the output is strictly positive, however small.',
      },
      {
        q: 'What does temperature actually do?',
        a: 'Divides the logits before exponentiating. Above 1 flattens the distribution and makes unlikely tokens more reachable; below 1 sharpens it; at 0 it becomes always-pick-the-top, which is deterministic.',
      },
    ],
    L3_atScale: [
      { label: 'Applied per token', here: '~13', llama: 'once per head per layer, plus once at the end' },
    ],
    L4_underHood: `\`\`\`python
def softmax(z):
    z = z - z.max()          # shift-invariant; prevents overflow
    e = exp(z)
    return e / e.sum()
\`\`\`

Its derivative is unusually clean, which is a large part of why it became standard: paired with cross-entropy loss the gradient simplifies to \`predicted − actual\`, one subtraction.`,
  },

  {
    ...outline({
      id: 'sampling',
      title: 'Sampling',
      tag: 'foundation',
      color: 'yellow',
      order: 2,
      track: 'model',
      parent: 'probability',
      L0_oneLiner:
        'Pick one token from the distribution. Temperature and top-p control how adventurous the pick is.',
      L0_analogy: 'A weighted raffle. Everyone has a ticket; some have far more than others.',
      prereqs: ['softmax'],
      leadsTo: ['the-loop'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Always picking the most likely token reads badly.** It produces repetitive, flat text and gets stuck in loops.',
        '**So draw randomly, weighted by probability.** More interesting, and occasionally wrong in a way greedy decoding is not.',
        '**Temperature reshapes before drawing.** Higher is more adventurous, lower more predictable, zero is deterministic.',
        '**Top-p truncates the tail.** Keep only the most likely tokens that together make up p of the probability, and renormalise, so genuinely bad options cannot be drawn at all.',
      ],
      flow: {
        caption: 'The knobs, in the order they apply.',
        steps: [
          { id: 'l', label: 'Logits', kind: 'input' },
          { id: 't', label: '÷ temperature', kind: 'control', sub: 'flatten or sharpen' },
          { id: 's', label: 'Softmax', kind: 'stage' },
          { id: 'p', label: 'Top-p truncate', kind: 'control', sub: 'drop the tail, renormalise' },
          { id: 'd', label: 'Draw one', kind: 'output' },
        ],
      },
    },
    L2_snags: [
      {
        q: 'Why is temperature 0 deterministic?',
        a: 'Dividing by a number approaching zero drives the largest logit\'s share toward 1 and everything else toward 0. In practice implementations special-case it to "pick the argmax", which is the same thing without dividing by zero.',
      },
      {
        q: 'Should I use temperature or top-p?',
        a: 'They do different things and are often combined. Temperature reshapes the whole distribution; top-p removes the tail regardless of shape. Top-p is the better safety net, because a high temperature can otherwise make a genuinely terrible token reachable.',
      },
      {
        q: 'Is greedy decoding better for factual tasks?',
        a: 'Usually, yes. Less variance and fewer excursions into unlikely territory. It is also more prone to repetition loops, which is why factual pipelines often use temperature 0 plus a repetition penalty rather than temperature 0 alone.',
      },
    ],
    L3_atScale: [
      { label: 'Typical temperature', here: ', ', llama: '0 for factual, 0.7-1.0 for creative' },
      { label: 'Typical top-p', here: ', ', llama: '0.9-0.95' },
    ],
    L4_underHood: `\`\`\`python
probs = softmax(logits / temperature)
sorted_probs, idx = sort(probs, descending=True)
keep = cumsum(sorted_probs) <= top_p
token = draw(renormalise(sorted_probs[keep]), idx[keep])
\`\`\`

Order matters: temperature applies to logits *before* softmax, top-p to probabilities *after*. Swapping them gives different and usually worse behaviour.`,
  },

  /* ---------------- Core objects ---------------- */

  {
    ...outline({
      id: 'objects',
      title: 'Core Objects',
      tag: 'the nouns',
      color: 'aqua',
      order: 1,
      track: 'model',
      parent: 'model',
      L0_oneLiner:
        'The vocabulary everything else is built from. The things that flow, and the things that transform them.',
      L0_analogy: 'The parts list, before the assembly diagram.',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Two categories, and confusing them causes most of the confusion.** Weights are learned and frozen; activations are computed fresh for every request.',
        '**Weights are the model.** Ship them, load them, quantize them.',
        '**Activations are the traffic.** They exist for microseconds and are gone.',
      ],
      flow: {
        caption: 'The distinction worth holding onto.',
        steps: [
          { id: 'w', label: 'Weights', kind: 'store', sub: 'learned once · frozen · shipped' },
          { id: 'op', label: 'An operation', kind: 'stage', sub: 'combines the two' },
          { id: 'a', label: 'Activations', kind: 'output', sub: 'per request · transient' },
        ],
        note: '"Parameter" always means a weight. "Tensor" can mean either, which is why the word alone rarely tells you much.',
      },
    },
    L2_snags: [
      {
        q: 'What is the difference between a parameter and an activation?',
        a: 'A parameter was learned and does not change between requests. An activation is computed from your input and disappears when the request ends. Weights are the model; activations are what your prompt turned into.',
      },
      {
        q: 'Is a tensor a different thing from a matrix?',
        a: 'A tensor is the general case, any number of dimensions. A vector is a 1-D tensor, a matrix 2-D. Model code uses 3-D and 4-D tensors constantly, which is why the general word is the common one.',
      },
    ],
    L3_atScale: [
      { label: 'Weights', here: '<1,000', llama: '8 billion, fixed' },
      { label: 'Activations', here: 'a few hundred', llama: 'depends on prompt length' },
    ],
    L4_underHood: `In PyTorch the distinction is literal: parameters are registered on the module and appear in \`model.parameters()\`; activations are ordinary tensors produced during \`forward\` and freed by the garbage collector. Optimisers only ever touch the first list.`,
  },

  {
    ...outline({
      id: 'parameter',
      title: 'Parameter / Weight',
      tag: 'object',
      color: 'aqua',
      order: 0,
      track: 'model',
      parent: 'objects',
      L0_oneLiner: 'One learned number. A "70B model" has 70 billion of these, living inside matrices.',
      L0_analogy: 'One dial among billions, all set by training rather than by hand.',
      related: ['matrix'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**It starts random and ends meaningful.** No parameter was chosen by a person.',
        '**Individually it means nothing.** Capability is a property of the whole set, not of any one number.',
        '**The count is the headline figure.** 8B, 70B, 405B. It is the primary size measure, though not a direct measure of quality.',
        '**Each one costs memory forever.** Two bytes at fp16, so 8 billion parameters is roughly 16 GB you must hold to serve at all.',
      ],
      example: {
        caption: 'Real parameters from the toy model.',
        compute: () => ({
          caption: 'Rows of the token table. Real learned-shaped weights, one row per vocabulary slot.',
          totalDims: C_DIM,
          unit: 'dimensions',
          footnote: `This table alone is ${VOCAB.length} × ${C_DIM} = ${VOCAB.length * C_DIM} parameters. Llama-3's equivalent is about 525 million.`,
          groups: VOCAB.map((letter, i) => ({
            id: `row${i}`,
            label: `token table row ${i}`,
            sublabel: `the vector for "${letter}"`,
            rows: [
              {
                label: `"${letter}"`,
                role: 'token' as const,
                values: tokenTable[i] ?? [],
                sourceOf: (d) =>
                  `One parameter: row ${i}, dimension ${d}. In a trained model this number would have been set by gradient descent over trillions of tokens.`,
              },
            ],
          })),
        }),
      },
    },
    L2_snags: [
      {
        q: 'Does more parameters mean better?',
        a: 'Broadly, at fixed data and training quality. But a well-trained 8B model routinely beats a poorly-trained 70B one, and the count says nothing about post-training, which is where much of the perceived quality comes from.',
      },
      {
        q: 'Can you look at one and tell what it does?',
        a: 'No. Meaning is distributed. Any single weight participates in many behaviours and no behaviour lives in one weight. Interpretability works on directions and circuits, not individual numbers.',
      },
      {
        q: 'Why do people quote parameters in billions rather than gigabytes?',
        a: 'Because bytes depend on precision. The same 8B model is 16 GB, 8 GB or 4 GB depending on quantization. The parameter count is the invariant.',
      },
    ],
    L3_atScale: [
      { label: 'Count', here: `${VOCAB.length * C_DIM + 11 * C_DIM}`, gpt2: '124 million', llama: '8 billion' },
      { label: 'Bytes each at fp16', here: '2', llama: '2' },
    ],
    L4_underHood: `\`\`\`python
sum(p.numel() for p in model.parameters())
\`\`\`

Worth knowing that not every stored number is a parameter in this sense. Buffers, optimiser state and caches all consume memory without being learned weights, which is why "model size" and "memory used" are rarely the same number.`,
  },

  {
    ...outline({
      id: 'tensor',
      title: 'Tensor / Activation',
      tag: 'object',
      color: 'aqua',
      order: 1,
      track: 'model',
      parent: 'objects',
      L0_oneLiner:
        'The numbers in motion. A token as a vector, a batch as a 3-D array. This is what travels through every layer.',
      L0_analogy: 'The water in the pipes, as opposed to the pipes.',
      related: ['embedding'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**An array with any number of dimensions.** 1-D is a vector, 2-D a matrix, and model code uses 3-D and 4-D routinely.',
        '**The shape is the important part.** `[batch, tokens, width]` is the shape you will see most, and reading shapes is how you follow unfamiliar model code.',
        '**Activations are created and destroyed per request.** Unlike weights, they do not persist.',
        '**They dominate training memory.** Every one has to be kept until the backward pass consumes it.',
      ],
      flow: {
        caption: 'The shape as it moves through one layer.',
        steps: [
          { id: 'a', label: '[batch, tokens, 48]', kind: 'input' },
          { id: 'b', label: 'Attention', kind: 'stage', sub: 'briefly [batch, heads, tokens, tokens]' },
          { id: 'c', label: '[batch, tokens, 48]', kind: 'output', sub: 'shape restored' },
        ],
        note: 'That temporary tokens × tokens shape is the attention grid, and the reason long context is expensive.',
      },
    },
    L2_snags: [
      {
        q: 'Why does everyone talk about shapes so much?',
        a: 'Because shape errors are the overwhelming majority of bugs in model code, and because the shape tells you what an operation is doing. Following the shapes through a forward pass is the fastest way to understand unfamiliar architecture code.',
      },
      {
        q: 'Is the KV cache a tensor?',
        a: 'Yes, a large, persistent one. It is unusual precisely because it survives between forward passes, which neither weights (frozen) nor ordinary activations (transient) do.',
      },
    ],
    L3_atScale: [
      { label: 'Common shape', here: '[1, 6, 48]', llama: '[batch, tokens, 4096]' },
      { label: 'Attention grid', here: '[2, 6, 6]', llama: '[32, T, T] per layer' },
    ],
    L4_underHood: `Shapes are also where performance lives. A tensor whose memory layout does not match how a kernel wants to read it forces a copy, and \`.contiguous()\` calls scattered through model code are usually someone having discovered exactly that.`,
  },

  {
    ...outline({
      id: 'neuron',
      title: '"Neuron"',
      tag: 'object',
      color: 'aqua',
      order: 2,
      track: 'model',
      parent: 'objects',
      L0_oneLiner:
        'A metaphor, not biology: a weight plus a nonlinearity. Picture a number in a grid, not a brain cell.',
      L0_analogy: 'The word survives from a 1950s analogy that stopped being accurate almost immediately.',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Historically it meant one unit in a layer.** A weighted sum of inputs, passed through a curve.',
        '**In a transformer the word barely applies.** People sometimes use it for one dimension of the feed-forward hidden layer, and rarely for anything else.',
        '**The biological analogy misleads.** Real neurons spike, have timing, and rewire. None of that happens here.',
        '**"Neural network" is the same story**. A historical name that stuck, not a claim about the brain.',
      ],
      flow: {
        caption: 'The historical unit the word describes.',
        steps: [
          { id: 'in', label: 'Inputs', kind: 'input', sub: 'numbers from the layer below' },
          { id: 'w', label: 'Weighted sum', kind: 'stage', sub: 'one weight per input' },
          { id: 'a', label: 'Nonlinearity', kind: 'control', sub: 'the curve' },
          { id: 'o', label: 'One output number', kind: 'output' },
        ],
        note: 'In a transformer this maps most closely onto a single dimension of the feed-forward hidden layer, and even there, it usually responds to several unrelated things at once.',
      },
    },
    L2_snags: [
      {
        q: 'Is a model like a brain?',
        a: 'Structurally, no. The vocabulary is borrowed from a decades-old analogy. Both learn from experience and store information in connection strengths, and the resemblance stops well before anything mechanistic.',
      },
      {
        q: 'Does a single "neuron" represent a concept?',
        a: 'Rarely and unreliably. Some feed-forward dimensions do respond to interpretable patterns, but most are polysemantic. Responding to several unrelated things, which is precisely what makes interpretability hard.',
      },
    ],
    L3_atScale: [
      { label: 'Feed-forward dimensions', here: '~192', llama: '14,336 per layer' },
    ],
    L4_underHood: `Sparse autoencoders are the current attempt to fix polysemanticity: train a much wider, sparse layer to reconstruct the activations, in the hope that its dimensions correspond one-to-one with human concepts where the model's own do not. Promising, and not solved.`,
  },

  {
    ...outline({
      id: 'architecture',
      title: 'Architecture',
      tag: 'object',
      color: 'aqua',
      order: 3,
      track: 'model',
      parent: 'objects',
      L0_oneLiner:
        'The wiring: which weights get multiplied by what, in what order. Weights alone are just numbers.',
      L0_analogy: 'The circuit diagram. The components are useless without it, and it is useless without them.',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Two things are needed to run a model.** The weights, and the code that says how to use them. Missing either and you have nothing.',
        '**Architecture is a few hundred lines.** Weights are gigabytes. The small part is the design.',
        '**It is chosen before training and fixed after.** Width, depth, head count. All decided up front, because the weights are shaped by them.',
        '**It has barely changed since 2018.** Scale and data moved; the diagram did not.',
      ],
      flow: {
        caption: 'What a model file actually is.',
        steps: [
          { id: 'cfg', label: 'Config', kind: 'input', sub: 'layers, width, heads, a few dozen numbers' },
          { id: 'code', label: 'Architecture code', kind: 'control', sub: 'hundreds of lines' },
          { id: 'w', label: 'Weights', kind: 'store', sub: 'gigabytes' },
          { id: 'run', label: 'A runnable model', kind: 'output' },
        ],
        note: 'Weights from one architecture will not load into another. The shapes will not match, which is why the config ships alongside them.',
      },
    },
    L2_snags: [
      {
        q: 'Can I use one model\'s weights with another\'s code?',
        a: 'Only if the architecture matches exactly. The weights are shaped by the config, so a mismatch in width, depth or head count fails immediately on load. This is why every checkpoint ships its config.',
      },
      {
        q: 'If the architecture is so stable, what has been improving?',
        a: 'Scale, data quality, post-training, and serving efficiency. The refinements to the architecture itself. RMSNorm, RoPE, SwiGLU, GQA. Are real but incremental against a design that is recognisably the 2017 transformer with the encoder removed.',
      },
    ],
    L3_atScale: [
      { label: 'Architecture code', here: ', ', llama: 'a few hundred lines' },
      { label: 'Weights', here: '<1 KB', llama: '~16 GB' },
    ],
    L4_underHood: `A checkpoint is a config plus a state dict. A mapping from parameter name to tensor. Loading is matching those names against the module tree the architecture code builds:

\`\`\`
model.layers.0.attn.q_proj.weight  →  tensor of shape [4096, 4096]
\`\`\`

Every name in that mapping must correspond to something the code constructs, which is exactly why the architecture and the weights are inseparable.`,
  },
];
