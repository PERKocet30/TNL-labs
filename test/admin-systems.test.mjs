// Admin · Systems (2026-10-26): "integrate our admin dashboard with Railway,
// GitHub…". /api/admin/systems reads Railway and GitHub with read-only keys and
// tells the admin what's live, what's building and what's waiting for a Push.
// Runs against pretend Railway and GitHub servers; the keys never reach the page.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin-systems");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, admin) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@x.com", "h", now, admin ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); };
U("boss", true); U("ana", false);
db.close();
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

/* pretend Railway (GraphQL) and GitHub (REST) */
const seen = { railwayAuth: null, githubAuth: null, railwayBody: null, calls: 0 };
const LIVE = "aaaaaaa1234567890";
const fake = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    seen.calls++;
    const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.url === "/graphql") {
      seen.railwayAuth = req.headers["project-access-token"] ? "project:" + req.headers["project-access-token"] : req.headers.authorization; seen.railwayBody = JSON.parse(body);
      if (seen.railwayAuth !== "Bearer rw-secret" && seen.railwayAuth !== "project:rw-project") return json(200, { errors: [{ message: "Not Authorized" }] });
      return json(200, { data: { deployments: { edges: [
        { node: { id: "d3", status: "BUILDING", createdAt: new Date(now - 60000).toISOString(), meta: { commitHash: "ccccccc999", commitMessage: "Merge pull request #150 from x/y\n\nNext thing", branch: "main" } } },
        { node: { id: "d2", status: "SUCCESS", createdAt: new Date(now - 3600000).toISOString(), meta: { commitHash: LIVE, commitMessage: "Merge pull request #149 from x/z\n\nGoogle feed", branch: "main" } } },
        { node: { id: "d1", status: "REMOVED", createdAt: new Date(now - 7200000).toISOString(), meta: JSON.stringify({ commitHash: "bbbbbbb1", commitMessage: "older", branch: "main" }) } },
      ] } } });
    }
    seen.githubAuth = req.headers.authorization;
    if (seen.githubAuth !== "Bearer gh-secret") return json(401, { message: "Bad credentials" });
    if (req.url.startsWith("/repos/PERKocet30/TNL-labs/pulls?state=open")) return json(200, [
      { number: 151, title: "Systems tab", head: { ref: "claude/admin-systems", sha: "1111111abc" }, html_url: "https://github.com/x/pull/151", updated_at: new Date(now - 300000).toISOString(), draft: false },
      { number: 152, title: "Something half done", head: { ref: "claude/wip", sha: "2222222abc" }, html_url: "https://github.com/x/pull/152", updated_at: new Date(now - 900000).toISOString(), draft: true }]);
    if (req.url.startsWith("/repos/PERKocet30/TNL-labs/pulls?state=closed")) return json(200, [
      { number: 149, title: "Google feed", merged_at: new Date(now - 3700000).toISOString(), merge_commit_sha: LIVE, html_url: "https://github.com/x/pull/149" },
      { number: 148, title: "Closed, never merged", merged_at: null, merge_commit_sha: "dead", html_url: "https://github.com/x/pull/148" },
      { number: 147, title: "Earlier", merged_at: new Date(now - 90000000).toISOString(), merge_commit_sha: "bbbbbbb1", html_url: "javascript:alert(1)" }]);
    if (req.url.startsWith("/repos/PERKocet30/TNL-labs/commits/1111111abc/check-runs")) return json(200, { check_runs: [{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "success" }] });
    if (req.url.startsWith("/repos/PERKocet30/TNL-labs/commits/2222222abc/check-runs")) return json(200, { check_runs: [{ status: "completed", conclusion: "success" }, { status: "in_progress", conclusion: null }] });
    if (req.url.startsWith("/repos/PERKocet30/TNL-labs/actions/runs")) return json(200, { workflow_runs: [
      { name: "Tests", status: "completed", conclusion: "success", html_url: "https://github.com/x/runs/1", created_at: new Date(now - 3600000).toISOString(), head_sha: LIVE },
      { name: "After deploy", status: "completed", conclusion: "success", html_url: "https://github.com/x/runs/2", created_at: new Date(now - 3500000).toISOString(), head_sha: LIVE }] });
    json(404, { message: "Not Found" });
  });
});
await new Promise((r) => fake.listen(0, r));
const FAKE = `http://localhost:${fake.address().port}`;

const PORT = 8918, B = `http://localhost:${PORT}`;
const env = { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1",
  RAILWAY_API_TOKEN: "rw-secret", RAILWAY_API_URL: FAKE + "/graphql", RAILWAY_PROJECT_ID: "proj-1", RAILWAY_SERVICE_ID: "svc-1", RAILWAY_ENVIRONMENT_ID: "env-1",
  RAILWAY_GIT_COMMIT_SHA: LIVE, GITHUB_TOKEN: "gh-secret", GITHUB_API_URL: FAKE, GITHUB_REPO: "PERKocet30/TNL-labs" };
const start = (extra = {}) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], { cwd: ROOT, env: { ...env, ...extra }, stdio: "ignore" });
const ready = async () => { for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };
const get = (path, who) => fetch(B + path, { headers: who ? { authorization: "Bearer tok-" + who } : {} });
let srv = start();
try {
  await ready();
  console.log("\nADMINS ONLY");
  t("signed out: nothing", (await get("/api/admin/systems")).status === 401);
  t("a member: nothing", (await get("/api/admin/systems", "ana")).status === 403);

  console.log("\nWHAT'S LIVE");
  const r = await get("/api/admin/systems", "boss"), S = await r.json(), raw = JSON.stringify(S);
  t("an answer, with the version this server runs", r.status === 200 && S.live.commit === "aaaaaaa" && S.live.uptimeS >= 0);
  t("the keys never reach the page", !raw.includes("rw-secret") && !raw.includes("gh-secret"));
  t("Railway was asked with the token and this service's ids", seen.railwayAuth === "Bearer rw-secret" && seen.railwayBody.variables.in.projectId === "proj-1"
    && seen.railwayBody.variables.in.serviceId === "svc-1" && seen.railwayBody.variables.in.environmentId === "env-1");

  console.log("\nRAILWAY");
  t("deploys newest first, the PR's title out of the merge message, short commit", S.railway.on && S.railway.deploys.length === 3 && S.railway.deploys[0].status === "BUILDING"
    && S.railway.deploys[1].message === "#149 Google feed" && S.railway.deploys[1].commit === "aaaaaaa");
  t("meta as a string (older deploys) still reads", S.railway.deploys[2].commit === "bbbbbbb");
  t("knows the live deploy and the one in motion", S.railway.current.id === "d2" && S.railway.busy.id === "d3" && S.railway.failed === null && S.railway.behind === false);

  console.log("\nGITHUB");
  t("open PRs with their checks: green, and one still running", S.github.on && S.github.prs.length === 2 && S.github.prs[0].number === 151 && S.github.prs[0].checks === "green"
    && S.github.prs[1].checks === "running" && S.github.prs[1].draft === true);
  t("the branch and a link, for the Push", S.github.prs[0].branch === "claude/admin-systems" && S.github.prs[0].url.includes("/pull/151"));
  t("merged PRs only — closed-unmerged left out — and which one is live", S.github.merges.length === 2 && S.github.merges[0].number === 149 && S.github.merges[0].live === true
    && S.github.merges[1].live === false && !raw.includes("never merged"));
  t("the live-site check after the last merge", S.github.deployCheck && S.github.deployCheck.conclusion === "success" && S.github.deployCheck.sha === "aaaaaaa");
  t("every link the page may follow is GitHub's own; anything else is dropped", [...S.github.prs, S.github.merges[0], S.github.deployCheck].every((x) => /^https:\/\/github\.com\//.test(x.url)) && S.github.merges[1].url === "");

  console.log("\nCACHED");
  const calls = seen.calls;
  const again = await (await get("/api/admin/systems", "boss")).json();
  t("a second look within a minute doesn't ask the services again", again.cached === true && seen.calls === calls);
  await new Promise((r) => setTimeout(r, 5100));
  await get("/api/admin/systems?fresh=1", "boss");
  t("…unless the admin asks to look again (and even then, the services hear from us at most every 5 s)", seen.calls > calls);
  const c2 = seen.calls; await get("/api/admin/systems?fresh=1", "boss");
  t("a held-down Look again doesn't fan out again inside 5 s", seen.calls === c2);

  console.log("\nWHEN A KEY IS WRONG OR MISSING");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ RAILWAY_API_TOKEN: "wrong", GITHUB_TOKEN: "" }); await ready();
  const bad = await (await get("/api/admin/systems", "boss")).json();
  t("a refused Railway token is one plain line, not a crash", bad.railway.on === true && /Not Authorized/.test(bad.railway.error) && !bad.railway.deploys);
  t("…and the wrong key isn't echoed either", !JSON.stringify(bad).includes("wrong"));
  t("GitHub without a key says it's off", bad.github.on === false && !bad.github.error);
  t("the page still gets what the server knows itself", bad.live.commit === "aaaaaaa");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ RAILWAY_API_TOKEN: "", RAILWAY_PROJECT_TOKEN: "rw-project" }); await ready();
  const proj = await (await get("/api/admin/systems", "boss")).json();
  t("a project token (sees this project only) works, sent the way Railway expects", seen.railwayAuth === "project:rw-project" && proj.railway.deploys && proj.railway.deploys.length === 3);
  t("…and never reaches the page", !JSON.stringify(proj).includes("rw-project"));

  console.log("\nTHE PAGE");
  const core = readFileSync(join(ROOT, "public/admin-app/1-core.js"), "utf8"), page = readFileSync(join(ROOT, "public/admin-app/7-systems.js"), "utf8"), html = readFileSync(join(ROOT, "public/admin.html"), "utf8");
  t("Systems is a section under Understand, with its own script", /\["systems", "Systems"\]/.test(core) && /"health", "systems"\]/.test(core) && /7-systems\.js/.test(html));
  t("the page says plainly when a key isn't set", /RAILWAY_PROJECT_TOKEN/.test(page) && /GITHUB_TOKEN/.test(page) && /RAILWAY\.md/.test(page));
  t("it never takes a token from the page or stores one", !/localStorage\.(set|get)Item\(["'](railway|github)/i.test(page));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
