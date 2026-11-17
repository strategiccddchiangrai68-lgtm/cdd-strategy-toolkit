// progress.js — สถานะรายขั้นที่คำนวณจากข้อมูลจริง, แถบขั้นตอน, หัวขั้น, ปุ่มย้อนกลับ/ถัดไป และหน้าภาพรวม (#home)
// ไม่เก็บข้อมูลใหม่ อ่านจาก state/cur/ana/prj/bk อย่างเดียว

const STEPS = [
  { key:'review',   no:'⓪', short:'ทบทวนแผนเดิม', name:'ทบทวนแผนเดิม',             tab:'#tabReview',   desc:'นำโครงการจากเล่มแผนเดิมเข้ามา ตรวจงบกับเล่มจริง และระบุว่าแต่ละโครงการทำแล้วหรือยัง' },
  { key:'current',  no:'①', short:'ข้อมูลตำบล', name:'ข้อมูลตำบลปัจจุบัน',        tab:'#tabCurrent',  desc:'นำเข้าการจัดลำดับปัญหาของหมู่บ้านจาก TIS และปรับข้อมูลพื้นฐานของตำบลให้เป็นปีล่าสุด' },
  { key:'analysis', no:'②', short:'SWOT และยุทธศาสตร์', name:'วิเคราะห์ SWOT และยุทธศาสตร์', tab:'#tabAnalysis', desc:'รวมหลักฐานและเสียงจากเวทีประชาคม ให้ Gemini ร่าง SWOT และยุทธศาสตร์ แล้วตรวจก่อนนำเข้าเวที' },
  { key:'projects', no:'③', short:'โครงการ', name:'จัดทำโครงการ',              tab:'#tabProjects', desc:'รวมโครงการที่ยกมาจากแผนเดิมกับโครงการใหม่ กรอกรายละเอียด และจัดลำดับตามมติเวที' },
  { key:'book',     no:'④', short:'ตรวจและส่งออก', name:'ตรวจสอบและส่งออกรูปเล่ม',    tab:'#tabBook',     desc:'กรอกข้อมูลประจำเล่ม ตรวจความพร้อมของแต่ละส่วน แล้วดาวน์โหลดไฟล์ Word' },
];
const ST_TXT = { todo:'ยังไม่เริ่ม', doing:'กำลังดำเนินการ', done:'เสร็จสมบูรณ์', fix:'ต้องแก้ไข' };
const ST_ICON = { todo:'○', doing:'◐', done:'✓', fix:'!' };

// แต่ละขั้นคืน { s: todo|doing|done|fix, issues:[{lv:'bad'|'warn', text, el}] } el = id ของข้อย่อยที่ต้องไปแก้
function stepStatus(key){
  const I = [], bad = (text, el) => I.push({ lv:'bad', text, el }), warn = (text, el) => I.push({ lv:'warn', text, el });
  const fin = started => ({ s: !started ? 'todo' : I.some(x => x.lv === 'bad') ? 'fix' : I.length ? 'doing' : 'done', issues: I });
  const filled = o => Object.values(o || {}).some(v => v !== null && v !== undefined && v !== '');
  if (key === 'review'){
    if (!state.ai){ warn('ยังไม่ได้นำโครงการจากเล่มแผนเดิมเข้ามา', 's2'); return fin(false); }
    const ps = state.ai.part3.projects;
    const mis = ps.filter(p => budgetCheck(p).kind === 'mismatch' && !rv(p.id).budgetConfirmed).length;
    const pend = ps.filter(needsCheck).length - mis;
    const nost = ps.filter(p => !rv(p.id).status).length;
    const nodec = ps.filter(p => rv(p.id).status === 'not_done' && !rv(p.id).decision).length;
    if (mis) bad(`งบที่ AI อ่านไม่ตรงกับไฟล์ PDF ${mis} โครงการ`, 's3');
    if (pend > 0) warn(`ยังไม่ได้ยืนยันงบกับเล่มจริง ${pend} โครงการ`, 's3');
    if (nost) warn(`ยังไม่ระบุสถานะการดำเนินงาน ${nost} โครงการ`, 's3');
    if (nodec) warn(`โครงการที่ยังไม่ได้ทำ ${nodec} โครงการ ยังไม่เลือกว่าจะยกไปแผนใหม่หรือตัดออก`, 's3');
    return fin(true);
  }
  if (key === 'current'){
    const started = !!cur.tis || filled(cur.base);
    const t = cur.tis, m = state.ai?.meta, b = baseNow();
    if (!t) warn('ยังไม่ได้นำเข้ารายงานผลการวิเคราะห์ TIS', 'c1');
    else if (m?.tambon && t.tambon && m.tambon !== t.tambon) bad(`รายงาน TIS เป็นตำบล${t.tambon} ไม่ตรงกับแผนเดิม (ตำบล${m.tambon})`, 'c1');
    const n = v => v === '' || v === null || v === undefined ? null : Number(v);
    if (n(b.male) !== null && n(b.female) !== null && n(b.total) !== null && n(b.male) + n(b.female) !== n(b.total)) bad('ประชากรชายรวมหญิงไม่เท่ากับประชากรรวม', 'c4');
    if (!b.total) warn('ยังไม่มีจำนวนประชากร', 'c4');
    if (!b.year) warn('ยังไม่ระบุปีของข้อมูลพื้นฐาน', 'c4');
    return fin(started);
  }
  if (key === 'analysis'){
    const started = !!(ana.comm || ana.answer || ana.venue || ana.answerText);
    const c = ana.comm;
    if (!c) warn('ยังไม่ได้นำเข้ารายงานทุนชุมชนจาก TIS', 'a1');
    else if (state.ai?.meta?.tambon && c.tambon && state.ai.meta.tambon !== c.tambon) bad(`รายงานทุนชุมชนเป็นตำบล${c.tambon} ไม่ตรงกับแผนเดิม`, 'a1');
    if (!String(ana.venue || '').trim()) warn('ยังไม่ได้ใส่ข้อมูลจากเวทีประชาคม', 'a2');
    if (!ana.answer) warn('ยังไม่มีร่าง SWOT และยุทธศาสตร์ที่ตรวจแล้ว', 'a3');
    else {
      const e = ana.validation?.errors?.length || 0, w = ana.validation?.warns?.length || 0;
      if (e) bad(`ร่าง SWOT และยุทธศาสตร์มีจุดที่ผิด ${e} จุด`, 'a4');
      if (w) warn(`ร่าง SWOT และยุทธศาสตร์มีจุดที่ควรตรวจ ${w} จุด`, 'a4');
      const c = swotCounts();
      if (c.all > c.ok) warn(`SWOT ยังไม่ได้ยืนยัน ${c.all - c.ok} จาก ${c.all} ข้อ (ข้อเสนอจาก AI ${c.ai}, รอตรวจ ${c.review})`, 'a4');
    }
    return fin(started);
  }
  if (key === 'projects'){
    const items = orderedItems(planItems());
    const started = items.length > 0 || prj.extra.length > 0 || !!prj.ans2Text;
    const chk = checkPlan(items, part2Ctx());
    chk.bad.forEach(x => bad(x, 'p3'));
    chk.warn.forEach(x => warn(x, /ยุทธศาสตร์ .* ยังไม่มีโครงการ|หมู่บ้านเดียว/.test(x) ? 'p4' : 'p3'));
    return fin(started);
  }
  if (key === 'book'){
    const started = filled(bk);
    if (!bk.year) warn('ยังไม่ระบุปี พ.ศ. ของแผน', 'b1');
    if (!bk.rdate) warn('ยังไม่ระบุวันที่ประชุมทบทวนแผน', 'b1');
    if (!bk.rres) warn('ยังไม่ระบุมติที่ประชุม', 'b1');
    return fin(started);
  }
}
function allStatus(){ const o = {}; STEPS.forEach(s => o[s.key] = stepStatus(s.key)); return o; }
function progressPct(all){ const sc = { todo:0, doing:.5, fix:.5, done:1 }; return Math.round(STEPS.reduce((a, s) => a + sc[all[s.key].s], 0) / STEPS.length * 100); }
function nextStepKey(all){ const s = STEPS.find(x => all[x.key].s === 'fix') || STEPS.find(x => all[x.key].s !== 'done'); return s ? s.key : 'book'; }

const badgeHTML = s => `<span class="badge" data-s="${s}"><span aria-hidden="true">${ST_ICON[s]}</span> ${ST_TXT[s]}</span>`;
function issuesHTML(issues, key, max){
  const list = issues.slice().sort((a, b) => (a.lv === 'bad' ? 0 : 1) - (b.lv === 'bad' ? 0 : 1));
  const shown = max ? list.slice(0, max) : list;
  return `<ul class="issues">${shown.map(x => `<li class="${x.lv}"><span><span class="sr-only">${x.lv === 'bad' ? 'ต้องแก้: ' : 'ยังไม่ครบ: '}</span>${esc(x.text)}</span><a class="go" href="#${key}" data-el="${esc(x.el)}">ไปที่จุดนี้ →</a></li>`).join('')}${max && list.length > max ? `<li class="more">และอีก ${list.length - max} รายการ</li>` : ''}</ul>`;
}

// ---- อัปเดตทุกส่วนที่แสดงสถานะ (เรียกหลังบันทึกและเมื่อเปลี่ยนหน้า) ----
function currentView(){ const k = location.hash.slice(1); return VIEWS.includes(k) ? k : 'home'; }
function refreshProgress(){
  const all = allStatus(), view = currentView();
  // แถบขั้นตอน
  STEPS.forEach(s => { const a = $(s.tab); if (a) a.innerHTML = `${s.no} ${esc(s.short)} <span class="ts" data-s="${all[s.key].s}">${ST_TXT[all[s.key].s]}</span>`; });
  const th = $('#tabHome'); if (th) th.innerHTML = `ภาพรวม <span class="ts" data-s="${progressPct(all) === 100 ? 'done' : 'todo'}">${progressPct(all)}%</span>`;
  // หัวขั้นของหน้าที่เปิดอยู่
  const i = STEPS.findIndex(s => s.key === view);
  if (i >= 0){
    const s = STEPS[i], st = all[s.key];
    $('#sh-' + s.key).innerHTML = `<div class="sh-top"><span class="sh-no">ขั้น ${s.no} · ขั้นตอนที่ ${i+1} จาก ${STEPS.length}</span>${badgeHTML(st.s)}</div>
      <h2>${esc(s.name)}</h2><p>${esc(s.desc)}</p>${st.issues.length ? issuesHTML(st.issues, s.key, 4) : st.s === 'done' ? '<ul class="issues"><li class="more">ข้อมูลสำคัญของขั้นนี้ครบแล้ว กลับมาแก้ไขได้ทุกเมื่อ</li></ul>' : ''}`;
  }
  // ปุ่มย้อนกลับ/ถัดไป
  const bar = $('#stepbar');
  if (bar){
    if (i < 0){ bar.hidden = true; }
    else {
      const prev = i === 0 ? { key:'home', label:'ภาพรวม' } : { key:STEPS[i-1].key, label:`${STEPS[i-1].no} ${STEPS[i-1].name}` };
      const next = i === STEPS.length - 1 ? { key:'home', label:'ภาพรวม' } : { key:STEPS[i+1].key, label:`${STEPS[i+1].no} ${STEPS[i+1].name}` };
      const st = all[STEPS[i].key];
      bar.hidden = false;
      bar.innerHTML = `<a class="btn ghost" href="#${prev.key}" data-nav="1" aria-label="ย้อนกลับไป ${esc(prev.label)}">← ย้อนกลับ</a>
        <div class="sb-mid">${STEPS[i].no} ${esc(STEPS[i].name)} · ${ST_TXT[st.s]}${st.issues.length ? ` · ยังมี ${st.issues.length} รายการที่ต้องดู` : ''}</div>
        <a class="btn" href="#${next.key}" data-nav="1" aria-label="ไปต่อที่ ${esc(next.label)}">${i === STEPS.length - 1 ? 'กลับภาพรวม' : 'ถัดไป'} →</a>`;
    }
  }
  if (view === 'home') renderHome(all);
}

// ---- หน้าภาพรวม ----
function renderHome(all){
  all = all || allStatus();
  const box = $('#home'); if (!box) return;
  const hasWork = wsSnapHasData(wsSnapshot());
  const localNote = `<div class="local-note"><b>งานเก็บในเบราว์เซอร์นี้เท่านั้น</b> ถ้าล้างประวัติเบราว์เซอร์ เปลี่ยนเครื่อง หรือใช้โหมดไม่ระบุตัวตน งานจะไม่ตามไป กด “สำรองเป็นไฟล์ (.json)” ที่แถบด้านบนเป็นระยะ แล้วใช้ “เปิดไฟล์สำรอง” เพื่อทำต่อ</div>`;
  if (!hasWork){
    box.innerHTML = `<section class="home-card welcome">
      <h2 style="margin:0">เริ่มต้นจัดทำแผนพัฒนาตำบล</h2>
      <p class="note" style="margin-top:4px">ทำทีละขั้น ข้อมูลจากขั้นก่อนไหลไปขั้นถัดไปเอง ไม่ต้องพิมพ์ซ้ำ ย้อนกลับไปแก้ได้ทุกเมื่อ</p>
      <ul class="plain">${STEPS.map(s => `<li><b>${s.no} ${esc(s.name)}</b> — ${esc(s.desc)}</li>`).join('')}</ul>
      <div class="row-actions" style="margin-top:14px">
        <a class="btn" href="#review" data-nav="1">เริ่มขั้น ⓪ ทบทวนแผนเดิม →</a>
        <button class="btn ghost" type="button" data-home="open">⬆ เปิดไฟล์สำรอง (.json)</button>
        <button class="btn ghost" type="button" data-home="sample">ลองดูด้วยข้อมูลตัวอย่างป่าแดด</button>
      </div>${localNote}</section>`;
    return;
  }
  const m = state.ai?.meta || {};
  const tb = m.tambon || cur.tis?.tambon || ana.comm?.tambon, amp = m.amphoe || cur.tis?.amphoe || ana.comm?.amphoe;
  const pct = progressPct(all), nDone = STEPS.filter(s => all[s.key].s === 'done').length;
  const nk = nextStepKey(all), ns = STEPS.find(s => s.key === nk);
  const items = orderedItems(planItems());
  const sumB = items.reduce((a, it) => a + (Number(it.budget) || 0), 0), noB = items.filter(it => it.budget === null || it.budget === undefined || it.budget === '').length;
  const old = state.ai?.part3?.projects || [];
  const issues = STEPS.flatMap(s => all[s.key].issues.map(x => ({ ...x, key:s.key, no:s.no })));
  const nBad = issues.filter(x => x.lv === 'bad').length;
  issues.sort((a, b) => (a.lv === 'bad' ? 0 : 1) - (b.lv === 'bad' ? 0 : 1));
  box.innerHTML = `<section class="home-card">
      <div class="home-head">
        <div><h2>${tb ? `ตำบล${esc(tb)}` : 'ยังไม่ระบุตำบล'}${amp ? ` อำเภอ${esc(amp)}` : ''} จังหวัด${esc(m.changwat || 'เชียงราย')}</h2>
          <div class="meta">แผนพัฒนาตำบลปี ${bk.year ? esc(bk.year) : '<span title="กรอกในขั้น ④">ยังไม่ระบุ (กรอกในขั้น ④)</span>'}${m.plan_year ? ` · ทบทวนจากแผนเดิมปี ${esc(m.plan_year)}` : ''}</div></div>
        <a class="btn" href="#${nk}" data-nav="1">${nDone === STEPS.length ? 'ตรวจและส่งออกรูปเล่ม' : `ทำต่อ: ${ns.no} ${esc(ns.name)}`} →</a>
      </div>
      <div class="progress">
        <div class="bar" role="progressbar" aria-label="ความคืบหน้าการจัดทำแผน" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
        <div class="lbl"><span>เสร็จสมบูรณ์ <b>${nDone}</b> จาก ${STEPS.length} ขั้น</span><b>${pct}%</b></div>
      </div>
      <div class="stats">
        <div><b>${old.length}</b><span>โครงการในแผนเดิม (ระบุสถานะแล้ว ${old.filter(p => rv(p.id).status).length})</span></div>
        <div><b>${items.length}</b><span>โครงการในแผนใหม่</span></div>
        <div><b>${fmt(sumB)}</b><span>งบรวมแผนใหม่ (บาท)${noB ? ` · ยังไม่กำหนดงบ ${noB} โครงการ` : ''}</span></div>
        <div><b style="color:${nBad ? 'var(--bad)' : 'inherit'}">${issues.length}</b><span>รายการที่ยังไม่ครบ${nBad ? ` (ต้องแก้ ${nBad})` : ''}</span></div>
      </div>
    </section>
    <div class="steps-grid">${STEPS.map(s => { const st = all[s.key]; return `<section class="step-card" data-s="${st.s}">
      <div class="sc-top"><h3>${s.no} ${esc(s.name)}</h3>${badgeHTML(st.s)}</div>
      <p>${esc(s.desc)}</p>
      ${st.issues.length ? `<ul>${st.issues.slice(0, 2).map(x => `<li>${esc(x.text)}</li>`).join('')}${st.issues.length > 2 ? `<li>และอีก ${st.issues.length - 2} รายการ</li>` : ''}</ul>` : ''}
      <a class="btn ${s.key === nk ? '' : 'ghost'} small" href="#${s.key}" data-nav="1">${st.s === 'todo' ? 'เริ่มขั้นนี้' : 'เปิดขั้นนี้'} →</a></section>`; }).join('')}</div>
    <section class="home-card">
      <h2 style="margin:0;font-size:20px">รายการที่ยังไม่ครบ</h2>
      ${issues.length ? `<ul class="issues">${issues.slice(0, 10).map(x => `<li class="${x.lv}"><span><b>${x.no}</b> ${esc(x.text)}</span><a class="go" href="#${x.key}" data-el="${esc(x.el)}">ไปที่จุดนี้ →</a></li>`).join('')}${issues.length > 10 ? `<li class="more">และอีก ${issues.length - 10} รายการ ดูในแต่ละขั้น</li>` : ''}</ul>` : '<p class="note">ข้อมูลสำคัญครบทุกขั้นแล้ว ไปที่ขั้น ④ เพื่อดาวน์โหลดรูปเล่ม</p>'}
      ${localNote}
    </section>`;
}

// ---- การนำทาง: ลิงก์ “ไปที่จุดนี้” เลื่อนไปข้อย่อยนั้น, ปุ่มเปลี่ยนขั้นเลื่อนขึ้นบนสุด ----
let navScrollTo = null;
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-el], a[data-nav]');
  if (a){
    navScrollTo = a.dataset.el || 'top';
    if (a.getAttribute('href') === location.hash){ e.preventDefault(); doNavScroll(); }
    return;
  }
  const h = e.target.closest('[data-home]');
  if (h?.dataset.home === 'open') $('#wsFile').click();
  if (h?.dataset.home === 'sample'){ location.hash = '#review'; $('#loadSample').click(); toast('โหลดคำตอบตัวอย่างจริงของป่าแดดแล้ว (ข้อมูลทดสอบ) ลองระบุสถานะโครงการ แล้วกด “ถัดไป”'); }
});
function doNavScroll(){
  const t = navScrollTo; navScrollTo = null;
  if (!t) return;
  if (t === 'top'){ window.scrollTo(0, 0); return; }
  const el = document.getElementById(t);
  if (el){ el.scrollIntoView({ block:'start' }); const h = el.querySelector('h2'); if (h){ h.setAttribute('tabindex', '-1'); h.focus({ preventScroll:true }); } }
}
window.addEventListener('hashchange', () => setTimeout(doNavScroll, 0));
