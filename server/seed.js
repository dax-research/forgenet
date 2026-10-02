/**
 * seed.js — High-fidelity realistic developer dataset for ForgeNet.
 *
 * Run: npm run seed
 * Re-runs cleanly with --force or wipes seed domain data if present.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

import User         from './src/features/users/user.model.js';
import Post         from './src/features/posts/post.model.js';
import Project      from './src/features/projects/project.model.js';
import Community    from './src/features/communities/community.model.js';
import Comment      from './src/features/comments/comment.model.js';
import Notification from './src/features/notifications/notification.model.js';
import Conversation from './src/features/chat/conversation.model.js';
import Message      from './src/features/messages/message.model.js';

const SEED_DOMAIN   = '@forgenet-seed.dev';
const SEED_PASSWORD = 'ForgeNet123!';
const BCRYPT_ROUNDS = 10;

const MONGO_URI =
  process.env.MONGODB_URI?.trim() ?? 'mongodb://127.0.0.1:27017/forgenet';

const pick = (arr, n) => {
  const copy = [...arr];
  const out  = [];
  n = Math.min(n, copy.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
};

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// High quality developer personas with curated Unsplash developer headshots
const USER_DEFS = [
  {
    name: 'Aisha Okonkwo',
    email: 'aisha.okonkwo' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    bio: 'Lead Frontend Architect @ Vercel ecosystem. Obsessed with design systems, accessible Radix components & micro-interactions.',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Figma', 'Storybook', 'Next.js'],
    githubUrl: 'https://github.com/aisha-okonkwo',
    portfolioUrl: 'https://aishaokonkwo.dev',
    isJobSeeking: false,
  },
  {
    name: 'Marco Bellini',
    email: 'marco.bellini' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Senior UI/Motion Engineer. Turning intricate 3D WebGL and GSAP scenes into fluid production web apps.',
    skills: ['Vue 3', 'Nuxt.js', 'Three.js', 'GSAP', 'WebGL', 'TypeScript'],
    githubUrl: 'https://github.com/marcobellini',
    portfolioUrl: 'https://marcobellini.design',
    isJobSeeking: true,
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bio: 'Staff Distributed Systems Engineer. Low-latency payment infrastructure in Go & Rust. Former Stripe engineer.',
    skills: ['Go', 'Rust', 'PostgreSQL', 'Redis', 'Kafka', 'gRPC'],
    githubUrl: 'https://github.com/priyanair-dev',
    portfolioUrl: 'https://priyanair.io',
    isJobSeeking: false,
  },
  {
    name: 'Tobias Müller',
    email: 'tobias.mueller' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Principal Cloud Platform Architect. Event-driven architectures, Kubernetes operators, and pragmatic monoliths.',
    skills: ['Node.js', 'Rust', 'Docker', 'Kubernetes', 'RabbitMQ', 'AWS'],
    githubUrl: 'https://github.com/tobias-mueller',
    portfolioUrl: '',
    isJobSeeking: true,
  },
  {
    name: 'Samira Hassan',
    email: 'samira.hassan' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    bio: 'Founder @ DevMetrics. Full-stack hacker building developer productivity tooling with React, Node, and ClickHouse.',
    skills: ['React', 'Node.js', 'Express', 'MongoDB', 'Next.js', 'Docker'],
    githubUrl: 'https://github.com/samira-hassan',
    portfolioUrl: 'https://samirahassan.dev',
    isJobSeeking: false,
  },
  {
    name: 'Liam Fitzgerald',
    email: 'liam.fitzgerald' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    bio: 'Product Engineer shipping polished SaaS apps. Next.js, tRPC, and Tailwind enthusiast.',
    skills: ['Next.js', 'tRPC', 'Prisma', 'PostgreSQL', 'Tailwind CSS', 'Stripe'],
    githubUrl: 'https://github.com/liam-fitzgerald',
    portfolioUrl: 'https://liamfitz.dev',
    isJobSeeking: false,
  },
  {
    name: 'Yuki Tanaka',
    email: 'yuki.tanaka' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    bio: 'AI Infrastructure & MLOps Engineer. Training pipelines, Kubeflow, low-latency LLM inference at scale.',
    skills: ['Python', 'PyTorch', 'MLflow', 'Kubeflow', 'Triton', 'CUDA'],
    githubUrl: 'https://github.com/yuki-tanaka-ml',
    portfolioUrl: 'https://yukitanaka.ai',
    isJobSeeking: false,
  },
  {
    name: 'Fatima Al-Rashid',
    email: 'fatima.alrashid' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80',
    bio: 'AI Research Scientist & LangChain core contributor. Building production-grade RAG and agent evaluation frameworks.',
    skills: ['Python', 'LangChain', 'LlamaIndex', 'Pinecone', 'FastAPI', 'PyTorch'],
    githubUrl: 'https://github.com/fatima-alrashid',
    portfolioUrl: '',
    isJobSeeking: true,
  },
  {
    name: 'Diego Reyes',
    email: 'diego.reyes' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    bio: 'Staff Mobile Engineer. React Native Bridgeless, Expo SDK expert, and cross-platform native modules.',
    skills: ['React Native', 'Expo', 'Swift', 'Kotlin', 'TypeScript', 'GraphQL'],
    githubUrl: 'https://github.com/diego-reyes-mobile',
    portfolioUrl: 'https://diegoreyes.app',
    isJobSeeking: false,
  },
  {
    name: 'Chen Wei',
    email: 'chen.wei' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=400&q=80',
    bio: 'Site Reliability Engineering Lead. Terraform, ArgoCD GitOps, eBPF telemetry, and chaos engineering.',
    skills: ['Kubernetes', 'Terraform', 'ArgoCD', 'Prometheus', 'Go', 'AWS'],
    githubUrl: 'https://github.com/chenwei-devops',
    portfolioUrl: '',
    isJobSeeking: false,
  },
  {
    name: 'Nadia Kowalski',
    email: 'nadia.kowalski' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    bio: 'Senior Security Architect. Cloud security, automated SAST/DAST tooling, and smart contract auditing.',
    skills: ['AppSec', 'Rust', 'Python', 'Burp Suite', 'Docker', 'Cryptography'],
    githubUrl: 'https://github.com/nadia-kowalski-sec',
    portfolioUrl: 'https://nadiakowalski.info',
    isJobSeeking: false,
  },
  {
    name: 'Kwame Asante',
    email: 'kwame.asante' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    bio: 'Staff Data Platform Engineer. Building enterprise lakehouses with Apache Iceberg, dbt, and Kafka.',
    skills: ['Apache Iceberg', 'dbt', 'Spark', 'Airflow', 'BigQuery', 'Python'],
    githubUrl: 'https://github.com/kwame-asante-data',
    portfolioUrl: '',
    isJobSeeking: true,
  },
  {
    name: 'Sofia Petrov',
    email: 'sofia.petrov' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    bio: 'CS student @ ETH Zurich. Passionate about functional programming, WebAssembly, and building minimal web tools.',
    skills: ['TypeScript', 'Rust', 'React', 'WebAssembly', 'Python', 'Git'],
    githubUrl: 'https://github.com/sofia-petrov-cs',
    portfolioUrl: 'https://sofiapetrov.dev',
    isJobSeeking: true,
  },
  {
    name: 'Arjun Mehta',
    email: 'arjun.mehta' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    bio: 'Systems Engineer & Open Source Hacker. Linux kernel internals, fast compilers, and distributed consensus.',
    skills: ['C++', 'Rust', 'Go', 'Linux', 'Distributed Systems', 'CMake'],
    githubUrl: 'https://github.com/arjun-mehta-iit',
    portfolioUrl: 'https://arjunmehta.tech',
    isJobSeeking: true,
  },
  {
    name: 'Ingrid Svensson',
    email: 'ingrid.svensson' + SEED_DOMAIN,
    profileImage: 'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=400&q=80',
    bio: 'Full-time Open Source Maintainer. Devoted to dev tooling, TypeScript AST transforms, and developer ergonomics.',
    skills: ['TypeScript', 'Node.js', 'Rust', 'GitHub Actions', 'Vite', 'Babel'],
    githubUrl: 'https://github.com/ingrid-svensson',
    portfolioUrl: 'https://ingrid.dev',
    isJobSeeking: false,
  },
];

// Curated Communities with thematic developer icons/banners
const COMMUNITY_DEFS = [
  {
    name: 'React Developers',
    description: 'High-performance React patterns, Server Components, concurrent rendering, and UI architecture discussions.',
    image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'AI/ML Builders',
    description: 'Practical generative AI, model fine-tuning, retrieval pipelines (RAG), and deploying LLMs to production.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'System Design & Distributed',
    description: 'Scalability breakdowns, consensus protocols, cache eviction strategies, and architectural trade-offs.',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'DevOps & Cloud Native',
    description: 'Kubernetes production tales, Terraform modularization, GitOps, CI/CD speedruns, and SRE best practices.',
    image: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Open Source Contributors',
    description: 'Project showcases, PR reviews, mentoring first-time contributors, and maintaining thriving OSS communities.',
    image: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Mobile Engineering',
    description: 'React Native Bridgeless, Flutter architecture, Swift/Kotlin native bridges, and cross-platform UX.',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Cybersecurity & AppSec',
    description: 'Vulnerability disclosures, threat modeling, zero trust architecture, CTF writeups, and safe coding standards.',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Python & Data Engineering',
    description: 'Apache Iceberg, streaming pipelines with Kafka, dbt best practices, and fast analytic queries.',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Modern CSS & Design Systems',
    description: 'Container queries, `@layer`, subgrid layouts, fluid typography, and building bulletproof web components.',
    image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Student Developers',
    description: 'Interview prep, project reviews, resume feedback, and learning software engineering fundamentals together.',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=200&q=80',
  },
];

// Rich posts with real developer visuals and authentic technical topics
const buildPosts = (users, communities) => {
  const byName = (name) => users.find((u) => u.name === name);
  const commByName = (name) => communities.find((c) => c.name === name);

  return [
    {
      author: byName('Aisha Okonkwo')._id,
      content: "Just migrated our entire multi-tenant design system to Radix UI primitives + Tailwind CSS v4. The accessibility audit scored 100% across the board — ARIA attributes, roving tab indices, and screen-reader announcements now work seamlessly.\n\nHere is a screenshot of our updated component tokens and fluid typography scales:",
      images: ['https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80'],
      media: [{
        type: 'image',
        url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80',
        altText: 'Clean modern design system UI tokens and component cards'
      }],
      tags: ['react', 'tailwind', 'design-system', 'accessibility'],
      community: commByName('React Developers')._id,
      likes: pick(users, 8).map((u) => u._id),
    },
    {
      author: byName('Priya Nair')._id,
      content: "We replaced our Python API gateway proxy with an in-house Go service. Under synthetic load of 85,000 req/sec, p99 latency dropped from 145ms down to 14ms while reducing CPU footprint by 70%.\n\nHere is the exact zero-allocation logging middleware using `log/slog`:",
      codeBlocks: [{
        language: 'go',
        code: `func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        wrapped := &statusRecorder{ResponseWriter: w, code: http.StatusOK}
        next.ServeHTTP(wrapped, r)

        slog.InfoContext(r.Context(), "http_request",
            "method", r.Method,
            "path", r.URL.Path,
            "status", wrapped.code,
            "duration_ms", time.Since(start).Milliseconds(),
            "bytes_written", wrapped.bytes,
        )
    })
}`,
      }],
      tags: ['golang', 'systems', 'microservices', 'performance'],
      community: commByName('System Design & Distributed')._id,
      likes: pick(users, 11).map((u) => u._id),
    },
    {
      author: byName('Samira Hassan')._id,
      content: "Thrilled to launch DevMetrics v1.0 on GitHub today! 🚀\n\nIt connects your GitHub Actions, Jira board, and PagerDuty alerts to give engineering leaders real-time DORA metrics (Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Mean Time to Recovery) without any expensive enterprise SaaS vendor lock-in.\n\nBuilt with React, Vite, Node, and Tailwind.",
      images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80'],
      media: [{
        type: 'image',
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
        altText: 'DevMetrics engineering analytics dashboard showcasing DORA metrics graphs'
      }],
      tags: ['opensource', 'mern', 'devops', 'metrics'],
      community: commByName('Open Source Contributors')._id,
      likes: pick(users, 12).map((u) => u._id),
    },
    {
      author: byName('Fatima Al-Rashid')._id,
      content: "RAG quality breakthrough: Switching our dense vector search from pure cosine similarity to hybrid search (BM25 lexical + dense embeddings) coupled with Cohere Rerank v3 cut model hallucinations by 42% on technical documentation Q&A.\n\nTakeaway: do not blindly feed top-k vector matches into your prompt context. Reranking is critical.",
      codeBlocks: [{
        language: 'python',
        code: `def retrieve_and_rerank(query: str, top_k: int = 5) -> list[Document]:
    # 1. Hybrid retrieval (lexical + dense)
    dense_hits = vector_db.similarity_search(query, k=25)
    sparse_hits = bm25_index.search(query, k=25)
    candidates = deduplicate(dense_hits + sparse_hits)

    # 2. Cross-encoder reranking
    reranked = cohere_client.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=[doc.page_content for doc in candidates],
        top_n=top_k,
    )
    return [candidates[result.index] for result in reranked.results]`,
      }],
      tags: ['ai', 'rag', 'llm', 'python', 'vector-search'],
      community: commByName('AI/ML Builders')._id,
      likes: pick(users, 9).map((u) => u._id),
    },
    {
      author: byName('Chen Wei')._id,
      content: "Automated our entire multi-region Kubernetes cluster deployment using ArgoCD and Terraform GitOps. Every commit to `main` triggers a declarative sync with zero downtime blue-green rollouts.\n\nHere is our primary cloud topology diagram from our SRE runbook:",
      images: ['https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'],
      media: [{
        type: 'image',
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
        altText: 'Global distributed cloud network visualization'
      }],
      tags: ['kubernetes', 'argocd', 'gitops', 'cloudnative'],
      community: commByName('DevOps & Cloud Native')._id,
      likes: pick(users, 7).map((u) => u._id),
    },
    {
      author: byName('Diego Reyes')._id,
      content: "Expo SDK 51 with Bridgeless mode and the New Architecture enabled is the biggest leap forward React Native has seen in years.\n\nStartup time dropped from 1.8s to 450ms on low-end Android devices, and complex gestures with react-native-reanimated run at an uncompromised 120 FPS. If you have been hesitant about migrating, now is the time.",
      images: ['https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80'],
      media: [{
        type: 'image',
        url: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80',
        altText: 'Mobile developer testing application code on phone'
      }],
      tags: ['reactnative', 'mobile', 'expo', 'ios', 'android'],
      community: commByName('Mobile Engineering')._id,
      likes: pick(users, 6).map((u) => u._id),
    },
    {
      author: byName('Nadia Kowalski')._id,
      content: "AppSec Alert: We performed an audit across 40 popular Node.js microservices and found 14 had vulnerabilities to NoSQL operator injection in query string handlers.\n\nAlways validate incoming request bodies through strict schema validators (Zod/Joi) and sanitize mongo operators:",
      codeBlocks: [{
        language: 'javascript',
        code: `import { z } from "zod";
import mongoSanitize from "express-mongo-sanitize";

// 1. Sanitize request against operator keys like {$gt: ""}
app.use(mongoSanitize());

// 2. Enforce strict Zod schemas
const AuthQuerySchema = z.object({
  email: z.string().email(),
  token: z.string().min(32),
});

export const verifyUser = async (req, res) => {
  const result = AuthQuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  const user = await User.findOne({ email: result.data.email });
  // ...
};`,
      }],
      tags: ['cybersecurity', 'appsec', 'nodejs', 'mongodb'],
      community: commByName('Cybersecurity & AppSec')._id,
      likes: pick(users, 10).map((u) => u._id),
    },
    {
      author: byName('Liam Fitzgerald')._id,
      content: "End-to-end type safety between Next.js and backend microservices is pure joy. With tRPC and Zod, refactoring database models propagates immediate TypeScript errors directly to frontend page components.\n\nNo manual OpenAPI codegen steps or stale types ever again.",
      tags: ['typescript', 'trpc', 'nextjs', 'fullstack'],
      community: commByName('React Developers')._id,
      likes: pick(users, 5).map((u) => u._id),
    },
    {
      author: byName('Tobias Müller')._id,
      content: "Unpopular opinion from someone who spent 5 years managing 120 Kubernetes pods: Start with a well-factored monolithic backend.\n\nIsolate code through domain-driven modular packages first. Only decompose when distinct horizontal scaling or database isolation requirements force your hand. The operational simplicity is worth millions in saved engineering hours.",
      tags: ['architecture', 'systemdesign', 'backend', 'scalability'],
      community: commByName('System Design & Distributed')._id,
      likes: pick(users, 14).map((u) => u._id),
    },
    {
      author: byName('Yuki Tanaka')._id,
      content: "Training run completed! Fine-tuned an open-weight Llama-3-8B model on 15,000 domain-specific internal Git commits and PR review threads.\n\nEvaluated against HumanEval benchmarks, it surpassed GPT-3.5 turbo on our internal code syntax tests while running locally on a single consumer RTX 4090 with vLLM.",
      images: ['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80'],
      media: [{
        type: 'image',
        url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80',
        altText: 'AI GPU training server rack metrics'
      }],
      tags: ['machinelearning', 'llm', 'pytorch', 'ai'],
      community: commByName('AI/ML Builders')._id,
      likes: pick(users, 10).map((u) => u._id),
    },
    {
      author: byName('Arjun Mehta')._id,
      content: "Big milestone: My Google Summer of Code (GSoC) pull request implementing incremental compilation caching for the open-source Clang build graph was just merged!\n\nBenchmarked on the Chromium build target, warm re-compiles are now 4.2x faster. Huge thanks to my mentors for all the deep code reviews.",
      tags: ['opensource', 'cpp', 'rust', 'gsoc'],
      community: commByName('Open Source Contributors')._id,
      likes: pick(users, 13).map((u) => u._id),
    },
    {
      author: byName('Sofia Petrov')._id,
      content: "Just deployed my first open-source project — DevTimer (a sleek developer pomodoro timer with GitHub issue synchronization).\n\nBuilt with React 19, Vite, and localStorage state synchronization. Would love some code review and feedback on GitHub!",
      images: ['https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80'],
      media: [{
        type: 'image',
        url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80',
        altText: 'Developer workspace with dual displays and code editor'
      }],
      tags: ['student', 'react', 'webdev', 'project'],
      community: commByName('Student Developers')._id,
      likes: pick(users, 7).map((u) => u._id),
    },
  ];
};

// Realistic developer projects with real GitHub URLs and Unsplash project thumbnails
const buildProjects = (users) => {
  const byName = (name) => users.find((u) => u.name === name);

  return [
    {
      owner: byName('Samira Hassan')._id,
      title: 'DevMetrics Analytics',
      description: 'Real-time developer analytics platform aggregating GitHub CI, Jira issue velocity, and PagerDuty incidents to display key DORA metrics for engineering teams.',
      technologies: ['React', 'Node.js', 'MongoDB', 'Chart.js', 'GitHub API', 'Docker'],
      images: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/samira-hassan/devmetrics',
      liveUrl: 'https://devmetrics.samirahassan.dev',
      status: 'completed',
    },
    {
      owner: byName('Aisha Okonkwo')._id,
      title: 'Aurora Design System',
      description: 'Production-ready React & Radix UI component library containing 50+ accessible primitives, Figma token sync, and dark mode support.',
      technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Storybook', 'Radix UI'],
      images: ['https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/aisha-okonkwo/aurora-ds',
      liveUrl: 'https://aurora-ds.vercel.app',
      status: 'completed',
    },
    {
      owner: byName('Fatima Al-Rashid')._id,
      title: 'DocuQuery AI',
      description: 'RAG-powered interactive document research assistant that parses PDF codebases and technical manuals with citation grounding.',
      technologies: ['Python', 'LangChain', 'Pinecone', 'FastAPI', 'React', 'OpenAI'],
      images: ['https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/fatima-alrashid/docuquery',
      liveUrl: 'https://docuquery.ai',
      status: 'in-progress',
    },
    {
      owner: byName('Priya Nair')._id,
      title: 'GoCache Engine',
      description: 'High-throughput thread-safe in-memory cache library for Go with LRU eviction, adaptive expiration policies, and Prometheus metrics.',
      technologies: ['Go', 'Docker', 'Prometheus', 'gRPC'],
      images: ['https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/priyanair-dev/gocache',
      status: 'completed',
    },
    {
      owner: byName('Diego Reyes')._id,
      title: 'TrailPulse Mobile',
      description: 'Cross-platform outdoor navigation app with offline topological vector maps, elevation profiling, and health telemetry sync.',
      technologies: ['React Native', 'Expo', 'TypeScript', 'Mapbox', 'Firebase'],
      images: ['https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/diego-reyes-mobile/trailpulse',
      liveUrl: 'https://trailpulse.app',
      status: 'completed',
    },
    {
      owner: byName('Chen Wei')._id,
      title: 'KubeGitOps Operator',
      description: 'Lightweight Kubernetes controller that synchronizes ConfigMaps and Secrets across multi-cluster environments with cryptographic auditing.',
      technologies: ['Go', 'Kubernetes', 'Helm', 'Terraform', 'PostgreSQL'],
      images: ['https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/chenwei-devops/kubegitops',
      status: 'in-progress',
    },
    {
      owner: byName('Nadia Kowalski')._id,
      title: 'SecurScan CLI',
      description: 'High-speed SAST security scanner for Git repositories that pinpoints hardcoded secrets, misconfigured CORS, and vulnerable dependencies.',
      technologies: ['Rust', 'Python', 'GitHub Actions', 'Docker'],
      images: ['https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/nadia-kowalski-sec/securscan',
      status: 'completed',
    },
    {
      owner: byName('Liam Fitzgerald')._id,
      title: 'ScheduleSync SaaS',
      description: 'Open source scheduling infrastructure for freelancers and agencies with timezone intelligence and Stripe billing integration.',
      technologies: ['Next.js', 'tRPC', 'Prisma', 'PostgreSQL', 'Stripe', 'Tailwind CSS'],
      images: ['https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80'],
      githubUrl: 'https://github.com/liam-fitzgerald/schedulesync',
      liveUrl: 'https://schedulesync.app',
      status: 'in-progress',
    },
  ];
};

const buildNotifications = (users, posts) => {
  const byName = (name) => users.find((u) => u.name === name);

  return [
    {
      recipient: byName('Aisha Okonkwo')._id,
      sender:    byName('Samira Hassan')._id,
      type:      'follow',
      message:   'Samira Hassan started following you.',
      read:      false,
      data:      { userId: byName('Samira Hassan')._id },
    },
    {
      recipient: byName('Priya Nair')._id,
      sender:    byName('Tobias Müller')._id,
      type:      'like',
      message:   'Tobias Müller liked your post about Go HTTP middleware.',
      read:      true,
      data:      { postId: posts[1]._id },
    },
    {
      recipient: byName('Samira Hassan')._id,
      sender:    byName('Aisha Okonkwo')._id,
      type:      'comment',
      message:   'Aisha Okonkwo commented on your DevMetrics launch announcement.',
      read:      false,
      data:      { postId: posts[2]._id },
    },
    {
      recipient: byName('Fatima Al-Rashid')._id,
      sender:    byName('Yuki Tanaka')._id,
      type:      'like',
      message:   'Yuki Tanaka liked your RAG reranking breakdown.',
      read:      true,
      data:      { postId: posts[3]._id },
    },
    {
      recipient: byName('Chen Wei')._id,
      sender:    byName('Nadia Kowalski')._id,
      type:      'follow',
      message:   'Nadia Kowalski started following you.',
      read:      false,
      data:      { userId: byName('Nadia Kowalski')._id },
    },
  ];
};

async function seed() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log(' Connected to MongoDB:', mongoose.connection.name);

  // Clean wipe any existing seed users, posts, comments, projects, etc.
  console.log(' Cleaning previous seed data...');
  const seedUsers = await User.find({ email: { $regex: SEED_DOMAIN.replace('.', '\\.') + '$' } });
  const seedUserIds = seedUsers.map(u => u._id);

  if (seedUserIds.length > 0) {
    await Post.deleteMany({ author: { $in: seedUserIds } });
    await Project.deleteMany({ owner: { $in: seedUserIds } });
    await Comment.deleteMany({ author: { $in: seedUserIds } });
    await Notification.deleteMany({ $or: [{ recipient: { $in: seedUserIds } }, { sender: { $in: seedUserIds } }] });
    await Conversation.deleteMany({ participants: { $in: seedUserIds } });
    await Message.deleteMany({ sender: { $in: seedUserIds } });
    await Community.deleteMany({ owner: { $in: seedUserIds } });
    await User.deleteMany({ _id: { $in: seedUserIds } });
    console.log(` Removed old seed records (${seedUserIds.length} users cleared).`);
  }

  console.log(' Seeding realistic ForgeNet developer records...\n');

  // 1. Users
  console.log(`👤 Creating ${USER_DEFS.length} authentic developer profiles with portraits...`);
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
  const users = await User.insertMany(
    USER_DEFS.map((def) => ({ ...def, password: hashedPassword }))
  );

  // 2. Follow graph
  console.log(' Building developer follow network...');
  for (const user of users) {
    const others = users.filter((u) => !u._id.equals(user._id));
    const toFollow = pick(others, rand(3, 7));

    await User.updateOne(
      { _id: user._id },
      { $addToSet: { following: { $each: toFollow.map((u) => u._id) } } }
    );

    for (const followed of toFollow) {
      await User.updateOne(
        { _id: followed._id },
        { $addToSet: { followers: user._id } }
      );
    }
  }

  // 3. Communities
  console.log(` Creating ${COMMUNITY_DEFS.length} technical communities with banners...`);
  const communities = await Community.insertMany(
    COMMUNITY_DEFS.map((def, i) => {
      const owner   = users[i % users.length];
      const members = pick(users, rand(4, 10)).map((u) => u._id);
      return {
        ...def,
        owner:   owner._id,
        admins:  [owner._id],
        members: [...new Set([owner._id.toString(), ...members.map(String)])].map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      };
    })
  );

  // 4. Posts
  console.log(' Writing high-signal technical posts with media & code blocks...');
  const postDefs = buildPosts(users, communities);
  const posts    = await Post.insertMany(postDefs);

  // 5. Comments
  console.log(' Creating realistic technical comments & discussion threads...');
  const commentDefs = [
    { author: users[1]._id, post: posts[0]._id, content: "Radix UI primitives have saved us hundreds of hours. Their focus trapping and keyboard navigation out of the box are unmatched." },
    { author: users[4]._id, post: posts[0]._id, content: "Great work Aisha! Do you use Tailwind arbitrary variants or standard data attribute selectors for Radix open states?" },
    { author: users[3]._id, post: posts[1]._id, content: "14ms p99 at 85k req/s is impressive. Are you using standard library net/http or fasthttp for the socket multiplexing?" },
    { author: users[0]._id, post: posts[1]._id, content: "Standard library slog in Go 1.21+ is such a welcome upgrade over logrus and zap. Clean implementation." },
    { author: users[7]._id, post: posts[2]._id, content: "Starred the repo! We were literally discussing DORA tracking in our engineering all-hands this morning. Perfect timing." },
    { author: users[6]._id, post: posts[3]._id, content: "Hybrid search with BM25 + dense vectors is definitely the standard now. We saw similar accuracy jumps on financial documents." },
  ];
  await Comment.insertMany(commentDefs);

  // 6. Projects
  console.log(' Publishing developer projects with showcase screenshots...');
  await Project.insertMany(buildProjects(users));

  // 7. Notifications
  console.log(' Generating sample notifications...');
  await Notification.insertMany(buildNotifications(users, posts));

  // 8. Conversations & Messages
  console.log(' Creating conversations and direct messages...');
  const convPairs = [
    [users[0], users[4]], // Aisha <-> Samira
    [users[2], users[3]], // Priya <-> Tobias
    [users[6], users[7]], // Yuki <-> Fatima
  ];

  const convMessages = [
    [
      { from: 0, text: 'Hey Samira! Loved what you shipped with DevMetrics. How are you handling GitHub API rate limits?' },
      { from: 1, text: 'Hey Aisha! We use a token pool with Redis exponential backoff. Working on open sourcing the proxy package next!' },
      { from: 0, text: 'That would be super useful. Would love to contribute!' },
    ],
    [
      { from: 0, text: 'Tobias, your point about starting with modular monoliths sparked a whole debate on our team!' },
      { from: 1, text: 'Haha! Glad it did. Premature microservices burn out so many early engineering teams.' },
      { from: 0, text: 'Totally agree. Keep it simple until traffic dictates splitting.' },
    ],
    [
      { from: 1, text: 'Yuki, how are you hosting vLLM in production? Triton inference server or raw containers?' },
      { from: 0, text: 'Raw Kubernetes deployments with vLLM OpenAI-compatible server. Autoscaling on GPU queue depth.' },
      { from: 1, text: 'Awesome, thanks! Going to benchmark that this week.' },
    ]
  ];

  for (let i = 0; i < convPairs.length; i++) {
    const [uA, uB] = convPairs[i];
    const conversation = await Conversation.create({ participants: [uA._id, uB._id] });
    const msgs = convMessages[i];
    const now = Date.now();
    for (let j = 0; j < msgs.length; j++) {
      const sender = msgs[j].from === 0 ? uA : uB;
      await Message.create({
        sender: sender._id,
        conversation: conversation._id,
        content: msgs[j].text,
        deliveredAt: new Date(now - (msgs.length - j) * 60_000),
        readAt: j < msgs.length - 1 ? new Date(now - (msgs.length - j - 1) * 50_000) : null,
      });
    }
  }

  console.log('\n Seed complete! Summary:');
  console.log(`   Users:         ${users.length} (with Unsplash portraits)`);
  console.log(`   Communities:   ${communities.length} (with banners)`);
  console.log(`   Posts:         ${posts.length} (with real code & media images)`);
  console.log(`   Projects:      8 (with project screenshots)`);
  console.log(`   Comments:      ${commentDefs.length}`);
  console.log(`   Conversations: ${convPairs.length}`);
  console.log('\n   All seed emails end in ' + SEED_DOMAIN);
  console.log('   Default password for all seed users: ' + SEED_PASSWORD);

  await mongoose.disconnect();
  console.log(' Disconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
