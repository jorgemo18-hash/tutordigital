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
- Invitación de alumnos por magic link (email con enlace directo, sin código)
- Flujo completo de punta a punta verificado: superadmin crea centro → admin invita profesor → profesor acepta → admin invita alumno desde grupo → alumno acepta → alumno ve agenda y accede al tutor
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
- Formulario "¿Necesitas ayuda?" con endpoint POST /api/v1/support/contact y rate limiting
- Scroll automático genérico con MutationObserver (cualquier elemento que aparece por debajo del viewport hace scroll suave)
- `scrollbar-gutter: stable` para eliminar salto de layout al aparecer scrollbar

### Pendiente ⬜
- [ ] Códigos de grupo visibles en panel admin — ocultar o minimizar, ya no son la vía principal de acceso con el sistema de magic link
- [ ] Rediseño tarjeta de docente en panel admin: mostrar asignaciones relacionadas (Matemáticas → 1ºA, 1ºB · Historia → 2ºB) en lugar de materias y grupos separados
- [ ] Al crear grupo, volver automáticamente a vista general de grupos
- [ ] Al minimizar y reabrir sección Grupos, resetear a vista general
- [ ] Sección Alumnos del panel admin — rediseñar o eliminar, la gestión real es por grupo
- [ ] Interlineado de tareas en agenda (bug visual menor)
- [ ] Split de archivos grandes: send.js (595 líneas), chatRenderer.js (519 líneas)
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
- Sistema de papelera para centros (soft-delete, TTL 30 días, purge en cascada incluyendo auth.users)
- Vista de detalle de centro en superadmin (modo lectura + botón editar)
- Impersonación de admin desde superadmin con botón "Volver al superadmin"
- Cambio de contraseña obligatorio en primer acceso (must_change_password)
- Recuperación de contraseña desde login

### Pendiente ⬜
- [ ] Filtro por tipo de centro funcional en tabla
- [ ] Métricas reales: alumnos totales, docentes totales, sesiones
- [ ] Sección Estadísticas con datos reales (gráfico de sesiones, barras por centro)
- [ ] Sección Usuarios superadmin (gestionar quién tiene acceso)
- [ ] Sección Facturación (activar cuando haya centros de pago)
- [ ] Estado del centro (activo/prueba/inactivo) editable

---

## FASE 3 — Diseño unificado
**Objetivo:** Las 3 vistas (admin, profesor, alumno) tienen diseño coherente y profesional.

**Herramientas disponibles para esta fase:**
- skill brand-guidelines: para documentar el sistema de diseño (colores, tipografía, componentes)
- skill theme-factory: para generar el sistema de temas claro/oscuro coherente entre las 4 vistas
- skill frontend-design: ya en uso para prototipos

Usar brand-guidelines + theme-factory juntas al inicio de la fase antes de tocar código.

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
- [ ] Cuando el tutor escala al profesor, adjuntar resumen o extracto de la conversación donde el alumno se bloqueó
- [ ] El alumno abre adjunto de tarea pero el tutor no detecta la tarea activa — revisar flujo tarea → tutor
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

**Herramientas disponibles:**
- skill pptx: para generar presentación de ventas para academias
- skill xlsx: para informes de uso y facturación

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

## Mejoras UI pendientes (no bloqueantes)
- [ ] Picker de grupos en formulario de invitación de docente — rediseñar visualmente
- [ ] Resumen del formulario de invitación de docente — eliminar fila "Grupos" que siempre aparece vacía
- [ ] Compatibilidad móvil sin probar (iPhone, iPad, Android, Windows/Chrome) — prioritario porque alumnos usan móvil

---

## Decisiones técnicas tomadas (no reabrir)
- Arquitectura multi-tenant desde el inicio (slug por centro)
- Backend Node.js/Fastify en Render (no serverless)
- Frontend vanilla JS PWA en Vercel (no React por ahora)
- Supabase para BD + Auth (service role en backend, no cliente directo)
- Un solo producto con módulos por tipo de centro (no 3 apps separadas)
- Archivos máximo 400 líneas, funciones con responsabilidad única
- No integrar Google Classroom hasta tener primer cliente externo
- El alumno entra por magic link de invitación (no registro abierto ni código de grupo)
- is_superadmin en tabla profiles (no rol en tenant_memberships)

---

## Deuda técnica conocida (no urgente pero no olvidar)
- RLS en producción funciona por service_role en backend, no por políticas reales → movido a Fase 5 bloqueante
- has_active_role e is_active_member helper functions nunca aplicadas en producción
- Migraciones aplicadas directamente (ej. columna `type` en tenants) sin archivo en el repo
- Versionado fragmentado entre CSS y JS (8.0.5, 8.0.6, 8.0.7, 8.1.0, 1.0.x)
- test api-v1-auth: 1 fallo conocido (espera 401, recibe 410 en /tenant/join)
- .DS_Store en múltiples carpetas del repo
