// Music scope v1.0 (2026-09-29): music plays only in the labs. Runs the real
// player scope code (lifted from src/app-13-player.js and app-18-media.js)
// against a stubbed audio element and app state.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const player = readFileSync(join(ROOT, "src/app-13-player.js"), "utf8");
const media = readFileSync(join(ROOT, "src/app-18-media.js"), "utf8");
const grab = (src, name) => { const i = src.indexOf("function " + name + "("); let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1); } };

const S = {};
const env = `let TAB,PROFILE,GATE,PCOMPOSE,DMOPENPANEL,NOTIFOPEN,SEARCHOPEN,BOARDSOPEN,REVIEWING,TRKEDIT,MUSAUTOID,NOWPLAYING,AUDIO;
  const navigator={mediaSession:{metadata:"x"}};const esc=s=>String(s);const DI={music:"♪",pause:"❚❚"};
  ${grab(player, "musicHere")}${grab(player, "musicScope")}${grab(player, "barVisible")}${grab(media, "musChipHTML")}
  return {set(o){TAB=o.TAB??"labs";PROFILE=o.PROFILE??null;GATE=null;PCOMPOSE=null;DMOPENPANEL=!!o.DM;NOTIFOPEN=false;SEARCHOPEN=false;BOARDSOPEN=false;REVIEWING=null;TRKEDIT=null;
    MUSAUTOID=o.MUSAUTOID??null;NOWPLAYING=o.NOWPLAYING??null;AUDIO=o.AUDIO??null;navigator.mediaSession.metadata="x"},
    get:()=>({MUSAUTOID,NOWPLAYING,meta:navigator.mediaSession.metadata}),musicScope,barVisible,musChipHTML};`;
const M = new Function(env)();
const audio = (src = "/u/track.mp3") => ({ paused: false, pause() { this.paused = true; }, getAttribute: () => src });
const track = { id: 7, title: "Loop", by: { username: "ana" } };

console.log("\nLAB PLAYBACK STAYS IN THE LABS");
let a = audio(); M.set({ TAB: "labs", NOWPLAYING: track, AUDIO: a }); M.musicScope();
t("playing in the labs keeps playing", !a.paused && M.barVisible());
for (const [name, o] of [["the Showroom", { TAB: "showroom" }], ["the Market", { TAB: "market" }], ["a profile", { PROFILE: {} }], ["a chat", { DM: true }]]) {
  a = audio(); M.set({ ...o, NOWPLAYING: track, AUDIO: a }); M.musicScope();
  t(`going to ${name} pauses it and hides the bar`, a.paused && !M.barVisible());
}
t("…and clears the lock screen", M.get().meta === null);
M.set({ TAB: "labs", NOWPLAYING: track, AUDIO: audio() });
t("the lab track is still there to resume when you come back", M.get().NOWPLAYING === track && M.barVisible());

console.log("\nA POST'S SOUND DOESN'T FOLLOW YOU");
a = audio(); M.set({ TAB: "showroom", MUSAUTOID: 3, NOWPLAYING: track, AUDIO: a }); M.musicScope();
t("post sound is stopped and dropped", a.paused && M.get().MUSAUTOID == null && M.get().NOWPLAYING == null);
a = audio("data:audio/wav;base64,AA"); M.set({ TAB: "showroom", AUDIO: a }); M.musicScope();
t("the silent iOS unlock is left alone", !a.paused);

console.log("\nOUTSIDE THE LABS THE SOUND IS A CREDIT");
const p = { id: 3, audioTrack: track };
M.set({ TAB: "showroom" });
t("Showroom: no play button, nothing to autoplay", !/data-mustrack/.test(M.musChipHTML(p)) && /Loop/.test(M.musChipHTML(p)));
M.set({ TAB: "labs", PROFILE: {} });
t("a profile: same", !/data-mustrack/.test(M.musChipHTML(p)));
M.set({ TAB: "labs" });
t("in a lab it plays", /data-mustrack="3"/.test(M.musChipHTML(p)));

console.log("\nWIRED EVERYWHERE");
t("every paint of the player enforces the scope", /function paintPlayer\(\)\{[\s\S]*?musicScope\(\);\s*const show=barVisible\(\)/.test(player));
t("lock-screen play respects it", /setActionHandler\("play",\(\)=>\{if\(musicHere\(\)\)/.test(player));

console.log(`\n  ${pass} passed, ${fail} failed`);
