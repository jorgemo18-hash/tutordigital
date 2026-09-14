# KaTeX 0.18.7 — vendorizado

Dibuja las fórmulas matemáticas del tutor y las del alumno. Copiado del paquete
oficial `katex@0.18.7` de npm el 14/09/2026.

## Por qué vendorizado y no desde un CDN

`assets/student/index.html` carga Sentry y mathjs desde CDN, así que el CDN
habría sido coherente y una línea. Se ha elegido copiarlo por una razón muy
concreta: **desde el contenedor donde se trabaja no se puede comprobar la URL
de un CDN**, y si la ruta estuviera mal el fallo es SILENCIOSO — los tres
caminos de dibujado del proyecto empiezan con `if (!window.katex) return`, así
que una URL equivocada no da error: deja las fórmulas en crudo, que es
exactamente el fallo que este cambio arregla.

Con los archivos aquí, se sirven desde nuestro propio dominio y se ha podido
verificar de verdad: fórmula real dibujada en Chromium antes de entregar.

De paso, no depende de que el wifi de un instituto no bloquee cdnjs.

## Qué se ha copiado, y qué no

| Del paquete | Aquí | Por qué |
|---|---|---|
| `dist/katex.min.js` | sí | el motor |
| `dist/katex.min.css` | sí | los estilos y las declaraciones de fuentes |
| `dist/contrib/auto-render.min.js` | sí | da `window.renderMathInElement`, que es lo que usan las burbujas del tutor para dibujar lo que va entre `\( \)` y `\[ \]` |
| `dist/fonts/*.woff2` (20) | sí | 296 KB |
| `dist/fonts/*.woff` y `*.ttf` (40) | **no** | 900 KB más, para navegadores que no existen en este caso de uso |
| `katex.js`, `katex.mjs`, `katex.css`, `katex-swap.*` | no | versiones sin minificar o alternativas |

**El detalle del que hay que acordarse**: `katex.min.css` declara cada fuente
con tres formatos en este orden — woff2, woff, ttf. Todos los navegadores de
los últimos diez años cogen el woff2 y no piden los otros dos, así que no
falta nada en la práctica. Pero la hoja SÍ los nombra: si algún día apareciera
un navegador antiguo, pediría dos archivos que no están y se quedaría sin
fuentes (las fórmulas saldrían con la tipografía del sistema, legibles pero
feas). **No se ha tocado la hoja del paquete** a propósito: un vendor editado
a mano es peor que esta nota.

## Cómo actualizarlo

```
npm pack katex@<version>
tar -xzf katex-<version>.tgz
cp package/dist/katex.min.js package/dist/katex.min.css  assets/shared/vendor/katex/
cp package/dist/contrib/auto-render.min.js               assets/shared/vendor/katex/contrib/
cp package/dist/fonts/*.woff2                            assets/shared/vendor/katex/fonts/
```

Y actualizar la versión en este archivo y en el comentario de
`assets/student/index.html`. Hay un test
(`tests/tutor/formulasSeDibujan.test.mjs`) que falla si el HTML deja de cargar
alguno de los tres archivos o si alguno desaparece de esta carpeta.
