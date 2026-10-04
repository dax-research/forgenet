import { validateUrl } from "./validateUrl.js";

/**
 * Validates an image URL before it is written to the database.
 *
 * Performs a real HTTP request, follows redirects, and requires:
 *   - a 2xx status
 *   - a Content-Type beginning with "image/"
 *
 * This rejects HTML responses served with a 200, 404s, 403s, and 5xx. Only a
 * URL that passes is ever returned, so the seed can never write a record
 * containing a known-broken image.
 */
export const validateImageUrl = async (url, options = {}) => {
  const base = { valid: false, status: null, contentType: null, finalUrl: null, reason: null };

  if (!url || typeof url !== "string" || !url.trim()) {
    return { ...base, reason: "Image URL is empty" };
  }

  const http = await validateUrl(url, options);

  if (!http.valid) {
    return {
      valid: false,
      status: http.status,
      contentType: http.contentType,
      finalUrl: http.finalUrl,
      reason: http.reason,
    };
  }

  const contentType = http.contentType ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return {
      valid: false,
      status: http.status,
      contentType,
      finalUrl: http.finalUrl,
      reason: `Response is not an image (Content-Type: ${contentType || "missing"})`,
    };
  }

  return {
    valid: true,
    status: http.status,
    contentType,
    finalUrl: http.finalUrl,
    reason: null,
  };
};

export default validateImageUrl;
