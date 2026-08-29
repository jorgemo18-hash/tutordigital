// Los TRES estados de un alumno y cómo se filtran.
//
// El bug: un alumno guardado como borrador (ficha del OCR sin terminar)
// aparecía a la vez en la pestaña "Borradores" Y en "Archivados". La lista
// filtraba solo por `activo`, y un borrador tiene activo=false exactamente
// igual que un archivado. Lo que los separa es fecha_baja: el archivado la
// tiene (se le dio de baja un día), el borrador no (nunca estuvo de alta).
export async function run({ test, assert }) {
  const { resolverEstado, aplicarFiltroEstado } = await import(
    "../../server/lib/academiaAlumnos/estado.js"
  );

  // Query falsa encadenable: registra los filtros aplicados, que es
  // justamente lo que hay que comprobar (PostgREST no se ejecuta aquí).
  function queryFalsa() {
    const filtros = [];
    const q = {
      filtros,
      eq: (col, val) => { filtros.push(`eq:${col}=${val}`); return q; },
      is: (col, val) => { filtros.push(`is:${col}=${val}`); return q; },
      not: (col, op, val) => { filtros.push(`not:${col}.${op}.${val}`); return q; },
    };
    return q;
  }

  const filtrosDe = (estado) => aplicarFiltroEstado(queryFalsa(), estado).filtros;

  test("resolverEstado: el parámetro nuevo manda", () => {
    assert.equal(resolverEstado({ estado: "borrador" }), "borrador");
    assert.equal(resolverEstado({ estado: "archivado" }), "archivado");
    assert.equal(resolverEstado({ estado: "activo" }), "activo");
  });

  test("resolverEstado: sin nada, no hay filtro (todos los alumnos)", () => {
    assert.equal(resolverEstado({}), null);
    assert.equal(resolverEstado(), null);
  });

  test("resolverEstado: un estado inventado no cuela como 'sin filtro'", () => {
    // Devolver null aquí enseñaría TODA la lista ante un typo. Se prefiere
    // null explícito solo cuando nadie ha pedido estado (arriba); esto es
    // defensa en profundidad — Zod ya rechaza el valor antes de llegar.
    assert.equal(resolverEstado({ estado: "papelera" }), null);
  });

  test("compatibilidad: activo=true del panel anterior sigue significando activo", () => {
    // Frontend (Vercel) y backend (Render) no se despliegan a la vez.
    assert.equal(resolverEstado({ activo: "true" }), "activo");
  });

  test("REGRESIÓN: activo=false se traduce a ARCHIVADO, no a 'todo lo inactivo'", () => {
    // Esta era la lectura equivocada que metía los borradores en Archivados.
    // Traducirlo así hace que un panel sin actualizar también deje de verlos.
    assert.equal(resolverEstado({ activo: "false" }), "archivado");
  });

  test("REGRESIÓN: 'archivado' exige fecha_baja — es lo que deja fuera a los borradores", () => {
    const filtros = filtrosDe("archivado");
    assert.ok(filtros.includes("eq:activo=false"), "sigue siendo un alumno no activo");
    assert.ok(
      filtros.includes("not:fecha_baja.is.null"),
      "y con fecha de baja: sin esto, los borradores vuelven a colarse aquí"
    );
  });

  test("'borrador' es lo contrario: activo=false y SIN fecha de baja", () => {
    const filtros = filtrosDe("borrador");
    assert.deepEqual(filtros, ["eq:activo=false", "is:fecha_baja=null"]);
  });

  test("'activo' filtra solo por activo=true", () => {
    assert.deepEqual(filtrosDe("activo"), ["eq:activo=true"]);
  });

  test("sin estado no se toca la query", () => {
    assert.deepEqual(filtrosDe(null), []);
  });

  test("borrador y archivado son conjuntos disjuntos", () => {
    // La garantía de fondo: ninguna fila puede cumplir los dos filtros, así
    // que ningún alumno puede volver a salir en las dos pestañas.
    const borrador = filtrosDe("borrador");
    const archivado = filtrosDe("archivado");
    assert.ok(borrador.includes("is:fecha_baja=null"));
    assert.ok(archivado.includes("not:fecha_baja.is.null"));
  });
}
