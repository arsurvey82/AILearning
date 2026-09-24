/**
 * Why each concept exists, for the nodes that have an answer.
 *
 * Kept in one file rather than scattered through the node definitions, because
 * the value is in reading them together. A timeline separating 1958 from 1986
 * from 2017 is what stops a reader believing a language model is one recent
 * invention, and that separation is invisible if each date is buried in its own
 * node.
 *
 * Deliberately not exhaustive. A vector is an object, not somebody's fix for
 * something, and inventing an origin for it would be worse than leaving it
 * empty. Only concepts where "why does this exist at all" is a real question
 * get an entry.
 *
 * Every dated claim carries its paper.
 */

import type { Origin } from '../glossary/schema';

export const ORIGINS: Record<string, Origin> = {
  /* A grouping. The boundary is a fact about this app, not about the field. */
  beyond: {
    kind: 'none',
    because:
      'A heading for the things this app does not teach. The boundary is a choice about what to cover, not an invention anyone made.',
  },
  diffusion: {
    kind: 'fix',
    year: 2020,
    problem:
      'The generative models that worked at the time were adversarial: two networks fighting, which trained unstably and quietly ignored parts of the data it found hard.',
    gained:
      'A plain regression objective. Predict the noise you added, which is stable to train and covers the data rather than collapsing onto the easy parts of it.',
    source: {
      label: 'Ho et al, Denoising Diffusion Probabilistic Models',
      url: 'https://arxiv.org/abs/2006.11239',
    },
  },
  multimodal: {
    kind: 'fix',
    year: 2020,
    problem:
      'Images needed convolutions and text needed transformers, so the two had separate architectures and nothing learned about one transferred to the other.',
    gained:
      'Cut a picture into patches and each one is a vector, which is the only thing a transformer ever handles. One architecture now serves both, which is why a single backbone can read a photograph and a sentence in the same sequence.',
    source: {
      label: 'Dosovitskiy et al, An Image is Worth 16x16 Words',
      url: 'https://arxiv.org/abs/2010.11929',
    },
  },

  /* ---------------------------------------------------------- forced ---- */

  tokenization: {
    kind: 'forced',
    because:
      'Computers hold numbers, not letters. Anything touching text must decide what one unit is and how many exist. This is older than neural networks and there is no version of the problem without it.',
  },
  parameter: {
    kind: 'forced',
    because:
      'A function that can be adjusted needs something to adjust. The moment you decide behaviour should be learned rather than written, you have decided there are numbers to learn.',
  },
  logits: {
    kind: 'forced',
    because:
      'A model choosing between options has to score them. Raw, unbounded scores are what any scoring produces before anything constrains it.',
  },
  probability: {
    kind: 'forced',
    because:
      'Predicting the next token means ranking possibilities you are uncertain about, which is what probability is for. It is not a layer added on top.',
  },

  /* ----------------------------------------------------- dated fixes ---- */

  neuron: {
    kind: 'fix',
    year: 1958,
    problem:
      'Nobody could describe how a machine might learn a category from examples rather than being programmed with a rule for it.',
    gained:
      'A unit that weights its inputs, adds them up and fires. Everything since is arrangements of that.',
    source: {
      label: 'Rosenblatt, The Perceptron: A Probabilistic Model for Information Storage and Organization',
      url: 'https://psycnet.apa.org/record/1959-09865-001',
    },
  },
  backprop: {
    kind: 'fix',
    year: 1986,
    problem:
      'A network with layers in the middle had no known way to assign blame for a mistake, so those layers could not be trained and depth bought nothing.',
    gained:
      'A rule for nudging every number in a deep network. It belongs to neural networks in general, not to this architecture, and predates all of it.',
    source: {
      label: 'Rumelhart, Hinton and Williams, Learning representations by back-propagating errors',
      url: 'https://www.nature.com/articles/323533a0',
    },
  },
  embedding: {
    kind: 'fix',
    year: 1986,
    problem:
      'One slot per word, one switched on, the rest zero. With 100,000 words every word sits exactly as far from every other, so cat is no closer to dog than to Tuesday and similarity teaches nothing.',
    gained:
      'A few hundred numbers with all of them in use. Sparse became dense, and nearness became possible at all.',
    source: {
      label: 'Rumelhart, Hinton and Williams, Learning representations by back-propagating errors',
      url: 'https://www.nature.com/articles/323533a0',
    },
  },
  residual: {
    kind: 'fix',
    year: 2015,
    problem:
      'Deeper networks got worse, not merely harder to train. Adding layers to a working network degraded it, which should not have been possible.',
    gained:
      'A path carrying the input forward untouched, so a layer only has to learn what to add. Depth stopped being a liability and gradients could reach the early layers.',
    source: {
      label: 'He, Zhang, Ren and Sun, Deep Residual Learning for Image Recognition',
      url: 'https://arxiv.org/abs/1512.03385',
    },
  },
  attention: {
    kind: 'fix',
    year: 2014,
    problem:
      'Translators crushed an entire sentence into one fixed-size summary before writing any output, and long sentences did not survive the squeeze.',
    gained:
      'Looking back at every word directly and choosing what matters. This is the idea the transformer is built from, three years before the transformer.',
    source: {
      label: 'Bahdanau, Cho and Bengio, Neural Machine Translation by Jointly Learning to Align and Translate',
      url: 'https://arxiv.org/abs/1409.0473',
    },
  },
  normalization: {
    kind: 'fix',
    year: 2016,
    problem:
      'Magnitudes drift as a signal moves through a deep stack. Too large and softmax saturates so gradients vanish; too small and the signal disappears into numerical noise. Either way the deep layers stop learning.',
    gained: 'Rescaling before each organ reads, which is what makes very deep stacks trainable at all.',
    source: {
      label: 'Ba, Kiros and Hinton, Layer Normalization',
      url: 'https://arxiv.org/abs/1607.06450',
    },
  },
  'train-tokenizer': {
    kind: 'fix',
    year: 2016,
    problem:
      'A fixed vocabulary meets a word it has never seen and has nothing to give. Every rare name, typo or foreign word fell out of the model entirely.',
    gained:
      'Unknown words split into known fragments, falling back to single characters in the worst case, so nothing is ever rejected.',
    source: {
      label: 'Sennrich, Haddow and Birch, Neural Machine Translation of Rare Words with Subword Units',
      url: 'https://arxiv.org/abs/1508.07909',
    },
  },
  transformer: {
    kind: 'fix',
    year: 2017,
    problem:
      'Reading a sentence one word at a time cannot be parallelised, so training was slow and long-range links stayed weak however much attention helped.',
    gained:
      'Every position computed at once, which made training at scale affordable. Two costs arrive with it and both are consequences rather than features: word order vanishes, and the input length becomes finite.',
    source: {
      label: 'Vaswani et al, Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
    },
  },
  'kv-cache': {
    kind: 'fix',
    year: 2017,
    problem:
      'Generating one token at a time meant recomputing keys and values for every earlier token on every step, which is quadratic work for an answer that grows linearly.',
    gained:
      'Storing them instead. Correct only because the causal mask means nothing later can change an earlier token, so a cached entry can never go stale.',
    source: {
      label: 'Vaswani et al, Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
    },
  },
  pretraining: {
    kind: 'fix',
    year: 2018,
    problem:
      'Every task needed its own labelled dataset and its own model trained from scratch, so anything without a large labelled corpus was out of reach.',
    gained:
      'One model trained once on raw text, then adapted cheaply. Predicting the next word turns out to need most of what understanding language needs.',
    source: {
      label: 'Radford et al, Improving Language Understanding by Generative Pre-Training',
      url: 'https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf',
    },
  },
  evaluation: {
    kind: 'fix',
    year: 2020,
    problem:
      'Nobody knew whether bigger models reliably helped, or how to split a budget between size and data, so scaling was guesswork dressed as strategy.',
    gained:
      'Measured relationships that hold well enough to plan with, which turned model building into budget arithmetic.',
    source: {
      label: 'Kaplan et al, Scaling Laws for Neural Language Models',
      url: 'https://arxiv.org/abs/2001.08361',
    },
  },
  rope: {
    kind: 'fix',
    year: 2021,
    problem:
      'A learned position table has exactly as many rows as it was built with, so a model could never be shown a longer input than it was trained on.',
    gained:
      'Position applied as a rotation of the query and key rather than a row looked up, which extends past the trained length far more gracefully.',
    source: {
      label: 'Su et al, RoFormer: Enhanced Transformer with Rotary Position Embedding',
      url: 'https://arxiv.org/abs/2104.09864',
    },
  },
  'lora-dora': {
    kind: 'fix',
    year: 2021,
    problem:
      'Fine-tuning meant updating every weight and storing a full copy per task. Optimiser state alone dwarfs the model, so one team could afford one specialisation.',
    gained:
      'Freezing the base and training two small low-rank matrices beside it. No optimiser state for the frozen weights, so a job that needed a cluster often fits on one machine.',
    source: {
      label: 'Hu et al, LoRA: Low-Rank Adaptation of Large Language Models',
      url: 'https://arxiv.org/abs/2106.09685',
    },
  },
  sft: {
    kind: 'fix',
    year: 2022,
    problem:
      'A model trained only to continue text continues text. Asked a question it might produce more questions, because that is what the internet does, and it had never been shown what an answer looks like.',
    gained:
      'Examples of instructions followed by good responses, which is what turns a text continuer into something that answers.',
    source: {
      label: 'Ouyang et al, Training language models to follow instructions with human feedback',
      url: 'https://arxiv.org/abs/2203.02155',
    },
  },
  alignment: {
    kind: 'fix',
    year: 2022,
    problem:
      'Good behaviour is easier to recognise than to write down. Nobody can produce enough demonstrations to cover helpfulness, honesty and refusal, and no loss function states them.',
    gained:
      'Learning from comparisons instead of demonstrations. People rank outputs, a reward model learns the ranking, and the model optimises against that.',
    source: {
      label: 'Ouyang et al, Training language models to follow instructions with human feedback',
      url: 'https://arxiv.org/abs/2203.02155',
    },
  },
  'agent-layer': {
    kind: 'fix',
    year: 2022,
    problem:
      'A model can only produce text. It cannot read a file, call an interface or check its own work, so anything requiring an action had a person in the middle doing the acting.',
    gained:
      'A loop around the model that executes what it asks for and feeds the result back. Remove the loop and it is a chatbot again.',
    source: {
      label: 'Yao et al, ReAct: Synergizing Reasoning and Acting in Language Models',
      url: 'https://arxiv.org/abs/2210.03629',
    },
  },
  vllm: {
    kind: 'fix',
    year: 2023,
    problem:
      'Serving reserved a contiguous block of memory for every sequence at its maximum possible length, so most of the cache sat empty and batch size was set by waste rather than by need.',
    gained:
      'Paging the cache the way an operating system pages memory, which raised how many sequences fit at once by a large multiple.',
    source: {
      label: 'Kwon et al, Efficient Memory Management for LLM Serving with PagedAttention',
      url: 'https://arxiv.org/abs/2309.06180',
    },
  },
  /* ------------------------------------------------- second batch ------ */

  'gradient-descent': {
    kind: 'fix',
    year: 1847,
    problem:
      'Solving a system of equations exactly is impossible once it is large enough, and many systems have no closed-form answer at all.',
    gained:
      'Step downhill, repeatedly, using only the local slope. Older than computers, older than neural networks, and still the entire method by which every model here was trained.',
    source: {
      label: 'Cauchy, Methode generale pour la resolution des systemes d equations simultanees',
      url: 'https://gallica.bnf.fr/ark:/12148/bpt6k2982c/f540',
    },
  },
  softmax: {
    kind: 'fix',
    year: 1990,
    problem:
      'A network produced raw scores of any size, but training against a target needs them to behave like probabilities: never negative, and adding to one.',
    gained:
      'Exponentiate and normalise. It also disposes of masking for free, because e to the power of minus infinity is exactly zero.',
    source: {
      label: 'Bridle, Probabilistic Interpretation of Feedforward Classification Network Outputs',
      url: 'https://link.springer.com/chapter/10.1007/978-3-642-76153-9_28',
    },
  },
  sampling: {
    kind: 'fix',
    year: 2019,
    problem:
      'Always taking the highest-scoring token produces text that degenerates into repetition, and sampling from the whole distribution occasionally picks something absurd from the long tail.',
    gained:
      'Sampling from only the smallest set of tokens that covers most of the probability, which avoids both the loop and the nonsense.',
    source: {
      label: 'Holtzman et al, The Curious Case of Neural Text Degeneration',
      url: 'https://arxiv.org/abs/1904.09751',
    },
  },
  unembedding: {
    kind: 'fix',
    year: 2017,
    problem:
      'Turning a vector back into a score per token needed its own large matrix, duplicating something the model already had: a table mapping tokens to vectors.',
    gained:
      'Reusing the token table transposed. Fewer parameters, and it made the two directions consistent by construction rather than by training.',
    source: {
      label: 'Press and Wolf, Using the Output Embedding to Improve Language Models',
      url: 'https://arxiv.org/abs/1608.05859',
    },
  },
  gpu: {
    kind: 'fix',
    year: 2012,
    problem:
      'Networks big enough to be interesting took months to train on processors designed to do one thing at a time quickly.',
    gained:
      'Hardware built for drawing triangles turned out to be built for exactly the arithmetic a neural network needs, and the training time collapsed.',
    source: {
      label: 'Krizhevsky, Sutskever and Hinton, ImageNet Classification with Deep Convolutional Neural Networks',
      url: 'https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks',
    },
  },
  continual: {
    kind: 'fix',
    year: 1989,
    problem:
      'Training a network on something new degrades what it already knew, sometimes completely. Learning task two erases task one.',
    gained:
      'A name for the problem, and the reason every update to a deployed model is a retrain rather than an addition.',
    source: {
      label: 'McCloskey and Cohen, Catastrophic Interference in Connectionist Networks',
      url: 'https://www.sciencedirect.com/science/article/abs/pii/S0079742108605368',
    },
  },
  'gather-data': {
    kind: 'fix',
    year: 2020,
    problem:
      'Raw web text is mostly unusable: boilerplate, duplicates, machine-generated filler. Training on it directly wastes most of the compute.',
    gained:
      'Published cleaning and deduplication recipes, which turned "scrape the web" into something reproducible enough to compare runs against.',
    source: {
      label: 'Raffel et al, Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer',
      url: 'https://arxiv.org/abs/1910.10683',
    },
  },
  kubeflow: {
    kind: 'fix',
    year: 2015,
    problem:
      'Running a job across a large fleet meant hand-placing processes on machines, and a failed node meant the whole run was lost.',
    gained:
      'A scheduler that places containerised work, restarts what dies, and can start a group of workers together or not at all.',
    source: {
      label: 'Verma et al, Large-scale cluster management at Google with Borg',
      url: 'https://research.google/pubs/pub43438/',
    },
  },
  mlflow: {
    kind: 'fix',
    year: 2018,
    problem:
      'Nobody could say which data, code and settings produced the model currently in production, so a result could not be reproduced or a regression traced.',
    gained:
      'Recording every run and registering the versions worth keeping, which is what makes the handover from training to serving auditable.',
    source: {
      label: 'Zaharia et al, Accelerating the Machine Learning Lifecycle with MLflow',
      url: 'http://sites.computer.org/debull/A18dec/p39.pdf',
    },
  },
  monitoring: {
    kind: 'forced',
    because:
      'A model is fitted to the world as it was when the data was collected. The world keeps moving and the model does not, so the gap between them can only be found by measuring it in production.',
  },
  matmul: {
    kind: 'forced',
    because:
      'Applying the same learned transformation to every position at once is a matrix multiply by definition. It is not a technique anyone selected; it is what the operation is.',
  },

  /* -------------------------------------------------- third batch ------ */

  activation: {
    kind: 'forced',
    because:
      'Stack two linear layers and you have one linear layer, because a matrix times a matrix is a matrix. Without a bend somewhere in the middle, depth buys literally nothing. The curve is not a refinement; it is the only reason more layers help.',
  },
  'dot-product': {
    kind: 'forced',
    because:
      'Asking how aligned two lists of numbers are has exactly one cheap answer: multiply the matching entries and add them up. Every comparison in the model reduces to this, not by choice but because it is what comparing positions means.',
  },
  derivative: {
    kind: 'forced',
    because:
      'Improving something by stepping downhill requires knowing which way is down. That is a slope, and a slope is a derivative. The mathematics is centuries older than the machines and was not invented for them.',
  },
  'the-loop': {
    kind: 'forced',
    because:
      'One pass of the model produces one token. A sentence therefore needs one pass per word, each one re-reading everything written so far, because the model keeps no memory between passes. The loop is not an optimisation, it is what generation is.',
  },
  mlp: {
    kind: 'fix',
    year: 2017,
    problem:
      'Attention only moves information between positions. Nothing in it transforms what a single position holds, so a stack of pure attention has no place to store what it knows.',
    gained:
      'A small network applied to every position separately, four times wider in the middle. This is where most of a large model parameters live, and where most facts turn out to be stored.',
    source: {
      label: 'Vaswani et al, Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
    },
  },
  feast: {
    kind: 'fix',
    year: 2017,
    problem:
      'Training computed an input one way, in a batch job, and serving computed it again in application code. The two drifted, so a model was fed values that did not match what it learned on and nobody could see why it degraded.',
    gained:
      'One definition of each input, asked for by name from both sides, plus the ability to ask what a value was at a past moment rather than what it is now.',
    source: {
      label: 'Uber Engineering, Meet Michelangelo: Uber Machine Learning Platform',
      url: 'https://www.uber.com/blog/michelangelo-machine-learning-platform/',
    },
  },

  /* --------------------------------------------------- final batch ----- */

  aibrix: {
    kind: 'fix',
    year: 2024,
    problem:
      'One model per server stopped being the shape of the problem. Traffic arrives for many fine-tuned variants of the same base, and routing it blindly means loading and evicting adapters constantly.',
    gained:
      'A control plane that knows which replica already holds which adapter, and sends work there. The engine does the arithmetic; this decides where the arithmetic happens.',
    source: {
      label: 'AIBrix, Cost-Effective and Scalable Control Plane for vLLM',
      url: 'https://arxiv.org/abs/2504.03648',
    },
  },
  'deploy-prep': {
    kind: 'forced',
    because:
      'A set of trained numbers is not a service. Something has to load them, accept requests, batch them, and keep running when a machine dies. That gap between an artifact and a service exists for every model ever trained and cannot be designed away.',
  },
  'token-id': {
    kind: 'forced',
    because:
      'Once a vocabulary exists, its entries need addresses, and a position in a list is the cheapest address there is. The number is a label, not a measurement, which is why arithmetic on token ids is meaningless.',
  },

  /* -------------------------- pre-transformer spine -------------------- */

  'mcculloch-pitts': {
    kind: 'fix',
    year: 1943,
    problem:
      'Nobody had a way to describe a nerve cell as a mathematical object. Without one, no argument about what a network of them could compute was possible.',
    gained:
      'A neuron reduced to a threshold gate: weight the inputs, sum them, fire if the sum clears a bar. Every neural network since is a rearrangement of that one idea.',
    source: {
      label: 'McCulloch and Pitts, A Logical Calculus of the Ideas Immanent in Nervous Activity',
      url: 'https://link.springer.com/article/10.1007/BF02478259',
    },
  },

  /* ------------------------ answered, with no history to tell ----------- */

  /* These are objects, groupings or sub-parts. None of them is somebody's fix
     for anything, so they get an explicit reason rather than silence. Saying
     "there is nothing to chase here" is an answer; a blank cell is not. */

  llm: { kind: 'none', because: 'A grouping, not a thing anyone invented. It names the three continents below it, and each of those has its own story.' },
  model: { kind: 'none', because: 'A container for the maths, the objects and the architecture. The history belongs to its parts, not to the heading.' },
  foundations: { kind: 'none', because: 'A grouping for the mathematics underneath, all of which predates machine learning by centuries.' },
  objects: { kind: 'none', because: 'A grouping for the things a model is made of. Each part has its own answer; the shelf does not.' },
  linalg: { kind: 'none', because: 'A branch of mathematics, not a fix. It was developed for solving equations long before anyone applied it here.' },
  calculus: { kind: 'none', because: 'Mathematics from the seventeenth century, borrowed wholesale. Nobody invented it for neural networks.' },
  vector: { kind: 'none', because: 'A list of numbers. There is no failure it repaired and no alternative to it, because a list of numbers is simply what a position is.' },
  matrix: { kind: 'none', because: 'A grid of numbers. Naming it does not require a history any more than naming a table does.' },
  tensor: { kind: 'none', because: 'A grid with more than two directions. It is notation for shape, not an invention.' },
  architecture: { kind: 'none', because: 'The word for how the parts are arranged. Particular architectures have histories; the word does not.' },
  layer: { kind: 'none', because: 'One repetition of the transformer block, so its history belongs to the transformer. Stacking identical blocks is a consequence of that design, not a separate idea.' },
  query: { kind: 'none', because: 'One of three projections inside attention, and it arrived with attention in 2014. It has no separate story.' },
  key: { kind: 'none', because: 'The second of the three projections. Same origin as attention itself.' },
  value: { kind: 'none', because: 'The third projection, and the one carrying the payload. Same origin as attention itself.' },
  'attention-scores': { kind: 'none', because: 'A step inside attention rather than an invention of its own. Its history belongs to attention.' },
  'attention-weights': { kind: 'none', because: 'What the scores become after softmax. Two existing ideas meeting, not a third one.' },
  'weighted-sum': { kind: 'none', because: 'The final step of attention. Multiplying and adding is arithmetic, not a contribution anyone made.' },
  'up-projection': { kind: 'none', because: 'The first half of the feed-forward block, so its history belongs to the transformer.' },
  'down-projection': { kind: 'none', because: 'The second half of the same block. It exists because the first half widened and something has to narrow it again.' },
  build: { kind: 'none', because: 'A grouping for how a model is made. The stages inside it have dates; the heading does not.' },
  operations: { kind: 'none', because: 'A grouping for how a model is run. Same again: the parts carry the history.' },
  'training-path': { kind: 'none', because: 'The name for the offline half of the lifecycle, not a technique. Its tools each have their own origin.' },
  'inference-path': { kind: 'none', because: 'The name for the online half. A description of where things happen, not a thing that was invented.' },
  agentic: { kind: 'none', because: 'An umbrella for workflows and agents. The published guidance is explicit that the patterns under it are not prescriptive, so the umbrella itself makes no claim.' },
  'context-engineering': { kind: 'none', because: 'A name given to practices that already existed, once context windows grew large enough for filling them to become a mistake.' },
  'tool-design': { kind: 'none', because: 'A discipline rather than an invention. It is API design with a different reader.' },

};

/** Nodes with a dated origin, oldest first. This is the walk-back path. */
export function nodeTimeline(): Array<{ id: string; year: number; origin: Origin }> {
  return Object.entries(ORIGINS)
    .filter(([, o]) => o.kind === 'fix')
    .map(([id, origin]) => ({ id, year: (origin as { kind: 'fix'; year: number }).year, origin }))
    .sort((a, b) => a.year - b.year);
}

/** Concepts nobody chose. Worth separating: they have no alternative history. */
export function forcedNodes(): string[] {
  return Object.entries(ORIGINS)
    .filter(([, o]) => o.kind === 'forced')
    .map(([id]) => id);
}
