// common.js — ตัวช่วยที่ทุกขั้นใช้ ($, fmt, esc, toast) และ state ของขั้น ⓪
const $ = s => document.querySelector(s);
const fmt = n => (n === null || n === undefined || isNaN(n)) ? '–' : Number(n).toLocaleString('en-US');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS = { done:'ทำแล้ว จบโครงการ', done_continue:'ทำแล้ว และทำต่อในแผนใหม่', not_done:'ยังไม่ได้ทำ' };
function migrate(rev){ Object.values(rev||{}).forEach(r => { if (r && r.status === 'continue') r.status = 'done_continue'; }); return rev || {}; }
const REASONS = ['ไม่ได้รับงบประมาณ','ชุมชนยังไม่พร้อม','ปัญหาเปลี่ยนไปแล้ว','อื่น ๆ'];

const state = { pdfName:null, pdf:null, ai:null, usingSample:false, review:{}, filter:'all' };

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,Math.max(2600, msg.length*70)); }
// เปิด Gemini หลังคัดลอกคำสั่งสำเร็จ ใช้แท็บชื่อ "gemini" แท็บเดียว กดซ้ำจะไม่เปิดแท็บใหม่เพิ่ม
// (เรียกหลัง clipboard สำเร็จเท่านั้น ถ้าเปิดก่อน แท็บใหม่จะแย่งโฟกัสแล้วคัดลอกไม่สำเร็จ)
const GEMINI_URL = 'https://gemini.google.com/app';
function openGemini(hint){
  let w = null; try{ w = window.open(GEMINI_URL, 'gemini'); }catch(e){}
  toast(w ? 'คัดลอกคำสั่งแล้ว เปิด Gemini ในแท็บใหม่ให้แล้ว ' + hint
          : 'คัดลอกคำสั่งแล้ว แต่เบราว์เซอร์ไม่ให้เปิดแท็บใหม่ กดปุ่ม “เปิด Gemini” แล้ว' + hint);
}
// ข้อความเมื่ออ่านคำตอบ AI ไม่ได้ บอกสาเหตุที่น่าจะเป็นและวิธีแก้ (ใช้ทั้งขั้น ⓪ ② ③)
// คำสั่งที่ส่งให้ AI มีโครงสร้าง JSON ตัวอย่างอยู่ข้างใน ถ้าผู้ใช้วางคำสั่งกลับมาจะอ่านได้แต่เป็นข้อมูลเปล่า จึงต้องจับไว้ก่อน
const looksLikePrompt = t => /^s*คุณคือ|## กติกาบังคับ|## โครงสร้าง JSON/.test(String(t || ''));
function aiErrorMsg(text){
  const t = String(text || '').trim();
  if (!t) return 'ยังไม่ได้วางคำตอบ คัดลอกคำตอบทั้งหมดจาก Gemini แล้ววางในช่องในข้อ 3';
  if (looksLikePrompt(t)) return 'ข้อความที่วางเป็น “คำสั่ง” ที่ส่งให้ Gemini ไม่ใช่คำตอบ ให้คัดลอกข้อความที่ Gemini ตอบกลับมาแทน';
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0) return 'ข้อความที่วางไม่ใช่คำตอบรูปแบบที่แอปอ่านได้ (ต้องมีเครื่องหมาย { … }) ลองขอให้ Gemini “ตอบเป็น JSON อย่างเดียวตามโครงสร้างที่กำหนด”';
  if (b < a) return 'คำตอบถูกตัดกลาง ไม่มีเครื่องหมาย } ปิดท้าย ถ้า Gemini ตอบยาวจนหยุด ให้พิมพ์ในแชตว่า “ตอบต่อจากเดิม” แล้วนำข้อความมาต่อท้าย หรือขอให้ตอบใหม่';
  return 'คำตอบไม่ครบหรือรูปแบบผิด ตรวจว่าคัดลอกครบตั้งแต่ { ตัวแรกถึง } ตัวสุดท้าย ถ้ายังไม่ได้ ให้กดคัดลอกคำสั่งใหม่แล้วถาม Gemini อีกครั้ง';
}
// พับช่อง JSON ดิบเมื่อได้คำตอบที่ใช้ได้แล้ว (ยังเปิดดู/แก้/วางใหม่ได้)
function setRaw(id, has){
  const d = $('#' + id); if (!d) return;
  d.open = !has;
  d.querySelector('summary').textContent = has ? '✓ รับคำตอบแล้ว — กดเพื่อดู แก้ไข หรือวางคำตอบใหม่' : 'ช่องวางคำตอบจาก AI';
}
// การบันทึกทุกขั้นไปรวมที่ชุดข้อมูลของตำบล (ดู wsSave ด้านล่าง)
function persist(){ wsSave(); }

