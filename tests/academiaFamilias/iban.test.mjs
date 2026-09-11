// Validación del IBAN.
//
// POR QUÉ EXISTE ESTO (11/09/2026). El campo IBAN de una familia era texto
// libre: cualquier cosa se guardaba. Se comprobaron con mod-97 los 22 que
// había escritos a mano en Lyceo y CUATRO estaban mal — tres por longitud
// (uno de 20 caracteres, dos de 22, cuando un IBAN español tiene 24) y uno
// con la longitud correcta y un carácter equivocado. Un 18% de las
// domiciliaciones, ninguna cobrable.
//
// Nadie se había enterado porque copiar 24 caracteres a mano falla EN
// SILENCIO: no hay nada en la pantalla que diga que el número está mal, y el
// fallo aparece cuando el banco devuelve el cargo, semanas después y sin
// decir cuál de las familias era.
//
// El IBAN lleva su dígito de control precisamente para esto. No usarlo era
// tirar la única red que el formato trae de serie.
//
// Los IBAN de los casos son EJEMPLOS DE DOCUMENTACIÓN (el ES91…0005 1332 es
// el de la especificación), nunca de la base de datos: un test no es sitio
// para una cuenta de nadie.
const ES_VALIDO  = "ES9121000418450200051332";
const GB_VALIDO  = "GB82WEST12345698765432";

export async function run({ test, assert }) {
  const { ibanValido, motivoIbanInvalido, normalizarIban, formatearIban } =
    await import("../../assets/shared/js/iban.js");

  test("un IBAN español correcto pasa", () => {
    assert.equal(ibanValido(ES_VALIDO), true);
    assert.equal(motivoIbanInvalido(ES_VALIDO), "");
  });

  test("da igual cómo venga escrito: espacios, guiones y minúsculas", () => {
    // Es como lo copia la gente del papel del banco, en grupos de cuatro.
    for (const variante of [
      "ES91 2100 0418 4502 0005 1332",
      "es9121000418450200051332",
      "ES91-2100-0418-4502-0005-1332",
      "  ES9121000418450200051332  ",
    ]) {
      assert.equal(ibanValido(variante), true, `rechazado: ${variante}`);
      assert.equal(normalizarIban(variante), ES_VALIDO);
    }
  });

  test("REGRESIÓN: un dígito cambiado NO pasa", () => {
    // El caso de Estefanía Cid: 24 caracteres, longitud perfecta, y el
    // banco lo devuelve. Esto es lo que ningún regex de forma detecta.
    const conErrata = ES_VALIDO.slice(0, -1) + "3";
    assert.notEqual(conErrata, ES_VALIDO);
    assert.equal(ibanValido(conErrata), false);
    assert.match(motivoIbanInvalido(conErrata), /control/i);
  });

  test("REGRESIÓN: faltan caracteres — y el aviso dice cuántos", () => {
    // Los otros tres casos reales. El mensaje tiene que ser accionable:
    // "faltan 2" se corrige mirando el papel; "IBAN incorrecto" no.
    assert.equal(motivoIbanInvalido(ES_VALIDO.slice(0, 22)), "Faltan 2 caracteres: un IBAN de ES tiene 24.");
    assert.equal(motivoIbanInvalido(ES_VALIDO.slice(0, 20)), "Faltan 4 caracteres: un IBAN de ES tiene 24.");
    // Y en singular, que es la mitad de las veces.
    assert.equal(motivoIbanInvalido(ES_VALIDO.slice(0, 23)), "Falta 1 carácter: un IBAN de ES tiene 24.");
  });

  test("y si sobran, también lo dice", () => {
    assert.match(motivoIbanInvalido(ES_VALIDO + "77"), /Sobran 2 caracteres/);
  });

  test("vacío NO es inválido: es 'todavía no lo tengo'", () => {
    // Importante: si vacío fuera inválido, no se podría guardar una familia
    // sin IBAN, y eso bloquearía altas que hoy funcionan.
    for (const v of ["", null, undefined, "   "]) {
      assert.equal(motivoIbanInvalido(v), "", `${JSON.stringify(v)} debería ser aceptable`);
      assert.equal(ibanValido(v), false, "pero tampoco es un IBAN válido");
    }
  });

  test("una familia extranjera de la zona SEPA también se acepta", () => {
    assert.equal(ibanValido(GB_VALIDO), true);
  });

  test("lo que no es un IBAN se rechaza por la FORMA, no por el mod-97", () => {
    // Importante que el motivo sea el de la forma: hasta que se exigieron
    // los dos dígitos de control en las posiciones 3 y 4, un texto
    // cualquiera llegaba al mod-97 y el aviso decía "el dígito de control
    // no cuadra" — cierto y completamente inútil para quien lo lee.
    assert.match(motivoIbanInvalido("1234567890"), /dos letras de país/);
    assert.match(motivoIbanInvalido("la cuenta del santander"), /dos letras de país/);
    assert.match(motivoIbanInvalido("ESXX2100041845020005133"), /dos dígitos de control/);
  });

  test("se enseña en grupos de cuatro, como en el papel", () => {
    assert.equal(formatearIban(ES_VALIDO), "ES91 2100 0418 4502 0005 1332");
    assert.equal(formatearIban(""), "");
  });

  test("el mod-97 se calcula a trozos: un IBAN largo no pierde precisión", () => {
    // 34 caracteres es el máximo del formato. Con Number, el entero de 30 y
    // pico dígitos se redondearía y la validación empezaría a dar resultados
    // aleatorios para los países de IBAN largo.
    const largo = "MT84MALT011000012345MTLCAST001S"; // ejemplo de la especificación (31)
    assert.equal(ibanValido(largo), true);
  });
}
