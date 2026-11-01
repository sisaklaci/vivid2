"""Headless UI test: loads dist/index.html at https://vivid.local/ (like
WebView.loadDataWithBaseURL) with a mock Android bridge, imports a test ZIP,
edits + saves a file, renders, exports."""
import os, sys, io, zipfile, json, time
from playwright.sync_api import sync_playwright

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
html = open(os.path.join(root, 'dist/index.html'), encoding='utf-8').read()
out = os.path.join(root, 'out')

# test zip: deflated + stored, uppercase DOS names, CRLF, ^Z, one binary
zbuf = io.BytesIO()
with zipfile.ZipFile(zbuf, 'w') as z:
    z.writestr(zipfile.ZipInfo('TEST1.V'), (
        "#include color.vc\r\n// teszt\r\nstudio { from 0 -8 2 at 0 0 0.8 up 0 0 1 angle 40 res 200 125 aspect 1.6\r\n"
        " background sky_blue antialias adaptive }\r\nlight { type point position 5 -5 8 color white }\r\n"
        "surface { diffuse 0.9 0.4 0.1 shine 30 white }\r\nsphere { center 0 0 1 radius 1 }\r\n"
        "surface { diffuse 0.5 0.5 0.5 }\r\nring { center 0 0 0 normal 0 0 1 radius 9 }\r\n\x1a").encode('latin1'),
        compress_type=zipfile.ZIP_DEFLATED)
    z.writestr(zipfile.ZipInfo('BIG.VO'), ('// nagy\n' + '\n'.join(
        'sphere { center %d %d 0.2 radius 0.2 }' % (i % 30, i // 30) for i in range(900))).encode(), compress_type=zipfile.ZIP_DEFLATED)
    z.writestr(zipfile.ZipInfo('STORED.V'), b"studio { res 40 25 }\nsphere { center 0 0 0 radius 1 }\n", compress_type=zipfile.ZIP_STORED)
    z.writestr(zipfile.ZipInfo('VIVID287.EXE'), b'MZ\x00\x01', compress_type=zipfile.ZIP_DEFLATED)
zpath = os.path.join(out, 'test.zip')
open(zpath, 'wb').write(zbuf.getvalue())

BRIDGE = """
window.__fs = {}; window.__exports = [];
window.Android = {
  listFiles: function(){ return JSON.stringify(Object.keys(__fs)); },
  readFile: function(n){ return n in __fs ? __fs[n] : null; },
  writeFile: function(n,c){ __fs[n]=String(c); return true; },
  deleteFile: function(n){ delete __fs[n]; return true; },
  exportText: function(n,c){ __exports.push(['txt',n,c.length]); return 'Download/Vivid/'+n; },
  saveImage: function(n,b){ __exports.push(['png',n,b.length]); return 'Pictures/Vivid/'+n; },
  exitApp: function(){ __exports.push(['exit']); }
};
"""

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 400, 'height': 820}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    pg.route('https://vivid.local/**', lambda r: r.fulfill(status=200, content_type='text/html', body=html))
    pg.add_init_script(BRIDGE)
    pg.goto('https://vivid.local/')
    pg.wait_for_timeout(500)
    files0 = pg.evaluate('Object.keys(__fs).sort()')
    print('installed samples:', files0)
    pg.screenshot(path=os.path.join(out, 'ui_files.png'))

    # import zip via file chooser
    pg.set_input_files('#fileIn', zpath)
    pg.wait_for_selector('#modal.on')
    print('import msg:', pg.inner_text('#modal .msg').replace('\n', ' | '))
    pg.screenshot(path=os.path.join(out, 'ui_import.png'))
    pg.click('#modal .row button')
    files1 = pg.evaluate('Object.keys(__fs).sort()')
    print('after import:', files1)
    assert 'test1.v' in files1 and 'big.vo' in files1 and 'stored.v' in files1
    assert pg.evaluate("__fs['big.vo'].split('\\n').length") == 901

    # open test1.v, edit, save
    pg.click('.frow[data-n="test1.v"] .nm')
    pg.wait_for_timeout(200)
    pg.fill('#ed', pg.input_value('#ed').replace('0.9 0.4 0.1', '0.2 0.5 0.9'))
    assert 'dirty' in pg.get_attribute('#hfile', 'class')
    pg.click('#bSave')
    assert '0.2 0.5 0.9' in pg.evaluate("__fs['test1.v']")
    pg.screenshot(path=os.path.join(out, 'ui_editor.png'))

    # render
    pg.click('#bRender')
    pg.wait_for_function("document.getElementById('imginfo').textContent.indexOf('kész')>=0", timeout=60000)
    print('render info:', pg.inner_text('#imginfo'))
    print('worker used:', pg.evaluate('workerOK'))
    pg.screenshot(path=os.path.join(out, 'ui_image.png'))
    pg.click('#bPng')

    # error path: syntax error with jump to line
    pg.click('nav button[data-v="edit"]')
    pg.fill('#ed', pg.input_value('#ed').replace('radius 1 }', 'radius 1 } junk('))
    pg.click('#bRender')
    pg.wait_for_selector('#log .err', timeout=20000)
    print('error log:', pg.inner_text('#log'))
    pg.screenshot(path=os.path.join(out, 'ui_log.png'))
    pg.click('#log .err a')
    pg.wait_for_timeout(200)
    print('cursor after jump:', pg.inner_text('#pos'))

    # unsaved guard + back
    pg.evaluate('onAndroidBack()')  # edit -> files
    pg.evaluate('onAndroidBack()')  # files -> unsaved dialog
    pg.wait_for_selector('#modal.on')
    print('guard:', pg.inner_text('#modal h2'))
    pg.click('#modal button[data-i="1"]')  # discard
    pg.wait_for_timeout(200)
    print('exports:', pg.evaluate('__exports'))

    # render every bundled sample through the UI and keep screenshots of the canvas
    for n in ['alap.v', 'textura.v', 'transzform.v', 'oszlopsor.v']:
        pg.click('nav button[data-v="files"]')
        pg.click('.frow[data-n="%s"] button[data-act="render"]' % n)
        pg.wait_for_function("!rendering && document.getElementById('imginfo').textContent.indexOf('kész')>=0", timeout=120000)
        pg.locator('#cv').screenshot(path=os.path.join(out, 'ui_' + n.replace('.v', '') + '.png'))
        print(n, pg.inner_text('#imginfo'))

    # main-thread fallback
    pg2 = b.new_page(viewport={'width': 400, 'height': 820})
    pg2.route('https://vivid.local/**', lambda r: r.fulfill(status=200, content_type='text/html', body=html))
    pg2.add_init_script('window.Worker = function(){ throw new Error("no worker"); };')
    pg2.goto('https://vivid.local/')
    pg2.wait_for_timeout(300)
    pg2.click('#bRender')
    pg2.wait_for_function("document.getElementById('imginfo').textContent.indexOf('kész')>=0", timeout=60000)
    print('fallback:', pg2.inner_text('#imginfo'), 'workerOK=', pg2.evaluate('workerOK'))
    b.close()

print('ERRORS:', errors)
