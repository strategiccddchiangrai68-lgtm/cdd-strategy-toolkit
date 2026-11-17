// step4-docx.js — ④ สร้างรูปเล่ม .docx ด้วยไลบรารี docx (ไม่แตะ DOM)
// ---- step 4: book builder (docx) ----
function buildBook(D, X){
  // D: {tambon, amphoe, changwat, year, base:{...}, swot, direction, strategies, tisOrder:[{dim,counts,avg}], tisN, items:[...], review:{date,round,resolution,attendees}, sources:[...], reviewSummary:{...}}
  const FONT = 'TH SarabunPSK';
  const f = { ascii:FONT, hAnsi:FONT, cs:FONT, eastAsia:FONT };
  const R = (text, o={}) => new X.TextRun(Object.assign({ text:String(text), font:f, size:o.size||32, sizeComplexScript:o.size||32, bold:!!o.b, boldComplexScript:!!o.b }, o.hl ? { highlight:'yellow' } : {}));
  const FILL = label => R(`[ต้องเติม: ${label}]`, { hl:true });
  const P = (runs, o={}) => new X.Paragraph(Object.assign({ children: Array.isArray(runs) ? runs : [typeof runs === 'string' ? R(runs, o) : runs], spacing:{ after: o.after ?? 80 } },
    o.center ? { alignment: X.AlignmentType.CENTER } : {}, o.right ? { alignment: X.AlignmentType.RIGHT } : {}, o.indent ? { indent:{ left:o.indent } } : {}, o.page ? { pageBreakBefore:true } : {}));
  const H = (text, o={}) => P([R(text, { b:true, size:o.size||36 })], Object.assign({ after:120 }, o));
  const val = (v, label) => (v === null || v === undefined || v === '') ? FILL(label) : R(typeof v === 'number' ? v.toLocaleString('en-US') : v);
  const cell = (content, o={}) => new X.TableCell({ children: [P(Array.isArray(content) ? content : [typeof content === 'string' ? R(content, { b:o.b, size:o.size||28 }) : content], { center:o.center, after:0 })],
    columnSpan:o.span, rowSpan:o.rowSpan, verticalAlign: X.VerticalAlign.CENTER, shading: o.head ? { fill:'E8E8E8', type: X.ShadingType.CLEAR, color:'auto' } : undefined });
  const table = (rows, widths) => new X.Table({ width:{ size:100, type: X.WidthType.PERCENTAGE }, columnWidths: widths, rows: rows.map(r => new X.TableRow({ children:r, tableHeader: r._head })) });
  const head = arr => { const r = arr; r._head = true; return r; };
  const T = D.tambon || '…', A = D.amphoe || '…', C = D.changwat || 'เชียงราย';
  const b = D.base || {};
  const portrait = [], land = [], tail = [];
  // cover
  portrait.push(P([R('แผนพัฒนาตำบล', { b:true, size:48 })], { center:true, after:200 }));
  portrait.push(P([R('ประจำปี พ.ศ. ', { size:40, b:true }), D.year ? R(D.year, { size:40, b:true }) : FILL('ปี พ.ศ.')], { center:true, after:400 }));
  portrait.push(P([R(`ตำบล${T}`, { size:40, b:true })], { center:true }));
  portrait.push(P([R(`อำเภอ${A} จังหวัด${C}`, { size:40, b:true })], { center:true, after:600 }));
  portrait.push(P([R(`คณะกรรมการบริหารงานตำบลแบบบูรณาการ (ก.บ.ต.) ตำบล${T} ได้ประชุมพิจารณาแผนชุมชนระดับตำบล มีมติเห็นชอบและรับรองแล้ว เมื่อวันที่ `), FILL('วันที่รับรอง')]));
  portrait.push(P('(ลงชื่อ) ................................................................', { center:true, after:0 }));
  portrait.push(P('(...........................................................)', { center:true, after:0 }));
  portrait.push(P('ประธานคณะกรรมการบริหารงานตำบลแบบบูรณาการ', { center:true, after:0 }));
  portrait.push(P(`ตำบล${T}`, { center:true }));
  // foreword (official form text)
  portrait.push(H('คำนำ', { center:true, page:true }));
  [`การจัดแผนพัฒนาตำบลฉบับนี้ มีความสำคัญยิ่งต่อการส่งเสริมและสนับสนุนให้เกิดกระบวนการเรียนรู้และการจัดการตนเองของคนในตำบล ผ่านกลไกการมีส่วนร่วมจากทุกภาคส่วนทุกหมู่บ้านในตำบล โดยมีการค้นหา รวบรวมข้อมูลความรู้ และสร้างกระบวนการวิเคราะห์ปัญหา เพื่อร่วมกันกำหนดทิศทางการพัฒนาหมู่บ้านเชื่อมโยงสู่ระดับตำบลที่สอดคล้องกับปัญหาและความต้องการที่แท้จริง สามารถแก้ไขปัญหาที่หมู่บ้านและตำบลเผชิญร่วมกันอยู่ได้ รวมทั้งก่อเกิดการค้นหาศักยภาพจากทรัพยากรธรรมชาติ ฝีมือ ทักษะของคนในตำบล เพื่อแก้ไขปัญหาของตำบล ลดการพึ่งพาจากภายนอก เพื่อให้ชุมชนเข้มแข็งและพึ่งตนเองได้`,
   `สำหรับกระบวนการทบทวน และปรับปรุงแผนพัฒนาตำบล ของตำบล${T} ได้ก่อเกิดจากกลไกของคณะกรรมการบริหารงานตำบลแบบบูรณาการ (ก.บ.ต.) ศูนย์ประสานงานองค์การชุมชนระดับตำบล (ศอช.ต.) ที่เป็นการมีส่วนร่วมของผู้นำกลุ่ม/องค์การ ผู้ใหญ่บ้าน กำนัน องค์กรปกครองส่วนท้องถิ่นและจากทุกหมู่บ้าน พร้อมทั้งการส่งเสริมและสนับสนุนจากส่วนราชการ/ภาคเอกชนที่เกี่ยวข้อง เพื่อร่วมกันบูรณาการปัญหาและความต้องการจากทุกหมู่บ้านเชื่อมโยงสู่ตำบล ผ่านกระบวนการเรียนรู้ร่วมกันจากข้อมูลที่ได้จากการจัดเก็บนำมาการวิเคราะห์ข้อมูลจนไปสู่การกำหนดแผนงาน/โครงการ/กิจกรรม ที่ตอบสนองต่อปัญหาและความต้องการของหมู่บ้านเชื่อมโยงสู่ตำบล โดยกำหนดออกมา 3 กลุ่มโครงการ/กิจกรรม คือ โครงการ/กิจกรรมที่ดำเนินการได้เอง โครงการ/กิจกรรมที่ต้องดำเนินการร่วมกันกับหน่วยงานภายนอก และโครงการ/กิจกรรมที่ต้องขอรับการสนับสนุนจากภายนอก`,
   `คณะกรรมการบริหารงานตำบลแบบบูรณาการและศูนย์ประสานงานองค์การชุมชนระดับตำบล ตำบล${T} หวังเป็นอย่างยิ่งว่าแผนพัฒนาตำบลเล่มนี้จะเป็นประโยชน์แก่หน่วยงานราชการ ภาคเอกชน ภาคประชาสังคม และผู้ที่เกี่ยวข้องได้นำไปใช้ในการประสานเชื่อมโยงสู่แผนพัฒนาองค์กรปกครองส่วนท้องถิ่น แผนพัฒนาอำเภอ และแผนพัฒนาทุกระดับ เพื่อการแก้ไขปัญหา และตอบสนองความต้องการ ของหมู่บ้านและตำบลได้อย่างทั่วถึง และอันจะเป็นประโยชน์ต่อการพึ่งพาตนเองได้ของหมู่บ้านและตำบลต่อไป`
  ].forEach(x => portrait.push(P([R(x)], { indent:0, after:160 })));
  portrait.push(P(`คณะกรรมการบริหารงานตำบลแบบบูรณาการ ตำบล${T}`, { right:true, after:0 }));
  portrait.push(P([R('เดือน '), FILL('เดือน พ.ศ.')], { right:true }));
  // TOC
  portrait.push(H('สารบัญ', { center:true, page:true }));
  ['ส่วนที่ 1 ข้อมูลทั่วไปของตำบล','ส่วนที่ 2 การวิเคราะห์ข้อมูล','     2.1 จุดอ่อน จุดแข็ง','     2.2 โอกาส ภัยคุกคาม','     2.3 ผลการวิเคราะห์ข้อมูลชุมชน (TIS)','     2.4 ทิศทาง/เป้าหมายการพัฒนาตำบล','     2.5 กลยุทธ์/วิธีปฏิบัติเพื่อไปสู่ทิศทาง/เป้าหมาย','ส่วนที่ 3 แผนงาน/โครงการ/กิจกรรม แผนพัฒนาตำบล','     3.1 แผนงาน/โครงการ/กิจกรรม เรียงตามลำดับความสำคัญ','     3.2 แผนงาน/โครงการ/กิจกรรม แยกแต่ละด้าน','ส่วนที่ 4 การทบทวนแผนพัฒนาตำบล','ส่วนที่ 5 เรื่องอื่นๆ (ที่เห็นว่าสำคัญและควรบรรจุไว้ในแผนพัฒนาตำบล)','ภาคผนวก'].forEach(x => portrait.push(P(x, { after:40 })));
  // part 1
  portrait.push(H('ส่วนที่ 1 ข้อมูลทั่วไปของตำบล', { center:true, page:true }));
  const L = (label, runs) => portrait.push(P([R(label)].concat(runs || [])));
  L('1. แผนที่ตำบล ', [FILL('แนบแผนที่')]);
  L('2. ประวัติความเป็นมาของตำบล/รายชื่อหมู่บ้าน/รายชื่อผู้นำในตำบล ', [FILL('ประวัติและรายชื่อหมู่บ้าน')]);
  L('3. พื้นที่ทั้งหมด ', [FILL('พื้นที่ ไร่ หรือ ตารางกิโลเมตร')]);
  L('4. อาณาเขต ', [FILL('ที่ตั้งและอาณาเขตติดต่อ 4 ทิศ')]);
  L('5. ลักษณะภูมิประเทศ ', [FILL('ลักษณะภูมิประเทศ')]);
  L('6. จำนวนประชากรรวมทั้งสิ้น ', [val(b.total,'จำนวน'), R(' คน แยกเป็น ชาย '), val(b.male,'จำนวน'), R(' คน หญิง '), val(b.female,'จำนวน'), R(' คน')]);
  portrait.push(P([R('6.1 ผู้สูงอายุ (อายุ 60 ปีบริบูรณ์ขึ้นไป) รวมทั้งสิ้น '), FILL('จำนวน ชาย หญิง'), R(' (รายชื่อแนบ)')], { indent:500 }));
  portrait.push(P([R('6.2 คนพิการ รวมทั้งสิ้น '), FILL('จำนวน ชาย หญิง'), R(' (รายชื่อแนบ)')], { indent:500 }));
  L('7. จำนวนครัวเรือน ', [val(b.households,'จำนวน'), R(' ครัวเรือน (ตามข้อมูลการจัดเก็บ จปฐ.)')]);
  L('8. การประกอบอาชีพ ', [FILL('อาชีพหลักและอาชีพเสริม พร้อมจำนวนครัวเรือน')]);
  L('9. ผู้ว่างงาน ', [FILL('จำนวนแยกกลุ่มอายุ 13–18, 19–24, 25 ปีขึ้นไป')]);
  L('10. ตำบลมีรายได้/รายจ่าย/หนี้สิน ', [FILL('บาท/ปี')]);
  L('11. รายได้เฉลี่ยของประชากร ', [b.year ? R(`(${b.year}) `) : R(''), val(b.income,'บาท/คน/ปี'), R(' บาท/คน/ปี ครัวเรือนยากจน '), FILL('จำนวนครัวเรือน')]);
  L('12. จำนวนกลุ่มกิจกรรม/อาชีพ ', [FILL('ชื่อกลุ่มและจำนวนสมาชิก')]);
  L('13. กองทุนในตำบล ', [FILL('ชื่อกองทุน จำนวน งบประมาณ')]);
  L('14. ข้อมูลความต้องการพัฒนาฝีมือแรงงานของประชาชน ', [FILL('กิจกรรม/อาชีพ และจำนวนคน')]);
  L('15. ข้อมูลคมนาคม/สาธารณูปโภค ', [FILL('การเดินทาง สาธารณูปโภค แหล่งน้ำ')]);
  // part 2
  portrait.push(H('ส่วนที่ 2 การวิเคราะห์ข้อมูล', { center:true, page:true }));
  const sw = D.swot || {};
  const list = (arr, prefix) => (arr && arr.length) ? arr.forEach((x,i) => portrait.push(P(`(${prefix}.${i+1}) ${x.text}`, { indent:500, after:40 }))) : portrait.push(P([FILL('ยังไม่มีข้อมูล')], { indent:500 }));
  portrait.push(P([R('2.1 การวิเคราะห์ปัจจัยภายในหรือสภาพแวดล้อมภายใน', { b:true })]));
  portrait.push(P([R('(1) จุดอ่อน', { b:true })], { indent:250 })); list(sw.W, '1');
  portrait.push(P([R('(2) จุดแข็ง', { b:true })], { indent:250 })); list(sw.S, '2');
  portrait.push(P([R('2.2 การวิเคราะห์ปัจจัยภายนอกหรือสภาพแวดล้อมภายนอก', { b:true })]));
  portrait.push(P([R('(1) โอกาส', { b:true })], { indent:250 })); list(sw.O, '1');
  portrait.push(P([R('(2) อุปสรรค', { b:true })], { indent:250 })); list(sw.T, '2');
  portrait.push(P([R('2.3 ผลการวิเคราะห์ข้อมูลชุมชน (TIS)', { b:true })]));
  if (D.tisOrder && D.tisOrder.length){
    portrait.push(P(`การจัดลำดับประเด็นการพัฒนาของ ${D.tisN} หมู่บ้าน จากระบบสารสนเทศเพื่อการวิเคราะห์ข้อมูลชุมชน (TIS)${D.tisYear ? ' ปีงบประมาณ ' + D.tisYear : ''} (จำนวนหมู่บ้านที่จัดไว้ในแต่ละอันดับ)`));
    portrait.push(table([head([cell('ประเด็นการพัฒนา',{b:true,head:true}), ...[1,2,3,4,5].map(k => cell('อันดับ '+k,{b:true,head:true,center:true})), cell('อันดับเฉลี่ย',{b:true,head:true,center:true})])]
      .concat(D.tisOrder.map(o => [cell(o.dim), ...o.counts.map(c => cell(String(c),{center:true})), cell(o.avg.toFixed(2),{center:true})])), [3200,1000,1000,1000,1000,1000,1300]));
  } else portrait.push(P([FILL('ผลการวิเคราะห์จาก TIS')]));
  portrait.push(P([R('2.4 ทิศทางการพัฒนา ', { b:true }), D.direction ? R(D.direction) : FILL('ทิศทาง/เป้าหมาย')], { after:160 }));
  portrait.push(P([R('2.5 กลยุทธ์หรือวิธีปฏิบัติเพื่อไปสู่ทิศทาง/เป้าหมายของการพัฒนา', { b:true })]));
  (D.strategies && D.strategies.length) ? D.strategies.forEach(s => { portrait.push(P([R(`${s.no}. ${s.name}`, { b:true })], { indent:250, after:20 })); if (s.detail) portrait.push(P(s.detail, { indent:500 })); }) : portrait.push(P([FILL('กลยุทธ์')]));
  portrait.push(P([R('การวิเคราะห์ปัญหาของตำบล', { b:true })]));
  portrait.push(table([head(['ลำดับความสำคัญของปัญหา','ชื่อปัญหา','สาเหตุของปัญหา','ข้อมูลบ่งชี้สภาพ ขนาด และความรุนแรงของปัญหา','แนวทางการแก้ไขปัญหา'].map(x => cell(x,{b:true,head:true,center:true}))),
    [cell([FILL('จากเวที')]), cell(''), cell(''), cell(''), cell('')]], [1300,1800,2000,2200,2200]));
  // part 3 landscape
  const items = D.items || [];
  const DIMS = ['เศรษฐกิจ','สังคม','ทรัพยากรธรรมชาติและสิ่งแวดล้อม','ความมั่นคง','บริหารจัดการ'];
  const DSHORT = ['ด้านเศรษฐกิจ','ด้านสังคม','ด้านทรัพยากรฯ','ด้านความมั่นคง','ด้านการบริหารจัดการ'];
  const MET = ['ทำเอง','ทำร่วม','หน่วยงานอื่นทำให้'];
  const ck = ok => cell(ok ? '✓' : '', { center:true });
  const money = v => (v === null || v === undefined || v === '') ? cell([FILL('งบ')]) : cell(Number(v) === 0 ? 'ไม่ใช้งบประมาณ' : Number(v).toLocaleString('en-US'), { center:true });
  land.push(H('ส่วนที่ 3 แผนงาน/โครงการ/กิจกรรม', { center:true }));
  land.push(P([R('3.1 แผนงาน/โครงการ/กิจกรรม เรียงตามลำดับความสำคัญ (รวมทุกด้าน)', { b:true })]));
  const h1 = head([cell('ที่',{b:true,head:true,center:true,rowSpan:2}), cell('ชื่อโครงการ',{b:true,head:true,center:true,rowSpan:2}), cell('งบประมาณ',{b:true,head:true,center:true,rowSpan:2}), cell('เป้าหมาย',{b:true,head:true,center:true,rowSpan:2}), cell('ประเภทของแผนด้านต่าง ๆ (ระบุ ✓)',{b:true,head:true,center:true,span:5}), cell('วิธีการดำเนินการ (ระบุ ✓)',{b:true,head:true,center:true,span:3})]);
  const h2 = head([...DSHORT.map(x => cell(x,{b:true,head:true,center:true,size:24})), ...MET.map(x => cell(x,{b:true,head:true,center:true,size:24}))]);
  land.push(table([h1, h2].concat(items.map((it,i) => [cell(String(i+1),{center:true}), cell(it.name || ''), money(it.budget), cell(it.target ? it.target : [FILL('เป้าหมาย')]), ...DIMS.map(d => ck(it.dim === d)), ...MET.map(m => ck(it.method === m))])),
    [500,3600,1300,1500,700,700,700,700,800,700,700,900]));
  land.push(P([R('3.2 แผนงาน/โครงการ/กิจกรรม แยกตามด้าน', { b:true })], { page:true }));
  DIMS.forEach((d, di) => {
    land.push(P([R(`${di+1}. ด้าน${d}`, { b:true })]));
    const arr = items.filter(it => it.dim === d);
    const hh1 = head([cell('ลำดับที่',{b:true,head:true,center:true,rowSpan:2}), cell('ชื่อโครงการ',{b:true,head:true,center:true,rowSpan:2}), cell('งบประมาณ',{b:true,head:true,center:true,rowSpan:2}), cell('เป้าหมาย/ระยะเวลาดำเนินการ',{b:true,head:true,center:true,rowSpan:2}), cell('รายละเอียด/วิธีดำเนินการ',{b:true,head:true,center:true,rowSpan:2}), cell('วิธีการดำเนินการ (ระบุ ✓)',{b:true,head:true,center:true,span:3}), cell('หมายเหตุ (หน่วยดำเนินงาน)',{b:true,head:true,center:true,rowSpan:2})]);
    const hh2 = head(MET.map(x => cell(x,{b:true,head:true,center:true,size:24})));
    const rows = arr.length ? arr.map((it,i) => [cell(String(i+1),{center:true}), cell(it.name||''), money(it.budget), cell([it.target ? R(it.target,{size:28}) : FILL('เป้าหมาย'), R(' / ',{size:28}), it.period ? R(it.period,{size:28}) : FILL('ระยะเวลา')]), cell(it.detail ? it.detail : [FILL('รายละเอียด')]), ...MET.map(m => ck(it.method === m)), cell('')])
      : [[cell('-',{center:true}), cell('ไม่มีโครงการในด้านนี้'), cell(''), cell(''), cell(''), cell(''), cell(''), cell(''), cell('')]];
    land.push(table([hh1, hh2].concat(rows), [700,3300,1300,1900,2600,700,700,900,1500]));
    land.push(P(' '));
  });
  // part 4-5 + appendix
  tail.push(H('ส่วนที่ 4 การทบทวนแผนพัฒนาตำบล', { center:true }));
  const rvw = D.review || {};
  tail.push(table([head(['วัน/เดือน/ปี','มติที่ประชุม','จำนวนผู้เข้าร่วมประชุม','หมายเหตุ'].map(x => cell(x,{b:true,head:true,center:true}))),
    [cell(rvw.date ? rvw.date : [FILL('วันที่')],{center:true}), cell(rvw.resolution ? rvw.resolution : [FILL('มติ')],{center:true}), cell(rvw.attendees ? String(rvw.attendees) : [FILL('จำนวน')],{center:true}), cell('')]], [2200,2600,2600,1600]));
  tail.push(H('ส่วนที่ 5 เรื่องอื่นๆ (ที่เห็นว่าสำคัญและควรบรรจุไว้ในแผนพัฒนาตำบล)', { center:true, page:true }));
  if (D.sources && D.sources.length){ tail.push(P([R('แหล่งข้อมูลที่ใช้ประกอบการจัดทำแผน', { b:true })])); D.sources.forEach(s => tail.push(P('- ' + s, { indent:250, after:40 }))); }
  if (D.reviewSummary) tail.push(P([R('ผลการทบทวนโครงการในแผนพัฒนาตำบลฉบับเดิม: ', { b:true }), R(D.reviewSummary)]));
  tail.push(P([FILL('เรื่องอื่นที่ ก.บ.ต. เห็นว่าสำคัญ')]));
  tail.push(H('ภาคผนวก', { center:true, page:true }));
  tail.push(P([FILL('แนบรายชื่อผู้สูงอายุและคนพิการตามข้อ 6.1 และ 6.2 (จัดทำนอกระบบ ไม่บันทึกในแอป)')]));
  tail.push(P([FILL('แนบแบบประเมินแผนพัฒนาตำบลของอำเภอ และภาพกิจกรรมเวที')]));
  const pageA4 = { size:{ width:11906, height:16838 }, margin:{ top:1134, bottom:1134, left:1418, right:1134 } };
  const pageA4L = { size:{ width:11906, height:16838, orientation: X.PageOrientation.LANDSCAPE }, margin:{ top:1134, bottom:1134, left:1134, right:1134 } };
  return new X.Document({ creator:'ต้นแบบระบบเตรียมข้อมูลแผนพัฒนาตำบล', title:`แผนพัฒนาตำบล${T}`,
    styles:{ default:{ document:{ run:{ font:f, size:32, sizeComplexScript:32 } } } },
    sections:[ { properties:{ page:pageA4 }, children:portrait }, { properties:{ page:pageA4L }, children:land }, { properties:{ page:pageA4 }, children:tail } ] });
}


