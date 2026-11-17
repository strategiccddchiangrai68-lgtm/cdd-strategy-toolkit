// main.js — ผูกปุ่มของแถบตำบลและเริ่มแอป (ต้องโหลดเป็นไฟล์สุดท้าย)
$('#wsSel').addEventListener('change', e => wsSwitch(e.target.value));
$('#wsNew').addEventListener('click', wsNew);
$('#wsOpen').addEventListener('click', () => $('#wsFile').click());
$('#wsFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await wsOpenFile(f); });
$('#wsBackup').addEventListener('click', backupFile);
$('#bookBackup').addEventListener('click', backupFile);
// เมนู “จัดการงาน” (สำรอง/เปิดไฟล์ .json): เปิด-ปิดด้วยคลิก, Esc, คลิกนอกเมนู, ลูกศรขึ้นลงเลือกรายการ
function setWsMenu(open, focusFirst){
  $('#wsMenu').hidden = !open; $('#wsMenuBtn').setAttribute('aria-expanded', String(open));
  if (open && focusFirst) $('#wsMenu [role=menuitem]').focus();
}
$('#wsMenuBtn').addEventListener('click', () => setWsMenu($('#wsMenu').hidden, true));
$('#wsMenu').addEventListener('click', e => { if (e.target.closest('[role=menuitem]')) setWsMenu(false); });
document.addEventListener('click', e => { if (!$('#wsMenu').hidden && !e.target.closest('.wsmenu')) setWsMenu(false); });
$('#wsMenu').addEventListener('keydown', e => {
  const items = [...$('#wsMenu').querySelectorAll('[role=menuitem]')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape'){ e.preventDefault(); setWsMenu(false); $('#wsMenuBtn').focus(); }
  if (e.key === 'ArrowDown'){ e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp'){ e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
});
// มีการพิมพ์ที่ยังไม่ถูกบันทึก: ฟังแบบ capture จึงทำงานก่อนตัวบันทึกของช่องนั้น ถ้าช่องนั้นบันทึกทันที สถานะจะกลับเป็น “บันทึกแล้ว”
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.matches('input, textarea, select') || el.type === 'file' || el.id === 'wsSel' || el.readOnly || el.closest('[data-nosave]')) return;
  setSaveState('dirty');
}, true);
window.addEventListener('beforeunload', e => { if (saveState === 'dirty' || saveState === 'error'){ e.preventDefault(); e.returnValue = ''; } });

wsMigrate();
{ const a = lsGet(WS_ACTIVE); wsLoad(a && lsGet(WS + a) ? a : WS_DRAFT); }
