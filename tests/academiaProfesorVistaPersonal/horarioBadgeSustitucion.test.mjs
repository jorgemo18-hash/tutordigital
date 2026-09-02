import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Grid del horario: una franja con via_sustitucion pinta el badge de
// sustitución junto al nivel, SIN tocar el borde de color del nivel
// educativo (--lvc) — ese es un canal visual distinto y ya en uso (ver
// docs y el propio horario.js).
export async function run({ test, assert }) {
  const { buildHorarioGrid } = await import("../../assets/academia/profesor/js/horario.js");
  const { nivelInfo } = await import("../../assets/academia/profesor/js/nivel.js");

  const dias = [{ value: 1, name: "Lunes" }];
  // Filas = clases del centro (ver horarioBloques.js), no medias horas.
  const bloques = [{ inicio: "16:00", fin: "17:00" }];

  test("franja visible por sustitución -> pinta el badge, con tooltip nombrando al sustituido", () => {
    const franjas = [{
      id: "h1", dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00",
      alumno: { id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
      via_sustitucion: { sustituido_nombre: "Bea" },
    }];
    const grid = buildHorarioGrid(franjas, dias, bloques);
    const slot = grid.querySelector(".ac-slot");
    const badge = slot.querySelector(".ac-badge-sustitucion");
    assert.ok(badge, "debe pintar el badge de sustitución");
    assert.equal(badge.title, "Alumno de Bea — hoy lo cubres tú");
  });

  test("el borde de nivel (--lvc) sigue intacto cuando hay badge de sustitución — canales distintos", () => {
    const franjas = [{
      id: "h1", dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00",
      alumno: { id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
      via_sustitucion: { sustituido_nombre: "Bea" },
    }];
    const grid = buildHorarioGrid(franjas, dias, bloques);
    const slot = grid.querySelector(".ac-slot");
    assert.equal(slot.style.getPropertyValue("--lvc"), nivelInfo("eso").color);
    assert.ok(slot.querySelector(".ac-lv.eso"), "la pastilla de nivel sigue pintándose igual");
  });

  test("franja de un alumno propio (sin via_sustitucion) -> no pinta ningún badge", () => {
    const franjas = [{
      id: "h2", dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00",
      alumno: { id: "a2", nombre: "Carlos", curso: "1 ESO", nivel: "eso", activo: true },
    }];
    const grid = buildHorarioGrid(franjas, dias, bloques);
    const slot = grid.querySelector(".ac-slot");
    assert.equal(slot.querySelector(".ac-badge-sustitucion"), null);
  });
}
