// common.js — ตัวช่วยที่ทุกขั้นใช้ ($, fmt, esc, toast) และ state ของขั้น ⓪
const $ = s => document.querySelector(s);
const fmt = n => (n === null || n === undefined || isNaN(n)) ? '–' : Number(n).toLocaleString('en-US');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS = { done:'ทำแล้ว จบโครงการ', done_continue:'ทำแล้ว และทำต่อในแผนใหม่', not_done:'ยังไม่ได้ทำ' };
function migrate(rev){ Object.values(rev||{}).forEach(r => { if (r && r.status === 'continue') r.status = 'done_continue'; }); return rev || {}; }
const REASONS = ['ไม่ได้รับงบประมาณ','ชุมชนยังไม่พร้อม','ปัญหาเปลี่ยนไปแล้ว','อื่น ๆ'];

const state = { pdfName:null, pdf:null, ai:null, usingSample:false, review:{}, filter:'all' };

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,2600); }
// การบันทึกทุกขั้นไปรวมที่ชุดข้อมูลของตำบล (ดู wsSave ด้านล่าง)
function persist(){ wsSave(); }

