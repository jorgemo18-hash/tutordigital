// Categorías de gasto de fábrica para un tenant academia nuevo — se
// insertan al crear el tenant (ver superadmin.tenant.create.routes.js) y
// son la referencia de es_predefinida=true que nunca se puede borrar (ver
// academia.gastos.categorias.routes.js). "Otros" va última a propósito: el
// selector del drawer de gastos la usa como disparador para añadir una
// categoría nueva (ver gastoCategoriaSelect.js, frontend).
export const CATEGORIAS_GASTO_PREDEFINIDAS = [
  "Material",
  "Servicios",
  "Alquiler",
  "Suministros",
  "Publicidad",
  "Mantenimiento",
  "Gestoría",
  "Otros",
];
