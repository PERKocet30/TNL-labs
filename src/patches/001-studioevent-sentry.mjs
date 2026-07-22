/* Patch 001 — fix studioEvent 500s + route Sentry reporting.
   Applied at boot by src/build.mjs. Each hunk must match EXACTLY ONCE
   in the pristine src/server.js or the build fails loudly. */
export default [
  { find: "         setting, settingBool, setSetting, allSettings, SETTING_DEFAULTS, logError, backupTo } from \"./db.js\";",
    replace: "         setting, settingBool, setSetting, allSettings, SETTING_DEFAULTS, logError, backupTo, studioEvent } from \"./db.js\";" },
  { find: "  logError(\"server\", err.message || \"unknown\", (err.stack || \"\").slice(0, 1500), req.path, req.user?.username || \"\");\n  console.error(\"[500]\", req.method, req.path, \"\u2014\", err.message);",
    replace: "  logError(\"server\", err.message || \"unknown\", (err.stack || \"\").slice(0, 1500), req.path, req.user?.username || \"\");\n  sentryReport(err, req.method + \" \" + req.path);\n  console.error(\"[500]\", req.method, req.path, \"\u2014\", err.message);" },
  { find: "\n/* Anything a route throws lands here: reported to Sentry, answered cleanly. */\napp.use((err, req, res, next) => {\n  sentryReport(err, req.method + \" \" + req.path);\n  if (res.headersSent) return next(err);\n  res.status(500).json({ error: \"something broke on our side \u2014 it's been reported\" });\n});\n",
    replace: "" },
];
