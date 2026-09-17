// LOS GENERADORES DE POTENCIAS, contra las instrucciones del catálogo.
//
// El arquetipo "Calcula potencias de base entera" tiene la instrucción más
// concreta de todo el tema: "incluye SIEMPRE al menos una base negativa con
// exponente par y otra con impar, y alguna potencia de -1 y de +1 con
// exponente grande, que es donde se ve si ha entendido la regla o la está
// calculando". Son cuatro condiciones simultáneas sobre la misma batería, y
// es justo el tipo de cosa que un modelo cumple casi siempre — que en una
// hoja para un alumno concreto no es lo mismo que siempre.
export async function run({ test, assert }) {
  const gen = await import("../../server/lib/generadorEjercicios/generadores/potencias.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");
  const { evaluar } = await import("../../server/lib/generadorEjercicios/expresion.js");

  const SEMILLAS = ["a", "b", "c", "d", "e", "f", 1, 2, 3, 42, 7777, 123456];
  const conSemillas = (fn, opciones) => SEMILLAS.map((s) => fn(crearAzar(s), opciones));

  // base y exponente leídos del árbol. `paresConYSinParentesis` mete además
  // el menos unario por fuera, así que se desenvuelve.
  const partes = (arbol) => {
    const nudo = arbol.tipo === "neg" ? arbol.hijo : arbol;
    return { base: nudo.izq.valor, exponente: nudo.der.valor, menosFuera: arbol.tipo === "neg" };
  };

  test("la solución de cada apartado es su potencia resuelta", () => {
    for (const [nombre, fn] of Object.entries(gen)) {
      for (const ej of conSemillas(fn)) {
        for (const a of ej.apartados) {
          const { valor } = evaluar(a.arbol, { tope: 1e9 });
          assert.equal(a.solucion, valor, `${nombre}: "${a.texto}" dice ${a.solucion} y vale ${valor}`);
        }
      }
    }
  });

  // ── Calcula potencias de base entera ──────────────────────────────────

  test("potencias: las CUATRO condiciones del catálogo se cumplen en cada batería", () => {
    for (const ej of conSemillas(gen.potenciasDeBaseEntera)) {
      const p = ej.apartados.map((a) => partes(a.arbol));
      const impreso = ej.apartados.map((a) => a.texto).join(" | ");
      assert.ok(
        p.some((x) => x.base < -1 && x.exponente % 2 === 0),
        `falta base negativa con exponente par: ${impreso}`,
      );
      assert.ok(
        p.some((x) => x.base < -1 && x.exponente % 2 === 1),
        `falta base negativa con exponente impar: ${impreso}`,
      );
      assert.ok(
        p.some((x) => x.base === -1 && x.exponente > 100),
        `falta una potencia de -1 con exponente grande: ${impreso}`,
      );
      assert.ok(
        p.some((x) => x.base === 1 && x.exponente > 100),
        `falta una potencia de +1 con exponente grande: ${impreso}`,
      );
    }
  });

  test("potencias: lo que no sea base ±1 se puede calcular a mano", () => {
    // No hay calculadora en 1.º ESO. `(-9)^4 = 6561` es un entero válido y un
    // ejercicio inútil: mide paciencia multiplicando, no potencias de
    // enteros. El exponente grande solo se permite con base ±1, donde la
    // paridad lo resuelve sin calcular nada.
    for (const ej of conSemillas(gen.potenciasDeBaseEntera)) {
      for (const a of ej.apartados) {
        const { base, exponente } = partes(a.arbol);
        if (Math.abs(base) === 1) continue;
        assert.ok(exponente <= 4, `exponente ${exponente} con base ${base} en "${a.texto}"`);
        assert.ok(
          Math.abs(a.solucion) <= 1000,
          `"${a.texto}" da ${a.solucion}: eso no se hace de cabeza`,
        );
      }
    }
  });

  test("potencias: no salen dos que solo se diferencien en el signo de la base", () => {
    // La regresión: en la misma hoja aparecían `(-2)^4` y `2^4`. Para el
    // descarte por texto son distintas; para el alumno son el mismo apartado
    // repetido con la misma respuesta.
    for (const ej of conSemillas(gen.potenciasDeBaseEntera)) {
      const vistas = new Set();
      for (const a of ej.apartados) {
        const { base, exponente } = partes(a.arbol);
        const clave = `${Math.abs(base)}^${exponente}`;
        assert.equal(
          vistas.has(clave),
          false,
          `${clave} repetida: ${ej.apartados.map((x) => x.texto).join(" | ")}`,
        );
        vistas.add(clave);
      }
    }
  });

  test("potencias: como MUCHO una base positiva distinta de 1", () => {
    for (const ej of conSemillas(gen.potenciasDeBaseEntera)) {
      const positivas = ej.apartados.filter((a) => partes(a.arbol).base > 1);
      assert.ok(
        positivas.length <= 1,
        `${positivas.length} bases positivas: ${positivas.map((a) => a.texto).join(" | ")}`,
      );
    }
  });

  // ── Distingue (-3)^2 de -3^2 ──────────────────────────────────────────

  test("pares: salen de dos en dos y los dos de cada fila comparten base y exponente", () => {
    // Con `columnas: 2` la hoja pone a) y b) en la misma fila. Si el número
    // de apartados fuera impar, la última pareja se partiría entre dos filas
    // y el ejercicio perdería lo único que lo hace un ejercicio.
    for (const ej of conSemillas(gen.paresConYSinParentesis)) {
      assert.equal(ej.apartados.length % 2, 0, `${ej.apartados.length} apartados, impar`);
      assert.ok(ej.apartados.length >= 4, `solo ${ej.apartados.length} apartados`);
      for (let i = 0; i < ej.apartados.length; i += 2) {
        const a = partes(ej.apartados[i].arbol);
        const b = partes(ej.apartados[i + 1].arbol);
        assert.equal(Math.abs(a.base), Math.abs(b.base), `bases distintas en la fila ${i / 2 + 1}`);
        assert.equal(a.exponente, b.exponente, `exponentes distintos en la fila ${i / 2 + 1}`);
        // El primero lleva el menos DENTRO del paréntesis y el segundo fuera.
        assert.equal(a.menosFuera, false, `el primero de la fila ya lleva el menos fuera`);
        assert.equal(b.menosFuera, true, `el segundo de la fila no lleva el menos fuera`);
      }
    }
  });

  test("pares: el exponente es 2, porque el arquetipo dice 'razonamiento, no cálculo'", () => {
    // `(-3)^4 = 81` frente a `-3^4 = -81` es una pareja válida y un ejercicio
    // peor: añade una multiplicación de cuatro factores a algo cuya única
    // dificultad tenía que ser ver dónde está el menos. En el folio salieron
    // las dos filas con exponente 4.
    for (const ej of conSemillas(gen.paresConYSinParentesis)) {
      for (const a of ej.apartados) {
        assert.equal(partes(a.arbol).exponente, 2, `"${a.texto}" no es un cuadrado`);
      }
    }
  });

  test("pares: los dos de cada fila dan resultados OPUESTOS, nunca el mismo", () => {
    // Es el único motivo de existir de esta batería. Con exponente impar
    // `(-2)^3` y `-2^3` valen los dos -8, y la pareja demostraría justo lo
    // contrario de lo que pretende: que el paréntesis no importa. De ahí que
    // el generador solo use exponentes pares.
    for (const ej of conSemillas(gen.paresConYSinParentesis)) {
      for (let i = 0; i < ej.apartados.length; i += 2) {
        const a = ej.apartados[i];
        const b = ej.apartados[i + 1];
        assert.equal(partes(a.arbol).exponente % 2, 0, `"${a.texto}" tiene exponente impar`);
        assert.equal(a.solucion, -b.solucion, `"${a.texto}" y "${b.texto}" no son opuestos`);
      }
    }
  });

  test("pares: el paréntesis del primero y su ausencia en el segundo se IMPRIMEN", () => {
    // La diferencia tiene que estar en el folio, no solo en el árbol: es lo
    // único que el alumno ve.
    for (const ej of conSemillas(gen.paresConYSinParentesis)) {
      for (let i = 0; i < ej.apartados.length; i += 2) {
        const a = ej.apartados[i];
        const b = ej.apartados[i + 1];
        assert.ok(/^\(-\d+\)\^/.test(a.texto), `"${a.texto}" no empieza por (-n)^`);
        assert.ok(/^-\d+\^/.test(b.texto), `"${b.texto}" no empieza por -n^`);
      }
    }
  });
}
