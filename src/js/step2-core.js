// step2-core.js — ② ตรรกะล้วน: อ่านรายงานทุนชุมชน, ตรวจ SWOT ของ TIS, รหัสหลักฐาน, Prompt #1 และการตรวจคำตอบ
// ---- step 2 core ----
const CAP_TYPES = [['CH','ทุนมนุษย์'],['CS','ทุนสังคม'],['CF','ทุนเงิน'],['CP','ทุนกายภาพ'],['CN','ทุนธรรมชาติ']];
function cleanThai(s){ return String(s||'').replace(/เื้อ/g,'เอื้อ').replace(/หมุ่/g,'หมู่').replace(/\s+/g,' ').trim(); }
function splitNumbered(s){ return String(s||'').split(/\n?\s*\d+\)\s*/).map(x => cleanThai(x)).filter(Boolean); }
function parseCommunityRows(rows){
  const flat = r => r.map(c => String(c ?? '')).join(' ');
  const out = { year:null, tambon:null, amphoe:null, capitals:{}, tisSwot:{S:[],W:[],O:[],T:[]}, population:null, projects:[], warnings:[] };
  for (const r of rows.slice(0,4)){
    const s = flat(r);
    const y = s.match(/ปีงบประมาณ\s*(\d{4})/); if (y) out.year = +y[1];
    const l = s.match(/อำเภอ\s*(\S+)\s*ตำบล\s*(\S+)/); if (l){ out.amphoe = l[1]; out.tambon = l[2]; }
  }
  const hi = rows.findIndex(r => r.some(c => /^\s*ทุนชุมชน\s*$/.test(String(c))) && r.some(c => /SWOT/.test(String(c))));
  if (hi < 0){ out.warnings.push('ไม่พบหัวตาราง “ทุนชุมชน” และ “SWOT” ไฟล์นี้อาจไม่ใช่รายงานผลการวิเคราะห์ข้อมูลชุมชน'); return out; }
  const H = rows[hi].map(c => String(c ?? '')), H2 = (rows[hi+1]||[]).map(c => String(c ?? ''));
  const col = (arr, re) => arr.findIndex(c => re.test(c));
  const cCap = col(H, /^\s*ทุนชุมชน\s*$/), cS = col(H2,/จุดแข็ง/), cW = col(H2,/จุดอ่อน/), cO = col(H2,/โอกาส/), cT = col(H2,/อุปสรรค/);
  const cM = col(H2,/^\s*ชาย\s*$/), cF = col(H2,/^\s*หญิง\s*$/), cP = col(H,/แผนงานโครงการ/), cB = col(H,/งบประมาณ/);
  const data = rows.slice(hi+2);
  const r0 = data.find(r => String(r[cCap] ?? '').trim()) || [];
  const capText = String(r0[cCap] ?? '');
  const blocks = capText.split(/\n?\s*\d\)\s*(?=ทุน)/).filter(b => b.trim());
  for (const b of blocks){
    const [head, ...rest] = b.split('\n');
    const type = CAP_TYPES.find(t => cleanThai(head).startsWith(t[1]));
    if (!type) continue;
    const seen = new Map();
    rest.map(x => x.trim()).filter(x => x.startsWith('-')).map(x => cleanThai(x.replace(/^-+/,''))).filter(Boolean)
      .forEach(x => seen.set(x, (seen.get(x)||0) + 1));
    out.capitals[type[0]] = [...seen.entries()].map(([text,n]) => ({ text, n }));
  }
  if (!Object.keys(out.capitals).length) out.warnings.push('อ่านทุนชุมชนไม่ได้');
  out.tisSwot = { S: splitNumbered(r0[cS]), W: splitNumbered(r0[cW]), O: splitNumbered(r0[cO]), T: splitNumbered(r0[cT]) };
  if (cM >= 0 && cF >= 0 && r0[cM] !== '') out.population = { male: Number(r0[cM]), female: Number(r0[cF]) };
  data.forEach(r => { if (cP >= 0 && String(r[cP] ?? '').trim()) out.projects.push({ name: cleanThai(r[cP]), budget: Number(r[cB]) || null }); });
  return out;
}
function tisSwotIssues(ts, ctx){
  const iss = [];
  const norm = s => s.replace(/\s/g,'');
  ts.T.forEach((t,i) => { const j = ts.W.findIndex(w => norm(w) === norm(t)); if (j >= 0) iss.push(`อุปสรรค ${i+1} เป็นข้อความเดียวกับจุดอ่อน ${j+1} (ปัจจัยภายในถูกใส่เป็นอุปสรรค)`); });
  const internalO = ts.O.filter(o => /^มีโอกาสใน|^ชุมชนสามารถ/.test(o)).length;
  if (internalO) iss.push(`โอกาส ${internalO} ข้อเป็นสิ่งที่ชุมชนอยากทำ ไม่ใช่ปัจจัยภายนอก`);
  const occ = ctx.occupation || '';
  if (ts.W.some(w => /ไม่มีการทำนา/.test(w)) && /นา|เกษตร/.test(occ)) iss.push('จุดอ่อน “ไม่มีการทำนา ทำไร่ และทำสวน” ขัดกับแผนเดิมที่ระบุว่าทำนาและเกษตรเป็นอาชีพหลัก');
  if (ctx.popTotal && ctx.tisPop){ const r = (ctx.tisPop.male + ctx.tisPop.female) / ctx.popTotal; if (r > 1.5 || r < 0.67) iss.push(`ประชากรใน TIS (${(ctx.tisPop.male+ctx.tisPop.female).toLocaleString('en-US')}) ต่างจากข้อมูลพื้นฐาน (${ctx.popTotal.toLocaleString('en-US')}) ประมาณ ${r.toFixed(1)} เท่า อย่าใช้ตัวเลขนี้จนกว่าจะสอบถามทีม TIS`); }
  return iss;
}
function buildEvidence(ctx){
  // ctx: {community, plan:{S,W,O,T,problems}, ranking:{stats,n}, projects:[{no,name,budget,status,reason,decision}], venue:[...], taxonomy:[{code,issue,name}]}
  const ev = [];
  const add = (code, group, text, extra) => ev.push(Object.assign({ code, group, text }, extra||{}));
  const c = ctx.community;
  if (c){
    CAP_TYPES.forEach(([k,label]) => (c.capitals[k]||[]).forEach((x,i) => add(`${k}${i+1}`, label, x.text)));
    [['S','จุดแข็ง'],['W','จุดอ่อน'],['O','โอกาส'],['T','อุปสรรค']].forEach(([k,l]) => (c.tisSwot[k]||[]).forEach((x,i) => add(`X${k}${i+1}`, `SWOT จาก TIS (${l}) ต้องตรวจ`, x, { weak:true })));
  }
  const p = ctx.plan || {};
  [['S','strengths','จุดแข็ง'],['W','weaknesses','จุดอ่อน'],['O','opportunities','โอกาส'],['T','threats','อุปสรรค']].forEach(([k,f,l]) => (p[f]||[]).forEach((x,i) => add(`P${k}${i+1}`, `SWOT แผนเดิม (${l})`, cleanThai(x))));
  (p.problems||[]).forEach((x,i) => add(`PP${i+1}`, 'ปัญหาในแผนเดิม', cleanThai(x.name)));
  if (ctx.ranking){
    ctx.ranking.order.forEach((o,i) => add(`R${i+1}`, 'การจัดลำดับของหมู่บ้านใน TIS', `${o.dim}: อันดับ 1 จาก ${o.counts[0]} หมู่บ้าน อันดับเฉลี่ย ${o.avg.toFixed(2)} (จาก ${ctx.ranking.n} หมู่บ้าน)`));
  }
  (ctx.projects||[]).forEach(pj => add(`PJ${String(pj.no).padStart(2,'0')}`, 'ผลทบทวนโครงการแผนเดิม', `${pj.name} งบ ${pj.budget ?? '?'} บาท สถานะ: ${pj.status || 'ยังไม่ระบุ'}${pj.reason ? ' เหตุผล: '+pj.reason : ''}`));
  (ctx.venue||[]).forEach((v,i) => add(`V${i+1}`, 'ข้อมูลจากเวทีประชาคม', v, { external:true }));
  (ctx.taxonomy||[]).forEach(t => add(`CR-${t.code}`, 'แผนพัฒนาจังหวัดเชียงราย 2571-2575', `${t.issue} / ${t.name}`, { external:true }));
  return ev;
}
const EXTERNAL = code => /^(CR-|V)/.test(code);
function validateAnswer1(ans, ev){
  const codes = new Set(ev.map(e => e.code));
  const res = { errors:[], warns:[], infos:[], items:{} };
  if (/[฻๚๛]/.test(JSON.stringify(ans))) res.errors.push('พบตัวอักษรเพี้ยนในคำตอบ');
  const sw = ans?.swot || {};
  const ids = new Map();
  ['S','W','O','T'].forEach(k => {
    const arr = sw[k] || [];
    if (arr.length < 3 || arr.length > 10) res.warns.push(`${k} มี ${arr.length} ข้อ (ควรอยู่ระหว่าง 3 ถึง 10 ข้อ)`);
    arr.forEach((it, i) => {
      const id = it.id || `${k}${i+1}`; ids.set(id, k);
      const evs = Array.isArray(it.evidence) ? it.evidence : [];
      const bad = evs.filter(c => !codes.has(c));
      const flags = [];
      if (!evs.length) flags.push(['warn','ไม่มีหลักฐาน ต้องหาหลักฐานก่อนใช้']);
      if (bad.length) flags.push(['bad','อ้างรหัสที่ไม่มีอยู่จริง: ' + bad.join(', ')]);
      const good = evs.filter(c => codes.has(c));
      if (good.length && good.every(c => /^X/.test(c))) flags.push(['warn','อ้าง SWOT จาก TIS อย่างเดียว ต้องมีหลักฐานอื่นยืนยัน']);
      if ((k==='O'||k==='T') && !good.some(EXTERNAL) && !good.some(c => /^P[OT]/.test(c))) flags.push(['warn','ปัจจัยภายนอกที่ยังไม่มีแหล่งภายนอกยืนยัน']);
      res.items[id] = { k, text: it.text, evidence: evs, flags };
      if (bad.length) res.errors.push(`${id} อ้างรหัสที่ไม่มีอยู่จริง (${bad.join(', ')})`);
    });
  });
  const tows = ans?.tows || [];
  const towsIds = new Set();
  tows.forEach(t => {
    towsIds.add(t.id);
    const type = String(t.type || '').toUpperCase();
    const pair = t.pair || [];
    const kinds = pair.map(p => ids.get(p));
    if (pair.some(p => !ids.has(p))) res.errors.push(`${t.id} อ้างข้อ SWOT ที่ไม่มี (${pair.filter(p=>!ids.has(p)).join(', ')})`);
    else if (type.length === 2 && !(kinds.includes(type[0]) && kinds.includes(type[1]))) res.errors.push(`${t.id} เป็นกลยุทธ์ ${type} แต่จับคู่ ${pair.join('+')}`);
  });
  ['SO','WO','ST','WT'].forEach(q => { if (!tows.some(t => String(t.type).toUpperCase() === q)) res.warns.push(`ยังไม่มีกลยุทธ์ ${q}`); });
  const used = new Set();
  (ans?.strategies || []).forEach(s => { (s.from||[]).forEach(f => { used.add(f); if (!towsIds.has(f)) res.errors.push(`ยุทธศาสตร์ “${s.name}” อ้างกลยุทธ์ ${f} ที่ไม่มีใน TOWS`); }); if (!(s.from||[]).length) res.warns.push(`ยุทธศาสตร์ “${s.name}” ไม่ได้อ้างกลยุทธ์ TOWS`); });
  const unused = [...towsIds].filter(t => !used.has(t));
  if (unused.length) res.infos.push('กลยุทธ์ที่ยังไม่ถูกใช้ในข้อ 2.5: ' + unused.join(', '));
  if (!ans?.direction) res.warns.push('ยังไม่มีทิศทาง/เป้าหมายการพัฒนา (2.4)');
  const noEv = Object.values(res.items).filter(i => !i.evidence.length).length;
  const weakOnly = Object.values(res.items).filter(i => i.flags.some(f => f[1].startsWith('อ้าง SWOT จาก TIS'))).length;
  if (noEv) res.warns.push(`${noEv} ข้อไม่มีหลักฐาน`);
  if (weakOnly) res.warns.push(`${weakOnly} ข้ออ้าง SWOT จาก TIS อย่างเดียว`);
  return res;
}
function buildPrompt1(ev, meta){
  const groups = {};
  ev.forEach(e => { (groups[e.group] = groups[e.group] || []).push(`${e.code}: ${e.text}`); });
  const evText = Object.entries(groups).map(([g, l]) => `### ${g}\n` + l.join('\n')).join('\n\n');
  return `คุณคือนักวิเคราะห์ยุทธศาสตร์การพัฒนาชุมชน ช่วยร่าง “ส่วนที่ 2 การวิเคราะห์ข้อมูล” ของแผนพัฒนาตำบล${meta.tambon||''} อำเภอ${meta.amphoe||''} จังหวัด${meta.changwat||'เชียงราย'} ตามแบบฟอร์มรูปเล่มแผนพัฒนาตำบล (ข้อ 2.1, 2.2, 2.4, 2.5) โดยใช้เฉพาะหลักฐานด้านล่าง

## กติกาบังคับ
1. ทุกข้อ SWOT ต้องอ้างรหัสหลักฐานจากรายการด้านล่างอย่างน้อย 1 รหัส ห้ามแต่งรหัสหรือข้อเท็จจริงที่ไม่มีในหลักฐาน ถ้าคิดว่าควรมีข้อใดแต่ไม่มีหลักฐาน ให้ใส่ evidence เป็น [] (ระบบจะติดป้าย “ต้องหาหลักฐาน”)
2. รหัสที่ขึ้นต้นด้วย X เป็น SWOT ที่ระบบ TIS สร้าง ความน่าเชื่อถือต่ำ บางข้อขัดกับข้อมูลจริง ห้ามใช้เป็นหลักฐานเพียงอย่างเดียว และห้ามคัดลอกข้อที่ขัดกับหลักฐานอื่น
3. จุดแข็งและจุดอ่อน (ข้อ 2.1) เป็นปัจจัยภายในตำบล ส่วนโอกาสและอุปสรรค (ข้อ 2.2) ต้องเป็นปัจจัยภายนอกที่ตำบลควบคุมไม่ได้ เช่น นโยบาย แผนจังหวัด (รหัส CR-) ตลาด สภาพอากาศ ห้ามนำสิ่งที่ชุมชนอยากทำมาใส่เป็นโอกาส
4. ให้น้ำหนักกับหลักฐานที่หลายหมู่บ้านพูดตรงกัน (ทุนชุมชน C และการจัดลำดับ R) และข้อมูลจากเวที (V) มากกว่าข้อความในแผนเดิม
5. แต่ละด้านของ SWOT มี 4 ถึง 8 ข้อ เขียนกระชับ เจาะจงพื้นที่ ไม่ใช้คำกว้าง ๆ ที่ใช้ได้กับทุกตำบล
6. TOWS: สร้างกลยุทธ์ SO, WO, ST, WT ประเภทละ 2 ถึง 3 ข้อ แต่ละข้อระบุคู่ SWOT ที่ใช้ (pair) ให้ตรงประเภท เช่น SO ต้องมี S และ O
7. ข้อ 2.4 ทิศทาง/เป้าหมายการพัฒนาตำบล 1 ข้อความ และข้อ 2.5 ยุทธศาสตร์ 3 ถึง 5 ข้อ แต่ละข้อระบุว่ามาจากกลยุทธ์ TOWS ใด (from)
8. ยังไม่ต้องเสนอโครงการ
9. ตอบเป็น JSON อย่างเดียว ไม่มีคำอธิบาย ไม่มี \`\`\`

## โครงสร้าง JSON
{"swot":{"S":[{"id":"S1","text":"","evidence":["CN1"]}],"W":[],"O":[],"T":[]},
 "tows":[{"id":"SO1","type":"SO","pair":["S1","O1"],"text":""}],
 "direction":"",
 "strategies":[{"no":1,"name":"","detail":"","from":["SO1","WO1"]}]}

## หลักฐาน
${evText}`;
}


