"""Construye ../oculomotor/index.html junto con style.css y logo.svg a partir de src/, i18n/, head/ y assets/.
Uso: python build.py
"""
import base64, hashlib, json, os, re
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

# Los iconos viven en src/icons/*.svg y se insertan en línea (así heredan currentColor); el logo se sirve como archivo.
out = re.sub(r'<!--svg:([\w-]+)-->', lambda m: rd(P('src', 'icons', m.group(1) + '.svg')).strip(), src['b_body.html'])
out += '\n<script>\nwindow.OCU_I18N=' + i18n + ';\n' + rd(P('src', 'f_i18n.js')) + '\n</script>\n'
out += '<script>\n' + rd(P('src', 'e_data.js')) + '\n</script>\n<script>\n' + src['c_main.js'] + '\n</script>\n'
out += '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>\n'
out += '<script type="application/json" id="headData">' + rd(P('head', 'head.json')) + '</script>\n'
out += '<script>window.HEAD_MAP="' + b64(P('assets', 'Map-COL.jpg'), 'image/jpeg') + '";window.HEAD_NORMAL="' + b64(P('assets', 'Infinite-Level_02_Tangent_SmoothUV.jpg'), 'image/jpeg') + '";</script>\n'
out += '<script type="module">\n' + src['d_three.js'].replace('/*__HEAD3D__*/', rd(P('head', 'head3d_inline.js'))) + '\n</script>\n'
out += '<script>setTimeout(function(){document.querySelectorAll(".v3msg").forEach(function(m){m.setAttribute("data-i18n","anat.fail");m.textContent=I18N.t("anat.fail");});},12000);</script>\n'

head = rd(P('src', 'a_head.html')).replace('<title>Oculomotor: simulador de pares craneales</title>', '<title>Oculomotor</title>', 1)
# El CSS va en un archivo aparte; el hash en la URL evita servir una hoja en caché con un HTML nuevo.
css = rd(P('src', 'style.css'))
head += '<link rel="stylesheet" href="style.css?v=' + hashlib.md5(css.encode()).hexdigest()[:8] + '">'
full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + head + '\n</head>\n<body>\n' + out + '\n</body>\n</html>\n')
dest = os.path.join(B, '..', 'oculomotor', 'index.html')
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w', encoding='utf-8').write(full)
open(os.path.join(os.path.dirname(dest), 'style.css'), 'w', encoding='utf-8').write(css)
open(os.path.join(os.path.dirname(dest), 'logo.svg'), 'w', encoding='utf-8').write(rd(P('src', 'icons', 'logo.svg')))
print('Listo:', os.path.normpath(dest), len(full), 'bytes,', len(langs), 'idiomas:', ' '.join(langs))
