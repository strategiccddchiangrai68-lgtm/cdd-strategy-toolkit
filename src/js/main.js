// main.js — ผูกปุ่มของแถบตำบลและเริ่มแอป (ต้องโหลดเป็นไฟล์สุดท้าย)
$('#wsSel').addEventListener('change', e => wsSwitch(e.target.value));
$('#wsNew').addEventListener('click', wsNew);
$('#wsOpen').addEventListener('click', () => $('#wsFile').click());
$('#wsFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await wsOpenFile(f); });

wsMigrate();
{ const a = lsGet(WS_ACTIVE); wsLoad(a && lsGet(WS + a) ? a : WS_DRAFT); }
