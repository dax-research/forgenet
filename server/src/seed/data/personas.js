/**
 * Fictional developer personas for the ForgeNet demo dataset.
 *
 * Every identity here is invented. No real person, company, or credential is
 * represented. Names are common-name combinations chosen to look plausible in a
 * technology community; GitHub-style handles are derived, not claimed.
 */

export const ROLES = [
  { key: "ai_researcher", label: "AI Research Scientist", cluster: "research" },
  { key: "ml_researcher", label: "Machine Learning Research Scientist", cluster: "research" },
  { key: "nlp_researcher", label: "NLP Research Scientist", cluster: "research" },
  { key: "cv_researcher", label: "Computer Vision Researcher", cluster: "research" },
  { key: "robotics_researcher", label: "Robotics Researcher", cluster: "research" },
  { key: "dist_sys_researcher", label: "Distributed Systems Researcher", cluster: "research" },
  { key: "security_researcher", label: "Cybersecurity Researcher", cluster: "research" },
  { key: "university_researcher", label: "University Researcher", cluster: "research" },
  { key: "professor", label: "Assistant Professor", cluster: "research" },
  { key: "phd_student", label: "PhD Student", cluster: "research" },
  { key: "student_developer", label: "Student Developer", cluster: "student" },
  { key: "ai_engineer", label: "AI Engineer", cluster: "engineering" },
  { key: "ml_engineer", label: "Machine Learning Engineer", cluster: "engineering" },
  { key: "ai_infrastructure", label: "AI Infrastructure Engineer", cluster: "infrastructure" },
  { key: "backend_engineer", label: "Backend Engineer", cluster: "engineering" },
  { key: "frontend_engineer", label: "Frontend Engineer", cluster: "engineering" },
  { key: "fullstack_engineer", label: "Full-Stack Engineer", cluster: "engineering" },
  { key: "systems_engineer", label: "Systems Engineer", cluster: "infrastructure" },
  { key: "cloud_engineer", label: "Cloud Engineer", cluster: "infrastructure" },
  { key: "devops_engineer", label: "DevOps Engineer", cluster: "infrastructure" },
  { key: "database_engineer", label: "Database Engineer", cluster: "infrastructure" },
  { key: "security_engineer", label: "Security Engineer", cluster: "engineering" },
  { key: "mobile_developer", label: "Mobile Developer", cluster: "engineering" },
  { key: "rust_developer", label: "Rust Engineer", cluster: "engineering" },
  { key: "python_developer", label: "Python Developer", cluster: "engineering" },
  { key: "go_developer", label: "Go Engineer", cluster: "infrastructure" },
  { key: "typescript_developer", label: "TypeScript Engineer", cluster: "engineering" },
  { key: "product_engineer", label: "Product Engineer", cluster: "engineering" },
  { key: "developer_advocate", label: "Developer Advocate", cluster: "community" },
  { key: "technical_writer", label: "Technical Writer", cluster: "community" },
  { key: "open_source_maintainer", label: "Open Source Maintainer", cluster: "community" },
  { key: "startup_founder", label: "AI Startup Founder", cluster: "leadership" },
  { key: "cto", label: "CTO", cluster: "leadership" },
  { key: "vp_engineering", label: "VP of Engineering", cluster: "leadership" },
  { key: "devrel_lead", label: "Head of Developer Relations", cluster: "community" },
];

export const LOCATIONS = [
  "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX", "Boston, MA",
  "Chicago, IL", "Denver, CO", "Toronto, ON", "Vancouver, BC", "London, UK",
  "Berlin, Germany", "Amsterdam, Netherlands", "Zurich, Switzerland", "Stockholm, Sweden",
  "Helsinki, Finland", "Bangalore, India", "Bengaluru, India", "Singapore", "Tokyo, Japan",
  "Seoul, South Korea", "Taipei, Taiwan", "Sydney, Australia", "Tel Aviv, Israel",
  "Dublin, Ireland", "Lisbon, Portugal", "Paris, France", "Munich, Germany", "Warsaw, Poland",
  "Istanbul, Turkey", "Cairo, Egypt", "Lagos, Nigeria", "Nairobi, Kenya", "Cape Town, South Africa",
  "São Paulo, Brazil", "Mexico City, Mexico", "Buenos Aires, Argentina",
];

// First/last name pools. Chosen for breadth and plausibility; no reference to
// any specific real individual.
export const FIRST_NAMES = [
  "Alex", "Maya", "Daniel", "Priya", "Ethan", "Sofia", "Marcus", "Aisha", "Rohan", "Elena",
  "Tobias", "Nadia", "Victor", "Leila", "Samir", "Grace", "Omar", "Ingrid", "Diego", "Yuki",
  "Amara", "Lucas", "Mei", "Andre", "Fatima", "Henrik", "Zara", "Pablo", "Anika", "Julian",
  "Nora", "Kwame", "Lena", "Rafael", "Hana", "Ivan", "Noor", "Felix", "Ada", "Tomas",
  "Ruth", "Arjun", "Clara", "Malik", "Sven", "Bianca", "Omar", "Tara", "Emil", "Rosa",
  "Julian", "Naomi", "Andre", "Ivy", "Karim", "Petra", "Hugo", "Simone", "Rahul", "Elsa",
  "Bruno", "Anika", "Felix", "Mira", "Oscar", "Leila", "Pablo", "Sanne", "Tariq", "Wren",
  "Kaito", "Delphine", "Emeka", "Suvi", "Matteo", "Priya", "Nils", "Amara", "Jonas", "Keiko",
  "Santiago", "Freya", "Rahul", "Alina", "Bastien", "Yara", "Milo", "Anaya", "Torsten", "Lucia",
];

export const LAST_NAMES = [
  "Morgan", "Chen", "Brooks", "Shah", "Wilson", "Alvarez", "Novak", "Okafor", "Iyer", "Petrov",
  "Lindgren", "Haddad", "Marchetti", "Rahman", "Sorensen", "Bianchi", "Kowalski", "Nakamura",
  "Oyelaran", "Duarte", "Vasquez", "Fischer", "Andersson", "Bauer", "Costa", "Ferreira",
  "Grigoryan", "Haruna", "Ivanova", "Jensen", "Kaminski", "Laurent", "Mensah", "Nakagawa",
  "Ortega", "Pereira", "Quintero", "Rossi", "Sandberg", "Tremblay", "Ueda", "Virtanen",
  "Wagner", "Xu", "Yamamoto", "Zielinski", "Abadi", "Bhatt", "Castellanos", "Dubois",
  "Eriksen", "Fontaine", "Gopal", "Hoffmann", "Iqbal", "Jensen", "Krishnan", "Lindgren",
  "Mbeki", "Nakamura", "Ostrowski", "Popescu", "Rahman", "Serrano", "Takahashi", "Ustinov",
  "Vargas", "Wozniak", "Yilmaz", "Zhang", "Ahmadi", "Bianchi", "Castillo", "Delgado",
  "Eriksen", "Fischer", "Guerrero", "Hollis", "Ishikawa", "Jimenez", "Kovac", "Larsen",
  "Moreau", "Nilsson", "Okafor", "Park", "Ramos", "Schneider", "Torres", "Volkov",
];

// Short bios are written per cluster and stitched with the person's focus area,
// so no two read identically.
export const BIO_TEMPLATES = {
  research: [
    (f) => `${f} research scientist working on model behaviour under distribution shift. Papers, ablations, and the occasional strong opinion about evaluation methodology.`,
    (f) => `PhD-level researcher in ${f}. Interested in what actually generalizes, not what wins a leaderboard by half a point.`,
    (f) => `Researcher focused on ${f}. Spends most weeks reading papers and the rest of them running experiments that do not work.`,
    (f) => `Working on ${f}. Believes most published gains are measurement artifacts and enjoys proving it.`,
    (f) => `${f} researcher. Open to collaboration on datasets, baselines, and reproducibility work.`,
  ],
  engineering: [
    (f) => `Engineer building ${f} systems in production. Cares about failure modes, load shedding, and keeping the on-call rotation humane.`,
    (f) => `Shipping ${f} tools. Optimises for boring, debuggable systems over clever ones.`,
    (f) => `${f} engineer. Spent the last few years deleting complexity rather than adding it.`,
    (f) => `Works on ${f} at scale. Happy to talk about backpressure, cost control, and why your p99 is your real latency.`,
    (f) => `Building ${f}. Writes documentation after the third support ticket, not before.`,
  ],
  infrastructure: [
    (f) => `Infrastructure engineer focused on ${f}. Automating the things that page people at 3am.`,
    (f) => `${f} specialist. Runs large clusters, small clusters, and the laptop that holds them together.`,
    (f) => `Obsessed with ${f} and the cost of running it. Terraform, observability, and strong opinions about YAML.`,
    (f) => `Keeps ${f} healthy at a scale that makes dashboards difficult.`,
  ],
  community: [
    (f) => `Open source maintainer. Spends weekends triaging issues and writing release notes. ${f} is the focus.`,
    (f) => `Developer advocate working on ${f}. Talks at conferences, writes docs, answers questions in public.`,
    (f) => `Technical writer making ${f} less painful to understand. If the docs are wrong, that is on me.`,
    (f) => `Maintainer and occasional contributor across ${f}. Believes good error messages are a feature.`,
  ],
  leadership: [
    (f) => `Founder building in ${f}. Hiring a small team that prefers clarity over process.`,
    (f) => `CTO. Spends most time on architecture reviews and making sure the roadmap is actually achievable.`,
    (f) => `Engineering leader focused on ${f}. Optimising for teams that can ship without permission.`,
    (f) => `VP Engineering. Learned that the best systems work is the kind nobody has to think about.`,
  ],
  student: [
    (f) => `Computer science student learning ${f}. Building small things, breaking larger ones.`,
    (f) => `Student developer. Currently deep in ${f} and coursework that will not help much, but is teaching me how to learn.`,
    (f) => `Undergraduate working on ${f}. Open to internships and to anyone who wants to pair on interesting problems.`,
  ],
};

export const SKILLS_BY_ROLE = {
  ai_researcher: ["PyTorch", "Transformer Architectures", "Model Evaluation", "Reinforcement Learning", "Research Design"],
  ml_researcher: ["Machine Learning", "PyTorch", "Statistical Modelling", "Experimentation", "JAX"],
  nlp_researcher: ["NLP", "Transformers", "Retrieval", "LLaMA", "Tokenization", "Evaluation"],
  cv_researcher: ["Computer Vision", "PyTorch", "Object Detection", "Segmentation", "OpenCV"],
  robotics_researcher: ["Robotics", "ROS", "Control Systems", "Simulation", "Perception", "C++"],
  dist_sys_researcher: ["Distributed Systems", "Consensus", "Databases", "Networking", "Formal Modelling"],
  security_researcher: ["Security Research", "Cryptography", "Static Analysis", "Fuzzing", "Reverse Engineering"],
  university_researcher: ["Research", "Teaching", "Grant Writing", "Publication", "Mentoring"],
  professor: ["Research", "Teaching", "Supervision", "Academic Writing", "Grant Writing"],
  phd_student: ["Research", "PyTorch", "Experimentation", "Academic Writing"],
  student_developer: ["JavaScript", "React", "Python", "Git", "Algorithms"],
  ai_engineer: ["Python", "PyTorch", "LLM Applications", "FastAPI", "Vector Search", "Evaluation"],
  ml_engineer: ["Python", "scikit-learn", "MLOps", "Feature Engineering", "Model Serving"],
  ai_infrastructure: ["Kubernetes", "GPU Scheduling", "CUDA", "Terraform", "Ray", "Observability"],
  backend_engineer: ["Node.js", "Go", "PostgreSQL", "Redis", "REST APIs", "Distributed Systems"],
  frontend_engineer: ["React", "TypeScript", "CSS", "Accessibility", "Performance", "Testing"],
  fullstack_engineer: ["TypeScript", "React", "Node.js", "PostgreSQL", "GraphQL"],
  systems_engineer: ["Rust", "C", "Linux", "Performance", "Memory Safety", "Concurrency"],
  cloud_engineer: ["AWS", "Terraform", "Kubernetes", "Networking", "Cost Optimisation"],
  devops_engineer: ["CI/CD", "Docker", "Kubernetes", "Terraform", "Observability"],
  database_engineer: ["PostgreSQL", "Query Planning", "Indexes", "Sharding", "Replication"],
  security_engineer: ["Application Security", "OAuth", "Threat Modelling", "Penetration Testing"],
  mobile_developer: ["React Native", "Swift", "Kotlin", "iOS", "Android"],
  rust_developer: ["Rust", "Tokio", "WebAssembly", "Systems Programming"],
  python_developer: ["Python", "Django", "FastAPI", "Pandas", "Pytest"],
  go_developer: ["Go", "gRPC", "Kubernetes", "Microservices", "Profiling"],
  typescript_developer: ["TypeScript", "Node.js", "React", "tRPC", "Zod"],
  product_engineer: ["TypeScript", "React", "Node.js", "Product Thinking", "Analytics"],
  developer_advocate: ["Public Speaking", "Technical Writing", "Community", "Demos", "DX"],
  technical_writer: ["Documentation", "API Reference", "Information Architecture", "Docs-as-Code"],
  open_source_maintainer: ["Maintainership", "Release Engineering", "Code Review", "Issue Triage", "Go", "TypeScript"],
  startup_founder: ["Fundraising", "Product Strategy", "Hiring", "Go-to-Market"],
  cto: ["Architecture", "Technical Strategy", "Team Building", "Hiring", "System Design"],
  vp_engineering: ["Engineering Management", "Org Design", "Hiring", "Platform", "Reliability"],
  devrel_lead: ["Community", "Developer Relations", "Content Strategy", "Events", "Advocacy"],
};

export const slugifyHandle = (first, last, roleKey) => {
  const base = `${first}-${last}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${roleKey.split("_")[0]}`;
};

export const displayName = (first, last) => `${first} ${last}`;
