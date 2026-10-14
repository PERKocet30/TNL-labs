/* TNL LABS admin v1.0 — 2026-10-14. One member's record (split from 3-people.js v2.2).
   "On par with Microsoft or Google": a header that says who and where they
   stand, the everyday actions in one bar, and the rest in tabs —
   Overview (the numbers, grouped, and anything that needs a look),
   Account (every field, grouped into cards; sign-out and suspend kept
   apart at the bottom), Activity (posts, the rep log with dates) and Notes. */
const PTABS = [["overview", "Overview"], ["account", "Account"], ["activity", "Activity"], ["notes", "Notes"]];
const REPKIND = { like_received: "Like on their work", share_received: "Their work was shared", collab_accepted: "Collab accepted", sale_made: "Made a sale",
  delivery_confirmed: "Delivery confirmed", feature: "Featured by an admin", sound_used: "Their sound was used", pinned: "Saved to a board",
  admin_grant: "Rep added by an admin", admin_deduct: "Rep removed by an admin" };

async function openPerson(username) {
  PERSON = { username, data: null, tab: "overview" }; paintPerson();
  try { PERSON.data = await req("/api/admin/people/" + encodeURIComponent(username)); } catch (e) { toast(e.message); PERSON = null; }
  paintPerson();
}
function closePerson() { PERSON = null; paintPerson(); }
function paintPerson() {
  let el = $("#person");
  if (!PERSON) { if (el) el.remove(); document.body.style.overflow = ""; return; }
  if (!el) { el = document.createElement("div"); el.id = "person"; el.className = "scrim"; $("#layer").appendChild(el); }
  document.body.style.overflow = "hidden";
  const top = el.firstChild ? el.firstChild.scrollTop : 0;
  el.innerHTML = `<aside class="drawer rec" role="dialog" aria-modal="true" aria-label="Member record">${personHTML()}</aside>`;
  el.firstChild.scrollTop = top;
  el.onclick = (e) => { if (e.target === el) closePerson(); };
  wirePerson(el);
}

/* a labelled value; "Not provided" rather than a bare dash */
const fld = (label, value, extra = "") => `<div class="fd"><dt>${label}</dt><dd>${value === "" || value == null ? `<span class="dim">Not provided</span>` : value}${extra}</dd></div>`;
const met = (label, v, d = "") => `<div class="mt"><span>${label}</span><b>${v}</b>${d ? `<i>${d}</i>` : ""}</div>`;

function personHTML() {
  const d = PERSON.data;
  const bar = `<div class="rec-bar"><span class="mono">People / ${esc(PERSON.username)}</span>
    ${d ? `<a class="btn ghost sm" href="/u/${encodeURIComponent(d.person.username)}" target="_blank" rel="noopener">View profile ${I.out}</a>` : ""}
    <button class="ib" data-close aria-label="Close">${I.x}</button></div>`;
  if (!d) return bar + `<div class="empty">Loading record…</div>`;
  const p = d.person, s = d.stats;
  const head = `<div class="rec-hd">${av(p, "lg")}<div class="rec-id"><h2>${esc(p.displayName)}</h2>
      <span class="dim">@${esc(p.username)} · Member #${p.id}${p.role ? " · " + esc(p.role) : ""}</span>
      <div class="rec-tags">${badge(pstatus({ ...p, lastActive: p.lastSeen }))}${p.isAdmin ? `<span class="tag on">Admin</span>` : ""}
        ${p.verified ? `<span class="tag">Email confirmed</span>` : `<span class="tag warn">Email not confirmed</span>`}${p.payouts ? `<span class="tag">Payouts on</span>` : ""}</div></div></div>
    <div class="acts">
      <button class="btn sm" data-dm="${esc(p.username)}">${I.msg} Message</button>
      ${!p.verified ? `<button class="btn ghost sm" data-pa="verify">Confirm email</button>` : ""}
      <button class="btn ghost sm" data-pa="rep">Adjust rep</button>
      <button class="btn ghost sm" data-pa="feature">Feature +40</button>
      ${p.email ? `<button class="btn ghost sm" data-copy="${esc(p.email)}">Copy email</button>` : ""}
    </div>
    ${subTabs(PTABS.map(([k, l]) => [k, l + (k === "notes" && d.note && d.note.body ? " ·" : "")]), PERSON.tab, "data-ptab")}`;
  return bar + head + `<div class="rec-body">${({ overview: recOverview, account: recAccount, activity: recActivity, notes: recNotes })[PERSON.tab](d)}</div>`;
}

function recOverview(d) {
  const p = d.person, s = d.stats;
  const flags = [];
  if (p.suspended) flags.push("Account is suspended — they can't sign in.");
  if (s.reportsAgainst) flags.push(`${s.reportsAgainst} report${s.reportsAgainst === 1 ? "" : "s"} involving them.`);
  if (s.blockedBy) flags.push(`Blocked by ${s.blockedBy} member${s.blockedBy === 1 ? "" : "s"}.`);
  if (!p.verified) flags.push("Email not confirmed.");
  if (s.listings && !p.payouts) flags.push("Selling, but payouts aren't set up — they can't be paid.");
  if (!p.lastSeen || p.lastSeen < Date.now() - 30 * ADAY_MS) flags.push("Hasn't opened the app in 30+ days.");
  return `${flags.length ? card("Needs a look", `<ul class="flags">${flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`) : ""}
    ${card("Reputation", `<div class="mts">${met("Rep", num(p.rep))}${met("Level", "L" + p.level, esc(p.levelName))}${met("Commission", p.fee + "%", "on their sales")}</div>`)}
    ${card("Community", `<div class="mts">${met("Followers", num(s.followers))}${met("Following", num(s.following))}${met("Collabs", num(s.collabs), s.pendingCollabs ? s.pendingCollabs + " pending" : "")}</div>`)}
    ${card("Contribution", `<div class="mts">${met("Posts", num(s.posts), num(s.work) + " published work")}${met("Feedback received", num(s.likesGot + s.commentsGot), num(s.likesGot) + " likes · " + num(s.commentsGot) + " comments")}
      ${met("Feedback given", num(s.feedbackGiven))}${met("Messages sent", num(s.messages), num(s.chats) + " chats")}${met("Tournament", s.entered ? "Entered" : "—", num(s.votes) + " votes cast")}</div>`)}
    ${card("Commerce", `<div class="mts">${met("Sales", money(s.gross))}${met("Items sold", num(s.sold))}${met("Items bought", num(s.bought))}${met("Active listings", num(s.listings))}</div>`)}`;
}

function recAccount(d) {
  const p = d.person, s = d.stats;
  const links = (p.links && p.links.length ? p.links.map((l) => l.url || l) : p.link ? [p.link] : [])
    .map((u) => /^https?:\/\//i.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//, ""))}</a>` : esc(u)).join("<br>");
  return card("Profile", `<dl class="fds">${fld("Display name", esc(p.displayName))}${fld("Username", "@" + esc(p.username))}${fld("Member ID", "#" + p.id)}
      ${fld("What they make", esc((p.roles && p.roles.length ? p.roles : [p.role]).filter(Boolean).join(" · ")))}${fld("Pronouns", esc(p.pronouns))}
      ${fld("Bio", esc(p.bio))}${fld("Links", links)}${fld("Profile colour", esc(p.accent ? p.accent.charAt(0).toUpperCase() + p.accent.slice(1) : ""))}</dl>`)
    + card("Contact & sign-in", `<dl class="fds">${fld("Email", esc(p.email), p.email ? ` <button class="btn ghost sm" data-copy="${esc(p.email)}">Copy</button>` : "")}
      ${fld("Email status", p.verified ? "Confirmed" : `<span class="tag warn">Not confirmed</span>`)}${fld("Joined", pwhen(p.joined))}
      ${fld("Last opened the app", p.lastSeen ? pwhen(p.lastSeen) : "", p.lastSeen ? ` <span class="dim">· ${ago(p.lastSeen)}</span>` : "")}${fld("Signed in on", s.sessions + " device" + (s.sessions === 1 ? "" : "s"))}</dl>`)
    + card("Payments", `<dl class="fds">${fld("Payouts", p.payouts ? "On — Stripe is set up" : p.stripeConnected ? "Started, not finished" : "Not set up")}
      ${fld("Commission", `${p.fee}% <span class="dim">· set by level L${p.level} ${esc(p.levelName)}</span>`)}${fld("Sales to date", money(s.gross))}</dl>`)
    + card("Access", `<dl class="fds">${fld("Role", p.isAdmin ? "Admin" : "Member")}${fld("Account status", p.suspended ? `<span class="tag warn">Suspended</span>` : "Active")}</dl>`)
    + `<section class="rc danger"><header><h3>Sign-in and suspension</h3></header>
      <div class="dz"><div><b>Sign out everywhere</b><span>Every device they're signed in on (${s.sessions}). They can sign straight back in.</span></div><button class="btn ghost sm" data-pa="signout">Sign out</button></div>
      ${p.isAdmin ? "" : `<div class="dz"><div><b>${p.suspended ? "Restore account" : "Suspend account"}</b><span>${p.suspended ? "They can sign in again." : "Signs them out and stops them signing back in. Their work stays up."}</span></div>
        <button class="btn ${p.suspended ? "ghost" : "danger"} sm" data-pa="suspend">${p.suspended ? "Restore" : "Suspend"}</button></div>`}</section>`;
}

function recActivity(d) {
  return card("Recent posts", d.posts.length ? `<div class="thumbs">${d.posts.map((x) => `<a href="/p/${x.id}" target="_blank" rel="noopener" title="${esc(x.labName === "Profile" ? "Profile" : "// " + x.labName)} · ${x.likes} likes · ${pday(x.createdAt)}">${x.thumbUrl ? `<img src="${esc(x.thumbUrl)}" alt="" loading="lazy">` : esc(x.body || (x.video ? "Video" : "Post"))}</a>`).join("")}</div>`
      : `<div class="empty">Hasn't posted yet.</div>`, d.posts.length ? "latest " + d.posts.length : "")
    + card("Rep history", d.rep.length ? `<table class="tbl"><thead><tr><th>Event</th><th class="num">Points</th><th class="num">Date</th></tr></thead><tbody>${d.rep.map((r) =>
      `<tr><td>${esc(REPKIND[r.kind] || r.kind.replace(/_/g, " "))}</td><td class="num">${r.amount > 0 ? "+" : ""}${r.amount}</td><td class="num dim">${pday(r.at)}</td></tr>`).join("")}</tbody></table>`
      : `<div class="empty">No rep yet.</div>`, "every point is logged");
}

function recNotes(d) {
  return card("Private note", `<p class="dim" style="font-size:12.5px;margin-bottom:8px">Only admins see this.</p>
    <textarea class="in" id="pnote" rows="5" maxlength="2000" placeholder="How you know them, what they make, what they need…">${esc(d.note ? d.note.body : "")}</textarea>
    <div class="row sp" style="margin-top:8px"><span class="mono">${d.note && d.note.at ? "Saved " + pwhen(d.note.at) + (d.note.by ? " by @" + esc(d.note.by) : "") : "Not saved yet"}</span><button class="btn sm" data-pa="note">Save note</button></div>`);
}

function wirePerson(el) {
  const u = PERSON && PERSON.username;
  $("[data-close]", el).onclick = closePerson;
  $$("[data-ptab]", el).forEach((b) => b.onclick = () => { PERSON.tab = b.dataset.ptab; paintPerson(); });
  $$("[data-copy]", el).forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copied"); } catch (e) { toast(b.dataset.copy); } });
  $$("[data-dm]", el).forEach((b) => b.onclick = () => window.open("/?dm=" + encodeURIComponent(b.dataset.dm), "_blank"));
  $$("[data-pa]", el).forEach((b) => b.onclick = async () => {
    const a = b.dataset.pa, base = "/api/admin/members/" + encodeURIComponent(u), p = PERSON.data.person;
    if (a === "note") return act(() => req("/api/admin/people/" + encodeURIComponent(u) + "/note", { method: "POST", body: { body: $("#pnote").value } }), "Note saved").then(refreshPerson);
    if (a === "verify") return act(() => req(base + "/verify", { method: "POST" }), "Email confirmed").then(refreshPerson);
    if (a === "feature") { if (!(await confirmIt(`Feature @${u}?`, "+40 rep, and they're told you featured their work. Logged and permanent.", { ok: "Feature" }))) return;
      return act(() => req(base + "/feature", { method: "POST" }), "Featured — +40 rep").then(refreshPerson); }
    if (a === "rep") {
      const v = await promptIt(`Adjust @${u}'s rep`, { body: `Now ${p.rep}. Use + or − (up to 500). Written to the rep log with your name.`, placeholder: "+25 or -10", inputmode: "numeric" });
      if (v == null || !v.trim()) return;
      const delta = Math.round(Number(v.replace(/[^\d+-]/g, "")));
      if (!delta) return toast("Enter a number like +25 or -10");
      const reason = await promptIt("Why?", { placeholder: "e.g. ran the workshop", body: "Kept in the admin log." });
      if (reason == null) return;
      return act(() => req(base + "/rep", { method: "POST", body: { delta, reason } }), (r) => `@${u} now has ${r.rep} rep`).then(refreshPerson);
    }
    if (a === "signout") { if (!(await confirmIt(`Sign @${u} out everywhere?`, "Every device they're signed in on. They can sign straight back in.", { ok: "Sign out" }))) return;
      return act(() => req("/api/admin/people/" + encodeURIComponent(u) + "/signout", { method: "POST" }), (r) => `Signed out of ${r.sessions} device${r.sessions === 1 ? "" : "s"}`).then(refreshPerson); }
    if (a === "suspend") {
      const on = !p.suspended;
      if (!(await confirmIt(on ? `Suspend @${u}?` : `Restore @${u}?`, on ? "They're signed out now and can't sign back in. Their work stays up." : "They can sign in again.", { ok: on ? "Suspend" : "Restore", danger: on }))) return;
      return act(() => req(base + "/suspend", { method: "POST", body: { suspended: on } }), on ? "Suspended" : "Restored").then(refreshPerson);
    }
  });
}
async function refreshPerson() {
  if (!PERSON) return;
  try { PERSON.data = await req("/api/admin/people/" + encodeURIComponent(PERSON.username)); } catch (e) {}
  paintPerson(); if (TAB === "people") { await LOADERS.people(); paint(); }
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && PERSON && !$(".modal")) closePerson(); });
