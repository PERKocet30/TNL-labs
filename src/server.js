/* TNL LABS — entry point. v2.0 · 2026-09-28
   The server and the app shell live in src/ as numbered parts:
     src/server-NN-*.js           the API, in order
     src/app-NN-*.{html,css,js}   public/index.html, in order
   Boot joins them (src/assemble.mjs) and runs the result. Edit the parts;
   the built files are regenerated every boot and not kept in git. */
import { assemble } from "./assemble.mjs";

assemble();
await import("./server.runtime.js");
