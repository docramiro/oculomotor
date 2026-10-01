# Oculomotor · simulador de pares craneales

Simulador web de la motilidad ocular y de las parálisis de los pares craneales III, IV y VI.

- Rostro 3D que sigue un objetivo (ratón o dedo con la cámara).
- Anatomía de ambas órbitas: músculos y nervios que se pueden separar.
- Casos clínicos y algoritmo de diplopía, con casos propios.

Abrir `index.html` o `oculomotor/index.html` en el navegador. No necesita instalación. La cámara requiere HTTPS (GitHub Pages o Cloudflare).

Uso educativo. No es una herramienta de diagnóstico.

## Créditos de terceros

- **Rostro:** escaneo 3D «Infinite» de Lee Perry-Smith, de Infinite Realities. Licencia [Creative Commons Atribución 3.0](https://creativecommons.org/licenses/by/3.0/). Se distribuye con los ejemplos de [three.js](https://github.com/mrdoob/three.js). Se modificó: se abrieron los párpados y se ajustó la malla.
- **three.js:** licencia MIT (se carga desde CDN).
- **MediaPipe Tasks Vision:** licencia Apache 2.0 (se carga desde CDN).
- **IBM Plex:** SIL Open Font License (Google Fonts).

## Licencia

El código y los contenidos propios se publican con licencia **MIT** (archivo `LICENSE`): cualquiera puede usarlos, copiarlos, modificarlos y compartirlos, siempre que conserve el aviso de autoría. El escaneo del rostro conserva su licencia CC BY 3.0 y siempre debe acreditarse a Lee Perry-Smith.

## Cómo usarlo

- **En línea:** abre el enlace del sitio publicado.
- **Sin internet para el simulador base:** descarga el repositorio (botón verde **Code → Download ZIP**), descomprímelo y abre `oculomotor/index.html`. El 3D y la cámara cargan librerías desde internet.
- **Para modificarlo:** haz un *fork* del repositorio y edita los archivos.

## Código fuente

La carpeta `fuente/` contiene el código editable. `oculomotor/index.html` se genera a partir de él.

| Archivo | Contenido |
|---|---|
| `fuente/src/a_head.html` | Estilos (tema «hoja de exploración») |
| `fuente/src/b_body.html` | Estructura de la página |
| `fuente/src/c_main.js` | Modelo biomecánico, lesiones, casos, algoritmo de diplopía, cámara |
| `fuente/src/d_three.js` | Vista 3D (three.js): rostro, órbitas, músculos y nervios |
| `fuente/src/e_data.js` | Lógica de los casos clínicos y del árbol de diplopía (sin textos) |
| `fuente/src/f_i18n.js` | Elección de idioma y búsqueda de textos |
| `fuente/i18n/*.json` | Todos los textos, un archivo por idioma (`es`, `en`, `fr`) |
| `fuente/head/` | Procesamiento del rostro 3D (`cut.py`) y su malla (`head.json`) |
| `fuente/assets/` | Texturas del rostro |

## Idiomas

La app está en español, inglés y francés. El idioma se elige con el selector de la cabecera; al abrir se usa, en este orden, `?lang=xx` en la dirección, la última elección guardada y el idioma del navegador (español si ninguno coincide).

Todos los textos están en `fuente/i18n/`. `es.json` es la referencia: los demás archivos deben tener exactamente las mismas claves y los mismos marcadores `{nombre}`, y `build.py` se detiene con la lista de diferencias si no es así.

Para agregar un idioma: copia `es.json` como `fuente/i18n/xx.json` (código de dos letras), traduce los valores sin tocar las claves ni los marcadores, pon el nombre del idioma en `_name` y regenera la app. El selector lo muestra solo. Los casos creados por el usuario no se traducen.

Las traducciones al inglés y al francés no han sido revisadas por un clínico.

Para regenerar la app después de editar: `cd fuente && python build.py` (Python 3, sin dependencias). Para volver a procesar el rostro: `pip install trimesh numpy` y `python head/cut.py LeePerrySmith.glb`.
