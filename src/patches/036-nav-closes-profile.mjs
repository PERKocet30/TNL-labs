/* Patch 036 — tapping a nav tab never closed the profile.

   The [data-tab] handler sets TAB and re-renders, but has never cleared
   PROFILE. That was survivable while the profile was a fixed overlay you
   could dismiss with the ✕ — but 031/032 hid the ✕ on your own profile
   (`.sheet.astab .sheeth .x{display:none}`) and 035 moved the profile into
   the .content slot, so with PROFILE still set every tab renders the profile
   and nothing appears to happen. No ✕, no tab, no way out: locked in.

   The back gesture was fine all along — popstate has always had
   `else if(PROFILE){PROFILE=null}`. It was only the nav that trapped you.

   Same one-line omission in the [data-goto] handler, fixed here too.

   Client-only. Runs after 035. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgIFRBQj1iLmRhdGFzZXQudGFiO2lmKHdpbmRvdy5UTkxTdHVkaW8pVE5MU3R1ZGlvLnVubW91bnQoKTs="),
    replace: d("ICAgIFRBQj1iLmRhdGFzZXQudGFiO1BST0ZJTEU9bnVsbDtpZih3aW5kb3cuVE5MU3R1ZGlvKVROTFN0dWRpby51bm1vdW50KCk7") },
  { file: "public/index.html", count: 1,
    find: d("ICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCJbZGF0YS1nb3RvXSIpLmZvckVhY2goYj0+Yi5vbmNsaWNrPSgpPT57VEFCPWIuZGF0YXNldC5nb3RvO3JlbmRlcigpfSk7"),
    replace: d("ICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCJbZGF0YS1nb3RvXSIpLmZvckVhY2goYj0+Yi5vbmNsaWNrPSgpPT57VEFCPWIuZGF0YXNldC5nb3RvO1BST0ZJTEU9bnVsbDtyZW5kZXIoKX0pOw==") },
];
