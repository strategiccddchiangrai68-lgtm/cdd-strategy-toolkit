// build.js — รวมไฟล์ใน src/ เป็น HTML ไฟล์เดียว → docs/index.html
// ไฟล์ที่ได้ใช้ได้ทั้ง GitHub Pages (โฟลเดอร์ docs/) และ artifact บน claude.ai
// รัน: npm run build
//   - <link rel="stylesheet" href="ไฟล์ในเครื่อง">  → <style>…</style>
//   - <script src="ไฟล์ในเครื่อง"> ที่อยู่ติดกัน     → รวมเป็น <script>…</script> เดียว (ลำดับเดิม)
//   - ไลบรารีจาก CDN (https://…) และคอมเมนต์ HTML ไม่ถูกแตะ
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'docs', 'index.html');

function read(f){
  const t = fs.readFileSync(path.join(SRC, f), 'utf8');
  return t.endsWith('\n') ? t : t + '\n';
}
function build(){
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (m, f) => '<style>\n' + read(f) + '</style>');
  html = html.replace(/(?:<script src="(?!https?:)[^"]+"><\/script>\n)+/g, block => {
    const files = [...block.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
    return '<script>\n' + files.map(read).join('') + '</script>\n';
  });
  // ตัดคอมเมนต์ที่ใช้อธิบายเฉพาะใน src/index.html
  html = html.replace(/<!-- โค้ดของแอป:.*?-->\n/, '');
  return html;
}
if (require.main === module){
  const html = build();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log('สร้าง docs/index.html แล้ว', (Buffer.byteLength(html) / 1024).toFixed(1), 'KB');
}
module.exports = { build, OUT };
