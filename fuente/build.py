"""Construye ../oculomotor/index.html (un solo archivo) a partir de src/, i18n/, head/ y assets/.
Uso: python build.py
"""
import base64, json, os, re
B = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(B, *a)
rd = lambda p: open(p, encoding='utf-8').read()
b64 = lambda p, t: 'data:' + t + ';base64,' + base64.b64encode(open(p, 'rb').read()).decode()

# i18n: es.json es la referencia. Cada idioma debe tener las mismas claves y los mismos marcadores {x},
# y toda clave usada en el marcado o en los scripts debe existir.
langs = ['es'] + sorted(f[:-5] for f in os.listdir(P('i18n')) if f.endswith('.json') and f != 'es.json')
dicts = {l: json.loads(rd(P('i18n', l + '.json'))) for l in langs}
def shape(x, path=''):
    if isinstance(x, dict): return {k: v for key, val in x.items() for k, v in shape(val, path + '.' + key).items()}
    if isinstance(x, list): return {k: v for n, val in enumerate(x) for k, v in shape(val, '%s.%d' % (path, n)).items()}
    return {path[1:]: sorted(set(re.findall(r'\{(\w+)\}', x)))}
ref = shape(dicts['es'])
errs = []
for l in langs[1:]:
    s = shape(dicts[l])
    errs += ['i18n/%s.json no coincide con es.json en: %s' % (l, k) for k in sorted(ref.keys() | s.keys()) if ref.get(k) != s.get(k)]
src = {f: rd(P('src', f)) for f in ('b_body.html', 'c_main.js', 'd_three.js')}
for f, text in src.items():
    for k in re.findall(r'data-i18n[\w-]*="([^"]+)"', text) + re.findall(r"'([A-Za-z_]\w*(?:\.\w+)+)'", text):
        if k.split('.')[0] in dicts['es'] and not any(r == k or r.startswith(k + '.') for r in ref):
            errs.append('%s usa una clave que no existe: %s' % (f, k))
if errs: raise SystemExit('Errores de i18n:\n  ' + '\n  '.join(errs))
i18n = json.dumps(dicts, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

out = rd(P('src', 'a_head.html')) + src['b_body.html']
out += '\n<script>\nwindow.OCU_I18N=' + i18n + ';\n' + rd(P('src', 'f_i18n.js')) + '\n</script>\n'
out += '<script>\n' + rd(P('src', 'e_data.js')) + '\n</script>\n<script>\n' + src['c_main.js'] + '\n</script>\n'
out += '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>\n'
out += '<script type="application/json" id="headData">' + rd(P('head', 'head.json')) + '</script>\n'
out += '<script>window.HEAD_MAP="' + b64(P('assets', 'Map-COL.jpg'), 'image/jpeg') + '";window.HEAD_NORMAL="' + b64(P('assets', 'Infinite-Level_02_Tangent_SmoothUV.jpg'), 'image/jpeg') + '";</script>\n'
out += '<script type="module">\n' + src['d_three.js'].replace('/*__HEAD3D__*/', rd(P('head', 'head3d_inline.js'))) + '\n</script>\n'
out += '<script>setTimeout(function(){document.querySelectorAll(".v3msg").forEach(function(m){m.setAttribute("data-i18n","anat.fail");m.textContent=I18N.t("anat.fail");});},12000);</script>\n'

sa = out.replace('<title>Oculomotor: simulador de pares craneales</title>', '<title>Oculomotor</title>', 1)
i = sa.index('</style>') + len('</style>')
full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + sa[:i] + '\n</head>\n<body>\n' + sa[i:] + '\n</body>\n</html>\n')
dest = os.path.join(B, '..', 'oculomotor', 'index.html')
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w', encoding='utf-8').write(full)
print('Listo:', os.path.normpath(dest), len(full), 'bytes,', len(langs), 'idiomas:', ' '.join(langs))
