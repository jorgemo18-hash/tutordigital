# Ejercicios de referencia: cómo se hacen

Qué son: ejercicios reales con su solución, sacados de hojas y libros libres,
por etapa, materia, curso y tema. Sirven de **referencia** al generador de
hojas y al tutor: les dicen qué nivel, qué tipos de ejercicio y qué notación
tiene cada curso. **No se imprimen tal cual para los alumnos.** Cuando Jorge
suba «los buenos» de un tema, los encontrados de ese tema se borran.
Lo decidió Jorge el 30/9/2026.

- Datos: `server/lib/ejerciciosReferencia/datos/{etapa}/{materia}/{curso}/{tema}.json`.
  La forma está en `esquema.js` y se leen con `referencias.js`.
- Scripts que los escriben: `tools/referencias/temas/{etapa}/{materia}/{curso}/*.py`,
  con las ayudas de `escribe.py`.
- Regenerar y comprobar todo: `python3 tools/referencias/genera.py`. Necesita
  `pip install sympy`.
- El test `tests/ejerciciosReferencia.test.mjs` va en `npm test`.

## Reglas (el molde: 2.º ESO de Matemáticas)

1. **Fuentes libres primero.** Por orden:
   - Recursos de la Xunta (`recursos.edu.xunta.gal`, CC BY-SA: uso comercial permitido).
   - Marea Verde (CC BY-NC-SA).
   - Fichas de profesores que las publican (por ejemplo, Alfonso González, CC BY-NC).

   Anota la licencia en `fuentes`. Libros de editorial: no.
2. **No fiarse de la fuente para el currículo.** Marea Verde sigue el
   currículo de Madrid. El saber de cada ejercicio se elige del currículo de
   **Aragón** de ese curso (`server/lib/curriculo/`) y el test lo comprueba. Lo
   que no está en ese curso en Aragón **no entra**. Ejemplos de 2.º ESO:
   - movimientos y transformaciones;
   - raíces de índice mayor que 2 y radicales;
   - ecuaciones de grado mayor que 2;
   - sistemas de tres incógnitas;
   - probabilidad de experimentos compuestos.
3. **No inventar ni cambiar datos.** El enunciado se copia (sin marcas ni
   dibujos). Si hay que adaptarlo (por ejemplo, un dibujo que se describe con
   coordenadas o un dato ambiguo), `ref` lo dice: `"(adaptado: …)"`.
4. **Leer las páginas como imagen**, no con un extractor de texto: se pierden
   los exponentes («3a2b» en vez de 3a²b) y los signos.
5. **Soluciones comprobadas por código** (`comprobar`, ver `comprueba.py`):
   - las ecuaciones, los sistemas, las expresiones, los cálculos y la estadística se resuelven con sympy;
   - si la fuente da solución, se pone esa y el código la contrasta;
   - un problema con texto lleva su planteamiento (la ecuación) y la solución escrita,
     que tiene que contener el valor que sale.

   Lo que no cuadra **no entra**: se corrige la transcripción o se quita el ejercicio.
6. **Nada de comprobaciones de adorno.** `"60" = "60"` no comprueba nada. Si no hay
   cálculo que hacer (una definición, un dibujo, un problema abierto), el ejercicio
   queda `sin_verificar` con su solución escrita.
7. **Cantidad:**
   - de 7 a 35 ejercicios por tema, de todos los tipos del tema;
   - dificultad de 1 a 3;
   - un ejercicio puede tener apartados (a, b, c…);
   - mejor pocos de muchas fuentes que muchos de una.
8. **Si la fuente está mal, se dice.** Dos casos de 2.º ESO:
   - Un sistema de Alfonso González (ficha 3, ej. 4.20) tiene infinitas
     soluciones y la ficha da una sola: se quitó.
   - Un problema de Marea Verde (cap. 6, ej. 11a) tiene datos que no son
     proporcionales: se dejó, con la solución explicándolo.

## Lo que encontró la comprobación en el molde

La comprobación pilló errores **míos** al pasar a limpio, que se corrigieron antes de guardar:

- una media (80/25 en vez de 81/25) y una moda;
- un resto (87 300 : 11);
- una fracción compleja.

En el piloto pilló dos problemas mal planteados de una hoja (dan 48/7 y 7,5 años). Por eso no se
guarda nada sin pasar `comprueba.py`.
