// node test/render.js <dir> <main.v> <out.png> [w h] [aa]
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const V = require('../web/renderer.js');

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const [dir, main, out, w, h, aa] = process.argv.slice(2);
const files = {};
for (const f of fs.readdirSync(dir)) if (fs.statSync(path.join(dir, f)).isFile()) files[f] = fs.readFileSync(path.join(dir, f), 'latin1');
const t0 = Date.now();
let scene;
try { scene = V.parseScene(files, main); }
catch (e) { console.log('PARSE ERROR', e.toString()); process.exit(1); }
const r = new V.Renderer(scene, { res: w ? [+w, +h] : null, antialias: aa || undefined });
const [y0, y1] = r.rowRange();
const img = new Uint8ClampedArray(r.W * r.H * 4);
const st = {};
for (let y = y0; y < y1; y++) img.set(r.renderRows(y, y + 1, st), y * r.W * 4);
fs.writeFileSync(out, png(r.W, r.H, img));
console.log(main, r.W + 'x' + r.H, 'prims', scene.prims.length, 'lights', scene.lights.length, 'aa', r.aa, 'rays', r.rays, 'ms', Date.now() - t0);
if (scene.warnings.length) console.log('  warnings:', scene.warnings.join(' | '));
