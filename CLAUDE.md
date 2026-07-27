# CLAUDE.md

Convenciones permanentes de trabajo en este repositorio. No hace falta que el usuario las repita en cada instrucción — aplican siempre.

## Al terminar una tarea

- Commit y push de TODO lo que forme parte de la tarea, incluidos archivos nuevos sin trackear y migraciones SQL. Indica el hash del commit en el resumen.
- Una tarea NO está terminada si solo funciona en local. "Verificado" significa verificado en el estado que queda en `origin/main`, no en el working tree.
- Commits por bloques coherentes, no todo junto: si el trabajo abarca varias tareas distintas (incluido trabajo previo que quedó sin subir), un commit por tarea — nunca mezcles dos tareas en un mismo commit ni dejes commits a medias por conveniencia.
- Si la tarea incluye una migración SQL, indícalo en la **primera línea** del resumen con `⚠️ MIGRACIÓN PENDIENTE DE APLICAR: [nombre]`. Las migraciones las aplica Jorge manualmente, nunca Claude — pero el archivo `.sql` debe estar commiteado igualmente, no basta con dejarlo en local.

## Calidad de código

- Una única responsabilidad por archivo.
- Las funciones extraídas reciben sus dependencias como parámetros explícitos — nunca cierran sobre variables del scope padre.
- Crea las carpetas necesarias para organizar correctamente los archivos nuevos; no amontones cosas de responsabilidades distintas en una carpeta existente solo por evitar crear una nueva.
- Límite de 400 líneas por archivo de lógica: ya está automatizado vía `eslint.config.js` (regla `max-lines`, enganchada a `npm test` mediante `pretest`). No hace falta comprobarlo a mano, pero sí tenerlo en cuenta ANTES de añadir código a un archivo que esté cerca del límite — extrae primero, luego añade.

## Verificación

- No afirmes que algo funciona sin evidencia. Distingue explícitamente entre **HECHO-VERIFICADO** (comprobado con evidencia concreta: salida de comando, consulta a la base de datos, test que falla al revertir el arreglo) y **HECHO-SIN-VERIFICAR**.
- Al añadir un test para un bug, confirma que el test FALLA si se revierte el arreglo. Un test que nunca ha fallado no demuestra nada.
- Si no se puede verificar algo por falta de acceso (Render, Sentry, navegador, base de datos), dilo explícitamente en vez de asumir.
