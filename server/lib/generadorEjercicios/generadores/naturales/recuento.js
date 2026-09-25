import { reuneApartados } from "../../ejercicio.js";

// NATURALES, OBJETIVO 4: RECUENTO SISTEMÁTICO (concepto 5). Saber A.1,
// Conteo: «Estrategias variadas de recuento sistemático en situaciones de
// la vida cotidiana».
//
// Sin fórmulas de combinatoria, que no son de 1.º: se cuenta con un
// diagrama de árbol o una lista ordenada, y la explicación del ejemplo dice
// cómo. Los números son pequeños a propósito: el árbol tiene que caber en
// el cuaderno.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   5 SUMAR las opciones en vez de multiplicarlas (3 primeros, 4 segundos:
//     7 menús);
//   6 contar dos veces lo que es lo mismo (el saludo de Ana a Luis y el de
//     Luis a Ana).

const MULTIPLICATIVOS = [
  {
    id: "menu",
    crea: (azar) => {
      const [a, b, c] = [azar.entero(2, 4), azar.entero(2, 4), azar.entero(2, 3)];
      return {
        enunciado: `Un menú tiene ${a} primeros, ${b} segundos y ${c} postres. ¿Cuántos menús distintos se pueden elegir?`,
        opciones: [a, b, c],
        razon: `Cada primero va con cada segundo (${a} · ${b} = ${a * b} parejas), y cada pareja con cada postre: ${a * b} · ${c} = ${a * b * c}. En un árbol, ${a} ramas, de cada una ${b} y de cada una ${c}.`,
      };
    },
  },
  {
    id: "ropa",
    crea: (azar) => {
      const [a, b] = [azar.entero(3, 5), azar.entero(2, 4)];
      return {
        enunciado: `Lucas tiene ${a} camisetas y ${b} pantalones. ¿De cuántas formas distintas puede vestirse?`,
        opciones: [a, b],
        razon: `Cada camiseta con cada pantalón: ${a} · ${b} = ${a * b}.`,
      };
    },
  },
  {
    // (La heladería está en la otra batería, la de parejas: dos heladerías
    // en la misma hoja parecen copiadas.)
    id: "bocadillo",
    crea: (azar) => {
      const [a, b] = [azar.entero(2, 3), azar.entero(4, 7)];
      return {
        enunciado: `En la cantina hay ${a} tipos de pan y ${b} rellenos. ¿Cuántos bocadillos distintos se pueden pedir (un pan y un relleno)?`,
        opciones: [a, b],
        razon: `Cada pan con cada relleno: ${a} · ${b} = ${a * b}.`,
      };
    },
  },
  {
    id: "contrasena",
    crea: (azar) => {
      const [letras, cifras] = [azar.entero(2, 4), azar.entero(3, 5)];
      return {
        enunciado: `Un candado tiene una rueda con ${letras} letras y otra con ${cifras} números. ¿Cuántas combinaciones distintas tiene?`,
        opciones: [letras, cifras],
        razon: `Cada letra con cada número: ${letras} · ${cifras} = ${letras * cifras}.`,
      };
    },
  },
  {
    id: "camino",
    crea: (azar) => {
      const [a, b] = [azar.entero(2, 4), azar.entero(2, 4)];
      return {
        enunciado: `De casa al parque hay ${a} caminos, y del parque al colegio, ${b}. ¿De cuántas formas se puede ir de casa al colegio pasando por el parque?`,
        opciones: [a, b],
        razon: `Cada camino del primer tramo con cada uno del segundo: ${a} · ${b} = ${a * b}.`,
      };
    },
  },
];

// ── "¿Cuántas formas hay?" (dificultad 2) ───────────────────────────────
export function recuentoMultiplicativo(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(MULTIPLICATIVOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    const p = ctx.crea(azar);
    const r = p.opciones.reduce((x, y) => x * y, 1);
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${r}.`,
      texto: `${p.enunciado} ___`,
      solucion: r,
      contexto: ctx.id,
      sumando: p.opciones.reduce((x, y) => x + y, 0),
      razon: p.razon,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "recuento_multiplicativo",
    arquetipo: "Cuenta las combinaciones posibles con un diagrama de árbol",
    enunciado: "Cuenta con un diagrama de árbol o una lista ordenada:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// El número de parejas de n: n · (n − 1) : 2.
const parejas = (n) => (n * (n - 1)) / 2;

const SIN_ORDEN = [
  {
    id: "saludos",
    crea: (azar) => {
      const n = azar.entero(4, 7);
      return {
        enunciado: `${n} amigos se saludan dándose la mano, cada uno una vez con cada otro. ¿Cuántos apretones de manos hay?`,
        r: parejas(n), dobles: n * (n - 1),
        razon: `El 1.º da la mano a ${n - 1}, el 2.º a ${n - 2} más (con el 1.º ya la ha dado)… ${Array.from({ length: n - 1 }, (_, k) => n - 1 - k).join(" + ")} = ${parejas(n)}.`,
      };
    },
  },
  {
    id: "partidos",
    crea: (azar) => {
      const n = azar.entero(4, 6);
      return {
        enunciado: `En una liguilla de ${n} equipos, cada equipo juega una vez contra cada uno de los demás. ¿Cuántos partidos hay?`,
        r: parejas(n), dobles: n * (n - 1),
        razon: `Una lista ordenada: el 1.º juega ${n - 1} partidos, el 2.º ${n - 2} nuevos… ${Array.from({ length: n - 1 }, (_, k) => n - 1 - k).join(" + ")} = ${parejas(n)}.`,
      };
    },
  },
  {
    id: "cifras",
    crea: (azar) => {
      const cifras = azar.mezcla([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, azar.entero(3, 4)).sort();
      const n = cifras.length;
      return {
        enunciado: `¿Cuántos números de dos cifras distintas se pueden escribir con las cifras ${cifras.join(", ").replace(/, (\d)$/, " y $1")}?`,
        r: n * (n - 1), dobles: null,
        razon: `Aquí el orden SÍ importa (${cifras[0]}${cifras[1]} y ${cifras[1]}${cifras[0]} son distintos): ${n} para la primera cifra y ${n - 1} para la segunda, ${n} · ${n - 1} = ${n * (n - 1)}.`,
      };
    },
  },
  {
    id: "reunion",
    crea: (azar) => {
      const n = azar.entero(4, 6);
      return {
        enunciado: `De un grupo de ${n} alumnos hay que elegir 2 para ir a una reunión. ¿Cuántas parejas distintas se pueden elegir?`,
        r: parejas(n), dobles: n * (n - 1),
        razon: `Ana con Luis es la misma pareja que Luis con Ana: ${n} · ${n - 1} = ${n * (n - 1)} contando el orden, y la mitad sin contarlo, ${parejas(n)}.`,
      };
    },
  },
  {
    id: "copas",
    crea: (azar) => {
      const n = azar.entero(4, 7);
      return {
        enunciado: `Una heladería tiene ${n} sabores. ¿Cuántas copas de dos bolas de sabores distintos se pueden pedir?`,
        r: parejas(n), dobles: n * (n - 1),
        razon: `Fresa y limón es la misma copa que limón y fresa: ${n} · ${n - 1} = ${n * (n - 1)} contando el orden, y la mitad sin contarlo, ${parejas(n)}.`,
      };
    },
  },
];

// ── "¿Importa el orden?" (dificultad 3) ─────────────────────────────────
// De 3 a 4: casi todos sin orden (saludos, partidos, parejas), donde contar
// dos veces lo mismo (error 6) da el doble, y uno con orden (números de dos
// cifras), para que no se divida entre 2 por costumbre.
export function recuentoSinOrden(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(SIN_ORDEN);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    const p = ctx.crea(azar);
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${p.r}.`,
      texto: `${p.enunciado} ___`,
      solucion: p.r,
      contexto: ctx.id,
      contandoDosVeces: p.dobles,
      razon: p.razon,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "recuento_sin_orden",
    arquetipo: "Cuenta parejas decidiendo si importa el orden",
    enunciado: "Cuenta con una lista ordenada (¿importa el orden?):",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
