/* TNL LABS admin v2.0 — 2026-09-29. Studio stats, carried over from admin v1
   unchanged in substance: what producers do with the beat maker. Reached from
   Content → Studio stats. */
LOADERS.studio = async () => { D.studio = await req("/api/admin/studio"); };
VIEWS.studio = () => `<div class="row sp"><h1 style="font-size:22px">Studio stats</h1><button class="btn ghost sm" data-go="content">Back to content</button></div>
  <div class="studio" style="margin-top:12px">${studioHTML()}</div>`;
function studioHTML(){
  const d=D.studio;
  if(!d)return `<div class="empty">Loading…</div>`;
  const f=d.funnel;
  const maxF=Math.max(1,f.opened);
  const names={kick:"KICK",snare:"SNARE",hat:"HAT",clap:"CLAP",perc:"PERC",bass:"808",synth:"SYNTH"};
  return `
  <div class="hero"><h1>Studio</h1><p>What producers do with it. This decides what gets built next — not my taste, not yours.</p></div>

  <div class="panel">
    <h3>WHICH BUILT-IN SOUNDS PRODUCERS THROW AWAY</h3>
    <p style="font-size:13px;line-height:1.7;color:var(--dim);margin-bottom:14px">
      Someone replacing a built-in voice with their own sample is the most honest quality
      signal there is: they heard it, didn't like it, and did something about it.
      <b style="color:var(--tx)">Whatever's at the top of this list is what I fix next.</b>
    </p>
    ${d.replaced.length?`<div class="bars">${(()=>{
      const max=Math.max(...d.replaced.map(x=>x.n));
      return d.replaced.map(x=>`<div class="bar">
        <span class="lab">${esc(names[x.voice]||x.voice.toUpperCase())}</span>
        <div class="track"><div class="fill" style="width:${(x.n/max)*100}%;background:var(--red)"></div></div>
        <span class="n">${x.n}</span>
      </div>`).join("");
    })()}</div>
    <p class="mono dim" style="margin-top:10px;line-height:1.6">Replaced by ${d.replaced.reduce((s,x)=>s+x.people,0)} producer(s). Red because it's a complaint.</p>`
    :`<div class="empty">Nobody's replaced a built-in sound yet.<br><br>Either they're fine — or nobody's opened the studio. Check the funnel.</div>`}
  </div>

  <div class="panel">
    <h3>DOES ANYONE ACTUALLY USE IT</h3>
    <div class="bars">${[["Opened the studio",f.opened],["Pressed play",f.played],["Saved a draft",f.saved],["Published to #beats",f.published],["Exported a WAV",f.exported]]
      .map(([l,n],i,arr)=>{
        const prev=i?arr[i-1][1]:n; const drop=prev-n;
        const bad=i>0&&prev>0&&drop/prev>=0.5;
        return `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;font-weight:700">${l}</span><span class="mono dim">${n}</span></div>
          <div class="track"><div class="fill" style="width:${(n/maxF)*100}%;${bad?"background:var(--red)":""}"></div></div>
          ${bad?`<div class="mono" style="color:var(--red);font-size:9px;margin-top:3px">↓ lost ${drop} here</div>`:""}
        </div>`}).join("")}</div>
    ${!f.opened?`<div class="rep" style="margin-top:12px"><div class="rt">Nobody has opened the studio.</div>
      <div class="rb">The most technically involved thing in the app and it has zero users. That's not a sound quality problem — you can't be let down by a sound you never heard. Something upstream is stopping them: they don't know it's there, it looks like work, or they came for something else. Ask one person.</div></div>`:""}
  </div>

  <div class="cards">
    <div class="card"><div class="k">BEATS PUBLISHED</div><div class="v">${d.published}</div>
      <div class="s">${d.withSamples} used custom sounds · ${d.withSlides} used 808 slides</div></div>
    <div class="card"><div class="k">SOUNDS UPLOADED</div><div class="v">${d.totalSamples}</div>
      <div class="s">by ${d.uploaders} producer${d.uploaders===1?"":"s"}</div></div>
    <div class="card"><div class="k">MEDIAN BPM</div><div class="v">${d.bpm.median||"—"}</div>
      <div class="s">${d.bpm.min?d.bpm.min+"–"+d.bpm.max+" range":"nothing published yet"}${d.bpm.median&&d.bpm.median!==140?" · default is 140":""}</div></div>
    <div class="card"><div class="k">MEDIAN LOUDNESS</div><div class="v">${d.medianLoudness!=null?Math.round(d.medianLoudness*100)+"%":"—"}</div>
      <div class="s">default is 75%${d.medianLoudness!=null&&Math.abs(d.medianLoudness-0.75)>0.15?" — they disagree":""}</div></div>
  </div>

  <div class="panel">
    <h3>THE SPEC — WHAT REAL SOUNDS MEASURE vs WHAT I BUILT</h3>
    <p style="font-size:13px;line-height:1.7;color:var(--dim);margin-bottom:14px">
      Measured in the browser while each sample was being decoded to play. Numbers only —
      never the audio. <b style="color:var(--tx)">Where these disagree, mine is wrong.</b>
      This is the spec for the built-in sounds, written by the people using them.
    </p>
    ${d.shape&&d.shape.length?`<div class="scrollx"><table>
      <thead><tr><th>SLOT</th><th>N</th><th>THEIRS</th><th>MINE</th><th>VERDICT</th></tr></thead>
      <tbody>${d.shape.map(x=>{
        const m=d.mine[x.slot]||d.mine[x.slot==="bass"?"bass":x.slot];
        const fund=x.fund?Math.round(x.fund):null;
        const rows=[];
        if(m){
          if(fund&&m.fund){
            const off=Math.round((fund-m.fund)/m.fund*100);
            if(Math.abs(off)>15)rows.push(`pitch ${off>0?"+":""}${off}% — mine sits at ${m.fund}Hz, theirs at ${fund}Hz`);
          }
          if(x.decay&&m.decay){
            const off=Math.round((x.decay-m.decay)/m.decay*100);
            if(Math.abs(off)>25)rows.push(`decay ${off>0?"+":""}${off}% — mine ${m.decay}ms, theirs ${Math.round(x.decay)}ms`);
          }
          if(x.centroid&&m.centroid){
            const off=Math.round((x.centroid-m.centroid)/m.centroid*100);
            if(Math.abs(off)>40)rows.push(`${off>0?"brighter":"darker"} — mine ${m.centroid}Hz, theirs ${Math.round(x.centroid)}Hz`);
          }
        }
        return `<tr>
          <td><b>${esc(x.slot.toUpperCase())}</b></td>
          <td class="mono dim">${x.n}</td>
          <td class="mono dim" style="font-size:10px">
            ${fund?fund+"Hz · ":""}${Math.round(x.decay)}ms<br>
            <span style="opacity:.7">${Math.round(x.centroid)}Hz bright · ${x.peak.toFixed(1)}dB peak</span></td>
          <td class="mono dim" style="font-size:10px">${m?esc(m.note):"—"}</td>
          <td style="max-width:240px">${rows.length
            ? rows.map(r=>`<div class="mono" style="color:var(--red);font-size:9px;line-height:1.5">→ ${esc(r)}</div>`).join("")
            : `<span class="mono" style="color:var(--green);font-size:9px">mine's in the ballpark</span>`}</td>
        </tr>`;}).join("")}</tbody></table></div>
      <p class="mono dim" style="margin-top:10px;line-height:1.6">
        Red = a measurable gap between my synth and what producers actually use. Not taste — arithmetic.</p>`
    :`<div class="empty">No sounds measured yet.<br><br>The moment a producer uploads a kick, this table tells me exactly how wrong mine is.</div>`}
  </div>

  <div class="panel">
    <h3>WHAT FORMATS THEY BRING</h3>
    ${d.formats.length?`<div class="scrollx"><table>
      <thead><tr><th>FORMAT</th><th>UPLOADS</th><th>PEOPLE</th><th>AVG SIZE</th></tr></thead>
      <tbody>${d.formats.map(x=>`<tr>
        <td><b>${esc(x.fmt.toUpperCase())}</b></td><td>${x.n}</td><td>${x.people}</td>
        <td class="mono dim">${(x.avg_bytes/1024).toFixed(0)} KB</td>
      </tr>`).join("")}</tbody></table></div>
      <p class="mono dim" style="margin-top:10px;line-height:1.6">If a format shows up that we reject, that's a silent wall. AIFF was one — a producer's Logic kit would've bounced.</p>`
    :`<div class="empty">No sounds uploaded yet.</div>`}
  </div>

  ${d.slots.length?`<div class="panel">
    <h3>WHAT SOUNDS THEY NEED MOST</h3>
    <div class="bars">${(()=>{const max=Math.max(...d.slots.map(x=>x.n));
      return d.slots.map(x=>`<div class="bar"><span class="lab">${esc(x.slot.toUpperCase())}</span>
        <div class="track"><div class="fill" style="width:${(x.n/max)*100}%"></div></div>
        <span class="n">${x.n}</span></div>`).join("")})()}</div>
  </div>`:""}

  ${d.voiceUse.length?`<div class="panel">
    <h3>WHICH TRACKS GET USED AT ALL</h3>
    <div class="bars">${(()=>{const max=Math.max(...d.voiceUse.map(x=>x.n));
      return d.voiceUse.map(x=>`<div class="bar"><span class="lab">${esc((names[x.id]||x.id).toUpperCase())}</span>
        <div class="track"><div class="fill" style="width:${(x.n/max)*100}%"></div></div>
        <span class="n">${x.n}</span></div>`).join("")})()}</div>
    <p class="mono dim" style="margin-top:10px;line-height:1.6">A track nobody touches is a track that should be cut, not improved. Dead weight makes the whole thing look harder than it is.</p>
  </div>`:""}

  <div class="panel">
    <h3>WHERE THE LINE IS</h3>
    <p style="font-size:13px;line-height:1.7;color:var(--dim)">
      <b style="color:var(--green)">We measure:</b> the shape of an uploaded sound — pitch, length,
      brightness, level. Computed in the browser while it's already decoded to play. Only the
      numbers come back. Aggregated by slot, never per person.<br><br>
      <b style="color:var(--red)">We don't:</b> store or analyse the audio server-side. Build a
      profile of anyone's sound. Share it. Use it to recreate their kit.<br><br>
      <b style="color:var(--tx)">And the studio says so</b>, in the upload panel, in plain words.
      A quiet version of this would be mining — and if that ever got out you wouldn't lose a
      feature, you'd lose the trust the whole network runs on. Disclosure is what makes it fair,
      not the code.
    </p>
  </div>`;
}

/* ---------- settings ---------- */
