import { reuneApartados } from "../../ejercicio.js";
import { milesTexto } from "../potenciasRaices/formato.js";

// NATURALES, OBJETIVO 5: PROBLEMAS (concepto 6). Saber A.3: «Operaciones…
// en situaciones contextualizadas».
//
// Plantillas escritas a mano y datos que salen de la solución, como en los
// demás temas. Dos baterías: problemas de varias operaciones y problemas
// de división en los que hay que INTERPRETAR el resto.
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR la segunda es el 7: contestar sin
// pensar qué pasa con el resto. Unas veces se queda corto (230 alumnos en
// autobuses de 55 plazas: "4 autobuses", y 10 en tierra), otras se pasa
// ("se llenan 20 cajas" cuando la 20.ª va a medias) y otras contesta el
// cociente cuando se pregunta lo que sobra.

const VARIAS = [
  {
    id: "excursion",
    crea: (azar) => {
      const alumnos = azar.entero(40, 90);
      const precio = azar.entero(8, 15);
      const bus = 10 * azar.entero(25, 60);
      return {
        enunciado: `Van de excursión ${alumnos} alumnos. La entrada cuesta ${precio} € por alumno y el autobús, ${bus} € en total. ¿Cuánto cuesta la excursión?`,
        r: alumnos * precio + bus, unidad: "€",
        razon: `Entradas: ${alumnos} · ${precio} = ${alumnos * precio} €. Con el autobús: ${alumnos * precio} + ${bus} = ${milesTexto(alumnos * precio + bus)} €.`,
      };
    },
  },
  {
    id: "ahorro",
    crea: (azar) => {
      const semana = azar.entero(5, 15);
      const semanas = azar.entero(6, 20);
      const gasta = azar.entero(10, semana * semanas - 10);
      return {
        enunciado: `Marta ahorra ${semana} € cada semana durante ${semanas} semanas y se gasta ${gasta} € en un regalo. ¿Cuánto le queda?`,
        r: semana * semanas - gasta, unidad: "€",
        razon: `Ahorra ${semana} · ${semanas} = ${semana * semanas} €, y le quedan ${semana * semanas} − ${gasta} = ${semana * semanas - gasta} €.`,
      };
    },
  },
  {
    id: "cajas",
    crea: (azar) => {
      const cajas = azar.entero(6, 25);
      const porCaja = azar.entero(12, 48);
      const rotos = azar.entero(3, 20);
      return {
        enunciado: `Llegan ${cajas} cajas con ${porCaja} vasos cada una, y ${rotos} vasos vienen rotos. ¿Cuántos vasos sanos hay?`,
        r: cajas * porCaja - rotos, unidad: "vasos",
        razon: `${cajas} · ${porCaja} = ${cajas * porCaja} vasos, menos ${rotos} rotos: ${cajas * porCaja - rotos}.`,
      };
    },
  },
  {
    id: "libro",
    crea: (azar) => {
      const dias = azar.entero(5, 12);
      const paginas = azar.entero(12, 30);
      const faltan = azar.entero(20, 120);
      return {
        enunciado: `Leo ha leído ${paginas} páginas al día durante ${dias} días y le faltan ${faltan} páginas para acabar el libro. ¿Cuántas páginas tiene el libro?`,
        r: dias * paginas + faltan, unidad: "páginas",
        razon: `Leídas: ${dias} · ${paginas} = ${dias * paginas}. Con las que faltan: ${dias * paginas} + ${faltan} = ${dias * paginas + faltan}.`,
      };
    },
  },
  {
    id: "reparto",
    crea: (azar) => {
      const personas = azar.entero(3, 8);
      const cada = azar.entero(15, 60);
      const bote = azar.entero(10, 50);
      return {
        enunciado: `Una cena cuesta ${personas * cada + bote} €. Los ${personas} amigos pagan ${bote} € con un bote común y el resto a partes iguales. ¿Cuánto paga cada uno?`,
        r: cada, unidad: "€",
        razon: `Sin el bote quedan ${personas * cada + bote} − ${bote} = ${personas * cada} €, y entre ${personas}: ${personas * cada} : ${personas} = ${cada} €.`,
      };
    },
  },
];

// Problemas de división con resto: la respuesta NO es el cociente tal cual.
const CON_RESTO = [
  {
    id: "autobuses",
    crea: (azar) => {
      const plazas = azar.elige([45, 50, 55, 60]);
      const c = azar.entero(2, 6);
      const r = azar.entero(3, plazas - 5);
      const n = plazas * c + r;
      return {
        enunciado: `Van ${n} alumnos de excursión en autobuses de ${plazas} plazas. ¿Cuántos autobuses hacen falta?`,
        solucion: c + 1, otraLectura: c,
        razon: `${n} : ${plazas} = ${c}, y sobran ${r}: esos ${r} también tienen que ir, así que hace falta otro autobús. ${c + 1}.`,
      };
    },
  },
  {
    id: "cajas_huevos",
    crea: (azar) => {
      const caben = azar.elige([6, 12]);
      const c = azar.entero(8, 40);
      const r = azar.entero(1, caben - 1);
      const n = caben * c + r;
      return {
        enunciado: `Una granja recoge ${n} huevos y los pone en cajas de ${caben}. ¿Cuántas cajas se LLENAN?`,
        solucion: c, otraLectura: c + 1,
        razon: `${n} : ${caben} = ${c}, y sobran ${r}, que no llenan otra caja. Se llenan ${c}.`,
      };
    },
  },
  {
    id: "sobran",
    crea: (azar) => {
      const alumnos = azar.entero(4, 9);
      const c = azar.entero(5, 20);
      const r = azar.entero(1, alumnos - 1);
      const n = alumnos * c + r;
      return {
        enunciado: `Se reparten ${n} caramelos entre ${alumnos} niños, a todos los mismos y los máximos posibles. ¿Cuántos caramelos SOBRAN?`,
        solucion: r, otraLectura: c,
        razon: `${n} : ${alumnos} = ${c} para cada uno, y sobran ${r} (${alumnos} · ${c} = ${alumnos * c}; ${n} − ${alumnos * c} = ${r}).`,
      };
    },
  },
  {
    id: "estantes",
    crea: (azar) => {
      const porEstante = azar.entero(15, 30);
      const c = azar.entero(3, 9);
      const r = azar.entero(2, porEstante - 2);
      const n = porEstante * c + r;
      return {
        enunciado: `En cada estante caben ${porEstante} libros. ¿Cuántos estantes hacen falta para colocar ${n} libros?`,
        solucion: c + 1, otraLectura: c,
        razon: `${n} : ${porEstante} = ${c}, y sobran ${r} libros que necesitan otro estante: ${c + 1}.`,
      };
    },
  },
  {
    id: "tablas",
    crea: (azar) => {
      const trozo = azar.elige([30, 40, 45, 60]);
      const c = azar.entero(3, 8);
      const r = azar.entero(5, trozo - 5);
      const n = trozo * c + r;
      return {
        enunciado: `De un listón de ${n} cm se cortan trozos de ${trozo} cm. ¿Cuántos trozos enteros salen?`,
        solucion: c, otraLectura: c + 1,
        razon: `${n} : ${trozo} = ${c}, y sobran ${r} cm, que no llegan a otro trozo. Salen ${c}.`,
      };
    },
  },
];

function bateria(azar, cuantos, contextos, arma) {
  const plan = azar.mezcla(contextos);
  let i = 0;
  return reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    return { ...arma(ctx.crea(azar)), contexto: ctx.id };
  }, { cuantos, clave: (a) => a.contexto }).apartados;
}

// ── "Problemas de varias operaciones" (dificultad 2) ────────────────────
export function problemasNaturales(azar, { cuantos = 3 } = {}) {
  const apartados = bateria(azar, cuantos, VARIAS, (p) => {
    const sol = `${milesTexto(p.r)} ${p.unidad}`;
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${sol}.`,
      texto: `${p.enunciado} ___`,
      solucion: sol,
      razon: p.razon,
    };
  });
  return {
    clave: "problemas_naturales",
    arquetipo: "Resuelve problemas de varias operaciones con números naturales",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Problemas en los que el resto importa" (dificultad 3) ──────────────
export function problemasDeResto(azar, { cuantos = 3 } = {}) {
  const apartados = bateria(azar, cuantos, CON_RESTO, (p) => ({
    latex: `${p.enunciado} ___`,
    latexResuelto: `${p.enunciado} ${p.solucion}.`,
    texto: `${p.enunciado} ___`,
    solucion: p.solucion,
    otraLectura: p.otraLectura,
    razon: p.razon,
  }));
  return {
    clave: "problemas_de_resto",
    arquetipo: "Resuelve problemas de división interpretando el resto",
    enunciado: "Resuelve (piensa qué hacer con lo que sobra):",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
