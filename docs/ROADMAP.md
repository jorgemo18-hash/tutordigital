# TutorDigital — Hoja de ruta completa
_Última actualización: abril 2026_

## FASE 1 — Estabilización e interfaz completa
**Objetivo:** Que admin, profesor y alumno funcionen sin bugs ni inconsistencias.

### Completado ✅
- Flujo completo Admin → Profesor → Alumno → Tutor funcional
- Autenticación con email, roles y multi-tenant
- Dominio tutordigital.app con email noreply@tutordigital.app (Ionos + Resend)
- Invitación de profesores con email branded
- Invitación de alumnos por grupo + whitelist de email
- Panel admin: Grupos (3 niveles), Docentes, Alumnos pendientes
- RLS activado en todas las tablas
- Sistema de adjuntos en Supabase Storage (profesor sube, tutor recibe)
- Header compartido entre las 3 vistas
- Migración de OpenAI a Anthropic Claude Sonnet
- Reorganización de archivos grandes (admin.js, chat.js, teachers.routes.js)
- Agenda del alumno carga tareas reales desde API
- Tutor recibe contexto de tarea activa al inicio de conversación
- Filtro de tareas pasadas en agenda
- Modal de tarea como ruta principal (ver info + adjunto + botón tutor)
- Hover y estilos de tareas individuales en agenda
- Feedback visual en descarga de adjuntos
- Botones de cambio de rol eliminados del header (seguridad)

### Pendiente ⬜
- [ ] Interlineado de tareas en agenda (bug visual menor)
- [ ] Split de archivos grandes: send.js (595 líneas), chatRenderer.js (519 líneas)
- [ ] Compatibilidad móvil — sin probar en iPhone, iPad, Android, Windows/Chrome (prioritario: alumnos usan móvil)
- [ ] Limpiar código muerto del flujo /tenant/join en home.js
- [ ] Limpiar .DS_Store del repo y completar .gitignore
- [ ] Limpiar directorio .claude/ y archive/ del repo

---

## FASE 2 — Super Admin
**Objetivo:** Poder crear y gestionar múltiples centros desde un panel central.

### Completado ✅
- Página superadmin con diseño dashboard (sidebar + métricas + tabla)
- Routing automático desde login si is_superadmin = true
- Guard de seguridad verificado contra servidor (no localStorage)
- Lectura de centros reales desde Supabase
- Crear nuevo centro con nombre, slug y tipo
- Modo oscuro/claro con toggle y persistencia
- Campo tipo en centros (academia/instituto/colegio/otro)

### Pendiente ⬜
- [ ] Vista de detalle de centro: alumnos, docentes, estadísticas, link a su admin
- [ ] Filtro por tipo de centro funcional en tabla
- [ ] Métricas reales: alumnos totales, docentes totales, sesiones
- [ ] Sección Estadísticas con datos reales (gráfico de sesiones, barras por centro)
- [ ] Sección Usuarios superadmin (gestionar quién tiene acceso)
- [ ] Sección Facturación (activar cuando haya centros de pago)
- [ ] Crear admin inicial al crear centro nuevo
- [ ] Estado del centro (activo/prueba/inactivo) editable

---

## FASE 3 — Diseño unificado
**Objetivo:** Las 3 vistas (admin, profesor, alumno) tienen diseño coherente y profesional.

### Pendiente ⬜
- [ ] Definir sistema de diseño: colores, tipografía, espaciado, componentes base
- [ ] Decidir qué funciones van y cuáles no en cada vista
- [ ] Aplicar diseño unificado a vista Admin
- [ ] Aplicar diseño unificado a vista Profesor
- [ ] Aplicar diseño unificado a vista Alumno
- [ ] Modo claro/oscuro coherente en todas las vistas (misma clave localStorage)
- [ ] Fondo personalizable por tenant (imagen propia de la academia)
- [ ] Logo TutorDigital (académico pero accesible, con modificaciones tipográficas)
- [ ] Compatibilidad y pruebas en todos los dispositivos y navegadores

---

## FASE 4 — Tutor IA
**Objetivo:** El tutor es socrático, detecta errores y guía al alumno de verdad.

### Completado ✅
- System prompt v2.0 con escalación socrática de 5 niveles
- Tag [ESCALAR_PROFESOR: motivo] para escalación automática
- Tutor recibe imágenes de adjuntos como contexto
- Migración a claude-sonnet-4-5

### Pendiente ⬜
- [ ] Definir historial de conversaciones: ¿puede el alumno volver a leer sesiones anteriores? ¿puede el profesor verlas? (decisión de producto no cerrada)
- [ ] Documentar comportamiento real del tutor desde sesiones grabadas antes de reescribir
- [ ] System prompt v3 con sistema de estado explícito (explicación → práctica guiada → detección errores → corrección)
- [ ] Notas del profesor al alumno: campo en tarea que el tutor lee como primer mensaje
- [ ] Session engine: el tutor sabe en qué punto de la sesión está
- [ ] Escalación real al profesor: notificación visible en panel de profesor
- [ ] Rate limiting por alumno/tenant en llamadas al tutor IA (coste)
- [ ] Verificación matemática determinista (symbolic math library o extended reasoning)
- [ ] Cubrir todas las asignaturas del currículo (no solo matemáticas)

---

## FASE 5 — Primer cliente externo y lanzamiento
**Objetivo:** Producto vendible a academias externas. Primera venta real.

### Pendiente ⬜
- [ ] **[BLOQUEANTE]** RLS real aplicado en producción (migraciones 012-013 + políticas has_active_role) — con datos de menores de múltiples centros no es opcional
- [ ] **[BLOQUEANTE]** GDPR / LOPDGDD y protección de menores: política de privacidad, base legal para tratar datos, consentimiento parental si <14 años
- [ ] **[BLOQUEANTE]** Migraciones de BD trackeadas en el repo — actualmente algunas se aplican directamente sin archivo de migración
- [ ] Observabilidad: Sentry (o similar) para detectar errores en producción sin esperar a que los reporte un alumno
- [ ] Unificar versionado CSS/JS a un número único en todo el proyecto
- [ ] Documentar variables de entorno en .env.example
- [ ] Documentación de API (Swagger/OpenAPI básico)
- [ ] Pricing definido: orientativo 50-150€/mes por centro o 3-8€/alumno activo
- [ ] Página de marketing de tutordigital.app (ahora es solo el login)
- [ ] Onboarding de nuevo centro sin intervención manual de Jorge
- [ ] Contrato/términos de uso básicos para academias

---

## FASE 6 — SaaS escalable
**Objetivo:** Facturación automática, integraciones y crecimiento.

### Pendiente ⬜
- [ ] Integración Stripe para facturación automática por centro
- [ ] Google Classroom API (cuando haya primer cliente que lo pida)
- [ ] Moodle LTI (cuando haya institutos interesados)
- [ ] Versión independiente vs versión integrada (decisión de producto)
- [ ] Informes y analytics por academia (uso del tutor, progreso alumnos)
- [ ] App móvil nativa (ahora es PWA — evaluar si es necesario)
- [ ] Sistema de notificaciones (push, email)
- [ ] API pública para integraciones de terceros

---

## Decisiones técnicas tomadas (no reabrir)
- Arquitectura multi-tenant desde el inicio (slug por centro)
- Backend Node.js/Fastify en Render (no serverless)
- Frontend vanilla JS PWA en Vercel (no React por ahora)
- Supabase para BD + Auth (service role en backend, no cliente directo)
- Un solo producto con módulos por tipo de centro (no 3 apps separadas)
- Archivos máximo 400 líneas, funciones con responsabilidad única
- No integrar Google Classroom hasta tener primer cliente externo
- El alumno entra por código de grupo + whitelist de email (no registro abierto)
- is_superadmin en tabla profiles (no rol en tenant_memberships)

---

## Deuda técnica conocida (no urgente pero no olvidar)
- RLS en producción funciona por service_role en backend, no por políticas reales → movido a Fase 5 bloqueante
- has_active_role e is_active_member helper functions nunca aplicadas en producción
- Migraciones aplicadas directamente (ej. columna `type` en tenants) sin archivo en el repo
- Versionado fragmentado entre CSS y JS (8.0.5, 8.0.6, 8.0.7, 8.1.0, 1.0.x)
- test api-v1-auth: 1 fallo conocido (espera 401, recibe 410 en /tenant/join)
- .DS_Store en múltiples carpetas del repo
