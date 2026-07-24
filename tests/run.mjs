import { strict as assert } from "node:assert";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function loadTests() {
  const modules = [
    "./origins.test.mjs",
    "./files.test.mjs",
    "./math.test.mjs",
    "./backend.test.mjs",
    "./chatapi.test.mjs",
    "./api-v1.test.mjs",
    "./groups-pagination.test.mjs",
    "./api-v1-auth.test.mjs",
    "./server-me-fastify.test.mjs",
    "./server-chat-fastify.test.mjs",
    "./server-tickets-fastify.test.mjs",
    "./route-guards.test.mjs",
    "./tenant-membership-guard.test.mjs",
    "./tenant-guard-routes-wiring.test.mjs",
    "./server-notebook-summary.test.mjs",
    "./admin-teacher-invite.test.mjs",
    "./admin-teachers-invite-academia.test.mjs",
    "./admin-teachers-map-pending-invites.test.mjs",
    "./admin-groups-ensure.test.mjs",
    "./admin-teachers-routes-wiring.test.mjs",
    "./teacher-invite-redeem.test.mjs",
    "./teacher-invite-route-for-teacher.test.mjs",
    "./teacher-me.test.mjs",
    "./academia-teacher-lookup-tenant-slug.test.mjs",
    "./heic-converter.test.mjs",
    "./anthropic-vision-ocr.test.mjs",
    "./alumnosList.test.mjs",
    "./academiaAlumnoValidacionAlta.test.mjs",
    "./alumnosListRowAvisoIncompleto.test.mjs",
    "./academiaAdminDescuentosRecurrentesSection.test.mjs",
    "./academiaAdminRegenerarBoton.test.mjs",
    "./academiaAdminReciboPreviewDescuentoFamilia.test.mjs",
    "./academiaAdminTabRecibo.test.mjs",
    "./academiaAdminInformeCardGenerar.test.mjs",
    "./academiaAdminEmailTextoPanel.test.mjs",
    "./academiaAdminConfirmarYEjecutar.test.mjs",
    "./academiaAdminElegirAccionDialog.test.mjs",
    "./academiaAdminOpcionesAccion.test.mjs",
    "./academiaAdminAccionesLote.test.mjs",
    "./academiaAdminAccionesFamilia.test.mjs",
    "./academiaAdminAccionesFamiliaBoton.test.mjs",
    "./academiaAdminCabecera.test.mjs",
    "./academiaAdminPanelDerecho.test.mjs",
    "./academiaAdminEstadoFamilia.test.mjs",
    "./academiaAdminAutoFichajeWidget.test.mjs",
    "./academiaAdminTablaFichajes.test.mjs",
    "./academiaAdminCorreccionDialog.test.mjs",
    "./academiaAdminFicharBanner.test.mjs",
    "./academiaAdminTablaProfesores.test.mjs",
    "./academiaAdminInvitarDialog.test.mjs",
    "./academiaAdminAlumnosAsignadosSection.test.mjs",
    "./academiaAdminProfesorDrawer.test.mjs",
    "./academiaAdminSidebarOrden.test.mjs",
    "./academiaAdminFamiliaFieldsLabel.test.mjs",
    "./academiaProfesorTabFichar.test.mjs",
    "./academiaProfesorFicharHeaderWidget.test.mjs",
    "./academiaProfesorFicharBanner.test.mjs",
    "./academiaProfesorFicharSync.test.mjs",
    "./academiaDocumentosNormas.test.mjs",
    "./academiaNormasConversion.test.mjs",
    "./academiaNormasSubida.test.mjs",
    "./authRefresh.test.mjs",
    "./sessionExpiredFrontend.test.mjs",
    "./academiaDocumentosPayload.test.mjs",
    "./academiaInscripcionConfig.test.mjs",
    "./academiaExtraerTextoInscripcion.test.mjs",
    "./academiaInscripcionTexto.test.mjs",
    "./academiaHojaInscripcionCache.test.mjs",
    "./tasks-isolation.test.mjs",
    "./task-ownership.test.mjs",
    "./sesion-libre-task.test.mjs",
    "./session-inactivity.test.mjs",
    "./academiaRecibos/round2.test.mjs",
    "./academiaRecibos/intervaloAplica.test.mjs",
    "./academiaRecibos/formatearConcepto.test.mjs",
    "./academiaRecibos/desglosarDescuentosRecurrentes.test.mjs",
    "./academiaRecibos/calcularDescuento.test.mjs",
    "./academiaRecibos/reciboIntegracion.test.mjs",
    "./academiaRecibos/siguienteNumeroRecibo.test.mjs",
    "./academiaRecibos/evaluarConfirmacionRecibos.test.mjs",
    "./academiaRecibos/regenerarConDescuentos.test.mjs",
    "./academiaInformes/evaluarConfirmacionInformes.test.mjs",
    "./academiaInformes/regenerarEnviadoAt.test.mjs",
    "./academiaRecibos/economicoFamilia.test.mjs",
    "./academiaEnvio/textoAcompanamiento.test.mjs",
    "./academiaEnvio/confirmacionEnvioFamilia.test.mjs",
    "./academiaEnvio/generarPdfs.test.mjs",
    "./integracion/enviarFamiliaGarciaRealPdf.test.mjs",
    "./academiaEnvio/academiaPdfPayload.test.mjs",
    "./academiaEnvio/enviarFamiliaEmail.test.mjs",
    "./academiaEnvio/enviarInformeIndividual.test.mjs",
    "./studentLifecycle.test.mjs",
    "./admin-students-unified-routes-wiring.test.mjs",
    "./unifiedStudentActions.test.mjs",
    "./academiaFinanzasIngresosPendientes.test.mjs",
    "./academiaDescuentos/hermanosConDescuentosActivos.test.mjs",
    "./avisoArchivoFamilia.test.mjs",
    "./importReview.test.mjs",
    "./studentImportPreview.test.mjs",
    "./studentImportConfirm.test.mjs",
    "./admin-students-import-routes-wiring.test.mjs",
    "./profileProvisioning.test.mjs",
    "./academiaFichajes/fichar.test.mjs",
    "./academiaFichajes/correccion.test.mjs",
    "./academiaFichajes/consultas.test.mjs",
    "./academiaFichajes/exportBuffers.test.mjs",
    "./academiaFichajes/routesWiring.test.mjs",
    "./academiaProfesores/asignaciones.test.mjs",
    "./academia-profesores-routes-wiring.test.mjs",
  ];
  for (const mod of modules) {
    const m = await import(new URL(mod, import.meta.url));
    if (typeof m.run === "function") {
      await m.run({ test, assert });
    }
  }
}

function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) en: ${label}`)), ms)
    ),
  ]);
}

let failures = 0;
await loadTests();

const filter = String(process.env.TEST || "").trim().toLowerCase();
const timeoutMs = Number(process.env.TIMEOUT_MS || 0);

const selected = filter
  ? tests.filter((t) => t.name.toLowerCase().includes(filter))
  : tests;

if (filter && selected.length === 0) {
  console.error(`No hay tests que coincidan con TEST="${process.env.TEST}"`);
  process.exit(1);
}

for (const t of selected) {
  try {
    await withTimeout(Promise.resolve().then(t.fn), timeoutMs, t.name);
    console.log(`✓ ${t.name}`);
  } catch (err) {
    failures += 1;
    console.error(`✗ ${t.name}`);
    console.error(err);
  }
}

console.log(`\nResumen: ${selected.length} tests, ${failures} fallos`);

if (failures) {
  process.exitCode = 1;
}
