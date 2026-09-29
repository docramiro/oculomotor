"""Construye ../oculomotor/index.html (un solo archivo) a partir de src/, head/ y assets/.
Uso: python build.py
"""
import base64, os
B = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(B, *a)
rd = lambda p: open(p, encoding='utf-8').read()
b64 = lambda p, t: 'data:' + t + ';base64,' + base64.b64encode(open(p, 'rb').read()).decode()

out = rd(P('src', 'a_head.html')) + rd(P('src', 'b_body.html'))
out += '\n<script>\n' + rd(P('src', 'e_data.js')) + '\n</script>\n<script>\n' + rd(P('src', 'c_main.js')) + '\n</script>\n'
out += '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>\n'
out += '<script type="application/json" id="headData">' + rd(P('head', 'head.json')) + '</script>\n'
out += '<script>window.HEAD_MAP="' + b64(P('assets', 'Map-COL.jpg'), 'image/jpeg') + '";window.HEAD_NORMAL="' + b64(P('assets', 'Infinite-Level_02_Tangent_SmoothUV.jpg'), 'image/jpeg') + '";</script>\n'
out += '<script type="module">\n' + rd(P('src', 'd_three.js')).replace('/*__HEAD3D__*/', rd(P('head', 'head3d_inline.js'))) + '\n</script>\n'
out += '<script>setTimeout(function(){document.querySelectorAll(".v3msg").forEach(function(m){m.textContent="No se pudo cargar la vista 3D (requiere conexión). El resto de la app funciona sin ella.";});},12000);</script>\n'

sa = out.replace('<title>Oculomotor: simulador de pares craneales</title>', '<title>Oculomotor</title>', 1)
i = sa.index('</style>') + len('</style>')
full = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + sa[:i] + '\n</head>\n<body>\n' + sa[i:] + '\n</body>\n</html>\n')
dest = os.path.join(B, '..', 'oculomotor', 'index.html')
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, 'w', encoding='utf-8').write(full)
print('Listo:', os.path.normpath(dest), len(full), 'bytes')
