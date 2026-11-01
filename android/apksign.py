#!/usr/bin/env python3
"""Minimal zipalign + APK Signature Scheme v2 signer (RSA-2048, SHA-256).

usage: apksign.py in.apk out.apk key.pem cert.der
Rebuilds the ZIP (resources.arsc + .so stored and 4-byte aligned, the rest
deflated), then inserts an APK Signing Block with a v2 signature.
"""
import hashlib, struct, sys, zipfile, zlib
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography import x509

STORE_ALWAYS = ('resources.arsc',)


def build_zip(src):
    """Return aligned zip bytes (local entries + central dir + EOCD)."""
    zin = zipfile.ZipFile(src)
    # deterministic order: manifest first, then the rest in original order
    infos = zin.infolist()
    infos.sort(key=lambda i: (i.filename != 'AndroidManifest.xml',))
    out = bytearray()
    central = bytearray()
    count = 0
    for info in infos:
        if info.filename.endswith('/'):
            continue
        data = zin.read(info.filename)
        name = info.filename.encode('utf-8')
        crc = zlib.crc32(data) & 0xffffffff
        store = info.filename in STORE_ALWAYS or info.filename.endswith('.so') or info.filename.endswith('.png')
        if store:
            method, comp = 0, data
        else:
            c = zlib.compressobj(9, zlib.DEFLATED, -15)
            comp = c.compress(data) + c.flush()
            method = 8
        off = len(out)
        extra = b''
        if method == 0:
            align = 4096 if info.filename.endswith('.so') else 4
            data_start = off + 30 + len(name)
            pad = (-data_start) % align
            extra = b'\x00' * pad
        dostime, dosdate = 0, (1 << 5) | 1 | ((2026 - 1980) << 9)
        out += struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0x0800, method, dostime, dosdate,
                           crc, len(comp), len(data), len(name), len(extra)) + name + extra + comp
        central += struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0x0800, method, dostime, dosdate,
                               crc, len(comp), len(data), len(name), 0, 0, 0, 0, 0, off) + name
        count += 1
    cd_off = len(out)
    eocd = struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, count, count, len(central), cd_off, 0)
    return bytes(out), bytes(central), bytearray(eocd)


def lp(b):
    return struct.pack('<I', len(b)) + b


def chunk_digest(sections):
    digests = []
    for sec in sections:
        for i in range(0, len(sec), 1 << 20):
            ch = sec[i:i + (1 << 20)]
            digests.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(ch)) + ch).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(digests)) + b''.join(digests)).digest()


def sign(src, dst, keyfile, certfile):
    entries, central, eocd = build_zip(src)
    key = serialization.load_pem_private_key(open(keyfile, 'rb').read(), None)
    cert_der = open(certfile, 'rb').read()
    x509.load_der_x509_certificate(cert_der)  # sanity
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    ALG = 0x0103  # RSASSA-PKCS1-v1_5 with SHA2-256
    # EOCD's CD offset already equals the future signing-block offset (= len(entries))
    digest = chunk_digest([entries, central, bytes(eocd)])
    signed_data = (lp(lp(struct.pack('<I', ALG) + lp(digest))) +  # digests
                   lp(lp(cert_der)) +                               # certificates
                   lp(b''))                                         # additional attributes
    sig = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signer = lp(signed_data) + lp(lp(struct.pack('<I', ALG) + lp(sig))) + lp(pub)
    v2_value = lp(lp(signer))
    pair = struct.pack('<Q', 4 + len(v2_value)) + struct.pack('<I', 0x7109871a) + v2_value
    size = len(pair) + 8 + 16
    block = struct.pack('<Q', size) + pair + struct.pack('<Q', size) + b'APK Sig Block 42'
    struct.pack_into('<I', eocd, 16, len(entries) + len(block))
    open(dst, 'wb').write(entries + block + central + bytes(eocd))


if __name__ == '__main__':
    sign(*sys.argv[1:5])
