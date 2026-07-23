/* Patch 013 — mp3 uploads were rejected before they left the phone.
   iOS greys out any file whose UTI doesn't match the accept list, so a file
   named "...mp3.pm)" was never selectable. Extensions are now named
   explicitly, the client type guard falls back to the extension when
   file.type is empty, and the size cap matches the server's 100MB.
   Runs after 012. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("PGlucHV0IHR5cGU9ImZpbGUiIGlkPSJ0cmtmaWxlIiBhY2NlcHQ9ImF1ZGlvLyoiIGhpZGRlbj4="),
    replace: d("PGlucHV0IHR5cGU9ImZpbGUiIGlkPSJ0cmtmaWxlIiBhY2NlcHQ9ImF1ZGlvLyosLm1wMywubTRhLC53YXYsLmFhYywuYWlmZiwuYWlmLC5mbGFjLC5vZ2ciIGhpZGRlbj4=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIGlmKCEvXmF1ZGlvXC8vLnRlc3QoZmlsZS50eXBlKSlyZXR1cm4gdG9hc3QoIkF1ZGlvIGZpbGVzIG9ubHkiKTsKICAgIGlmKGZpbGUuc2l6ZT42MCoxMDI0KjEwMjQpcmV0dXJuIHRvYXN0KCJPdmVyIDYwTUIg4oCUIHRyaW0gaXQgZG93biIpOw=="),
    replace: d("ICAgIGNvbnN0IGlzQXVkPS9eYXVkaW9cLy8udGVzdChmaWxlLnR5cGUpfHwvXC4obXAzfG00YXx3YXZ8YWFjfGFpZmZ8YWlmfGZsYWN8b2dnKSQvaS50ZXN0KGZpbGUubmFtZSk7CiAgICBpZighaXNBdWQpcmV0dXJuIHRvYXN0KCJBdWRpbyBmaWxlcyBvbmx5Iik7CiAgICBpZihmaWxlLnNpemU+MTAwKjEwMjQqMTAyNClyZXR1cm4gdG9hc3QoIk92ZXIgMTAwTUIg4oCUIHRyaW0gaXQgZG93biIpOw==") },
];
