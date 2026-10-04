/** Content vocabularies for the ForgeNet demo dataset. All original text. */

export const TAGS = [
  "AI", "MachineLearning", "NLP", "ComputerVision", "Robotics", "OpenSource", "React",
  "Python", "Rust", "Go", "TypeScript", "DistributedSystems", "RAG", "LLM", "DevOps",
  "CyberSecurity", "Cloud", "Databases", "SystemDesign", "DevTools", "Research",
  "Performance", "Testing", "Accessibility", "Observability",
];

export const POST_TOPICS = [
  { tag: "AI", title: "Retrieval quality is not the whole story in RAG" },
  { tag: "LLM", title: "Structured decoding in practice" },
  { tag: "MachineLearning", title: "What actually improved our model latency" },
  { tag: "NLP", title: "Tokenization choices that quietly cost accuracy" },
  { tag: "SystemDesign", title: "Backpressure is a design decision, not an afterthought" },
  { tag: "DistributedSystems", title: "Why we moved off a single-writer log" },
  { tag: "Databases", title: "Index bloat after a year of high-churn writes" },
  { tag: "Performance", title: "Profiling before optimising: a checklist" },
  { tag: "React", title: "Server components changed how we think about data fetching" },
  { tag: "TypeScript", title: "Making illegal states unrepresentable in the type layer" },
  { tag: "OpenSource", title: "Maintaining an open source project without burning out" },
  { tag: "CyberSecurity", title: "Threat modelling a multi-tenant data platform" },
  { tag: "DevOps", title: "Deploy freezes that actually reduce incidents" },
  { tag: "Research", title: "Reproducibility in applied ML papers" },
  { tag: "Observability", title: "Traces vs metrics: when each one tells the truth" },
  { tag: "Testing", title: "Testing distributed systems without flakiness" },
  { tag: "Accessibility", title: "Keyboard navigation is a bigger win than it looks" },
  { tag: "Cloud", title: "Egress costs quietly dominate our bill" },
  { tag: "ComputerVision", title: "Data augmentation that survives contact with reality" },
  { tag: "Robotics", title: "Simulation to real: closing the gap" },
  { tag: "DevTools", title: "Internal tooling that people actually use" },
];

// Deliberately varied voices: terse, technical, questions, opinions, launches,
// debugging write-ups. Nothing reads like marketing filler.
export const POST_BODIES = {
  statement: [
    "Spent three weeks convinced this was a modelling problem. It was a data pipeline problem the whole time.\n\nThe giveaway was that offline accuracy looked fine and online accuracy collapsed for exactly one slice of users. Once we traced it, the fix was about four lines.",
    "Hot take: most latency problems are not compute problems. They are serialisation, connection pools, and N+1 queries wearing a trench coat.",
    "We deleted roughly 40% of our configuration surface this quarter. Nothing broke. Two things got faster. The on-call rotation noticed within a week.",
    "The interesting part of this work is not the model. It is the eleven months of infrastructure that made the experiment possible, and that nobody will write a paper about.",
    "Our p50 is fine and our p99 is not. That gap turned out to be entirely GC pauses plus one connection pool that was sized by vibes.",
    "Small thing that mattered more than expected: putting the failure state in the UI copy. Support tickets dropped by roughly a third. That is not a model improvement, it is a wording improvement, and it shipped in a day.",
  ],
  question: [
    "How are you evaluating RAG systems beyond retrieval accuracy? Our hit rate looks good and the answers still disappoint me. Curious what other people measure.",
    "What is your preferred strategy for breaking API changes? Versioning in the path, in the header, or a completely separate hostname. We are about to do this badly and would rather not.",
    "How are you handling backpressure in your current architecture? Interested in patterns that survive a traffic spike rather than a planned load test.",
    "What does your team do when a model regression is ambiguous? We have three metrics that disagree and no agreed tiebreaker.",
    "Anyone else find that the hardest part of MLOps is not the deployment but deciding what to roll back to?",
    "How do you keep internal tooling alive long enough to be useful? Ours works, nobody trusts it, so usage is low, so it rots.",
  ],
  technical: [
    "Ran the ablation nobody wanted to run. Removing the second retrieval pass cut p95 by 180ms and changed answer quality by less than the variance between runs.\n\nConclusions: the extra pass was buying noise. Keeping it because it felt thorough was the actual bug.",
    "Implementation notes on moving from a single writer to a partitioned log:\n\n- Partition key choice dominates everything downstream\n- Consumer lag is the only metric that predicts incidents\n- We underestimated how much tooling assumed a single writer\n\nHappy to expand on any of these.",
    "Details on the tokenizer change:\n\nWe moved to byte-level BPE with a smaller vocabulary. Token count dropped ~18%. Perplexity was flat. Throughput improved 31% because we stopped blowing past the context limit on longer documents.",
    "The failure we spent the most time on was not exotic. It was a connection pool sized at 5 under a retry policy with exponential backoff. Under load, retries multiplied into saturation.\n\nNow: pool sized to worker count, jittered backoff, and a circuit breaker.",
    "Notes from profiling a batch inference service:\n\n1. Serialisation dominated. Switching to a columnar format cut CPU by 2.4x.\n2. GPU memory fragmentation was 15% overhead, invisible until utilisation was measured.\n3. Batching helped far less than expected because the queue was already saturated.",
    "Wrote up the migration from REST to gRPC for internal traffic. Not because gRPC is better, but because generated stubs removed an entire class of contract bugs.\n\nLatency was a wash. Correctness improved more than I expected.",
  ],
  debugging: [
    "Three days of intermittent 500s. Root cause was a timezone assumption in a date partition key that only broke in the DST window, and only for one shard.\n\nLessons: pin timezones in storage, add a canary that crosses a partition boundary, and log the computed key, not just the inputs.",
    "Cache stampede hit us after a deploy removed a single hot key from the response. 40x origin traffic in under a minute.\n\nAdded request coalescing and jittered TTLs. Should have had both from the start.",
    "Mystery solved: memory leak was not a leak. It was an unbounded metric cardinality explosion. One label had 200k distinct values because we included a request ID.",
    "The bug was a race between the retry logic and the circuit breaker. Both were correct individually. Together they oscillated.\n\nFixed by making the breaker state machine explicit rather than a boolean.",
  ],
  launch: [
    "Shipped it. Open source, self-hostable, no telemetry.\n\nIt started as an internal tool because we kept rewriting the same script. Feedback very welcome, especially on the failure modes.",
    "Released v2. The headline change is a plugin API, but the real work was making the core boring enough that plugins could exist.\n\nMigration notes and the full changelog are in the repo.",
    "Published the benchmark suite we use internally. Fair warning: it is opinionated about batching, and we expect disagreement.",
  ],
  opinion: [
    "Unpopular opinion: most teams should not be fine-tuning anything yet. They should be fixing their retrieval, their data, and their evaluation. Fine-tuning will not save a bad pipeline.",
    "I do not think 'we need Kubernetes' is an engineering conclusion. It is usually a symptom of a team that has not agreed on what it is running.",
    "Documentation is not a separate task. If your docs need their own sprint, the problem is that the code does not explain itself.",
    "Strong belief: an engineer who cannot explain a system's failure modes does not yet understand the system. Documentation is a side effect of that understanding.",
  ],
};

export const POST_TYPES = ["statement", "question", "technical", "debugging", "launch", "opinion"];

export const PROJECT_NAMES = [
  "NeuralSearch", "VectorForge", "TinyTransformer", "CodeAtlas", "VisionFlow", "AgentMesh",
  "PaperLens", "ModelBench", "OpenCompute", "GraphRAG", "StreamForge", "SecureAuth",
  "TensorServe", "DevPulse", "ResearchHub", "PromptSmith", "EvalKit", "LatencyLab", "TraceWeave",
  "SchemaDrift", "QueueForge", "CacheMesh", "GuardRailKit", "Docstringer", "RefactorBot",
  "TokenVault", "BatchRunner", "QueryPilot", "IndexTuner", "LogTide", "ProtoSync",
  "WebhookHarbor", "RateLimiterPro", "FeatureStoreLite", "ModelGarden", "PromptBench",
  "SandboxKit", "MetricWeaver", "DataLineage", "CostLens", "RetryStorm", "GraphRAGLite",
  "PolicyEngine", "SecretlessCI", "PreviewEnvironments", "TailLatencyLab", "SchemaMesh",
];

export const PROJECT_DESCRIPTIONS = [
  "A retrieval layer with hybrid search, reranking, and evaluation built in from the start.",
  "Self-hostable model serving with batching, quantisation, and predictable tail latency.",
  "A small transformer implementation written for clarity, with every layer documented.",
  "Turns a repository into a navigable map of components, dependencies, and ownership.",
  "Computer vision pipelines for streaming video with backpressure-aware decoding.",
  "An agent runtime with structured tool use, tracing, and replayable traces.",
  "A reading tool for research papers that keeps annotations attached to the source.",
  "Reproducible benchmarking across models, tasks, and hardware, with cost tracking.",
  "Scheduling primitives for heterogeneous compute, written for boring reliability.",
  "Graph-based retrieval for questions that span more than one document.",
  "Exactly-once delivery for event pipelines, with a replayable dead-letter queue.",
  "Authentication primitives with passkeys, rotation, and audit trails included.",
  "A tensor library with lazy evaluation and readable kernels.",
  "Internal developer tooling: one place to see CI, deploys, and incidents.",
  "A research dashboard that keeps experiments, code, and results in one place.",
  "Prompt versioning with diffs, evals, and rollback built in.",
  "A minimal evaluation harness that treats every metric as a first-class citizen.",
  "Latency and throughput profiling for services that have to behave under load.",
  "Distributed tracing that survives cross-service retries.",
  "Schema migration tooling that refuses to run without a tested rollback.",
  "A queue with predictable ordering and no surprises on redelivery.",
  "A caching layer with stampede protection as the default, not an option.",
  "Guardrails and policy checks for model outputs, with an audit log.",
  "Keeps docstrings in sync with the code they describe.",
  "Automated refactoring with a preview before anything is applied.",
  "Secret storage with short-lived credentials and usage audit.",
  "A batching runner for offline inference that actually saturates the GPU.",
  "Interactive query analysis with cost estimates before you run anything.",
  "Index tuning recommendations grounded in real query statistics.",
  "Structured log processing with sane defaults.",
  "Protobuf schema compatibility checks in CI.",
  "A webhook gateway with signature verification and replay protection.",
  "Rate limiting with distributed counters and predictable behaviour.",
  "A minimal feature store for teams that do not need a platform team.",
  "Model and dataset registry with lineage.",
  "Benchmark harness for prompt strategies.",
  "Sandboxing untrusted code with tight resource limits.",
  "Metrics with sane aggregation defaults.",
  "Column-level lineage for data pipelines.",
  "Cloud cost attribution down to the team and the service.",
  "A retry policy that does not make outages worse.",
  "Schema migrations for graph databases.",
  "Policy-as-code for access reviews.",
  "CI that provisions short-lived credentials instead of storing them.",
  "Preview environments per pull request, torn down automatically.",
  "Tail latency lab: reproduce p99 issues locally.",
];

export const TECHNOLOGIES = [
  "Python", "PyTorch", "TypeScript", "React", "Node.js", "Go", "Rust", "PostgreSQL", "Redis",
  "Docker", "Kubernetes", "Terraform", "GraphQL", "gRPC", "FastAPI", "CUDA", "Ray", "Kafka",
  "NATS", "SQLite", "ClickHouse", "Prometheus", "OpenTelemetry", "JAX", "ONNX", "WebAssembly",
  "Elixir", "Svelte", "Next.js", "Tailwind CSS",
];

export const REPO_TOPICS = [
  "machine-learning", "nlp", "retrieval", "inference", "developer-tools", "observability",
  "distributed-systems", "databases", "security", "rust", "typescript", "python",
  "kubernetes", "performance", "testing",
];

export const COMMUNITY_SPECS = [
  { name: "Machine Learning Research", mode: "APPROVAL_REQUIRED", size: "large", desc: "Papers, ablations, and reproducibility. Share what worked, and what silently did not." },
  { name: "NLP Researchers", mode: "APPROVAL_REQUIRED", size: "large", desc: "Tokenizers, retrieval, evaluation, and the ongoing question of whether bigger helps." },
  { name: "Computer Vision", mode: "OPEN", size: "medium", desc: "Detection, segmentation, video pipelines, and datasets that are actually usable." },
  { name: "Robotics Lab", mode: "OPEN", size: "small", desc: "Simulation, control, perception, and closing the gap between sim and reality." },
  { name: "AI Agents", mode: "OPEN", size: "large", desc: "Tool use, structured output, memory, and evaluating agents beyond vibes." },
  { name: "Open Source Builders", mode: "OPEN", size: "large", desc: "Maintaining, contributing, and surviving the parts nobody writes about." },
  { name: "React Developers", mode: "OPEN", size: "large", desc: "Components, rendering, state, and the ecosystem around it." },
  { name: "Backend Engineering", mode: "OPEN", size: "large", desc: "APIs, queues, databases, and designing for the failures you will eventually have." },
  { name: "Distributed Systems", mode: "APPROVAL_REQUIRED", size: "medium", desc: "Consensus, partitioning, clocks, and the cost of coordination." },
  { name: "System Design", mode: "OPEN", size: "large", desc: "Architecture decisions with the trade-offs written down." },
  { name: "Cybersecurity", mode: "APPROVAL_REQUIRED", size: "medium", desc: "Threat modelling, research, and responsible disclosure practice." },
  { name: "Cloud Engineering", mode: "OPEN", size: "medium", desc: "Networking, cost, and running things reliably on someone else's hardware." },
  { name: "DevOps", mode: "OPEN", size: "large", desc: "CI/CD, deployment strategy, and incident response." },
  { name: "Database Engineering", mode: "APPROVAL_REQUIRED", size: "medium", desc: "Query planning, indexing, replication, and schema evolution in production." },
  { name: "Rust Developers", mode: "OPEN", size: "medium", desc: "Systems work, concurrency, and the ecosystem as it matures." },
  { name: "Python Developers", mode: "OPEN", size: "large", desc: "Packaging, typing, performance, and the ecosystem we all depend on." },
  { name: "TypeScript", mode: "OPEN", size: "medium", desc: "Types as documentation and as a correctness tool." },
  { name: "Go Developers", mode: "OPEN", size: "medium", desc: "Services, tooling, and concurrency with goroutines." },
  { name: "Research Papers", mode: "APPROVAL_REQUIRED", size: "medium", desc: "Discussion of recent work, with reproduction details when you have them." },
  { name: "Developer Tools", mode: "OPEN", size: "medium", desc: "Linters, formatters, CLI ergonomics, and internal tooling." },
  { name: "Startup Builders", mode: "OPEN", size: "large", desc: "Founders and early engineers talking about building in the first year." },
  { name: "Student Developers", mode: "OPEN", size: "large", desc: "Learning in public. Questions are welcome; lowlighting is not." },
  { name: "Mobile Engineering", mode: "OPEN", size: "small", desc: "iOS, Android, and cross-platform work that ships." },
  { name: "Performance Engineering", mode: "APPROVAL_REQUIRED", size: "medium", desc: "Profiling, tail latency, and the discipline of measuring first." },
  { name: "Testing & QA", mode: "OPEN", size: "small", desc: "Test strategy that survives distributed systems and real deadlines." },
  { name: "Accessibility", mode: "OPEN", size: "small", desc: "Building software that works for everyone, and measuring whether it does." },
  { name: "Observability", mode: "OPEN", size: "medium", desc: "Metrics, traces, logs, and the questions each one can answer." },
];

export const COMMUNITY_POSTS = [
  "How are you evaluating RAG systems beyond retrieval accuracy? Ours looks healthy on paper and disappointing in use.",
  "What is your preferred strategy for breaking API changes? Versioned paths, headers, or a separate hostname.",
  "How are you handling backpressure in your current architecture? Interested in what survives an unplanned spike.",
  "Anyone have a good approach for evaluating agent tool use that does not require a large labelled set?",
  "Our tokenizers disagree on unicode edge cases enough to change downstream accuracy. Curious how others handle it.",
  "Sharing a writeup of the single-writer to partitioned-log migration, including the parts that went badly.",
  "What does your incident review process look like when the contributing factors are genuinely distributed?",
  "How do you version datasets alongside models without the mapping getting lost after two quarters?",
  "Anyone else find that removing a dependency made the system slower because we lost a useful optimisation?",
  "Looking for examples of architecture decision records that people actually read. Most I have seen are aspirational.",
  "How are you handling GPU memory fragmentation in long-running serving processes?",
  "We cut our p99 by moving one hot query out of the request path entirely. Sharing the writeup.",
  "What is your policy for feature flags once a flag has been on for two years? Ours is: nobody knows.",
  "Discussion: is schema-first still the right call when most of the schema is generated from other systems?",
  "How do you test retry logic without making the test suite slower than the system under test?",
  "Sharing a checklist we now run before any migration that touches customer data.",
  "What tooling do you trust for dependency updates in production repos?",
  "Curious how people handle timezones in stored data. Our partition key was the source of a three-day outage.",
];

export const COMMENT_BODIES = [
  "This matches what we saw almost exactly. The fix was less glamorous than the diagnosis.",
  "Strong disagree, respectfully. That works until you need to reorder writes, and then you are rewriting it.",
  "Do you have numbers on this? Not pushing back, genuinely asking what the before and after looked like.",
  "We tried something similar and it did not survive contact with production traffic.",
  "Good writeup. The failure modes section is the part most posts leave out.",
  "This is the clearest explanation of the trade-off I have read. Bookmarked.",
  "Small correction: that assumption holds until you restart, which is exactly when you will not be watching.",
  "We ended up doing the opposite and regretted it for different reasons.",
  "How does this behave when the upstream is degraded? That is where our version fell apart.",
  "Saving this for the next design review. Thanks for writing it up properly.",
  "The benchmark methodology matters here. Different setup, very different conclusion.",
  "I would love a followup on how this performed after the novelty wore off and the team moved on.",
];

export const CHAT_OPENERS = [
  "Did you ever get to the bottom of the latency issue?",
  "Are you around for a quick question about the evaluation harness?",
  "Saw your post about backpressure. How are you handling it now?",
  "Can I sanity-check a migration plan with you?",
  "Do you have the benchmark numbers somewhere?",
  "Interested in how your team approached this. Any pointers appreciated.",
  "Quick one: did the new index strategy help in production, or only locally?",
  "Would you be opposed to me picking your brain on the retry policy?",
];

export const CHAT_REPLIES = [
  "Yes, short version: it was the pool, not the model.",
  "Fair. I will send the numbers when I have cleaned them up.",
  "Roughly 180ms off p95, no measurable quality change.",
  "In production yes. The first week was fine, then traffic doubled.",
  "Not opposed at all. Sending an invite.",
  "It helped locally and then plateaued. Details in the thread.",
  "Sort of. The second part took longer than expected.",
  "Happy to. It turned into a longer conversation than I expected.",
  "That is a fair concern. Let me check the run again.",
  "Honestly it regressed and we rolled it back.",
  "Same experience here, though for different reasons.",
  "Give me a day to get you something readable.",
];

export const REPO_NAMES = [
  "transformer-lab", "rag-engine", "vector-search", "model-evaluation", "distributed-inference",
  "tokenizer-utils", "eval-harness", "prompt-diff", "trace-viewer", "schema-drift",
  "retry-policy", "batch-scheduler", "gpu-allocator", "cache-stampede", "index-tuner",
  "metric-weaver", "data-lineage", "cost-lens", "sandbox-runner", "proto-lint",
];

export const LANGUAGES = ["Python", "TypeScript", "Go", "Rust", "Jupyter Notebook", "C++", "JavaScript"];
