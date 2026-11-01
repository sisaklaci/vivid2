# Vivid 2 Androidra

A Vivid 2.0 (Stephen B. Coy, 1989–1992) jelenetleíró nyelvének újraimplementált renderelője
WebView-alapú Android szerkesztővel.

- `web/renderer.js`: előfeldolgozó (#include/#define/#undef), parser (kifejezések, vektorműveletek),
  ray tracer (sphere, ring, polygon, patch, cone, transform, clip, textúrák, bump, 4 fénytípus,
  4 projekció, adaptív élsimítás, DOF, haze), BVH-val
- `web/app.html`: szerkesztő UI (fájllista, szerkesztés, mentés, renderelés, ZIP import, PNG export)
- `samples/`: saját mintafájlok
- `android/`: manifest, smali forrás (MainActivity, Chrome, Bridge), build_apk.sh, apksign.py (v2 aláírás)


Build: `bash android/build_apk.sh` (aapt2, android.jar, smali jar kell; útvonalak a szkript elején).
Tesztek: `node test/render.js samples alap.v out.png`, `python3 test/ui_test.py`.

## Licenc

A projekt a [PolyForm Noncommercial 1.0.0](LICENSE) licenc alatt áll: szabadon
nézhető, módosítható és terjeszthető, de csak nem kereskedelmi célra.
