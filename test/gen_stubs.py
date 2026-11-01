"""Generate a stub framework (smali) from android.jar for every class referenced by
our smali code (plus their supertypes), so baksmali's MethodAnalyzer can
type-check the dex like the Dalvik verifier would."""
import os, re, subprocess, sys

JAR = '/home/claude/tools/android-34.jar'
SRC = sys.argv[1]
OUT = sys.argv[2]

own = set()
refs = set()
for dp, _, fs in os.walk(SRC):
    for f in fs:
        t = open(os.path.join(dp, f)).read()
        own.update(re.findall(r'^\.class[^\n]*?(L[\w/$]+;)', t, re.M))
        refs.update(re.findall(r'L[\w/$]+;', t))
refs -= own
refs.add('Ljava/lang/Object;')


def javap(cls):
    r = subprocess.run(['javap', '-cp', JAR, '-s', '-protected', cls],
                       capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def desc_to_name(d):
    return d[1:-1].replace('/', '.')


done = {}
queue = sorted(refs)
while queue:
    d = queue.pop()
    if d in done:
        continue
    out = javap(desc_to_name(d))
    if out is None:
        print('not in android.jar:', d); done[d] = None; continue
    lines = out.splitlines()
    head = next(l for l in lines if re.search(r'\b(class|interface)\b', l) and '{' in l)
    is_if = ' interface ' in ' ' + head
    sup = 'Ljava/lang/Object;'
    m = re.search(r'\bextends ([\w.$<>?, ]+?)(?: implements|\s*\{)', head)
    ifs = []
    if is_if:
        if m: ifs = [x.strip() for x in re.sub(r'<.*?>', '', m.group(1)).split(',')]
    else:
        if m: sup = 'L' + re.sub(r'<.*', '', m.group(1).strip()).replace('.', '/') + ';'
        mi = re.search(r'\bimplements ([\w.$<>?, ]+?)\s*\{', head)
        if mi: ifs = [x.strip() for x in re.sub(r'<[^<>]*>', '', re.sub(r'<[^<>]*>', '', mi.group(1))).split(',')]
    ifs = ['L' + re.sub(r'<.*', '', x).replace('.', '/') + ';' for x in ifs if x]
    # inner classes: javap prints Outer$Inner as Outer.Inner — fix via original descriptor knowledge
    def fix(t):
        return t if javap(desc_to_name(t)) is not None else re.sub(r'/([A-Z]\w*);$', r'$\1;', t) if False else t
    members = []
    for i, l in enumerate(lines):
        l2 = l.strip()
        if l2.startswith('descriptor:'):
            desc = l2.split(':', 1)[1].strip()
            decl = lines[i - 1].strip()
            static = ' static ' in ' ' + decl
            abstract = ' abstract ' in ' ' + decl or (is_if and not static and ' default ' not in ' ' + decl)
            if desc.startswith('('):
                nm = re.search(r'([\w$]+)\(', decl)
                if not nm: continue
                name = nm.group(1)
                if name == desc_to_name(d).split('.')[-1].split('$')[-1]: name = '<init>'
                members.append(('m', name, desc, static, abstract))
            else:
                nm = re.search(r'([\w$]+);$', decl)
                if nm: members.append(('f', nm.group(1), desc, static, False))
    done[d] = (is_if, sup if not is_if else 'Ljava/lang/Object;', ifs, members)
    for t in [sup] + ifs:
        if t not in done: queue.append(t)

os.makedirs(OUT, exist_ok=True)
n = 0
for d, info in done.items():
    if not info: continue
    is_if, sup, ifs, members = info
    acc = 'public interface abstract' if is_if else 'public'
    s = ['.class %s %s' % (acc, d), '.super %s' % sup] + ['.implements %s' % i for i in ifs]
    seen = set()
    for kind, name, desc, static, abstract in members:
        key = (kind, name, desc)
        if key in seen: continue
        seen.add(key)
        if kind == 'f':
            s.append('.field public %s%s:%s' % ('static ' if static else '', name, desc))
        else:
            mods = 'public ' + ('static ' if static else '') + ('abstract ' if abstract else 'native ')
            if name == '<init>': mods = 'public constructor native '
            s.append('.method %s%s%s\n.end method' % (mods, name, desc))
    p = os.path.join(OUT, d[1:-1] + '.smali')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write('\n'.join(s) + '\n')
    n += 1
print(n, 'stub classes')
