// workspace.js — ชุดข้อมูลรายตำบล: บันทึก/สลับ/เริ่มใหม่/เปิดไฟล์ .json/ย้ายข้อมูลรูปแบบเดิม
/* ================= ชุดข้อมูลรายตำบล (workspace) =================
 * งานทุกขั้น (⓪–④) ของตำบลหนึ่งเก็บรวมใน key เดียว: tambon-ws:{อำเภอ}|{ตำบล}|{ปีแผนเดิม}
 *   tambon-ws:index  = รายการตำบลที่มีในเครื่อง   tambon-ws:active = ตำบลที่เปิดอยู่
 *   tambon-ws:draft  = งานที่ยังไม่รู้ตำบล (ยังไม่ได้ทำขั้น ⓪) เมื่อทำขั้น ⓪ แล้วจะย้ายเข้าชุดของตำบลนั้น
 * ข้อมูลรูปแบบเดิม (tambon-review:*, tambon-current:*, *:last) ย้ายมาครั้งเดียวตอนเปิดแอป โดยไม่ลบ key เดิม */
const WS = 'tambon-ws:', WS_INDEX = WS + 'index', WS_ACTIVE = WS + 'active', WS_MIGRATED = WS + 'migrated', WS_DRAFT = 'draft';
let wsId = WS_DRAFT, wsQuiet = false, wsWarnedFull = false, wsNotice = null;
const UI0 = { drop: $('#dropTitle').textContent, drop2: $('#drop2Title').textContent, drop3: $('#drop3Title').textContent, heat: $('#heatWrap').innerHTML };
function lsGet(k){ try{ const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
function wsIdOf(meta){ return meta?.tambon ? [meta.amphoe || '?', meta.tambon, meta.plan_year || '?'].join('|') : WS_DRAFT; }
function wsIndex(){ const x = lsGet(WS_INDEX); return Array.isArray(x) ? x : []; }
function fmtTime(iso){ try{ return iso ? new Date(iso).toLocaleString('th-TH', { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''; }catch(e){ return ''; } }
function wsFacts(items){ facts($('#wsFacts'), items); }

// ภาพรวมสถานะทั้งหมดของตำบลที่เปิดอยู่ (ใช้ทั้งเก็บในเครื่องและใส่ในไฟล์ .json)
function wsSnapshot(){
  const p = state.pdf;
  return { v:1, updated_at: new Date().toISOString(),
    review: { review: state.review, ai: state.ai, usingSample: state.usingSample },
    // ผลอ่าน PDF เก็บเฉพาะตัวเลขงบรายแถว ไม่เก็บข้อความจากไฟล์
    pdf: p ? { name: state.pdfName, hasText: p.hasText, s31: p.s31, s32: p.s32, pages: p.pages, problemRows: p.problemRows,
      rows: Object.fromEntries(Object.entries(p.rows || {}).map(([k, r]) => [k, { page: r.page, budget: r.budget, nobudget: r.nobudget }])) } : null,
    cur, ana, prj, bk, notice: wsNotice };
}
function wsSnapHasData(s){
  if (!s) return false;
  const filled = o => Object.values(o || {}).some(v => v !== null && v !== undefined && v !== '');
  return !!(s.review?.ai || s.pdf || s.cur?.tis || filled(s.cur?.base) || s.ana?.comm || s.ana?.venue || s.ana?.answerText || s.prj?.extra?.length || s.prj?.ans2Text || filled(s.bk));
}
// ---- ตัวบอกสถานะการบันทึก (บอก “บันทึกแล้ว” ก็ต่อเมื่อเขียนลงเครื่องสำเร็จจริงเท่านั้น) ----
let saveState = 'empty';
function setSaveState(s, at){
  saveState = s;
  const el = $('#saveState'); if (!el) return;
  el.dataset.s = s;
  el.textContent = s === 'saved' ? `บันทึกในเครื่องนี้แล้ว ${fmtTime(at)} (บันทึกอัตโนมัติทุกครั้งที่แก้)`
    : s === 'dirty' ? 'มีการแก้ไขที่ยังไม่บันทึก (ช่องคำตอบ AI จะบันทึกเมื่อกด “ตรวจคำตอบ”)'
    : s === 'error' ? 'บันทึกไม่สำเร็จ: เบราว์เซอร์นี้เก็บข้อมูลไม่ได้หรือพื้นที่เต็ม กด “สำรองเป็นไฟล์” ก่อนปิดหน้า'
    : 'ยังไม่มีงานให้บันทึก';
}
function wsSave(){
  if (wsQuiet) return;
  const snap = wsSnapshot();
  if (wsId === WS_DRAFT && !wsSnapHasData(snap) && !lsGet(WS + WS_DRAFT)){ setSaveState('empty'); refreshProgress(); return; }   // ยังไม่มีอะไรให้เก็บ
  if (!lsSet(WS + wsId, snap)){
    setSaveState('error');
    if (!wsWarnedFull){ wsWarnedFull = true; toast('บันทึกงานลงเครื่องไม่สำเร็จ กด “สำรองเป็นไฟล์ (.json)” เพื่อเก็บงานไว้ก่อน'); }
    refreshProgress();
    return;
  }
  wsWarnedFull = false;
  const m = state.ai?.meta || {};
  const idx = wsIndex().filter(x => x.id !== wsId);
  idx.push({ id: wsId, tambon: m.tambon || cur.tis?.tambon || ana.comm?.tambon || null, amphoe: m.amphoe || cur.tis?.amphoe || null, plan_year: m.plan_year || null, updated_at: snap.updated_at });
  const okIdx = lsSet(WS_INDEX, idx) && lsSet(WS_ACTIVE, wsId);
  setSaveState(okIdx ? 'saved' : 'error', snap.updated_at);
  wsRenderBar();
  refreshProgress();
}
function wsReset(){
  Object.assign(state, { pdfName:null, pdf:null, ai:null, usingSample:false, review:{}, filter:'all' });
  for (const [o, f] of [[cur, CUR0], [ana, ANA0], [prj, PRJ0], [bk, BK0]]){ Object.keys(o).forEach(k => delete o[k]); Object.assign(o, f()); }
  wsNotice = null;
}
function wsApply(s){
  wsReset();
  const r = s?.review || {};
  if (r.ai?.part3?.projects){ state.ai = r.ai; state.review = migrate(r.review || {}); state.usingSample = !!r.usingSample; }
  if (s?.pdf){ state.pdf = s.pdf; state.pdfName = s.pdf.name || null; }
  Object.assign(cur, s?.cur || {}); if (!cur.base || typeof cur.base !== 'object') cur.base = {};
  Object.assign(ana, s?.ana || {});
  Object.assign(prj, s?.prj || {}); if (!Array.isArray(prj.extra)) prj.extra = []; if (!prj.old || typeof prj.old !== 'object') prj.old = {};
  Object.assign(bk, s?.bk || {});
  wsNotice = s?.notice || null;
}
// วาดหน้าจอทุกขั้นใหม่ตามข้อมูลที่โหลด (ไม่บันทึกระหว่างวาด)
function wsRefreshUI(){
  wsQuiet = true;
  try{
    // ⓪
    $('#dropTitle').textContent = state.pdfName || UI0.drop;
    $('#s1').classList.toggle('done', !!state.pdf);
    facts($('#pdfFacts'), state.pdf ? [['info', `ใช้ผลการอ่านไฟล์ ${esc(state.pdfName || 'PDF')} ที่บันทึกไว้${state.pdf.pages ? ` (${state.pdf.pages} หน้า)` : ''} ถ้าเปลี่ยนเล่ม ให้แนบไฟล์ใหม่`]] : []);
    $('#aiBox').value = state.ai ? JSON.stringify(state.ai, null, 1) : '';
    $('#sampleNote').hidden = !state.usingSample;
    $('#s2').classList.toggle('done', !!state.ai);
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.f === 'all')));
    $('#exportBox').hidden = true; $('#exportBox').value = '';
    ['#saveNote','#bookNote'].forEach(s => { const el = $(s); if (el) el.textContent = ''; });
    if (state.ai) runChecks(); else { facts($('#aiFacts'), []); render(); }
    // ①
    $('#drop2Title').textContent = cur.tisFile || UI0.drop2;
    $('#c1').classList.toggle('done', !!cur.tis);
    if (!cur.tis){ facts($('#tisFacts'), []); facts($('#heatFacts'), []); $('#heatWrap').innerHTML = UI0.heat; }
    // ②
    $('#drop3Title').textContent = ana.commFile || UI0.drop3;
    $('#a1').classList.toggle('done', !!ana.comm);
    $('#venueBox').value = ana.venue || ''; $('#ans1Box').value = ana.answerText || '';
    if (!ana.comm){ facts($('#commFacts'), []); $('#capSum').innerHTML = ''; }
    if (!ana.answer){ facts($('#ans1Facts'), []); $('#fixP1').hidden = true; }
    $('#a3').classList.toggle('done', !!ana.answer); $('#a4').classList.toggle('done', !!ana.answer);
    // ③
    $('#ans2Box').value = prj.ans2Text || ''; facts($('#ans2Facts'), []);
    setRaw('aiRaw', !!state.ai); setRaw('ans1Raw', !!ana.answer); setRaw('ans2Raw', !!prj.ans2Text);
    Object.assign(lf, { q:'', st:'', dim:'', sort:'no' }); Object.assign(pf, { q:'', strat:'', budget:'', show:'' });
    ['#lfQ','#lfSt','#lfSort','#pfQ','#pfStrat','#pfBudget','#pfShow'].forEach(s => { const el = $(s); if (el) el.value = s === '#lfSort' ? 'no' : ''; });
    $('#p1').classList.remove('done'); $('#p2').classList.toggle('done', !!prj.ans2Text);
    wsRenderBar();
    showView();
  } finally { wsQuiet = false; }
}
function wsLoad(id){
  wsId = id;
  wsApply(lsGet(WS + id));
  wsRefreshUI();
  const okActive = lsSet(WS_ACTIVE, id);
  const e = wsIndex().find(x => x.id === id);
  setSaveState(!okActive && wsSnapHasData(wsSnapshot()) || !storageOk() ? 'error' : e?.updated_at ? 'saved' : 'empty', e?.updated_at);
  wsFacts(wsNotice ? [['warn', esc(wsNotice)]] : []);
}
function storageOk(){ try{ localStorage.setItem(WS + '_t', '1'); localStorage.removeItem(WS + '_t'); return true; }catch(e){ return false; } }
function wsName(x){
  if (!x || x.id === WS_DRAFT) return 'งานที่ยังไม่ระบุตำบล';
  return `ตำบล${x.tambon || '?'}${x.amphoe ? ' อำเภอ' + x.amphoe : ''} แผนปี ${x.plan_year || '?'}`;
}
function wsLabel(x){
  if (x.id === WS_DRAFT) return 'งานใหม่ ยังไม่ระบุตำบล (ทำขั้น ⓪ ก่อน)' + (x.tambon ? ` · TIS ตำบล${x.tambon}` : '');
  return `ตำบล${x.tambon || '?'}${x.amphoe ? ' อ.' + x.amphoe : ''} · แผนปี ${x.plan_year || '?'}`;
}
function wsRenderBar(){
  const sel = $('#wsSel'); if (!sel) return;
  const idx = wsIndex().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  if (!idx.some(x => x.id === wsId)) idx.unshift({ id: wsId, tambon: state.ai?.meta?.tambon, amphoe: state.ai?.meta?.amphoe, plan_year: state.ai?.meta?.plan_year });
  sel.innerHTML = idx.map(x => `<option value="${esc(x.id)}"${x.id === wsId ? ' selected' : ''}>${esc(wsLabel(x))}${x.updated_at ? ' · แก้ไข ' + esc(fmtTime(x.updated_at)) : ''}</option>`).join('');
}
function wsSwitch(id){
  if (id === wsId) return;
  wsSave(); wsLoad(id);
  toast('เปิดงานของ' + wsName(wsIndex().find(x => x.id === id) || { id }) + ' แล้ว');
}
function wsNew(){
  wsSave();
  if (wsId === WS_DRAFT && wsSnapHasData(wsSnapshot())){
    location.hash = '#review';
    toast('งานที่เปิดอยู่ยังไม่ระบุตำบล ทำขั้น ⓪ ให้เสร็จก่อน แล้วค่อยเริ่มตำบลใหม่'); return;
  }
  if (wsSnapHasData(lsGet(WS + WS_DRAFT))){
    wsLoad(WS_DRAFT); location.hash = '#review';
    toast('มีงานที่ยังไม่ระบุตำบลค้างอยู่ เปิดให้ทำต่อแล้ว ทำขั้น ⓪ ให้เสร็จก่อนเริ่มตำบลอื่น'); return;
  }
  wsLoad(WS_DRAFT); location.hash = '#review';
  toast('เริ่มตำบลใหม่แล้ว งานเดิมบันทึกไว้ในเครื่อง เลือกกลับมาทำต่อได้จากรายการ “ตำบลที่ทำอยู่”');
}
// เรียกจากขั้น ⓪ เมื่อวางคำตอบ AI: ผูกงานกับตำบลในคำตอบ คืนค่า true ถ้าทำต่อได้
function wsAdoptAi(ai){
  const id = wsIdOf(ai.meta);
  if (id === wsId){ state.ai = ai; return true; }          // ตำบลเดิม: แทนคำตอบ AI แต่คงผลทบทวนไว้
  // PDF ที่เพิ่งแนบในขั้นที่ 1 เป็นของเล่มที่กำลังวางคำตอบ จึงย้ายตามไปด้วย
  const keep = { pdf: state.pdf, pdfName: state.pdfName, usingSample: state.usingSample };
  const name = wsName({ id, tambon: ai.meta?.tambon, amphoe: ai.meta?.amphoe, plan_year: ai.meta?.plan_year });
  const exists = wsSnapHasData(lsGet(WS + id));
  if (!exists && wsId === WS_DRAFT){
    // งานที่ยังไม่ระบุตำบล → กลายเป็นงานของตำบลนี้ (ย้ายข้อมูล ไม่ได้ลบ)
    try{ localStorage.removeItem(WS + WS_DRAFT); }catch(e){}
    lsSet(WS_INDEX, wsIndex().filter(x => x.id !== WS_DRAFT));
    wsId = id; state.ai = ai; state.review = {};
    return true;
  }
  wsSave();
  const prevName = wsName(wsIndex().find(x => x.id === wsId) || { id: wsId });
  wsId = id; wsApply(exists ? lsGet(WS + id) : null);
  if (keep.pdf){ state.pdf = keep.pdf; state.pdfName = keep.pdfName; }
  state.ai = ai; state.usingSample = keep.usingSample;
  wsRefreshUI();
  $('#aiBox').value = JSON.stringify(ai, null, 1);
  wsFacts(wsNotice ? [['warn', esc(wsNotice)]] : []);
  toast(exists ? `เปิดงานเดิมของ${name} ที่บันทึกไว้ในเครื่องแล้ว` : `เริ่มงานของ${name} งานของ${prevName} บันทึกไว้ในเครื่องแล้ว`);
  return true;
}

// ---- เปิดไฟล์ .json ที่บันทึกไว้ ----
// ไฟล์รุ่นก่อน (ไม่มี workspace) สร้างสถานะกลับจากคีย์เดิมเท่าที่ทำได้ และบอกส่วนที่กู้คืนไม่ได้
function wsFromLegacy(o){
  const lost = [], review = {};
  const projects = (o.projects || []).map(p => {
    const { review: r, budget_ai, budget_pdf, budget_final, budget_check, budget_confirmed, ...rest } = p;
    const x = { ...rest, budget: budget_ai !== undefined ? budget_ai : (rest.budget ?? null) };
    const rr = {};
    if (r?.status) rr.status = r.status; if (r?.reason) rr.reason = r.reason; if (r?.decision) rr.decision = r.decision;
    if (budget_confirmed){ rr.budgetConfirmed = true; rr.budgetFinal = budget_final ?? x.budget; }
    review[x.id] = rr;
    return x;
  });
  const ai = projects.length ? { meta: o.meta || {}, part1: o.part1 || {}, part2: o.part2 || {}, part3: { projects }, part4: o.part4 || {}, flags: o.flags || [] } : null;
  const c = o.current || {}, a = o.analysis || {}, n = o.new_plan_projects || {};
  const old = {}, extra = [];
  let seq = 1;
  const bump = uid => { const k = parseInt(String(uid || '').split(':')[1], 10); if (k >= seq) seq = k + 1; };
  (n.items || []).forEach(it => {
    if (it.source === 'old'){
      // เก็บเฉพาะช่องที่แก้ต่างจากค่าตั้งต้นของโครงการเดิม
      const p = projects.find(x => x.id === it.oldId) || {}, rr = review[it.oldId] || {};
      const def = { name: p.name, budget: rr.budgetConfirmed ? rr.budgetFinal : null, target: p.target || '', period:'', dim: p.form_dimension || '', method: p.method || '', strategy:'', cr:'', agency:'', royal:'', votes:'' };
      const ov = {};
      Object.keys(it).forEach(k => { if (!['uid','source','oldId','note'].includes(k) && JSON.stringify(it[k]) !== JSON.stringify(def[k])) ov[k] = it[k]; });
      if (Object.keys(ov).length) old[it.oldId] = ov;
    } else { extra.push({ ...it, accepted: true }); bump(it.uid); }
  });
  const notSel = n.ai_candidates_not_selected || [];
  notSel.forEach(name => extra.push({ uid: 'ai:' + (seq++), source:'ai', accepted:false, name, budget:null, target:'', period:'', dim:'', method:'', strategy:'', cr:'', agency:'', royal:'', votes:'' }));
  if (notSel.length) lost.push('รายละเอียดของโครงการที่ AI เสนอแต่เวทียังไม่เลือก (เหลือแค่ชื่อ)');
  if ((n.items || []).some(x => x.source === 'ai') || notSel.length) lost.push('ข้อความคำตอบ AI ในขั้น ③');
  if (o.source?.pdf_file) lost.push('ผลการอ่าน PDF (ถ้าจะเทียบงบอีกครั้ง ให้แนบ PDF ในขั้น ⓪ ใหม่ งบที่ยืนยันไว้แล้วยังอยู่)');
  lost.push('ข้อมูลการประชุมทบทวนและปีแผนในขั้น ④');
  return { lost, snap: { v:1,
    review: { review, ai, usingSample: !!o.source?.ai_answer_is_test_sample },
    pdf: null,
    cur: { tis: c.tis ?? null, tisStats: c.tis_village_stats ?? null, base: c.baseline || {}, tisFile: c.tis_file ?? null, tisIsSample: !!c.tis_is_test_sample },
    ana: { comm: a.tis_community ?? null, commFile: a.tis_community_file ?? null, commIsSample: !!a.tis_community_is_test_sample, venue: (a.venue_notes || []).join('\n'),
      answer: a.part2_draft ?? null, answerText: a.part2_draft ? JSON.stringify(a.part2_draft, null, 1) : '', validation: a.validation ?? null },
    prj: { old, extra, ans2Text:'', ans2:null, seq, order: n.priority_3_1 || [] },
    bk: BK0() } };
}
function wsImport(obj, fname){
  if (obj?.type !== 'tambon-plan-review'){ wsFacts([['bad','ไฟล์นี้ไม่ใช่ไฟล์ที่บันทึกจากระบบนี้ ให้เลือกไฟล์ .json ที่ได้จากปุ่มบันทึก (.json)']]); return false; }
  let snap, lost = [];
  if (obj.workspace?.review) snap = JSON.parse(JSON.stringify(obj.workspace));
  else ({ snap, lost } = wsFromLegacy(obj));
  const m = snap.review?.ai?.meta;
  const id = wsIdOf(m);
  const name = wsName({ id, tambon: m?.tambon, amphoe: m?.amphoe, plan_year: m?.plan_year });
  const old = lsGet(WS + id);
  if ((id === wsId ? wsSnapHasData(wsSnapshot()) : wsSnapHasData(old)) &&
      !confirm(`ในเครื่องนี้มีงานของ${name} อยู่แล้ว${old?.updated_at ? ' (แก้ไขล่าสุด ' + fmtTime(old.updated_at) + ')' : ''}\nแทนที่ด้วยข้อมูลจากไฟล์ ${fname || ''} หรือไม่?\nกด “ยกเลิก” เพื่อเก็บงานในเครื่องไว้เหมือนเดิม`)){
    wsFacts([['info','ยกเลิกการเปิดไฟล์ งานในเครื่องยังเหมือนเดิม']]); return false;
  }
  if (id !== wsId) wsSave();
  if (!lsSet(WS + id, snap)){ wsFacts([['bad','พื้นที่เก็บข้อมูลในเครื่องเต็ม เปิดไฟล์ไม่สำเร็จ']]); return false; }
  wsLoad(id); wsSave();
  const f = [['ok', `เปิดงานของ${esc(name)} จากไฟล์แล้ว`]];
  if (lost.length) f.push(['warn', 'ไฟล์นี้บันทึกจากระบบรุ่นก่อน ส่วนที่กู้คืนไม่ได้: ' + lost.map(esc).join(', ')]);
  if (wsNotice) f.push(['warn', esc(wsNotice)]);
  wsFacts(f);
  return true;
}
async function wsOpenFile(file){
  let obj;
  try{ const txt = file.text ? await file.text() : new TextDecoder().decode(await file.arrayBuffer()); obj = JSON.parse(txt); }
  catch(e){ wsFacts([['bad','เปิดไฟล์นี้ไม่ได้ ต้องเป็นไฟล์ .json ที่ได้จากปุ่มบันทึก (.json) ของระบบนี้']]); return false; }
  return wsImport(obj, file.name);
}

// ---- ย้ายข้อมูลรูปแบบเดิม (ทำครั้งเดียว ไม่ลบ key เดิม) ----
function wsMigrate(){
  let keys = [];
  try{ if (localStorage.getItem(WS_MIGRATED) !== null) return; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); }catch(e){ return; }
  const legacy = keys.filter(k => /^tambon-(review|current|analysis|projects|book):/.test(k));
  const now = new Date().toISOString();
  if (!legacy.length){ lsSet(WS_MIGRATED, { at: now, keys: 0 }); return; }
  const blank = () => ({ v:1, updated_at: now, review: { review:{}, ai:null, usingSample:false }, pdf:null, cur:null, ana:null, prj:null, bk:null, notice:null });
  const out = {};
  // ⓪ ทุกตำบล
  for (const k of legacy){
    if (!k.startsWith('tambon-review:') || k === 'tambon-review:last') continue;
    const d = lsGet(k); if (!d?.ai?.part3?.projects) continue;
    const id = wsIdOf(d.ai.meta);
    (out[id] = out[id] || blank()).review = { review: migrate(d.review || {}), ai: d.ai, usingSample: !!d.usingSample };
  }
  let lastKey = null; try{ lastKey = localStorage.getItem('tambon-review:last'); }catch(e){}
  const lastD = lastKey ? lsGet(lastKey) : null;
  const lastId = lastD?.ai?.meta && out[wsIdOf(lastD.ai.meta)] ? wsIdOf(lastD.ai.meta) : null;
  // ① ผูกกับตำบลชื่อเดียวกัน (ถ้ามีหลายปี ใช้ตัวที่ทำล่าสุด หรือปีแผนล่าสุด)
  for (const k of legacy){
    if (!k.startsWith('tambon-current:') || k === 'tambon-current:last') continue;
    const c = lsGet(k); if (!c) continue;
    const tb = k.slice('tambon-current:'.length);
    const cands = Object.keys(out).filter(id => out[id].review.ai?.meta?.tambon === tb);
    let id = cands.includes(lastId) ? lastId : cands.sort((a, b) => (out[b].review.ai.meta.plan_year || 0) - (out[a].review.ai.meta.plan_year || 0))[0];
    if (!id){ if (out[WS_DRAFT]?.cur) continue; id = WS_DRAFT; out[id] = out[id] || blank(); }
    out[id].cur = c;
  }
  // ②③④ เดิมมีชุดเดียว ผูกกับตำบลที่ทำล่าสุด
  const target = lastId || Object.keys(out).find(id => id !== WS_DRAFT) || WS_DRAFT;
  const t = out[target] = out[target] || blank();
  const A = lsGet('tambon-analysis:last'), P = lsGet('tambon-projects:last'), B = lsGet('tambon-book:last');
  if (A) t.ana = A; if (P) t.prj = P; if (B) t.bk = B;
  const tb = t.review.ai?.meta?.tambon;
  if (A?.comm?.tambon && tb && A.comm.tambon !== tb) t.notice = `ข้อมูลขั้น ② ที่ย้ายมาจากระบบรุ่นก่อนเป็นของตำบล${A.comm.tambon} ไม่ตรงกับตำบล${tb} ตรวจก่อนใช้`;
  const idx = [];
  let ok = true;
  for (const [id, s] of Object.entries(out)){
    if (id === WS_DRAFT && !wsSnapHasData(s)) continue;
    ok = lsSet(WS + id, s) && ok;
    const m = s.review.ai?.meta || {};
    idx.push({ id, tambon: m.tambon || s.cur?.tis?.tambon || null, amphoe: m.amphoe || s.cur?.tis?.amphoe || null, plan_year: m.plan_year || null, updated_at: now });
  }
  if (!ok) return;   // เครื่องเต็ม: คงข้อมูลเดิมไว้ ลองใหม่ครั้งหน้า
  lsSet(WS_INDEX, idx);
  lsSet(WS_ACTIVE, idx.some(x => x.id === target) ? target : (idx[0]?.id || WS_DRAFT));
  lsSet(WS_MIGRATED, { at: now, keys: legacy.length });
}

