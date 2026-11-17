// step2-analysis.js — ② หน้าจอ SWOT และยุทธศาสตร์
const ANA0 = () => ({ comm:null, commFile:null, commIsSample:false, venue:'', answerText:'', answer:null, validation:null });
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
  ana.answerText = $('#ans1Box').value;
  try{ if (looksLikePrompt(ana.answerText)) throw new Error('prompt'); ana.answer = parseAI(ana.answerText); }
  catch(e){ ana.answer = null; setRaw('ans1Raw', false); facts($('#ans1Facts'), [['bad', esc(aiErrorMsg(ana.answerText))]]); anaPersist(); return; }
  setRaw('ans1Raw', true); anaPersist(); renderAnalysis();
});
function renderResult1(ev){
  const box = $('#result1');
  if (!ana.answer){ box.innerHTML = '<div class="empty">ตรวจคำตอบในข้อ ค แล้วร่างจะขึ้นที่นี่</div>'; return; }
  const v = validateAnswer1(ana.answer, ev); ana.validation = { errors:v.errors, warns:v.warns };
  const f = [];
  v.errors.forEach(x => f.push(['bad', esc(x)])); v.warns.forEach(x => f.push(['warn', esc(x)])); v.infos.forEach(x => f.push(['info', esc(x)]));
  if (!v.errors.length && !v.warns.length) f.push(['ok','ทุกข้ออ้างหลักฐานที่มีอยู่จริง และกลยุทธ์เชื่อมโยงครบ']);
  facts($('#ans1Facts'), f);
  const issues = v.errors.concat(v.warns);
  $('#fixP1').hidden = !issues.length;
  ana.fixText = issues.length ? 'คำตอบ JSON ก่อนหน้ามีปัญหาต่อไปนี้ ให้แก้เฉพาะจุดเหล่านี้ตามกติกาเดิม ข้ออื่นที่ไม่มีปัญหาให้คงไว้เหมือนเดิม และใช้เฉพาะรหัสหลักฐานจากรายการเดิม\n' + issues.map((x,i) => (i+1) + '. ' + x).join('\n') + '\n\nข้อควรจำ: SO ต้องจับคู่ S กับ O, WO ต้องจับคู่ W กับ O, ST ต้องจับคู่ S กับ T, WT ต้องจับคู่ W กับ T แต่ละด้านของ SWOT ต้องมี 4 ถึง 8 ข้อ โอกาสและอุปสรรคต้องเป็นปัจจัยภายนอก ถ้าหาหลักฐานไม่ได้ให้ใส่ evidence เป็น []\nตอบเป็น JSON ทั้งก้อนตามโครงสร้างเดิมเท่านั้น ไม่มีคำอธิบาย' : '';
  $('#a3').classList.add('done');
  const evMap = new Map(ev.map(e => [e.code, e]));
  const chip = c => { const e = evMap.get(c); const cls = !e ? 'missing' : /^X/.test(c) ? 'x' : e.external ? 'ext' : ''; return `<span class="ev ${cls}" title="${esc(e ? e.group + ': ' + e.text : 'ไม่มีรหัสนี้ในหลักฐาน')}">${esc(c)}</span>`; };
  const Q = [['S','จุดแข็ง (2.1)'],['W','จุดอ่อน (2.1)'],['O','โอกาส (2.2)'],['T','อุปสรรค (2.2)']];
  const quad = Q.map(([k,l]) => `<div><h3>${l}</h3><ul class="sw">${Object.entries(v.items).filter(([id,it]) => it.k===k).map(([id,it]) => {
    const worst = it.flags.some(x => x[0]==='bad') ? 'bad' : it.flags.length ? 'warn' : '';
    return `<li class="${worst}"><span class="id">${esc(id)}</span>${esc(it.text)}<div>${it.evidence.map(chip).join('') || '<span class="ev missing">ไม่มีหลักฐาน</span>'}</div>${it.flags.map(x => `<div class="flagline ${x[0]}">${esc(x[1])}</div>`).join('')}</li>`; }).join('')}</ul></div>`).join('');
  const tows = ana.answer.tows || [];
  const towsHtml = ['SO','WO','ST','WT'].map(q => `<div><h3>กลยุทธ์ ${q}</h3><ul class="sw">${tows.filter(t => String(t.type).toUpperCase()===q).map(t => `<li><span class="id">${esc(t.id)}</span>${esc(t.text||'')}<div>${(t.pair||[]).map(p => `<span class="ev" title="${esc(v.items[p]?.text || 'ไม่มีข้อนี้')}">${esc(p)}</span>`).join('')}</div></li>`).join('') || '<li class="meta">ยังไม่มี</li>'}</ul></div>`).join('');
  const strat = (ana.answer.strategies || []).map(s => `<li><b>${esc(s.no ?? '')}. ${esc(s.name||'')}</b>${s.detail ? `<div class="meta">${esc(s.detail)}</div>` : ''}<div>${(s.from||[]).map(x => `<span class="ev" title="${esc(tows.find(t=>t.id===x)?.text || 'ไม่มีใน TOWS')}">${esc(x)}</span>`).join('')}</div></li>`).join('');
  box.innerHTML = `<div class="quad">${quad}</div>
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

