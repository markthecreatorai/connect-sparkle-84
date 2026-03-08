/**
 * Returns the canonical site URL for external-facing links (affiliate, share, etc.).
 * Uses the custom domain when published, falls back to window.location.origin in dev/preview.
 */
export function getSiteUrl(): string {
  const customDomain = "https://avengersplataforma.lovable.app";
  // In production the hostname will match the custom domain;
  // in preview/dev we still want affiliate links to point to the real domain.
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return window.location.origin;
  }
  return customDomain;
}
