/*
 * Vivid 2.0 compatible scene renderer (clean-room reimplementation of the
 * documented Vivid 2.0 scene language by Stephen B. Coy).
 * Runs in a Web Worker, on the main thread, or in Node.
 */
(function (root) {
'use strict';

// ---------------------------------------------------------------- vectors
function V(x, y, z) { return [x, y, z]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function cmul(a, b) { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a) { var l = len(a); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; }
function madd(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
function isZero(c) { return c[0] <= 0 && c[1] <= 0 && c[2] <= 0; }
function maxc(c) { return Math.max(c[0], c[1], c[2]); }
var DEG = Math.PI / 180;

// ---------------------------------------------------------------- matrices (4x4, row-major, affine)
function mIdent() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mMul(a, b) {
  var r = new Array(16);
  for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
    var s = 0; for (var k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j]; r[i * 4 + j] = s;
  }
  return r;
}
function mPoint(m, p) {
  return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
          m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
          m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
}
function mDir(m, d) {
  return [m[0] * d[0] + m[1] * d[1] + m[2] * d[2],
          m[4] * d[0] + m[5] * d[1] + m[6] * d[2],
          m[8] * d[0] + m[9] * d[1] + m[10] * d[2]];
}
function mNormal(inv, n) { // transpose of inverse
  return [inv[0] * n[0] + inv[4] * n[1] + inv[8] * n[2],
          inv[1] * n[0] + inv[5] * n[1] + inv[9] * n[2],
          inv[2] * n[0] + inv[6] * n[1] + inv[10] * n[2]];
}
function mInv(m) {
  var a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  var det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-300) det = 1e-300;
  var id = 1 / det;
  var r = [A * id, -(b * i - c * h) * id, (b * f - c * e) * id, 0,
           B * id, (a * i - c * g) * id, -(a * f - c * d) * id, 0,
           C * id, -(a * h - b * g) * id, (a * e - b * d) * id, 0,
           0, 0, 0, 1];
  var t = [m[3], m[7], m[11]];
  r[3] = -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]);
  r[7] = -(r[4] * t[0] + r[5] * t[1] + r[6] * t[2]);
  r[11] = -(r[8] * t[0] + r[9] * t[1] + r[10] * t[2]);
  return r;
}
function mIsIdent(m) { var I = mIdent(); for (var i = 0; i < 16; i++) if (Math.abs(m[i] - I[i]) > 1e-12) return false; return true; }
function mScale(s) { return [s[0],0,0,0, 0,s[1],0,0, 0,0,s[2],0, 0,0,0,1]; }
function mTrans(t) { return [1,0,0,t[0], 0,1,0,t[1], 0,0,1,t[2], 0,0,0,1]; }
function mRotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]; }
function mRotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]; }
function mRotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]; }

// ---------------------------------------------------------------- errors
function VividError(msg, tok) {
  this.message = msg;
  this.file = tok ? tok.f : null;
  this.line = tok ? tok.l : null;
}
VividError.prototype.toString = function () {
  return (this.file ? this.file + ':' + this.line + ': ' : '') + this.message;
};

// ---------------------------------------------------------------- preprocessor + tokenizer
function stripComments(src) {
  // keep newlines so line numbers stay valid
  var out = '', i = 0, n = src.length;
  while (i < n) {
    var c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}

function tokenizeLine(line, file, lineNo, out) {
  var i = 0, n = line.length;
  while (i < n) {
    var c = line[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === ';' || c === '=' || c === ',' || c === '\f' || c === '\x1a') { i++; continue; }
    var prevSpace = i === 0 || /[\s(;=,]/.test(line[i - 1]);
    if (/[0-9.]/.test(c) && (c !== '.' || /[0-9]/.test(line[i + 1] || '')) ||
        (c === '-' || c === '+') && prevSpace && /[0-9.]/.test(line[i + 1] || '') && (line[i + 1] !== '.' || /[0-9]/.test(line[i + 2] || ''))) {
      var m = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(line.substr(i));
      out.push({ t: 'n', v: parseFloat(m[0]), f: file, l: lineNo });
      i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      var m2 = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(line.substr(i));
      out.push({ t: 'i', v: m2[0], f: file, l: lineNo });
      i += m2[0].length; continue;
    }
    if ('{}()+-*/^'.indexOf(c) >= 0) { out.push({ t: 's', v: c, f: file, l: lineNo }); i++; continue; }
    if (c === '"') { // quoted file names
      var j = line.indexOf('"', i + 1); if (j < 0) j = n;
      out.push({ t: 'i', v: line.substring(i + 1, j), f: file, l: lineNo }); i = j + 1; continue;
    }
    throw new VividError("Ismeretlen karakter: '" + c + "'", { f: file, l: lineNo });
  }
}

function Preprocessor(files) {
  this.files = files; // name -> text
  this.lower = {};
  for (var k in files) this.lower[k.toLowerCase()] = k;
  this.macros = {}; // name -> array of token arrays (stack)
  this.warnings = [];
}
Preprocessor.prototype.findFile = function (name) {
  var k = name.toLowerCase().replace(/^.*[\\\/]/, '');
  if (this.lower.hasOwnProperty(k)) return this.lower[k];
  return null;
};
Preprocessor.prototype.run = function (mainName) {
  var out = [];
  this.include(mainName, out, null, 0);
  return out;
};
Preprocessor.prototype.include = function (name, out, tok, depth) {
  if (depth > 16) throw new VividError('Túl mély #include egymásba ágyazás', tok);
  var real = this.findFile(name);
  if (real === null) throw new VividError('Nem található include fájl: ' + name, tok);
  var lines = stripComments(this.files[real]).split('\n');
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li], lineNo = li + 1;
    // line continuation
    while (/\\\s*$/.test(line) && li + 1 < lines.length) {
      line = line.replace(/\\\s*$/, ' ') + lines[++li];
    }
    var tr = line.replace(/^\s+/, '');
    if (tr[0] === '#') {
      var m = /^#\s*(\w+)\s*(.*)$/.exec(tr);
      var here = { f: real, l: lineNo };
      if (!m) throw new VividError('Hibás direktíva', here);
      var d = m[1], rest = m[2].trim();
      if (d === 'include') {
        var fn = rest.replace(/^["<]|[">]$/g, '').trim();
        this.include(fn, out, here, depth + 1);
      } else if (d === 'define') {
        var mm = /^([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/.exec(rest);
        if (!mm) throw new VividError('Hibás #define', here);
        var body = [];
        tokenizeLine(mm[2], real, lineNo, body);
        (this.macros[mm[1]] = this.macros[mm[1]] || []).push(body);
      } else if (d === 'undef') {
        var st = this.macros[rest];
        if (st && st.length) st.pop();
      } else {
        this.warnings.push(real + ':' + lineNo + ': ismeretlen direktíva #' + d);
      }
      continue;
    }
    var toks = [];
    tokenizeLine(line, real, lineNo, toks);
    this.expand(toks, out, 0);
  }
};
Preprocessor.prototype.expand = function (toks, out, depth) {
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i];
    if (t.t === 'i') {
      var st = this.macros[t.v];
      if (st && st.length) {
        if (depth > 32) throw new VividError('Rekurzív makró: ' + t.v, t);
        var body = st[st.length - 1].map(function (b) { return { t: b.t, v: b.v, f: t.f, l: t.l }; });
        this.expand(body, out, depth + 1);
        continue;
      }
    }
    out.push(t);
  }
};

// ---------------------------------------------------------------- parser
var FUNCS = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sqrt: 1, pow: 2, abs: 1, exp: 1, log: 1 };

function Parser(tokens, files, warnings) {
  this.tk = tokens; this.i = 0; this.files = files; this.warnings = warnings;
}
Parser.prototype.peek = function (o) { return this.tk[this.i + (o || 0)]; };
Parser.prototype.next = function () {
  var t = this.tk[this.i++];
  if (!t) throw new VividError('Váratlan fájlvég', this.tk[this.tk.length - 1]);
  return t;
};
Parser.prototype.isSym = function (s, o) { var t = this.peek(o); return t && t.t === 's' && t.v === s; };
Parser.prototype.expect = function (s) {
  var t = this.next();
  if (t.t !== 's' || t.v !== s) throw new VividError("'" + s + "' várt, de ez jött: '" + t.v + "'", t);
  return t;
};
Parser.prototype.warn = function (msg, t) { this.warnings.push((t ? t.f + ':' + t.l + ': ' : '') + msg); };
Parser.prototype.startsValue = function (o) {
  var t = this.peek(o); if (!t) return false;
  if (t.t === 'n') return true;
  if (t.t === 's' && (t.v === '(' || t.v === '-')) return true;
  if (t.t === 'i' && FUNCS[t.v] && this.isSym('(', (o || 0) + 1)) return true;
  return false;
};

// expression evaluation (scalars and 3-vectors)
Parser.prototype.parseExpr = function () {
  var a = this.parseTerm();
  for (;;) {
    var t = this.peek();
    if (t && t.t === 's' && (t.v === '+' || t.v === '-')) {
      this.i++; var b = this.parseTerm();
      a = this.binop(t.v, a, b, t);
    } else break;
  }
  return a;
};
Parser.prototype.parseTerm = function () {
  var a = this.parseUnary();
  for (;;) {
    var t = this.peek();
    if (t && ((t.t === 's' && (t.v === '*' || t.v === '/' || t.v === '^')) || (t.t === 'i' && (t.v === 'cross' || t.v === 'dot')))) {
      this.i++; var b = this.parseUnary();
      a = this.binop(t.v, a, b, t);
    } else break;
  }
  return a;
};
Parser.prototype.parseUnary = function () {
  if (this.isSym('-')) { this.i++; var v = this.parseUnary(); return typeof v === 'number' ? -v : mul(v, -1); }
  if (this.isSym('+')) { this.i++; return this.parseUnary(); }
  return this.parsePrimary();
};
Parser.prototype.parsePrimary = function () {
  var t = this.next();
  if (t.t === 'n') return t.v;
  if (t.t === 's' && t.v === '(') {
    var vals = [];
    while (!this.isSym(')')) vals.push(this.parseExpr());
    this.expect(')');
    if (vals.length === 1) return vals[0];
    if (vals.length === 3 && vals.every(function (x) { return typeof x === 'number'; })) return vals;
    throw new VividError('Zárójelben 1 vagy 3 érték lehet', t);
  }
  if (t.t === 'i' && FUNCS[t.v]) {
    this.expect('(');
    var args = [];
    while (!this.isSym(')')) args.push(this.parseExpr());
    this.expect(')');
    var a0 = args[0], a1 = args[1];
    switch (t.v) {
      case 'sin': return Math.sin(a0); case 'cos': return Math.cos(a0); case 'tan': return Math.tan(a0);
      case 'asin': return Math.asin(a0); case 'acos': return Math.acos(a0); case 'atan': return Math.atan(a0);
      case 'sqrt': return Math.sqrt(a0); case 'pow': return Math.pow(a0, a1); case 'abs': return Math.abs(a0);
      case 'exp': return Math.exp(a0); case 'log': return Math.log(a0);
    }
  }
  throw new VividError("Szám várt, de ez jött: '" + t.v + "'", t);
};
Parser.prototype.binop = function (op, a, b, t) {
  var an = typeof a === 'number', bn = typeof b === 'number';
  switch (op) {
    case '+': if (an && bn) return a + b; if (!an && !bn) return add(a, b); break;
    case '-': if (an && bn) return a - b; if (!an && !bn) return sub(a, b); break;
    case '*': if (an && bn) return a * b; if (an) return mul(b, a); if (bn) return mul(a, b); return cmul(a, b);
    case '/': if (an && bn) return a / b; if (bn) return mul(a, 1 / b); break;
    case '^': if (an && bn) return Math.pow(a, b); break;
    case 'cross': if (!an && !bn) return cross(a, b); break;
    case 'dot': if (!an && !bn) return dot(a, b); break;
  }
  throw new VividError("Érvénytelen művelet: '" + op + "'", t);
};
Parser.prototype.num = function () {
  var t = this.peek(), v = this.parseExpr();
  if (typeof v !== 'number') throw new VividError('Szám várt, nem vektor', t);
  return v;
};
Parser.prototype.vec = function () {
  var t = this.peek();
  var v = this.parseExpr();
  if (typeof v === 'number') {
    var y = this.parseExpr(), z = this.parseExpr();
    if (typeof y !== 'number' || typeof z !== 'number') throw new VividError('Három szám várt', t);
    v = [v, y, z];
    // trailing vector operations: "a b c + x y z", "a b c * n"
    for (;;) {
      var o = this.peek();
      if (!o) break;
      var isOp = (o.t === 's' && '+-*/'.indexOf(o.v) >= 0) || (o.t === 'i' && (o.v === 'cross' || o.v === 'dot'));
      if (!isOp) break;
      this.i++;
      var rhs = this.parseUnary();
      if (typeof rhs === 'number' && (o.v === '+' || o.v === '-' || o.t === 'i')) {
        var r2 = this.parseExpr(), r3 = this.parseExpr(); rhs = [rhs, r2, r3];
      }
      v = this.binop(o.v, v, rhs, o);
      if (typeof v === 'number') break;
    }
  }
  if (typeof v === 'number') throw new VividError('Vektor (3 szám) várt', t);
  return v;
};
Parser.prototype.ident = function () {
  var t = this.next();
  if (t.t !== 'i') throw new VividError("Azonosító várt, de ez jött: '" + t.v + "'", t);
  return t.v;
};
Parser.prototype.skipUnknown = function (t) {
  this.warn("ismeretlen kulcsszó '" + t.v + "' – kihagyva", t);
  if (this.isSym('{')) { this.skipBlock(); return; }
  while (this.peek() && (this.startsValue() || (this.peek().t === 'i' && /\./.test(this.peek().v)))) this.parseExpr();
};
Parser.prototype.skipBlock = function () {
  this.expect('{');
  var depth = 1;
  while (depth > 0) {
    var t = this.next();
    if (t.t === 's' && t.v === '{') depth++;
    else if (t.t === 's' && t.v === '}') depth--;
  }
};
// iterate the keywords of a { ... } block
Parser.prototype.block = function (fn) {
  this.expect('{');
  while (!this.isSym('}')) {
    var t = this.next();
    if (t.t !== 'i') throw new VividError("Kulcsszó várt, de ez jött: '" + t.v + "'", t);
    if (fn(t.v, t) === false) this.skipUnknown(t);
  }
  this.expect('}');
};

// ---------------------------------------------------------------- scene description
function defaultSurface() {
  return { diffuse: [0, 0, 0], ambient: [0, 0, 0], specular: [0, 0, 0], shine: 0, shineColor: null,
           transparent: [0, 0, 0], ior: 1, fuzz: 0, noAA: false, texture: null, bumps: [] };
}
function cloneSurf(s) {
  var r = {}; for (var k in s) r[k] = s[k]; return r;
}

function parseScene(files, mainName) {
  var pp = new Preprocessor(files);
  var tokens = pp.run(mainName);
  var warnings = pp.warnings;
  var p = new Parser(tokens, files, warnings);
  var scene = {
    studio: {
      from: [0, -10, 0], at: [0, 0, 0], up: [0, 0, 1], angle: 30, res: [320, 200], start: 0, stop: -1,
      aspect: 4 / 3, projection: 'flat', width: 10, ambient: [0, 0, 0], background: [0, 0, 0], bgMap: null, bgUp: null,
      haze: 0, antialias: 'none', threshold: 16, jitter: false, aperture: 0, focal: 0, samples: 8,
      noShadows: false, noExpTrans: false, depth: 20, hasStudio: false
    },
    lights: [], prims: [], warnings: warnings, files: files, pp: pp
  };
  var surf = defaultSurface();
  var xstack = [mIdent()];
  var gclips = [[]];
  var pendingClips = [];

  function parseMap(name, tok) {
    var real = pp.findFile(name);
    if (real === null) { p.warn('nem található palettafájl: ' + name, tok); return null; }
    var nums = (files[real].match(/-?\d+(\.\d+)?/g) || []).map(Number);
    var cols = [];
    for (var i = 0; i + 2 < nums.length; i += 3) cols.push([nums[i] / 255, nums[i + 1] / 255, nums[i + 2] / 255]);
    return cols.length ? cols : null;
  }

  function parseStudio() {
    var s = scene.studio; s.hasStudio = true;
    p.block(function (k, t) {
      switch (k) {
        case 'from': case 'eye': s.from = p.vec(); break;
        case 'at': s.at = p.vec(); break;
        case 'up': s.up = p.vec(); break;
        case 'angle': s.angle = p.num(); break;
        case 'resolution': case 'res': s.res = [Math.round(p.num()), Math.round(p.num())]; break;
        case 'start': s.start = Math.round(p.num()); break;
        case 'stop': s.stop = Math.round(p.num()); break;
        case 'aspect': s.aspect = p.num(); break;
        case 'projection': s.projection = p.ident(); break;
        case 'width': s.width = p.num(); break;
        case 'ambient': s.ambient = p.vec(); break;
        case 'background':
          if (p.isSym('{')) {
            p.block(function (k2, t2) {
              if (k2 === 'up') { s.bgUp = p.vec(); return; }
              if (/\.map$/i.test(k2) || p.files && pp.findFile(k2) !== null) { s.bgMap = parseMap(k2, t2); return; }
              if (k2 === 'palette' || k2 === 'map') { s.bgMap = parseMap(p.ident(), t2); return; }
              return false;
            });
          } else s.background = p.vec();
          break;
        case 'haze': s.haze = p.num(); break;
        case 'antialias': s.antialias = p.ident(); break;
        case 'threshold': s.threshold = p.num(); break;
        case 'jitter': s.jitter = true; break;
        case 'aperture': s.aperture = p.num(); break;
        case 'focal_length': s.focal = p.num(); break;
        case 'samples': s.samples = Math.max(1, Math.round(p.num())); break;
        case 'no_shadows': s.noShadows = true; break;
        case 'no_exp_trans': s.noExpTrans = true; break;
        case 'caustics': break;
        case 'depth': s.depth = Math.min(20, Math.max(1, Math.round(p.num()))); break;
        case 'bunching': p.num(); break;
        default: return false;
      }
    });
  }

  function parseLight() {
    var L = { type: 'point', falloff: 0, pos: [0, 0, 0], color: [1, 1, 1], dir: null, at: null, from: null,
              radius: 0, samples: 16, minA: 0, maxA: 30, noShadows: false, noSpec: false };
    p.block(function (k) {
      switch (k) {
        case 'type': L.type = p.ident(); break;
        case 'falloff': L.falloff = p.num(); break;
        case 'position': case 'center': L.pos = p.vec(); break;
        case 'color': L.color = p.vec(); break;
        case 'direction': L.dir = p.vec(); break;
        case 'at': L.at = p.vec(); break;
        case 'from': L.from = p.vec(); break;
        case 'radius': L.radius = p.num(); break;
        case 'samples': L.samples = Math.max(1, Math.round(p.num())); break;
        case 'min_angle': L.minA = p.num(); break;
        case 'max_angle': L.maxA = p.num(); break;
        case 'no_shadows': L.noShadows = true; break;
        case 'no_spec': L.noSpec = true; break;
        default: return false;
      }
    });
    // apply current transformation to light geometry
    var M = xstack[xstack.length - 1];
    if (L.type === 'directional') {
      var d = L.dir || (L.from && L.at ? sub(L.at, L.from) : (L.at ? sub(L.at, L.pos) : [0, 0, -1]));
      L.dir = norm(mDir(M, d));
    } else {
      L.pos = mPoint(M, L.from && !L.dir && L.type !== 'spot' ? L.from : L.pos);
      if (L.type === 'spot') {
        var sd = L.dir || (L.at ? sub(L.at, L.pos) : [0, 0, -1]);
        if (L.at && !L.dir) sd = sub(mPoint(M, L.at), L.pos); else sd = mDir(M, sd);
        L.dir = norm(sd);
        L.cosMin = Math.cos(L.minA * DEG); L.cosMax = Math.cos(L.maxA * DEG);
      }
    }
    if (['point', 'directional', 'spherical', 'spot'].indexOf(L.type) < 0) {
      p.warn('ismeretlen fénytípus: ' + L.type + ' (pontfényként kezelve)'); L.type = 'point';
    }
    scene.lights.push(L);
  }

  function parseSubSurface() { // nested surface inside texture
    var s = defaultSurface();
    parseSurfaceBody(s);
    return s;
  }
  function parseTexture(s) {
    var tx = { pattern: 'checker', scale: [1, 1, 1], offset: [0, 0, 0], fuzz: 0, blend: 0, terms: 4, surfs: [] };
    p.block(function (k) {
      switch (k) {
        case 'pattern': tx.pattern = p.ident(); break;
        case 'scale': tx.scale = readScaleVec(); break;
        case 'offset': tx.offset = p.vec(); break;
        case 'fuzz': tx.fuzz = p.num(); break;
        case 'blend': tx.blend = p.num(); break;
        case 'terms': tx.terms = Math.max(1, Math.round(p.num())); break;
        case 'surface': tx.surfs.push(parseSubSurface()); break;
        default: return false;
      }
    });
    if (tx.surfs.length === 0) { tx.surfs.push(cloneSurf(s)); }
    if (tx.surfs.length === 1) { var w = cloneSurf(tx.surfs[0]); w.diffuse = [1, 1, 1]; tx.surfs.push(w); }
    tx.scale = tx.scale.map(function (x) { return x === 0 ? 1 : x; });
    tx.xform = xstack[xstack.length - 1];
    tx.inv = mInv(tx.xform);
    s.texture = tx;
  }
  function sv(x) { return [x, x, x]; }
  function readScaleVec() {
    // either "scale s" or "scale x y z"
    var save = p.i;
    var a = p.parseExpr();
    if (typeof a !== 'number') return a;
    if (p.startsValue()) { p.i = save; return p.vec(); }
    return sv(a);
  }
  function parseBump(s) {
    p.block(function (k) {
      if (k === 'wave') {
        var w = { type: 'wave', center: [0, 0, 0], wavelength: 1, amp: 0.1, damping: 1, phase: 0 };
        p.block(function (k2) {
          switch (k2) {
            case 'center': w.center = p.vec(); break;
            case 'wavelength': w.wavelength = p.num(); break;
            case 'amplitude': case 'amp': w.amp = p.num(); break;
            case 'damping': w.damping = p.num(); break;
            case 'phase': w.phase = p.num(); break;
            default: return false;
          }
        });
        s.bumps.push(w); return;
      }
      if (k === 'turbulence' || k === 'noise') {
        var b = { type: 'turb', scale: [1, 1, 1], offset: [0, 0, 0], amp: 0.5, terms: 4 };
        p.block(function (k2) {
          switch (k2) {
            case 'scale': b.scale = readScaleVec(); break;
            case 'offset': b.offset = p.vec(); break;
            case 'amp': case 'amplitude': b.amp = p.num(); break;
            case 'terms': b.terms = Math.max(1, Math.round(p.num())); break;
            default: return false;
          }
        });
        b.scale = b.scale.map(function (x) { return x === 0 ? 1 : x; });
        s.bumps.push(b); return;
      }
      return false;
    });
  }
  function parseSurfaceBody(s) {
    p.block(function (k) {
      switch (k) {
        case 'diffuse': case 'diff': s.diffuse = p.vec(); break;
        case 'ambient': case 'amb': s.ambient = p.vec(); break;
        case 'specular': case 'spec': s.specular = p.vec(); break;
        case 'shine':
          s.shine = p.num();
          if (p.startsValue()) s.shineColor = p.vec();
          break;
        case 'transparent': case 'trans': s.transparent = p.vec(); break;
        case 'ior': s.ior = p.num(); break;
        case 'fuzz': s.fuzz = p.num(); break;
        case 'no_antialias': s.noAA = true; break;
        case 'texture': parseTexture(s); break;
        case 'bump': parseBump(s); break;
        default: return false;
      }
    });
  }
  function parseSurface() {
    var s = defaultSurface();
    parseSurfaceBody(s);
    surf = s;
  }

  function parseClip() {
    var c = { center: [0, 0, 0], normal: null, radius: null, apex: null, base: null, ar: 0, br: 0, inside: true };
    p.block(function (k) {
      switch (k) {
        case 'center': c.center = p.vec(); break;
        case 'normal': c.normal = p.vec(); break;
        case 'radius': c.radius = p.num(); break;
        case 'apex': c.apex = p.vec(); break;
        case 'base': c.base = p.vec(); break;
        case 'apex_radius': c.ar = p.num(); break;
        case 'base_radius': c.br = p.num(); break;
        case 'inside': c.inside = true; break;
        case 'outside': c.inside = false; break;
        default: return false;
      }
    });
    var M = xstack[xstack.length - 1];
    var r;
    if (c.apex && c.base) {
      var a = mPoint(M, c.apex), b = mPoint(M, c.base);
      var axis = sub(a, b), L = len(axis);
      r = { type: 'cone', base: b, axis: mul(axis, 1 / (L || 1)), len: L, br: c.br, ar: c.ar, inside: c.inside };
    } else if (c.radius !== null && !c.normal) {
      r = { type: 'sphere', center: mPoint(M, c.center), r2: c.radius * c.radius, inside: c.inside };
    } else {
      var inv = mInv(M);
      r = { type: 'plane', center: mPoint(M, c.center), normal: norm(mNormal(inv, c.normal || [0, 0, 1])) };
    }
    return r;
  }

  function finishPrim(prim, localClips) {
    var M = xstack[xstack.length - 1];
    prim.surf = surf;
    if (!mIsIdent(M)) { prim.M = M; prim.inv = mInv(M); }
    var clips = gclips[gclips.length - 1].concat(pendingClips, localClips);
    pendingClips = [];
    prim.clips = clips.length ? clips : null;
    scene.prims.push(prim);
  }

  function parsePrim(kind, t0) {
    var prim = { kind: kind }, clips = [];
    if (kind === 'sphere') {
      prim.center = [0, 0, 0]; prim.radius = 1; prim.fuzz = 0;
      p.block(function (k) {
        switch (k) {
          case 'center': prim.center = p.vec(); break;
          case 'radius': prim.radius = Math.abs(p.num()); break;
          case 'fuzz': prim.fuzz = p.num(); break;
          case 'clip': clips.push(parseClip()); break;
          default: return false;
        }
      });
    } else if (kind === 'ring') {
      prim.center = [0, 0, 0]; prim.normal = [0, 0, 1]; prim.rmin = 0; prim.rmax = 1;
      p.block(function (k) {
        switch (k) {
          case 'center': prim.center = p.vec(); break;
          case 'normal': prim.normal = p.vec(); break;
          case 'radius': prim.rmin = 0; prim.rmax = p.num(); break;
          case 'min_radius': prim.rmin = p.num(); break;
          case 'max_radius': prim.rmax = p.num(); break;
          case 'clip': clips.push(parseClip()); break;
          default: return false;
        }
      });
      prim.normal = norm(prim.normal);
    } else if (kind === 'polygon') {
      prim.pts = [];
      var declared = -1;
      p.block(function (k) {
        switch (k) {
          case 'points': declared = Math.round(p.num()); break;
          case 'vertex': prim.pts.push(p.vec()); break;
          case 'clip': clips.push(parseClip()); break;
          default: return false;
        }
      });
      if (declared >= 0 && declared !== prim.pts.length) p.warn('polygon: points ' + declared + ' de ' + prim.pts.length + ' vertex', t0);
      if (prim.pts.length < 3) { p.warn('polygon: legalább 3 csúcs kell – kihagyva', t0); return; }
    } else if (kind === 'patch') {
      prim.pts = []; prim.nrm = [];
      p.block(function (k) {
        switch (k) {
          case 'vertex': prim.pts.push(p.vec()); break;
          case 'normal': prim.nrm.push(p.vec()); break;
          case 'clip': clips.push(parseClip()); break;
          default: return false;
        }
      });
      if (prim.pts.length !== 3) { p.warn('patch: pontosan 3 csúcs kell – kihagyva', t0); return; }
      while (prim.nrm.length < 3) prim.nrm.push(null);
    } else if (kind === 'cone') {
      prim.base = [0, 0, 0]; prim.apex = [0, 0, 1]; prim.br = 1; prim.ar = 0;
      var single = null;
      p.block(function (k) {
        switch (k) {
          case 'base': prim.base = p.vec(); break;
          case 'apex': prim.apex = p.vec(); break;
          case 'base_radius': prim.br = p.num(); break;
          case 'apex_radius': prim.ar = p.num(); break;
          case 'radius': single = p.num(); break;
          case 'clip': clips.push(parseClip()); break;
          default: return false;
        }
      });
      if (single !== null) { prim.br = single; prim.ar = single; }
    }
    finishPrim(prim, clips);
  }

  function parseTransform() {
    var M = mIdent();
    p.block(function (k) {
      switch (k) {
        case 'scale': M = mMul(mScale(readScaleVec()), M); break;
        case 'rotate': {
          var r = p.vec();
          M = mMul(mRotX(r[0] * DEG), M); M = mMul(mRotY(r[1] * DEG), M); M = mMul(mRotZ(r[2] * DEG), M);
          break;
        }
        case 'translate': M = mMul(mTrans(p.vec()), M); break;
        default: return false;
      }
    });
    xstack.push(mMul(xstack[xstack.length - 1], M));
  }

  while (p.i < p.tk.length) {
    var t = p.next();
    if (t.t !== 'i') throw new VividError("Kulcsszó várt, de ez jött: '" + t.v + "'", t);
    switch (t.v) {
      case 'studio': parseStudio(); break;
      case 'light': parseLight(); break;
      case 'surface': parseSurface(); break;
      case 'sphere': case 'ring': case 'polygon': case 'patch': case 'cone': parsePrim(t.v, t); break;
      case 'transform': parseTransform(); break;
      case 'transform_pop':
        if (xstack.length > 1) xstack.pop(); else p.warn('transform_pop üres veremre', t);
        break;
      case 'clip': pendingClips.push(parseClip()); break;
      case 'global_clip': {
        var list = gclips[gclips.length - 1].slice();
        p.block(function (k) { if (k === 'clip') { list.push(parseClip()); return; } return false; });
        gclips.push(list); break;
      }
      case 'clip_pop':
        if (gclips.length > 1) gclips.pop(); else p.warn('clip_pop üres veremre', t);
        break;
      default:
        p.skipUnknown(t);
    }
  }
  if (!scene.studio.hasStudio) warnings.push('Nincs studio blokk – alapértékek használva');
  return scene;
}

// ---------------------------------------------------------------- noise
var PERM = (function () {
  var p = new Uint8Array(512), r = 12345;
  var a = []; for (var i = 0; i < 256; i++) a.push(i);
  for (i = 255; i > 0; i--) { r = (r * 1103515245 + 12345) & 0x7fffffff; var j = r % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
  for (i = 0; i < 512; i++) p[i] = a[i & 255];
  return p;
})();
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(h, x, y, z) {
  h &= 15; var u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise3(x, y, z) {
  var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  var u = fade(x), v = fade(y), w = fade(z), P = PERM;
  var A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(w, lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)),
                         lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))),
                 lerp(v, lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)),
                         lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1))));
}
function turbulence(p, terms) {
  var s = 0, f = 1;
  for (var i = 0; i < terms; i++) { s += Math.abs(noise3(p[0] * f, p[1] * f, p[2] * f)) / f; f *= 2; }
  return s;
}
function turbVec(p, terms) {
  return [turbulence(p, terms) - 0.35, turbulence([p[0] + 31.4, p[1] + 17.7, p[2] + 9.2], terms) - 0.35,
          turbulence([p[0] - 13.1, p[1] + 47.3, p[2] - 21.9], terms) - 0.35];
}

// ---------------------------------------------------------------- geometry setup
var EPS = 1e-6;

function setupPrim(o) {
  // object-space data + world AABB
  var bmin, bmax, i;
  switch (o.kind) {
    case 'sphere':
      o.r2 = o.radius * o.radius;
      bmin = sub(o.center, [o.radius, o.radius, o.radius]); bmax = add(o.center, [o.radius, o.radius, o.radius]);
      break;
    case 'ring': {
      o.d = dot(o.normal, o.center);
      var r = o.rmax;
      bmin = sub(o.center, [r, r, r]); bmax = add(o.center, [r, r, r]);
      break;
    }
    case 'polygon': {
      // Newell normal
      var n = [0, 0, 0], P = o.pts;
      for (i = 0; i < P.length; i++) {
        var a = P[i], b = P[(i + 1) % P.length];
        n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
      }
      o.normal = norm(n); o.d = dot(o.normal, P[0]);
      var an = [Math.abs(o.normal[0]), Math.abs(o.normal[1]), Math.abs(o.normal[2])];
      o.ax = an[0] > an[1] && an[0] > an[2] ? 0 : (an[1] > an[2] ? 1 : 2);
      o.u = (o.ax + 1) % 3; o.v = (o.ax + 2) % 3;
      o.pu = P.map(function (q) { return q[o.u]; }); o.pv = P.map(function (q) { return q[o.v]; });
      bmin = P[0].slice(); bmax = P[0].slice();
      P.forEach(function (q) { for (var k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], q[k]); bmax[k] = Math.max(bmax[k], q[k]); } });
      break;
    }
    case 'patch': {
      var p0 = o.pts[0], p1 = o.pts[1], p2 = o.pts[2];
      o.e1 = sub(p1, p0); o.e2 = sub(p2, p0);
      o.gn = norm(cross(o.e1, o.e2));
      o.nrm = o.nrm.map(function (q) { return q ? norm(q) : o.gn; });
      bmin = p0.slice(); bmax = p0.slice();
      o.pts.forEach(function (q) { for (var k = 0; k < 3; k++) { bmin[k] = Math.min(bmin[k], q[k]); bmax[k] = Math.max(bmax[k], q[k]); } });
      break;
    }
    case 'cone': {
      var ax = sub(o.apex, o.base); o.len = len(ax); o.w = mul(ax, 1 / (o.len || 1));
      o.k = (o.ar - o.br) / (o.len || 1);
      var R = Math.max(Math.abs(o.br), Math.abs(o.ar));
      bmin = [Math.min(o.base[0], o.apex[0]) - R, Math.min(o.base[1], o.apex[1]) - R, Math.min(o.base[2], o.apex[2]) - R];
      bmax = [Math.max(o.base[0], o.apex[0]) + R, Math.max(o.base[1], o.apex[1]) + R, Math.max(o.base[2], o.apex[2]) + R];
      break;
    }
  }
  // expand degenerate boxes
  for (i = 0; i < 3; i++) { bmin[i] -= 1e-4; bmax[i] += 1e-4; }
  if (o.M) {
    var wmin = [Infinity, Infinity, Infinity], wmax = [-Infinity, -Infinity, -Infinity];
    for (var c = 0; c < 8; c++) {
      var q = mPoint(o.M, [c & 1 ? bmax[0] : bmin[0], c & 2 ? bmax[1] : bmin[1], c & 4 ? bmax[2] : bmin[2]]);
      for (var k = 0; k < 3; k++) { wmin[k] = Math.min(wmin[k], q[k]); wmax[k] = Math.max(wmax[k], q[k]); }
    }
    bmin = wmin; bmax = wmax;
  }
  o.bmin = bmin; o.bmax = bmax;
  o.cen = [(bmin[0] + bmax[0]) / 2, (bmin[1] + bmax[1]) / 2, (bmin[2] + bmax[2]) / 2];
}

// candidate hits in object space; pushes t values (ascending) into out
function primRoots(o, O, D, out) {
  switch (o.kind) {
    case 'sphere': {
      var oc = sub(O, o.center), a = dot(D, D), b = dot(oc, D), c = dot(oc, oc) - o.r2;
      var disc = b * b - a * c; if (disc < 0) return;
      var s = Math.sqrt(disc);
      out.push((-b - s) / a, (-b + s) / a); return;
    }
    case 'ring': {
      var dn = dot(o.normal, D); if (Math.abs(dn) < 1e-12) return;
      var t = (o.d - dot(o.normal, O)) / dn;
      var P = madd(O, D, t), dd = len(sub(P, o.center));
      if (dd >= o.rmin && dd <= o.rmax) out.push(t);
      return;
    }
    case 'polygon': {
      var dn2 = dot(o.normal, D); if (Math.abs(dn2) < 1e-12) return;
      var t2 = (o.d - dot(o.normal, O)) / dn2;
      var Pu = O[o.u] + D[o.u] * t2, Pv = O[o.v] + D[o.v] * t2;
      var inside = false, pu = o.pu, pv = o.pv, n = pu.length;
      for (var i = 0, j = n - 1; i < n; j = i++) {
        if ((pv[i] > Pv) !== (pv[j] > Pv) && Pu < (pu[j] - pu[i]) * (Pv - pv[i]) / (pv[j] - pv[i]) + pu[i]) inside = !inside;
      }
      if (inside) out.push(t2);
      return;
    }
    case 'patch': {
      var pvec = cross(D, o.e2), det = dot(o.e1, pvec);
      if (Math.abs(det) < 1e-14) return;
      var inv = 1 / det, tv = sub(O, o.pts[0]);
      var u = dot(tv, pvec) * inv; if (u < -1e-9 || u > 1 + 1e-9) return;
      var q = cross(tv, o.e1), v = dot(D, q) * inv; if (v < -1e-9 || u + v > 1 + 1e-9) return;
      out.push(dot(o.e2, q) * inv); return;
    }
    case 'cone': {
      var Ob = sub(O, o.base), w = o.w, k = o.k;
      var Oa = dot(Ob, w), Da = dot(D, w);
      var Op = madd(Ob, w, -Oa), Dp = madd(D, w, -Da);
      var rr = o.br + k * Oa;
      var A = dot(Dp, Dp) - k * k * Da * Da;
      var B = 2 * (dot(Op, Dp) - k * rr * Da);
      var C = dot(Op, Op) - rr * rr;
      var ts = [];
      if (Math.abs(A) < 1e-14) { if (Math.abs(B) > 1e-14) ts.push(-C / B); }
      else {
        var disc2 = B * B - 4 * A * C; if (disc2 < 0) return;
        var s2 = Math.sqrt(disc2);
        var t0 = (-B - s2) / (2 * A), t1 = (-B + s2) / (2 * A);
        if (t0 > t1) { var tt = t0; t0 = t1; t1 = tt; }
        ts.push(t0, t1);
      }
      for (var m = 0; m < ts.length; m++) {
        var h = Oa + Da * ts[m];
        if (h >= 0 && h <= o.len && o.br + k * h >= -1e-9) out.push(ts[m]);
      }
      return;
    }
  }
}

function primNormal(o, P, D) { // object-space point; returns object-space normal (unnormalized ok)
  switch (o.kind) {
    case 'sphere': return sub(P, o.center);
    case 'ring': case 'polygon': return o.normal;
    case 'patch': {
      // barycentric interpolation
      var v0 = o.e1, v1 = o.e2, v2 = sub(P, o.pts[0]);
      var d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1);
      var den = d00 * d11 - d01 * d01 || 1e-30;
      var b1 = (d11 * d20 - d01 * d21) / den, b2 = (d00 * d21 - d01 * d20) / den, b0 = 1 - b1 - b2;
      var n = add(add(mul(o.nrm[0], b0), mul(o.nrm[1], b1)), mul(o.nrm[2], b2));
      // keep consistent orientation with geometric normal
      if (dot(n, o.gn) < 0) n = mul(n, -1);
      return n;
    }
    case 'cone': {
      var Pb = sub(P, o.base), h = dot(Pb, o.w);
      var radial = norm(madd(Pb, o.w, -h));
      return sub(radial, mul(o.w, o.k));
    }
  }
}

function clipOK(clips, P) {
  for (var i = 0; i < clips.length; i++) {
    var c = clips[i];
    if (c.type === 'plane') { if (dot(sub(P, c.center), c.normal) < 0) return false; }
    else if (c.type === 'sphere') {
      var d = sub(P, c.center), d2 = dot(d, d);
      if (c.inside ? d2 > c.r2 : d2 < c.r2) return false;
    } else if (c.type === 'cone') {
      var Pb = sub(P, c.base), h = dot(Pb, c.axis);
      var r = c.br + (c.ar - c.br) * (h / (c.len || 1));
      var rad = len(madd(Pb, c.axis, -h));
      var inCone = h >= 0 && h <= c.len && rad <= r;
      if (c.inside ? !inCone : inCone) return false;
    }
  }
  return true;
}

var ROOTS = [];
function intersectPrim(o, O, D, tmax) {
  var Oo = O, Do = D;
  if (o.inv) { Oo = mPoint(o.inv, O); Do = mDir(o.inv, D); }
  ROOTS.length = 0;
  primRoots(o, Oo, Do, ROOTS);
  var best = Infinity;
  for (var i = 0; i < ROOTS.length; i++) {
    var t = ROOTS[i];
    if (t > EPS && t < tmax && t < best) {
      if (o.clips) { if (!clipOK(o.clips, madd(O, D, t))) continue; }
      best = t;
    }
  }
  return best;
}

// ---------------------------------------------------------------- BVH
function buildBVH(prims) {
  var nodes = [];
  function bounds(list, s, e) {
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (var i = s; i < e; i++) for (var k = 0; k < 3; k++) {
      if (list[i].bmin[k] < mn[k]) mn[k] = list[i].bmin[k];
      if (list[i].bmax[k] > mx[k]) mx[k] = list[i].bmax[k];
    }
    return [mn, mx];
  }
  function build(list, s, e) {
    var b = bounds(list, s, e);
    var node = { mn: b[0], mx: b[1], l: null, r: null, prims: null };
    if (e - s <= 4) { node.prims = list.slice(s, e); return node; }
    var ext = sub(b[1], b[0]);
    var ax = ext[0] > ext[1] && ext[0] > ext[2] ? 0 : (ext[1] > ext[2] ? 1 : 2);
    var sorted = list.slice(s, e).sort(function (a, c) { return a.cen[ax] - c.cen[ax]; });
    for (var i = 0; i < sorted.length; i++) list[s + i] = sorted[i];
    var m = (s + e) >> 1;
    node.l = build(list, s, m); node.r = build(list, m, e);
    return node;
  }
  if (!prims.length) return null;
  return build(prims.slice(), 0, prims.length);
}
function boxHit(n, O, invD, tmax) {
  var t0 = 0, t1 = tmax;
  for (var k = 0; k < 3; k++) {
    var a = (n.mn[k] - O[k]) * invD[k], b = (n.mx[k] - O[k]) * invD[k];
    if (a > b) { var t = a; a = b; b = t; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- renderer
function Renderer(scene, opts) {
  opts = opts || {};
  this.scene = scene;
  var s = this.st = scene.studio;
  this.prims = scene.prims;
  this.prims.forEach(setupPrim);
  this.bvh = buildBVH(this.prims);
  this.lights = scene.lights;
  this.maxDepth = opts.depth || s.depth;
  this.noShadows = s.noShadows || !!opts.noShadows;
  this.aa = opts.antialias || s.antialias;
  this.aa = ({ n: 'none', q: 'quick', c: 'corners', a: 'adaptive' })[(this.aa || 'n')[0]] || 'none';
  this.threshold = (opts.threshold !== undefined ? opts.threshold : s.threshold) / 255;
  this.W = opts.res ? opts.res[0] : s.res[0];
  this.H = opts.res ? opts.res[1] : s.res[1];
  this.rays = 0; this.shadowRays = 0;
  // camera
  var aspect = opts.squarePixels === false ? s.aspect : this.W / this.H;
  this.aspect = aspect;
  var dir = sub(s.at, s.from);
  this.focal = s.focal > 0 ? s.focal : len(dir);
  this.dir = norm(dir);
  var right = cross(this.dir, s.up);
  if (len(right) < 1e-9) right = cross(this.dir, Math.abs(this.dir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
  this.right = norm(right);
  this.upv = norm(cross(this.right, this.dir));
  this.halfW = Math.tan(Math.min(179, s.angle) * DEG / 2);
  this.halfH = this.halfW / aspect;
  this.worldUp = norm(s.up);
  if (s.projection === 'parallax') {
    var h = dot(dir, this.worldUp);
    var horiz = madd(dir, this.worldUp, -h);
    if (len(horiz) > 1e-9) {
      this.pdir = norm(horiz);
      this.pright = norm(cross(this.pdir, this.worldUp));
      this.pup = this.worldUp;
      this.pshift = h / len(horiz);
    } else s.projection = 'flat';
  }
  this.bgUp = norm(s.bgUp || s.up);
}

Renderer.prototype.intersect = function (O, D, tmax) {
  var node = this.bvh; if (!node) return null;
  var invD = [1 / D[0], 1 / D[1], 1 / D[2]];
  var stack = [node], best = tmax, bo = null;
  while (stack.length) {
    var n = stack.pop();
    if (!boxHit(n, O, invD, best)) continue;
    if (n.prims) {
      for (var i = 0; i < n.prims.length; i++) {
        var t = intersectPrim(n.prims[i], O, D, best);
        if (t < best) { best = t; bo = n.prims[i]; }
      }
    } else { stack.push(n.l); stack.push(n.r); }
  }
  return bo ? { t: best, o: bo } : null;
};

// transmission along a shadow ray (1 = fully lit)
Renderer.prototype.shadow = function (O, D, dist) {
  this.shadowRays++;
  var T = [1, 1, 1], start = O, remaining = dist, guard = 0;
  while (guard++ < 16) {
    var h = this.intersect(start, D, remaining);
    if (!h) return T;
    var tr = h.o.surf.transparent;
    if (isZero(tr)) return null;
    T = cmul(T, tr);
    if (maxc(T) < 0.004) return null;
    start = madd(start, D, h.t); remaining -= h.t;
  }
  return T;
};

Renderer.prototype.background = function (D) {
  var s = this.st;
  if (s.bgMap) {
    var c = dot(D, this.bgUp); // 1 = up
    var idx = Math.round((1 - c) / 2 * (s.bgMap.length - 1));
    idx = Math.max(0, Math.min(s.bgMap.length - 1, idx));
    return s.bgMap[idx];
  }
  return s.background;
};

Renderer.prototype.evalSurface = function (o, P) {
  var s = o.surf;
  if (!s.texture) return s;
  var tx = s.texture;
  var q = mPoint(tx.inv, P);
  q = [q[0] / tx.scale[0] + tx.offset[0], q[1] / tx.scale[1] + tx.offset[1], q[2] / tx.scale[2] + tx.offset[2]];
  if (tx.fuzz) { var tv = turbVec(q, 3); q = madd(q, tv, tx.fuzz); }
  var f; // 0..1 weight of second surface
  switch (tx.pattern) {
    case 'checker': {
      var sum = Math.floor(q[0] + 1e-7) + Math.floor(q[1] + 1e-7) + Math.floor(q[2] + 1e-7);
      f = (sum & 1) ? 1 : 0;
      if (tx.blend > 0) {
        // soften near cell boundaries
        var dmin = 1;
        for (var k = 0; k < 3; k++) {
          var fr = q[k] - Math.floor(q[k]), dd = Math.min(fr, 1 - fr);
          if (dd > 1e-6) dmin = Math.min(dmin, dd); // skip axes lying exactly on a cell boundary (e.g. floor z=0)
        }
        if (dmin < tx.blend) f = 0.5 + (f - 0.5) * (dmin / tx.blend);
      }
      break;
    }
    case 'spherical': case 'sphere': {
      var r = len(q), fr2 = r - Math.floor(r);
      f = Math.floor(r) & 1 ? 1 : 0;
      if (tx.blend > 0) { var e = Math.min(fr2, 1 - fr2); if (e < tx.blend) f = 0.5 + (f - 0.5) * (e / tx.blend); }
      break;
    }
    case 'noise': case 'turbulence': default:
      f = Math.min(1, Math.max(0, turbulence(q, tx.terms) * 1.4));
      if (tx.blend > 0) f = Math.min(1, Math.max(0, (f - 0.5) / Math.max(tx.blend, 1e-3) + 0.5));
  }
  var a = tx.surfs[0], b = tx.surfs[1];
  if (a.texture) a = this.evalSurface({ surf: a }, P);
  if (b.texture) b = this.evalSurface({ surf: b }, P);
  if (f <= 0) return a; if (f >= 1) return b;
  function mix(x, y) { return [x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f, x[2] + (y[2] - x[2]) * f]; }
  return {
    diffuse: mix(a.diffuse, b.diffuse), ambient: mix(a.ambient, b.ambient), specular: mix(a.specular, b.specular),
    shine: a.shine + (b.shine - a.shine) * f,
    shineColor: a.shineColor || b.shineColor ? mix(a.shineColor || a.specular, b.shineColor || b.specular) : null,
    transparent: mix(a.transparent, b.transparent), ior: a.ior + (b.ior - a.ior) * f,
    fuzz: a.fuzz + (b.fuzz - a.fuzz) * f, bumps: a.bumps.concat(b.bumps), noAA: a.noAA || b.noAA
  };
};

Renderer.prototype.trace = function (O, D, depth, inside) {
  this.rays++;
  var st = this.st;
  var h = this.intersect(O, D, Infinity);
  if (!h) return this.background(D);
  var o = h.o, t = h.t;
  var P = madd(O, D, t);
  var N;
  if (o.inv) {
    var Po = mPoint(o.inv, P);
    N = norm(mNormal(o.inv, primNormal(o, Po, mDir(o.inv, D))));
  } else N = norm(primNormal(o, P, D));
  var s = this.evalSurface(o, P);
  // bump mapping
  if (s.bumps && s.bumps.length) {
    for (var bi = 0; bi < s.bumps.length; bi++) {
      var b = s.bumps[bi];
      if (b.type === 'wave') {
        var dv = sub(P, b.center), dl = len(dv);
        var hgt = b.amp * Math.cos(2 * Math.PI * dl / (b.wavelength || 1) + b.phase * 2 * Math.PI) * Math.exp(-b.damping * dl);
        N = norm(madd(N, norm(dv), hgt));
      } else {
        var qq = [P[0] / b.scale[0] + b.offset[0], P[1] / b.scale[1] + b.offset[1], P[2] / b.scale[2] + b.offset[2]];
        N = norm(madd(N, turbVec(qq, b.terms), b.amp));
      }
    }
  }
  var fz = s.fuzz + (o.fuzz || 0);
  if (fz > 0) N = norm([N[0] + (Math.random() * 2 - 1) * fz, N[1] + (Math.random() * 2 - 1) * fz, N[2] + (Math.random() * 2 - 1) * fz]);
  var backface = dot(N, D) > 0;
  if (backface) N = mul(N, -1);
  var Pn = madd(P, N, 1e-5); // offset point for secondary rays
  var V = mul(D, -1);

  var col = cmul(s.diffuse, st.ambient);
  col = add(col, s.ambient);
  var hiCol = s.shineColor || s.specular;
  for (var li = 0; li < this.lights.length; li++) {
    var L = this.lights[li], Ldir, dist, I = L.color;
    if (L.type === 'directional') { Ldir = mul(L.dir, -1); dist = Infinity; }
    else {
      var lv = sub(L.pos, P); dist = len(lv); Ldir = mul(lv, 1 / dist);
      if (L.falloff === 1) I = mul(I, 1 / dist); else if (L.falloff >= 2) I = mul(I, 1 / (dist * dist));
      if (L.type === 'spot') {
        var ca = dot(mul(Ldir, -1), L.dir);
        if (ca < L.cosMax) continue;
        if (ca < L.cosMin) I = mul(I, (ca - L.cosMax) / (L.cosMin - L.cosMax || 1));
      }
    }
    var ndl = dot(N, Ldir);
    if (ndl <= 0) continue;
    var vis = [1, 1, 1];
    if (!this.noShadows && !L.noShadows) {
      if (L.type === 'spherical' && L.radius > 0) {
        var acc = [0, 0, 0], ns = L.samples;
        for (var k = 0; k < ns; k++) {
          var rp;
          do { rp = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]; } while (dot(rp, rp) > 1);
          var tp = madd(L.pos, rp, L.radius), sv2 = sub(tp, Pn), sd = len(sv2);
          var tr = this.shadow(Pn, mul(sv2, 1 / sd), sd - 1e-4);
          if (tr) acc = add(acc, tr);
        }
        vis = mul(acc, 1 / ns);
      } else {
        vis = this.shadow(Pn, Ldir, dist === Infinity ? Infinity : dist - 1e-4);
      }
      if (!vis) continue;
    }
    var Ie = cmul(I, vis);
    col = add(col, mul(cmul(s.diffuse, Ie), ndl));
    if (s.shine > 0 && !L.noSpec && !isZero(hiCol)) {
      var R = sub(mul(N, 2 * ndl), Ldir);
      var rv = dot(R, V);
      if (rv > 0) col = add(col, mul(cmul(hiCol, Ie), Math.pow(rv, s.shine)));
    }
  }
  if (depth < this.maxDepth) {
    if (!isZero(s.specular)) {
      var Rd = sub(D, mul(N, 2 * dot(D, N)));
      col = add(col, cmul(s.specular, this.trace(Pn, norm(Rd), depth + 1, inside)));
    }
    if (!isZero(s.transparent)) {
      var eta = backface ? s.ior : 1 / s.ior;
      var cosi = -dot(D, N), k2 = 1 - eta * eta * (1 - cosi * cosi);
      var Pi = madd(P, N, -1e-5), Td;
      if (k2 < 0) { Td = sub(D, mul(N, 2 * dot(D, N))); Pi = Pn; }
      else Td = norm(add(mul(D, eta), mul(N, eta * cosi - Math.sqrt(k2))));
      col = add(col, cmul(s.transparent, this.trace(Pi, Td, depth + 1, !backface)));
    }
  }
  // exponential attenuation inside transparent material
  if (backface && !st.noExpTrans && !isZero(s.transparent)) {
    col = [col[0] * Math.pow(s.transparent[0], t), col[1] * Math.pow(s.transparent[1], t), col[2] * Math.pow(s.transparent[2], t)];
  }
  if (st.haze > 0) {
    var f = Math.pow(1 - Math.min(st.haze, 0.9999), t);
    var bg = this.st.background;
    col = [col[0] * f + bg[0] * (1 - f), col[1] * f + bg[1] * (1 - f), col[2] * f + bg[2] * (1 - f)];
  }
  return col;
};

// primary ray for image-plane position (x, y in pixel units, can be fractional)
Renderer.prototype.primary = function (x, y) {
  var st = this.st, W = this.W, H = this.H;
  var sx = (2 * x / W - 1), sy = (1 - 2 * y / H);
  var O = st.from, D;
  switch (st.projection) {
    case 'orthographic': {
      var hw = st.width / 2, hh = hw / this.aspect;
      O = madd(madd(st.from, this.right, sx * hw), this.upv, sy * hh);
      D = this.dir; break;
    }
    case 'spherical': {
      var ang = st.angle * DEG;
      var lon = sx * ang / 2, lat = sy * ang / 2 / this.aspect;
      var cl = Math.cos(lat);
      D = norm(add(add(mul(this.dir, cl * Math.cos(lon)), mul(this.right, cl * Math.sin(lon))), mul(this.upv, Math.sin(lat))));
      break;
    }
    case 'parallax':
      D = norm(add(add(this.pdir, mul(this.pright, sx * this.halfW)), mul(this.pup, sy * this.halfH + this.pshift)));
      break;
    default:
      D = norm(add(add(this.dir, mul(this.right, sx * this.halfW)), mul(this.upv, sy * this.halfH)));
  }
  if (st.aperture > 0) {
    var acc = [0, 0, 0], n = st.samples;
    var focusP = madd(O, D, this.focal / Math.max(1e-6, dot(D, this.dir)));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 2 * Math.PI, r = Math.sqrt(Math.random()) * st.aperture;
      var Ol = madd(madd(O, this.right, Math.cos(a) * r), this.upv, Math.sin(a) * r);
      acc = add(acc, this.trace(Ol, norm(sub(focusP, Ol)), 1, false));
    }
    return mul(acc, 1 / n);
  }
  return this.trace(O, D, 1, false);
};

Renderer.prototype.sample = function (x, y) {
  if (this.st.jitter) { x += (Math.random() - 0.5) * 0.5; y += (Math.random() - 0.5) * 0.5; }
  var c = this.primary(x, y);
  return [Math.min(1, Math.max(0, c[0])), Math.min(1, Math.max(0, c[1])), Math.min(1, Math.max(0, c[2]))];
};

function cdiff(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }

// adaptive subdivision over a square [x,x+s]x[y,y+s] with known corners
Renderer.prototype.adapt = function (x, y, s, c00, c10, c01, c11, lvl) {
  var th = this.threshold;
  if (lvl >= 2 || (cdiff(c00, c10) <= th && cdiff(c00, c01) <= th && cdiff(c00, c11) <= th &&
                   cdiff(c10, c11) <= th && cdiff(c01, c11) <= th && cdiff(c10, c01) <= th)) {
    return [(c00[0] + c10[0] + c01[0] + c11[0]) / 4, (c00[1] + c10[1] + c01[1] + c11[1]) / 4, (c00[2] + c10[2] + c01[2] + c11[2]) / 4];
  }
  var h = s / 2;
  var cm0 = this.sample(x + h, y), c0m = this.sample(x, y + h), cmm = this.sample(x + h, y + h),
      c1m = this.sample(x + s, y + h), cm1 = this.sample(x + h, y + s);
  var a = this.adapt(x, y, h, c00, cm0, c0m, cmm, lvl + 1);
  var b = this.adapt(x + h, y, h, cm0, c10, cmm, c1m, lvl + 1);
  var c = this.adapt(x, y + h, h, c0m, cmm, c01, cm1, lvl + 1);
  var d = this.adapt(x + h, y + h, h, cmm, c1m, cm1, c11, lvl + 1);
  return [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4];
};

// Render rows [y0, y1). Returns RGBA bytes. state keeps the corner row cache.
Renderer.prototype.renderRows = function (y0, y1, state) {
  var W = this.W, out = new Uint8ClampedArray(W * (y1 - y0) * 4);
  var mode = this.aa;
  function put(i, c) { out[i] = c[0] * 255 + 0.5; out[i + 1] = c[1] * 255 + 0.5; out[i + 2] = c[2] * 255 + 0.5; out[i + 3] = 255; }
  for (var y = y0; y < y1; y++) {
    var base = (y - y0) * W * 4;
    if (mode === 'none') {
      for (var x = 0; x < W; x++) put(base + x * 4, this.sample(x + 0.5, y + 0.5));
    } else if (mode === 'quick') {
      // one sample per 2x2 block, interpolate when neighbours agree
      if ((y & 1) === 0 || !state.quickRow || state.quickY !== y - 1) {
        var row = [];
        for (var x2 = 0; x2 < W; x2 += 2) row.push(this.sample(x2 + 1, y + 1));
        state.quickRow = row; state.quickY = y;
      }
      for (var x3 = 0; x3 < W; x3++) put(base + x3 * 4, state.quickRow[x3 >> 1]);
    } else {
      var top = state.cornerY === y ? state.corner : null;
      if (!top) { top = []; for (var cx = 0; cx <= W; cx++) top.push(this.sample(cx, y)); }
      var bot = []; for (var cx2 = 0; cx2 <= W; cx2++) bot.push(this.sample(cx2, y + 1));
      for (var x4 = 0; x4 < W; x4++) {
        var c;
        if (mode === 'corners') {
          c = [(top[x4][0] + top[x4 + 1][0] + bot[x4][0] + bot[x4 + 1][0]) / 4,
               (top[x4][1] + top[x4 + 1][1] + bot[x4][1] + bot[x4 + 1][1]) / 4,
               (top[x4][2] + top[x4 + 1][2] + bot[x4][2] + bot[x4 + 1][2]) / 4];
        } else c = this.adapt(x4, y, 1, top[x4], top[x4 + 1], bot[x4], bot[x4 + 1], 0);
        put(base + x4 * 4, c);
      }
      state.corner = bot; state.cornerY = y + 1;
    }
  }
  return out;
};

Renderer.prototype.rowRange = function () {
  var st = this.st, H = this.H;
  var a = Math.max(0, Math.min(H, st.start || 0));
  var b = st.stop >= 0 ? Math.min(H, st.stop + 1) : H;
  if (b <= a) b = H;
  return [a, b];
};

// ---------------------------------------------------------------- exports
var api = { parseScene: parseScene, Renderer: Renderer, VividError: VividError, version: '1.0' };
root.VividCore = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

// ---------------------------------------------------------------- worker glue
if (typeof self !== 'undefined' && typeof importScripts === 'function' && typeof window === 'undefined') {
  var cancelled = false;
  self.onmessage = function (ev) {
    var m = ev.data;
    if (m.cmd === 'cancel') { cancelled = true; return; }
    if (m.cmd !== 'render') return;
    cancelled = false;
    var t0 = Date.now(), scene, r;
    try {
      scene = parseScene(m.files, m.main);
      r = new Renderer(scene, m.opts);
    } catch (e) {
      self.postMessage({ type: 'error', msg: e.message || String(e), file: e.file || null, line: e.line || null, warnings: scene ? scene.warnings : [] });
      return;
    }
    var rr = r.rowRange();
    self.postMessage({ type: 'start', w: r.W, h: r.H, y0: rr[0], y1: rr[1], warnings: scene.warnings,
                       prims: scene.prims.length, lights: scene.lights.length, aa: r.aa });
    var state = {}, y = rr[0];
    function step() {
      if (cancelled) { self.postMessage({ type: 'cancelled', y: y }); return; }
      var t1 = Date.now();
      try {
        while (y < rr[1] && Date.now() - t1 < 120) {
          var buf = r.renderRows(y, y + 1, state);
          self.postMessage({ type: 'rows', y: y, n: 1, data: buf.buffer }, [buf.buffer]);
          y++;
        }
      } catch (e) {
        self.postMessage({ type: 'error', msg: 'Renderelési hiba: ' + (e.message || e), warnings: [] }); return;
      }
      self.postMessage({ type: 'progress', y: y, rays: r.rays, shadow: r.shadowRays, ms: Date.now() - t0 });
      if (y < rr[1]) setTimeout(step, 0);
      else self.postMessage({ type: 'done', ms: Date.now() - t0, rays: r.rays, shadow: r.shadowRays });
    }
    step();
  };
}
})(typeof self !== 'undefined' ? self : this);
