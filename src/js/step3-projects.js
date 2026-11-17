// step3-projects.js — ③ หน้าจอโครงการ บัตรโครงการ และลำดับ 3.1
const PRJ0 = () => ({ old:{}, extra:[], ans2Text:'', ans2:null, seq:1 });
const prj = PRJ0();
function prjPersist(){ wsSave(); }
const TAXCODES = new Set(TAXONOMY.map(x => x.code));
$('#crList').innerHTML = TAXONOMY.map(x => `<option value="${esc(x.code)}">${esc(x.name)}</option>`).join('');
function carriedOld(){
  return (state.ai?.part3?.projects || []).filter(p => { const r = rv(p.id); return r.status === 'done_continue' || (r.status === 'not_done' && r.decision === 'carry'); });
}
function planItems(){
  const olds = carriedOld().map(p => {
    const r = rv(p.id), o = prj.old[p.id] || {};
    return Object.assign({ uid:'old:'+p.id, source:'old', oldId:p.id, name: r.name ?? p.name, budget: finalBudget(p), target: p.target || '', period:'', dim: p.form_dimension || '', method: p.method || '', strategy:'', cr:'', agency:'', royal:'', votes:'',
      note: r.status === 'done_continue' ? 'ทำแล้ว ทำต่อ' : 'ยังไม่ได้ทำ ยกมา' }, o);
  });
  return olds.concat(prj.extra.filter(x => x.accepted));
}
function orderedItems(items){
  const ord = prj.order || [];
  return items.map((it,i) => ({ it, k: ord.indexOf(it.uid) === -1 ? 1e6 + i : ord.indexOf(it.uid) })).sort((a,b) => a.k - b.k).map(x => x.it);
}
function itemRef(uid){
  if (uid.startsWith('old:')){ const id = uid.slice(4); return prj.old[id] || (prj.old[id] = {}); }
  return prj.extra.find(x => x.uid === uid);
}
function part2Ctx(){ return { part2: ana.answer || {}, taxonomy: TAXONOMY }; }
function renderProjects(){
  const olds = carriedOld();
  const all = state.ai?.part3?.projects || [];
  const statused = all.filter(p => rv(p.id).status).length;
  const cf = [];
  if (!state.ai) cf.push(['warn','ยังไม่มีข้อมูลแผนเดิม ทำขั้น ⓪ ก่อน']);
  else {
    cf.push([olds.length ? 'ok':'info', `ยกมาจากแผนเดิม ${olds.length} โครงการ`]);
    if (statused < all.length) cf.push(['warn', `แผนเดิมยังไม่ระบุสถานะ ${all.length - statused} จาก ${all.length} โครงการ โครงการเหล่านี้ยังไม่ถูกนำเข้า กลับไปติ๊กในขั้น ⓪`]);
  }
  if (!ana.answer?.strategies?.length) cf.push(['warn','ยังไม่มีร่างยุทธศาสตร์ (ข้อ 2.5) จากขั้น ② คำสั่งในข้อ 2 จะยังไม่สมบูรณ์']);
  facts($('#carryFacts'), cf);
  fillNewForm();
  const items = orderedItems(planItems());
  $('#p2Box').value = buildPrompt2({ meta: state.ai?.meta || {}, part2: ana.answer || {}, carried: items.map(i => ({ name:i.name, budget:i.budget, dim:i.dim, method:i.method })),
    venue: (ana.venue || '').split('\n').map(s => s.trim()).filter(Boolean), taxonomy: TAXONOMY });
  // candidates
  const cands = prj.extra.filter(x => x.source === 'ai');
  $('#cands').innerHTML = cands.length ? '<h3 class="sub">โครงการที่ AI เสนอ ติ๊กเลือกเฉพาะที่เวทีเห็นชอบ</h3>' + cands.map(c => `<label class="cand"><input type="checkbox" data-cand="${esc(c.uid)}" ${c.accepted?'checked':''}><span><b>${esc(c.name)}</b><span class="meta">ยุทธศาสตร์ ${esc(c.strategy)} ${esc(c.method||'')}${c.why?' / '+esc(c.why):''}</span>${(c.flags||[]).map(x => `<div class="flagline ${x[0]==='info'?'':x[0]}">${esc(x[1])}</div>`).join('')}</span></label>`).join('') : '';
  // list
  const chk = checkPlan(items, part2Ctx());
  const strategies = ana.answer?.strategies || [];
  const sel = (f, val, opts) => `<select data-f="${f}"><option value="">เลือก…</option>${opts.map(o => `<option value="${esc(o[0])}" ${String(val)===String(o[0])?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
  $('#pjList').innerHTML = items.length ? items.map(it => {
    const fl = chk.perItem[it.uid] || [];
    const cls = fl.some(x => x[0]==='bad') ? 'bad' : fl.some(x => x[0]==='warn') ? 'warn' : '';
    const srcTxt = it.source === 'old' ? 'แผนเดิม: ' + it.note : it.source === 'ai' ? 'AI เสนอ เวทีเลือก' : 'เพิ่มเอง';
    return `<div class="pj ${cls}" data-uid="${esc(it.uid)}">
      <div class="pj-top"><button class="btn ghost small" data-act="up" type="button" aria-label="เลื่อนขึ้น">▲</button><button class="btn ghost small" data-act="down" type="button" aria-label="เลื่อนลง">▼</button><input data-f="name" value="${esc(it.name)}" aria-label="ชื่อโครงการ"><span class="src">${esc(srcTxt)}</span>${it.source !== 'old' ? '<button class="btn ghost small" data-act="remove" type="button">เอาออก</button>' : ''}</div>
      <div class="pj-grid">
        <label>งบประมาณ (บาท)<input type="number" min="0" data-f="budget" value="${esc(it.budget ?? '')}"></label>
        <label>เป้าหมาย<input data-f="target" value="${esc(it.target||'')}"></label>
        <label>ระยะเวลา<input data-f="period" value="${esc(it.period||'')}" placeholder="เช่น 2571"></label>
        <label>ด้าน (แบบฟอร์ม 3.2)${sel('dim', it.dim, FORM_DIMS.map(d => [d,d]))}</label>
        <label>วิธีดำเนินการ${sel('method', it.method, METHODS.map(d => [d,d]))}</label>
        <label>ยุทธศาสตร์ที่รองรับ (2.5)${sel('strategy', it.strategy, strategies.map(s => [s.no, s.no + '. ' + s.name]))}</label>
      </div>
      ${fl.map(x => `<div class="flagline ${x[0]==='info'?'':x[0]}">${esc(x[1])}</div>`).join('')}
    </div>`; }).join('') : '<div class="empty">ยังไม่มีโครงการ ติ๊กสถานะในขั้น ⓪ หรือเลือกโครงการที่ AI เสนอ หรือกรอกในช่องเพิ่มโครงการใหม่ด้านบน</div>';
  const pf = [];
  chk.bad.forEach(x => pf.push(['bad', esc(x)])); chk.warn.forEach(x => pf.push(['warn', esc(x)])); chk.info.forEach(x => pf.push(['info', esc(x)]));
  if (items.length && !pf.length) pf.push(['ok','ข้อมูลโครงการครบตามแบบฟอร์มและแนวทาง']);
  facts($('#planFacts'), pf);
  $('#dimSum').innerHTML = items.length ? FORM_DIMS.map(d => { const arr = items.filter(i => i.dim === d); return `<div><b>${arr.length}</b><span>ด้าน${d} ${fmt(arr.reduce((s,i) => s + (Number(i.budget)||0), 0))} บาท</span></div>`; }).join('') : '';
  const ord = priorityOrder(items);
  $('#p31').innerHTML = items.length ? '<thead><tr><th>ที่</th><th>ชื่อโครงการ</th><th>งบประมาณ</th><th>เป้าหมาย</th><th>ด้าน</th><th>วิธีดำเนินการ</th></tr></thead><tbody>' +
    ord.map((it,i) => `<tr><td>${i+1}</td><td>${esc(it.name)}</td><td class="num">${fmt(it.budget)}</td><td>${esc(it.target||'')}</td><td>${esc(it.dim||'')}</td><td>${esc(it.method||'')}</td></tr>`).join('') + '</tbody>' : '';
  if (items.length) $('#p1').classList.add('done');
}
$('#copyP2').addEventListener('click', async () => {
  renderProjects(); const txt = $('#p2Box').value;
  try{ await navigator.clipboard.writeText(txt); openGemini('วางคำสั่ง (Ctrl+V) ไม่ต้องแนบไฟล์'); }
  catch(e){ const d = document.querySelector('#p2 details.prompt'); d.open = true; $('#p2Box').focus(); $('#p2Box').select(); toast('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้ให้แล้ว กดคัดลอกเอง'); }
});
$('#check2').addEventListener('click', () => {
  prj.ans2Text = $('#ans2Box').value;
  let ans; try{ ans = parseAI(prj.ans2Text); }catch(e){ facts($('#ans2Facts'), [['bad','อ่านคำตอบไม่ได้ ต้องเป็น JSON ทั้งก้อน ตรวจว่าคัดลอกมาครบ']]); return; }
  const v = validateAnswer2(ans, part2Ctx());
  const keep = prj.extra.filter(x => x.source !== 'ai' || x.accepted);
  const fresh = v.projects.map(p => ({ uid:'ai:'+(prj.seq++), source:'ai', accepted:false, name:p.name||'', budget:null, target:p.target||'', period:'', dim: FORM_DIMS.includes(p.form_dimension) ? p.form_dimension : '', method: METHODS.includes(p.method) ? p.method : '',
    strategy: p.strategy_no ?? '', cr: p.provincial_code && TAXCODES.has(p.provincial_code) ? p.provincial_code : '', agency:p.agency||'', royal:p.royal_link||'', votes:'', why:p.why||'', detail:p.detail||'', tows:p.tows||[], flags:p.flags }));
  prj.extra = keep.concat(fresh);
  const f = v.errors.map(x => ['bad', esc(x)]);
  f.unshift(['ok', `AI เสนอ ${fresh.length} โครงการ ติ๊กเลือกด้านล่างเฉพาะที่เวทีเห็นชอบ`]);
  facts($('#ans2Facts'), f); $('#p2').classList.add('done');
  prjPersist(); renderProjects();
});
$('#cands').addEventListener('change', e => { const id = e.target.dataset.cand; if (!id) return; const c = prj.extra.find(x => x.uid === id); c.accepted = e.target.checked; prjPersist(); renderProjects(); });
function fillNewForm(){
  const opt = (el, list) => { const keep = el.value; el.innerHTML = '<option value="">เลือก…</option>' + list.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); el.value = keep; };
  opt($('#nDim'), FORM_DIMS.map(d => [d,d]));
  opt($('#nMethod'), METHODS.map(d => [d,d]));
  opt($('#nStrat'), (ana.answer?.strategies || []).map(s => [s.no, s.no + '. ' + s.name]));
}
$('#addPj').addEventListener('click', () => {
  const name = $('#nName').value.trim();
  if (!name){ $('#nMsg').textContent = 'กรอกชื่อโครงการก่อน'; $('#nName').focus(); return; }
  const b = $('#nBudget').value;
  prj.extra.push({ uid:'m:'+(prj.seq++), source:'manual', accepted:true, name, budget: b === '' ? null : Number(b), target:$('#nTarget').value.trim(), period:$('#nPeriod').value.trim(), dim:$('#nDim').value, method:$('#nMethod').value, strategy:$('#nStrat').value, cr:'', agency:'', royal:'', votes:'' });
  ['#nName','#nBudget','#nTarget','#nPeriod','#nDim','#nMethod','#nStrat'].forEach(s => $(s).value = '');
  $('#nMsg').textContent = '';
  prjPersist(); renderProjects(); toast('เพิ่ม “' + name + '” เข้ารายการแล้ว'); $('#nName').focus();
});
$('#pjList').addEventListener('change', e => {
  const el = e.target, card = el.closest('.pj'); if (!card || !el.dataset.f) return;
  const ref = itemRef(card.dataset.uid); if (!ref) return;
  const f = el.dataset.f;
  ref[f] = (f === 'budget' || f === 'votes') ? (el.value === '' ? null : Number(el.value)) : (f === 'cr' ? el.value.trim().toUpperCase() : el.value);
  if (f === 'budget' && card.dataset.uid.startsWith('old:')){ /* แก้งบของโครงการเดิมในแผนใหม่ได้ ไม่กระทบผลทบทวน */ }
  prjPersist(); renderProjects();
});
$('#pjList').addEventListener('click', e => {
  const b = e.target.closest('button[data-act=remove]'); if (!b) return;
  const uid = b.closest('.pj').dataset.uid;
  const it = prj.extra.find(x => x.uid === uid);
  if (it.source === 'ai') it.accepted = false; else prj.extra = prj.extra.filter(x => x.uid !== uid);
  prjPersist(); renderProjects();
});
$('#saveBtn4').addEventListener('click', () => $('#saveBtn').click());
$('#pjList').addEventListener('click', e => {
  const b = e.target.closest('button[data-act=up],button[data-act=down]'); if (!b) return;
  const uids = orderedItems(planItems()).map(x => x.uid), uid = b.closest('.pj').dataset.uid, i = uids.indexOf(uid);
  const j = b.dataset.act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= uids.length) return;
  [uids[i], uids[j]] = [uids[j], uids[i]]; prj.order = uids; prjPersist(); renderProjects();
  const n = document.querySelector(`#pjList .pj[data-uid="${CSS.escape(uid)}"] button[data-act=${b.dataset.act}]`); if (n) n.focus();
});

