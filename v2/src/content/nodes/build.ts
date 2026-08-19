/**
 * Continent 2, THE BUILD: how it is made.
 *
 * design-spec §5 ②. Each stage answers the same three questions: what goes in,
 * what comes out, and what changed since the last stage. The flow diagrams
 * carry that; the prose explains why the stage exists at all.
 *
 * Snags here are anticipated, not harvested, the UI labels them accordingly.
 */

import { outline } from '../outline';
import { SOURCES } from '../sources';
import type { ConceptNode } from '../schema';

export const buildNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'build',
      title: 'The Build',
      tag: 'how it is made',
      color: 'yellow',
      order: 1,
      track: 'build',
      parent: 'llm',
      L0_oneLiner:
        'How a pile of random numbers becomes a model that answers. One enormous stage that learns language, then several small ones that shape behaviour.',
      L0_analogy:
        'Raising someone versus training them for a job. The first takes years and gives them the world; the second takes weeks and gives them a role.',
      prereqs: ['model'],
      leadsTo: ['operations'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One stage dominates everything.** Pretraining is 98%+ of the compute and is where the model learns language, facts and reasoning. Everything after it is comparatively tiny.',
        '**The later stages change behaviour, not knowledge.** Fine-tuning does not teach new facts so much as teach which of the things it already knows to say, and how.',
        '**Each stage has a different signal.** Pretraining learns from raw text. SFT learns from example answers. Alignment learns from *comparisons* between answers. A genuinely different kind of information.',
        '**The order is not negotiable.** You cannot align a model that cannot yet form sentences. Each stage assumes the one before it succeeded.',
      ],
      flow: {
        caption: 'Data in, a servable artifact out. Note where the compute actually goes.',
        steps: [
          { id: 'data', label: 'Gather data', kind: 'input', sub: 'trillions of tokens' },
          { id: 'tok', label: 'Train tokenizer', kind: 'stage', sub: 'fix the vocabulary' },
          {
            id: 'pre',
            label: 'Pretraining',
            kind: 'stage',
            sub: '98% of the compute · learns language itself',
          },
          {
            id: 'post',
            label: 'Post-training',
            kind: 'stage',
            sub: 'shapes behaviour · comparatively cheap',
            parts: [
              { id: 'sft', label: 'SFT', sub: 'examples of good answers', kind: 'stage' },
              { id: 'align', label: 'Alignment', sub: 'preferences between answers', kind: 'stage' },
              { id: 'lora', label: 'Adapters', sub: 'small per-task patches', kind: 'stage' },
            ],
          },
          { id: 'eval', label: 'Evaluation', kind: 'control', sub: 'the gate before anything ships' },
          { id: 'prep', label: 'Deploy prep', kind: 'output', sub: 'quantize / distil for serving' },
        ],
        loop: 'Production behaviour becomes data for the next run, that is what makes this a cycle.',
        note: 'The stages after pretraining cost a rounding error by comparison, which is why almost all visible model iteration happens there.',
      },
    },
    L2_snags: [
      {
        q: 'Does fine-tuning teach the model new facts?',
        a: 'Badly, and it is usually the wrong tool. Facts live in the pretrained weights; a few thousand fine-tuning examples mostly teach format, tone and which behaviour to select. If you need the model to know your documents, retrieval at inference time works far better than trying to write them into the weights.',
      },
      {
        q: 'Why is pretraining so much more expensive than everything else?',
        a: 'Scale of data. Pretraining reads trillions of tokens; fine-tuning reads thousands to millions. It is the same arithmetic, run something like a million times more often.',
      },
      {
        q: 'Could you skip pretraining and just train on your own data?',
        a: 'You would get a model that has seen your data and nothing else. No grammar, no world knowledge, no reasoning. Pretraining is where all of that comes from. Your data is the last 0.001% that makes a generally capable model useful for your job.',
      },
      {
        q: 'Is the model "learning" while it answers me?',
        a: 'No. The weights are frozen at serving time. Every conversation starts from the identical model. Anything that feels like memory is either the transcript being resent, or something the application deliberately stored and put back into the prompt.',
      },
    ],
    L3_atScale: [
      {
        label: 'Share of total compute',
        here: ', ',
        llama: 'pretraining ≫ 98%',
        note: 'Which is why base models ship rarely and fine-tunes ship constantly.',
      },
      {
        label: 'Training data',
        here: 'none',
        gpt2: '40 GB · ~8M documents',
        llama: '15T+ tokens',
        // Corrected 2026-08-05: previously "~10 billion tokens" for GPT-2,
        // which was an inference from the word count rather than a stated
        // figure. OpenAI published the corpus size, not a token count.
        note: 'OpenAI described WebText as 40 GB of text from about 8 million documents, roughly 8 billion words, which is not the same as a published token count. Meta states Llama 3 saw over 15 trillion tokens.',
        source: SOURCES.llama3Announcement,
      },
    ],
    L4_underHood: `Every stage is the same optimisation loop; only the loss differs.

\`\`\`
pretraining   loss = cross_entropy(predicted_next_token, actual_next_token)
SFT           same loss, but only over the assistant's tokens
alignment     loss rewards the preferred response over the rejected one
\`\`\`

That is the whole conceptual progression: predict text → predict *this kind of* text → prefer *this* text over *that* text. The machinery underneath. Forward pass, backprop, optimiser step, never changes.`,
  },

  {
    ...outline({
      id: 'gather-data',
      title: 'Gather data',
      tag: 'stage 1',
      color: 'yellow',
      order: 0,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Collect and clean a corpus. Most of the work is not collecting. It is deciding what to throw away.',
      L0_analogy:
        'Building a library by taking everything, then spending most of your time removing the duplicates, the junk and the answer key to next week\'s exam.',
      leadsTo: ['train-tokenizer'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Raw web text is mostly unusable.** Boilerplate, navigation, spam, machine translation, near-duplicates. The filtering pipeline is where the quality comes from.',
        '**Deduplication matters more than it sounds.** Text repeated many times gets over-weighted and memorised verbatim rather than learned from.',
        '**Decontamination protects your own measurements.** If benchmark questions leak into training data, evaluation scores go up and real capability does not.',
        '**Mixture is a design decision.** How much code, how much maths, which languages. These proportions measurably shape what the finished model is good at.',
      ],
      flow: {
        caption: 'A funnel that removes far more than it keeps.',
        steps: [
          { id: 'raw', label: 'Raw sources', kind: 'input', sub: 'web crawl, code, books, papers' },
          {
            id: 'filter',
            label: 'Filtering',
            kind: 'stage',
            sub: 'most of the pipeline',
            parts: [
              { id: 'qual', label: 'Quality', sub: 'drop boilerplate and spam', kind: 'control' },
              { id: 'dedup', label: 'Deduplicate', sub: 'near-duplicates too', kind: 'control' },
              { id: 'decon', label: 'Decontaminate', sub: 'remove benchmark leakage', kind: 'control' },
            ],
          },
          { id: 'mix', label: 'Mixture', kind: 'control', sub: 'proportions of code, maths, language' },
          { id: 'out', label: 'Training corpus', kind: 'output', sub: 'trillions of tokens' },
        ],
        note: 'Published pipelines routinely discard the large majority of what they crawl. The discarding is the value.',
      },
    },
    L2_snags: [
      {
        q: 'Is more data always better?',
        a: 'No, more *good* data is better. Adding low-quality text measurably hurts, because the model spends capacity learning to imitate it. Several well-known results come from training on less data that was filtered harder.',
      },
      {
        q: 'What is contamination and why does it matter so much?',
        a: 'Benchmark questions leaking into the training set. The model then recognises the test rather than solving it, scores climb, and you have lost your ability to tell whether anything improved. It is a measurement failure more than a capability one.',
      },
      {
        q: 'Why deduplicate if repetition is how learning works?',
        a: 'Repetition within an epoch is not the same as duplicated documents. A passage appearing thousands of times gets memorised verbatim and crowds out other text, so you pay full training cost for one paragraph and get worse generalisation.',
      },
    ],
    L3_atScale: [
      { label: 'Corpus size', here: '0', gpt2: '~40 GB text', llama: '~15 trillion tokens' },
      {
        label: 'Kept after filtering',
        here: ', ',
        llama: 'a small fraction of crawl',
        note: 'The exact ratio varies by pipeline, but discarding the majority is normal.',
      },
    ],
    L4_underHood: `Deduplication at this scale cannot compare every document to every other one, that is quadratic. The standard tool is **MinHash with locality-sensitive hashing**: reduce each document to a short signature such that similar documents collide, then only compare within collisions.

Decontamination is usually n-gram overlap against every benchmark you intend to report, done *before* training rather than after. After is too late to fix and too tempting to ignore.`,
  },

  {
    ...outline({
      id: 'train-tokenizer',
      title: 'Train the tokenizer',
      tag: 'stage 2',
      color: 'yellow',
      order: 1,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Learn the vocabulary from the corpus, which pieces are worth a slot. Cheap, fast, and permanently locked once training starts.',
      L0_analogy:
        'Choosing the alphabet before writing the book. Cheap to decide, impossible to change later.',
      prereqs: ['gather-data'],
      leadsTo: ['pretraining'],
      related: ['tokenization'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**It is a counting job, not a learning job.** No gradients, no GPUs. Count adjacent pairs, merge the most frequent, repeat until the budget is spent. Minutes to hours.',
        '**Start from bytes so nothing is unrepresentable.** 256 slots for raw bytes means any input can be encoded, however strange.',
        '**The vocabulary size is a trade.** Bigger vocabulary means fewer tokens per document. Cheaper inference, but a larger embedding table and rarer training signal per slot.',
        '**Then it is frozen forever.** The embedding table has one row per slot. Changing the vocabulary after training would mean rows that were never trained.',
      ],
      flow: {
        caption: 'A merge loop, run once, before any model exists.',
        steps: [
          { id: 'corp', label: 'Corpus sample', kind: 'input', sub: 'representative text' },
          { id: 'bytes', label: 'Start from bytes', kind: 'stage', sub: '256 base slots' },
          {
            id: 'merge',
            label: 'Merge loop',
            kind: 'stage',
            sub: 'count pairs · merge the most frequent · repeat',
          },
          { id: 'vocab', label: 'Frozen vocabulary', kind: 'output', sub: 'and its merge rules' },
        ],
        loop: 'Repeat until the vocabulary budget is reached, typically 50k-200k slots.',
        note: 'Encoding new text later just replays these merges greedily. The rules are the tokenizer.',
      },
    },
    L2_snags: [
      {
        q: 'Why not just use words as tokens?',
        a: 'Because you would need a slot for every word form in every language, and would still fail on anything new, names, typos, code. Sub-words give you a bounded vocabulary that can still spell anything.',
      },
      {
        q: 'Why can this never be changed afterwards?',
        a: 'The embedding table has exactly one row per slot, and those rows are trained. Adding a slot means adding an untrained row full of random numbers; renumbering means every row now means something different. Either way the model is broken.',
      },
      {
        q: 'Why do some languages cost more tokens than English?',
        a: 'Because the merge counts came from a corpus that was mostly English, so English words got their own slots and other scripts get split into many pieces. Same sentence, more tokens, higher price. A direct consequence of what the tokenizer was counted on.',
      },
    ],
    L3_atScale: [
      {
        label: 'Vocabulary size',
        here: '3',
        gpt2: '50,257',
        llama: '128,256',
        source: SOURCES.llama3Config,
      },
      {
        label: 'Cost to train',
        here: ', ',
        llama: 'hours on CPU',
        note: 'Trivially cheap compared to everything downstream, and permanently binding.',
      },
    ],
    L4_underHood: `Byte-Pair Encoding, in full:

\`\`\`python
vocab = {bytes(i) for i in range(256)}
while len(vocab) < budget:
    pair = most_frequent_adjacent_pair(corpus)
    vocab.add(merge(pair))
    corpus = replace_all(corpus, pair, merge(pair))
\`\`\`

The output is an ordered list of merges. Encoding replays them in order, which is why the tokenizer is deterministic and why the order matters as much as the set.`,
  },

  {
    ...outline({
      id: 'pretraining',
      title: 'Pretraining',
      tag: 'stage 3',
      color: 'yellow',
      order: 2,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Predict the next token, measure how wrong you were, push every weight slightly less wrong. Repeat for trillions of tokens.',
      L0_analogy: 'The entire skill is learned from one exercise, done a trillion times.',
      prereqs: ['train-tokenizer'],
      related: ['gradient-descent', 'backprop'],
      leadsTo: ['sft'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The task is trivial to state.** Given some text, predict the next token. No labels are needed. The text is its own answer key, which is why this scales to the whole internet.',
        '**Cross-entropy measures the wrongness.** Not "right or wrong" but "how much probability did you put on the correct token". Confident and wrong is punished far harder than uncertain and wrong.',
        '**Backprop turns that into a direction for every weight.** One number per weight: which way, and how much, to move to be less wrong.',
        '**AdamW takes the step.** Not a raw step. It keeps running averages of each weight\'s gradient history so noisy directions move less than consistent ones.',
        '**Everything else emerges from this.** Grammar, facts, translation, arithmetic, some reasoning. Nobody trains those separately; they are what next-token prediction requires at sufficient scale.',
      ],
      flow: {
        caption: 'One training step. Multiply by a few hundred thousand.',
        steps: [
          { id: 'batch', label: 'Batch of text', kind: 'input', sub: 'millions of tokens at once' },
          { id: 'fwd', label: 'Forward pass', kind: 'stage', sub: 'predict every next token' },
          { id: 'loss', label: 'Cross-entropy loss', kind: 'control', sub: 'how wrong, per token' },
          {
            id: 'back',
            label: 'Backward pass',
            kind: 'stage',
            sub: 'a gradient for every weight',
            parts: [
              { id: 'grad', label: 'Gradients', sub: 'which way is less wrong', kind: 'store' },
              { id: 'opt', label: 'AdamW state', sub: 'per-weight momentum', kind: 'store' },
            ],
          },
          { id: 'upd', label: 'Update weights', kind: 'output', sub: 'a very small step' },
        ],
        loop: 'Repeat with the next batch. Checkpoint constantly, because hardware will fail during a run this long.',
        note: 'Optimiser state is roughly twice the size of the weights themselves, which is why training needs far more memory than serving.',
      },
    },
    L2_snags: [
      {
        q: 'Where do the labels come from if this is unsupervised?',
        a: 'The text itself. To predict token 57, the label is token 57, you just hide it. That is why it is sometimes called self-supervised: the supervision is real, it simply costs nothing to produce.',
      },
      {
        q: 'How does predicting the next word produce reasoning?',
        a: 'Because predicting well enough eventually requires it. To finish "the answer to 17 × 24 is", memorising is impossible for every pair; something arithmetic-shaped is cheaper. The capability appears because it is the efficient way to lower loss, not because anyone asked for it.',
      },
      {
        q: 'Why does training need so much more memory than serving?',
        a: 'Serving holds weights. Training holds weights, plus a gradient for each, plus AdamW\'s two running averages for each, plus the activations of the whole forward pass so backprop can use them. Roughly four times the weights before activations.',
      },
      {
        q: 'Does the model see the same text more than once?',
        a: 'At this scale, usually about once, there is more data than compute. Small models trained on smaller corpora do multiple passes, but repeating too often causes memorisation rather than learning.',
      },
    ],
    L3_atScale: [
      {
        label: 'Training data seen',
        here: '0',
        gpt2: '40 GB (~8B words)',
        llama: '15T+ tokens',
        note: 'GPT-2\'s corpus size is published; a token count for it is not. Comparing the two directly is therefore an estimate, not a measurement.',
        source: SOURCES.llama3Announcement,
      },
      { label: 'Wall clock', here: ', ', gpt2: 'days', llama: 'weeks on thousands of GPUs' },
      {
        label: 'Memory vs serving',
        here: ', ',
        llama: '~4× the weights',
        note: 'Weights + gradients + two optimiser moments, before activations.',
      },
    ],
    L4_underHood: `The loss is the negative log of the probability assigned to the correct token:

\`\`\`python
loss = -log(softmax(logits)[correct_token])
\`\`\`

That shape is what makes confident mistakes so expensive: as the assigned probability approaches zero, the log approaches negative infinity. A model that is 99% sure and wrong is punished enormously more than one that was merely unsure, which is what teaches calibration alongside accuracy.`,
  },

  {
    ...outline({
      id: 'sft',
      title: 'Supervised fine-tuning',
      tag: 'stage 4',
      color: 'yellow',
      order: 3,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Show the pretrained model examples of the behaviour you want, so it stops merely continuing text and starts responding.',
      L0_analogy:
        'Someone who has read everything, being shown for the first time what a good answer to a question looks like.',
      prereqs: ['pretraining'],
      related: ['lora-dora'],
      leadsTo: ['alignment'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**A pretrained model does not answer. It continues.** Ask it a question and a plausible continuation is three more questions, because that is what the internet looks like.',
        '**SFT teaches the shape of a response.** Curated pairs: a prompt, and a good answer to it. The model learns that after a question comes an answer.',
        '**Same loss, narrower target.** Still next-token prediction, but the loss is computed only over the assistant\'s tokens. It is not trained to predict the user\'s side.',
        '**Quality beats quantity, sharply.** A few thousand excellent examples routinely outperform hundreds of thousands of mediocre ones. The model imitates what it is shown, including the sloppiness.',
        '**This is also where the chat format is learned.** Turn markers, roles, when to stop. Those are special tokens the model learns to respect here.',
      ],
      flow: {
        caption: 'The same machinery as pretraining, pointed at a much smaller and much cleaner target.',
        steps: [
          { id: 'base', label: 'Pretrained model', kind: 'input', sub: 'knows language, does not answer' },
          {
            id: 'pairs',
            label: 'Curated pairs',
            kind: 'input',
            sub: 'thousands, not trillions',
            parts: [
              { id: 'p', label: 'Prompt', sub: 'what a user might ask', kind: 'input' },
              { id: 'r', label: 'Ideal response', sub: 'written or heavily edited by humans', kind: 'output' },
            ],
          },
          { id: 'train', label: 'Fine-tune', kind: 'stage', sub: 'loss over assistant tokens only' },
          { id: 'out', label: 'Instruct model', kind: 'output', sub: 'now responds rather than continues' },
        ],
        note: 'Cheap enough to run repeatedly, hours, not weeks. This is where most visible iteration happens.',
      },
    },
    L2_snags: [
      {
        q: 'Why mask the loss over the user\'s turn?',
        a: 'Because you want a model that answers questions, not one that writes them. Training on the user side teaches it to imitate users, which shows up as the model asking itself questions or drifting into dialogue.',
      },
      {
        q: 'How can a few thousand examples change a model trained on trillions of tokens?',
        a: 'Because it is not teaching new capability, only selecting behaviour. The ability to answer was already there. It was buried under every other way text can continue. SFT is closer to pointing than to teaching.',
      },
      {
        q: 'Can SFT make the model worse?',
        a: 'Easily. Narrow fine-tuning data causes catastrophic forgetting of general ability, and any sloppiness in your examples is imitated faithfully. This is a large part of why adapters and low learning rates are the norm.',
      },
    ],
    L3_atScale: [
      { label: 'Examples', here: ', ', llama: 'thousands to ~100k' },
      { label: 'Wall clock', here: ', ', llama: 'hours' },
      {
        label: 'Cost vs pretraining',
        here: ', ',
        llama: 'a rounding error',
        note: 'Which is why fine-tunes ship weekly and base models yearly.',
      },
    ],
    L4_underHood: `The only mechanical change from pretraining is the loss mask:

\`\`\`python
labels = input_ids.clone()
labels[~assistant_token_mask] = -100    # ignored by the loss
loss = cross_entropy(logits, labels)
\`\`\`

\`-100\` is the conventional ignore index. Everything else. Optimiser, forward pass, backprop, is identical. The stage is defined by its data and its mask, not by new machinery.`,
  },

  {
    ...outline({
      id: 'alignment',
      title: 'Alignment',
      tag: 'stage 5',
      color: 'yellow',
      order: 4,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Tune on preferences rather than answers, which of two responses is better. A different kind of signal from "here is the right answer".',
      L0_analogy:
        'A critic rather than a textbook. Easier to say which of two drafts is better than to write the perfect one.',
      prereqs: ['sft'],
      leadsTo: ['evaluation'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Some qualities cannot be demonstrated, only compared.** Helpfulness, honesty, appropriate refusal, tone. Writing the single ideal answer is hard; picking the better of two is easy.',
        '**So the data is pairs with a winner.** One prompt, two responses, a judgement of which is preferred. That comparison is the training signal.',
        '**RLHF was the original recipe.** Train a reward model to predict human preference, then use reinforcement learning to maximise it. Effective, but a complicated pipeline with a separate model to maintain.',
        '**DPO removes the reward model.** It turns out you can optimise directly against the preference pairs. Simpler, more stable, and now common.',
        '**A leash is required.** Push too hard toward the preference signal and the model degenerates. It finds whatever the reward likes and stops being a language model. A penalty keeps it near where it started.',
      ],
      flow: {
        caption: 'Learning from comparisons, with a tether to the starting point.',
        steps: [
          { id: 'sftm', label: 'SFT model', kind: 'input', sub: 'answers, but not always well' },
          {
            id: 'prefs',
            label: 'Preference pairs',
            kind: 'input',
            sub: 'same prompt, two answers, a winner',
            parts: [
              { id: 'chosen', label: 'Chosen', sub: 'the preferred response', kind: 'output' },
              { id: 'rej', label: 'Rejected', sub: 'the other one', kind: 'output' },
            ],
          },
          {
            id: 'opt',
            label: 'Preference optimisation',
            kind: 'stage',
            sub: 'raise the chosen, lower the rejected',
            parts: [
              { id: 'rlhf', label: 'RLHF', sub: 'reward model + RL', kind: 'stage' },
              { id: 'dpo', label: 'DPO / GRPO', sub: 'direct, no reward model', kind: 'stage' },
            ],
          },
          { id: 'kl', label: 'Stay-close penalty', kind: 'control', sub: 'do not drift from the SFT model' },
          { id: 'out', label: 'Aligned model', kind: 'output', sub: 'what actually ships' },
        ],
        note: 'The penalty is not a detail. Without it the model reliably finds a way to score well and speak badly.',
      },
    },
    L2_snags: [
      {
        q: 'Why is a comparison more useful than a correct answer?',
        a: 'Because for open-ended work there is no single correct answer, and asking humans to write one is slow and inconsistent. Asking which of two is better is fast, cheap and far more reliable between different annotators.',
      },
      {
        q: 'What is reward hacking?',
        a: 'The model finding something the reward signal likes that humans do not actually want. Classic examples: getting longer because length correlated with preference, or becoming sycophantic because agreement scored well. The stay-close penalty limits how far it can chase this.',
      },
      {
        q: 'Is this where refusals come from?',
        a: 'Largely, yes. Refusal behaviour is shaped by what annotators preferred. It is also why refusals can be miscalibrated in both directions: refusing harmless requests, or complying with ones it should not. Both are preference-data problems.',
      },
      {
        q: 'Why did DPO replace RLHF in so many pipelines?',
        a: 'Not because RLHF fails, but because it is a lot of moving parts. A separate reward model to train, serve and keep from going stale, plus RL\'s own instability. DPO gets much of the benefit from the same data with a single training run.',
      },
    ],
    L3_atScale: [
      { label: 'Preference pairs', here: ', ', llama: 'tens to hundreds of thousands' },
      {
        label: 'Who compares',
        here: ', ',
        llama: 'humans, increasingly assisted by models',
        note: 'Model-generated preferences scale, but inherit whatever bias the judging model has.',
      },
    ],
    L4_underHood: `DPO's insight is that the reward model was an unnecessary intermediate. The loss compares how much *more likely* the chosen response became, relative to the reference model:

\`\`\`
loss = -log σ( β · [ (log π(chosen) − log π_ref(chosen))
                   − (log π(rejected) − log π_ref(rejected)) ] )
\`\`\`

\`π_ref\` is the frozen SFT model, and it is doing the leash's job: the loss rewards moving the chosen response *up relative to where it already was*, so drifting far from the starting distribution is not free.`,
  },

  {
    ...outline({
      id: 'lora-dora',
      title: 'LoRA / DoRA adapters',
      tag: 'stage 5b',
      color: 'yellow',
      order: 5,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Instead of moving all the weights, train a small low-rank patch alongside them. Cheap to train, tiny to store, and swappable at serve time.',
      L0_analogy:
        'A set of overlays for a map rather than reprinting the map. Same base, many variants, one shelf.',
      prereqs: ['sft'],
      related: ['aibrix', 'matrix'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Full fine-tuning updates every weight.** For an 8B model that means optimiser state for 8 billion parameters and a full copy of the model per variant.',
        '**The observation behind LoRA: the update is low-rank.** The change fine-tuning makes to a big weight matrix turns out to be expressible as the product of two much thinner matrices.',
        '**So train only those two.** Freeze the original weights entirely. A rank-16 adapter on an 8B model is a fraction of a percent of the parameters.',
        '**Serving gets much cheaper as a result.** One base model resident, many small adapters swapped per request. Fifty fine-tuned variants no longer means fifty deployments.',
        '**DoRA refines it.** It separates the update into magnitude and direction, which tracks full fine-tuning more closely at similar cost.',
      ],
      flow: {
        caption: 'The frozen matrix, and the thin pair trained beside it.',
        steps: [
          { id: 'w', label: 'Frozen weight W', kind: 'store', sub: 'e.g. 4096 × 4096, untouched' },
          {
            id: 'ab',
            label: 'Trainable pair',
            kind: 'stage',
            sub: 'the only thing that learns',
            parts: [
              { id: 'a', label: 'A', sub: '4096 × r', kind: 'store' },
              { id: 'b', label: 'B', sub: 'r × 4096', kind: 'store' },
            ],
          },
          { id: 'sum', label: 'W + BA', kind: 'stage', sub: 'used in the forward pass' },
          { id: 'ship', label: 'Adapter file', kind: 'output', sub: 'megabytes, not gigabytes' },
        ],
        note: 'With r = 16 the pair is a tiny fraction of W. That ratio is the entire economics of adapters.',
      },
    },
    L2_snags: [
      {
        q: 'What does "rank" mean here?',
        a: 'The shared inner dimension of the two thin matrices. The width of the bottleneck the update has to pass through. Higher rank means more capacity to change behaviour and a larger adapter. 8 to 64 covers most uses.',
      },
      {
        q: 'Is an adapter as good as full fine-tuning?',
        a: 'For adapting behaviour, style or a domain, usually close enough that the cost difference decides it. For teaching genuinely new capability it can fall short. The bottleneck is a real constraint, which is what makes it cheap.',
      },
      {
        q: 'Can several adapters be used at once?',
        a: 'Yes, and that is a large part of the appeal. Different adapters for different customers or tasks over one resident base model. Composing several simultaneously is possible but their effects can interfere.',
      },
      {
        q: 'Why does this make serving cheaper rather than just training?',
        a: 'Because the expensive resident thing is the base model, and it is shared. Each extra variant costs megabytes of adapter instead of gigabytes of weights, so a fleet can serve many variants without a deployment each.',
      },
    ],
    L3_atScale: [
      {
        label: 'Trainable share',
        here: ', ',
        llama: 'well under 1%',
        note: 'Which cuts optimiser memory by roughly the same factor.',
      },
      { label: 'Adapter file size', here: ', ', llama: 'megabytes vs ~16 GB' },
      { label: 'Typical rank', here: ', ', llama: '8-64' },
    ],
    L4_underHood: `\`\`\`python
# W is frozen. Only A and B receive gradients.
out = x @ W  +  (x @ A) @ B * (alpha / r)
\`\`\`

\`A\` is initialised random and \`B\` at zero, so the adapter contributes exactly nothing on the first step. Training starts from the base model's behaviour rather than perturbing it.

For deployment the product can be folded in (\`W' = W + BA\`) to remove the extra multiply, at the cost of no longer being able to swap it. Serving stacks that hot-swap adapters keep them separate on purpose.`,
  },

  {
    ...outline({
      id: 'evaluation',
      title: 'Evaluation',
      tag: 'stage 6',
      color: 'yellow',
      order: 6,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Decide whether the new weights are actually better. The gate before anything ships, and the hardest thing on this continent to get right.',
      L0_analogy:
        'The tasting, not the recipe. And the reason you keep some dishes back from the chef who cooked them.',
      prereqs: ['alignment'],
      leadsTo: ['deploy-prep'],
      related: ['mlflow', 'monitoring'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Training loss is not quality.** It says the model got better at predicting its training distribution. It says nothing about whether answers improved for users.',
        '**So you need held-out measurement.** Benchmarks for capability, task-specific sets for your use case, safety classifiers for behaviour, and human or model judgement for open-ended work.',
        '**Every automatic metric is gameable.** Optimise against a benchmark and you improve the benchmark. This is why contamination checks and held-back sets matter more than the headline number.',
        '**Regressions matter as much as gains.** A model better on average but worse on your top use case is not an upgrade. Per-slice results beat a single score.',
        '**It has to be a gate, not a report.** If evaluation cannot block a release, it is documentation of a decision already made.',
      ],
      flow: {
        caption: 'Several independent signals, and one decision.',
        steps: [
          { id: 'cand', label: 'Candidate model', kind: 'input' },
          {
            id: 'suites',
            label: 'Evaluation suites',
            kind: 'stage',
            sub: 'deliberately diverse',
            parts: [
              { id: 'bench', label: 'Benchmarks', sub: 'general capability', kind: 'control' },
              { id: 'task', label: 'Task sets', sub: 'your actual use case', kind: 'control' },
              { id: 'safety', label: 'Safety', sub: 'refusal calibration', kind: 'control' },
              { id: 'judge', label: 'Model-as-judge', sub: 'open-ended quality', kind: 'control' },
            ],
          },
          { id: 'cmp', label: 'Compare to incumbent', kind: 'control', sub: 'per slice, not just overall' },
          { id: 'gate', label: 'Ship or reject', kind: 'output', sub: 'a real gate' },
        ],
        note: 'A single averaged number hides exactly the regression you most need to see.',
      },
    },
    L2_snags: [
      {
        q: 'Why not just look at the loss?',
        a: 'Because loss measures prediction on the training distribution. A model can lower loss by getting better at text nobody asks for. It is a useful training signal and a poor release criterion.',
      },
      {
        q: 'What does it mean that a benchmark is "saturated"?',
        a: 'Everyone scores near the ceiling, so it no longer distinguishes models. At that point differences are noise and contamination rather than capability, and the benchmark should be retired rather than reported.',
      },
      {
        q: 'Can a model judge another model\'s output?',
        a: 'Usefully, yes, and it is now standard for open-ended work. But judges have biases. Position, length, and a preference for their own style, so they need calibrating against a human-scored set rather than being trusted outright.',
      },
      {
        q: 'How do you evaluate something with no right answer?',
        a: 'Comparatively. Show the judge both responses and ask which is better, the same shape as alignment data. Absolute scores on open-ended work are unreliable; pairwise preferences are much more stable.',
      },
    ],
    L3_atScale: [
      { label: 'Suites run per candidate', here: ', ', llama: 'dozens' },
      {
        label: 'Human-reviewed set',
        here: ', ',
        llama: 'small but essential',
        note: 'It is what keeps the automatic judges honest; without it they drift unnoticed.',
      },
    ],
    L4_underHood: `Contamination is the failure that quietly invalidates everything else. The check is n-gram overlap between each benchmark and the training corpus, run **before** training:

\`\`\`python
contaminated = [ex for ex in benchmark
                if ngram_overlap(ex, corpus) > threshold]
\`\`\`

Run it afterwards and you are choosing between shipping a number you know is wrong and rerunning a very expensive job. Which is why it belongs in the data pipeline, not the eval pipeline.`,
  },

  {
    ...outline({
      id: 'deploy-prep',
      title: 'Deploy prep',
      tag: 'stage 7',
      color: 'yellow',
      order: 7,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'Shrink it so it can be served: fewer bits per weight, or a smaller model taught to imitate the big one. Trade a little quality for a lot of memory.',
      L0_analogy:
        'Compressing a photo for the web. The original still exists; what ships is smaller and almost as good.',
      prereqs: ['evaluation'],
      leadsTo: ['vllm'],
      related: ['gpu', 'kv-cache'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Training precision is more than serving needs.** Weights are trained in 16 bits. Serving them in 8 or 4 loses surprisingly little.',
        '**Quantization is a memory win, and memory is concurrency.** Halving the weights frees gigabytes for KV cache, which is what decides how many users fit on a GPU.',
        '**Not all weights tolerate it equally.** A few outlier values dominate quality, so good schemes keep those in higher precision and squeeze the rest.',
        '**Distillation is the other lever.** Train a small model to imitate the large one\'s output distribution. It learns more from the full probabilities than from the text alone.',
        '**Either way, re-evaluate.** Compression changes behaviour subtly, and the only way to know how much is to run the gate again on the compressed artifact.',
      ],
      flow: {
        caption: 'Two different ways to make it fit, and one non-negotiable step after.',
        steps: [
          { id: 'full', label: 'Evaluated model', kind: 'input', sub: '16-bit weights' },
          {
            id: 'shrink',
            label: 'Compression',
            kind: 'stage',
            sub: 'pick one, or both',
            parts: [
              { id: 'quant', label: 'Quantize', sub: '16 → 8 → 4 bits', kind: 'stage' },
              { id: 'distil', label: 'Distil', sub: 'smaller model imitates bigger', kind: 'stage' },
            ],
          },
          { id: 'recheck', label: 'Re-evaluate', kind: 'control', sub: 'on the compressed artifact' },
          { id: 'ship', label: 'Servable artifact', kind: 'output', sub: 'registered and deployable' },
        ],
        note: 'Evaluating the uncompressed model and shipping the compressed one measures something you did not ship.',
      },
    },
    L2_snags: [
      {
        q: 'Does quantization make the model dumber?',
        a: 'A little, and much less than the size reduction suggests. 8-bit is often indistinguishable on most tasks; 4-bit is visible but frequently worth it. The comparison that matters is against the smaller model you could otherwise afford to run. A quantized large model usually beats a full-precision small one.',
      },
      {
        q: 'Why does saving memory matter if it already fits?',
        a: 'Because everything you free becomes KV cache, and cache is how many conversations you can serve at once. Halving the weights can more than double concurrency, which is a cost reduction per user, not just a fit.',
      },
      {
        q: 'What is distillation actually learning from?',
        a: 'The full probability distribution, not just the chosen token. Knowing the teacher put 60% on one word and 30% on another carries far more information than the single word, which is why a student can learn from fewer examples.',
      },
    ],
    L3_atScale: [
      {
        label: 'Weights at each precision',
        here: ', ',
        llama: '16 GB → 8 GB → ~4 GB',
        note: 'An 8B model at fp16, int8 and 4-bit.',
      },
      {
        label: 'Typical quality cost',
        here: ', ',
        llama: 'small at 8-bit, visible at 4-bit',
        note: 'Highly task-dependent, which is why the re-evaluation step is not optional.',
      },
    ],
    L4_underHood: `Quantization maps a range of floats onto a small integer range:

\`\`\`
scale = max(|W_block|) / 127          # int8
W_q   = round(W_block / scale)
\`\`\`

Doing this per block rather than per tensor is what makes it work: one outlier weight would otherwise stretch the scale so far that every ordinary weight collapses to nearly the same integer. Modern schemes go further and keep the outlier channels in higher precision, quantizing only the well-behaved majority.`,
  },

  {
    ...outline({
      id: 'continual',
      title: 'Continual training',
      tag: 'stage 8',
      color: 'yellow',
      order: 8,
      track: 'build',
      parent: 'build',
      L0_oneLiner:
        'The loop closes: production traffic and new data feed the next run. A model is a release, not a finished object.',
      L0_analogy: 'A published edition, not a finished manuscript. There is always a next printing.',
      prereqs: ['deploy-prep'],
      related: ['monitoring'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The world moves; the weights do not.** Frozen weights get steadily more out of date as events, products and language change around them.',
        '**Production is the best source of the next dataset.** Real failures, real ambiguity, real distribution. None of which you can invent in advance.',
        '**But raw logs are not training data.** They need curation, labelling and privacy handling before they are usable, and that step is where most closed loops actually break.',
        '**Most updates are cheap ones.** Adapters and fine-tunes on recent data, not new base models. Pretraining from scratch is rare and enormous.',
        '**Guard against feedback loops.** Training on your own outputs narrows the model over generations. New human data has to keep entering the loop.',
      ],
      flow: {
        caption: 'The arrow that turns the pipeline into a cycle.',
        steps: [
          { id: 'prod', label: 'Production traffic', kind: 'input', sub: 'real prompts, real failures' },
          {
            id: 'curate',
            label: 'Curate',
            kind: 'stage',
            sub: 'where most loops break',
            parts: [
              { id: 'sel', label: 'Select', sub: 'failures and edge cases', kind: 'control' },
              { id: 'lab', label: 'Label', sub: 'what it should have said', kind: 'control' },
              { id: 'priv', label: 'Redact', sub: 'privacy before storage', kind: 'control' },
            ],
          },
          { id: 'retrain', label: 'Fine-tune or adapt', kind: 'stage', sub: 'rarely full pretraining' },
          { id: 'gate2', label: 'Evaluate again', kind: 'control', sub: 'same gate as before' },
          { id: 'ship2', label: 'Next version', kind: 'output' },
        ],
        loop: 'And round again. Every version is version N of something ongoing.',
        note: 'Without the curation box this is just log storage with ambition.',
      },
    },
    L2_snags: [
      {
        q: 'Why not retrain continuously and automatically?',
        a: 'Because each retrain can regress, and an automatic pipeline with no gate ships those regressions. Also because training on unvetted production data is the fastest route to learning your own mistakes. The gate is what makes the loop safe, and gates involve judgement.',
      },
      {
        q: 'What is model collapse?',
        a: 'What happens when models are trained mostly on model-generated text across generations: diversity narrows, rare cases disappear, quality degrades. Fresh human data entering the loop is what prevents it, which is a reason to value it beyond volume.',
      },
      {
        q: 'Is retrieval a better answer than retraining for keeping current?',
        a: 'Usually, for facts. Putting today\'s document in the prompt is instant, auditable and reversible; writing it into the weights is slow, expensive and hard to undo. Retrain for behaviour and capability; retrieve for knowledge.',
      },
    ],
    L3_atScale: [
      {
        label: 'Base model cadence',
        here: ', ',
        llama: 'months to a year',
        note: 'Enormous cost, so rare.',
      },
      {
        label: 'Fine-tune cadence',
        here: ', ',
        llama: 'weekly or faster',
        note: 'Cheap enough to be routine, which is where the visible improvement comes from.',
      },
    ],
    L4_underHood: `Curation is the part that gets underestimated, and it is mostly an unglamorous filter chain:

\`\`\`
logs → sample → detect failure → deduplicate → redact PII
     → label (human or model) → hold out a test slice → train
\`\`\`

The held-out slice matters especially here: without it you cannot tell whether the next model fixed the failures you curated, or merely memorised them.`,
  },
];
