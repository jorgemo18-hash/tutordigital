# Norma: drawers con sub-niveles se apilan, no reemplazan contenido

Cuando un drawer lateral necesita mostrar el detalle de un elemento de una
lista que ya está mostrando (p. ej. "ver el recibo X de esta lista de
recibos"), la solución correcta es **abrir un segundo drawer apilado a la
izquierda del primero**, no sustituir el contenido del drawer actual con un
botón "← Volver".

El primero debe quedar visible y operable detrás del segundo en todo
momento. Cerrar el segundo (botón X o clic fuera) nunca debe afectar al
primero.

## Implementación de referencia

`assets/academia/admin/js/drawer/historial/historialDrawer.js` +
`.ac-drawer-overlay--nested` en `assets/academia/admin/css/_academia-admin.css`.

Mecanismo: el overlay del segundo drawer usa
`inset: 0 380px 0 0` (380px = ancho de `.ac-drawer`) en vez de `inset: 0`,
así su velo oscuro solo cubre el área a la izquierda del primer drawer —
nunca al primer drawer en sí — y `justify-content: flex-end` deja el
panel del segundo pegado justo a su izquierda. z-index superior al del
primer overlay para apilarse por encima.

El patrón se repite igual para un tercer nivel: dentro del historial,
seleccionar un recibo abre `reciboDrawer.js` (`.ac-drawer-overlay--nested-2`,
`inset: 0 760px 0 0` = 2 × 380px, z-index 220) en vez de reemplazar la
lista del segundo drawer. Cada nivel nuevo suma 380px al `inset` y 10 al
z-index del anterior.

## Inventario (2026-06) — qué se convirtió y qué no

| Drawer | ¿Sub-niveles reales? | Acción |
|---|---|---|
| `academia/admin/js/drawer/alumnoDrawer.js` → historial de recibos | Sí (lista de recibos → detalle de un recibo) | Convertido a drawer apilado (`historialDrawer.js`, nivel 2) |
| `historialDrawer.js` → detalle de un recibo concreto | Sí (lista del historial → preview + acciones de ese recibo) | Convertido a drawer apilado (`reciboDrawer.js`, nivel 3) |
| `teacher/js/features/task-list-drawer.js` ↔ `session-drawer.js` | Sí (Level 1/Level 2 ya documentado en el propio CSS) | Ya apilaba — mecanismo distinto (Level 1 se desplaza con `transform: translateX(-380px)`, overlay del Level 2 transparente) pero logra el mismo resultado. **No se tocó** — reescribirlo solo por consistencia de implementación sería churn innecesario sobre código que funciona. |
| `teacher/js/features/task-picker-drawer.js` ↔ `bulk-grade-drawer.js` | Sí | Mismo mecanismo que el par anterior (`tpd-panel.is-stacked`, comentado en el CSS como "exactamente igual que tl-panel.is-stacked"). **No se tocó**, mismo motivo. |
| `admin/modules/adminTeacherDrawer.js` | No — es un selector embebido de 2 pasos (curso → grupo/track) dentro de una sub-sección del formulario, con botones "atrás"/"cancelar". No es navegación lista→detalle de una entidad. | Sin cambios — convertirlo en drawers apilados de 380px sería un paso atrás de UX para una selección de 2 clics. |
| `teacher/js/features/grade-drawer.js` (task cards) | No — son pestañas (tabs): navegación plana entre tareas hermanas, no jerárquica. Sin botón "volver". | Sin cambios. |
| `teacher/js/features/session-task-view.js` (acordeón de sesiones) | No — expand/collapse inline dentro de la misma fila, no reemplazo de vista. | Sin cambios. |
| `admin/modules/term-dates-drawer.js`, `academia/admin/js/sections/finanzas/gastoDrawer.js`, `teacher/js/features/report-drawer.js` | No — vista única, sin navegación interna. | Sin cambios. |

Antes de aplicar este patrón a un drawer nuevo, comprueba primero si ya
resuelve el apilamiento con el mecanismo `is-stacked` / `translateX(-380px)`
del módulo profesor — ambos mecanismos son válidos; no migres uno al otro
solo por uniformidad si el existente ya funciona.
