// step0-review.js — ⓪ ทบทวนแผนเดิม: แนบ PDF, ตรวจคำตอบ AI, ตรวจงบ/สถานะ, บันทึก .json
/* ---------- step 1: PDF ---------- */
function facts(el, items){ el.innerHTML = items.map(([cls,txt]) => `<li class="${cls}">${txt}</li>`).join(''); }
async function readPdf(file){
  facts($('#pdfFacts'), [['info','กำลังอ่านไฟล์…']]);
  $('#dropTitle').textContent = file.name;
  if (!window.pdfjsLib){ facts($('#pdfFacts'), [['bad','โหลดตัวอ่าน PDF ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่']]); return; }
  try{
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data:new Uint8Array(buf), isEvalSupported:false }).promise;
    const lines = await extractLines(pdf);
    const a = analyzePlanText(lines);
    a.pages = pdf.numPages;
    state.pdfName = file.name; state.pdf = a;
    const rows = Object.keys(a.rows).length;
    const out = [['ok', `อ่านไฟล์ได้ ${a.pages} หน้า`]];
    if (!a.hasText) out.push(['warn','ไฟล์นี้แทบไม่มีข้อความฝังอยู่ (อาจเป็นไฟล์สแกน) ต้องยืนยันงบทุกบรรทัดด้วยตา']);
    else if (a.s31 === null) out.push(['warn','ไม่พบหัวข้อ 3.1 ในข้อความของไฟล์ (อาจใช้แบบฟอร์มอื่น) ต้องยืนยันงบทุกบรรทัดด้วยตา']);
    else out.push(['ok', `พบตาราง 3.1 เริ่มหน้า ${a.s31} มี ${rows} แถว อ่านงบได้ ${Object.values(a.rows).filter(r=>r.budget!==null||r.nobudget).length} แถว`]);
    if (a.problemRows.length) out.push(['info', `ตารางวิเคราะห์ปัญหา (2.6) มี ${a.problemRows.length} แถว`]);
    facts($('#pdfFacts'), out);
    $('#s1').classList.add('done');
    if (state.ai) runChecks();
  }catch(e){
    facts($('#pdfFacts'), [['bad','เปิดไฟล์นี้ไม่ได้ ตรวจว่าเป็น PDF ที่ไม่ได้ใส่รหัสผ่าน แล้วลองใหม่']]);
  }
}
const drop = $('#drop');
$('#pdfInput').addEventListener('change', e => { const f=e.target.files[0]; if(f) readPdf(f); });
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f=e.dataTransfer.files[0]; if(f) readPdf(f); });

/* ---------- step 2: AI answer ---------- */
$('#promptBox').value = PROMPT;
$('#copyPrompt').addEventListener('click', async () => {
  try{ await navigator.clipboard.writeText(PROMPT); openGemini('แนบไฟล์ PDF แผนเดิม แล้ววางคำสั่ง (Ctrl+V)'); }
  catch(e){ const d=document.querySelector('details.prompt'); d.open=true; const b=$('#promptBox'); b.focus(); b.select(); toast('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้ให้แล้ว กดคัดลอกเอง'); }
});
$('#loadSample').addEventListener('click', () => { $('#aiBox').value = JSON.stringify(SAMPLE, null, 1); state.usingSample = true; $('#sampleNote').hidden=false; ingest(); });
$('#checkBtn').addEventListener('click', () => { state.usingSample = false; $('#sampleNote').hidden=true; ingest(); });

function parseAI(text){
  let t = text.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('nojson');
  return JSON.parse(t.slice(a, b+1));
}
function ingest(){
  let ai;
  try{ ai = parseAI($('#aiBox').value); }
  catch(e){ facts($('#aiFacts'), [['bad','อ่านคำตอบไม่ได้ ต้องเป็น JSON ทั้งก้อน ตรวจว่าคัดลอกมาครบตั้งแต่ { ตัวแรกถึง } ตัวสุดท้าย']]); return; }
  if (!ai?.part3?.projects?.length){ facts($('#aiFacts'), [['bad','ในคำตอบไม่มีรายการโครงการ (part3.projects) ให้ส่งคำสั่งให้ AI ใหม่อีกครั้ง']]); return; }
  ai.part3.projects.forEach((p,i) => { if(!p.id) p.id = 'P'+String(i+1).padStart(2,'0'); if(!p.priority_no) p.priority_no = i+1; });
  if (!wsAdoptAi(ai)) return;
  $('#s2').classList.add('done');
  runChecks();
}

function sim(a,b){
  a=String(a).replace(/\s/g,''); b=String(b).replace(/\s/g,'');
  if(!a||!b) return 0; const m=a.length,n=b.length; const d=Array.from({length:m+1},(_,i)=>[i]);
  for(let j=1;j<=n;j++) d[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return 1 - d[m][n]/Math.max(m,n);
}
function budgetCheck(p){
  if (!state.pdf) return { kind:'nopdf' };
  if (!state.pdf.hasText || state.pdf.s31 === null) return { kind:'notext' };
  const r = state.pdf.rows[p.priority_no];
  if (!r) return { kind:'notfound' };
  if (r.nobudget && (!p.budget)) return { kind:'match', pdf:0 };
  if (r.budget === null) return { kind:'notfound' };
  return r.budget === Number(p.budget) ? { kind:'match', pdf:r.budget } : { kind:'mismatch', pdf:r.budget };
}
function runChecks(){
  const ai = state.ai, out = [];
  const projects = ai.part3.projects;
  const blob = JSON.stringify(ai);
  if (/[฻๚๛]/.test(blob)) out.push(['bad','พบตัวอักษรเพี้ยน (฻ ๚ ๛) ในคำตอบ แปลว่า AI อ่านข้อความที่ฝังในไฟล์แทนการอ่านจากภาพ ให้ลองใหม่โดยส่งภาพหน้าจอหน้าตาราง 3.1 แทนไฟล์ PDF']);
  else out.push(['ok','ไม่พบตัวอักษรเพี้ยน AI อ่านจากภาพหน้าเอกสาร']);
  out.push(['info', `ตำบล${esc(ai.meta?.tambon||'?')} อำเภอ${esc(ai.meta?.amphoe||'?')} แผนปี ${esc(ai.meta?.plan_year||'?')} มี ${projects.length} โครงการ`]);
  if (state.pdf && state.pdf.s31 !== null){
    const pdfRows = Object.keys(state.pdf.rows).length;
    if (pdfRows !== projects.length) out.push(['bad', `จำนวนโครงการไม่ตรงกัน ไฟล์มี ${pdfRows} แถว แต่ AI ส่งมา ${projects.length} โครงการ`]);
    const mis = projects.filter(p => budgetCheck(p).kind==='mismatch').length;
    out.push([mis? 'bad':'ok', mis ? `งบประมาณที่ AI อ่านไม่ตรงกับไฟล์ ${mis} โครงการ ต้องตรวจกับเล่มจริงในข้อ ค` : 'งบประมาณทุกโครงการตรงกับตัวเลขในไฟล์']);
    const pr = ai.part2?.problems?.length || 0;
    if (state.pdf.problemRows.length && pr !== state.pdf.problemRows.length) out.push(['warn', `ตารางวิเคราะห์ปัญหาในไฟล์มี ${state.pdf.problemRows.length} แถว แต่ AI ส่งมา ${pr} แถว`]);
  } else if (!state.pdf) out.push(['warn','ยังไม่ได้แนบ PDF ในข้อ ก จึงยังเทียบงบกับต้นฉบับไม่ได้']);
  else out.push(['warn','ไฟล์ไม่มีข้อความให้เทียบ ต้องยืนยันงบทุกบรรทัดด้วยตา']);
  const pop = ai.part1?.population;
  if (pop && pop.total && pop.male + pop.female !== pop.total) out.push(['warn', `ประชากรชายรวมหญิง (${fmt(pop.male+pop.female)}) ไม่เท่ากับยอดรวม (${fmt(pop.total)})`]);
  const dups = [];
  for (let i=0;i<projects.length;i++) for (let j=i+1;j<projects.length;j++)
    if (sim(projects[i].name, projects[j].name) >= .9) dups.push(`ลำดับ ${projects[i].priority_no} กับ ${projects[j].priority_no}`);
  if (dups.length) out.push(['warn', 'ชื่อโครงการซ้ำหรือเกือบซ้ำ: ' + dups.join(', ')]);
  const found = (ai.meta?.file_check?.sections_found || []).join(' ');
  if (found && !/ส่วนที่\s*5/.test(found)) out.push(['warn','ไม่พบส่วนที่ 5 เรื่องอื่น ๆ ตามแบบฟอร์ม']);
  const pd = (ai.flags||[]).filter(f => f.type==='personal_data_present');
  if (pd.length) out.push(['warn', `AI แจ้งว่าพบข้อมูลส่วนบุคคล ${pd.length} จุดในเล่ม (หน้า ${pd.map(f=>esc(f.page_printed)).join(', ')}) ข้อมูลเหล่านี้ไม่ถูกนำเข้าแอป`]);
  facts($('#aiFacts'), out);
  render();
}

/* ---------- step 3: ledger ---------- */
function diffMark(a, b){
  const A = fmt(a), B = fmt(b);
  if (A.length !== B.length) return `<mark>${esc(A)}</mark>`;
  return [...A].map((c,i) => c===B[i] ? esc(c) : `<mark>${esc(c)}</mark>`).join('');
}
function rv(id){ return state.review[id] || (state.review[id] = {}); }
function needsCheck(p){ const k=budgetCheck(p).kind; return k!=='match' && !rv(p.id).budgetConfirmed; }

function moneyHTML(p){
  const c = budgetCheck(p), r = rv(p.id);
  if (c.kind === 'match') return `<div class="pair"><span class="lbl">งบ</span><span class="val">${fmt(c.pdf)}</span></div><div class="verdict ok">ตรงกับไฟล์</div>`;
  if (c.kind === 'mismatch'){
    const head = `<div class="pair"><span class="lbl">AI อ่าน</span><span class="val">${diffMark(p.budget, c.pdf)}</span><span class="lbl">ในไฟล์</span><span class="val">${fmt(c.pdf)}</span></div>`;
    if (r.budgetConfirmed) return head + `<div class="verdict ok">ยืนยันแล้ว ${fmt(r.budgetFinal)} บาท</div><div class="fix"><button class="btn ghost small" data-act="unconfirm" type="button">แก้ไข</button></div>`;
    return head + `<div class="verdict bad">ไม่ตรงกัน เปิดเล่มจริงดูแล้วเลือก</div><div class="fix"><button class="btn small" data-act="usePdf" type="button">ใช้ ${fmt(c.pdf)}</button><button class="btn ghost small" data-act="useAi" type="button">ใช้ ${fmt(p.budget)}</button></div>`;
  }
  const why = { nopdf:'ยังไม่ได้แนบ PDF', notext:'ไฟล์ไม่มีข้อความให้เทียบ', notfound:'หาแถวนี้ในไฟล์ไม่พบ' }[c.kind];
  const v = r.budgetFinal ?? p.budget;
  return `<div class="pair"><span class="lbl">AI อ่าน</span><span class="val">${fmt(p.budget)}</span></div>
    <div class="verdict warn">${why}</div>
    <input type="number" min="0" step="1" value="${esc(v ?? '')}" data-act="manual" aria-label="งบประมาณที่ตรวจแล้ว">
    <label class="chk"><input type="checkbox" data-act="manualOk" ${r.budgetConfirmed?'checked':''}> ตรวจกับเล่มจริงแล้ว</label>`;
}
function statusHTML(p){
  const r = rv(p.id);
  const opts = ['<option value="">ระบุสถานะ…</option>'].concat(Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${r.status===k?'selected':''}>${v}</option>`)).join('');
  const rs = ['<option value="">เพราะอะไร…</option>'].concat(REASONS.map(x => `<option ${r.reason===x?'selected':''}>${x}</option>`)).join('');
  return `<select data-act="status" aria-label="สถานะโครงการ">${opts}</select>
    <div class="sub" ${r.status==='not_done'?'':'hidden'}>
      <select data-act="reason" aria-label="เหตุผลที่ยังไม่ได้ทำ">${rs}</select>
      <select data-act="decision" aria-label="การตัดสินใจ">
        <option value="">แผนใหม่จะ…</option>
        <option value="carry" ${r.decision==='carry'?'selected':''}>ยกไปแผนใหม่</option>
        <option value="drop" ${r.decision==='drop'?'selected':''}>ตัดออก</option>
      </select>
    </div>`;
}
function render(){
  const ai = state.ai, list = $('#list');
  if (!ai){ list.innerHTML = '<div class="empty">วางคำตอบจาก AI ในข้อ ข แล้วรายการโครงการจะขึ้นที่นี่</div>'; tally(); summary(); return; }
  const ps = ai.part3.projects.filter(p => state.filter==='all' || (state.filter==='check' && needsCheck(p)) || (state.filter==='nostatus' && !rv(p.id).status));
  if (!ps.length){ list.innerHTML = '<div class="empty">ไม่มีรายการในตัวกรองนี้</div>'; }
  else list.innerHTML = ps.map(p => {
    const k = budgetCheck(p).kind, r = rv(p.id);
    const cls = (k==='mismatch' && !r.budgetConfirmed) ? 'flag-bad' : (k!=='match' && !r.budgetConfirmed ? 'flag-warn' : '');
    return `<article class="item ${cls}" data-id="${esc(p.id)}">
      <div class="no">${esc(p.priority_no)}</div>
      <div class="name"><input value="${esc(r.name ?? p.name)}" data-act="name" aria-label="ชื่อโครงการ ลำดับ ${esc(p.priority_no)}">
        <div class="meta"><span class="tag">${esc(p.form_dimension||'ไม่ระบุด้าน')}</span><span class="tag">${esc(p.method||'ไม่ระบุวิธี')}</span>เป้าหมาย ${esc(p.target||'–')}</div></div>
      <div class="money">${moneyHTML(p)}</div>
      <div class="status">${statusHTML(p)}</div>
    </article>`;
  }).join('');
  tally(); summary(); persist();
}
$('#list').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const art = b.closest('.item'); const p = state.ai.part3.projects.find(x => x.id===art.dataset.id); const r = rv(p.id);
  const c = budgetCheck(p);
  if (b.dataset.act==='usePdf'){ r.budgetFinal=c.pdf; r.budgetConfirmed=true; }
  if (b.dataset.act==='useAi'){ r.budgetFinal=Number(p.budget); r.budgetConfirmed=true; }
  if (b.dataset.act==='unconfirm'){ r.budgetConfirmed=false; }
  render(); const n=document.querySelector(`.item[data-id="${CSS.escape(p.id)}"]`); if(n){ n.classList.add('flash'); }
});
$('#list').addEventListener('change', e => {
  const el = e.target, art = el.closest('.item'); if (!art) return;
  const p = state.ai.part3.projects.find(x => x.id===art.dataset.id); const r = rv(p.id);
  const a = el.dataset.act;
  if (a==='status'){ r.status = el.value || undefined; if (r.status!=='not_done'){ delete r.reason; delete r.decision; } render(); return; }
  if (a==='reason') r.reason = el.value || undefined;
  if (a==='decision') r.decision = el.value || undefined;
  if (a==='name') r.name = el.value.trim() || undefined;
  if (a==='manual') r.budgetFinal = el.value==='' ? null : Number(el.value);
  if (a==='manualOk'){ if (r.budgetFinal===undefined) r.budgetFinal = Number(p.budget); r.budgetConfirmed = el.checked; render(); return; }
  tally(); summary(); persist();
});
document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
  state.filter = ch.dataset.f; document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c===ch))); render();
}));

function finalBudget(p){ const c=budgetCheck(p), r=rv(p.id); if (r.budgetConfirmed && r.budgetFinal!==undefined && r.budgetFinal!==null) return r.budgetFinal; if (c.kind==='match') return c.pdf; return null; }
function tally(){
  const ps = state.ai?.part3?.projects || [];
  $('#tProj').textContent = ps.length;
  $('#tBad').textContent = ps.filter(needsCheck).length;
  $('#tConf').textContent = ps.filter(p => budgetCheck(p).kind==='match' || rv(p.id).budgetConfirmed).length;
  $('#tStat').textContent = ps.filter(p => rv(p.id).status).length;
}
function summary(){
  const ps = state.ai?.part3?.projects || [];
  if (!ps.length){ $('#summary').innerHTML=''; return; }
  const st = p => rv(p.id).status;
  const by = k => ps.filter(p => st(p)===k);
  const nd = by('not_done');
  const carry = ps.filter(p => st(p)==='done_continue' || (st(p)==='not_done' && rv(p.id).decision==='carry'));
  const sum = arr => arr.reduce((s,p) => s + (finalBudget(p) ?? 0), 0);
  const unknown = carry.filter(p => finalBudget(p)===null).length;
  $('#summary').innerHTML = `
    <div><b>${by('done').length}</b><span>ทำแล้ว จบโครงการ</span></div>
    <div><b>${by('done_continue').length}</b><span>ทำแล้ว และทำต่อในแผนใหม่</span></div>
    <div><b>${nd.length}</b><span>ยังไม่ได้ทำ (ยกไป ${nd.filter(p=>rv(p.id).decision==='carry').length} ตัดออก ${nd.filter(p=>rv(p.id).decision==='drop').length})</span></div>
    <div><b>${carry.length}</b><span>โครงการที่เข้าแผนใหม่</span></div>
    <div><b>${fmt(sum(carry))}</b><span>งบของโครงการที่เข้าแผนใหม่ (บาท)${unknown?` ยังไม่ยืนยันงบ ${unknown} รายการ`:''}</span></div>`;
}

/* ---------- step 4: save ---------- */
function exportData(){
  const ai = state.ai;
  return {
    type:'tambon-plan-review', version:1, generated_at:new Date().toISOString(),
    source:{ pdf_file: state.pdfName, ai_answer_is_test_sample: state.usingSample },
    meta: ai.meta, part1: ai.part1, part2: ai.part2, part4: ai.part4,
    projects: ai.part3.projects.map(p => { const r=rv(p.id), c=budgetCheck(p); return {
      ...p, name: r.name ?? p.name, budget_ai: p.budget, budget_pdf: c.pdf ?? null, budget_final: finalBudget(p),
      budget_check: c.kind, budget_confirmed: c.kind==='match' || !!r.budgetConfirmed,
      review: { status: r.status || null, reason: r.reason || null, decision: r.decision || null } }; }),
    flags: ai.flags || [],
    new_plan_projects: { items: orderedItems(planItems()).map(({flags, ...x}) => x), priority_3_1: orderedItems(planItems()).map(x => x.uid), ai_candidates_not_selected: prj.extra.filter(x => x.source==='ai' && !x.accepted).map(x => x.name) },
    analysis: { tis_community_file: ana.commFile, tis_community_is_test_sample: ana.commIsSample, tis_community: ana.comm, venue_notes: (ana.venue||'').split('\n').map(s=>s.trim()).filter(Boolean), part2_draft: ana.answer, validation: ana.validation },
    current: { tis_file: cur.tisFile, tis_is_test_sample: cur.tisIsSample, tis: cur.tis, tis_village_stats: cur.tisStats, baseline: cur.base },
    // สถานะทำงานทั้งหมดของทุกขั้น ใช้เปิดไฟล์นี้กลับมาทำต่อได้ครบ (คีย์ด้านบนคงไว้เหมือนเดิม)
    workspace: wsSnapshot()
  };
}
// สำรองงานทั้งหมดของตำบลที่เปิดอยู่เป็นไฟล์ .json (ปุ่มที่แถบตำบลด้านบนและในข้อ ง)
async function backupFile(){
  if (!state.ai){ toast('ยังสำรองไม่ได้ ต้องนำโครงการจากแผนเดิมเข้ามาในขั้น ⓪ ก่อน'); location.hash = '#review'; return; }
  const ps = state.ai.part3.projects;
  const pend = ps.filter(needsCheck).length, nost = ps.filter(p=>!rv(p.id).status).length;
  $('#saveNote').textContent = (pend||nost) ? `ยังเหลืองบที่ต้องตรวจ ${pend} รายการ และยังไม่ระบุสถานะ ${nost} รายการ ไฟล์ที่สำรองจะติดสถานะ “ยังไม่ครบ” ไว้` : 'ตรวจครบทุกรายการแล้ว';
  const data = JSON.stringify(exportData(), null, 1);
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const name = `แผนตำบล_${state.ai.meta?.tambon||'ตำบล'}_${state.ai.meta?.plan_year||''}_สำรอง_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`;
  let dl = null; try{ dl = await window.claude?.use?.('downloads'); }catch(e){}
  if (dl){
    try{ await dl.save({ filename:name, data }); toast('บันทึกไฟล์สำรองแล้ว: ' + name); return; }
    catch(e){ if (e?.code==='declined') { toast('ยกเลิกการบันทึก'); return; } }
  }
  // เว็บทั่วไป (เช่น GitHub Pages): ดาวน์โหลดผ่านลิงก์
  try{
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type:'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('เริ่มดาวน์โหลดไฟล์สำรองแล้ว: ' + name + ' ดูในโฟลเดอร์ดาวน์โหลด (Downloads)'); return;
  }catch(e){}
  const box=$('#exportBox'); box.hidden=false; box.value=data; box.focus(); box.select();
  toast('ดาวน์โหลดไฟล์จากหน้านี้ไม่ได้ คัดลอกข้อความในกล่องไปเก็บในไฟล์ .json แทน');
}
$('#saveBtn').addEventListener('click', backupFile);
$('#resetBtn').addEventListener('click', () => {
  if (!state.ai) return;
  if (!confirm('ล้างสถานะโครงการและงบที่ยืนยันไว้ในขั้น ⓪ ของตำบลนี้?\n\nข้อมูลขั้นอื่นไม่ถูกลบ ย้อนกลับไม่ได้ ถ้าเคยสำรองไฟล์ไว้ เปิดไฟล์นั้นเพื่อกู้คืนได้')) return;
  state.review = {}; render(); toast('ล้างสถานะและงบที่ตรวจในขั้น ⓪ แล้ว');
});
