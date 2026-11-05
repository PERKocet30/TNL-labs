/* LABS admin — Health v1.1, 2026-11-04 ("I said I wanted this at the front of the admin dashboard" — the Systems map): Systems
   is its own section again, up front (second in the sidebar, in the phone's bar), so Health is Health alone. v1.0, 2026-11-04
   ("there's better ways to organize this"): Health · Systems as tabs. Loaded after 7-systems4, so it takes over
   LOADERS/VIEWS/WIRES.health from 6-settings. */
const hsLoad0 = LOADERS.health;
LOADERS.health = async () => { await hsLoad0(); };
VIEWS.health = () => VIEWS.settings("health");
WIRES.health = () => { WIRES.settings?.(); };
