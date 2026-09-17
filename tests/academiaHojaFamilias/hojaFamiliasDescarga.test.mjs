import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// IMPRIMIR SACA CUATRO; DESCARGAR, UNA.
//
// Jorge, 17/09/2026: *"que cuando le des a imprimir haga lo mismo que ahora,
// pero cuando le das a descargar, en vez de descargarse los cuatro, solo
// estuviera uno, en plan por si alguien me pregunta por WhatsApp no pasarle
// una foto o los cuatro"*.
//
// El folio de cuatro es para las tijeras. Mandado por el móvil es un estorbo:
// el mismo papel repetido cuatro veces con dos rayas de corte encima, y hay
// que hacer zoom para leer un cuarto de la pantalla — que es justo el problema
// de mandar una foto del papel.
//
// LO QUE SE VIGILA AQUÍ es el cableado, que es donde esto se puede romper sin
// que nadie se entere: que la tarjeta pida LAS DOS versiones, que la vista
// previa y el botón de imprimir sigan usando el folio de cuatro, y que el de
// descargar use la cuartilla. Un fallo aquí no da ningún error: simplemente se
// descargaría el papel equivocado, y eso solo se ve cuando ya está en el
// WhatsApp de una madre.
export async function run({ test, assert }) {
  const { buildHojaFamiliasCard } = await import(
    "../../assets/academia/admin/js/sections/documentos/hojaFamiliasCard.js"
  );
  const { buildPreviewPanel } = await import(
    "../../assets/academia/admin/js/sections/documentos/preview/previewPanel.js"
  );

  // Un doble de la API que apunta con qué se le llamó y devuelve un blob
  // distinguible por versión.
  function apiFalsa({ fallaLaCuartilla = false } = {}) {
    const llamadas = [];
    const fn = async ({ copias = 4 } = {}) => {
      llamadas.push(Number(copias));
      if (Number(copias) === 1 && fallaLaCuartilla) throw new Error("no se pudo");
      return { tipo: Number(copias) === 1 ? "cuartilla" : "folio" };
    };
    return { fn, llamadas };
  }

  // happy-dom no implementa URL.createObjectURL, y lo que hay que comprobar
  // es QUÉ blob acaba en cada botón, no la URL en sí. Se sustituye por una
  // tabla de url -> blob.
  function espiarObjectUrls() {
    const porUrl = new Map();
    let n = 0;
    const antes = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
    URL.createObjectURL = (blob) => {
      n += 1;
      const url = `blob:fake/${n}`;
      porUrl.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = () => {};
    return {
      blobDe: (url) => porUrl.get(url),
      restaurar: () => { URL.createObjectURL = antes.crear; URL.revokeObjectURL = antes.revocar; },
    };
  }

  // EL <IFRAME> SE SUSTITUYE POR UN DIV, Y NO ES UN CAPRICHO DE ESTILO.
  // `pdf-parse` (su pdf.js empaquetado) reemplaza `Object.defineProperty` en
  // cuanto alguien lo importa, y a partir de ese momento happy-dom no puede
  // construir un `<iframe>`: lanza "Object.prototype.__defineSetter__:
  // Expecting function" porque un iframe le monta su propia BrowserWindow
  // dentro. Este archivo pasaba solo y fallaba en la suite completa por eso,
  // sin que el error tuviera nada que ver con el código que se prueba.
  //
  // Lo que importa aquí es a qué blob apunta el visor, no que el visor sea un
  // iframe de verdad, así que se le da un div y se guarda la referencia. El
  // `.src` se le queda puesto como propiedad igual.
  function interceptarElementos() {
    const creados = { visor: null, enlace: null };
    const crear = document.createElement.bind(document);
    document.createElement = (tag) => {
      if (tag === "iframe") {
        creados.visor = crear("div");
        return creados.visor;
      }
      const el = crear(tag);
      if (tag === "a") {
        el.click = () => { creados.enlace = { href: el.href, nombre: el.download }; };
      }
      return el;
    };
    return { creados, restaurar: () => { document.createElement = crear; } };
  }

  // Monta tarjeta + preview de verdad, pulsa "Abrir" y devuelve lo que quedó
  // en pantalla.
  async function abrirLaTarjeta({ fallaLaCuartilla = false } = {}) {
    const urls = espiarObjectUrls();
    const dom = interceptarElementos();
    const api = apiFalsa({ fallaLaCuartilla });
    const preview = buildPreviewPanel();
    const card = buildHojaFamiliasCard({
      preview, tenantNombre: "Lyceo", descargarFn: api.fn,
    });
    document.body.innerHTML = "";
    document.body.append(card, preview.el);

    card.querySelector("button").click();
    // La carga encadena varias promesas (el Promise.all, el .catch de la
    // cuartilla y el pintado), así que se espera A QUE APAREZCA el resultado
    // en vez de contar ticks: contarlos es lo que rompe un test el día que se
    // añade un `await` más.
    for (let i = 0; i < 50; i += 1) {
      if (dom.creados.visor || preview.el.querySelector(".error")) break;
      await esperar(0);
    }

    const [imprimir, descargar] = preview.el.querySelectorAll(".ac-doc-preview-actions button");
    const cerrar = () => { dom.restaurar(); urls.restaurar(); };
    return { urls, api, preview, imprimir, descargar, dom, cerrar, visor: dom.creados.visor };
  }

  test("EL PUNTO DE TODO: al abrir se piden las DOS versiones", async () => {
    const t = await abrirLaTarjeta();
    assert.deepEqual(t.api.llamadas.slice().sort(), [1, 4], "el folio de cuatro y la cuartilla");
    t.cerrar();
  });

  test("lo que se ve y lo que se imprime es el folio de CUATRO", async () => {
    const t = await abrirLaTarjeta();
    assert.ok(t.visor, "la vista previa tiene que pintar el PDF");
    assert.deepEqual(t.urls.blobDe(t.visor.src), { tipo: "folio" });
    t.cerrar();
  });

  test("lo que se descarga es UNA cuartilla", async () => {
    const t = await abrirLaTarjeta();
    t.descargar.click();
    const bajado = t.dom.creados.enlace;
    assert.ok(bajado, "el botón de descargar tiene que disparar el enlace");
    assert.deepEqual(t.urls.blobDe(bajado.href), { tipo: "cuartilla" });
    assert.equal(bajado.nombre, "informacion-familias-lyceo.pdf");
    t.cerrar();
  });

  // Si la cuartilla no se pudo generar, la vista previa NO se cae: sale el
  // folio de cuatro y el botón de descargar baja eso. Perder la comodidad del
  // WhatsApp es un problema menor que no poder imprimir cuando hay una familia
  // esperando delante.
  test("si falla la cuartilla, se sigue pudiendo ver, imprimir y descargar el folio", async () => {
    const t = await abrirLaTarjeta({ fallaLaCuartilla: true });
    assert.ok(t.visor, "la vista previa sigue ahí");
    assert.ok(!t.imprimir.classList.contains("hidden"), "y el botón de imprimir");
    assert.ok(!t.descargar.classList.contains("hidden"), "y el de descargar");
    assert.deepEqual(t.urls.blobDe(t.visor.src), { tipo: "folio" });

    t.descargar.click();
    assert.deepEqual(
      t.urls.blobDe(t.dom.creados.enlace.href), { tipo: "folio" },
      "degrada al folio, no se queda sin hacer nada"
    );
    t.cerrar();
  });

  // El resto de documentos (hoja de inscripción, normas) no pasan
  // `blobDescarga`, y tienen que seguir descargando lo que se ve. Es lo que
  // asegura que este cambio no se les cuele por debajo.
  test("sin blobDescarga se baja lo que se está viendo, como siempre", async () => {
    const urls = espiarObjectUrls();
    const dom = interceptarElementos();
    const preview = buildPreviewPanel();
    document.body.innerHTML = "";
    document.body.appendChild(preview.el);
    preview.mostrarPdf({ blob: { tipo: "lo-que-sea" }, titulo: "Normas", filename: "normas.pdf" });

    const botones = preview.el.querySelectorAll(".ac-doc-preview-actions button");
    botones[1].click();
    assert.deepEqual(urls.blobDe(dom.creados.enlace.href), { tipo: "lo-que-sea" });
    dom.restaurar();
    urls.restaurar();
  });
}
