// media-proxy — a tiny authenticated doorman in front of this repo's
// release files.
//
// Why this exists: GitHub's release file servers don't send CORS headers, so
// the course site's page (on github.io, Vercel, …) is not allowed to *read*
// the bytes of the encrypted videos in the browser. This worker fetches them
// server-side and returns the very same bytes with Access-Control-Allow-Origin
// set.
//
// Two modes — both automatic, chosen by whether the workflow gave the worker
// a GH_TOKEN secret:
//   • Public repo: plain passthrough, no token needed.
//   • Private repo: every request to GitHub carries the token (a read-only
//     fine-grained PAT). Without it a private repo's releases are invisible
//     to anonymous readers — GitHub answers 404.
//
// Endpoints:
//   GET /releases?per_page=100&page=N   → the repo's release list (JSON),
//     edge-cached ~2 minutes. The library reads this instead of calling
//     api.github.com directly — required on a private repo, and on a public
//     one it lifts the per-visitor rate limit.
//   GET /?url=<release-file-url>        → the bytes of one release file.
//
// Safety: it only ever serves files from THIS repository's releases
// (ALLOW_BASE allowlist, set by the workflow at deploy time) — and the files
// themselves are AES-256 encrypted, so even the proxy URLs are useless
// without the site's ID + password.
//
// Deployed automatically by .github/workflows/drive-to-webm.yml when the
// CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID secrets are set
// (Cloudflare free plan — no card needed).

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const u = new URL(request.url);
    const auth = env.GH_TOKEN ? { Authorization: "Bearer " + env.GH_TOKEN } : {};

    /* ── Release list (JSON) ────────────────────────────────────────── */
    if (u.pathname.replace(/\/+$/, "") === "/releases") {
      if (!env.GH_REPO) {
        return new Response("not configured", { status: 500, headers: cors });
      }
      const api = "https://api.github.com/repos/" + env.GH_REPO +
        "/releases?per_page=" + (u.searchParams.get("per_page") || "100") +
        "&page=" + (u.searchParams.get("page") || "1");
      const upstream = await fetch(api, {
        headers: Object.assign({
          Accept: "application/vnd.github+json",
          "User-Agent": "COURSES_404-Media-Proxy",
        }, auth),
        cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 120 } },
      });
      const headers = new Headers(upstream.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      if (upstream.ok) headers.set("Cache-Control", "public, max-age=120");
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    /* ── One release file (bytes) ───────────────────────────────────── */
    const target = u.searchParams.get("url") || "";
    if (!target.startsWith(env.ALLOW_BASE)) {
      return new Response("forbidden", { status: 403, headers: cors });
    }
    const fwd = { "User-Agent": "COURSES_404-Media-Proxy" };
    if (request.headers.get("range")) fwd.Range = request.headers.get("range");
    const upstream = await fetch(target, {
      headers: Object.assign(fwd, auth),
      redirect: "follow",
    });
    const out = new Headers(upstream.headers);
    out.set("Access-Control-Allow-Origin", "*");
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
