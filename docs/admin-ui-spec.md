# Admin UI Spec (v7.1.x)

## Objetivo
Interfaz admin para crear invitaciones docentes con configuración previa (materias, grupos y tutoría), gestión de invitaciones y navegación rápida entre paneles.

## Estructura
- Header: `Zona admin` + `Centro`.
- Barra de acciones rápidas:
  - `Entrar como docente`
  - `Entrar como alumno`
  - `Cerrar sesión`
- Bloque `Crear invitación docente` con layout 2x2:
  - Fila 1: `Email docente` + `Nombre docente`.
  - Fila 2: `Materias` (multiselect) + `Cursos/Grupos` (multiselect).
- Tutoría opcional:
  - Selector con un único valor posible, limitado a los grupos seleccionados.
- Resultado y errores con mensajes humanos.
- Bloque `Docentes` con estado de invitación y botón `Revocar` en estado pendiente.

## Materias
- Catálogo base predefinido.
- Soporte multi-selección.
- Acción `Añadir materia` para casos no contemplados.

## Grupos y vías
- Soporte para vías configurables por lista (default `A,B,C,D,E`).
- Botón `Generar grupos estándar`:
  - Primaria: 1º a 6º
  - ESO: 1º a 4º
  - Bachillerato: 1º a 2º
  - Para cada vía configurada.
- Si no hay grupos cargados, mostrar mensaje de ayuda y no dejar el selector vacío sin explicación.

## Fondo y estilo
- Fondo con imagen del centro (`/assets/bg/instituto.jpg`).
- Tarjetas con estilo translúcido para mantener legibilidad.
- Focus/controles en color cobre.

## API usada por la UI admin
- `GET /api/v1/admin/teachers`
- `POST /api/v1/admin/teachers/invite`
- `POST /api/v1/admin/teachers/teacher-invites/:id/revoke`
- `POST /api/v1/admin/teachers/groups/generate`
- `GET /api/v1/groups`

## Endpoint de generación de grupos
`POST /api/v1/admin/teachers/groups/generate`

Body:
```json
{
  "tracks": ["A", "B", "C", "D", "E"]
}
```

Respuesta:
```json
{
  "data": {
    "created": 0,
    "total": 60,
    "tracks": ["A", "B", "C", "D", "E"]
  },
  "requestId": "..."
}
```
