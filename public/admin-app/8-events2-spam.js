/* LABS admin · Events · Spam check v1.0 — 2026-10-27. "Any account with multiple linked accounts needs to be
   deleted and their vote disregarded… I'll manually do." Under an event's vote check: the tournament's voters in
   linked groups (same phone, same network) with plain reasons to look. Remove as spam → suspended and their
   votes off the scoreboard; Undo brings both back. server/trust/spam.js. */
LOADERS.spam = async () => { D.spam = EVID ? await req("/api/admin/events/" + EVID + "/spam").catch(() => null) : null; };
function spamHTML() {
  const S = D.spam;
  if (!S) return "";
  const head = `<h2 class="sec">Spam check <span class="mono">linked accounts that voted · phones since Oct 27, networks since Oct 26</span></h2>`;
  if (!S.groups.length) return head + `<div class="panel"><div class="empty">No linked accounts among the voters.</div></div>`;
  const person = (p) => `<div class="li" style="align-items:flex-start"><div class="b"><b style="font-weight:500"><span data-person="${esc(p.username)}" style="cursor:pointer;text-decoration:underline">@${esc(p.username)}</span>${p.isAdmin ? ` <span class="tag">admin</span>` : ""}${p.removed ? ` <span class="tag warn">removed</span>` : ""}</b>
      <span>${esc(p.email)}${p.throwaway ? " · throwaway" : ""} · joined ${esc(ago(p.joined))} ago${p.verified ? "" : " · not confirmed"} · ${p.posts} post${p.posts === 1 ? "" : "s"}${p.avatarUrl ? "" : " · no photo"}</span>
      <span>${p.votes} vote${p.votes === 1 ? "" : "s"}${p.votedFor.length ? " for " + p.votedFor.map((a) => "@" + esc(a)).join(", ") : ""}</span></div></div>`;
  const group = (g) => {
    const live = g.people.filter((p) => !p.removed && !p.isAdmin).map((p) => p.username), gone = g.people.filter((p) => p.removed).map((p) => p.username);
    return `<div class="panel" style="margin-bottom:12px">
      <div class="set"><div class="t"><b>${g.size} accounts${g.votedFor.length ? " · voted for " + g.votedFor.slice(0, 3).map((v) => `@${esc(v.author)} (${v.n})`).join(", ") : ""}</b>
        <span>${g.reasons.map(esc).join(" · ")}</span></div>
        ${live.length ? `<button class="btn ghost sm" data-spamrm="${esc(live.join(","))}">Remove as spam</button>` : ""}${gone.length ? `<button class="btn ghost sm" data-spamundo="${esc(gone.join(","))}">Undo</button>` : ""}</div>
      <div class="list">${g.people.map(person).join("")}</div></div>`;
  };
  return head + `<p class="dim" style="font-size:12px;margin:0 0 10px">A family at home or people on one phone carrier can look linked too. Remove suspends the accounts and takes their votes off the scoreboard — Undo brings both back.</p>`
    + S.groups.map(group).join("");
}
function spamWire(reload) {
  $$("[data-spamrm]").forEach((b) => b.onclick = async () => {
    const names = b.dataset.spamrm.split(",");
    if (!(await confirmIt(`Remove ${names.length} account${names.length === 1 ? "" : "s"} as spam?`, `${names.map((n) => "@" + n).join(", ")} will be signed out and suspended, and their votes taken off the scoreboard. You can undo this.`, { ok: "Remove as spam", danger: true }))) return;
    try { const r = await req("/api/admin/spam/remove", { method: "POST", body: { usernames: names } }); toast(`Removed ${r.accounts} · ${r.votes} vote${r.votes === 1 ? "" : "s"} off`); await reload(); } catch (e) { toast(e.message); }
  });
  $$("[data-spamundo]").forEach((b) => b.onclick = async () => {
    try { const r = await req("/api/admin/spam/restore", { method: "POST", body: { usernames: b.dataset.spamundo.split(",") } }); toast(`Restored ${r.accounts} · ${r.votes} vote${r.votes === 1 ? "" : "s"} back`); await reload(); } catch (e) { toast(e.message); }
  });
}
