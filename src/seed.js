import bcrypt from "bcryptjs";
import { db, awardRep } from "./db.js";

/* Wipes and reseeds a small network so the social features have something
   to act on the moment you open the app. Run: npm run seed */

db.exec(`DELETE FROM rep_events; DELETE FROM likes; DELETE FROM collaborators;
         DELETE FROM follows; DELETE FROM posts; DELETE FROM sessions; DELETE FROM users;`);

const people = [
  { u: "maz", n: "Mauricio", r: "Founder" },
  { u: "xstart22", n: "XSTART22", r: "Content Creator" },
  { u: "kenzuu", n: "KENZUU", r: "Designer" },
  { u: "eclasona", n: "ECLASONA", r: "Producer" },
  { u: "madz", n: "MADZ", r: "Designer" },
];

const hash = await bcrypt.hash("labs1234", 10);
const ins = db.prepare(
  `INSERT INTO users (username, display_name, email, role, password_hash, created_at) VALUES (?,?,?,?,?,?)`
);
const ids = {};
for (const p of people) {
  const info = ins.run(p.u, p.n, `${p.u}@tnllabs.com`, p.r, hash, Date.now());
  ids[p.u] = Number(info.lastInsertRowid);
}

const post = db.prepare(`INSERT INTO posts (author_id, channel, body, created_at) VALUES (?,?,?,?)`);
const seedPosts = [
  ["kenzuu", "graphic-design", "New poster series — pulling from that archive we talked about."],
  ["eclasona", "beats", "Loop up in the Beat Lab. Someone put words on it."],
  ["xstart22", "general", "JDM tee is live. Straight from the group chat to the drop."],
  ["madz", "clothing-design", "Mockup batch — how we feelin about these?"],
];
const like = db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`);
for (const [u, ch, body] of seedPosts) {
  const info = post.run(ids[u], ch, body, Date.now());
  const pid = Number(info.lastInsertRowid);
  // a couple of validations so rep isn't all zero
  const fans = people.filter((p) => p.u !== u).slice(0, 2);
  for (const f of fans) {
    like.run(pid, ids[f.u], Date.now());
    awardRep(ids[u], "like_received", pid);
  }
}

const follow = db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`);
for (const a of people) for (const b of people) if (a.u !== b.u && Math.random() > 0.4) follow.run(ids[a.u], ids[b.u], Date.now());

console.log("Seeded", people.length, "users (password: labs1234) and", seedPosts.length, "posts.");
