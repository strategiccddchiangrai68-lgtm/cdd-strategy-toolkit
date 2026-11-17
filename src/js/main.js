// main.js — ผูกปุ่มของแถบตำบลและเริ่มแอป (ต้องโหลดเป็นไฟล์สุดท้าย)
$('#wsSel').addEventListener('change', e => wsSwitch(e.target.value));
$('#wsNew').addEventListener('click', wsNew);
$('#wsOpen').addEventListener('click', () => $('#wsFile').click());
$('#wsFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await wsOpenFile(f); });
$('#wsBackup').addEventListener('click', backupFile);
// มีการพิมพ์ที่ยังไม่ถูกบันทึก: ฟังแบบ capture จึงทำงานก่อนตัวบันทึกของช่องนั้น ถ้าช่องนั้นบันทึกทันที สถานะจะกลับเป็น “บันทึกแล้ว”
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.matches('input, textarea, select') || el.type === 'file' || el.id === 'wsSel' || el.readOnly || el.closest('[data-nosave]')) return;
  setSaveState('dirty');
}, true);
window.addEventListener('beforeunload', e => { if (saveState === 'dirty' || saveState === 'error'){ e.preventDefault(); e.returnValue = ''; } });

wsMigrate();
{ const a = lsGet(WS_ACTIVE); wsLoad(a && lsGet(WS + a) ? a : WS_DRAFT); }
