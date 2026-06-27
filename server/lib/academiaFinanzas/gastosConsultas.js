const SELECT_COLS =
  "id, fecha, proveedor, concepto, categoria, subcategoria, cif, base_imponible, " +
  "iva_pct, iva_importe, retencion_pct, retencion_importe, importe, foto_url, notas";

function rangoMes(mes, anio) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const finMes = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(finMes).padStart(2, "0")}`;
  return { inicio, fin };
}

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
