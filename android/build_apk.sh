#!/bin/bash
# Builds dist/vivid2.apk without Gradle/Android SDK:
#   aapt2 (resources + manifest) -> smali (classes.dex) -> zip -> apksign.py (align + v2 signature)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
TOOLS=/home/claude/tools
AAPT2="$TOOLS/aapt2"
ANDROID_JAR="$TOOLS/android-34.jar"
SMALI_CP="$(cat "$TOOLS/smali.cp")"
B="$ROOT/build"
rm -rf "$B"; mkdir -p "$B/compiled" "$B/assets"

python3 "$ROOT/build_web.py"
cp "$ROOT/dist/index.html" "$B/assets/index.html"

# signing key (kept, so later builds can be installed as updates)
KEYS="$ROOT/keys"
if [ ! -f "$KEYS/key.pem" ]; then
  mkdir -p "$KEYS"
  python3 - "$KEYS" <<'EOF'
import sys, datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
d = sys.argv[1]
k = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Sisak Laszlo (helmetsoft.com)'),
                  x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'helmetsoft.com'),
                  x509.NameAttribute(NameOID.COUNTRY_NAME, 'HU')])
now = datetime.datetime(2026, 1, 1)
c = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(k.public_key())
     .serial_number(x509.random_serial_number()).not_valid_before(now)
     .not_valid_after(now + datetime.timedelta(days=365 * 30)).sign(k, hashes.SHA256()))
open(d + '/key.pem', 'wb').write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
open(d + '/cert.der', 'wb').write(c.public_bytes(serialization.Encoding.DER))
print('new signing key generated')
EOF
fi

# resources + manifest
"$AAPT2" compile --dir "$HERE/res" -o "$B/compiled/res.zip"
"$AAPT2" link -o "$B/base.apk" -I "$ANDROID_JAR" --manifest "$HERE/AndroidManifest.xml" \
  -A "$B/assets" --min-sdk-version 29 --target-sdk-version 34 --version-code 1 --version-name 1.0 \
  "$B/compiled/res.zip"

# dex
java -cp "$SMALI_CP" com.android.tools.smali.smali.Main assemble --api 29 -o "$B/classes.dex" "$HERE/smali"

# add dex, then align + sign
cp "$B/base.apk" "$B/unsigned.apk"
python3 - "$B/unsigned.apk" "$B/classes.dex" <<'EOF'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[2], 'classes.dex')
EOF
mkdir -p "$ROOT/dist"
python3 "$HERE/apksign.py" "$B/unsigned.apk" "$ROOT/dist/vivid2.apk" "$KEYS/key.pem" "$KEYS/cert.der"
ls -la "$ROOT/dist/vivid2.apk"
