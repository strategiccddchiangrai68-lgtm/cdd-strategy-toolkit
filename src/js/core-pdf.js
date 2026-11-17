// core-pdf.js — อ่านข้อความและตัวเลขงบจาก text layer ของ PDF (ไม่แตะ DOM)
// ---- shared core (also embedded in the HTML) ----
const TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
function normText(s){
  return String(s)
    .replace(/[๐-๙]/g, d => String(TH_DIGITS.indexOf(d)))
    .replace(/๛/g, ',').replace(/๚/g, '.')
    .replace(/\s+/g, ' ').trim();
}
async function extractLines(pdf){
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items){
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row){ row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, w: it.width || 0, s: it.str });
    }
    rows.sort((a,b) => b.y - a.y);
    for (const r of rows){
      r.items.sort((a,b) => a.x - b.x);
      let s = '', end = null;
      for (const i of r.items){
        if (end !== null && i.x - end > 1.5) s += ' ';
        s += i.s; end = i.x + i.w;
      }
      lines.push({ page: p, text: normText(s) });
    }
  }
  return lines;
}
const MONEY = /(?<![\d,])\d{1,3}(?:,\d{3})+(?![\d,])/;
function analyzePlanText(lines){
  const out = { hasText: false, s31: null, s32: null, rows: {}, problemRows: [] };
  const thaiChars = lines.reduce((n,l) => n + (l.text.match(/[ก-๙]/g)||[]).length, 0);
  out.hasText = thaiChars > 200;
  // ข้ามสารบัญ: ใช้หัวข้อ 3.1 ตัวสุดท้ายในเอกสาร
  let i31 = -1;
  lines.forEach((l,i) => { if (/3\s*\.\s*1\s*แผนงาน/.test(l.text)) i31 = i; });
  let i32 = lines.findIndex((l,i) => i > i31 && /3\s*\.\s*2\s*แผนงาน/.test(l.text));
  if (i31 < 0) return out;
  if (i32 < 0) i32 = lines.length;
  out.s31 = lines[i31].page; out.s32 = i32 < lines.length ? lines[i32].page : null;
  for (let i = i31 + 1; i < i32; i++){
    const m = lines[i].text.match(/^(\d{1,3})\s+(.*)$/);
    if (!m) continue;
    const no = +m[1]; if (out.rows[no]) continue;
    const mm = m[2].match(MONEY);
    const nobudget = /ไม่ใช้งบ/.test(m[2]);
    out.rows[no] = { page: lines[i].page, budget: mm ? +mm[0].replace(/,/g,'') : null, nobudget, raw: lines[i].text };
  }
  let i26 = -1;
  lines.forEach((l,i) => { if (i < i31 && /2\s*\.\s*6\s/.test(l.text)) i26 = i; });
  if (i26 >= 0){
    const seen = new Set();
    for (let i = i26; i < i31; i++){
      const m = lines[i].text.match(/^(\d)\s+ด\s*้\s*าน/);
      if (m) seen.add(+m[1]);
    }
    out.problemRows = [...seen].sort((a,b)=>a-b);
  }
  return out;
}


