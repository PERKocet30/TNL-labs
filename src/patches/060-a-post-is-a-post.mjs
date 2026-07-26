/* Patch 060 — a post is a post. Drops "work" as a thing you declare and
   makes it a fact of origin, Tumblr-style: the post composer makes posts,
   labs are rooms, and a post can be sent into a room.

   The lab composer loses "Publish to my portfolio" entirely, so ASWORK
   goes with it — which also retires the half of 059 that had defaulted
   that toggle ON. Nothing typed in a lab can promote itself out of the
   lab any more, and the per-post "+ portfolio" button that let you do it
   after the fact is gone too.

   The Showroom needs no change: it already selects is_work = 1 with no
   channel filter, so once labs can't set that flag, "everything posted
   shows up, labs stay separate" is just what the query does.

   The one thing that had to move: the lab feed rendered a card vs a chat
   line off is_work. Killing the flag in labs would have collapsed every
   dropped image to a chat line — and worse, a post SENT INTO a lab goes
   through the share route, which writes is_work = 0, so the exact thing
   this model is for would have rendered as a line. isCard() replaces it:
   media, a beat, a track, or a share renders as a card; plain talk
   renders as a line.

   Copy: PORTFOLIO badge removed, "LATEST WORK" -> "LATEST POSTS", the
   search heading likewise. The KINDS map is deliberately left alone — a
   photographer's tab says SHOTS and a producer's says TRACKS on purpose,
   and flattening those to POSTS would throw away the thing that makes
   profiles not look identical.

   13 hunks, all client. Runs after 059. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("bGV0IFBFTkRWSUQ9bnVsbCwgUEVOREtJTkQ9bnVsbCwgQVNXT1JLPXRydWUsIEVESVRJRD1udWxsLCBFRElUUk9MRVM9W107"),
    replace: d("bGV0IFBFTkRWSUQ9bnVsbCwgUEVOREtJTkQ9bnVsbCwgRURJVElEPW51bGwsIEVESVRST0xFUz1bXTsKLyogQSBwb3N0IGlzIGEgcG9zdCBiZWNhdXNlIG9mIHdoYXQgaXQgSVMsIG5vdCBiZWNhdXNlIHNvbWVvbmUgdGlja2VkIGEKICAgYm94IGJlZm9yZSBzZW5kaW5nIGl0LiBNZWRpYSwgYSBiZWF0LCBhIHRyYWNrLCBvciBhIHBvc3Qgc2VudCBpbiBmcm9tCiAgIG91dHNpZGUgcmVuZGVycyBhcyBhIGNhcmQ7IHBsYWluIHRhbGsgcmVuZGVycyBhcyBhIGNoYXQgbGluZS4gVGhlIGxhYgogICBjb21wb3NlciBubyBsb25nZXIgaGFzIGEgc2F5LCBzbyBub3RoaW5nIGluIGEgbGFiIGNhbiBwcm9tb3RlIGl0c2VsZgogICBvdXQgb2YgdGhlIGxhYi4gKi8KY29uc3QgaXNDYXJkPXA9PiEhKHAmJihwLmltYWdlVXJsfHxwLnZpZGVvVXJsfHwocC5pbWFnZXMmJnAuaW1hZ2VzLmxlbmd0aCl8fHAuYmVhdHx8cC5hdWRpb1RyYWNrSWR8fHAuc2hhcmVkRnJvbSkpOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICR7U0VBUkNIUkVTLnBvc3RzLmxlbmd0aD9gPGRpdiBjbGFzcz0ibW9ubyBkaW0iIHN0eWxlPSJtYXJnaW46MTZweCAwIDhweCI+V09SSzwvZGl2Pg=="),
    replace: d("ICAgICR7U0VBUkNIUkVTLnBvc3RzLmxlbmd0aD9gPGRpdiBjbGFzcz0ibW9ubyBkaW0iIHN0eWxlPSJtYXJnaW46MTZweCAwIDhweCI+UE9TVFM8L2Rpdj4=") },
  { file: "public/index.html", count: 1,
    find: d("ICA8ZGl2IGNsYXNzPSJzci1mZWVkaGVhZCBtb25vIj48c3Bhbj5MQVRFU1QgV09SSzwvc3Bhbj48c3BhbiBjbGFzcz0iZGltIj5DT0xMQUJTIFJBTksgSElHSEVTVDwvc3Bhbj48L2Rpdj4="),
    replace: d("ICA8ZGl2IGNsYXNzPSJzci1mZWVkaGVhZCBtb25vIj48c3Bhbj5MQVRFU1QgUE9TVFM8L3NwYW4+PHNwYW4gY2xhc3M9ImRpbSI+Q09MTEFCUyBSQU5LIEhJR0hFU1Q8L3NwYW4+PC9kaXY+") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgICB9KSgpfTwvc3Bhbj4KICAgICAgICA8bGFiZWwgY2xhc3M9IndvcmtjaGVjayI+PGlucHV0IHR5cGU9ImNoZWNrYm94IiBpZD0iYXN3b3JrIiAke0FTV09SSz8iY2hlY2tlZCI6IiJ9PiA8c3Bhbj5QdWJsaXNoIHRvIG15IHBvcnRmb2xpbzwvc3Bhbj48L2xhYmVsPgogICAgICA8L2Rpdj4="),
    replace: d("ICAgICAgICB9KSgpfTwvc3Bhbj4KICAgICAgPC9kaXY+") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBncm91cGVkPSEhKHByZXYmJiFwcmV2LmlzV29yayYmcHJldi5hdXRob3IudXNlcm5hbWU9PT1wLmF1dGhvci51c2VybmFtZQ=="),
    replace: d("ICBjb25zdCBncm91cGVkPSEhKHByZXYmJiFpc0NhcmQocHJldikmJnByZXYuYXV0aG9yLnVzZXJuYW1lPT09cC5hdXRob3IudXNlcm5hbWU=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIDxkaXYgY2xhc3M9InBvc3QtbWV0YSI+JHtlc2MocC5hdXRob3Iucm9sZS50b1VwcGVyQ2FzZSgpKX0gwrcgJHtuZXcgRGF0ZShwLmNyZWF0ZWRBdCkudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7aG91cjoibnVtZXJpYyIsbWludXRlOiIyLWRpZ2l0In0pfSR7cC5lZGl0ZWRBdD8iIMK3IEVESVRFRCI6IiJ9JHtwLmlzV29yaz9gIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncmVlbikiPlBPUlRGT0xJTzwvc3Bhbj5gOiIifTwvZGl2PiR7bXVzQ2hpcEhUTUwocCl9PC9kaXY+"),
    replace: d("ICAgIDxkaXYgY2xhc3M9InBvc3QtbWV0YSI+JHtlc2MocC5hdXRob3Iucm9sZS50b1VwcGVyQ2FzZSgpKX0gwrcgJHtuZXcgRGF0ZShwLmNyZWF0ZWRBdCkudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7aG91cjoibnVtZXJpYyIsbWludXRlOiIyLWRpZ2l0In0pfSR7cC5lZGl0ZWRBdD8iIMK3IEVESVRFRCI6IiJ9PC9kaXY+JHttdXNDaGlwSFRNTChwKX08L2Rpdj4=") },
  { file: "public/index.html", count: 1,
    find: d("ICA8ZGl2IGNsYXNzPSJwb3N0LWFjdHMyIj4KICAgICR7bWluZT9gPGJ1dHRvbiBjbGFzcz0iYWN0IiBkYXRhLWNvbGxhYj0iJHtwLmlkfSI+KyBjb2xsYWI8L2J1dHRvbj5gOiIifQogICAgJHttaW5lJiYocC5pbWFnZVVybHx8cC52aWRlb1VybCk/YDxidXR0b24gY2xhc3M9ImFjdCAke3AuaXNXb3JrPyJvbiI6IiJ9IiBkYXRhLXdvcms9IiR7cC5pZH06JHtwLmlzV29yaz8wOjF9Ij4ke3AuaXNXb3JrPyLinJMgb24gcG9ydGZvbGlvIjoiKyBwb3J0Zm9saW8ifTwvYnV0dG9uPmA6IiJ9"),
    replace: d("ICA8ZGl2IGNsYXNzPSJwb3N0LWFjdHMyIj4KICAgICR7bWluZT9gPGJ1dHRvbiBjbGFzcz0iYWN0IiBkYXRhLWNvbGxhYj0iJHtwLmlkfSI+KyBjb2xsYWI8L2J1dHRvbj5gOiIifQ==") },
  { file: "public/index.html", count: 1,
    find: d("ICBmLmlubmVySFRNTD1QT1NUUy5sZW5ndGg/UE9TVFMubWFwKChwLGkpPT5wLmlzV29yaz9wb3N0SFRNTChwKTptc2dSb3dIVE1MKHAsUE9TVFNbaS0xXSkpLmpvaW4oIiIpOmVtcHR5SFRNTChDSCk7"),
    replace: d("ICBmLmlubmVySFRNTD1QT1NUUy5sZW5ndGg/UE9TVFMubWFwKChwLGkpPT5pc0NhcmQocCk/cG9zdEhUTUwocCk6bXNnUm93SFRNTChwLFBPU1RTW2ktMV0pKS5qb2luKCIiKTplbXB0eUhUTUwoQ0gpOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIGNvbnN0IHF1ZXVlPVFVRVVFLnNsaWNlKCksIHdvcms9QVNXT1JLLCBkcmFmdFRleHQ9dDs="),
    replace: d("ICAgIGNvbnN0IHF1ZXVlPVFVRVVFLnNsaWNlKCksIHdvcms9ZmFsc2UsIGRyYWZ0VGV4dD10Ow==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIFFVRVVFPVtdO0FTV09SSz10cnVlOw=="),
    replace: d("ICAgIFFVRVVFPVtdOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgdHJ5e3EucHJlcD1hd2FpdCBwcmVwSW1hZ2UocS5maWxlLEFTV09SSyk7cS5wcmV2aWV3PXEucHJlcC50aHVtYjtxLnN0YXRlPSJvayJ9"),
    replace: d("ICAgICAgdHJ5e3EucHJlcD1hd2FpdCBwcmVwSW1hZ2UocS5maWxlLGZhbHNlKTtxLnByZXZpZXc9cS5wcmVwLnRodW1iO3Euc3RhdGU9Im9rIn0=") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBkaT0kKCIjZHJvcGltZyIpO2lmKGRpKWRpLm9uY2xpY2s9KCk9PntRVUVVRT1bXTtBU1dPUks9dHJ1ZTtyZW5kZXIoKX07CiAgY29uc3QgYXc9JCgiI2Fzd29yayIpO2lmKGF3KWF3Lm9uY2hhbmdlPWFzeW5jKCk9PnsKICAgIEFTV09SSz1hdy5jaGVja2VkOwogICAgLy8gcmUtcHJlcCBhdCB0aGUgbmV3IHF1YWxpdHkg4oCUIHBvcnRmb2xpbyB3b3JrIGtlZXBzIGl0cyByZXNvbHV0aW9uCiAgICBmb3IoY29uc3QgcSBvZiBRVUVVRSl7CiAgICAgIGlmKHEua2luZCE9PSJpbWFnZSIpY29udGludWU7CiAgICAgIHRyeXtxLnByZXA9YXdhaXQgcHJlcEltYWdlKHEuZmlsZSxBU1dPUkspO3EucHJldmlldz1xLnByZXAudGh1bWJ9Y2F0Y2goZSl7fQogICAgfQogICAgdG9hc3QoQVNXT1JLPyJGdWxsIHF1YWxpdHkgZm9yIHlvdXIgcG9ydGZvbGlvIjoiU3RhbmRhcmQgcXVhbGl0eSIpO3JlbmRlcigpOwogIH07"),
    replace: d("ICBjb25zdCBkaT0kKCIjZHJvcGltZyIpO2lmKGRpKWRpLm9uY2xpY2s9KCk9PntRVUVVRT1bXTtyZW5kZXIoKX07") },
  { file: "public/index.html", count: 1,
    find: d("ICB9KTsKICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCJbZGF0YS13b3JrXSIpLmZvckVhY2goYj0+Yi5vbmNsaWNrPWFzeW5jKCk9PnsKICAgIGNvbnN0IFtpZCxvbl09Yi5kYXRhc2V0Lndvcmsuc3BsaXQoIjoiKTsKICAgIHRyeXthd2FpdCBhcGkubWFya1dvcmsoaWQsb249PT0iMSIpO3RvYXN0KG9uPT09IjEiPyJBZGRlZCB0byB5b3VyIHBvcnRmb2xpbyI6IlJlbW92ZWQgZnJvbSBwb3J0Zm9saW8iKTtsb2FkRmVlZCgpfWNhdGNoKGUpe3RvYXN0KGUubWVzc2FnZSl9fSk7"),
    replace: d("ICB9KTs=") },
];
