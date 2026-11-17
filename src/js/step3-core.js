// step3-core.js — ③ ตรรกะล้วน: Prompt #2, ตรวจคำตอบ, ตรวจความครบถ้วนของแผน
// ---- step 3 core ----
const FORM_DIMS = ['เศรษฐกิจ','สังคม','ทรัพยากรธรรมชาติและสิ่งแวดล้อม','ความมั่นคง','บริหารจัดการ'];
const METHODS = ['ทำเอง','ทำร่วม','หน่วยงานอื่นทำให้'];
const NEEDS_SUPPORT = m => m === 'ทำร่วม' || m === 'หน่วยงานอื่นทำให้';
const SINGLE_VILLAGE = t => /^\s*(ม\.?|หมู่(ที่)?)\s*\d+\s*$/.test(String(t||''));
function buildPrompt2(ctx){
  // ctx: {meta, part2, carried:[{name,budget,dim,method,target}], venue:[...], taxonomy:[{code,issue,name}]}
  const p2 = ctx.part2 || {};
  const sw = ['S','W','O','T'].map(k => (p2.swot?.[k]||[]).map(i => `${i.id}: ${i.text}`).join('\n')).join('\n');
  const tows = (p2.tows||[]).map(t => `${t.id} (${t.type}): ${t.text||''}`).join('\n');
  const st = (p2.strategies||[]).map(s => `ยุทธศาสตร์ ${s.no}: ${s.name}${s.from?.length ? ' (มาจาก ' + s.from.join(', ') + ')' : ''}`).join('\n');
  const car = (ctx.carried||[]).map((c,i) => `- ${c.name} | ด้าน${c.dim||'?'} | ${c.method||'?'} | งบ ${c.budget ?? '?'}`).join('\n') || '- (ไม่มี)';
  const ven = (ctx.venue||[]).map((v,i) => `V${i+1}: ${v}`).join('\n') || '(ไม่มี)';
  const tax = (ctx.taxonomy||[]).map(t => `${t.code}: ${t.name}`).join('\n');
  return `คุณคือผู้ช่วยวางแผนโครงการของแผนพัฒนาตำบล${ctx.meta?.tambon||''} อำเภอ${ctx.meta?.amphoe||''} จังหวัดเชียงราย ช่วยเสนอ “โครงการใหม่” ให้เวทีประชาคมพิจารณา ตามแนวทางการจัดทำแผนพัฒนาตำบลปี 2570

## กติกาบังคับ
1. เสนอโครงการใหม่เฉพาะยุทธศาสตร์ที่ยังมีโครงการรองรับไม่พอ ยุทธศาสตร์ละ 1 ถึง 3 โครงการ ห้ามซ้ำหรือใกล้เคียงกับโครงการที่ยกมาจากแผนเดิม
2. โครงการต้องแก้ปัญหาร่วมที่กระทบหลายหมู่บ้าน ห้ามนำแผนหมู่บ้านมาเรียงต่อกัน
3. แต่ละโครงการระบุยุทธศาสตร์ (strategy_no) และกลยุทธ์ TOWS ที่รองรับ (tows) จากรายการด้านล่างเท่านั้น
4. วิธีดำเนินการเลือกจาก ทำเอง, ทำร่วม, หน่วยงานอื่นทำให้ ให้คิดก่อนว่าชุมชนทำเองได้หรือไม่ ใช้ทุนชุมชนที่มีอยู่ ถ้าทำเองได้ให้เลือก ทำเอง
5. ห้ามกำหนดงบประมาณ ให้ใส่ budget เป็น null เวทีจะกำหนดเอง
6. form_dimension เลือกจาก ${FORM_DIMS.join(', ')}
7. ตอบเป็น JSON อย่างเดียว ไม่มีคำอธิบาย ไม่มี \`\`\`

## โครงสร้าง JSON
{"projects":[{"name":"","strategy_no":1,"tows":["SO1"],"form_dimension":"","method":"","target":"","detail":"","why":""}]}

## SWOT
${sw}

## TOWS
${tows}

## ยุทธศาสตร์ (ข้อ 2.5)
${st}

## โครงการที่ยกมาจากแผนเดิม (ห้ามเสนอซ้ำ)
${car}

## ข้อมูลจากเวทีประชาคม
${ven}`;
}
function validateAnswer2(ans, ctx){
  const out = { errors:[], warns:[], projects:[] };
  const strat = new Set((ctx.part2?.strategies||[]).map(s => Number(s.no)));
  const tows = new Set((ctx.part2?.tows||[]).map(t => t.id));
  const codes = new Set((ctx.taxonomy||[]).map(t => t.code));
  if (/[฻๚๛]/.test(JSON.stringify(ans))) out.errors.push('พบตัวอักษรเพี้ยนในคำตอบ');
  (ans?.projects||[]).forEach((p,i) => {
    const f = [];
    if (!strat.has(Number(p.strategy_no))) f.push(['bad', `ยุทธศาสตร์ ${p.strategy_no} ไม่มีอยู่จริง`]);
    const badT = (p.tows||[]).filter(t => !tows.has(t)); if (badT.length) f.push(['bad', 'อ้างกลยุทธ์ที่ไม่มี: ' + badT.join(', ')]);
    if (!FORM_DIMS.includes(p.form_dimension)) f.push(['warn', 'ด้านไม่ตรงแบบฟอร์ม']);
    if (!METHODS.includes(p.method)) f.push(['warn', 'วิธีดำเนินการไม่ตรงตัวเลือก']);
    if (p.provincial_code && !codes.has(p.provincial_code)) f.push(['bad', `รหัสแผนจังหวัด ${p.provincial_code} ไม่มีอยู่จริง`]);
    if (p.budget !== null && p.budget !== undefined) f.push(['info', 'AI ใส่งบประมาณมาเอง แอปไม่นำไปใช้ เวทีต้องกำหนดเอง']);
    out.projects.push(Object.assign({}, p, { flags: f }));
    f.filter(x => x[0]==='bad').forEach(x => out.errors.push(`โครงการ “${p.name}”: ${x[1]}`));
  });
  if (!(ans?.projects||[]).length) out.errors.push('ไม่มีรายการโครงการในคำตอบ');
  return out;
}
function checkPlan(items, ctx){
  const out = { bad:[], warn:[], info:[], perItem:{} };
  const codes = new Set((ctx.taxonomy||[]).map(t => t.code));
  const strategies = ctx.part2?.strategies || [];
  items.forEach(it => {
    const f = [];
    if (!String(it.name||'').trim()) f.push(['bad','ยังไม่มีชื่อโครงการ']);
    if (it.budget === null || it.budget === undefined || it.budget === '') f.push(['warn','ยังไม่กำหนดงบประมาณ']);
    else if (!(Number.isFinite(Number(it.budget)) && Number(it.budget) >= 0)) f.push(['bad','งบประมาณไม่ถูกต้อง ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป']);
    else if (!Number.isInteger(Number(it.budget))) f.push(['warn','งบประมาณมีทศนิยม ตรวจว่าพิมพ์ถูกหรือไม่ (ใช้จำนวนเต็มบาท)']);
    if (!it.dim) f.push(['warn','ยังไม่ระบุด้าน']);
    if (!it.method) f.push(['warn','ยังไม่ระบุวิธีดำเนินการ']);
    if (strategies.length && !it.strategy) f.push(['warn','ยังไม่ระบุยุทธศาสตร์ที่รองรับ']);
    if (/เบี้ยยังชีพ/.test(it.name||'')) f.push(['info','สวัสดิการตามกฎหมายที่ อปท. จ่ายอยู่แล้ว ควรตกลงแนวปฏิบัติว่าจะนับรวมในแผนหรือไม่']);
    out.perItem[it.uid] = f;
  });
  // ชื่อโครงการเกือบซ้ำกัน (ใช้ sim() จากขั้น ⓪ ถ้ามี)
  if (typeof sim === 'function') for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++){
    if (sim(items[i].name || '', items[j].name || '') >= .85){
      out.perItem[items[i].uid].push(['warn', `ชื่อคล้ายกับ “${items[j].name}” อาจเป็นโครงการซ้ำ`]);
      out.perItem[items[j].uid].push(['warn', `ชื่อคล้ายกับ “${items[i].name}” อาจเป็นโครงการซ้ำ`]);
    }
  }
  const n = items.length;
  if (!n){ out.warn.push('ยังไม่มีโครงการในแผนใหม่'); return out; }
  strategies.forEach(s => { if (!items.some(it => String(it.strategy) === String(s.no))) out.warn.push(`ยุทธศาสตร์ ${s.no} “${s.name}” ยังไม่มีโครงการรองรับ`); });
  const single = items.filter(it => SINGLE_VILLAGE(it.target)).length;
  if (single / n > 0.5) out.warn.push(`${single} จาก ${n} โครงการมีเป้าหมายหมู่บ้านเดียว แนวทางปี 2570 ไม่ให้นำแผนหมู่บ้านมาเรียงต่อกัน`);
  const byM = m => items.filter(it => it.method === m).length;
  if (!byM('ทำเอง')) out.info.push('ยังไม่มีโครงการที่ชุมชนทำเอง แนวทางให้แบ่งเป็นทำเอง ทำร่วม และขอรับการสนับสนุน');
  const bad = Object.values(out.perItem).flat().filter(x => x[0]==='bad').length;
  const warn = Object.values(out.perItem).flat().filter(x => x[0]==='warn').length;
  if (bad) out.bad.push(`มี ${bad} จุดที่ผิด ต้องแก้ก่อนส่งออก`);
  if (warn) out.warn.push(`มี ${warn} จุดที่ยังไม่ครบ`);
  return out;
}
function priorityOrder(items){
  return items.slice();
}


