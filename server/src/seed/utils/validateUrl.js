/**
 * Validates a URL that will be stored in the database.
 *
 * Rules:
 *  - must parse as an absolute http/https URL
 *  - performs a real HTTP request, following redirects
 *  - rejects 4xx/5xx (including 403 and 404)
 *  - returns useful diagnostics for the seed audit report
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;

// A URL's reachability does not change while the seed runs, so each distinct
// URL is fetched exactly once. Without this the seed issued ~750 identical
// network requests for a pool of ~28 already-validated URLs.
const memo = new Map();

export const validateUrl = async (rawUrl, options = {}) => {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    method = "GET",
    headers = {},
    // Some hosts reject requests without a browser-like UA.
    userAgent = "ForgeNet-Seed/1.0 (+local development validation)",
  } = options;

  const result = (extra = {}) => ({
    valid: false,
    status: null,
    contentType: null,
    finalUrl: rawUrl ?? null,
    reason: null,
    ...extra,
  });

  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return result({ reason: "URL is empty" });
  }

  const cacheKey = `${method}:${rawUrl}`;
  if (memo.has(cacheKey)) return memo.get(cacheKey);

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return result({ reason: "URL syntax is invalid" });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return result({ reason: `Unsupported protocol: ${parsed.protocol}` });
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(parsed.toString(), {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": userAgent, ...headers },
      });

      const contentType = response.headers.get("content-type");
      const out = result({
        valid: response.ok,
        status: response.status,
        contentType,
        finalUrl: response.url || parsed.toString(),
        reason: response.ok ? null : `HTTP ${response.status}`,
      });
      memo.set(cacheKey, out);
      return out;
    } catch (error) {
      lastError = error;
      // Retry transient network failures before giving up.
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const out = result({
    reason: lastError?.name === "AbortError" ? "Request timed out" : `Network error: ${lastError?.message ?? "unknown"}`,
  });
  memo.set(cacheKey, out);
  return out;
};

export const clearUrlValidationCache = () => memo.clear();
