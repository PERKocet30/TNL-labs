
/* ================================================================
   THE POLICIES · v1.2 — 2026-10-29 (v1.2: the days you use the app, slow-request
   logs, xAI's Grok beside Claude. v1.1: caught up with the app — signing in
   with Google/Apple/Facebook, no throwaway emails, one vote per phone and the
   new-account wait, spam removal, the phone's vote code, glitch reports, event
   and reminder emails, featuring members' work on LABS's own accounts, the
   Instagram and Google shop feeds, Meta/Google/Anthropic as processors, no AI
   training, and Stripe's card fee by account type).
   THE POLICIES · 2026-10-07. Terms, privacy, shipping & returns, contact,
   and a public /shop door — what Stripe (and anyone else) reads before
   trusting the Market with cards. Public, server-built, no sign-in.
   Plain English on purpose: every promise here is one the app keeps
   (the fee ladder is read from FEE_BY_LEVEL, not typed out).
   SUPPORT_EMAIL (Railway → Variables) is the inbox shown everywhere.
================================================================ */
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@tnllabs.com";
const POLICY_UPDATED = "October 29, 2026";
const POLICY_PAGES = [
  ["/shop", "Shop"], ["/terms", "Terms"], ["/privacy", "Privacy"],
  ["/policies", "Shipping & returns"], ["/contact", "Contact"],
];

/* The footer every public page wears (lookPage appends it). */
function lookFoot() {
  return `<footer class="foot">${POLICY_PAGES.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}
<div class="cap">© ${new Date().getFullYear()} LABS · <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></div></footer>`;
}

const feeRange = () => {
  const v = Object.values(FEE_BY_LEVEL);
  return `${Math.min(...v)}–${Math.max(...v)}%`;
};

function policyPage(res, { path, title, eyebrow, lead, sections }) {
  const toc = sections.length > 3
    ? `<nav class="toc">${sections.map(([h], i) => `<a href="#s${i + 1}">${h}</a>`).join("")}</nav>` : "";
  res.set("Cache-Control", "public, max-age=300");
  res.send(lookPage({
    title: `${title} — LABS`,
    head: `<link rel="canonical" href="https://tnllabs.com${path}"><meta name="description" content="${lookEsc(lead)}">`,
    body: `${lookEyebrow(eyebrow)}<h1>${title}</h1><p class="p">${lead}</p>
<p class="cap">Last updated ${POLICY_UPDATED}</p>${toc}
${sections.map(([h, html], i) => `<section class="pol" id="s${i + 1}"><h2>${h}</h2>${html}</section>`).join("\n")}`,
  }));
}

const mail = () => `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;

/* ── Terms of service ───────────────────────────────────────────── */
app.get("/terms", (_req, res) => policyPage(res, {
  path: "/terms", title: "Terms of service", eyebrow: "Terms",
  lead: "The rules for using LABS — the app at tnllabs.com, its Market and its events. By making an account or buying something here, you agree to them.",
  sections: [
    ["Who we are", `<p>LABS is a social platform and marketplace for creatives, run by LABS (“we”, “us”). Reach us any time at ${mail()}.</p>`],
    ["Your account", `<ul><li>You must be at least 13 to make an account, and at least 18 (or have a parent or guardian's permission) to buy or sell.</li>
<li>Give a real email address you can open — temporary or throwaway inboxes can't make an account — and keep your password to yourself. You can also sign in with Google, Apple or Facebook where it's offered. You're responsible for what happens on your account.</li>
<li>One person per account, and it's yours alone — don't sell, buy or hand over accounts or usernames. Usernames that impersonate someone, or are only held to sell, can be reclaimed.</li>
<li>Be who you are: no pretending to be another person, brand or LABS, and no accounts run by bots or scripts.</li></ul>`],
    ["Your work", `<p>You own what you post. By posting it you give us a non-exclusive, worldwide, royalty-free licence to host, show, resize and share it inside LABS and in links to it (like the preview when someone shares your post), to run the service. That licence ends when you delete the post, except for copies others already saved or bought.</p>
<p><b>Promoting LABS with your work.</b> LABS can use what you upload publicly — pictures, videos and music — to promote LABS, without payment: on our own pages and social accounts (like @tnl.labs on Instagram), in videos and reels (including your songs as their soundtrack), and in other promotion. We credit you whenever the format allows. You still own your work. Don't want yours used? Email ${mail()} and we'll stop using it in anything new and take down what we can.</p>
<p><b>No AI training.</b> We don't sell or license your work to anyone to train AI, and we tell AI crawlers to stay off members' work.</p>
<p>Only post work you made or have the right to post. Credit collaborators — a collab only counts once they accept.</p>`],
    ["Rep and levels", `<p>Rep is earned only from what other people do with your work, and every point is logged. Gaming it — fake accounts, trading likes, buying from yourself — can get rep removed or the account closed. Your level sets your Market fee (see below).</p>`],
    ["The Market", `<p>LABS is a marketplace: <b>members sell to other members</b>. The seller named on each listing is the seller of the item and is responsible for describing it honestly, shipping it, and handling returns under our <a href="/policies">Shipping &amp; returns policy</a>. We aren't the seller and don't hold stock.</p>
<p>Card payments are processed by Stripe and go straight to the seller's own Stripe account. We take a platform fee of ${feeRange()} of the item price (lower at higher levels; never on shipping). Stripe's card processing fee is either taken by Stripe from the seller, or included in our fee for sellers on the account type where LABS pays it — either way the sell form shows what the seller receives before they list. Sellers can choose to show a listing in the LABS shop on Instagram and Google Shopping. Sellers agree to the <a href="https://stripe.com/legal/connect-account">Stripe Connected Account Agreement</a>.</p>
<p>Prices are in US dollars unless the listing says otherwise. Taxes, if any, are the seller's to collect and report.</p>`],
    ["Events and tournaments", `<p>Each event has its own rules page, linked from the event, which add to these terms. Votes only count in the app, one account per person: each phone votes once per piece per day, and brand-new accounts wait a few minutes before they can vote. We can remove entries or votes that break the rules, suspend accounts made or used to rig a vote and remove their votes, and our judges' decisions are final.</p>`],
    ["Not allowed", `<ul><li>Stolen, infringing or counterfeit work or goods; anything on the <a href="/policies#s5">prohibited items</a> list.</li>
<li>Harassment, hate, threats, sexual content involving minors, or doxxing.</li>
<li>Spam, fake or duplicate accounts, buying or trading likes, follows, votes or rep, scams, taking payment outside the app to dodge fees or protection, or fake reviews.</li>
<li>Posting someone else's private information, or their photos or work without the right to.</li>
<li>Scraping, breaking or overloading the service, or getting into accounts that aren't yours.</li></ul>
<p>Report anything with the ⋯ menu or by email. We can remove content and suspend or close accounts that break these terms. If we remove something of yours or suspend your account, email ${mail()} and we'll look at it again.</p>`],
    ["Copyright complaints", `<p>If something here infringes your copyright, email ${mail()} with the link, what work it copies, and your contact details. We'll take it down and tell the poster, who can reply if they think it's a mistake.</p>`],
    ["Ending", `<p>You can stop using LABS and ask us to delete your account at any time (see <a href="/privacy#s6">Privacy</a>). We can suspend or close an account that breaks these terms; open orders still have to be shipped or refunded.</p>`],
    ["The legal part", `<p>LABS is provided “as is”. We work hard to keep it running and safe but can't promise it will always be available or error-free. To the extent the law allows, we aren't liable for indirect or consequential losses, and our total liability to you is limited to the greater of the fees we earned from your orders in the last 12 months or $100. Nothing here limits rights you have under consumer law that can't be waived.</p>
<p>These terms are governed by the laws of the United States and of the state where LABS is based. If we change them in a way that matters, we'll say so in the app before the change takes effect.</p>`],
  ],
}));

/* ── Privacy ────────────────────────────────────────────────────── */
app.get("/privacy", (_req, res) => policyPage(res, {
  path: "/privacy", title: "Privacy policy", eyebrow: "Privacy",
  lead: "What we collect, why, and who else touches it. Short version: only what it takes to run the app. No ads, no ad trackers, and we never sell your data.",
  sections: [
    ["What we collect", `<ul><li><b>Account:</b> email, password (stored only as a one-way hash), name, username, and what you add to your profile. If you sign in with Google, Apple or Facebook, we get your name, email and an account ID from them — never your password.</li>
<li><b>What you make:</b> posts, images, audio, comments, messages, listings, offers, votes and event entries.</li>
<li><b>Orders:</b> what you bought or sold, and the shipping address you enter at checkout, which goes to the seller so they can ship. Card details go to Stripe and never reach us.</li>
<li><b>Running the app:</b> your IP address and basic request logs (for security and rate limits), the days you use the app signed in (just the date — so we know who comes back), requests that are slow or fail, error reports when something breaks, and reports of screens that load slowly, jump or don't respond to a tap, so we can fix them.</li>
<li><b>Keeping accounts real:</b> when you join, sign in or vote, we note the network you used (kept as a code, not the address itself), the country and city it's in, the time zone your phone is set to, your device and browser, and the link that first brought you to LABS. The app also saves a random code on your phone (it isn't your name, number or phone ID) so each phone counts once per piece when voting. Only LABS admins see this, to spot fake accounts and vote rigging.</li>
<li><b>Instagram messages:</b> if you message @tnl.labs on Instagram, LABS admins read and answer it in our admin, through Meta's tools.</li></ul>`],
    ["Why", `<p>To run your account and show your work, process orders, send email (verification, password reset and order updates, plus event announcements and reminders — those have a one-tap unsubscribe), keep the app safe from spam and abuse, and fix bugs.</p>`],
    ["Who else processes it", `<ul><li><b>Stripe</b> — card payments and seller payouts.</li><li><b>Resend</b> — sending email.</li>
<li><b>Railway</b> — hosting; our database and uploads live there.</li><li><b>Cloudflare</b> — delivering the site and blocking attacks.</li>
<li><b>Sentry</b> — error reports, so we can fix crashes.</li>
<li><b>Google, Apple and Meta</b> — signing in, if you choose them. Meta also runs our Instagram account and shop, and Google shows shop listings in Google Shopping; both only get listings their sellers chose to show there.</li>
<li><b>Anthropic and xAI</b> — Claude and Grok, AI assistants our admins use to read the app's numbers and help build LABS. They never see messages, emails, addresses or passwords.</li></ul><p>Each only gets what its job needs. We share data with authorities only when the law requires it.</p>`],
    ["What's public", `<p>Your profile, posts, listings and event entries are public — anyone with the link can see them, and search engines can show them. LABS can use public uploads, including music, to promote LABS (see <a href="/terms#s3">Terms</a>). Messages are private between the people in the chat. Your email address is never shown to other members.</p>`],
    ["Cookies and storage", `<p>We don't use advertising or tracking cookies. The app stores your sign-in, your preferences (like night mode) and the voting code above on your device. We never sell your data, and we don't sell or license anyone's work for AI training.</p>`],
    ["Your choices", `<ul><li>Edit or delete your posts and profile in the app at any time.</li>
<li>To get a copy of your data or delete your account — including anything that came from signing in with Google, Apple or Facebook — email ${mail()} from your account's email. We'll do it within 30 days. We keep order records the law requires (usually up to 7 years) and backups roll off within 30 days.</li></ul>`],
    ["Kids", `<p>LABS isn't for children under 13 and we don't knowingly collect their data. If you think a child has an account, email us and we'll remove it.</p>`],
    ["Changes and contact", `<p>If this policy changes in a way that matters, we'll say so in the app. Questions: ${mail()}.</p>`],
  ],
}));

/* ── Shipping, returns, refunds, disputes ───────────────────────── */
app.get("/policies", (_req, res) => policyPage(res, {
  path: "/policies", title: "Shipping & returns", eyebrow: "Market policies",
  lead: "How buying works on the LABS Market. Every seller agrees to these as the minimum; a seller can offer more, never less.",
  sections: [
    ["Shipping", `<ul><li>Sellers ship within <b>5 business days</b> of payment and add tracking in the app, which tells you it's on the way.</li>
<li>Shipping cost is shown on the listing before you buy. Buying several items from one seller in one checkout ships them together for one shipping price.</li>
<li>We currently ship to the US, Canada, the UK, Ireland, Australia, New Zealand and much of Western Europe; checkout shows if your country isn't covered. Import duties are the buyer's.</li>
<li>Loops and other digital items are delivered in the app right after payment.</li></ul>`],
    ["Cancellations", `<p>Until an order ships, you can message the seller to cancel it for a full refund. If a seller hasn't shipped within <b>10 business days</b>, you can cancel for a full refund — email us if they don't respond.</p>`],
    ["Returns and refunds", `<ul><li><b>Not as described, damaged, or never arrived:</b> tell the seller within <b>14 days</b> of delivery (or of the expected delivery date). You'll get a full refund, including shipping. If they ask for the item back, they pay return postage.</li>
<li><b>Changed your mind:</b> up to the seller — ask them before you buy.</li>
<li><b>Digital items</b> (loops): refundable if the file is broken or isn't what was listed.</li>
<li>Refunds go back to the original card through Stripe, usually within 5–10 business days.</li></ul>`],
    ["If something goes wrong", `<ol><li>Message the seller — most problems end here.</li>
<li>No answer in 3 days, or you can't agree? Email ${mail()} with your order number. We'll look at the listing, messages and tracking and decide within 5 business days. Sellers must follow our decision, including refunding.</li>
<li>You can still dispute a charge with your card issuer; Stripe handles that with the seller.</li></ol>
<p>Keep payments in the app — orders paid outside LABS aren't covered.</p>`],
    ["Prohibited items", `<p>Nothing illegal or dangerous, and none of: counterfeits or replicas, stolen goods, work that infringes someone's rights, weapons, drugs or drug paraphernalia, alcohol or tobacco, adult content, recalled items, gift cards or financial products, personal data, or accounts. We remove listings that break this and may close the seller's account.</p>`],
    ["Sellers", `<p>Describe and photograph items honestly (including flaws and the right size), ship on time with tracking, answer buyers within 2 days, and refund under this policy. Repeated late shipping or lost disputes can lose a seller their selling access.</p>`],
  ],
}));

/* ── Contact ────────────────────────────────────────────────────── */
app.get("/contact", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.send(lookPage({
    title: "Contact — LABS",
    body: `${lookEyebrow("Contact")}<h1>Get in touch</h1>
<p class="p">Questions, a problem with an order, a report, or a copyright complaint — email us and a real person answers within 2 business days.</p>
<a class="btn acc" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
<section class="pol"><h2>Order problems</h2><p>Include your order number and username. Start by messaging the seller — see <a href="/policies#s4">If something goes wrong</a>.</p></section>
<section class="pol"><h2>About LABS</h2><p>Social media by creatives, for creatives: share work, collaborate, enter events, and buy and sell in the Market. Based in the United States.</p></section>`,
  }));
});

/* The Market, by name, for anyone — no account needed to look. It's the
   link the Market's Share sends (2026-10-20), so its preview in a DM or a
   text says what the Market is: the same line that sits under its name in
   the app (MARKET_PITCH in app-17-market-share.js; test/market-share.test.mjs
   checks they match). The page is the app itself, with its preview tags
   swapped. */
const MARKET_PITCH = "Buy and sell what creatives make: clothing, art and prints.";
const shopHtml = new Map();   // one per site address (PUBLIC_URL, or the request's host when it isn't set)
app.get("/shop", (req, res) => {
  const base = baseUrl(req);
  if (!shopHtml.has(base)) {
    if (shopHtml.size > 4) shopHtml.clear();   // a made-up Host can't grow it
    const e = lookEsc, url = `${base}/shop`, title = "LABS Market";
    shopHtml.set(base, readFileSync(join(__dirname, "..", "public", "index.html"), "utf8")
      .replace(/<title>[^<]*<\/title>/, `<title>${e(title)}</title>`)
      .replace(/(property="og:url" content=")[^"]*/, `$1${e(url)}`)
      .replace(/(property="og:title" content=")[^"]*/, `$1${e(title)}`)
      .replace(/(name="twitter:title" content=")[^"]*/, `$1${e(title)}`)
      .replace(/(property="og:description" content=")[^"]*/, `$1${e(MARKET_PITCH)}`)
      .replace(/(name="twitter:description" content=")[^"]*/, `$1${e(MARKET_PITCH)}`)
      .replace(/(name="description" content=")[^"]*/, `$1${e(MARKET_PITCH)}`));
  }
  res.set("Cache-Control", "no-cache");
  res.type("html").send(shopHtml.get(base));
});
