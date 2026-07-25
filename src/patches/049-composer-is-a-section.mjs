/* Patch 049 — the composer becomes a section.

   Tapping POST opened pcomposeHTML() as a fixed overlay layered over whatever
   section you were in. This makes it a real nav destination, the same move
   031-036 made for the profile: POST is somewhere you go, not a card that
   floats up.

   The layout is the easy half. The real work is that a section can be left
   three different ways — nav tap, back gesture, Cancel — and an overlay only
   had one. All three now run through pcLeave(): a clean draft leaves quietly,
   a dirty one asks first. Nothing gets eaten, nobody gets trapped.

   Two things the spec did not have right, found by grepping the built file:

     - There are TWO openers, not one. The nav's ＋ and the profile page's own
       #profpost button both set PCOMPOSE. Both are page-mode now, which is
       what lets hunk 7 delete the scrim handler outright instead of gating it.

     - Tapping ＋ while already composing re-ran PCOMPOSE={body:"",imgs:[]…},
       silently wiping a draft in place. That was live before this patch.
       Hunk 6 guards it.

   Client-only. No schema, no server, no money path. 12 hunks. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("LnBjbXAtb3Z7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjEyMDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjcyKTstd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDZweCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNnB4KTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6ZmxleC1lbmQ7anVzdGlmeS1jb250ZW50OmNlbnRlcn0KLnBjbXAtc2hlZXR7YmFja2dyb3VuZDp2YXIoLS1iZyk7d2lkdGg6MTAwJTttYXgtd2lkdGg6NTIwcHg7bWF4LWhlaWdodDo5MnZoO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Ym9yZGVyLXJhZGl1czoyMHB4IDIwcHggMCAwO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47b3ZlcmZsb3c6aGlkZGVufQpAbWVkaWEobWluLXdpZHRoOjY0MHB4KXsucGNtcC1vdnthbGlnbi1pdGVtczpjZW50ZXJ9LnBjbXAtc2hlZXR7Ym9yZGVyLXJhZGl1czoxOHB4fX0="),
    replace: d("LnBjbXAtb3Z7ZGlzcGxheTpmbGV4O2ZsZXg6MTttaW4taGVpZ2h0OjA7anVzdGlmeS1jb250ZW50OmNlbnRlcn0KLnBjbXAtc2hlZXR7YmFja2dyb3VuZDp2YXIoLS1iZyk7d2lkdGg6MTAwJTttYXgtd2lkdGg6NTYwcHg7ZmxleDoxO21pbi1oZWlnaHQ6MDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO292ZXJmbG93OmhpZGRlbn0=") },
  { file: "public/index.html", count: 1,
    find: d("PGRpdiBjbGFzcz0iY29udGVudCI+JHtNWVBBR0UoKT9zaGVldEhUTUwoKTpUQUI9PT0ic2hvd3Jvb20iP3Nob3dyb29tSFRNTCgpOlRBQj09PSJsYWJzIj9sYWJzSFRNTCgpOlRBQj09PSJtYXJrZXQiP21hcmtldEhUTUwoKTpzdHVkaW9IVE1MKCl9PC9kaXY+"),
    replace: d("PGRpdiBjbGFzcz0iY29udGVudCI+JHtQQ09NUE9TRT9wY29tcG9zZUhUTUwoKTpNWVBBR0UoKT9zaGVldEhUTUwoKTpUQUI9PT0ic2hvd3Jvb20iP3Nob3dyb29tSFRNTCgpOlRBQj09PSJsYWJzIj9sYWJzSFRNTCgpOlRBQj09PSJtYXJrZXQiP21hcmtldEhUTUwoKTpzdHVkaW9IVE1MKCl9PC9kaXY+") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICR7UENPTVBPU0U/cGNvbXBvc2VIVE1MKCk6IiJ9Cg=="),
    replace: d("") },
  { file: "public/index.html", count: 1,
    find: d("Y29uc3QgTVlQQUdFPSgpPT4hIShQUk9GSUxFJiZNRSYmUFJPRklMRS51c2VyJiZQUk9GSUxFLnVzZXIudXNlcm5hbWU9PT1NRS51c2VybmFtZSk7Cg=="),
    replace: d("Y29uc3QgTVlQQUdFPSgpPT4hIShQUk9GSUxFJiZNRSYmUFJPRklMRS51c2VyJiZQUk9GSUxFLnVzZXIudXNlcm5hbWU9PT1NRS51c2VybmFtZSk7Ci8qIEEgZHJhZnQgaW4gcHJvZ3Jlc3Mgb3ducyB0aGUgc2NyZWVuLiBFdmVyeSBleGl0IOKAlCBuYXYgdGFwLCBiYWNrIGdlc3R1cmUsCiAgIENhbmNlbCDigJQgZnVubmVscyB0aHJvdWdoIHBjTGVhdmUoKSBzbyB0aGVyZSBpcyBleGFjdGx5IE9ORSBkZWZpbml0aW9uIG9mCiAgIHdoYXQgaXMgc2FmZSB0byB0aHJvdyBhd2F5LiBEaXJ0eSBpcyBkZXJpdmVkLCBuZXZlciBhIGZsYWc6IGEgZmxhZyBoYXMgdG8KICAgYmUgc2V0IG9uIGV2ZXJ5IGlucHV0IHBhdGggYW5kIHRoZSBvbmUgeW91IGZvcmdldCBpcyB0aGUgb25lIHRoYXQgZWF0cwogICBzb21lYm9keSdzIHBvc3QuICovCmNvbnN0IHBjRGlydHk9KCk9PiEhKFBDT01QT1NFJiYoKFBDT01QT1NFLmJvZHl8fCIiKS50cmltKCl8fFBDT01QT1NFLmltZ3MubGVuZ3RofHxQQ09NUE9TRS50cmFjaykpOwphc3luYyBmdW5jdGlvbiBwY0xlYXZlKCl7CiAgaWYoIVBDT01QT1NFKXJldHVybiB0cnVlOwogIGlmKFBDT01QT1NFLmJ1c3kpcmV0dXJuIGZhbHNlOyAgIC8vIG1pZC11cGxvYWQg4oCUIGRvbid0IHlhbmsgaXQgb3V0IGZyb20gdW5kZXIgdGhlIHJlcXVlc3QKICBpZihwY0RpcnR5KCkmJiFhd2FpdCB1aUNvbmZpcm0oIkRpc2NhcmQgeW91ciBwb3N0PyIsIllvdXIgZHJhZnQgd29uJ3QgYmUgc2F2ZWQuIiwKICAgICB7b2tMYWJlbDoiRGlzY2FyZCIsY2FuY2VsTGFiZWw6IktlZXAgd3JpdGluZyIsZGFuZ2VyOnRydWV9KSlyZXR1cm4gZmFsc2U7CiAgUENPTVBPU0U9bnVsbDtyZXR1cm4gdHJ1ZTsKfQo=") },
  { file: "public/index.html", count: 1,
    find: d("ICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigicG9wc3RhdGUiLCgpPT57"),
    replace: d("ICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigicG9wc3RhdGUiLGFzeW5jKCk9Pns=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIGVsc2UgaWYoRURJVElORyl7RURJVElORz1mYWxzZX0KICAgIGVsc2UgaWYoUFJPRklMRSl7UFJPRklMRT1udWxsfQ=="),
    replace: d("ICAgIGVsc2UgaWYoRURJVElORyl7RURJVElORz1mYWxzZX0KICAgIGVsc2UgaWYoUENPTVBPU0UpewogICAgICAvKiBCYWNrIGNhbid0IGJlIGNhbmNlbGxlZCBvbmNlIGl0IGhhcyBmaXJlZCwgc28gYSBkaXJ0eSBkcmFmdCBwdXRzIGl0cwogICAgICAgICBoaXN0b3J5IGVudHJ5IGJhY2sgYW5kIHRoZW4gYXNrcy4gIktlZXAgd3JpdGluZyIgbGVhdmVzIHlvdSBleGFjdGx5CiAgICAgICAgIHdoZXJlIHlvdSB3ZXJlLiBEaXNjYXJkaW5nIGNvc3RzIG9uZSByZWR1bmRhbnQgZW50cnkg4oCUIGEgZmFyIGNoZWFwZXIKICAgICAgICAgYnVnIHRoYW4gbG9zaW5nIHdoYXQgc29tZW9uZSB0eXBlZC4gKi8KICAgICAgaWYocGNEaXJ0eSgpfHxQQ09NUE9TRS5idXN5KXsKICAgICAgICBQT1BQSU5HPWZhbHNlOyBwdXNoVmlldygiY29tcG9zZSIpOwogICAgICAgIGlmKGF3YWl0IHBjTGVhdmUoKSlyZW5kZXIoKTsKICAgICAgICByZXR1cm47CiAgICAgIH0KICAgICAgUENPTVBPU0U9bnVsbDsKICAgIH0KICAgIGVsc2UgaWYoUFJPRklMRSl7UFJPRklMRT1udWxsfQ==") },
  { file: "public/index.html", count: 1,
    find: d("ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgiW2RhdGEtdGFiXSIpLmZvckVhY2goYj0+Yi5vbmNsaWNrPSgpPT57"),
    replace: d("ZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgiW2RhdGEtdGFiXSIpLmZvckVhY2goYj0+Yi5vbmNsaWNrPWFzeW5jKCk9PnsKICAgIGlmKFBDT01QT1NFJiZiLmRhdGFzZXQudGFiIT09InBvc3QiJiYhYXdhaXQgcGNMZWF2ZSgpKXJldHVybjs=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIGlmKGIuZGF0YXNldC50YWI9PT0icG9zdCIpewogICAgICAvKiBPbmUg77yLIGZvciB0aGUgd2hvbGUgYXBwLiBJbiB0aGUgTWFya2V0IGl0IG1lYW5zIHNlbGw7IGV2ZXJ5d2hlcmUKICAgICAgICAgZWxzZSBpdCBtZWFucyBwb3N0IOKAlCBzYW1lIGluc3RpbmN0IGFzIEluc3RhZ3JhbSdzIGNlbnRlciBidXR0b24uICovCiAgICAgIGlmKGd1ZXN0KCkpcmV0dXJuIG5lZWRBY2NvdW50KCJKb2luIHRvIHBvc3QgeW91ciB3b3JrIOKAlCBpdCBsYW5kcyBvbiB5b3VyIHByb2ZpbGUgYW5kIHRoZSBTaG93cm9vbS4iKTsKICAgICAgaWYoVEFCPT09Im1hcmtldCIpe01LVFZJRVc9InNlbGwiO1NFTExGT1JNPW51bGw7cmVuZGVyKCk7cmV0dXJufQogICAgICBQQ09NUE9TRT17Ym9keToiIixpbWdzOltdLGJ1c3k6ZmFsc2V9O3JlbmRlcigpO3JldHVybjs="),
    replace: d("ICAgIGlmKGIuZGF0YXNldC50YWI9PT0icG9zdCIpewogICAgICBpZihQQ09NUE9TRSlyZXR1cm47ICAgLy8gYWxyZWFkeSBoZXJlIOKAlCB0YXBwaW5nIO+8iyBhZ2FpbiBtdXN0IG5vdCB3aXBlIHRoZSBkcmFmdAogICAgICAvKiBPbmUg77yLIGZvciB0aGUgd2hvbGUgYXBwLiBJbiB0aGUgTWFya2V0IGl0IG1lYW5zIHNlbGw7IGV2ZXJ5d2hlcmUKICAgICAgICAgZWxzZSBpdCBtZWFucyBwb3N0IOKAlCBzYW1lIGluc3RpbmN0IGFzIEluc3RhZ3JhbSdzIGNlbnRlciBidXR0b24uICovCiAgICAgIGlmKGd1ZXN0KCkpcmV0dXJuIG5lZWRBY2NvdW50KCJKb2luIHRvIHBvc3QgeW91ciB3b3JrIOKAlCBpdCBsYW5kcyBvbiB5b3VyIHByb2ZpbGUgYW5kIHRoZSBTaG93cm9vbS4iKTsKICAgICAgaWYoVEFCPT09Im1hcmtldCIpe01LVFZJRVc9InNlbGwiO1NFTExGT1JNPW51bGw7cmVuZGVyKCk7cmV0dXJufQogICAgICBQQ09NUE9TRT17Ym9keToiIixpbWdzOltdLGJ1c3k6ZmFsc2V9O3B1c2hWaWV3KCJjb21wb3NlIik7cmVuZGVyKCk7cmV0dXJuOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICBvdi5vbmNsaWNrPWU9PntpZihlLnRhcmdldD09PW92JiYhUENPTVBPU0UuYnVzeSl7UENPTVBPU0U9bnVsbDtyZW5kZXIoKX19Owo="),
    replace: d("ICAvKiBObyBzY3JpbSBkaXNtaXNzLiBBcyBhbiBvdmVybGF5IHRoaXMgd2FzIGEgdGFwIG91dHNpZGUgdGhlIGNhcmQ7IGFzIGEKICAgICBmdWxsLWhlaWdodCBwYWdlIHRoZSBzYW1lIGhhbmRsZXIgaXMgYSB0YXAgb24gdGhlIGJhY2tncm91bmQsIGFuZCBpdCB3b3VsZAogICAgIHNpbGVudGx5IGJpbiBhIHdyaXR0ZW4gZHJhZnQuIENhbmNlbCBpcyB0aGUgd2F5IG91dC4gKi8K") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBjYz0kKCIjcGNjYW5jZWwiKTtpZihjYyljYy5vbmNsaWNrPSgpPT57UENPTVBPU0U9bnVsbDtyZW5kZXIoKX07"),
    replace: d("ICBjb25zdCBjYz0kKCIjcGNjYW5jZWwiKTtpZihjYyljYy5vbmNsaWNrPWFzeW5jKCk9PntpZihhd2FpdCBwY0xlYXZlKCkpcmVuZGVyKCl9Ow==") },
  { file: "public/index.html", count: 1,
    find: d("Y29uc3QgcHA9JCgiI3Byb2Zwb3N0Iik7aWYocHApcHAub25jbGljaz0oKT0+e1BDT01QT1NFPXtib2R5OiIiLGltZ3M6W10sYnVzeTpmYWxzZX07cmVuZGVyKCl9Ow=="),
    replace: d("Y29uc3QgcHA9JCgiI3Byb2Zwb3N0Iik7aWYocHApcHAub25jbGljaz0oKT0+e1BDT01QT1NFPXtib2R5OiIiLGltZ3M6W10sYnVzeTpmYWxzZX07cHVzaFZpZXcoImNvbXBvc2UiKTtyZW5kZXIoKX07") },
  { file: "public/index.html", count: 1,
    find: d("YDxidXR0b24gY2xhc3M9Im5hdmIgJHtpZD09PSJwb3N0Ij8iIjppZD09PSJwcm9maWxlIj8obXlPcGVuPyJvbiI6IiIpOihUQUI9PT1pZCYmIVBST0ZJTEU/Im9uIjoiIil9IiBkYXRhLXRhYj0iJHtpZH0iPg=="),
    replace: d("YDxidXR0b24gY2xhc3M9Im5hdmIgJHtpZD09PSJwb3N0Ij8oUENPTVBPU0U/Im9uIjoiIik6aWQ9PT0icHJvZmlsZSI/KG15T3BlbiYmIVBDT01QT1NFPyJvbiI6IiIpOihUQUI9PT1pZCYmIVBST0ZJTEUmJiFQQ09NUE9TRT8ib24iOiIiKX0iIGRhdGEtdGFiPSIke2lkfSI+") },
];
