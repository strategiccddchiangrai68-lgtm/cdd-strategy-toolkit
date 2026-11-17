// End-to-end test: รวมไฟล์ใน src/ ด้วย build.js แล้วโหลดใน jsdom เดินขั้น ⓪–④ ด้วยข้อมูลจริงของตำบลป่าแดด
// รัน: npm install && npm test
// ไฟล์ PDF แผนเดิม (มีข้อมูลส่วนบุคคล) ไม่อยู่ใน repo ให้วางเองที่ fixtures/private/padaet_2569.pdf
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const fx = f => path.join(root, 'fixtures', f);
const { build, OUT } = require('../build.js');
const built = build();
// docs/index.html คือไฟล์ที่ขึ้น GitHub Pages ต้องตรงกับ src/ เสมอ
if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== built){ console.error('✗ docs/index.html ไม่ตรงกับ src/ ให้รัน npm run build ก่อน'); process.exit(1); }
let html = built
  .replace(/<script src="https:\/\/(cdnjs|cdn\.jsdelivr)[^"]+"><\/script>/g, '').replace(/<link[^>]+>/g, '');
globalThis.pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
const errs = [];
// เปิดแอปหนึ่งหน้า (เหมือนเปิดในเครื่องใหม่ localStorage ว่าง) seed ใช้ใส่ข้อมูลใน localStorage ก่อนแอปเริ่ม
function boot(seed, hash = '#review'){
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/' + hash,
    beforeParse(w){ w.addEventListener('error', e => errs.push(e.message)); w.CSS = { escape: s => s }; w.confirm = () => true; if (seed) seed(w.localStorage); } });
  const w = dom.window;
  w.pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js'); w.XLSX = require('xlsx'); w.docx = require('docx');
  return w;
}
const w = boot();
const d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
const fire = (el, ev = 'change') => el.dispatchEvent(new w.Event(ev, { bubbles: true }));
const file = p => { const b = fs.readFileSync(p); return { name: path.basename(p), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
(async () => {
  await wait(200);
  // ⓪ คำตอบจริงของ Gemini
  d.querySelector('#loadSample').click();
  assert.strictEqual(d.querySelectorAll('.item').length, 33, '⓪ ต้องมี 33 โครงการ');
  const pdf = fx('private/padaet_2569.pdf');
  if (fs.existsSync(pdf)){
    await w.eval('readPdf')(file(pdf));
    const bad = [...d.querySelectorAll('.item.flag-bad .no')].map(n => n.textContent).join(',');
    assert.strictEqual(bad, '13,25,27,31', '⓪ ต้องจับงบที่ Gemini อ่านผิดได้ 4 จุด');
    console.log('✓ ⓪ เทียบงบกับ PDF: จับได้', bad);
  } else console.log('- ข้ามการทดสอบ PDF (ไม่มี fixtures/private/padaet_2569.pdf)');
  const setS = (i, v) => { const s = d.querySelectorAll('.item select[data-act=status]')[i]; s.value = v; fire(s); };
  setS(0, 'done_continue'); setS(9, 'done_continue'); setS(19, 'done');
  // ①
  w.location.hash = '#current'; await wait(30);
  await w.eval('readXls')(file(fx('tis_village_ranking_padaet_2569.xlsx')));
  assert.ok(/21 จาก 22 หมู่บ้าน/.test(d.querySelector('#heatFacts').textContent), '① ต้องพบฉันทามติ 21/22');
  console.log('✓ ① อ่าน TIS รายหมู่บ้าน');
  // ②
  w.location.hash = '#analysis'; await wait(30);
  await w.eval('readComm')(file(fx('tis_community_analysis_padaet_2569.xlsx')));
  const cf = d.querySelector('#commFacts').textContent;
  assert.ok(/ไม่มีการทำนา/.test(cf) && /8\.0 เท่า/.test(cf), '② ต้องจับ SWOT TIS ที่ขัดแย้งและประชากรต่าง 8 เท่า');
  const ans = { swot:{ S:[{id:'S1',text:'ป่าชุมชน',evidence:['CN1']}], W:[{id:'W1',text:'ขาดการจัดการผลิต',evidence:['PW2']}], O:[{id:'O1',text:'เกษตรอินทรีย์',evidence:['CR-P2-1.3']}], T:[{id:'T1',text:'ต้นทุน',evidence:['PT5']}] },
    tows:[{id:'SO1',type:'SO',pair:['S1','O1'],text:'x'},{id:'ST1',type:'ST',pair:['S1','O1'],text:'ผิดประเภท'}], direction:'d', strategies:[{no:1,name:'เกษตร',from:['SO1']}] };
  d.querySelector('#ans1Box').value = JSON.stringify(ans); d.querySelector('#check1').click();
  assert.ok(/ST1 เป็นกลยุทธ์ ST แต่จับคู่ S1\+O1/.test(d.querySelector('#ans1Facts').textContent), '② ต้องจับคู่ TOWS ผิดประเภท');
  console.log('✓ ② ตรวจคำตอบ Prompt #1');
  // ③
  w.location.hash = '#projects'; await wait(30);
  assert.strictEqual(d.querySelectorAll('#pjList .pj').length, 2, '③ ต้องยกโครงการเดิมมา 2 โครงการ');
  d.querySelector('#nName').value = 'ธนาคารขยะชุมชน'; d.querySelector('#nMethod').value = 'ทำเอง'; d.querySelector('#addPj').click();
  assert.strictEqual(d.querySelectorAll('#pjList .pj').length, 3, '③ เพิ่มโครงการเองได้');
  d.querySelectorAll('#pjList .pj')[2].querySelector('button[data-act=up]').click();
  assert.ok(d.querySelector('#p31 tbody tr:nth-child(2)').textContent.includes('ธนาคารขยะ'), '③ เลื่อนลำดับได้');
  console.log('✓ ③ โครงการและลำดับ');
  // ④
  w.location.hash = '#book'; await wait(30);
  const X = require('docx');
  const buf = await X.Packer.toBuffer(w.eval('buildBook')(w.eval('bookData')(), X));
  assert.ok(buf.length > 5000, '④ ต้องสร้าง docx ได้');
  console.log('✓ ④ สร้างรูปเล่ม .docx', buf.length, 'bytes');

  // ===== คัดลอกคำสั่งแล้วเปิด Gemini =====
  {
    let copied = null, opened = [], openResult = {}, clipOk = true;
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async t => { if (!clipOk) throw new Error('denied'); copied = t; } } });
    w.open = (url, name) => { opened.push([url, name]); return openResult; };
    for (const [btn, hash] of [['#copyPrompt', '#review'], ['#copyP1', '#analysis'], ['#copyP2', '#projects']]){
      w.location.hash = hash; await wait(30); copied = null; opened = [];
      d.querySelector(btn).click(); await wait(20);
      assert.ok(copied && copied.length > 200, `gemini: ${btn} ต้องคัดลอกคำสั่ง`);
      assert.deepStrictEqual(opened, [['https://gemini.google.com/app', 'gemini']], `gemini: ${btn} ต้องเปิด Gemini แท็บเดียว`);
    }
    assert.strictEqual(w.eval('PROMPT'), (w.location.hash = '#review', d.querySelector('#copyPrompt').click(), await wait(20), copied), 'gemini: ขั้น ⓪ ต้องคัดลอก Prompt #0 ทั้งก้อน');
    openResult = null; d.querySelector('#copyPrompt').click(); await wait(20);
    assert.ok(/ไม่ให้เปิดแท็บใหม่/.test(d.querySelector('#toast').textContent), 'gemini: ถ้าเบราว์เซอร์บล็อกแท็บใหม่ ต้องบอกให้กดปุ่มเปิด Gemini');
    clipOk = false; opened = []; d.querySelector('#copyPrompt').click(); await wait(20);
    assert.strictEqual(opened.length, 0, 'gemini: คัดลอกไม่สำเร็จต้องไม่เปิดแท็บ (ให้ผู้ใช้คัดลอกเองก่อน)');
    console.log('✓ คัดลอกคำสั่งแล้วเปิด Gemini');
  }

  // ===== ชุดข้อมูลรายตำบล =====
  const ev = (win, el, type = 'change') => el.dispatchEvent(new win.Event(type, { bubbles: true }));
  const J = (win, expr) => JSON.parse(JSON.stringify(win.eval(expr)));   // ค่าจากหน้าเว็บแบบคัดลอก
  const switchTo = (win, id) => { const s = win.document.querySelector('#wsSel'); s.value = id; ev(win, s); };
  const ID_A = 'แม่สรวย|ป่าแดด|2569';
  // ตำบล B เป็นข้อมูลสมมติเพื่อทดสอบเท่านั้น (ไม่ใช่ตำบลจริง): ใช้โครงสร้างคำตอบป่าแดด 3 โครงการแรก
  const B_AI = JSON.parse(JSON.stringify(w.eval('SAMPLE')));
  Object.assign(B_AI.meta, { tambon: 'ทดสอบสมมติ', amphoe: 'อำเภอสมมติ' }); B_AI.part3.projects = B_AI.part3.projects.slice(0, 3);
  const ID_B = 'อำเภอสมมติ|ทดสอบสมมติ|2569';

  // --- ทำสองตำบลสลับกันแล้วข้อมูลไม่ปนกัน ---
  const yr = () => d.querySelector('[data-bk=year]');
  yr().value = '2570'; ev(w, yr(), 'input');                      // ④ ของ A
  w.location.hash = '#analysis'; await wait(30);
  d.querySelector('#venueBox').value = 'น้ำไม่พอใช้หน้าแล้ง'; ev(w, d.querySelector('#venueBox'), 'input');
  const snapA = J(w, '({ review: state.review, cur, ana, prj, bk })');
  const orderA = J(w, 'orderedItems(planItems()).map(x => x.uid)');
  assert.strictEqual(w.eval('wsId'), ID_A, 'ws: ป่าแดดต้องผูกกับ อำเภอ|ตำบล|ปี');

  d.querySelector('#wsNew').click(); await wait(30);
  assert.strictEqual(w.location.hash, '#review', 'ws: เริ่มตำบลใหม่ต้องพาไปขั้น ⓪');
  assert.ok(!w.eval('state.ai') && !w.eval('cur.tis') && !w.eval('ana.comm') && !w.eval('ana.answer'), 'ws: เริ่มตำบลใหม่ต้องล้างข้อมูลทุกขั้นบนหน้าจอ');
  assert.strictEqual(w.eval('prj.extra.length') + w.eval('bk.year').length, 0, 'ws: เริ่มตำบลใหม่ต้องไม่มีโครงการหรือข้อมูลขั้น ④ ของตำบลเดิม');
  assert.strictEqual(d.querySelectorAll('.item').length, 0, 'ws: รายการโครงการขั้น ⓪ ต้องว่าง');

  d.querySelector('#aiBox').value = JSON.stringify(B_AI); d.querySelector('#checkBtn').click();
  assert.strictEqual(w.eval('wsId'), ID_B, 'ws: ตำบล B ต้องได้ชุดข้อมูลของตัวเอง');
  assert.strictEqual(d.querySelectorAll('.item').length, 3, 'ws: ตำบล B มี 3 โครงการ');
  setS(1, 'done');
  w.location.hash = '#analysis'; await wait(30);
  d.querySelector('#venueBox').value = 'ถนนเข้าหมู่บ้านชำรุด'; ev(w, d.querySelector('#venueBox'), 'input');
  w.location.hash = '#projects'; await wait(30);
  d.querySelector('#nName').value = 'โครงการของตำบลสมมติ'; d.querySelector('#addPj').click();
  assert.deepStrictEqual([...d.querySelectorAll('#wsSel option')].map(o => o.value).sort(), [ID_A, ID_B].sort(), 'ws: แถบเลือกตำบลต้องมีทั้งสองตำบล');

  switchTo(w, ID_A); await wait(30);
  assert.deepStrictEqual(J(w, '({ review: state.review, cur, ana, prj, bk })'), snapA, 'ws: กลับมาตำบล A ข้อมูลทุกขั้นต้องเหมือนก่อนสลับ');
  assert.strictEqual(d.querySelectorAll('.item').length, 33, 'ws: ตำบล A ต้องมี 33 โครงการ');
  assert.strictEqual(d.querySelector('#venueBox').value, 'น้ำไม่พอใช้หน้าแล้ง', 'ws: กล่องข้อมูลเวทีต้องเป็นของ A');
  assert.ok(!/ตำบลสมมติ/.test(d.querySelector('#pjList').textContent), 'ws: โครงการของ B ต้องไม่โผล่ใน A');
  w.location.hash = '#projects'; await wait(30);
  assert.ok(d.querySelector('#p31 tbody tr:nth-child(2)').textContent.includes('ธนาคารขยะ'), 'ws: ลำดับ 3.1 ของ A ต้องคงเดิม');

  switchTo(w, ID_B); await wait(30);
  assert.strictEqual(d.querySelectorAll('.item').length, 3, 'ws: กลับมาตำบล B ต้องมี 3 โครงการ');
  assert.strictEqual(w.eval('state.review["PD69-02"].status'), 'done', 'ws: สถานะของ B ต้องอยู่');
  assert.ok(!w.eval('state.review["PD69-01"]?.status'), 'ws: สถานะที่ตั้งใน A ต้องไม่ติดมา B');
  assert.ok(!w.eval('cur.tis') && !w.eval('ana.comm') && w.eval('bk.year') === '', 'ws: TIS และข้อมูลขั้น ④ ของ A ต้องไม่ติดมา B');
  assert.strictEqual(d.querySelector('#venueBox').value, 'ถนนเข้าหมู่บ้านชำรุด', 'ws: ข้อมูลเวทีต้องเป็นของ B');
  assert.deepStrictEqual(J(w, 'prj.extra.map(x => x.name)'), ['โครงการของตำบลสมมติ'], 'ws: โครงการที่เพิ่มต้องเป็นของ B เท่านั้น');
  assert.ok(w.localStorage.getItem('tambon-ws:' + ID_A) && w.localStorage.getItem('tambon-ws:' + ID_B), 'ws: ต้องเก็บแยก key ต่อตำบล');
  console.log('✓ ทำสองตำบลสลับกัน ข้อมูลไม่ปนกัน');

  // --- บันทึก .json แล้วเปิดกลับมาในเครื่องใหม่ได้ครบ ---
  switchTo(w, ID_A); await wait(30);
  const saved = JSON.stringify(w.eval('exportData')());
  const ex = JSON.parse(saved);
  assert.ok(ex.type === 'tambon-plan-review' && ex.version === 1 && ex.meta && ex.projects && ex.new_plan_projects && ex.analysis && ex.current, 'json: คีย์เดิมต้องอยู่ครบ');
  assert.ok(ex.workspace?.review?.ai, 'json: ต้องมี workspace');
  const w2 = boot(); await wait(100);
  const ok2 = await w2.eval('wsOpenFile')({ name: 'ทบทวนแผน_ป่าแดด_2569.json', text: async () => saved });
  assert.ok(ok2, 'json: เปิดไฟล์ต้องสำเร็จ');
  assert.strictEqual(w2.eval('wsId'), ID_A, 'json: เปิดแล้วต้องอยู่ที่ตำบล A');
  assert.deepStrictEqual(J(w2, '({ review: state.review, cur, ana, prj, bk })'), snapA, 'json: ข้อมูลทุกขั้นต้องกลับมาครบ');
  assert.deepStrictEqual(J(w2, 'orderedItems(planItems()).map(x => x.uid)'), orderA, 'json: ลำดับ 3.1 ต้องกลับมาครบ');
  assert.deepStrictEqual(J(w2, 'exportData().projects'), ex.projects, 'json: ผลทบทวนรายโครงการต้องเหมือนเดิม');
  assert.strictEqual(w2.document.querySelectorAll('.item').length, 33, 'json: หน้าขั้น ⓪ ต้องแสดง 33 โครงการ');
  assert.ok(w2.localStorage.getItem('tambon-ws:' + ID_A), 'json: ต้องบันทึกลงเครื่องใหม่ด้วย');
  // ไฟล์รุ่นก่อน (ไม่มี workspace) ต้องเปิดได้ และบอกส่วนที่กู้คืนไม่ได้
  const legacy = JSON.parse(saved); delete legacy.workspace;
  const w3 = boot(); await wait(100);
  assert.ok(w3.eval('wsImport')(legacy, 'old.json'), 'json รุ่นก่อน: ต้องเปิดได้');
  assert.deepStrictEqual(J(w3, 'Object.fromEntries(Object.entries(state.review).filter(([k,v]) => v.status).map(([k,v]) => [k, v.status]))'),
    Object.fromEntries(ex.projects.filter(p => p.review.status).map(p => [p.id, p.review.status])), 'json รุ่นก่อน: สถานะโครงการต้องกลับมาครบ');
  assert.deepStrictEqual(J(w3, 'orderedItems(planItems()).map(x => x.name)'), ex.new_plan_projects.items.map(x => x.name), 'json รุ่นก่อน: โครงการแผนใหม่และลำดับต้องกลับมา');
  assert.ok(w3.eval('cur.tis') && w3.eval('ana.answer') && w3.document.querySelector('#venueBox').value === 'น้ำไม่พอใช้หน้าแล้ง', 'json รุ่นก่อน: TIS ร่าง SWOT และข้อมูลเวทีต้องกลับมา');
  assert.ok(/กู้คืนไม่ได้/.test(w3.document.querySelector('#wsFacts').textContent), 'json รุ่นก่อน: ต้องบอกส่วนที่กู้คืนไม่ได้');
  // ไฟล์ที่ไม่ใช่ของระบบนี้ต้องไม่ทับข้อมูล
  assert.ok(!w2.eval('wsImport')({ type: 'other' }, 'x.json') && w2.eval('state.ai'), 'json: ไฟล์ผิดประเภทต้องไม่ถูกนำเข้า');
  console.log('✓ บันทึก .json แล้วเปิดกลับมาได้ครบ (รวมไฟล์รุ่นก่อน)');

  // --- ย้ายข้อมูลจากรูปแบบ ":last" ---
  const oldReview = { review: { 'PD69-01': { status: 'continue' }, 'PD69-05': { status: 'not_done', reason: 'ไม่ได้รับงบประมาณ', decision: 'carry' } }, ai: J(w, 'SAMPLE'), usingSample: true };
  const oldCur = { tis: J(w, 'cur.tis'), tisStats: J(w, 'cur.tisStats'), base: { year: 'จปฐ. 2569' }, tisFile: 'tis.xlsx', tisIsSample: false };
  const oldAna = { comm: null, venue: 'ข้อมูลเวทีที่บันทึกแบบเดิม', answerText: '', answer: null };
  const oldPrj = { old: {}, extra: [{ uid: 'm:1', source: 'manual', accepted: true, name: 'โครงการที่เพิ่มแบบเดิม' }], ans2Text: '', ans2: null, seq: 2 };
  const seedOld = (ana = oldAna) => ls => {
    ls.setItem('tambon-review:ป่าแดด:2569', JSON.stringify(oldReview)); ls.setItem('tambon-review:last', 'tambon-review:ป่าแดด:2569');
    ls.setItem('tambon-current:ป่าแดด', JSON.stringify(oldCur)); ls.setItem('tambon-current:last', 'tambon-current:ป่าแดด');
    ls.setItem('tambon-analysis:last', JSON.stringify(ana)); ls.setItem('tambon-projects:last', JSON.stringify(oldPrj)); ls.setItem('tambon-book:last', JSON.stringify({ year: '2570' }));
  };
  const w4 = boot(seedOld()); await wait(100);
  assert.strictEqual(w4.eval('wsId'), ID_A, 'migrate: ต้องเปิดตำบลที่ทำล่าสุด');
  assert.strictEqual(w4.document.querySelectorAll('.item').length, 33, 'migrate: คำตอบ AI ขั้น ⓪ ต้องอยู่');
  assert.strictEqual(w4.eval('state.review["PD69-01"].status'), 'done_continue', 'migrate: สถานะ continue ต้องแปลงเป็น done_continue');
  assert.strictEqual(w4.eval('state.review["PD69-05"].decision'), 'carry', 'migrate: ผลทบทวนต้องอยู่ครบ');
  assert.ok(w4.eval('cur.tis') && w4.eval('cur.base.year') === 'จปฐ. 2569', 'migrate: ข้อมูลขั้น ① ต้องอยู่');
  assert.strictEqual(w4.document.querySelector('#venueBox').value, 'ข้อมูลเวทีที่บันทึกแบบเดิม', 'migrate: ข้อมูลขั้น ② ต้องอยู่');
  assert.deepStrictEqual(J(w4, 'prj.extra.map(x => x.name)'), ['โครงการที่เพิ่มแบบเดิม'], 'migrate: ข้อมูลขั้น ③ ต้องอยู่');
  assert.strictEqual(w4.eval('bk.year'), '2570', 'migrate: ข้อมูลขั้น ④ ต้องอยู่');
  ['tambon-review:ป่าแดด:2569', 'tambon-review:last', 'tambon-current:ป่าแดด', 'tambon-analysis:last', 'tambon-projects:last', 'tambon-book:last']
    .forEach(k => assert.ok(w4.localStorage.getItem(k), 'migrate: ต้องไม่ลบ key เดิม ' + k));
  assert.ok(w4.localStorage.getItem('tambon-ws:migrated') && w4.localStorage.getItem('tambon-ws:' + ID_A), 'migrate: ต้องสร้างชุดข้อมูลใหม่และจดว่าย้ายแล้ว');
  // ย้ายครั้งเดียว: แก้ในแอปแล้ว key เดิมต้องไม่ถูกย้ายมาทับอีก
  w4.eval('bk.year = "2571"; wsSave()');
  assert.strictEqual(w4.eval('wsMigrate(); wsLoad(wsId); bk.year'), '2571', 'migrate: ต้องย้ายครั้งเดียว ไม่ทับงานใหม่');
  // ข้อมูลขั้น ② แบบเดิมเป็นคนละตำบล ต้องเตือน
  const w5 = boot(seedOld({ ...oldAna, comm: { tambon: 'ตำบลอื่น', capitals: {}, tisSwot: { S: [], W: [], O: [], T: [] }, projects: [], warnings: [] } })); await wait(100);
  assert.ok(/ไม่ตรงกับตำบลป่าแดด/.test(w5.document.querySelector('#wsFacts').textContent), 'migrate: ต้องเตือนเมื่อข้อมูลขั้น ② เป็นคนละตำบล');
  console.log('✓ ย้ายข้อมูลจากรูปแบบ :last ไม่หาย');

  // ===== รอบ UX 1: หน้าภาพรวม สถานะรายขั้น ปุ่มถัดไป ตัวบอกการบันทึก สำรองไฟล์ =====
  {
    const h = boot(null, ''); await wait(100); const hd = h.document;
    assert.ok(!hd.querySelector('#v-home').hidden, 'ux: เปิดเว็บโดยไม่มี hash ต้องเจอหน้าภาพรวม');
    assert.ok(/เริ่มต้นจัดทำแผนพัฒนาตำบล/.test(hd.querySelector('#home').textContent), 'ux: ยังไม่มีงานต้องแสดงคู่มือเริ่มต้น');
    assert.ok(hd.querySelector('#stepbar').hidden, 'ux: หน้าภาพรวมไม่มีแถบย้อนกลับ/ถัดไป');
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'empty', 'ux: ยังไม่มีงานต้องบอกว่ายังไม่มีอะไรให้บันทึก');
    h.location.hash = '#review'; await wait(30);
    assert.ok(/ยังไม่เริ่ม/.test(hd.querySelector('#sh-review').textContent), 'ux: ขั้น ⓪ ก่อนนำเข้าต้องเป็น “ยังไม่เริ่ม”');
    hd.querySelector('#loadSample').click(); await wait(30);
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'saved', 'ux: หลังบันทึกสำเร็จต้องบอกว่าบันทึกแล้ว');
    assert.ok(/บันทึกในเครื่องนี้แล้ว/.test(hd.querySelector('#saveState').textContent), 'ux: ต้องแสดงเวลาบันทึกล่าสุด');
    assert.ok(/กำลังดำเนินการ/.test(hd.querySelector('#tabReview').textContent) && /ยังไม่ระบุสถานะการดำเนินงาน 33 โครงการ/.test(hd.querySelector('#sh-review').textContent), 'ux: สถานะขั้น ⓪ ต้องคำนวณจากข้อมูลจริง');
    const next = [...hd.querySelectorAll('#stepbar a')].pop();
    assert.strictEqual(next.getAttribute('href'), '#current', 'ux: ปุ่มถัดไปของขั้น ⓪ ต้องไปขั้น ①');
    // พิมพ์ในช่องที่ยังไม่บันทึก → แจ้งว่ามีการแก้ไขที่ยังไม่บันทึก
    const ab = hd.querySelector('#aiBox'); ab.value += ' '; ab.dispatchEvent(new h.Event('input', { bubbles:true }));
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'dirty', 'ux: พิมพ์แล้วยังไม่บันทึกต้องแจ้ง');
    // ช่องที่บันทึกทันที (ข้อมูลเวที) ต้องกลับเป็นบันทึกแล้ว
    h.location.hash = '#analysis'; await wait(30);
    const vb = hd.querySelector('#venueBox'); vb.value = 'ทดสอบเวที'; vb.dispatchEvent(new h.Event('input', { bubbles:true }));
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'saved', 'ux: ช่องที่บันทึกทันทีต้องขึ้นว่าบันทึกแล้ว');
    // บันทึกลงเครื่องไม่ได้ → ห้ามบอกว่าบันทึกแล้ว
    const realSet = h.Storage.prototype.setItem;
    h.Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    vb.value = 'ทดสอบเวที 2'; vb.dispatchEvent(new h.Event('input', { bubbles:true }));
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'error', 'ux: บันทึกไม่สำเร็จต้องแจ้งข้อผิดพลาด ไม่ใช่บอกว่าบันทึกแล้ว');
    h.Storage.prototype.setItem = realSet;
    vb.dispatchEvent(new h.Event('input', { bubbles:true }));
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'saved', 'ux: บันทึกได้อีกครั้งต้องกลับเป็นบันทึกแล้ว');
    // หน้าภาพรวมเมื่อมีงานแล้ว
    h.location.hash = '#home'; await wait(30);
    const home = hd.querySelector('#home').textContent;
    assert.ok(/ตำบลป่าแดด อำเภอแม่สรวย/.test(home) && /ทำต่อ: ⓪ ทบทวนแผนเดิม/.test(home), 'ux: ภาพรวมต้องบอกตำบลและขั้นที่ควรทำต่อ');
    const pv = +hd.querySelector('.progress .bar').getAttribute('aria-valuenow');
    assert.ok(pv > 0 && pv < 100, 'ux: ความคืบหน้าต้องมาจากสถานะจริง (ระหว่าง 0–100)');
    assert.strictEqual(hd.querySelectorAll('.step-card').length, 5, 'ux: ภาพรวมต้องมีการ์ด 5 ขั้น');
    // ลิงก์ “ไปที่จุดนี้” ต้องพาไปขั้นที่ถูก
    const go = hd.querySelector('#home .issues a.go'); assert.ok(go && go.getAttribute('href').startsWith('#'), 'ux: รายการที่ยังไม่ครบต้องมีลิงก์ไปแก้');
    // สำรองเป็นไฟล์ต้องดาวน์โหลดจริงบนเว็บทั่วไป (ไม่มี window.claude)
    let dlName = null; h.URL.createObjectURL = () => 'blob:test'; h.URL.revokeObjectURL = () => {};
    const realClick = h.HTMLAnchorElement.prototype.click;
    h.HTMLAnchorElement.prototype.click = function(){ if (this.download) dlName = this.download; };
    await h.eval('backupFile')();
    h.HTMLAnchorElement.prototype.click = realClick;
    assert.ok(dlName && /^แผนตำบล_ป่าแดด_2569_สำรอง_\d{4}-\d\d-\d\d\.json$/.test(dlName), 'ux: ปุ่มสำรองต้องดาวน์โหลดไฟล์ .json: ' + dlName);
    assert.ok(hd.querySelector('#exportBox').hidden, 'ux: ดาวน์โหลดได้แล้วต้องไม่แสดงกล่องข้อความแทน');
    assert.ok(!hd.querySelector('#saveBtn2') && !hd.querySelector('#saveBtn5'), 'ux: ปุ่ม .json ซ้ำในแต่ละขั้นต้องถูกรวมเป็นปุ่มเดียว');
    console.log('✓ หน้าภาพรวม สถานะรายขั้น ปุ่มถัดไป ตัวบอกการบันทึก สำรองไฟล์');
  }

  // ===== รอบ UX 2: ขั้นตอน AI, ค้นหา/กรอง/เรียง, รายการซ้ำ, ตรวจงบ, ผลนำเข้า Excel =====
  {
    const h = boot(); await wait(100); const hd = h.document;
    const ev2 = (el, type = 'change') => el.dispatchEvent(new h.Event(type, { bubbles: true }));
    // ข้อความผิดพลาดของคำตอบ AI ต้องบอกสาเหตุและวิธีแก้
    hd.querySelector('#aiBox').value = h.eval('PROMPT'); hd.querySelector('#checkBtn').click();
    assert.ok(/เป็น “คำสั่ง”/.test(hd.querySelector('#aiFacts').textContent), 'ai: วางคำสั่งแทนคำตอบต้องบอกให้รู้');
    hd.querySelector('#aiBox').value = '{"meta":{"tambon":"x"'; hd.querySelector('#checkBtn').click();
    assert.ok(/ถูกตัดกลาง/.test(hd.querySelector('#aiFacts').textContent), 'ai: คำตอบไม่ครบต้องบอกว่าถูกตัด');
    assert.ok(hd.querySelector('#aiRaw').open, 'ai: ยังไม่มีคำตอบที่ใช้ได้ ช่องวางต้องเปิดอยู่');
    hd.querySelector('#loadSample').click(); await wait(20);
    assert.ok(!hd.querySelector('#aiRaw').open && /รับคำตอบแล้ว/.test(hd.querySelector('#aiRaw summary').textContent), 'ai: ได้คำตอบแล้วต้องพับ JSON เก็บ');
    assert.strictEqual(hd.querySelectorAll('.aisteps').length, 3, 'ai: ขั้น ⓪ ② ③ ต้องมีขั้นตอน AI 4 ข้อ');
    assert.ok(hd.querySelectorAll('.aisteps')[0].querySelectorAll(':scope > li').length === 4 && hd.querySelector('#s2 details.example pre'), 'ai: ต้องมี 4 ข้อและตัวอย่างคำตอบ');
    // ⓪ ค้นหา กรอง เรียง รายการซ้ำ
    const q = hd.querySelector('#lfQ'); q.value = 'วิ่ง'; ev2(q, 'input'); await wait(200);
    assert.strictEqual(hd.querySelectorAll('#list .item').length, 2, 'list: ค้นหา “วิ่ง” ต้องเจอ 2 โครงการ');
    assert.ok(/อาจซ้ำกับลำดับ 11/.test(hd.querySelector('#list').textContent), 'list: ต้องเตือนชื่อเกือบซ้ำ (วิ่งเทล/วิ่งเทรล)');
    assert.ok(/แสดง 2 จาก 33/.test(hd.querySelector('#lfCount').textContent), 'list: ต้องบอกจำนวนที่แสดง');
    assert.strictEqual(hd.querySelector('#saveState').dataset.s, 'saved', 'list: พิมพ์ค้นหาไม่ใช่การแก้ข้อมูล ต้องไม่ขึ้นว่ายังไม่บันทึก');
    q.value = ''; ev2(q, 'input'); await wait(200);
    const so = hd.querySelector('#lfSort'); so.value = 'budget_desc'; ev2(so);
    assert.strictEqual(hd.querySelector('#list .item .no').textContent, '20', 'list: เรียงงบมากไปน้อย ลำดับแรกต้องเป็นเบี้ยยังชีพผู้สูงอายุ (ลำดับ 20)');
    so.value = 'no'; ev2(so);
    const s0 = hd.querySelector('.item select[data-act=status]'); s0.value = 'done'; ev2(s0);
    const st = hd.querySelector('#lfSt'); st.value = 'done'; ev2(st);
    assert.strictEqual(hd.querySelectorAll('#list .item').length, 1, 'list: กรองสถานะ “ทำแล้ว จบโครงการ” ต้องเหลือ 1');
    st.value = 'none'; ev2(st);
    assert.strictEqual(hd.querySelectorAll('#list .item').length, 32, 'list: กรอง “ยังไม่ระบุ” ต้องเหลือ 32');
    st.value = ''; ev2(st);
    assert.ok(hd.querySelector('.item .money .cell-lbl') && /สถานะการดำเนินงาน/.test(hd.querySelector('.item .status').textContent), 'list: แยกหัวข้องบประมาณกับสถานะการดำเนินงาน');
    assert.ok(hd.querySelector('.item details.more dl'), 'list: ต้องดูรายละเอียดรายโครงการได้');
    // งบที่กรอกเองต้องไม่ติดลบ
    const s2 = hd.querySelectorAll('.item select[data-act=status]')[1]; s2.value = 'done_continue'; ev2(s2);
    // ① ผลนำเข้า Excel
    h.location.hash = '#current'; await wait(30);
    await h.eval('readXls')(file(fx('tis_village_ranking_padaet_2569.xlsx')));
    const tf = hd.querySelector('#tisFacts').textContent;
    assert.ok(/นำเข้าสำเร็จ 22 หมู่บ้าน/.test(tf) && /ปีงบประมาณ 2569/.test(tf), 'excel: ต้องบอกจำนวนที่นำเข้าและปีของข้อมูล');
    assert.strictEqual(hd.querySelectorAll('#tisFacts table tbody tr').length, 22, 'excel: ต้องมีตารางให้ตรวจทีละหมู่บ้าน');
    const bad = h.eval('parseTisRows')([['ปีงบประมาณ 2570'], ['หมู่ที่', 'หมู่บ้าน', 'อันดับที่ 1', 'อันดับที่ 2', 'อันดับที่ 3', 'อันดับที่ 4', 'อันดับที่ 5'], ['', 'บ้านไม่มีเลขหมู่', 'ด้านเศรษฐกิจและอาชีพ', '', '', '', '']]);
    assert.ok(bad.skipped.length === 1 && /ไม่มีเลขหมู่/.test(bad.skipped[0].reason), 'excel: แถวที่อ่านไม่ได้ต้องบอกเหตุผล');
    // ③ ค้นหา กรอง สรุปงบ ตรวจงบ โครงการซ้ำ
    h.location.hash = '#projects'; await wait(30);
    hd.querySelector('#nName').value = 'ธนาคารขยะชุมชน'; hd.querySelector('#nBudget').value = '20000'; hd.querySelector('#addPj').click();
    hd.querySelector('#nName').value = 'ธนาคารขยะชุมชน.'; hd.querySelector('#addPj').click();
    assert.ok(/อาจเป็นโครงการซ้ำ/.test(hd.querySelector('#pjList').textContent), 'pj: ต้องเตือนโครงการชื่อซ้ำ');
    const nPj = hd.querySelectorAll('#pjList .pj').length;
    assert.ok(nPj === 3 && /งบรวม/.test(hd.querySelector('#pjSum').textContent) && new RegExp(`^${nPj} โครงการ`).test(hd.querySelector('#pjSum').textContent), 'pj: ต้องสรุปจำนวนและงบรวม (ยกมา 1 + เพิ่มเอง 2)');
    const pq = hd.querySelector('#pfQ'); pq.value = 'ธนาคาร'; ev2(pq, 'input'); await wait(200);
    assert.strictEqual(hd.querySelectorAll('#pjList .pj').length, 2, 'pj: ค้นหาต้องกรองรายการ');
    assert.ok(hd.querySelector('#pjList button[data-act=up]').disabled, 'pj: ระหว่างกรองต้องปิดปุ่มเลื่อนลำดับ');
    pq.value = ''; ev2(pq, 'input'); await wait(200);
    const pb = hd.querySelector('#pfBudget'); pb.value = 'none'; ev2(pb);
    assert.ok([...hd.querySelectorAll('#pjList .pj input[data-f=budget]')].every(i => i.value === ''), 'pj: กรอง “ยังไม่กำหนดงบ” ต้องเหลือเฉพาะที่ไม่มีงบ');
    pb.value = ''; ev2(pb);
    const bIn = [...hd.querySelectorAll('#pjList .pj')].find(x => x.querySelector('input[data-f=name]').value === 'ธนาคารขยะชุมชน').querySelector('input[data-f=budget]');
    bIn.value = '-500'; ev2(bIn);
    assert.ok(/ตั้งแต่ 0 ขึ้นไป/.test(hd.querySelector('#toast').textContent), 'pj: งบติดลบต้องเตือน');
    assert.strictEqual(h.eval('prj.extra.find(x => x.name === "ธนาคารขยะชุมชน").budget'), 20000, 'pj: งบติดลบต้องไม่ถูกบันทึก');
    console.log('✓ ขั้นตอน AI 4 ข้อ ค้นหา/กรอง/เรียง รายการซ้ำ ตรวจงบ ผลนำเข้า Excel');
  }

  assert.deepStrictEqual(errs, [], 'ต้องไม่มี error ในหน้า');
  console.log('ผ่านทั้งหมด'); process.exit(0);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
