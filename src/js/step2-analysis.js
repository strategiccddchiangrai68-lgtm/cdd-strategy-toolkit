// step2-analysis.js — ② หน้าจอ SWOT และยุทธศาสตร์
// answer = คำตอบดิบจาก AI (ไม่แก้), draft = ร่าง SWOT ฉบับทำงานที่เจ้าหน้าที่แก้ได้ มีสถานะรายข้อ (ดู SWOT_ST)
const ANA0 = () => ({ comm:null, commFile:null, commIsSample:false, venue:'', answerText:'', answer:null, validation:null, draft:null });
const ana = ANA0();
function anaPersist(){ wsSave(); }
function ingestComm(rows, name, sample){
  ana.comm = parseCommunityRows(rows); ana.commFile = name; ana.commIsSample = !!sample;
  $('#drop3Title').textContent = name; anaPersist(); renderAnalysis();
}
async function readComm(file){
  if (!window.XLSX){ facts($('#commFacts'), [['bad','โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่']]); return; }
  try{ const wb = XLSX.read(await file.arrayBuffer(), { type:'array' }); ingestComm(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' }), file.name, false); }
  catch(e){ facts($('#commFacts'), [['bad','เปิดไฟล์นี้ไม่ได้ ตรวจว่าเป็นไฟล์ Excel ที่ส่งออกจาก TIS']]); }
}
$('#commInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) readComm(f); });
const drop3 = $('#drop3');
['dragenter','dragover'].forEach(ev => drop3.addEventListener(ev, e => { e.preventDefault(); drop3.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop3.addEventListener(ev, e => { e.preventDefault(); drop3.classList.remove('over'); }));
drop3.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readComm(f); });
$('#loadCommSample').addEventListener('click', () => ingestComm(COMM_SAMPLE_ROWS, 'ตัวอย่างจริง: ผลการวิเคราะห์ข้อมูลชุมชน ป่าแดด', true));
$('#venueBox').addEventListener('input', () => { ana.venue = $('#venueBox').value; anaPersist(); clearTimeout(renderAnalysis._t); renderAnalysis._t = setTimeout(renderAnalysis, 400); });

const STATUS_TXT = { done:'ทำแล้ว จบโครงการ', done_continue:'ทำแล้ว และทำต่อ', not_done:'ยังไม่ได้ทำ' };
function currentEvidence(){
  const projects = (state.ai?.part3?.projects || []).map(p => { const r = rv(p.id); return { no:p.priority_no, name:r.name ?? p.name, budget:finalBudget(p) ?? p.budget, status: STATUS_TXT[r.status], reason:r.reason }; });
  return buildEvidence({
    community: ana.comm, plan: state.ai?.part2, ranking: cur.tisStats, projects,
    venue: (ana.venue || '').split('\n').map(s => s.trim()).filter(Boolean), taxonomy: TAXONOMY });
}
function renderAnalysis(){
  const c = ana.comm;
  if (c){
    const out = [['ok', `ตำบล${esc(c.tambon||'?')} ปีงบประมาณ ${esc(c.year||'?')}${ana.commIsSample?' (ตัวอย่างจริงจากป่าแดด)':''}`]];
    if (state.ai?.meta?.tambon && c.tambon && state.ai.meta.tambon !== c.tambon) out.push(['bad', `ตำบลไม่ตรงกับแผนเดิม (${esc(state.ai.meta.tambon)})`]);
    c.warnings.forEach(w => out.push(['warn', esc(w)]));
    const base = cur.base || {}, p1 = state.ai?.part1 || {};
    const popTotal = Number(base.total ?? p1.population?.total) || null;
    tisSwotIssues(c.tisSwot, { occupation: p1.main_occupation_note, popTotal, tisPop: c.population }).forEach(w => out.push(['warn', 'SWOT/ข้อมูลจาก TIS: ' + esc(w)]));
    if (c.projects.length) out.push(['info', `ทะเบียนโครงการใน TIS มี ${c.projects.length} โครงการ: ${c.projects.map(x => esc(x.name)).join(', ')}`]);
    facts($('#commFacts'), out);
    $('#capSum').innerHTML = CAP_TYPES.map(([k,l]) => `<div><b>${(c.capitals[k]||[]).length}</b><span>${l} (รหัส ${k})</span></div>`).join('');
    $('#a1').classList.add('done');
  }
  const ev = currentEvidence();
  const cnt = g => ev.filter(e => e.group.startsWith(g)).length;
  const ef = [];
  ef.push([cnt('ทุน') ? 'ok':'warn', `ทุนชุมชน ${cnt('ทุน')} รายการ${cnt('ทุน')?'':' (ยังไม่ได้นำเข้ารายงานในข้อ ก)'}`]);
  ef.push([cnt('SWOT แผนเดิม') ? 'ok':'warn', `SWOT แผนเดิม ${cnt('SWOT แผนเดิม')} ข้อ${cnt('SWOT แผนเดิม')?'':' (ยังไม่มีข้อมูลจากขั้น ⓪)'}`]);
  ef.push([cnt('การจัดลำดับ') ? 'ok':'warn', `การจัดลำดับของหมู่บ้าน ${cnt('การจัดลำดับ') ? 'มีแล้ว' : 'ยังไม่มี (นำเข้าในขั้น ①)'}`]);
  ef.push(['info', `ผลทบทวนโครงการ ${cnt('ผลทบทวน')} โครงการ, ข้อมูลจากเวที ${cnt('ข้อมูลจากเวที')} ประเด็น, แผนจังหวัด ${cnt('แผนพัฒนาจังหวัด')} กิจกรรมหลัก`]);
  ef.push(['warn', `SWOT จาก TIS ${cnt('SWOT จาก TIS')} ข้อ ใช้เป็นข้อมูลประกอบเท่านั้น`]);
  facts($('#evFacts'), ef);
  $('#evTable').innerHTML = ev.map(e => `<tr><td>${esc(e.code)}</td><td>${esc(e.text)}<div class="meta">${esc(e.group)}</div></td></tr>`).join('');
  const meta = Object.assign({}, state.ai?.meta || {}, c ? { tambon: c.tambon || state.ai?.meta?.tambon, amphoe: c.amphoe || state.ai?.meta?.amphoe } : {});
  $('#p1Box').value = buildPrompt1(ev, meta);
  renderResult1(ev);
}
$('#copyP1').addEventListener('click', async () => {
  renderAnalysis();
  const txt = $('#p1Box').value;
  try{ await navigator.clipboard.writeText(txt); openGemini('วางคำสั่ง (Ctrl+V) ไม่ต้องแนบไฟล์'); }
  catch(e){ const d = document.querySelector('#a3 details.prompt'); d.open = true; $('#p1Box').focus(); $('#p1Box').select(); toast('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้ให้แล้ว กดคัดลอกเอง'); }
});
$('#check1').addEventListener('click', () => {
  const text = $('#ans1Box').value;
  let ans;
  try{ if (looksLikePrompt(text)) throw new Error('prompt'); ans = parseAI(text); }
  catch(e){
    // อ่านไม่ได้: คงร่างเดิมไว้ ไม่ลบ แจ้งวิธีแก้
    setRaw('ans1Raw', false);
    facts($('#ans1Facts'), [['bad', esc(aiErrorMsg(text))]].concat(ana.answer ? [['info','ร่างเดิมที่ตรวจแล้วยังอยู่ในข้อ ง ไม่ถูกลบ']] : []));
    return;
  }
  const kept = ana.draft ? SWOT_KEYS.reduce((n, k) => n + (ana.draft[k] || []).filter(keepOnNewAnswer).length, 0) : 0;
  ana.answerText = text; ana.answer = ans;
  ana.draft = draftFromAnswer(ans, ana.draft);
  setRaw('ans1Raw', true); anaPersist(); renderAnalysis();
  if (kept) toast(`รับคำตอบใหม่แล้ว ข้อที่เจ้าหน้าที่แก้ เพิ่มเอง หรือยืนยันแล้ว ${kept} ข้อ คงไว้ตามเดิม`);
});

// ===== ร่าง SWOT ที่เจ้าหน้าที่แก้ได้ =====
// สถานะรายข้อ: ai = ข้อเสนอจาก AI, review = รอเจ้าหน้าที่ตรวจ, ok = ยืนยันแล้ว (เจ้าหน้าที่หรือเวทีประชาคม)
// คำตอบ AI ใหม่จะแทนเฉพาะข้อที่ยังเป็นข้อเสนอจาก AI ที่ไม่มีใครแตะ ข้อที่เจ้าหน้าที่แก้ เพิ่มเอง หรือยืนยันแล้ว ไม่ถูกเปลี่ยน
const SWOT_KEYS = ['S','W','O','T'];
const SWOT_ST = { ai:'ข้อเสนอจาก AI', review:'รอเจ้าหน้าที่ตรวจ', ok:'ยืนยันแล้ว' };
const SWOT_NAME = { S:'จุดแข็ง (Strengths)', W:'จุดอ่อน (Weaknesses)', O:'โอกาส (Opportunities)', T:'อุปสรรค (Threats)' };
const keepOnNewAnswer = it => it.status !== 'ai' || it.src === 'staff';
function draftFromAnswer(ans, prev){
  const out = {};
  SWOT_KEYS.forEach(k => {
    const ai = (ans?.swot?.[k] || []).map((it, i) => ({ id: String(it.id || `${k}${i+1}`), text: String(it.text || ''), evidence: Array.isArray(it.evidence) ? it.evidence.map(String) : [], status:'ai', src:'ai' }));
    const kept = (prev?.[k] || []).filter(keepOnNewAnswer).map(it => ({ ...it, evidence: [...(it.evidence || [])] }));
    const keptText = new Set(kept.map(it => normQ(it.text)));
    const fresh = ai.filter(it => !keptText.has(normQ(it.text)));           // AI ตอบข้อเดิมซ้ำมา ไม่ต้องเพิ่มซ้ำ
    const used = new Set(fresh.map(it => it.id));
    kept.forEach(it => { if (used.has(it.id)) it.id = nextSwotId(k, [...used, ...kept.map(x => x.id)]); used.add(it.id); });
    out[k] = kept.concat(fresh);
  });
  return out;
}
function nextSwotId(k, ids){ let n = 1; const s = new Set(ids); while (s.has(`${k}${n}`)) n++; return `${k}${n}`; }
function ensureDraft(){ if (ana.answer && !ana.draft) ana.draft = draftFromAnswer(ana.answer, null); return ana.draft; }
// ส่วนที่ 2 ฉบับที่ใช้จริง (SWOT จากร่างที่แก้แล้ว + TOWS/ทิศทาง/ยุทธศาสตร์จาก AI) ใช้ในการตรวจ ขั้น ③ และรูปเล่ม
function effPart2(){
  if (!ana.answer) return null;
  const d = ensureDraft();
  return { ...ana.answer, swot: Object.fromEntries(SWOT_KEYS.map(k => [k, (d[k] || []).map(({ id, text, evidence }) => ({ id, text, evidence }))])) };
}
function swotCounts(){
  const d = ana.draft || {}, all = SWOT_KEYS.flatMap(k => d[k] || []);
  return { all: all.length, ok: all.filter(x => x.status === 'ok').length, review: all.filter(x => x.status === 'review').length, ai: all.filter(x => x.status === 'ai').length };
}
function swotFind(k, id){ return (ana.draft?.[k] || []).find(x => x.id === id); }
$('#result1').addEventListener('change', e => {
  const el = e.target, li = el.closest('[data-swid]'); if (!li) return;
  const it = swotFind(li.dataset.k, li.dataset.swid); if (!it) return;
  const f = el.dataset.sw;
  if (f === 'text'){
    const v = el.value.trim();
    if (!v){ toast('ข้อความว่างไม่ได้ ถ้าไม่ต้องการข้อนี้ให้กด “ลบ”'); el.value = it.text; return; }
    if (v !== it.text){ it.text = v; if (it.status === 'ai') it.status = 'review'; }
  }
  if (f === 'ev'){ it.evidence = el.value.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean); if (it.status === 'ai') it.status = 'review'; }
  if (f === 'status') it.status = el.value;
  anaPersist(); renderAnalysis();
  const n = document.querySelector(`#result1 [data-swid="${CSS.escape(it.id)}"][data-k="${li.dataset.k}"] [data-sw="${f}"]`); if (n && f === 'status') n.focus();
});
$('#result1').addEventListener('click', e => {
  const b = e.target.closest('button[data-swact]'); if (!b) return;
  const act = b.dataset.swact, d = ensureDraft();
  if (act === 'add'){
    const k = b.dataset.k, id = nextSwotId(k, (d[k] || []).map(x => x.id));
    (d[k] = d[k] || []).push({ id, text:'ข้อความใหม่ (พิมพ์แทนข้อความนี้)', evidence:[], status:'review', src:'staff' });
    anaPersist(); renderAnalysis();
    const t = document.querySelector(`#result1 [data-swid="${id}"][data-k="${k}"] textarea`); if (t){ t.focus(); t.select(); }
    return;
  }
  if (act === 'confirmAll'){
    const v = swotV?.items || {};
    let n = 0;
    SWOT_KEYS.forEach(k => (d[k] || []).forEach(it => { if (it.status !== 'ok' && !(v[it.id]?.flags || []).some(f => f[0] === 'bad')){ it.status = 'ok'; n++; } }));
    anaPersist(); renderAnalysis(); toast(n ? `ยืนยันแล้ว ${n} ข้อ (ข้อที่มีจุดผิดยังไม่ถูกยืนยัน)` : 'ไม่มีข้อที่ยืนยันเพิ่มได้'); return;
  }
  const li = b.closest('[data-swid]'), k = li.dataset.k, arr = d[k] || [], i = arr.findIndex(x => x.id === li.dataset.swid);
  if (i < 0) return;
  if (act === 'del'){
    if (!confirm(`ลบข้อ ${arr[i].id} “${arr[i].text.slice(0, 60)}” ออกจากร่าง SWOT?${arr[i].status === 'ok' ? '\n\nข้อนี้ยืนยันแล้ว' : ''}`)) return;
    arr.splice(i, 1); anaPersist(); renderAnalysis(); toast('ลบข้อแล้ว'); return;
  }
  if (act === 'ok'){ arr[i].status = 'ok'; anaPersist(); renderAnalysis(); return; }
  if (act === 'up' || act === 'down'){
    const j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; anaPersist(); renderAnalysis();
    const n = document.querySelector(`#result1 [data-swid="${CSS.escape(arr[j].id)}"][data-k="${k}"] button[data-swact="${act}"]`); if (n) n.focus();
  }
});
// ข้อที่เวทียืนยันแล้ว แจ้ง AI ให้คงไว้ (แอปจะไม่ให้คำตอบใหม่เปลี่ยนข้อเหล่านี้อยู่แล้ว)
function swotLockedText(){
  const ok = SWOT_KEYS.flatMap(k => (ana.draft?.[k] || []).filter(it => it.status === 'ok').map(it => `${it.id}: ${it.text}`));
  return ok.length ? '\n\nข้อ SWOT ต่อไปนี้เวทียืนยันแล้ว ให้คงข้อความและรหัสเดิมไว้ในคำตอบ ห้ามแก้:\n' + ok.join('\n') : '';
}
let swotV = null;   // ผลตรวจล่าสุดของร่าง (ใช้หาข้อที่มีจุดผิด)
function renderResult1(ev){
  const box = $('#result1');
  if (!ana.answer){ box.innerHTML = '<div class="empty">ตรวจคำตอบในข้อ ค แล้วร่างจะขึ้นที่นี่</div>'; return; }
  const p2 = effPart2();
  const v = validateAnswer1(p2, ev); swotV = v; ana.validation = { errors:v.errors, warns:v.warns };
  const f = [];
  v.errors.forEach(x => f.push(['bad', esc(x)])); v.warns.forEach(x => f.push(['warn', esc(x)])); v.infos.forEach(x => f.push(['info', esc(x)]));
  if (!v.errors.length && !v.warns.length) f.push(['ok','ทุกข้ออ้างหลักฐานที่มีอยู่จริง และกลยุทธ์เชื่อมโยงครบ']);
  facts($('#ans1Facts'), f);
  const issues = v.errors.concat(v.warns);
  $('#fixP1').hidden = !issues.length;
  ana.fixText = issues.length ? 'คำตอบ JSON ก่อนหน้ามีปัญหาต่อไปนี้ ให้แก้เฉพาะจุดเหล่านี้ตามกติกาเดิม ข้ออื่นที่ไม่มีปัญหาให้คงไว้เหมือนเดิม และใช้เฉพาะรหัสหลักฐานจากรายการเดิม\n' + issues.map((x,i) => (i+1) + '. ' + x).join('\n') + '\n\nข้อควรจำ: SO ต้องจับคู่ S กับ O, WO ต้องจับคู่ W กับ O, ST ต้องจับคู่ S กับ T, WT ต้องจับคู่ W กับ T แต่ละด้านของ SWOT ต้องมี 4 ถึง 8 ข้อ โอกาสและอุปสรรคต้องเป็นปัจจัยภายนอก ถ้าหาหลักฐานไม่ได้ให้ใส่ evidence เป็น []\nตอบเป็น JSON ทั้งก้อนตามโครงสร้างเดิมเท่านั้น ไม่มีคำอธิบาย' + swotLockedText() : '';
  $('#a3').classList.add('done');
  const evMap = new Map(ev.map(e => [e.code, e]));
  const chip = c => { const e = evMap.get(c); const cls = !e ? 'missing' : /^X/.test(c) ? 'x' : e.external ? 'ext' : ''; return `<span class="ev ${cls}" title="${esc(e ? e.group + ': ' + e.text : 'ไม่มีรหัสนี้ในหลักฐาน')}">${esc(c)}</span>`; };
  // SWOT 4 ส่วน แก้ไขได้ทีละข้อ พร้อมสถานะ
  const d = ana.draft, cnt = swotCounts();
  const stOpts = s => Object.entries(SWOT_ST).map(([k, l]) => `<option value="${k}"${s === k ? ' selected' : ''}>${l}</option>`).join('');
  const quad = SWOT_KEYS.map(k => { const arr = d[k] || []; return `<section class="swq" aria-label="${SWOT_NAME[k]}"><div class="swq-h"><h3>${SWOT_NAME[k]} <span class="meta">${k === 'S' || k === 'W' ? 'ข้อ 2.1' : 'ข้อ 2.2'} · ${arr.length} ข้อ</span></h3><button class="btn ghost small" type="button" data-swact="add" data-k="${k}">＋ เพิ่มข้อ</button></div>
    <ul class="sw">${arr.map((it, i) => { const fl = v.items[it.id]?.flags || []; const worst = fl.some(x => x[0]==='bad') ? 'bad' : fl.length ? 'warn' : '';
      return `<li class="sw-item ${worst}" data-k="${k}" data-swid="${esc(it.id)}" data-st="${it.status}">
        <div class="sw-top"><span class="id">${esc(it.id)}</span><span class="badge" data-s="${it.status === 'ok' ? 'done' : it.status === 'review' ? 'doing' : 'ai'}">${SWOT_ST[it.status]}${it.src === 'staff' ? ' · เพิ่มเอง' : ''}</span>
          <span class="sw-btns"><button class="btn ghost small" type="button" data-swact="up" aria-label="เลื่อน ${esc(it.id)} ขึ้น"${i === 0 ? ' disabled' : ''}>▲</button><button class="btn ghost small" type="button" data-swact="down" aria-label="เลื่อน ${esc(it.id)} ลง"${i === arr.length - 1 ? ' disabled' : ''}>▼</button><button class="btn ghost small" type="button" data-swact="del" aria-label="ลบข้อ ${esc(it.id)}">ลบ</button></span></div>
        <textarea data-sw="text" rows="2" aria-label="ข้อความ ${esc(it.id)}">${esc(it.text)}</textarea>
        <div class="sw-ev">${it.evidence.map(chip).join('') || '<span class="ev missing">ไม่มีหลักฐาน</span>'}
          <label>รหัสหลักฐาน <input data-sw="ev" value="${esc(it.evidence.join(', '))}" placeholder="เช่น CN1, V2"></label></div>
        ${fl.map(x => `<div class="flagline ${x[0]}">${esc(x[1])}</div>`).join('')}
        <div class="sw-foot"><label>สถานะ <select data-sw="status">${stOpts(it.status)}</select></label>${it.status !== 'ok' ? `<button class="btn small" type="button" data-swact="ok">✓ ยืนยันข้อนี้</button>` : ''}</div>
      </li>`; }).join('') || '<li class="meta">ยังไม่มีข้อ กด “เพิ่มข้อ”</li>'}</ul></section>`; }).join('');
  const swHead = `<div class="swbar"><div><b>สถานะร่าง SWOT</b> ยืนยันแล้ว <b>${cnt.ok}</b> · รอเจ้าหน้าที่ตรวจ <b>${cnt.review}</b> · ข้อเสนอจาก AI <b>${cnt.ai}</b> (ทั้งหมด ${cnt.all} ข้อ)</div><button class="btn ghost small" type="button" data-swact="confirmAll">✓ ยืนยันทุกข้อที่ไม่มีจุดผิด</button></div>
    <p class="note" style="margin:0 0 10px">แก้ข้อความได้ในช่อง ข้อที่แก้จะเปลี่ยนเป็น “รอเจ้าหน้าที่ตรวจ” เมื่อเวทีเห็นชอบแล้วกด “ยืนยันข้อนี้” ข้อที่แก้ เพิ่มเอง หรือยืนยันแล้ว จะไม่ถูกคำตอบ AI รอบใหม่เปลี่ยน</p>`;
  const tows = ana.answer.tows || [];
  const towsHtml = ['SO','WO','ST','WT'].map(q => `<div><h3>กลยุทธ์ ${q}</h3><ul class="sw">${tows.filter(t => String(t.type).toUpperCase()===q).map(t => `<li><span class="id">${esc(t.id)}</span>${esc(t.text||'')}<div>${(t.pair||[]).map(p => `<span class="ev" title="${esc(v.items[p]?.text || 'ไม่มีข้อนี้')}">${esc(p)}</span>`).join('')}</div></li>`).join('') || '<li class="meta">ยังไม่มี</li>'}</ul></div>`).join('');
  const strat = (ana.answer.strategies || []).map(s => `<li><b>${esc(s.no ?? '')}. ${esc(s.name||'')}</b>${s.detail ? `<div class="meta">${esc(s.detail)}</div>` : ''}<div>${(s.from||[]).map(x => `<span class="ev" title="${esc(tows.find(t=>t.id===x)?.text || 'ไม่มีใน TOWS')}">${esc(x)}</span>`).join('')}</div></li>`).join('');
  box.innerHTML = `${swHead}<div class="quad">${quad}</div>
    <h3 class="sub" style="margin-top:20px">TOWS Matrix</h3><div class="quad">${towsHtml}</div>
    <h3 class="sub" style="margin-top:20px">2.4 ทิศทาง/เป้าหมายการพัฒนาตำบล</h3><div class="dir">${esc(ana.answer.direction || 'ยังไม่มี')}</div>
    <h3 class="sub" style="margin-top:20px">2.5 ยุทธศาสตร์หรือวิธีปฏิบัติ</h3><ul class="strat">${strat || '<li class="meta">ยังไม่มี</li>'}</ul>`;
  $('#a4').classList.add('done');
}
$('#fixP1').addEventListener('click', async () => {
  const txt = ana.fixText || '';
  try{ await navigator.clipboard.writeText(txt); toast('คัดลอกแล้ว วางในแชต Gemini เดิม แล้วนำคำตอบใหม่มาวางแทนของเก่า'); }
  catch(e){ const b = $('#fixBox'); b.hidden = false; b.value = txt; b.focus(); b.select(); toast('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้ให้แล้ว กดคัดลอกเอง'); }
});

