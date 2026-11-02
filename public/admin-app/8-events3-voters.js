/* LABS admin · Events · Who voted v1.0 — 2026-10-30. "See who voted for you specifically, and who keeps voting."
   Each piece with its voters — tap a piece to open the list. A voter who has come back every day since their
   first vote is a regular. Admins only: members never see who voted for them. server/trust/signals-admin.js. */
LOADERS.voters = async () => { D.voters = EVID ? await req("/api/admin/events/" + EVID + "/voters").catch(() => null) : null; };
function votersHTML() {
  const V = D.voters;
  if (!V) return "";
  const head = `<h2 class="sec">Who voted for each piece <span class="mono">tap a piece · regulars came back every day since their first vote</span></h2>`;
  if (!V.entries.some((e) => e.voters.length)) return head + `<div class="panel"><div class="empty">No votes yet.</div></div>`;
  const when = (t) => { const a = ago(t); return a === "now" ? "just now" : /\d$|[mhd]$/.test(a) && /^\d/.test(a) ? a + " ago" : a; };
  const voter = (v) => `<div class="li"><div class="b"><b style="font-weight:500"><span data-person="${esc(v.username)}" style="cursor:pointer;text-decoration:underline">@${esc(v.username)}</span>${v.regular ? ` <span class="tag on">regular</span>` : ""}</b>
      <span>${V.rounds > 1 ? `${v.rounds} of ${V.rounds} days` : `${v.votes} vote${v.votes === 1 ? "" : "s"}`} · last voted ${esc(when(v.lastAt))} · joined ${esc(when(v.joinedAt))}${v.photo ? "" : " · no photo"}</span></div></div>`;
  return head + `<div class="list">` + V.entries.map((e) => `<details class="li" style="display:block"><summary style="display:flex;justify-content:space-between;gap:12px;cursor:pointer;list-style:none">
      <span class="b"><b>@${esc(e.author)}</b><span>${e.voters.length} voter${e.voters.length === 1 ? "" : "s"}${e.regulars ? ` · ${e.regulars} regular${e.regulars === 1 ? "" : "s"}` : ""}</span></span><span class="r">${e.votes}</span></summary>
      <div class="list" style="margin-top:8px">${e.voters.map(voter).join("") || `<div class="empty">No votes yet.</div>`}</div></details>`).join("") + `</div>`;
}
