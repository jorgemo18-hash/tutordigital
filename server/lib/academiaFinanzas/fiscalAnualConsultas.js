// Consultas para los modelos anuales (180 y 390) — leen los datos de los
// cuatro trimestres del año correspondiente desde academia_fiscal_trimestres
// y los agregan. Los registros anuales propios (trimestre = 0) se leen y
// escriben igual que los trimestrales, vía fiscalTrimestresStore.js.

// Lee los datos de los 4 trimestres de un modelo dado para el año indicado.
// Devuelve un array de 4 elementos (T1-T4), con null si el trimestre no
// tiene fila guardada.
export async function fetchCuatroTrimestres(admin, tenantId, { anio, modelo }) {
  const { data, error } = await admin
    .from("academia_fiscal_trimestres")
    .select("trimestre, datos")
    .eq("tenant_id", tenantId)
    .eq("anio", anio)
    .eq("modelo", modelo)
    .in("trimestre", [1, 2, 3, 4]);
  if (error) return { error };

  const porTrimestre = {};
  for (const row of data || []) porTrimestre[row.trimestre] = row.datos;
  return {
    trimestres: [1, 2, 3, 4].map((t) => porTrimestre[t] || null),
  };
}
