import { validateUrl } from "./validateUrl.js";

/**
 * Deterministic RNG (mulberry32) so a given seed always reproduces the exact
 * same dataset. Re-running `npm run seed:demo` is therefore idempotent.
 */
export const makeRng = (seed) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Picks `count` distinct items (or fewer if the array is small). */
    sample: (arr, count) => {
      const copy = [...arr];
      const out = [];
      const n = Math.min(count, copy.length);
      for (let i = 0; i < n; i++) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      return out;
    },
    bool: (p = 0.5) => next() < p,
    /** Weighted pick: entries of [value, weight]. */
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [value, weight] of entries) {
        r -= weight;
        if (r <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
  };
};

export const DEMO_SEED = 20261004;

/**
 * Image hosts used for the demo dataset.
 *
 * picsum.photos serves deterministic photographs for a given seed, and
 * placehold.co renders a labelled placeholder. Both are validated with a real
 * HTTP request before anything is written to the database, and the deterministic
 * seeds mean re-running the seed produces the same images.
 *
 * Photographs are generic placeholders (landscapes, objects, cityscapes) and are
 * not depictions of any real person, so no individual's likeness is used.
 */
export const IMAGE_HOSTS = {
  // Deterministic stock photography.
  photo: "https://picsum.photos/seed",
  // Deterministic labelled placeholder, useful for community/project tiles.
  placeholder: "https://placehold.co",
  // Generated avatar illustrations (SVG).
  avatar: "https://api.dicebear.com/9.x",
};

export const photoUrl = (seed, width, height) =>
  `${IMAGE_HOSTS.photo}/${encodeURIComponent(seed)}/${width}/${height}`;

export const placeholderUrl = (seed, width, height, bg = "1f6feb", fg = "ffffff") =>
  `${IMAGE_HOSTS.placeholder}/${width}x${height}/${bg}/${fg}.png?text=${encodeURIComponent(seed)}`;

export const avatarUrl = (seed) =>
  `${IMAGE_HOSTS.avatar}/avataaars/svg?seed=${encodeURIComponent(seed)}`;

/**
 * A pool of external URLs that are validated live before anything is written.
 *
 * These are stable documentation/community sites, not invented project links —
 * a made-up GitHub URL would be a dead link in the UI, which is exactly what
 * the demo is supposed to avoid. Project-specific URLs therefore point at real,
 * verifiable documentation or the owner's own ForgeNet profile.
 */
const URL_CANDIDATES = {
  github: [
    "https://github.com",
    "https://docs.github.com/en",
    "https://github.com/features/actions",
    "https://docs.github.com/en/repositories",
  ],
  docs: [
    "https://react.dev/learn/thinking-in-react",
    "https://docs.python.org/3/tutorial/",
    "https://doc.rust-lang.org/book/",
    "https://go.dev/doc/effective_go",
    "https://www.typescriptlang.org/docs/",
    "https://nodejs.org/en/docs/learn/getting-started/introduction-to-nodejs",
    "https://kubernetes.io/docs/concepts/",
    "https://pytorch.org/docs/stable/index.html",
    "https://huggingface.co/docs/index",
    "https://numpy.org/doc/stable/",
    "https://docs.docker.com/get-started/",
    "https://www.postgresql.org/docs/current/",
    "https://redis.io/docs/latest/",
    "https://grpc.io/docs/what-is-grpc/core-concepts/",
    "https://owasp.org/www-project-top-ten/",
    "https://www.nist.gov/itl",
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    "https://fastapi.tiangolo.com/",
    "https://docs.sqlalchemy.org/",
    "https://clickhouse.com/docs",
  ],
  community: [
    "https://arxiv.org/list/cs.AI/recent",
    "https://github.com/topics/machine-learning",
    "https://github.com/topics/rust",
    "https://www.nist.gov",
    "https://owasp.org",
    "https://huggingface.co/papers",
  ],
};

let cached = null;

export const loadValidatedUrls = async ({ log = () => {} } = {}) => {
  if (cached) return cached;

  const validated = {};
  let checked = 0;
  let passed = 0;

  for (const [bucket, urls] of Object.entries(URL_CANDIDATES)) {
    const good = [];
    for (const url of urls) {
      checked++;
      const result = await validateUrl(url);
      if (result.valid) {
        good.push(url);
        passed++;
      } else {
        log(`   url rejected: ${url} (${result.reason})`);
      }
    }
    validated[bucket] = good.length > 0 ? good : ["https://example.org"];
  }

  log(`   URLs validated: ${checked} checked, ${passed} usable`);
  cached = validated;
  return validated;
};
