import { buildRecta } from "../rectaNumerica.js";
import { buildGeometria } from "./geometria.js";
import { buildEjes } from "./ejes.js";
import { buildBarras, buildSectores } from "./graficos.js";

// LAS FIGURAS QUE SABE DIBUJAR LA HOJA, por tipo. El contenido manda el DATO
// (`{ tipo: "ejes", … }`) y aquí se elige quién lo dibuja. Un tipo que no
// está en la lista, o un dato que su dibujante rechaza, devuelve null: el
// apartado sale sin figura antes que con un dibujo roto.
const DIBUJANTES = {
  recta: buildRecta,
  geometria: buildGeometria,
  ejes: buildEjes,
  barras: buildBarras,
  sectores: buildSectores,
};

export const TIPOS_DE_FIGURA = Object.keys(DIBUJANTES);

export function buildFigura(figura, doc = globalThis.document) {
  const dibuja = DIBUJANTES[figura?.tipo];
  return dibuja ? dibuja(figura, doc) : null;
}
