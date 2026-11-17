// step1-current.js — ① ข้อมูลตำบลปัจจุบัน: อ่าน TIS รายหมู่บ้าน, heatmap, ข้อมูลพื้นฐาน
// ---- TIS core ----
const TIS_DIMS = ['ด้านเศรษฐกิจและอาชีพ','ด้านการจัดการข้อมูล','ด้านการศึกษาและการเรียนรู้','ด้านสิ่งแวดล้อมและสาธารณสุข','ด้านสังคม วัฒนธรรม'];
function normDim(s){
  const t = String(s||'').replace(/\s+/g,' ').trim();
  const k = t.replace(/\s/g,'');
  return TIS_DIMS.find(d => d.replace(/\s/g,'') === k) || t;
}
function parseTisRows(rows){
  const flat = r => r.map(c => String(c ?? '')).join(' ');
  const out = { year:null, province:null, amphoe:null, tambon:null, villages:[], warnings:[] };
  for (const r of rows.slice(0,6)){
    const s = flat(r);
    const y = s.match(/ปีงบประมาณ\s*(\d{4})/); if (y) out.year = +y[1];
    const l = s.match(/จังหวัด\s*(\S+)\s*อำเภอ\s*(\S+)\s*ตำบล\s*(\S+)/); if (l){ out.province=l[1]; out.amphoe=l[2]; out.tambon=l[3]; }
  }
  const hi = rows.findIndex(r => r.some(c => /อันดับที่\s*1/.test(c)) && r.some(c => /หมู่ที่/.test(c)));
  if (hi < 0){ out.warnings.push('ไม่พบหัวตาราง “หมู่ที่” และ “อันดับที่ 1” ไฟล์นี้อาจไม่ใช่รายงานผลการวิเคราะห์ TIS'); return out; }
  const H = rows[hi].map(c => String(c ?? ''));
  const cMoo = H.findIndex(c => /หมู่ที่/.test(c));
  const cName = H.findIndex(c => /^\s*หมู่บ้าน\s*$/.test(c));
  const cRank = [1,2,3,4,5].map(k => H.findIndex(c => new RegExp('อันดับที่\\s*'+k+'(?!\\d)').test(c)));
  for (let i = hi+1; i < rows.length; i++){
    const r = rows[i];
    if (flat(r).includes('ประเด็นการพัฒนา')) break;
    const moo = parseInt(r[cMoo], 10);
    const ranks = cRank.map(c => c >= 0 ? normDim(r[c]) : '');
    if (!moo || !ranks[0]) continue;
    const name = String(cName >= 0 ? r[cName] : '').replace(/^บ้าน\s+/, 'บ้าน').trim();
    const bad = ranks.filter(d => !TIS_DIMS.includes(d));
    if (bad.length || new Set(ranks).size !== 5) out.warnings.push(`หมู่ ${moo} จัดอันดับไม่ครบ 5 ด้าน หรือมีชื่อด้านที่ไม่รู้จัก`);
    out.villages.push({ moo, name, ranks });
  }
  if (!out.villages.length) out.warnings.push('ไม่พบข้อมูลรายหมู่บ้านในไฟล์');
  return out;
}
function tisStats(villages){
  const n = villages.length;
  const s = TIS_DIMS.map(d => {
    const counts = [0,0,0,0,0]; let sum = 0, m = 0;
    villages.forEach(v => { const k = v.ranks.indexOf(d); if (k >= 0){ counts[k]++; sum += k+1; m++; } });
    return { dim:d, counts, avg: m ? sum/m : null };
  });
  const order = [...s].sort((a,b) => a.avg - b.avg);
  const top = order[0];
  const outliers = villages.filter(v => v.ranks[0] !== top.dim).map(v => ({ moo:v.moo, name:v.name, first:v.ranks[0] }));
  return { n, stats:s, order, outliers };
}


const CUR0 = () => ({ tis:null, tisStats:null, base:{}, tisFile:null, tisIsSample:false });
const cur = CUR0();
function curPersist(){ wsSave(); }

// หน้าในแอป: #home ภาพรวม (หน้าแรก) และขั้น ⓪–④ — hash อื่นหรือไม่มี hash จะไปหน้าภาพรวม
const VIEWS = ['home', 'review', 'current', 'analysis', 'projects', 'book'];
function showView(){
  const k = location.hash.slice(1), h = VIEWS.includes(k) ? k : 'home';
  VIEWS.forEach(v => {
    $('#v-' + v).hidden = v !== h;
    const tab = $('#tab' + v[0].toUpperCase() + v.slice(1)); if (tab) tab.setAttribute('aria-current', v === h ? 'page' : 'false');
  });
  if (h === 'book') renderBook();
  if (h === 'projects') renderProjects();
  if (h === 'current') renderCurrent();
  if (h === 'analysis') renderAnalysis();
  refreshProgress();
}
window.addEventListener('hashchange', showView);

function ingestTis(t, fileName, isSample){
  cur.tis = t; cur.tisStats = tisStats(t.villages); cur.tisFile = fileName; cur.tisIsSample = !!isSample;
  $('#drop2Title').textContent = fileName;
  $('#c1').classList.add('done');
  curPersist(); renderCurrent();
}
async function readXls(file){
  facts($('#tisFacts'), [['info','กำลังอ่านไฟล์…']]);
  if (!window.XLSX){ facts($('#tisFacts'), [['bad','โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่']]); return; }
  try{
    const wb = XLSX.read(await file.arrayBuffer(), { type:'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'' });
    ingestTis(parseTisRows(rows), file.name, false);
  }catch(e){ facts($('#tisFacts'), [['bad','เปิดไฟล์นี้ไม่ได้ ตรวจว่าเป็นไฟล์ Excel ที่ส่งออกจาก TIS']]); }
}
$('#xlsInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) readXls(f); });
const drop2 = $('#drop2');
['dragenter','dragover'].forEach(ev => drop2.addEventListener(ev, e => { e.preventDefault(); drop2.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop2.addEventListener(ev, e => { e.preventDefault(); drop2.classList.remove('over'); }));
drop2.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readXls(f); });
$('#loadTisSample').addEventListener('click', () => {
  const s = TIS_SAMPLE;
  ingestTis({ year:s.year, province:s.province, amphoe:s.amphoe, tambon:s.tambon, warnings:[],
    villages: s.villages.map(v => ({ moo:v[0], name:String(v[1]).replace(/^บ้าน\s+/,'บ้าน'), ranks:v.slice(2) })) }, 'ตัวอย่างจริง: รายงาน TIS ป่าแดด', true);
});

const short = d => d.replace(/^ด้าน/,'');
function renderCurrent(){
  const t = cur.tis, S = cur.tisStats, m = state.ai?.meta;
  // facts
  if (t){
    const out = [['ok', `ตำบล${esc(t.tambon||'?')} อำเภอ${esc(t.amphoe||'?')} ข้อมูล ${t.villages.length} หมู่บ้าน${cur.tisIsSample?' (ตัวอย่างจริงจากป่าแดด)':''}`]];
    if (t.year) out.push([t.year < 2570 ? 'warn' : 'ok', `ข้อมูล TIS ปีงบประมาณ ${t.year}${t.year < 2570 ? ' ตรวจว่า TIS มีข้อมูลรอบใหม่หรือยัง ถ้ายังไม่มี ให้ระบุปีของข้อมูลในเล่มแผนให้ชัด' : ''}`]);
    if (m?.tambon && t.tambon && m.tambon !== t.tambon) out.push(['bad', `ตำบลไม่ตรงกัน แผนเดิมเป็นตำบล${esc(m.tambon)} แต่รายงาน TIS เป็นตำบล${esc(t.tambon)}`]);
    (t.warnings||[]).forEach(w => out.push(['warn', esc(w)]));
    facts($('#tisFacts'), out);
  }
  // heat
  if (S){
    const n = S.n;
    const head = '<thead><tr><th>ด้าน</th>' + [1,2,3,4,5].map(k => `<th>อันดับ ${k}</th>`).join('') + '<th>อันดับเฉลี่ย</th></tr></thead>';
    const body = S.order.map(o => '<tr><td>' + esc(short(o.dim)) + '</td>' + o.counts.map(c => {
      const pct = Math.round(c / n * 70);
      return `<td class="c" style="background:color-mix(in srgb, var(--accent) ${pct}%, var(--surface));${pct>40?'color:var(--surface)':''}">${c || '·'}</td>`;
    }).join('') + `<td class="c">${o.avg.toFixed(2)}</td></tr>`).join('');
    $('#heatWrap').innerHTML = `<table class="heat">${head}<tbody>${body}</tbody></table>`;
    const top = S.order[0], topN = top.counts[0];
    const hf = [[topN / n >= .75 ? 'ok' : 'info', `${topN} จาก ${n} หมู่บ้านจัด${esc(short(top.dim))}เป็นอันดับ 1${topN / n >= .75 ? ' เป็นปัญหาร่วมของทั้งตำบล' : ''}`]];
    if (S.outliers.length) hf.push(['info', 'หมู่บ้านที่จัดอันดับ 1 ต่างจากส่วนใหญ่: ' + S.outliers.map(o => `หมู่ ${o.moo} ${esc(o.name)} (${esc(short(o.first))})`).join(', ') + ' ควรฟังเหตุผลของหมู่บ้านเหล่านี้ในเวที']);
    facts($('#heatFacts'), hf);
  }
  // baseline
  const p1 = state.ai?.part1 || {};
  const defs = [['villages','จำนวนหมู่บ้าน', p1.villages],['households','จำนวนครัวเรือน', p1.households],['total','ประชากรรวม', p1.population?.total],['male','ชาย', p1.population?.male],['female','หญิง', p1.population?.female],['income','รายได้เฉลี่ยต่อคนต่อปี (บาท)', p1.avg_income_per_person_year],['year','ปีของข้อมูล (เช่น จปฐ. 2570)', '']];
  const b = cur.base;
  $('#baseForm').innerHTML = defs.map(([k,l,dv]) => `<label>${l}<input data-base="${k}" ${k==='year'?'type="text"':'type="number" min="0"'} value="${esc(b[k] ?? dv ?? '')}"></label>`).join('');
  const val = k => { const v = b[k] ?? defs.find(d => d[0]===k)[2]; return v === '' || v === undefined || v === null ? null : Number(v); };
  const bf = [];
  if (val('male') !== null && val('female') !== null && val('total') !== null && val('male') + val('female') !== val('total')) bf.push(['bad', `ชายรวมหญิง ${fmt(val('male')+val('female'))} ไม่เท่ากับประชากรรวม ${fmt(val('total'))}`]);
  if (t && val('villages') !== null && val('villages') !== t.villages.length) bf.push(['warn', `จำนวนหมู่บ้าน (${val('villages')}) ไม่ตรงกับใน TIS (${t.villages.length})`]);
  if (!b.year) bf.push(['warn','ยังไม่ระบุปีของข้อมูล']);
  if (!state.ai) bf.push(['info','ยังไม่มีข้อมูลจากแผนเดิม ทำขั้น ⓪ ก่อนจะได้ตัวเลขตั้งต้นอัตโนมัติ']);
  facts($('#baseFacts'), bf);
  const probs = state.ai?.part2?.problems || [];
  $('#oldProblems').innerHTML = probs.length ? `<h3 class="sub">ลำดับปัญหาในแผนเดิม (จาก AI ยังไม่ได้ตรวจกับเล่ม)</h3><ol class="order">${probs.map(p => `<li>${esc(p.name)}</li>`).join('')}</ol>` : '';
}

$('#baseForm').addEventListener('change', e => {
  const el = e.target; if (!el.dataset.base) return;
  cur.base[el.dataset.base] = el.value === '' ? null : (el.dataset.base === 'year' ? el.value : Number(el.value));
  curPersist(); renderCurrent();
});

