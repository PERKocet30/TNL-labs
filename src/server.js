/* TNL LABS — entry point. v2.1 · 2026-10-31 (the flatten)
   The server and the app shell live in src/ as parts, grouped by feature:
     src/server/<feature>/*.js           the API, in the order src/server/order.mjs says
     src/app/<feature>/*.{html,css,js}   public/index.html, in the order src/app/order.mjs says
   Boot joins them (src/assemble.mjs) and runs the result. Edit the parts;
   the built files are regenerated every boot and not kept in git. */
import { assemble } from "./assemble.mjs";

assemble();
await import("./server.runtime.js");
