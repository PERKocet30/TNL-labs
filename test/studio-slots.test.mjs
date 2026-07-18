import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

/* Pull the real guesser out of studio.js so this can't drift from the code. */
const st = readFileSync(join(ROOT, "public/studio.js"), "utf8");
const src = st.slice(st.indexOf("function guessSlot(name) {"), st.indexOf('return "other";\n  }', st.indexOf("function guessSlot(name) {")) + 20);
const guessSlot = new Function(src + "; return guessSlot;")();

console.log("\nSORTING A REAL KIT — 40 files, named the way producers name them");
const cases = [
  ["808 Mafia Kick 03.wav", "kick"],   // brand name, not an 808
  ["808 Mafia Snare.wav", "snare"],
  ["Metro Boomin Hat.wav", "hat"],
  ["808_F_Dark.wav", "808"],
  ["808 melo pluck.wav", "melody"],
  ["Sub Bass C.wav", "808"],
  ["BD_01.wav", "kick"], ["kick punchy.wav", "kick"], ["bass drum 2.wav", "kick"],
  ["Snare 04.wav", "snare"], ["SD_crispy.wav", "snare"], ["snr layered.wav", "snare"],
  ["Clap_Wide.wav", "clap"], ["CP 12.wav", "clap"],
  ["finger snap.wav", "snap"], ["snap dry.wav", "snap"],
  ["CH_hat.wav", "hat"], ["HH_closed_02.wav", "hat"], ["hi hat 8.wav", "hat"],
  ["Open Hat 3.wav", "openhat"], ["OH_long.wav", "openhat"], ["ohat_verb.wav", "openhat"],
  ["rimshot.wav", "rim"], ["rim 01.wav", "rim"],
  ["Floor Tom.wav", "tom"], ["tom low.wav", "tom"],
  ["Crash_01.wav", "crash"], ["ride cymbal.wav", "crash"], ["splash.wav", "crash"],
  ["shaker loop.wav", "perc"], ["cowbell.wav", "perc"], ["conga hi.wav", "perc"], ["tamb.wav", "perc"],
  ["vox chop Am.wav", "vocal"], ["adlib_yeah.wav", "vocal"], ["vocal sample.wav", "vocal"],
  ["riser_8bar.wav", "fx"], ["reverse impact.wav", "fx"], ["downlifter.wav", "fx"],
  ["piano melody Cm.wav", "melody"], ["guitar pluck.wav", "melody"], ["bell mel.wav", "melody"],
  ["Bass_Reese.wav", "bass"],
  ["weird noise.wav", "other"], ["untitled 7.wav", "other"],
];
let right = 0;
for (const [name, want] of cases) { const got = guessSlot(name); if (got === want) right++; else console.log("  ✗ " + name + " → " + got + " (wanted " + want + ")"); }
t(right + "/" + cases.length + " sorted with no human input", right === cases.length);
t("  -> a producer drops 40 files and they land in the right folders", right === cases.length);

console.log("\nTHE TRAPS");
t('"808 Mafia Kick" is a KICK, not an 808', guessSlot("808 Mafia Kick 03.wav") === "kick");
t('"OH_long" is an OPEN hat, not a hat', guessSlot("OH_long.wav") === "openhat");
t('"808_F_Dark" IS an 808', guessSlot("808_F_Dark.wav") === "808");
t("unknown names fall back, not crash", guessSlot("asdfgh.wav") === "other");
t("no name at all doesn't throw", (() => { try { return guessSlot("") === "other"; } catch { return false; } })());

console.log("\nSLOTS ↔ TRACKS");
const srv = readFileSync(join(ROOT, "src/server.js"), "utf8");
const grab = (n) => new Function(srv.slice(srv.indexOf(n), srv.indexOf("};", srv.indexOf(n)) + 2) + "; return " + n.match(/const (\w+)/)[1] + ";")();
const SLOT_TRACK = grab("const SLOT_TRACK = {");
const SLOT_LABELS = grab("const SLOT_LABELS = {");
const SLOTS = new Function(srv.slice(srv.indexOf("const SLOTS = ["), srv.indexOf("];", srv.indexOf("const SLOTS = [")) + 2) + "; return SLOTS;")();
const TRACKS = ["kick", "snare", "hat", "clap", "perc", "bass", "lead", "keys"];
t("every slot has a label", SLOTS.every((s) => SLOT_LABELS[s]));
t("every slot routes to a real track", SLOTS.every((s) => TRACKS.includes(SLOT_TRACK[s])));
t("an open hat lands on the hat track", SLOT_TRACK.openhat === "hat");
t("an 808 lands on the bass track", SLOT_TRACK["808"] === "bass");
t("a melody lands on keys, not perc", SLOT_TRACK.melody === "keys");
t("'other' is last (a fallback belongs at the end)", SLOTS[SLOTS.length - 1] === "other");
t("16 slots — a real kit folder, not 7", SLOTS.length === 16);

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
