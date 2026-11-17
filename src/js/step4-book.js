// step4-book.js — ④ หน้าจอส่งออกรูปเล่ม
const BK0 = () => ({ year:'', rdate:'', rround:'', rres:'', ratt:'' });
const bk = BK0();
function bkPersist(){ wsSave(); }
function baseNow(){
  const p1 = state.ai?.part1 || {}, b = cur.base || {};
  const pick = (k, dv) => (b[k] !== undefined && b[k] !== null && b[k] !== '') ? b[k] : dv;
  return { total: pick('total', p1.population?.total), male: pick('male', p1.population?.male), female: pick('female', p1.population?.female), households: pick('households', p1.households), income: pick('income', p1.avg_income_per_person_year), year: b.year || '' };
}
function bookData(){
  const m = state.ai?.meta || {};
  const ps = state.ai?.part3?.projects || [];
  const cnt = k => ps.filter(p => rv(p.id).status === k).length;
  const nd = ps.filter(p => rv(p.id).status === 'not_done');
  const sources = [];
  if (state.ai) sources.push(`แผนพัฒนาตำบลฉบับเดิม${m.plan_year ? ' ปี ' + m.plan_year : ''}`);
  if (cur.tis) sources.push(`รายงานผลการวิเคราะห์ TIS (การจัดลำดับประเด็นการพัฒนารายหมู่บ้าน)${cur.tis.year ? ' ปีงบประมาณ ' + cur.tis.year : ''}`);
  if (ana.comm) sources.push(`รายงานผลการวิเคราะห์ข้อมูลชุมชน TIS (ทุนชุมชน)${ana.comm.year ? ' ปีงบประมาณ ' + ana.comm.year : ''}`);
  const baseYear = (cur.base || {}).year; if (baseYear) sources.push(`ข้อมูลพื้นฐาน ${baseYear}`);
  const venueN = (ana.venue || '').split('\n').filter(s => s.trim()).length; if (venueN) sources.push(`ข้อมูลจากเวทีประชาคม ${venueN} ประเด็น`);
  if (ana.answer) sources.push('แผนพัฒนาจังหวัดเชียงราย 5 ปี (พ.ศ. 2571-2575)');
  return {
    tambon: m.tambon || cur.tis?.tambon || ana.comm?.tambon, amphoe: m.amphoe || cur.tis?.amphoe || ana.comm?.amphoe, changwat: m.changwat || 'เชียงราย',
    year: bk.year, base: baseNow(), swot: effPart2()?.swot, direction: ana.answer?.direction, strategies: ana.answer?.strategies,
    tisOrder: cur.tisStats?.order, tisN: cur.tisStats?.n, tisYear: cur.tis?.year,
    items: orderedItems(planItems()), review: { date: bk.rdate, round: bk.rround, resolution: bk.rres, attendees: bk.ratt },
    sources, reviewSummary: ps.length ? `จากทั้งหมด ${ps.length} โครงการ ทำแล้วจบโครงการ ${cnt('done')} โครงการ ทำแล้วและทำต่อ ${cnt('done_continue')} โครงการ ยังไม่ได้ทำ ${nd.length} โครงการ (ยกไปแผนใหม่ ${nd.filter(p => rv(p.id).decision==='carry').length} ตัดออก ${nd.filter(p => rv(p.id).decision==='drop').length})${ps.length - cnt('done') - cnt('done_continue') - nd.length ? ' ยังไม่ระบุสถานะ ' + (ps.length - cnt('done') - cnt('done_continue') - nd.length) + ' โครงการ' : ''}` : ''
  };
}
function renderBook(){
  const defs = [['year','ปี พ.ศ. ของแผน','text','เช่น 2570'],['rdate','วันที่ประชุมทบทวน','text','เช่น 15 ม.ค. 2570'],['rres','มติที่ประชุม','text','เช่น เห็นชอบ'],['ratt','จำนวนผู้เข้าร่วมประชุม','number','']];
  $('#bookForm').innerHTML = defs.map(([k,l,ty,ph]) => `<label>${l}<input data-bk="${k}" type="${ty}" placeholder="${esc(ph)}" value="${esc(bk[k] ?? '')}"></label>`).join('');
  renderChecklist();
  if (!$('#bookPreview').hidden) renderPreview();
}
$('#bookForm').addEventListener('input', e => { const k = e.target.dataset.bk; if (!k) return; bk[k] = e.target.value; bkPersist(); clearTimeout(renderBook._t); renderBook._t = setTimeout(() => { const a = document.activeElement?.dataset?.bk; renderBook(); if (a){ const el = document.querySelector(`[data-bk="${a}"]`); if (el){ el.focus(); const v = el.value; if (el.type === 'text') el.setSelectionRange(v.length, v.length); } } }, 600); });
$('#dlBook').addEventListener('click', async () => {
  if (!window.docx){ $('#bookNote').textContent = 'โหลดตัวสร้างไฟล์ Word ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่'; return; }
  const nFix = bookChecklist().filter(x => x.lv === 'fix').length;
  if (nFix && !confirm(`ยังมี ${nFix} รายการที่ “ต้องแก้ไขก่อนส่งออก”\n\nดาวน์โหลดเป็นฉบับร่างไปก่อนหรือไม่? (แนะนำให้แก้ก่อน แล้วค่อยส่งออกฉบับจริง)`)){ $('#bookNote').textContent = 'ยกเลิกการดาวน์โหลด แก้รายการในข้อ ข ก่อน'; return; }
  const D = bookData();
  if (!D.tambon){ $('#bookNote').textContent = 'ยังไม่รู้ชื่อตำบล ทำขั้น ⓪ หรือนำเข้ารายงาน TIS ก่อน'; return; }
  $('#bookNote').textContent = 'กำลังสร้างไฟล์…';
  let blob; try{ blob = await docx.Packer.toBlob(buildBook(D, docx)); }catch(e){ $('#bookNote').textContent = 'สร้างไฟล์ไม่สำเร็จ'; return; }
  const name = `แผนพัฒนาตำบล_${D.tambon}_${D.year || 'ร่าง'}.docx`;
  let dl = null; try{ dl = await window.claude?.use?.('downloads'); }catch(e){}
  if (dl){
    try{ await dl.save({ filename:name, data:blob }); $('#bookNote').textContent = 'บันทึกไฟล์แล้ว เปิดใน Word แล้วค้นหาแถบเหลือง “ต้องเติม” เพื่อเติมให้ครบ'; return; }
    catch(e){ if (e?.code === 'declined'){ $('#bookNote').textContent = 'ยกเลิกการบันทึก'; return; } }
  }
  try{ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); $('#bookNote').textContent = 'ถ้าไฟล์ไม่ถูกดาวน์โหลด ให้เปิดหน้านี้จากลิงก์ของ artifact โดยตรง'; }
  catch(e){ $('#bookNote').textContent = 'บันทึกไฟล์จากหน้านี้ไม่ได้'; }
});
[['#aiBox','#checkBtn'],['#ans1Box','#check1'],['#ans2Box','#check2']].forEach(([box, btn]) => $(box).addEventListener('paste', () => setTimeout(() => $(btn).click(), 60)));


// ===== รายการตรวจก่อนส่งออก (3 ระดับ) =====
// fix = ต้องแก้ไขก่อนส่งออก (ข้อมูลผิดหรือขัดกัน), check = ควรตรวจสอบเพิ่มเติม (ยังขาด จะเป็นแถบเหลืองใน Word), pass = ผ่าน
// แต่ละรายการมี key/el สำหรับปุ่ม “ไปแก้”
function bookChecklist(){
  const L = [], add = (lv, group, text, key, el) => L.push({ lv, group, text, key, el });
  const D = bookData(), b = D.base || {}, m = state.ai?.meta || {};
  const n = v => v === '' || v === null || v === undefined ? null : Number(v);
  // 1) ข้อมูลพื้นที่
  if (D.tambon && D.amphoe) add('pass', 'ข้อมูลพื้นที่', `ตำบล${D.tambon} อำเภอ${D.amphoe} จังหวัด${D.changwat}`, 'review', 's2');
  else add('fix', 'ข้อมูลพื้นที่', 'ยังไม่รู้ชื่อตำบลหรืออำเภอ ทำขั้น ⓪ หรือนำเข้ารายงาน TIS ในขั้น ①', 'review', 's2');
  if (m.tambon && cur.tis?.tambon && cur.tis.tambon !== m.tambon) add('fix', 'ข้อมูลพื้นที่', `รายงาน TIS เป็นตำบล${cur.tis.tambon} ไม่ตรงกับแผนเดิม (ตำบล${m.tambon})`, 'current', 'c1');
  if (m.tambon && ana.comm?.tambon && ana.comm.tambon !== m.tambon) add('fix', 'ข้อมูลพื้นที่', `รายงานทุนชุมชนเป็นตำบล${ana.comm.tambon} ไม่ตรงกับแผนเดิม`, 'analysis', 'a1');
  if (!D.year) add('check', 'ข้อมูลพื้นที่', 'ยังไม่ระบุปี พ.ศ. ของแผน (ใช้บนปก)', 'book', 'b1');
  // 2) ข้อมูลพื้นฐาน
  if (n(b.male) !== null && n(b.female) !== null && n(b.total) !== null && n(b.male) + n(b.female) !== n(b.total)) add('fix', 'ข้อมูลพื้นฐาน', `ประชากรชาย ${fmt(b.male)} + หญิง ${fmt(b.female)} ไม่เท่ากับรวม ${fmt(b.total)}`, 'current', 'c4');
  if (b.total && b.households) add('pass', 'ข้อมูลพื้นฐาน', `ประชากร ${fmt(b.total)} คน ${fmt(b.households)} ครัวเรือน`, 'current', 'c4');
  else add('check', 'ข้อมูลพื้นฐาน', 'ยังไม่มีจำนวนประชากรหรือครัวเรือน', 'current', 'c4');
  if (!b.year) add('check', 'ข้อมูลพื้นฐาน', 'ยังไม่ระบุปีของข้อมูลพื้นฐาน', 'current', 'c4');
  add('check', 'ข้อมูลพื้นฐาน', 'ส่วนที่ 1 หัวข้ออื่น (แผนที่ อาณาเขต อาชีพ กลุ่ม กองทุน ฯลฯ) แอปไม่ได้สร้าง ต้องเติมใน Word', 'book', 'b3');
  // 3) SWOT
  if (!ana.answer) add('check', 'SWOT', 'ยังไม่มีร่าง SWOT (ส่วนที่ 2.1–2.2)', 'analysis', 'a3');
  else {
    const e = ana.validation?.errors?.length || 0, c = swotCounts();
    if (e) add('fix', 'SWOT', `ร่าง SWOT/TOWS มีจุดที่ผิด ${e} จุด (เช่น อ้างรหัสที่ไม่มีจริง จับคู่ผิดประเภท)`, 'analysis', 'a4');
    if (c.all && c.ok === c.all) add('pass', 'SWOT', `SWOT ยืนยันครบ ${c.all} ข้อ`, 'analysis', 'a4');
    else add('check', 'SWOT', `SWOT ยังไม่ได้ยืนยัน ${c.all - c.ok} จาก ${c.all} ข้อ`, 'analysis', 'a4');
  }
  if (D.tisOrder?.length) add('pass', 'SWOT', `ส่วนที่ 2.3 ใช้ผลการจัดลำดับจาก TIS ${D.tisN} หมู่บ้าน`, 'current', 'c2');
  else add('check', 'SWOT', 'ยังไม่ได้นำเข้ารายงาน TIS (ส่วนที่ 2.3)', 'current', 'c1');
  // 4) ทิศทางและยุทธศาสตร์
  if (D.direction && D.strategies?.length) add('pass', 'ยุทธศาสตร์', `มีทิศทาง (2.4) และยุทธศาสตร์ ${D.strategies.length} ข้อ (2.5)`, 'analysis', 'a4');
  else add('check', 'ยุทธศาสตร์', 'ยังไม่มีทิศทาง (2.4) หรือยุทธศาสตร์ (2.5)', 'analysis', 'a3');
  // 5) โครงการ
  const items = D.items || [], chk = checkPlan(items, part2Ctx());
  const fl = items.map(it => chk.perItem[it.uid] || []);
  const nBad = fl.filter(x => x.some(y => y[0] === 'bad')).length;
  const nWarn = fl.filter(x => x.some(y => y[0] === 'warn' && !/อาจเป็นโครงการซ้ำ/.test(y[1])) && !x.some(y => y[0] === 'bad')).length;
  if (!items.length) add('fix', 'โครงการ', 'ส่วนที่ 3 ยังไม่มีโครงการเลย', 'projects', 'p3');
  else {
    if (nBad) add('fix', 'โครงการ', `โครงการที่ข้อมูลผิด ${nBad} โครงการ (เช่น ไม่มีชื่อ งบไม่ถูกต้อง)`, 'projects', 'p3');
    if (nWarn) add('check', 'โครงการ', `โครงการที่รายละเอียดยังไม่ครบ ${nWarn} โครงการ (งบ ด้าน วิธีดำเนินการ ยุทธศาสตร์)`, 'projects', 'p3');
    chk.warn.filter(x => /ยังไม่มีโครงการรองรับ|หมู่บ้านเดียว/.test(x)).forEach(x => add('check', 'โครงการ', x, 'projects', 'p4'));
    if (!nBad && !nWarn) add('pass', 'โครงการ', `โครงการ ${items.length} โครงการ รายละเอียดครบ`, 'projects', 'p3');
  }
  // 6) ข้อมูลที่อาจซ้ำ
  const dupOld = state.ai ? Object.keys(dupMap(state.ai.part3.projects)).length : 0;
  const dupNew = fl.filter(x => x.some(y => /อาจเป็นโครงการซ้ำ/.test(y[1]))).length;
  if (dupOld) add('check', 'ข้อมูลซ้ำ', `แผนเดิมมีโครงการชื่อเกือบซ้ำ ${dupOld} โครงการ`, 'review', 's3');
  if (dupNew) add('check', 'ข้อมูลซ้ำ', `แผนใหม่มีโครงการชื่อคล้ายกัน ${dupNew} โครงการ`, 'projects', 'p3');
  if (!dupOld && !dupNew) add('pass', 'ข้อมูลซ้ำ', 'ไม่พบโครงการที่ชื่อซ้ำหรือเกือบซ้ำ', 'projects', 'p3');
  // 7) ส่วนอื่นของเล่ม
  const ps = state.ai?.part3?.projects || [], nost = ps.filter(p => !rv(p.id).status).length;
  if (nost) add('check', 'ส่วนอื่นของเล่ม', `ผลทบทวนแผนเดิมยังไม่ระบุสถานะ ${nost} โครงการ (ใช้สรุปในส่วนที่ 5)`, 'review', 's3');
  if (bk.rdate && bk.rres) add('pass', 'ส่วนอื่นของเล่ม', 'ส่วนที่ 4 มีข้อมูลการประชุมทบทวนแผน', 'book', 'b1');
  else add('check', 'ส่วนอื่นของเล่ม', 'ส่วนที่ 4 ยังไม่ได้กรอกวันที่หรือมติการประชุมทบทวน', 'book', 'b1');
  add('check', 'ส่วนอื่นของเล่ม', 'ตารางการวิเคราะห์ปัญหาของตำบล แอปยังไม่สร้าง ต้องเติมจากเวทีใน Word', 'book', 'b3');
  add('check', 'ส่วนอื่นของเล่ม', 'ภาคผนวก: รายชื่อผู้สูงอายุและคนพิการต้องแนบเองนอกระบบ (แอปไม่เก็บข้อมูลส่วนบุคคล)', 'book', 'b3');
  return L;
}
const CK_LV = [['fix', 'ต้องแก้ไขก่อนส่งออก', '!'], ['check', 'ควรตรวจสอบเพิ่มเติม', '◐'], ['pass', 'ผ่านการตรวจสอบ', '✓']];
function renderChecklist(){
  const L = bookChecklist();
  const cnt = lv => L.filter(x => x.lv === lv).length;
  $('#bookCheck').innerHTML = (!window.docx ? '<ul class="facts" style="margin:0 0 10px"><li class="bad">โหลดตัวสร้างไฟล์ Word ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่</li></ul>' : '') +
    `<div class="ck-sum">${CK_LV.map(([lv, lbl, ic]) => `<span class="ck-pill" data-lv="${lv}"><span aria-hidden="true">${ic}</span> ${lbl} <b>${cnt(lv)}</b></span>`).join('')}</div>` +
    CK_LV.map(([lv, lbl, ic]) => { const arr = L.filter(x => x.lv === lv); if (!arr.length) return '';
      return `<section class="ck-group" data-lv="${lv}"><h3><span aria-hidden="true">${ic}</span> ${lbl} (${arr.length})</h3><ul>${arr.map(x =>
        `<li><span><b class="ck-g">${esc(x.group)}</b> ${esc(x.text)}</span>${lv !== 'pass' ? `<a class="go" href="#${x.key}" data-el="${esc(x.el)}">ไปแก้ →</a>` : ''}</li>`).join('')}</ul></section>`; }).join('');
}

// ===== ตัวอย่างเนื้อหาเล่ม (HTML) — เนื้อหาเดียวกับไฟล์ Word แต่ไม่ใช่หน้าตาจริง =====
function renderPreview(){
  const D = bookData(), b = D.base || {}, T = esc(D.tambon || '…'), A = esc(D.amphoe || '…');
  const FILL = s => `<mark class="fill">[ต้องเติม: ${esc(s)}]</mark>`;
  const v = (x, s) => x === null || x === undefined || x === '' ? FILL(s) : esc(typeof x === 'number' ? fmt(x) : x);
  const sw = D.swot || {};
  const list = arr => arr && arr.length ? `<ol>${arr.map(x => `<li>${esc(x.text)}</li>`).join('')}</ol>` : `<p>${FILL('ยังไม่มีข้อมูล')}</p>`;
  const items = D.items || [];
  const money = x => x === null || x === undefined || x === '' ? FILL('งบ') : Number(x) === 0 ? 'ไม่ใช้งบประมาณ' : fmt(x);
  const DIMS = ['เศรษฐกิจ','สังคม','ทรัพยากรธรรมชาติและสิ่งแวดล้อม','ความมั่นคง','บริหารจัดการ'];
  const rv4 = D.review || {};
  $('#bookPreview').innerHTML = `<div class="pv-note" role="note"><b>ตัวอย่างเนื้อหา (Preview)</b> แสดงเนื้อหาที่จะอยู่ในไฟล์ Word เพื่อตรวจก่อนดาวน์โหลด ไม่ใช่หน้าตาจริงของเอกสาร คำนำ สารบัญ และข้อความตามแบบฟอร์มไม่ได้แสดงที่นี่ ส่วนที่มีพื้นเหลืองคือส่วนที่ต้องเติมใน Word</div>
    <article class="pv">
      <section class="pv-cover"><h3>แผนพัฒนาตำบล</h3><p>ประจำปี พ.ศ. ${v(D.year, 'ปี พ.ศ.')}</p><p>ตำบล${T} อำเภอ${A} จังหวัด${esc(D.changwat || 'เชียงราย')}</p></section>
      <section><h3>ส่วนที่ 1 ข้อมูลทั่วไปของตำบล</h3>
        <p>6. จำนวนประชากรรวมทั้งสิ้น ${v(b.total, 'จำนวน')} คน แยกเป็น ชาย ${v(b.male, 'จำนวน')} คน หญิง ${v(b.female, 'จำนวน')} คน</p>
        <p>7. จำนวนครัวเรือน ${v(b.households, 'จำนวน')} ครัวเรือน</p>
        <p>11. รายได้เฉลี่ยของประชากร ${b.year ? '(' + esc(b.year) + ') ' : ''}${v(b.income, 'บาท/คน/ปี')} บาท/คน/ปี</p>
        <p>หัวข้อ 1–5, 6.1–6.2, 8–10, 12–15 ${FILL('เติมใน Word')}</p></section>
      <section><h3>ส่วนที่ 2 การวิเคราะห์ข้อมูล</h3>
        <h4>2.1 ปัจจัยภายใน</h4><p><b>(1) จุดอ่อน</b></p>${list(sw.W)}<p><b>(2) จุดแข็ง</b></p>${list(sw.S)}
        <h4>2.2 ปัจจัยภายนอก</h4><p><b>(1) โอกาส</b></p>${list(sw.O)}<p><b>(2) อุปสรรค</b></p>${list(sw.T)}
        <h4>2.3 ผลการวิเคราะห์ข้อมูลชุมชน (TIS)</h4>${D.tisOrder?.length ? `<div class="scroll"><table class="mini"><thead><tr><th>ประเด็นการพัฒนา</th>${[1,2,3,4,5].map(k => `<th>อันดับ ${k}</th>`).join('')}<th>อันดับเฉลี่ย</th></tr></thead><tbody>${D.tisOrder.map(o => `<tr><td>${esc(o.dim)}</td>${o.counts.map(c => `<td>${c}</td>`).join('')}<td>${o.avg.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>` : `<p>${FILL('ผลการวิเคราะห์จาก TIS')}</p>`}
        <h4>2.4 ทิศทางการพัฒนา</h4><p>${v(D.direction, 'ทิศทาง/เป้าหมาย')}</p>
        <h4>2.5 กลยุทธ์หรือวิธีปฏิบัติ</h4>${D.strategies?.length ? `<ol>${D.strategies.map(s => `<li><b>${esc(s.name)}</b>${s.detail ? ' — ' + esc(s.detail) : ''}</li>`).join('')}</ol>` : `<p>${FILL('กลยุทธ์')}</p>`}
        <h4>การวิเคราะห์ปัญหาของตำบล</h4><p>${FILL('ตารางจากเวที')}</p></section>
      <section><h3>ส่วนที่ 3 แผนงาน/โครงการ/กิจกรรม (หน้าแนวนอนในไฟล์ Word)</h3>
        <h4>3.1 เรียงตามลำดับความสำคัญ</h4>${items.length ? `<div class="scroll"><table class="mini"><thead><tr><th>ที่</th><th>ชื่อโครงการ</th><th>งบประมาณ</th><th>เป้าหมาย</th><th>ด้าน</th><th>วิธีดำเนินการ</th></tr></thead><tbody>${items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name || '')}</td><td style="text-align:right">${money(it.budget)}</td><td>${it.target ? esc(it.target) : FILL('เป้าหมาย')}</td><td>${esc(it.dim || '')}</td><td>${esc(it.method || '')}</td></tr>`).join('')}</tbody></table></div>
          <p>งบรวม ${fmt(items.reduce((s, it) => s + (Number(it.budget) || 0), 0))} บาท</p>` : `<p>${FILL('ยังไม่มีโครงการ')}</p>`}
        <h4>3.2 แยกตามด้าน</h4><ul>${DIMS.map(d => { const arr = items.filter(it => it.dim === d); return `<li>ด้าน${d}: ${arr.length} โครงการ${arr.length ? ' (' + arr.map(it => esc(it.name)).join(', ') + ')' : ''}</li>`; }).join('')}${items.some(it => !DIMS.includes(it.dim)) ? `<li>${FILL(items.filter(it => !DIMS.includes(it.dim)).length + ' โครงการยังไม่ระบุด้าน')}</li>` : ''}</ul></section>
      <section><h3>ส่วนที่ 4 การทบทวนแผนพัฒนาตำบล</h3><p>วันที่ ${v(rv4.date, 'วันที่')} · มติ ${v(rv4.resolution, 'มติ')} · ผู้เข้าร่วม ${v(rv4.attendees, 'จำนวน')} คน</p></section>
      <section><h3>ส่วนที่ 5 เรื่องอื่น ๆ</h3>${D.sources?.length ? `<p><b>แหล่งข้อมูลที่ใช้</b></p><ul>${D.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}${D.reviewSummary ? `<p><b>ผลการทบทวนโครงการในแผนฉบับเดิม:</b> ${esc(D.reviewSummary)}</p>` : ''}<p>${FILL('เรื่องอื่นที่ ก.บ.ต. เห็นว่าสำคัญ')}</p></section>
      <section><h3>ภาคผนวก</h3><p>${FILL('รายชื่อผู้สูงอายุและคนพิการ (จัดทำนอกระบบ)')} ${FILL('แบบประเมินของอำเภอ และภาพกิจกรรมเวที')}</p></section>
    </article>`;
}
$('#previewBtn').addEventListener('click', () => {
  const box = $('#bookPreview'), open = box.hidden;
  if (open) renderPreview();
  box.hidden = !open;
  $('#previewBtn').setAttribute('aria-expanded', String(open));
  $('#previewBtn').textContent = open ? 'ซ่อนตัวอย่างเนื้อหาเล่ม' : 'ดูตัวอย่างเนื้อหาเล่ม';
  if (open) box.scrollIntoView?.({ block:'start' });
});
