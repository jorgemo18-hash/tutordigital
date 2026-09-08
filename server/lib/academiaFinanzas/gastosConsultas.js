import { rangoMes } from "./rangoFechas.js";
import { borrarArchivoPrivado } from "../academiaStorage/archivoPrivado.js";

const SELECT_COLS =
  "id, fecha, proveedor, concepto, categoria, subcategoria, cif, base_imponible, " +
  "iva_pct, iva_importe, retencion_pct, retencion_importe, importe, foto_url, foto_path, notas";

async function fetchGastosDelMes(admin, tenantId, { mes, anio }) {
  const { inicio, fin } = rangoMes(mes, anio);
  return admin
    .from("academia_gastos")
    .select(SELECT_COLS)
    .eq("tenant_id", tenantId)
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("fecha", { ascending: false });
}

export async function fetchResumenGastos(admin, tenantId, { mes, anio }) {
  const { data, error } = await fetchGastosDelMes(admin, tenantId, { mes, anio });
  if (error) return { error };

  const gastos = data || [];
  const total = gastos.reduce((s, g) => s + Number(g.importe), 0);
  const ivaSoportado = gastos.reduce((s, g) => s + Number(g.iva_importe || 0), 0);
  const ticketMedio = gastos.length ? total / gastos.length : 0;

  return {
    resumen: {
      total: Math.round(total * 100) / 100,
      iva_soportado: Math.round(ivaSoportado * 100) / 100,
      ticket_medio: Math.round(ticketMedio * 100) / 100,
    },
  };
}

export async function fetchListaGastos(admin, tenantId, { mes, anio }) {
  const { data, error } = await fetchGastosDelMes(admin, tenantId, { mes, anio });
  if (error) return { error };
  return { gastos: data || [] };
}

export async function fetchCategoriasGastos(admin, tenantId, { mes, anio }) {
  const { data, error } = await fetchGastosDelMes(admin, tenantId, { mes, anio });
  if (error) return { error };

  const porCategoria = {};
  for (const g of data || []) {
    const cat = g.categoria || "Sin categoría";
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.importe);
  }
  const categorias = Object.entries(porCategoria).map(([categoria, total]) => ({
    categoria,
    total: Math.round(total * 100) / 100,
  }));
  return { categorias };
}

export async function insertGasto(admin, tenantId, datos) {
  const { data, error } = await admin
    .from("academia_gastos")
    .insert({ tenant_id: tenantId, ...datos })
    .select(SELECT_COLS)
    .single();
  if (error) return { error };
  return { gasto: data };
}

export async function updateGasto(admin, tenantId, gastoId, datos) {
  const { data, error } = await admin
    .from("academia_gastos")
    .update(datos)
    .eq("id", gastoId)
    .eq("tenant_id", tenantId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) return { error };
  return { gasto: data };
}

// Borrar el gasto se lleva también SU FACTURA del bucket privado
// (auditoría del 08/09/2026). Antes solo se borraba la fila: el archivo se
// quedaba en Storage para siempre, sin ninguna fila que lo referenciara, o
// sea invisible desde el panel y sin forma de encontrarlo salvo listando el
// bucket. Y desde que hay copia de seguridad de los archivos, cada huérfano
// se copiaba además al portátil cada semana.
//
// La ruta se lee ANTES del delete: después ya no hay fila de la que sacarla.
// Y el archivo se borra DESPUÉS de que el borrado de la fila haya salido
// bien — al revés, un fallo en el delete dejaría un gasto en la lista
// apuntando a un archivo que ya no existe.
export async function deleteGasto(admin, tenantId, gastoId) {
  const { data: gasto } = await admin
    .from("academia_gastos")
    .select("foto_path")
    .eq("id", gastoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { error } = await admin.from("academia_gastos").delete().eq("id", gastoId).eq("tenant_id", tenantId);
  if (error) return { error };

  await borrarArchivoPrivado(admin, gasto?.foto_path);
  return { ok: true };
}
