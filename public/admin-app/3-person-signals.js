/* LABS admin — Real people or bots v1.0, 2026-10-26. "I don't trust all
   these new accounts." On a member's record (Overview): how they joined —
   when, from which country, on what phone, by email / Google / Apple /
   Facebook, the first link that brought them, how long Join took — where
   they've signed in and voted from since, the accounts on the same
   network, and plain reasons to look twice. On a tournament: who's
   voting for each piece, and the networks with more than one voter.
   Data starts 2026-10-26 (server-01-signals); older accounts show none. */
const SIGKIND = { join: "Joined", login: "Signed in", vote: "Voted" };
const SIGVIA = { email: "Email and password", google: "Continue with Google", apple: "Continue with Apple", facebook: "Continue with Facebook" };
const flagOf = (c) => (/^[A-Z]{2}$/.test(c || "") ? String.fromCodePoint(...[...c].map((x) => 0x1f1a5 + x.charCodeAt(0))) + " " + c : "");
function sigCard() {
  const s = PERSON && PERSON.sig;
  if (s === undefined) return card("How they joined", `<div class="empty">Loading…</div>`);
  if (!s) return "";
  const j = s.joined;
  const flags = s.flags.length ? `<ul class="flags">${s.flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "";
  const how = j ? `<dl class="fds">${fld("When", esc(new Date(j.at).toLocaleString()))}${fld("From", esc([j.place, flagOf(j.country), j.network].filter(Boolean).join(" · ")))}${fld("Phone's time zone", esc(j.tz))}
      ${fld("Device", esc(j.device))}${fld("How", esc(SIGVIA[j.via] || j.via))}${fld("Email", esc(s.emailDomain ? "@" + s.emailDomain : ""))}
      ${fld("First link", j.landing ? `<code class="mono">${esc(j.landing)}</code>` : "")}${fld("Came from", esc(j.referrer))}
      ${fld("Time on Join", j.joinSecs != null ? (j.joinSecs < 60 ? j.joinSecs + " seconds" : Math.round(j.joinSecs / 60) + " minutes") : "")}
      ${fld("First visit", j.firstSeen ? esc(new Date(j.firstSeen).toLocaleString()) : "")}</dl>`
    : `<p class="dim" style="padding:12px 14px">Joined before LABS started noting this (Oct 26). Sign-ins and votes from now on show below.</p>`;
  const seen = s.seen.filter((x) => x.kind !== "join");
  const log = seen.length ? `<div class="list">${seen.map((x) => `<div class="li"><div class="b"><b>${SIGKIND[x.kind] || esc(x.kind)}${x.event ? ` · ${esc(x.event)}` : ""}</b>
      <span>${esc([x.place, flagOf(x.country), x.network, x.device].filter(Boolean).join(" · "))}</span></div><div class="r">${esc(ago(x.at))}</div></div>`).join("")}</div>` : "";
  const share = s.sharing.length ? `<p class="dim" style="padding:10px 14px 4px">Also on their network (a home Wi-Fi or a phone carrier can do this too):</p><div class="list">${s.sharing.map((o) => `<button class="li" data-person="${esc(o.username)}"><div class="b"><b>@${esc(o.username)}</b>
      <span>${esc(o.kinds.map((k) => SIGKIND[k] || k).join(", "))} · joined ${esc(ago(o.joinedAt))}</span></div><div class="r">${o.times}×</div>${I.chev}</button>`).join("")}</div>` : "";
  return card("How they joined", flags + how + log + share, s.flags.length ? `${s.flags.length} to look at` : "");
}
/* the tournament's vote check (8-events.js shows it under the entries) */
function evCheckHTML() {
  const c = D.evcheck;
  if (!c) return "";
  const rows = c.entries.length ? c.entries.map((e) => `<div class="li"><div class="b"><b>@${esc(e.author || "entry " + e.entryId)}</b>
      <span>${e.voters} voter${e.voters === 1 ? "" : "s"}${Object.keys(e.places).length ? " · " + Object.entries(e.places).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => esc(k) + " " + n).join(", ") : ""} · ${Object.entries(e.countries).sort((a, b) => b[1] - a[1]).map(([k, n]) => flagOf(k) + " " + n).join("  ") || "country unknown"}</span></div>
      <div class="r">${e.votes}${e.fresh ? ` <span class="tag warn" title="from accounts under a week old">${e.fresh} new</span>` : ""}${e.shared ? ` <span class="tag warn" title="from voters on the same network as another voter for this piece">${e.shared} same network</span>` : ""}${e.offClock ? ` <span class="tag warn" title="the phone's clock is in another part of the world from its network: a VPN or proxy">${e.offClock} VPN?</span>` : ""}</div></div>`).join("")
    : `<div class="empty">No votes recorded yet.</div>`;
  const cl = c.clusters.length ? `<h2 class="sec">Networks with more than one voter <span class="mono">a home Wi-Fi or a phone carrier can do this too — a reason to look, not proof</span></h2>
    <div class="list">${c.clusters.map((g) => `<div class="li"><div class="b"><b>${esc(g.network)}${g.places.length ? " · " + esc(g.places.join(" / ")) : ""}${g.countries.length ? " · " + g.countries.map(flagOf).join(" ") : ""} — ${g.voters.length} voters</b>
      <span>${g.voters.map((u) => `<span data-person="${esc(u)}" style="text-decoration:underline;cursor:pointer">@${esc(u)}</span>`).join(", ")}</span>
      <span>voted for ${g.entries.map((x) => `@${esc(x.author || "entry " + x.entryId)} ×${x.votes}`).join(", ")}</span></div><div class="r">${g.votes} votes</div></div>`).join("")}</div>` : "";
  return `<h2 class="sec">Vote check <span class="mono">who's voting for each piece · since Oct 26</span></h2><div class="list">${rows}</div>${cl}`;
}
