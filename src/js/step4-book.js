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
  const D = bookData(), f = [];
  const b = D.base;
  f.push([b.total && b.households ? 'ok' : 'warn', `ส่วนที่ 1: ${b.total ? 'มีจำนวนประชากรและครัวเรือน' : 'ยังไม่มีจำนวนประชากร'} ส่วนอื่นของส่วนที่ 1 (แผนที่ อาณาเขต อาชีพ กลุ่ม กองทุน ฯลฯ) ต้องเติมใน Word`]);
  const sw = D.swot || {}; const nsw = ['S','W','O','T'].reduce((s,k) => s + (sw[k]||[]).length, 0);
  const verr = ana.validation?.errors?.length || 0;
  f.push([nsw ? (verr ? 'warn' : 'ok') : 'warn', nsw ? `ส่วนที่ 2.1–2.2: SWOT ${nsw} ข้อ${verr ? ` ยังมีจุดผิด ${verr} จุดในขั้น ②` : ''}` : 'ส่วนที่ 2.1–2.2: ยังไม่มี SWOT จากขั้น ②']);
  f.push([D.tisOrder ? 'ok' : 'warn', D.tisOrder ? `ส่วนที่ 2.3: ใช้ผลการจัดลำดับจาก TIS ${D.tisN} หมู่บ้าน` : 'ส่วนที่ 2.3: ยังไม่ได้นำเข้ารายงาน TIS ในขั้น ①']);
  f.push([D.direction && D.strategies?.length ? 'ok' : 'warn', D.direction ? `ส่วนที่ 2.4–2.5: มีทิศทางและกลยุทธ์ ${D.strategies?.length || 0} ข้อ` : 'ส่วนที่ 2.4–2.5: ยังไม่มีจากขั้น ②']);
  f.push(['warn','ตารางการวิเคราะห์ปัญหาของตำบล: แอปยังไม่สร้างให้ ต้องเติมจากเวที']);
  const chk = checkPlan(D.items, part2Ctx());
  f.push([D.items.length ? (chk.bad.length || chk.warn.length ? 'warn' : 'ok') : 'warn', D.items.length ? `ส่วนที่ 3: ${D.items.length} โครงการ${chk.bad.concat(chk.warn).length ? ' ' + chk.bad.concat(chk.warn).join(' ') : ''}` : 'ส่วนที่ 3: ยังไม่มีโครงการ']);
  f.push([bk.rdate && bk.rres ? 'ok' : 'warn', bk.rdate ? 'ส่วนที่ 4: มีบันทึกการทบทวน' : 'ส่วนที่ 4: ยังไม่ได้กรอกข้อมูลการประชุมทบทวนในข้อ ก']);
  f.push(['info', `ส่วนที่ 5: แอปใส่แหล่งข้อมูลที่ใช้ ${D.sources.length} แหล่ง และสรุปผลทบทวนแผนเดิมให้ ช่วยตอบเกณฑ์ข้อ 3.3 ของแบบประเมินอำเภอ`]);
  f.push(['info','ภาคผนวก: รายชื่อผู้สูงอายุและคนพิการต้องแนบเองนอกระบบ แอปไม่บันทึกข้อมูลส่วนบุคคล']);
  if (!window.docx) f.unshift(['bad','โหลดตัวสร้างไฟล์ Word ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่']);
  facts($('#bookFacts'), f);
}
$('#bookForm').addEventListener('input', e => { const k = e.target.dataset.bk; if (!k) return; bk[k] = e.target.value; bkPersist(); clearTimeout(renderBook._t); renderBook._t = setTimeout(() => { const a = document.activeElement?.dataset?.bk; renderBook(); if (a){ const el = document.querySelector(`[data-bk="${a}"]`); if (el){ el.focus(); const v = el.value; if (el.type === 'text') el.setSelectionRange(v.length, v.length); } } }, 600); });
$('#dlBook').addEventListener('click', async () => {
  if (!window.docx){ $('#bookNote').textContent = 'โหลดตัวสร้างไฟล์ Word ไม่สำเร็จ'; return; }
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

