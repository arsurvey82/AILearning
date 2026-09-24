/**
 * Continent 3, THE OPERATIONS: how it is run.
 *
 * These nodes are STRUCTURES, not facts. "AIBrix is a control plane" is a true
 * sentence that teaches almost nothing; what a learner needs is what sits
 * inside it and which way a request moves through it. So every node here
 * carries a flow diagram, and the prose explains the diagram rather than
 * substituting for it.
 *
 * Snags here are marked NOT playtested. They are the questions this material
 * usually raises, written from the failure modes these systems actually have , 
 * but nobody has watched a beginner trip on them yet, and the UI says so.
 */

import { outline } from '../outline';
import { SOURCES } from '../sources';
import type { ConceptNode } from '../schema';

export const operationsNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'operations',
      title: 'The Operations',
      tag: 'how it is run',
      color: 'green',
      order: 2,
      track: 'operations',
      parent: 'llm',
      L0_oneLiner:
        'The stack around the model. A batch path that turns data into a versioned artifact, and an online path that turns that artifact into answers fast enough to serve.',
      L0_analogy:
        'A kitchen and a dining room. One develops the recipe on its own schedule; the other has to plate it in eight minutes, every time, at dinner rush.',
      prereqs: ['build'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Two paths, one seam.** Training is batch and offline, it can take a week and retry. Serving is online. It has a latency budget measured in milliseconds. They meet at exactly one place: the model registry.',
        '**That seam is the interface.** Training pushes a versioned artifact in; serving pulls a specific version out. Neither side needs to know how the other works, which is what lets them scale and fail independently.',
        '**Everything else is plumbing around those two.** Feature stores exist so both sides compute inputs the same way. Monitoring exists so what happens in the dining room gets back to the kitchen.',
      ],
      flow: {
        caption: 'The whole of operations, at the level the two paths meet.',
        steps: [
          { id: 'data', label: 'Data', kind: 'input', sub: 'logs, documents, human feedback' },
          {
            id: 'train',
            label: 'Training path',
            kind: 'stage',
            sub: 'batch · offline · hours to weeks',
            parts: [
              { id: 'p-feast', label: 'Feast', sub: 'feature definitions', kind: 'store' },
              { id: 'p-kube', label: 'Kubeflow', sub: 'runs the job', kind: 'stage' },
            ],
          },
          {
            id: 'registry',
            label: 'Model registry',
            kind: 'store',
            sub: 'MLflow, the seam between the two worlds',
          },
          {
            id: 'serve',
            label: 'Inference path',
            kind: 'stage',
            sub: 'online · milliseconds',
            parts: [
              { id: 'p-aibrix', label: 'AIBrix', sub: 'routes and scales', kind: 'control' },
              { id: 'p-vllm', label: 'vLLM', sub: 'runs the forward pass', kind: 'stage' },
            ],
          },
          { id: 'user', label: 'Users', kind: 'output', sub: 'tokens, streamed' },
        ],
        loop: 'Monitoring carries production behaviour back to the data that trains the next version.',
        note: 'The registry is the only hard dependency between the paths. Everything else on either side can be replaced without the other noticing.',
      },
    },
    L2_snags: [
      {
        q: 'Why separate the two paths at all? Why not just retrain continuously?',
        a: 'Because they have opposite requirements. Training wants huge batches, can tolerate a node dying, and is judged on final quality. Serving wants tiny batches, cannot tolerate a pause, and is judged on the 99th-percentile latency. A system tuned for one is bad at the other.',
      },
      {
        q: 'Is any of this specific to LLMs?',
        a: 'The shape is not. It is standard MLOps, and Feast, Kubeflow and MLflow all predate LLMs. What is specific is the inference side: the model is far too big to fit conventional serving assumptions, and generation is sequential, which is why vLLM and AIBrix exist at all.',
      },
      {
        q: 'Where does the prompt live in this picture?',
        a: 'Nowhere on the training path. A prompt is runtime input, not training data. It enters at the inference path and is gone when the request ends, unless you deliberately log it and feed it back round the loop.',
      },
    ],
    L3_atScale: [
      {
        label: 'Training cadence',
        here: 'never',
        gpt2: 'one-off',
        llama: 'weeks per major version',
        note: 'Fine-tunes and adapters ship far more often than base models, often daily.',
      },
      {
        label: 'Serving latency budget',
        here: 'instant',
        gpt2: ', ',
        llama: '~50-300 ms to first token',
        note: 'Time-to-first-token and tokens-per-second are tracked separately; users feel them differently.',
      },
    ],
    L4_underHood: `The registry seam is what makes the split real. A serving deployment references a model by name and version, not by file path:

\`\`\`
models:/customer-support/3     # resolved at deploy time
\`\`\`

That indirection buys three things. Rollback is a version change, not a rebuild. Two versions can serve side by side for a comparison. And the training side can publish version 4 without touching anything currently serving.`,
    leadsTo: [],
  },

  /* ---------------- Training path ---------------- */

  {
    ...outline({
      id: 'training-path',
      title: 'Training path',
      tag: 'batch · offline',
      color: 'blue',
      order: 0,
      track: 'operations',
      parent: 'operations',
      L0_oneLiner:
        'Turn data into a versioned model artifact, reproducibly, so that the same inputs give the same model, and you can prove which one is running.',
      L0_analogy:
        'A test kitchen with a logbook. The dish matters less than being able to make it again exactly.',
      leadsTo: ['inference-path'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Reproducibility is the actual product.** A model you cannot rebuild is a liability. You cannot debug it, you cannot prove what it was trained on, and you cannot improve it incrementally.',
        '**So every step is recorded.** Which data, which feature definitions, which hyperparameters, which code commit, which metrics came out. That record is what makes the resulting weights trustworthy.',
        '**Three tools, three jobs.** Feast decides what the inputs mean. Kubeflow runs the job across many machines. MLflow records what happened and hands the result over.',
        '**The same path carries very different runs.** Pretraining from scratch, a full fine-tune, and a LoRA adapter all take this route. What changes is which parameters the gradients are allowed to touch, and that single choice moves the hardware requirement by orders of magnitude.',
      ],
      flow: {
        caption: 'Data in, a versioned artifact out, with a record of how.',
        steps: [
          { id: 'raw', label: 'Raw sources', kind: 'input', sub: 'warehouses, streams, files' },
          {
            id: 'feast',
            label: 'Feast',
            kind: 'store',
            sub: 'one definition of each input',
            parts: [
              { id: 'off', label: 'Offline store', sub: 'history, for training', kind: 'store' },
              { id: 'on', label: 'Online store', sub: 'fresh, for serving', kind: 'store' },
            ],
          },
          {
            id: 'kubeflow',
            label: 'Kubeflow',
            kind: 'control',
            sub: 'schedules and runs the pipeline',
            parts: [
              { id: 'prep', label: 'Prep step', sub: 'clean, shard', kind: 'stage' },
              { id: 'train', label: 'Train step', sub: 'many GPUs, many hours', kind: 'stage' },
              { id: 'eval', label: 'Eval step', sub: 'gate before publish', kind: 'stage' },
            ],
          },
          {
            id: 'what',
            label: 'What the run is allowed to change',
            kind: 'control',
            sub: 'the same pipeline serves both, and the choice decides whether this needs a cluster or a single machine',
            parts: [
              { id: 'scratch', label: 'Pretraining', sub: 'every weight, from random, on the whole corpus', kind: 'stage' },
              { id: 'full', label: 'Full fine-tune', sub: 'every weight again, from an existing model', kind: 'stage' },
              { id: 'lora', label: 'LoRA / DoRA adapter', sub: 'base frozen; small low-rank matrices trained beside it', kind: 'stage' },
            ],
          },
          {
            id: 'mlflow',
            label: 'MLflow',
            kind: 'store',
            sub: 'records the run, registers the winner',
          },
          {
            id: 'artifact',
            label: 'Versioned artifact',
            kind: 'output',
            sub: 'either a full checkpoint or an adapter of a few megabytes. The serving side treats these very differently',
          },
        ],
        note: 'Nothing here is real-time. Every box may retry, and a failed step costs money and hours rather than a user-visible error.',
      },
    },
    L2_snags: [
      {
        q: 'Is this where the GPUs are?',
        a: 'Most of them, yes, and this is where the big bills are. But serving needs GPUs too, and at steady state a popular model can burn more GPU-hours answering requests than it did being trained.',
      },
      {
        q: 'Why does an evaluation step come before publishing?',
        a: 'Because "the loss went down" does not mean "this is better for users". The eval step is a gate: benchmark suites, held-out sets, safety checks. If it fails, nothing gets registered and nothing can be deployed.',
      },
      {
        q: 'What makes a training run reproducible in practice?',
        a: 'Pinning four things together: the data snapshot, the feature definitions, the code commit, and the random seed. Miss any one and a rerun gives a different model. Then a change you made cannot be told apart from a different roll of the dice.',
      },
      {
        q: 'Does a small team really need all three tools?',
        a: 'No. The three jobs are always present. Define inputs, run the job, record what happened, but early on they can be a shared SQL file, a shell script and a spreadsheet. The tools earn their place when more than one person needs to answer "which model is in production and what trained it?"',
      },
      {
        q: 'Why did GPUs win training in the first place?',
        a: 'Three things stacked. Their arithmetic units run the same operation across many numbers at once, which is the shape of every matrix multiply. Their memory bandwidth sits about an order of magnitude above a server CPU, and training reads the same weights over and over. And CUDA has had two decades of libraries and compiler work, so the code path is short and the debugger is real.',
      },
    ],
    L3_atScale: [
      {
        label: 'Machines in one job',
        here: '0',
        gpt2: 'tens',
        llama: 'thousands of GPUs',
        note: 'At that size the job is a distributed system in its own right. Node failure is expected, so training checkpoints constantly.',
      },
      { label: 'Wall-clock per run', here: ', ', gpt2: 'days', llama: 'weeks' },
      {
        label: 'What the arithmetic units actually do',
        here: ', ',
        llama: 'the same operation across many values',
        note: 'A matrix multiply is the same multiply-add repeated across every cell. GPUs and TPUs both bet the whole design on that shape, which is why the two beat general-purpose CPUs by orders of magnitude at training.',
      },
    ],
    L4_underHood: `The pipeline is a DAG of containerised steps. Each step declares its inputs and outputs, so the orchestrator can cache: if the prep step's inputs have not changed, its output is reused and the step is skipped.

That caching is why a rerun after a small code change costs minutes rather than days, and it only works because every step is pure with respect to its declared inputs. A step that quietly reads today's date, or the network, breaks the guarantee.`,
    prereqs: [],
  },

  {
    ...outline({
      id: 'feast',
      title: 'Feast',
      tag: 'feature store',
      color: 'blue',
      order: 0,
      track: 'operations',
      parent: 'training-path',
      L0_oneLiner:
        'One definition of every input, served to both training and live inference, so the two can never quietly compute it differently.',
      L0_analogy:
        'One recipe book in the kitchen and the test kitchen. Nobody improvises a different version.',
      related: ['gather-data'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The problem it solves is called training/serving skew.** Training computes "average order value over 30 days" one way, in a batch job. Serving computes it again, in application code, at request time. The two drift apart, and the model is fed inputs that do not match what it learned on.',
        '**The fix is to define it once.** A feature has a single definition. Both sides ask the store for it by name instead of computing it themselves.',
        '**Two stores, one definition.** The offline store holds history and answers "what was this value at this past moment?" for training. The online store holds only the latest value and answers in milliseconds for serving.',
        '**Point-in-time correctness is the hard part.** Training must see the value as it was *at the time of the label*, not as it is now. Otherwise the model learns from the future and looks brilliant until it ships.',
      ],
      flow: {
        caption: 'One definition, two stores, two very different access patterns.',
        steps: [
          { id: 'src', label: 'Sources', kind: 'input', sub: 'warehouse tables, event streams' },
          {
            id: 'def',
            label: 'Feature definition',
            kind: 'control',
            sub: 'written once, versioned in git',
          },
          {
            id: 'stores',
            label: 'Two materialisations',
            kind: 'store',
            sub: 'same definition, different shape',
            parts: [
              {
                id: 'offline',
                label: 'Offline store',
                sub: 'full history · point-in-time joins · slow is fine',
                kind: 'store',
              },
              {
                id: 'online',
                label: 'Online store',
                sub: 'latest value only · single-digit ms',
                kind: 'store',
              },
            ],
          },
          {
            id: 'consumers',
            label: 'Consumers',
            kind: 'output',
            sub: 'training job and live request, asking by name',
          },
        ],
        note: 'The value of the store is negative if only one side uses it. Skew comes back the moment application code recomputes a feature by hand.',
      },
    },
    L2_snags: [
      {
        q: 'Do LLMs even use a feature store? There are no columns, just text.',
        a: 'The base model does not. Everything *around* it often does: which plan a user is on, their recent activity, retrieved documents, whether they have hit a quota. Those get assembled into the prompt, and if training and serving assemble them differently you get exactly the same skew problem.',
      },
      {
        q: 'Why not just query the database at request time and skip this?',
        a: 'You can, and many teams do until it bites. The failure is silent: someone changes the query in the serving path, nobody changes the training path, and quality drifts down over weeks with no error anywhere.',
      },
      {
        q: 'What is point-in-time correctness, concretely?',
        a: 'Suppose you are training on an event from March. The feature "orders in the last 30 days" must be its March value, not today\'s. Joining today\'s value onto a March label leaks the future into training. The model scores brilliantly offline and fails in production.',
      },
    ],
    L3_atScale: [
      {
        label: 'Online lookup budget',
        here: ', ',
        llama: 'single-digit milliseconds',
        note: 'It sits inside the request path, so it competes with the model for the latency budget.',
      },
      {
        label: 'Typical backing stores',
        here: ', ',
        gpt2: ', ',
        llama: 'Redis or DynamoDB online, warehouse offline',
      },
    ],
    L4_underHood: `The signature that matters is the point-in-time join. Hand it an entity plus a timestamp. It returns the value as of that timestamp.

\`\`\`python
store.get_historical_features(
    entity_df=labels, # each row: entity id + event_timestamp
    features=["user:orders_30d", "user:plan_tier"],
)
\`\`\`

Doing this by hand in SQL is an as-of join against every feature table. Getting it subtly wrong is a common cause of models that evaluate well and ship badly.`,
    prereqs: [],
  },

  {
    ...outline({
      id: 'kubeflow',
      title: 'Kubeflow',
      tag: 'orchestration',
      color: 'blue',
      order: 1,
      track: 'operations',
      parent: 'training-path',
      L0_oneLiner:
        'Runs the training job: schedules containerised steps across a cluster, splits the work over many GPUs, and restarts what dies.',
      L0_analogy:
        'A shift manager for machines. It does not cook. It decides who is on which station, and covers when someone walks out.',
      related: ['pretraining'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**A training run is a pipeline, not a script.** Prepare data, build the image, train, evaluate, publish, each a separate containerised step with declared inputs and outputs.',
        '**It starts at the data, not at the GPU.** By the time the scheduler is involved the interesting decisions are already made: how the corpus was cleaned and deduplicated, how it was tokenised and packed, and what format it is sharded into so that hundreds of workers can stream it without fighting over the same files.',
        '**The container is part of the experiment.** The image pins CUDA, the framework built against it, and NCCL. Version skew between nodes does not produce a clean error. It produces a run that hangs on the first collective operation.',
        '**Kubernetes is not the only scheduler.** Kubeflow runs on Kubernetes, which came from the cloud and treats a container as the unit of work. Most academic and national-lab GPU clusters run SLURM instead, which came from HPC and treats a node allocation as the unit. The training code is nearly identical; everything around it differs.',
        '**Declared inputs enable caching.** If a step\'s inputs have not changed since last time, its output is reused and the step is skipped. This is what makes iterating affordable.',
        '**At scale the train step is itself distributed.** The model or the batch is split across GPUs, and they exchange gradients every step. Kubeflow places those workers and keeps them alive.',
        '**Failure is routine, not exceptional.** With thousands of GPUs running for weeks, hardware will fail during the run. The job checkpoints constantly so it can resume rather than restart.',
      ],
      flow: {
        caption:
          'The whole chain, from raw data to a trained artifact. Orchestration is the middle of this story, not the start of it. Most of the work happens before a GPU is touched.',
        steps: [
          {
            id: 'raw',
            label: 'Raw data, in object storage',
            kind: 'input',
            sub: 'S3, GCS or a cluster filesystem. The source of truth nobody trains directly from',
            parts: [
              { id: 'lake', label: 'Landing zone', sub: 'immutable, append-only, dated', kind: 'store' },
              { id: 'ver', label: 'A version, pinned', sub: 'so a run can be repeated exactly', kind: 'store' },
            ],
          },
          {
            id: 'prep',
            label: 'Data preparation',
            kind: 'stage',
            sub: 'the step that consumes most of the calendar, and the one people skip when describing this',
            parts: [
              { id: 'clean', label: 'Clean & dedupe', sub: 'near-duplicate removal materially changes the result', kind: 'stage' },
              { id: 'tok', label: 'Tokenise', sub: 'text becomes token IDs, once, ahead of time', kind: 'stage' },
              { id: 'pack', label: 'Pack into fixed lengths', sub: 'sequences concatenated so no seat is wasted', kind: 'stage' },
              { id: 'shard', label: 'Shard', sub: 'thousands of files so many workers can read in parallel', kind: 'stage' },
            ],
          },
          {
            id: 'fmt',
            label: 'A format built for streaming',
            kind: 'store',
            sub: 'the dataset is far larger than any node\'s disk, so workers stream shards rather than holding a copy',
            parts: [
              { id: 'parquet', label: 'Parquet / Arrow', sub: 'columnar, for tabular and text', kind: 'store' },
              { id: 'wds', label: 'WebDataset-style shards', sub: 'sequential tar reads, kind to network storage', kind: 'store' },
              { id: 'loader', label: 'Streaming loader', sub: 'each worker takes a disjoint slice, deterministically', kind: 'control' },
            ],
          },
          {
            id: 'image',
            label: 'GPU container image',
            kind: 'stage',
            sub: 'built before anything is scheduled, and the single most common reason a run fails in the first minute',
            parts: [
              { id: 'cuda', label: 'CUDA + driver', sub: 'the image\'s CUDA must be compatible with the host driver', kind: 'stage' },
              { id: 'torch', label: 'Framework build', sub: 'PyTorch compiled against that exact CUDA', kind: 'stage' },
              { id: 'nccl', label: 'NCCL', sub: 'the GPU-to-GPU collective library; version skew across nodes deadlocks the run', kind: 'stage' },
              { id: 'pin', label: 'Pinned by digest', sub: 'a tag can move; a digest cannot', kind: 'store' },
            ],
          },
          {
            id: 'sched',
            label: 'Scheduler, Kubernetes or SLURM',
            kind: 'control',
            sub: 'two different worlds solving the same problem. Which one you are on is usually decided by who owns the cluster, not by the model.',
            parts: [
              { id: 'k8s', label: 'Kubeflow on Kubernetes', sub: 'containers first; a PyTorchJob describes the worker group', kind: 'control' },
              { id: 'slurm', label: 'SLURM', sub: 'the HPC default. Sbatch/srun, shared filesystem, allocations in node-hours', kind: 'control' },
              { id: 'gang', label: 'Gang scheduling', sub: 'all workers start together or none do, required by both', kind: 'control' },
              { id: 'cache', label: 'Step cache', sub: 'unchanged inputs reuse last time\'s output', kind: 'store' },
            ],
          },
          {
            id: 'workers',
            label: 'Distributed train step',
            kind: 'stage',
            sub: 'many GPUs acting as one model',
            parts: [
              { id: 'dp', label: 'Data parallel', sub: 'same weights, different batches, gradients averaged', kind: 'stage' },
              { id: 'mp', label: 'Model / tensor parallel', sub: 'one model split across GPUs because it does not fit', kind: 'stage' },
              { id: 'pp', label: 'Pipeline parallel', sub: 'different layers on different nodes', kind: 'stage' },
              { id: 'ckpt', label: 'Checkpoints', sub: 'written constantly, so a dead node costs minutes not weeks', kind: 'store' },
            ],
          },
          {
            id: 'target',
            label: 'What the gradients are allowed to touch',
            kind: 'control',
            sub: 'the same pipeline runs either way. The difference is which parameters are unfrozen, and it changes the cost by orders of magnitude',
            parts: [
              { id: 'full', label: 'Full fine-tune', sub: 'every weight updated; optimiser state dwarfs the model', kind: 'stage' },
              { id: 'lora', label: 'LoRA / DoRA adapter', sub: 'base frozen; two small low-rank matrices per target layer are trained', kind: 'stage' },
              { id: 'why', label: 'Why it matters here', sub: 'no optimiser state for frozen weights. The run fits on far less hardware', kind: 'store' },
            ],
          },
          {
            id: 'out',
            label: 'Artifacts',
            kind: 'output',
            sub: 'a full checkpoint, or an adapter measured in megabytes, plus metrics, handed to the registry',
          },
        ],
        note: 'The GPUs spend a meaningful share of every step talking to each other. Interconnect bandwidth, not raw compute, is often what caps a large run.',
      },
    },
    L2_snags: [
      {
        q: 'Why containers for every step? That seems heavy.',
        a: 'Because reproducibility is the point. A container pins the code *and* its environment, so a run from six months ago can be repeated exactly. A bare script depends on whatever happened to be installed on that machine that day.',
      },
      {
        q: 'What is the difference between data parallel and model parallel?',
        a: 'Data parallel gives every GPU a full copy of the weights and a different slice of the batch, then averages the gradients. Model parallel splits the model itself, because it does not fit on one GPU. Large runs use both at once, plus pipeline parallelism across layers.',
      },
      {
        q: 'Could you just use Airflow or a shell script?',
        a: 'For a small job, yes. What Kubeflow adds is GPU-aware scheduling, gang scheduling (all workers of a distributed job start together or not at all), and native handling of a step that is itself a multi-node job. A shell script gives you none of that.',
      },
      {
        q: 'Kubeflow or SLURM, which one is right?',
        a: 'Usually neither: you use whichever the cluster you have access to already runs. SLURM dominates academic and national-lab HPC, where the machine predates containers and users think in node-hours. Kubernetes dominates cloud, where everything is already a container.\n\nThe model code barely changes between them. What changes is how you request the machines, how the filesystem works, and how you package the environment.',
      },
      {
        q: 'Why is so much of this about data formats? That sounds like plumbing.',
        a: 'Because a large run reads more data than fits on any single machine, so every worker is streaming from shared storage while doing nothing else useful. If the format needs random seeks, or the shards are too few for the number of workers, the GPUs sit idle waiting for bytes. Sharded sequential formats exist entirely so that expensive hardware is not blocked on storage.',
      },
      {
        q: 'Does a LoRA run need all of this too?',
        a: 'The same shape, at a much smaller scale. You still need prepared data, a pinned image and a scheduler. Because the base weights are frozen there is no optimiser state for them, and that is the memory that usually forces a job across many nodes. A LoRA fine-tune that would have needed a cluster often fits on a single machine, so orchestration stops being the hard part.',
      },
    ],
    L3_atScale: [
      {
        label: 'GPUs in one job',
        here: '0',
        gpt2: 'tens',
        llama: 'thousands',
        note: 'Above roughly a thousand, expected node failures per day means checkpointing strategy becomes a first-order design concern.',
      },
      {
        label: 'What limits throughput',
        here: ', ',
        llama: 'interconnect bandwidth',
        note: 'Gradient exchange every step means the network between GPUs frequently matters more than the GPUs.',
      },
    ],
    L4_underHood: `Gang scheduling is the requirement that makes this different from ordinary job scheduling. A distributed training step with 256 workers is useless with 255. They synchronise every step, so a partial placement just holds GPUs idle while waiting for the last one.

So the scheduler must allocate all workers atomically or none. Getting this wrong on a busy cluster produces the classic failure: several large jobs each holding most of what they need, none able to start, all of them waiting.`,
    prereqs: [],
  },

  {
    ...outline({
      id: 'mlflow',
      title: 'MLflow',
      tag: 'registry',
      color: 'blue',
      order: 2,
      track: 'operations',
      parent: 'training-path',
      L0_oneLiner:
        'Records what every run did, and registers the versions worth keeping. This registry is the seam where training hands over to serving.',
      L0_analogy:
        'The logbook plus the shelf. One says what you tried and what happened; the other holds the labelled jars anyone is allowed to take.',
      prereqs: ['kubeflow'],
      leadsTo: ['inference-path'],
      related: ['evaluation'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Tracking and registry are two different jobs.** Tracking records every run. Parameters, metrics, artifacts, code version. Most runs are failures and stay in tracking forever as evidence.',
        '**The registry is the curated shelf.** A run that passes evaluation gets promoted to a named, numbered model version. That name and number are what a deployment references.',
        '**Stages carry the promotion.** A version moves Staging → Production → Archived. Serving asks for "the Production version of customer-support" and gets whatever is currently there.',
        '**That indirection is what makes rollback cheap.** Rolling back is repointing a stage at an earlier version, not rebuilding, not redeploying an image.',
      ],
      flow: {
        caption: 'Many runs, few versions, one pointer that serving actually follows.',
        steps: [
          {
            id: 'runs',
            label: 'Runs',
            kind: 'input',
            sub: 'every attempt, successful or not',
            parts: [
              { id: 'params', label: 'Params', sub: 'lr, batch size, seed', kind: 'store' },
              { id: 'metrics', label: 'Metrics', sub: 'loss, eval scores', kind: 'store' },
              { id: 'arts', label: 'Artifacts', sub: 'weights, plots, configs', kind: 'store' },
            ],
          },
          { id: 'gate', label: 'Evaluation gate', kind: 'control', sub: 'is this actually better?' },
          {
            id: 'reg',
            label: 'Model registry',
            kind: 'store',
            sub: 'named + numbered versions',
            parts: [
              { id: 'stg', label: 'Staging', sub: 'being validated', kind: 'store' },
              { id: 'prod', label: 'Production', sub: 'what serving resolves', kind: 'store' },
            ],
          },
          { id: 'deploy', label: 'Serving reads a stage', kind: 'output', sub: 'models:/name/Production' },
        ],
        note: 'Serving never references a file path. That one indirection is what makes rollback a metadata change instead of a deploy.',
      },
    },
    L2_snags: [
      {
        q: 'Why track runs that failed?',
        a: 'Because "that was already tried and did not work" is expensive knowledge, and without a record a team relearns it every few months. The failures are also what let you tell whether a new result is a real improvement or normal run-to-run variance.',
      },
      {
        q: 'What is actually stored, the weights?',
        a: 'The registry stores metadata and a pointer. The weights themselves live in object storage, because they are far too large for a database. What the registry owns is the mapping from a stable name and version to that blob, plus the record of where it came from.',
      },
      {
        q: 'Does this matter if only one person is training models?',
        a: 'Less, but the failure it prevents is not about team size. It is about six months from now, when something is behaving oddly in production and the only question that matters is "which weights are these, and what were they trained on?"',
      },
    ],
    L3_atScale: [
      {
        label: 'Runs per registered version',
        here: ', ',
        llama: 'dozens to hundreds',
        note: 'Most runs are ablations and failures. The registry is deliberately a much smaller list.',
      },
      {
        label: 'Artifact size',
        here: ', ',
        gpt2: '~0.5 GB',
        llama: '~16 GB at fp16',
        note: 'Which is why the registry stores a pointer, not the bytes.',
      },
    ],
    L4_underHood: `The URI is the whole interface:

\`\`\`python
mlflow.pyfunc.load_model("models:/customer-support/Production")
\`\`\`

Everything the registry buys follows from that string being resolved late:

- **rollback**. Repoint the \`Production\` stage at version 3; nothing redeploys
- **A/B**, two deployments, one on \`/3\` and one on \`/4\`, running side by side
- **audit**. Every version carries the run that produced it, and that run carries the data, code commit and parameters`,
  },

  /* ---------------- Inference path ---------------- */

  {
    ...outline({
      id: 'inference-path',
      title: 'Inference path',
      tag: 'real-time · online',
      color: 'orange',
      order: 1,
      track: 'operations',
      parent: 'operations',
      L0_oneLiner:
        'Turn the frozen artifact into answers, fast enough and cheap enough to serve, which turns out to be a memory problem long before it is a compute problem.',
      L0_analogy:
        'Dinner rush. The recipe is fixed; everything now is about how many covers you can turn without anyone waiting.',
      prereqs: ['mlflow'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Generation is sequential.** One forward pass produces one token. A 500-token answer is 500 passes, each depending on the last, so you cannot simply parallelise your way out.',
        '**Two phases with opposite shapes.** *Prefill* processes the whole prompt at once and is compute-bound. *Decode* produces one token at a time and is memory-bandwidth-bound. Tuning one can hurt the other.',
        '**Which is why batching is everything.** Decoding one sequence leaves the GPU mostly idle waiting on memory. Decoding sixty at once uses the same weight reads for all of them.',
        '**And why memory is the real constraint.** Every sequence in flight holds a cache proportional to its length. The number you can batch is set by how much of that cache fits.',
      ],
      flow: {
        caption:
          'A request through the serving stack. The two middle boxes are the same weights doing genuinely different work, which is why one machine can be fast at one and slow at the other.',
        steps: [
          { id: 'req', label: 'Request', kind: 'input', sub: 'prompt + sampling settings' },
          {
            id: 'control',
            label: 'Control plane',
            kind: 'control',
            sub: 'AIBrix. Picks which replica, scales the fleet, sends adapter traffic where that adapter is loaded',
          },
          {
            id: 'batch',
            label: 'Joined to a running batch',
            kind: 'control',
            sub: 'the request does not get the GPU to itself. It is slotted in alongside whatever else is in flight',
            parts: [
              { id: 'cont', label: 'Continuous batching', sub: 'sequences join and leave mid-flight; no waiting for a batch to fill', kind: 'control' },
              { id: 'share', label: 'Why it is worth it', sub: 'one read of the weights serves every sequence in the batch', kind: 'store' },
            ],
          },
          {
            id: 'prefill',
            label: 'Prefill, the whole prompt, in one pass',
            kind: 'stage',
            sub: 'every prompt token processed together, because they are all already known',
            parts: [
              { id: 'par', label: 'Parallel', sub: 'nothing here depends on a token that does not exist yet', kind: 'stage' },
              { id: 'cb', label: 'Compute-bound', sub: 'a large matrix multiply. The arithmetic units are the limit', kind: 'stage' },
              { id: 'fill', label: 'Fills the KV cache', sub: 'one K and one V entry per prompt token, per layer', kind: 'store' },
              { id: 'ttft', label: 'This is time-to-first-token', sub: 'and it grows with prompt length', kind: 'output' },
            ],
          },
          {
            id: 'kv',
            label: 'KV cache',
            kind: 'store',
            sub: 'the state that makes decode affordable, and the thing that actually runs out',
            parts: [
              { id: 'grow', label: 'Grows every token', sub: 'one more entry per layer, for the whole life of the sequence', kind: 'store' },
              { id: 'cap', label: 'It sets the batch size', sub: 'how many sequences fit at once is a memory question, not a compute one', kind: 'control' },
            ],
          },
          {
            id: 'decode',
            label: 'Decode, one token per pass',
            kind: 'stage',
            sub: 'strictly sequential: each token needs the one before it to exist first',
            parts: [
              { id: 'seq', label: 'Cannot be parallelised', sub: 'a 500-token answer is 500 passes, in order', kind: 'stage' },
              { id: 'mb', label: 'Memory-bandwidth-bound', sub: 'every parameter must be read for each single token produced', kind: 'stage' },
              { id: 'idle', label: 'The arithmetic units mostly wait', sub: 'which is why batching helps decode enormously and prefill barely at all', kind: 'control' },
              { id: 'tps', label: 'This is tokens-per-second', sub: 'the other kind of slow users notice', kind: 'output' },
            ],
          },
          { id: 'stream', label: 'Streamed tokens', kind: 'output', sub: 'sent as they are produced, rather than held until the answer is finished' },
        ],
        loop: 'Decode repeats until a stop token or the length limit, each pass reading the whole KV cache and appending one more entry to it.',
        note: 'Time-to-first-token is dominated by prefill; tokens-per-second by decode. Users experience them as two different kinds of slow, and tuning for one can make the other worse.',
      },
    },
    L2_snags: [
      {
        q: 'Why is answering slower than reading? It is the same model.',
        a: 'Reading the prompt is one pass over all of it at once. Answering is one pass per token, in order, because each token depends on the one before. The prompt can be done in parallel; the answer cannot.',
      },
      {
        q: 'If the GPU is idle during decode, why not just use a smaller GPU?',
        a: 'Because it is idle waiting for *memory*, not for compute. The weights have to be read for every token generated, and that read is the bottleneck. A smaller GPU usually has less bandwidth too, which makes it worse rather than cheaper.',
      },
      {
        q: 'Why does the same prompt sometimes come back at very different speeds?',
        a: 'Almost always batching. Your request shares the GPU with whatever else is in flight; a full batch is more efficient overall but each individual response is slower. Cache hits on a shared prefix also change it dramatically.',
      },
      {
        q: 'Why is one user on one GPU still slow, if the GPU is supposedly fast?',
        a: 'Because decode is memory-bound, not compute-bound. Every generated token reads every weight in the model, and reading them takes about as long whether the arithmetic runs or not. A batch of one leaves the arithmetic units mostly idle. A batch of sixty spreads the same weight read across sixty answers, and throughput climbs with almost no extra latency.',
      },
      {
        q: 'Are people building non-Nvidia silicon for this? Why the slow shift?',
        a: 'Yes, and shipping. Google TPUs, Groq LPUs and Cerebras wafer-scale parts each beat GPUs at some slice of the job. The blocker is software, not silicon: CUDA holds fifteen years of tooling and kernels. Every new stack has to rebuild that ladder before the speedup reaches production.',
      },
    ],
    L3_atScale: [
      {
        label: 'Time to first token',
        here: 'instant',
        llama: '~50-300 ms',
        note: 'Scales with prompt length, because prefill has to process all of it.',
      },
      {
        label: 'Tokens per second',
        here: ', ',
        llama: 'tens per sequence',
        note: 'Aggregate throughput across a full batch is far higher than any single sequence sees.',
      },
    ],
    L4_underHood: `The two phases have genuinely different bottlenecks, which is why some stacks split them onto separate machines:

- **Prefill**. A big matrix multiply over the whole prompt. Compute-bound, scales with prompt length.
- **Decode**, one token at a time. Every parameter must be read from memory for each token, so it is bound by memory bandwidth, and the GPU's arithmetic units sit largely idle.

Batching helps decode enormously and prefill barely at all, because the weight reads are shared across the batch while the arithmetic is not.`,
  },

  {
    ...outline({
      id: 'gpu',
      title: 'GPU & memory',
      tag: 'the hardware',
      color: 'orange',
      order: 0,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Serving is a memory problem before it is a compute problem. The weights must fit in VRAM, and so must every conversation in flight.',
      L0_analogy:
        'The weights are the furniture; the conversations are the people. Both have to fit in the room, and only one of them is a fixed size.',
      related: ['deploy-prep'],
      leadsTo: ['kv-cache'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Start with the weights.** Parameters × bytes-per-parameter. An 8-billion-parameter model at 16-bit precision is about 16 GB before anything else exists.',
        '**Then the KV cache, which is the variable part.** Every token of every active conversation holds an entry. This is what actually decides how many users you can serve at once.',
        '**Then working space.** Activations during a forward pass, plus the framework\'s own overhead. Modest, but not zero.',
        '**Quantization buys headroom.** Storing weights in 8 or 4 bits halves or quarters the fixed cost, freeing that memory for more concurrent conversations. It costs a little quality.',
      ],
      flow: {
        caption: 'What competes for the same VRAM.',
        steps: [
          {
            id: 'vram',
            label: 'GPU memory',
            kind: 'store',
            sub: 'a hard ceiling, e.g. 80 GB',
            parts: [
              { id: 'w', label: 'Weights', sub: 'fixed · ~16 GB for 8B at bf16', kind: 'store' },
              { id: 'kvc', label: 'KV cache', sub: 'grows with users × their length', kind: 'store' },
              { id: 'act', label: 'Activations', sub: 'transient working space', kind: 'store' },
            ],
          },
          {
            id: 'budget',
            label: 'What is left over',
            kind: 'control',
            sub: 'decides how many conversations fit',
          },
          { id: 'through', label: 'Concurrency', kind: 'output', sub: 'and therefore cost per user' },
        ],
        note: 'The weights are paid once no matter how many users you have. The cache is paid per user, per token, which is why long conversations are expensive in a way long prompts alone are not.',
      },
    },
    L2_snags: [
      {
        q: 'Why does the model need to be in memory at all? Can it not stream from disk?',
        a: 'Because every parameter is read for every token generated. Streaming from disk would make each token take seconds instead of milliseconds. Offloading to CPU RAM is possible and is roughly an order of magnitude slower than VRAM.',
      },
      {
        q: 'How do I work out whether a model fits?',
        a: 'Multiply parameters by bytes per parameter: 2 for fp16, 1 for int8, about 0.5 for 4-bit. An 8B model is roughly 16 GB, 8 GB, or 4 GB. Then leave real headroom for the KV cache. A model that only just fits will serve one short conversation.',
      },
      {
        q: 'Is a bigger GPU always the answer?',
        a: 'Not always the cheapest one. Two smaller GPUs can hold the same weights if you split the model across them, but they then have to talk to each other every layer, and that interconnect becomes the new bottleneck.',
      },
      {
        q: 'Why is everyone still on Nvidia if the maths is simple?',
        a: 'The maths is simple; the ladder up to it is not. CUDA is over fifteen years of drivers, kernels and profilers, and PyTorch grew up on top of it. Triton, the compiler most custom inference kernels are written in, targets CUDA first. Ports to other silicon exist and are catching up; the debugging story on other silicon has not, yet.',
      },
      {
        q: 'So what are the real alternatives to a Nvidia GPU?',
        a: 'Three that ship and have primary papers. Google TPUs are systolic arrays built for exactly this matrix shape. Cerebras wafer-scale chips fit a whole model on one piece of silicon, so the inter-chip network vanishes. Groq LPUs are inference-only: weights sit on-chip and tokens stream through a fixed schedule.',
      },
    ],
    L3_atScale: [
      {
        label: 'Weights at 16-bit',
        here: '~1 KB',
        gpt2: '~0.25 GB',
        llama: '~16 GB',
        note: 'Two bytes per parameter: 8 billion × 2 = 16 GB. Llama 3 ships in bfloat16. The toy here has fewer than a thousand parameters.',
        source: SOURCES.llama3Config,
      },
      {
        label: 'Typical serving GPU',
        here: 'none',
        llama: '40-80 GB',
        note: 'Which leaves roughly 60 GB for cache after an 8B model loads. The number that sets concurrency.',
      },
      {
        label: 'TPU (Google)',
        here: 'not used',
        llama: 'systolic array, matrix-shape-first',
        note: 'A dense grid of multiply-and-add units passes data in lockstep, which matches the arithmetic in attention and MLPs almost exactly. Runs on JAX and PyTorch/XLA rather than CUDA.',
        source: SOURCES.tpuPaper,
      },
      {
        label: 'Cerebras wafer-scale',
        here: 'not used',
        llama: 'whole model on one wafer',
        note: 'One giant chip in place of many small ones. The inter-chip network vanishes, so weights and activations stay local. Trade-off is a fixed pool of on-chip memory and a bespoke software stack.',
        source: SOURCES.cerebrasWafer,
      },
      {
        label: 'Groq LPU',
        here: 'not used',
        llama: 'inference-only, deterministic',
        note: 'A design aimed at decode: weights sit on-chip, tokens stream through in a fixed schedule with no runtime scheduler. Very fast per-sequence for models that fit. Not built for training.',
        source: SOURCES.groqLpu,
      },
    ],
    L4_underHood: `The whole capacity question is one inequality:

\`\`\`
weights + (concurrent_sequences × tokens_each × bytes_per_token) + activations  ≤  VRAM
\`\`\`

Only one term on the left is under your control at runtime. Quantization shrinks the first, and that is why it is worth quality loss. Every gigabyte freed becomes cache, and cache is concurrency.`,
  },

  {
    ...outline({
      id: 'kv-cache',
      title: 'KV cache',
      tag: 'paged attention',
      color: 'orange',
      order: 1,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Each generated token would otherwise re-read the whole conversation, so the Keys and Values of earlier tokens are cached. That cache is usually what fills the GPU.',
      L0_analogy:
        'Notes from the meeting so far. Without them every new sentence means rereading the transcript from the top.',
      prereqs: ['gpu'],
      related: ['key', 'value', 'the-loop', 'attention'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Attention needs the Keys and Values of every earlier token.** You met those in the Attention node, each token offers a Key and a Value for others to look at.',
        '**Those never change once computed.** Token 5\'s Key is the same on pass 6 as it was on pass 5, because the causal mask means nothing later can affect it.',
        '**So you cache instead of recomputing.** Without the cache, generating token N re-does the work for all N−1 previous tokens, and generation cost grows with the square of the length.',
        '**The cache is large, and it grows every token.** This is the term that decides how many conversations fit on a GPU, and it is why long contexts are expensive to serve rather than merely slow.',
        '**PagedAttention stores it in fixed-size pages.** One contiguous block per sequence forces you to reserve for the worst case and wastes most of it. Pages let sequences grow as needed and share identical prefixes.',
      ],
      flow: {
        caption: 'One decode step, and what it reads and writes.',
        steps: [
          { id: 'tok', label: 'New token', kind: 'input', sub: 'the one just produced' },
          {
            id: 'fwd',
            label: 'Forward pass',
            kind: 'stage',
            sub: 'computes only this token\'s Q, K, V',
          },
          {
            id: 'cache',
            label: 'KV cache',
            kind: 'store',
            sub: 'read all, append one',
            parts: [
              { id: 'pages', label: 'Fixed-size pages', sub: 'e.g. 16 tokens each', kind: 'store' },
              { id: 'table', label: 'Page table', sub: 'per sequence, like virtual memory', kind: 'control' },
              { id: 'share', label: 'Shared prefixes', sub: 'one copy, many sequences', kind: 'store' },
            ],
          },
          { id: 'next', label: 'Next token', kind: 'output' },
        ],
        loop: 'Every generated token appends one entry per layer and is then read by every token after it.',
        note: 'The cache is per sequence and per layer. Reusing a shared system prompt across users is a genuine memory saving, not just a speed one.',
      },
    },
    L2_snags: [
      {
        q: 'Why cache Keys and Values but not Queries?',
        a: 'Because a Query is only used on the pass that creates it. The current token asks its question once and is done. Keys and Values are what *other*, later tokens read, so they have to stay.',
      },
      {
        q: 'Why is a long conversation more expensive than a long prompt?',
        a: 'A long prompt is prefilled once, efficiently, in a single pass. A long conversation means the cache is held for the whole session and re-read on every single generated token. You pay for it continuously rather than once.',
      },
      {
        q: 'What actually goes wrong without paging?',
        a: 'You must reserve a contiguous block sized for the longest answer the sequence *might* produce. Most answers are far shorter, so most of the reservation sits unused and unusable by anyone else. Reported waste in that scheme runs to the majority of the cache.',
      },
      {
        q: 'What happens when the cache fills up?',
        a: 'The scheduler stops admitting new sequences, and may evict or swap out running ones, recomputing them later. From outside it looks like queueing: your request waits rather than failing.',
      },
    ],
    L3_atScale: [
      {
        label: 'Cache per token',
        here: 'negligible',
        llama: '128 KiB',
        note: 'Llama-3-8B: 2 (K and V) × 32 layers × 8 KV heads × 128 dims × 2 bytes = 131,072 bytes per token. Every term comes from the model config; a test recomputes it.',
        source: SOURCES.llama3Config,
      },
      {
        label: 'A full context, one sequence',
        here: ', ',
        llama: 'exactly 1 GiB at 8,192',
        // Corrected 2026-08-05. This previously said "a full 128k context ≈
        // 16 GB" and attributed 128k to Llama 3, that is Llama 3.1's context.
        note: '8,192 × 131,072 bytes is exactly 1 GiB. At Llama 3.1\'s 128,000 tokens the same arithmetic gives about 15.6 GiB, roughly the size of the weights themselves, for a single user. That is why long context is expensive rather than merely slow.',
        source: SOURCES.llama31Announcement,
      },
      {
        label: 'Why grouped-query attention exists',
        here: ', ',
        gpt2: 'every head has its own K/V',
        llama: '8 KV heads shared by 32 query heads',
        note: 'Without sharing, the cache would use 32 KV heads instead of 8, four times larger. Meta states GQA was adopted on both 8B and 70B specifically for inference efficiency.',
        source: SOURCES.llama3Announcement,
      },
    ],
    L4_underHood: `The per-token cost is worth being able to derive. Here it is written out.

\`\`\`
bytes_per_token = 2 (K and V) × layers × kv_heads × head_dim × bytes_per_value
                = 2 × 32 × 8 × 128 × 2     # Llama-3-8B at fp16
                = 131,072                  # 128 KB
\`\`\`

Paging borrows directly from operating-system virtual memory. Each sequence gets a page table. It maps logical token positions to physical blocks. Blocks need not be contiguous. Two sequences sharing a prefix can point at the same physical blocks with a reference count.

That sharing is why a long shared system prompt is nearly free for the second user onward. It is why prefix-cache-aware routing is a real optimisation. That routing sends a request to the replica that already holds its prefix.`,
  },

  {
    ...outline({
      id: 'vllm',
      title: 'vLLM',
      tag: 'the engine',
      color: 'orange',
      order: 2,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'The inference engine: it runs the actual forward passes, decides which requests share each batch, and manages the KV cache in pages.',
      L0_analogy:
        'The line cook. It does not decide the menu or hire anyone. It turns tickets into plates as fast as the station allows.',
      prereqs: ['kv-cache'],
      related: ['attention', 'deploy-prep'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Continuous batching is the central idea.** Naive batching waits for every sequence in a batch to finish before starting the next. Since answers vary from five tokens to five hundred, most of the batch sits idle waiting for the longest one.',
        '**Instead, sequences join and leave every step.** A finished sequence is evicted immediately and a queued one takes its slot on the very next token. The GPU stays full.',
        '**PagedAttention makes that possible.** You cannot swap sequences in and out cheaply if each needs one big contiguous reservation. Pages make admission and eviction a page-table edit.',
        '**Everything else is scheduling policy.** How much prefill to interleave with decode, when to preempt, how far to let the queue grow before rejecting.',
      ],
      flow: {
        caption: 'One engine step: the batch is rebuilt every single token.',
        steps: [
          { id: 'q', label: 'Waiting queue', kind: 'input', sub: 'new requests' },
          {
            id: 'sched',
            label: 'Scheduler',
            kind: 'control',
            sub: 'rebuilds the batch every step',
            parts: [
              { id: 'admit', label: 'Admit', sub: 'if cache pages are free', kind: 'control' },
              { id: 'preempt', label: 'Preempt', sub: 'evict or swap under pressure', kind: 'control' },
              { id: 'mix', label: 'Mix prefill + decode', sub: 'keeps both units busy', kind: 'control' },
            ],
          },
          { id: 'step', label: 'One forward pass', kind: 'stage', sub: 'the whole batch together' },
          { id: 'emit', label: 'One token each', kind: 'output', sub: 'streamed as produced' },
        ],
        loop: 'Repeat per token. Finished sequences leave and queued ones join at every iteration, not at batch boundaries.',
        note: 'This is why aggregate throughput can be many times a naive server\'s while any single response is no faster.',
      },
    },
    L2_snags: [
      {
        q: 'Is vLLM a different model?',
        a: 'No, it runs the same weights. It is the runtime around the model: memory management, batching, scheduling. Swapping engines changes throughput and cost, not what the model says.',
      },
      {
        q: 'If batching helps so much, why not batch everything?',
        a: 'Because a bigger batch needs more KV cache, and cache is the scarce resource. Push it too far and you either run out of memory or start preempting sequences, which costs more than the batching saved.',
      },
      {
        q: 'Why interleave prefill with decode rather than doing them separately?',
        a: 'They stress different parts of the hardware. Prefill is compute-bound, decode is memory-bandwidth-bound. Mixing them in one step keeps both busy. Some large deployments go the other way and split them onto separate machines entirely.',
      },
    ],
    L3_atScale: [
      {
        label: 'Throughput vs naive serving',
        here: ', ',
        llama: 'several times higher',
        note: 'Almost entirely from continuous batching plus recovered cache waste, not from faster arithmetic.',
      },
      {
        label: 'Page size',
        here: ', ',
        llama: 'commonly 16 tokens',
        note: 'Smaller pages waste less on the last partial page but make the page table bigger.',
      },
    ],
    L4_underHood: `The scheduler loop is the whole engine. Read it once and the rest of vLLM falls out. Here it is with nothing removed.

\`\`\`
while running:
    batch = scheduler.build()      # admit, preempt, mix prefill and decode
    logits = model.forward(batch)  # one pass, whole batch
    tokens = sample(logits)
    for seq in batch:
        seq.append(token); cache.append_page_if_needed(seq)
        if seq.finished(): scheduler.release(seq)   # frees pages immediately
\`\`\`

Note where the batch is constructed. Inside the loop, not outside it. That single structural choice is what "continuous batching" means. It is also why the pages have to be cheap to allocate and release.`,
  },

  {
    ...outline({
      id: 'aibrix',
      title: 'AIBrix',
      tag: 'the control plane',
      color: 'orange',
      order: 3,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Wraps a fleet of vLLM replicas: routes each request to the right one, scales the fleet on the signals that actually matter, and manages adapters and cache across machines.',
      L0_analogy:
        'The maître d\' over a room of line cooks. It does not cook. It decides which station gets which ticket, and when to open another.',
      prereqs: ['vllm'],
      related: ['lora-dora'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One engine is not a service.** vLLM serves a model on a machine. A service needs many replicas, a way to pick between them, a way to grow and shrink, and a way to serve many fine-tuned variants without paying for a fleet each.',
        '**Routing is not round-robin.** The best replica is usually the one that already holds your conversation\'s prefix in its KV cache, or already has your adapter loaded. Prefix-aware and adapter-aware routing turn a cold start into a cache hit.',
        '**Autoscaling on CPU is wrong here.** GPU serving saturates on cache occupancy and queue depth long before CPU means anything. Scaling on the wrong signal adds replicas too late and removes them too early.',
        '**Adapters make one base model serve many products.** LoRA adapters are small. Keeping one base model resident and swapping adapters per request is dramatically cheaper than a full deployment per variant.',
        '**Distributed cache spreads the expensive part.** KV cache is the scarce resource; letting replicas share a pool rather than each hoarding its own raises how much of the fleet is usable.',
      ],
      flow: {
        caption: 'What sits between a request and the engines, and why it is not just a load balancer.',
        steps: [
          { id: 'in', label: 'Request', kind: 'input', sub: 'prompt · model name · adapter' },
          {
            id: 'gw',
            label: 'Gateway / router',
            kind: 'control',
            sub: 'picks a replica on purpose',
            parts: [
              { id: 'prefix', label: 'Prefix-aware', sub: 'send it where the cache already is', kind: 'control' },
              { id: 'lora', label: 'Adapter-aware', sub: 'send it where the LoRA is loaded', kind: 'control' },
              { id: 'load', label: 'Load-aware', sub: 'queue depth, not CPU', kind: 'control' },
            ],
          },
          {
            id: 'fleet',
            label: 'vLLM replicas',
            kind: 'stage',
            sub: 'one base model, many adapters',
            parts: [
              { id: 'base', label: 'Base weights', sub: 'resident, shared', kind: 'store' },
              { id: 'ad', label: 'LoRA adapters', sub: 'small, hot-swapped', kind: 'store' },
            ],
          },
          {
            id: 'kvpool',
            label: 'Distributed KV cache',
            kind: 'store',
            sub: 'shared across the fleet',
          },
          { id: 'out', label: 'Streamed response', kind: 'output' },
        ],
        loop: 'The autoscaler watches queue depth and cache pressure and changes the replica count under all of this.',
        note: 'Every decision here is about not recomputing something that already exists somewhere in the fleet.',
      },
    },
    L2_snags: [
      {
        q: 'Why not just put a normal load balancer in front of vLLM?',
        a: 'Because a normal load balancer treats replicas as interchangeable, and here they are not. One of them may already hold your conversation\'s KV cache or your adapter; the others would have to rebuild that from scratch. Round-robin actively destroys the cache locality that makes serving affordable.',
      },
      {
        q: 'What is the relationship between AIBrix and vLLM, does one replace the other?',
        a: 'Neither. AIBrix orchestrates vLLM, not the reverse. vLLM runs the model on one machine; AIBrix decides how many machines there are and which one your request goes to. You can run vLLM alone; you would then be building the routing and scaling yourself.',
      },
      {
        q: 'Why is autoscaling on GPU utilisation not good enough?',
        a: 'GPU utilisation can look healthy while the KV cache is nearly full and the queue is growing. The GPU is busy right up until it starts refusing work. Cache occupancy and queue depth turn upward earlier, which is what you need if adding a replica takes minutes to become useful.',
      },
      {
        q: 'How can one deployment serve many fine-tuned models?',
        a: 'Because a LoRA adapter is a small patch alongside the base weights rather than a whole new model. The base stays resident and shared; adapters are loaded per request. That is why routing wants to know which adapter you need. It would rather send you where it is already loaded.',
      },
      {
        q: 'Is this over-engineering for one model and a bit of traffic?',
        a: 'For a single replica, yes, run vLLM directly. This layer earns its place when you have more than one replica, more than one variant, or traffic uneven enough that a fixed replica count is either wasteful or too slow.',
      },
    ],
    L3_atScale: [
      {
        label: 'Replicas coordinated',
        here: '0',
        llama: 'tens to hundreds',
        note: 'The routing decision matters more the larger the fleet, because the chance some replica already has your prefix rises with it.',
      },
      {
        label: 'Adapters per base model',
        here: ', ',
        llama: 'many, hot-swapped',
        note: 'A LoRA adapter is a small fraction of the base model\'s size, so the marginal cost of another variant is close to nothing.',
      },
      {
        label: 'Scaling signal',
        here: ', ',
        llama: 'queue depth + cache occupancy',
        note: 'CPU utilisation is close to meaningless for GPU inference.',
      },
    ],
    L4_underHood: `Control plane and data plane is the distinction that makes this make sense.

- **Data plane**, vLLM. Holds the weights, runs the forward passes, owns its local KV cache. One process, one machine.
- **Control plane**, AIBrix. Holds no weights and runs no forward passes. It owns the *decisions*: how many replicas exist, which one a request goes to, which adapters are loaded where, how cache is shared.

The reason to separate them is that the two change on completely different timescales. The data plane changes when the model changes, perhaps monthly. The control plane changes on every request. Fusing them would mean redeploying your model to change a routing rule.`,
  },

  {
    ...outline({
      id: 'agent-layer',
      title: 'Agent layer',
      tag: 'above the model',
      color: 'orange',
      order: 4,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'A loop around the model that lets it take actions and see the results. "An agent" is not a model. It is a model plus tools, memory and a loop that keeps going until the goal is met.',
      L0_analogy:
        'The model is a very well-read colleague locked in a room with no phone. The agent layer is the phone, the filing cabinet, and someone who keeps asking "and then what?"',
      prereqs: ['aibrix'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The model alone can only produce text.** It cannot read a file, call an API or remember yesterday. Everything an agent appears to *do* is done by the layer around it.',
        '**Tools are the hands.** The model is given a list of functions it may call, each with a name, a description and a parameter schema. Instead of answering, it can emit a structured request to call one. The loop, not the model, executes it.',
        '**MCP is a standard plug for tools.** Rather than hand-writing an integration per service, an MCP server exposes its tools in a common shape and any compatible agent can use them. It is the connector standard, not a capability of its own.',
        '**Memory is what survives the request.** The model is stateless. Every call is fresh, and the conversation is only "remembered" because the whole transcript is resent. Anything longer-lived is a store the agent reads from and writes to deliberately.',
        '**The loop is what makes it an agent.** Call the model, execute any tool it asked for, feed the result back, call again. Repeat until it stops asking or a limit is hit. Remove the loop and you have a chatbot.',
      ],
      flow: {
        caption: 'What people actually mean by "an agent", the model is one box of four.',
        steps: [
          { id: 'goal', label: 'Goal', kind: 'input', sub: 'from a user, a schedule, or an event' },
          {
            id: 'agent',
            label: 'The agent',
            kind: 'control',
            sub: 'the loop, and everything it holds',
            parts: [
              { id: 'model', label: 'Model', sub: 'decides the next action', kind: 'stage' },
              { id: 'tools', label: 'Tools', sub: 'name + description + schema', kind: 'control' },
              { id: 'mcp', label: 'MCP servers', sub: 'a standard plug for tools', kind: 'control' },
              { id: 'mem', label: 'Memory', sub: 'transcript now, store across sessions', kind: 'store' },
            ],
          },
          {
            id: 'exec',
            label: 'Execute the tool',
            kind: 'stage',
            sub: 'the loop runs it, not the model',
          },
          { id: 'obs', label: 'Result observed', kind: 'input', sub: 'appended and fed back in' },
          { id: 'done', label: 'Answer or action', kind: 'output', sub: 'when it stops asking' },
        ],
        loop: 'Model → tool call → execute → observe → model again, until it answers or a step limit is reached.',
        note: 'The model never touches anything itself. It only ever emits text. Some of which the loop agrees to interpret as a request to act. Every guardrail lives in the loop, and that is the only place it can live.',
      },
    },
    L2_snags: [
      {
        q: 'So what actually IS an agent? The word gets used for everything.',
        a: 'Concretely: a model, a set of tools it may call, somewhere to keep state, and a loop that repeats until the goal is met. Drop the loop and it is a chatbot. Drop the tools and it is a text generator. The word describes the assembly, not any one part.',
      },
      {
        q: 'Does the model actually run the tools?',
        a: 'No, and this is the most important thing to be clear about. The model emits a structured request, a name and some arguments. Your code decides whether to run it, runs it, and hands back the result. Every permission check and every safety gate lives there, because that is the only place that can enforce anything.',
      },
      {
        q: 'What is MCP, in one sentence?',
        a: 'A standard way for a tool provider to describe and expose its tools, so any compatible agent can use them without a bespoke integration. Think of it as a plug shape. It does not add capability. It removes the N times M problem of every agent integrating every service separately.',
      },
      {
        q: 'How does an agent "remember" anything if the model is stateless?',
        a: 'Two different mechanisms that get confused.\n\nWithin a conversation, nothing is remembered. The entire transcript is resent every call, which is why long conversations cost more.\n\nAcross sessions, the agent writes to an actual store and reads it back into the prompt later. The second is a feature someone built; the first is just resending.',
      },
      {
        q: 'Why do agents go in circles or get stuck?',
        a: 'Because each step is chosen from what is in the context right now, with no plan the loop enforces. A failed tool call gets fed back, the model tries something similar, and it can loop. Real systems bound it: a step limit, a token budget, and often a separate check on whether progress is being made.',
      },
      {
        q: 'Is the agent layer part of the model, or a separate thing I build?',
        a: 'Separate, and usually yours. Frameworks give you the loop and the plumbing. Bedrock AgentCore, Foundry Agent Service, LangGraph, but the tools, the permissions and the definition of "done" are application code. The model is a component of your agent, not the other way round.',
      },
    ],
    L3_atScale: [
      {
        label: 'Model calls per goal',
        here: ', ',
        llama: 'one per loop step',
        note: 'A ten-step task is ten calls, each resending a transcript that has grown. Cost climbs faster than step count.',
      },
      {
        label: 'What bounds a run',
        here: ', ',
        llama: 'step limit, token budget, wall clock',
        note: 'Without a bound an agent can loop indefinitely on a task it cannot complete.',
      },
      {
        label: 'Where permissions live',
        here: ', ',
        llama: 'entirely in the loop',
        note: 'A tool the loop will not execute cannot be called, whatever the model emits. Prompt instructions are not a security boundary.',
      },
    ],
    L4_underHood: `The whole loop, with nothing removed.

\`\`\`python
messages = [{"role": "user", "content": goal}]

while steps < limit:
    reply = model(messages, tools=tools)   # May ask to call a tool.
    messages.append(reply)

    if not reply.tool_calls:
        return reply                       # It answered. Done.

    for call in reply.tool_calls:
        if not allowed(call):              # YOUR gate. Not the model's.
            result = "denied"
        else:
            result = tools[call.name](**call.args)
        messages.append(tool_result(call.id, result))
\`\`\`

Three things are worth reading off it.

- \`messages\` grows every iteration and is resent in full. That is why **cost grows faster than step count**.
- \`allowed(call)\` is the only real security boundary. A system prompt saying "never delete files" is a preference. This line is enforcement.
- The model's entire influence is choosing what to put in \`tool_calls\`. Everything else happens on the line after.`,
  },

  {
    ...outline({
      id: 'monitoring',
      title: 'Monitoring',
      tag: 'the feedback loop',
      color: 'orange',
      order: 8,
      track: 'operations',
      parent: 'inference-path',
      L0_oneLiner:
        'Latency, cost per token, cache hit rate, refusals and quality drift, and the path by which what production sees becomes the next training run.',
      L0_analogy:
        'Comment cards that actually reach the kitchen, instead of dying at the front desk.',
      prereqs: ['agent-layer'],
      leadsTo: ['continual'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Systems metrics are the easy half.** Time to first token, tokens per second, queue depth, cache hit rate, GPU memory, cost per thousand tokens. Conventional monitoring handles all of these.',
        '**Quality is the hard half, and it fails silently.** A model that starts giving worse answers throws no errors and changes no dashboard. Nothing goes red.',
        '**So quality has to be measured deliberately.** Sampled outputs scored by a rubric or another model, refusal and fallback rates, user signals like retries, edits and thumbs-down.',
        '**Drift is usually in the input, not the model.** The weights are frozen. What changes is what people ask, which slowly moves away from what the model was tuned on.',
        '**The loop only closes if the findings become data.** Logged failures, curated and labelled, are what the next fine-tune trains on. Without that step this is a dashboard, not a feedback loop.',
      ],
      flow: {
        caption: 'From production behaviour back to the next version.',
        steps: [
          { id: 'traffic', label: 'Live traffic', kind: 'input', sub: 'requests and responses' },
          {
            id: 'signals',
            label: 'Signals',
            kind: 'store',
            sub: 'two kinds, measured differently',
            parts: [
              { id: 'sys', label: 'Systems', sub: 'latency, cost, cache, errors', kind: 'store' },
              { id: 'qual', label: 'Quality', sub: 'sampled scoring, refusals', kind: 'store' },
              { id: 'user', label: 'User signals', sub: 'retries, edits, ratings', kind: 'store' },
            ],
          },
          { id: 'alert', label: 'Alerts & dashboards', kind: 'control', sub: 'for the fixable now' },
          {
            id: 'curate',
            label: 'Curated failure set',
            kind: 'stage',
            sub: 'the step that closes the loop',
          },
          { id: 'next', label: 'Next training run', kind: 'output', sub: 'continual improvement' },
        ],
        loop: 'This is the arrow that makes the whole map a cycle rather than a pipeline.',
        note: 'Skip the curation step and you have observability without improvement. You will know things got worse, and have nothing to train on.',
      },
    },
    L2_snags: [
      {
        q: 'How can quality drop if the weights never change?',
        a: 'Because the questions change. New products, new slang, new events the model has never seen. The model is exactly as good as it was; the world moved. This is why the fix is usually more recent data rather than a bigger model.',
      },
      {
        q: 'How do you measure quality without a human reading everything?',
        a: 'Sample rather than read everything, and combine cheap proxies with expensive ones. Automatic checks for format and safety, a model scoring against a rubric, and a small human-reviewed set to keep the automatic scorers honest. The human set is small, but it is not optional. It calibrates the rest.',
      },
      {
        q: 'What should actually page someone at 3am?',
        a: 'Systems failures. The queue growing without bound, errors, cache exhaustion. Quality drift is a slow trend, not an incident; paging on it produces noise and trains people to ignore the pager. Review it on a cadence instead.',
      },
      {
        q: 'Is logging prompts and responses safe?',
        a: 'Only with deliberate handling. Prompts routinely contain personal or confidential information users did not think of as being stored. Retention limits, redaction and access control belong in the design of this box, not bolted on after the first incident.',
      },
    ],
    L3_atScale: [
      {
        label: 'Systems metrics',
        here: ', ',
        llama: 'per-request, always on',
        note: 'Cheap enough to measure everything.',
      },
      {
        label: 'Quality evaluation',
        here: ', ',
        llama: 'sampled, continuous',
        note: 'Scoring every response with another model roughly doubles the cost of serving.',
      },
    ],
    L4_underHood: `Two independent things get called drift, and separating them decides the fix.

- **Input drift**. The distribution of what people ask has moved. Detectable without any labels, by comparing today's request embeddings to the training distribution.
- **Quality drift**, the outputs got worse. Needs labels or judgements; cannot be inferred from inputs alone.

Input drift is the leading indicator, and usually the cause. Catching it early is the difference between "the questions changed" spotted in a dashboard, and "the answers were wrong" spotted by a customer.`,
  },
];
