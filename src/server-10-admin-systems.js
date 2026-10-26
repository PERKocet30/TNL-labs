/* ================================================================
   ADMIN · SYSTEMS v1.0 — 2026-10-26. "Is there any way to integrate our admin
   dashboard with Google or Cloudflare, Railway, GitHub." Part 1: Railway and
   GitHub, read-only, so the admin's Systems page can say which version is
   live, whether a deploy is stuck, and what is waiting for a Push.
     GET /api/admin/systems   (admins only)
   Each service is off until its key is in Railway → Variables (RAILWAY.md):
     Railway  RAILWAY_PROJECT_TOKEN (Project → Settings → Tokens: sees this
              project only — preferred) or RAILWAY_API_TOKEN (an account
              token). Project, service and environment ids are the ones
              Railway sets on every deploy (RAILWAY_PROJECT_ID etc.);
              override with RAILWAY_SYSTEMS_* to watch another service.
     GitHub   GITHUB_TOKEN (a fine-grained token: this repo, read-only on
              Actions, Contents and Pull requests; a PR's tests come from
              its Actions runs, since personal tokens can't have Checks) + GITHUB_REPO
              (owner/name, default PERKocet30/TNL-labs).
   The keys never leave the server: the page gets numbers and names, never a
   token, and an error from a service is reported as one plain line.
   Answers are cached for 60 s (5 s on "Look again") and limited per admin, so
   a refresh-happy admin can't run up the APIs; links are only ever GitHub's own. test/admin-systems.test.mjs runs it against pretend services.
================================================================ */
const SYS_ENV = (k, d = "") => (process.env[k] || "").trim() || d;
const SYS = {
  railwayToken: () => SYS_ENV("RAILWAY_API_TOKEN"), railwayProjectToken: () => SYS_ENV("RAILWAY_PROJECT_TOKEN"),
  railwayUrl: () => SYS_ENV("RAILWAY_API_URL", "https://backboard.railway.com/graphql/v2"),
  railwayIds: () => ({ projectId: SYS_ENV("RAILWAY_SYSTEMS_PROJECT_ID", SYS_ENV("RAILWAY_PROJECT_ID")),
    serviceId: SYS_ENV("RAILWAY_SYSTEMS_SERVICE_ID", SYS_ENV("RAILWAY_SERVICE_ID")),
    environmentId: SYS_ENV("RAILWAY_SYSTEMS_ENVIRONMENT_ID", SYS_ENV("RAILWAY_ENVIRONMENT_ID")) }),
  githubToken: () => SYS_ENV("GITHUB_TOKEN"),
  githubUrl: () => SYS_ENV("GITHUB_API_URL", "https://api.github.com"),
  githubRepo: () => SYS_ENV("GITHUB_REPO", "PERKocet30/TNL-labs"),
};
const SYS_CACHE = { at: 0, body: null };
const sysWhen = (s) => { const t = Date.parse(s || ""); return Number.isFinite(t) ? t : null; };
const sysLine = (s) => String(s || "").split("\n")[0].trim().slice(0, 160);
/* a merge commit reads "Merge pull request #149 from …" then the PR's title on a later line — show the title */
const sysTitle = (msg) => { const lines = String(msg || "").split("\n").map((l) => l.trim()).filter(Boolean), m = /^Merge pull request #(\d+)/.exec(lines[0] || "");
  return m && lines[1] ? `#${m[1]} ${lines[1]}`.slice(0, 160) : sysLine(msg); };

/* Railway: the last few deploys of this service, newest first. */
async function sysRailway() {
  const token = SYS.railwayToken(), ptoken = SYS.railwayProjectToken(), ids = SYS.railwayIds();
  if (!token && !ptoken) return { on: false };
  if (!ids.projectId || !ids.serviceId) return { on: true, error: "Railway didn't tell the app its project and service ids." };
  const query = `query($in: DeploymentListInput!) { deployments(input: $in, first: 8) { edges { node { id status createdAt meta } } } }`;
  try {
    const r = await fetch(SYS.railwayUrl(), { method: "POST", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", ...(ptoken ? { "Project-Access-Token": ptoken } : { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ query, variables: { in: { projectId: ids.projectId, serviceId: ids.serviceId, ...(ids.environmentId ? { environmentId: ids.environmentId } : {}) } } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) return { on: true, error: sysLine(j.errors?.[0]?.message || `Railway answered ${r.status}.`) };
    const deploys = (j.data?.deployments?.edges || []).map(({ node: n }) => {
      let meta = n.meta || {}; if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = {}; } }
      return { id: n.id, status: String(n.status || "").toUpperCase(), at: sysWhen(n.createdAt),
        commit: String(meta.commitHash || "").slice(0, 7), message: sysTitle(meta.commitMessage), branch: meta.branch || "" };
    });
    return { on: true, deploys };
  } catch (e) { return { on: true, error: /abort|timeout/i.test(e.message) ? "Railway didn't answer in time." : "Couldn't reach Railway." }; }
}

/* GitHub: what's waiting for a Push, what went in lately, and whether the live check passed. */
async function sysGithub(liveCommit) {
  const token = SYS.githubToken(), repo = SYS.githubRepo();
  if (!token) return { on: false };
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { on: true, error: "GITHUB_REPO must be owner/name." };
  const base = `${SYS.githubUrl()}/repos/${repo}`;
  const gh = async (path) => {
    const r = await fetch(base + path, { signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "GitHub refused the token." : r.status === 404 ? "GitHub can't find that repo with this token." : `GitHub answered ${r.status}.`);
    return r.json();
  };
  const ghUrl = (u) => /^https:\/\/github\.com\//.test(String(u || "")) ? u : "";   // a link the page may follow: GitHub's own, nothing else
  /* a PR's tests: its workflow runs (Actions: read — personal tokens can't have Checks) */
  const checksOf = (runs) => {
    const list = (runs?.workflow_runs || []).filter((w) => !/after deploy/i.test(w.name || ""));
    if (!list.length) return "none";
    if (list.some((c) => c.status !== "completed")) return "running";
    return list.every((c) => ["success", "skipped", "neutral"].includes(c.conclusion)) ? "green" : "red";
  };
  try {
    const [open, closed] = await Promise.all([gh("/pulls?state=open&per_page=10&sort=updated&direction=desc"),
      gh("/pulls?state=closed&sort=updated&direction=desc&per_page=12")]);
    const prs = await Promise.all(open.map(async (p) => {
      let checks = "none"; try { checks = checksOf(await gh(`/actions/runs?head_sha=${encodeURIComponent(p.head.sha)}&per_page=20`)); } catch {}
      return { number: p.number, title: sysLine(p.title), branch: p.head.ref, sha: String(p.head.sha).slice(0, 7), url: ghUrl(p.html_url),
        updatedAt: sysWhen(p.updated_at), draft: !!p.draft, checks };
    }));
    const merges = closed.filter((p) => p.merged_at).slice(0, 8).map((p) => ({ number: p.number, title: sysLine(p.title), sha: String(p.merge_commit_sha || "").slice(0, 7),
      url: ghUrl(p.html_url), mergedAt: sysWhen(p.merged_at), live: !!liveCommit && String(p.merge_commit_sha || "").startsWith(liveCommit) }));
    let deployCheck = null;
    try {
      const runs = await gh("/actions/runs?branch=main&per_page=6");
      const run = (runs.workflow_runs || []).find((w) => /after deploy/i.test(w.name || ""));
      if (run) deployCheck = { status: run.status, conclusion: run.conclusion, url: ghUrl(run.html_url), at: sysWhen(run.created_at), sha: String(run.head_sha || "").slice(0, 7) };
    } catch {}
    return { on: true, repo, prs, merges, deployCheck };
  } catch (e) { return { on: true, error: /abort|timeout/i.test(e.message) ? "GitHub didn't answer in time." : sysLine(e.message) }; }
}

/* Cached a minute; "Look again" asks afresh, but a held-down button can't run up the APIs: 10 looks a minute per admin,
   each look fanning out to the services at most once every 5 s. */
app.get("/api/admin/systems", auth, admin, rateLimit({ max: 10, windowMs: 60000, key: "user" }), async (req, res) => {
  const now = Date.now();
  if (SYS_CACHE.body && now - SYS_CACHE.at < (req.query.fresh ? 5000 : 60000)) return res.json({ ...SYS_CACHE.body, cached: true });
  const liveCommit = (process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 7);
  const [railway, github] = await Promise.all([sysRailway(), sysGithub(liveCommit)]);
  const live = { commit: liveCommit || null, uptimeS: Math.round(process.uptime()), node: process.version };
  if (railway.deploys) {
    const cur = railway.deploys.find((d) => d.status === "SUCCESS");
    const busy = railway.deploys.find((d) => ["BUILDING", "DEPLOYING", "INITIALIZING", "QUEUED", "WAITING"].includes(d.status));
    const bad = railway.deploys[0] && ["FAILED", "CRASHED"].includes(railway.deploys[0].status) ? railway.deploys[0] : null;
    railway.current = cur || null; railway.busy = busy || null; railway.failed = bad;
    railway.behind = !!(cur && cur.commit && liveCommit && cur.commit !== liveCommit);
  }
  SYS_CACHE.at = now; SYS_CACHE.body = { at: now, live, railway, github };
  res.json(SYS_CACHE.body);
});
