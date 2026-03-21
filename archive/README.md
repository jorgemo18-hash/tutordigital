# Archive

`archive/serverless-api/` conserva la implementación antigua del backend serverless como referencia histórica.

La fuente de verdad actual está en:
- `server/` para el backend Fastify activo
- `server/lib/chat.js` y `server/routes/v1/chat.routes.js` para el chat

No se deben abrir nuevas rutas ni aplicar cambios funcionales en `archive/` salvo para comparar comportamiento antiguo o migrar algo pendiente.
