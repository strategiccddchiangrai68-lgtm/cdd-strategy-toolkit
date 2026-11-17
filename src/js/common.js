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
// การบันทึกทุกขั้นไปรวมที่ชุดข้อมูลของตำบล (ดู wsSave ด้านล่าง)
function persist(){ wsSave(); }

