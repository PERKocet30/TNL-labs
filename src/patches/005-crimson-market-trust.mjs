/* Patch 005 — crimson accent + seller standing on market cards.
   - Crimson (#DC143C) joins the server palette. It's deeper and bluer than
     Blood so the two read apart in the swatch row, and it's the first
     accent that struggles on black rather than white — 004's inkFor lifts
     it to 4.53 there and leaves it alone on white at 4.99.
   - Market cards showed price and title only; a buyer had to open a listing
     to learn anything about who they were paying. seller.rep and
     seller.level were already in the API response and simply weren't
     rendered. Trust signal on standing that can't be farmed.
   Runs after 004 — the index.html hunks are written against 004's output.
   Hunks are base64 (emoji + template literals travel safely). */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/db.js", count: 1,
    find: d("ICBibG9vZDogIHsgbmFtZTogIkJsb29kIiwgIGhleDogIiNFRjQ0NDQiIH0s"),
    replace: d("ICBibG9vZDogIHsgbmFtZTogIkJsb29kIiwgIGhleDogIiNFRjQ0NDQiIH0sCiAgY3JpbXNvbjp7IG5hbWU6ICJDcmltc29uIixoZXg6ICIjREMxNDNDIiB9LA==") },
  { file: "public/index.html", count: 1,
    find: d("ICA8ZGl2IGNsYXNzPSJtYm9keSI+CiAgICA8ZGl2IGNsYXNzPSJtcHJpY2UiPiR7bW9uZXkobC5wcmljZSl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtdGl0bGUiPiR7ZXNjKGwudGl0bGUpfTwvZGl2PgogIDwvZGl2Pg=="),
    replace: d("ICA8ZGl2IGNsYXNzPSJtYm9keSI+CiAgICA8ZGl2IGNsYXNzPSJtcHJpY2UiPiR7bW9uZXkobC5wcmljZSl9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtdGl0bGUiPiR7ZXNjKGwudGl0bGUpfTwvZGl2PgogICAgJHtsLnNlbGxlcj9gPGRpdiBjbGFzcz0ibWt0LWJ5IG1vbm8gZGltIj5AJHtlc2MobC5zZWxsZXIudXNlcm5hbWUpfSR7bC5zZWxsZXIubGV2ZWw/YDxzcGFuIGNsYXNzPSJta3QtbHZsIj5MJHtsLnNlbGxlci5sZXZlbH08L3NwYW4+YDoiIn08L2Rpdj5gOiIifQogIDwvZGl2Pg==") },
  { file: "public/index.html", count: 1,
    find: d("LnBpZy1oZWFke2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjIwcHg7bWFyZ2luOjRweCAwIDE0cHh9"),
    replace: d("Lm1rdC1ieXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHg7bWFyZ2luLXRvcDo1cHg7Zm9udC1zaXplOjlweH0KLm1rdC1sdmx7Y29sb3I6dmFyKC0tZ3JlZW4pO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZTIpO2JvcmRlci1yYWRpdXM6OTk5cHg7cGFkZGluZzoxcHggNXB4O2xldHRlci1zcGFjaW5nOi4wOGVtfQoucGlnLWhlYWR7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MjBweDttYXJnaW46NHB4IDAgMTRweH0=") },
];
