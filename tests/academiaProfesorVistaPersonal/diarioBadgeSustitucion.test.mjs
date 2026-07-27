import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Fila del diario: una entrada con via_sustitucion pinta el badge de
// sustitución junto al nivel, sin tocar el borde de color de estado
// (.ac-card.pending/saved/absent) que ya usa ese canal.
export async function run({ test, assert }) {
  const { buildDiarioRow } = await import("../../assets/academia/profesor/js/diarioCard.js");

  test("entrada visible por sustitución -> pinta el badge con tooltip nombrando al sustituido", () => {
    const entry = { alumno_id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso", horarios: [], sesion: null, via_sustitucion: { sustituido_nombre: "Carlos" } };
    const row = buildDiarioRow(entry, { onAbrir: () => {} });
    const badge = row.querySelector(".ac-badge-sustitucion");
    assert.ok(badge);
    assert.equal(badge.title, "Alumno de Carlos — hoy lo cubres tú");
  });

  test("entrada de un alumno propio (sin via_sustitucion) -> no pinta el badge", () => {
    const entry = { alumno_id: "a2", nombre: "Bea", curso: "1 ESO", nivel: "eso", horarios: [], sesion: null };
    const row = buildDiarioRow(entry, { onAbrir: () => {} });
    assert.equal(row.querySelector(".ac-badge-sustitucion"), null);
  });

  test("el estado de la tarjeta (.ac-card.pending/saved/absent) sigue intacto — canal distinto del badge", () => {
    const entry = { alumno_id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso", horarios: [], sesion: null, via_sustitucion: { sustituido_nombre: "Carlos" } };
    const row = buildDiarioRow(entry, { onAbrir: () => {} });
    assert.ok(row.classList.contains("pendiente"));
  });
}
