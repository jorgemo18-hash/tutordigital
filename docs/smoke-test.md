# Smoke test (2 minutos) - TutorDigital

## Precondición
- Entrar como DOCENTE
- Seleccionar un grupo

## Checklist (debe ser todo OK)
- GET /groups -> 200
- GET /students?...approval_status=pending -> 200
- GET /tasks?...from&to -> 200
- GET /tickets?... -> 200
- GET /notebook/summary?...from&to -> 200
- Consola del navegador: 0 errores rojos

## Si falla algo (capturar antes de tocar nada)
- Endpoint exacto
- Status code
- Body de error
- requestId (si aparece)
- Screenshot de consola/network
