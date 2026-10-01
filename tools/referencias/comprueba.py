"""COMPRUEBA LAS SOLUCIONES DE LOS EJERCICIOS DE REFERENCIA (con sympy).

    python3 tools/referencias/comprueba.py server/lib/ejerciciosReferencia/datos/eso/matematicas/2
    python3 tools/referencias/comprueba.py server/lib/ejerciciosReferencia/datos/eso/matematicas/4/a-*.json

Los ejercicios de referencia (server/lib/ejerciciosReferencia/) se sacan de
hojas y libros libres. Sus soluciones NO se creen: en el piloto del 30/9 una
hoja traía dos problemas cuyo planteamiento daba 48/7 años y 7,5 años. Aquí se
calculan.

Cada ejercicio puede llevar `comprobar`: una lista de comprobaciones, una por
apartado. Tipos:
  ecuacion  {"ecuacion": "2*x-5 = 4*x-7", "respuesta": ["1"]}
            respuesta: lista de soluciones, "sin solución" o "identidad".
  sistema   {"ecuaciones": ["x+y = 10", "x-y = 2"], "respuesta": {"x": "6", "y": "4"}}
  igualdad  {"expresion": "3*(7*x-3)-2*(2*x+5)", "respuesta": "17*x-19"}
            (exacta: la expresión y la respuesta son la misma cosa)
  valor     {"expresion": "sqrt(6**2+8**2)", "respuesta": "10", "tolerancia": 0.01}
            (numérica: para redondeos; sin tolerancia, exacta)
  estadistica {"datos": [7, 5, 6], "medida": "media", "respuesta": "6"}
            medida: media, mediana, moda (respuesta: lista) o rango
Todas admiten "apartado": "a" y "enunciado": "…" (el apartado en LaTeX; si
está, el enunciado del ejercicio es solo la consigna).

Resultado: cada ejercicio queda con `verificacion`:
  comprobada    todas sus comprobaciones cuadran;
  sin_verificar no tiene `comprobar` (problemas abiertos, construcciones…);
y si alguna NO cuadra, el programa lo dice y termina con error: un ejercicio
con la solución mal no entra (se corrige o se quita a mano).
Si el ejercicio no trae `solucion`, se escribe a partir de las respuestas
(y se marca `solucion_generada`, para rehacerla en cada pasada). Una solución
escrita a mano tiene que contener los valores que salen del cálculo.
"""
import json
import re
import sys
from pathlib import Path

from sympy import Eq, Rational, S, latex, nsimplify, simplify, solve, symbols, sympify
from sympy.parsing.sympy_parser import (implicit_multiplication_application, parse_expr, rationalize,
                                        standard_transformations)

# Los decimales, como fracciones exactas: 1.6·0.75 es 1.2, no 1.2000000000001.
TRANSFORMACIONES = standard_transformations + (implicit_multiplication_application, rationalize)
LETRAS = {c: symbols(c) for c in "abcmnptxyz"}


def expr(texto):
    return parse_expr(texto.replace("^", "**"), local_dict=dict(LETRAS), transformations=TRANSFORMACIONES)


def lados(ecuacion):
    izq, der = ecuacion.split("=")
    return expr(izq), expr(der)


def iguales(a, b):
    return simplify(a - b) == 0


def comprueba_ecuacion(c):
    izq, der = lados(c["ecuacion"])
    var = LETRAS[c.get("var", "x")]
    d = simplify(izq - der)
    if d == 0:
        calculada = "identidad"
    else:
        # En la ESO, "sin solución" es sin solución REAL (x² + 75 = 0).
        sols = [s for s in solve(Eq(izq, der), var) if s.is_real]
        calculada = sorted(sols, key=lambda s: float(s)) if sols else "sin solución"
    esperada = c["respuesta"]
    if isinstance(esperada, str) or isinstance(calculada, str):
        return esperada == calculada, calculada
    esperada = sorted((expr(s) for s in esperada), key=float)
    ok = len(esperada) == len(calculada) and all(iguales(a, b) for a, b in zip(esperada, calculada))
    return ok, calculada


def comprueba_sistema(c):
    eqs = [Eq(*lados(e)) for e in c["ecuaciones"]]
    vars_ = [LETRAS[v] for v in c.get("vars", ["x", "y"])]
    sol = solve(eqs, vars_, dict=True)
    esperada = c["respuesta"]
    if isinstance(esperada, str):
        calculada = "sin solución" if not sol else "infinitas" if len(sol[0]) < len(vars_) else sol
        return esperada == calculada, calculada
    if len(sol) != 1 or len(sol[0]) != len(vars_):
        return False, sol
    return all(iguales(sol[0][LETRAS[v]], expr(r)) for v, r in esperada.items()), sol[0]


def comprueba_igualdad(c):
    return iguales(expr(c["expresion"]), expr(c["respuesta"])), expr(c["respuesta"])


def comprueba_valor(c):
    v, r = expr(c["expresion"]), expr(c["respuesta"])
    if "tolerancia" in c:
        return abs(float(v) - float(r)) <= c["tolerancia"], v
    return iguales(v, r), v


def comprueba_estadistica(c):
    """Medidas de unos datos: media, mediana, moda (lista), rango."""
    datos = [expr(str(d)) for d in c["datos"]]
    orden = sorted(datos)
    n = len(orden)
    medida = c["medida"]
    if medida == "media":
        calculada = sum(datos) / n
    elif medida == "mediana":
        calculada = orden[n // 2] if n % 2 else (orden[n // 2 - 1] + orden[n // 2]) / 2
    elif medida == "moda":
        veces = {d: datos.count(d) for d in set(datos)}
        maximo = max(veces.values())
        calculada = sorted(d for d, v in veces.items() if v == maximo)
        return calculada == sorted(expr(str(r)) for r in c["respuesta"]), calculada
    elif medida == "rango":
        calculada = orden[-1] - orden[0]
    else:
        raise ValueError(f"medida desconocida: {medida}")
    return iguales(calculada, expr(str(c["respuesta"]))), calculada


COMPROBADORES = {"ecuacion": comprueba_ecuacion, "sistema": comprueba_sistema,
                 "igualdad": comprueba_igualdad, "valor": comprueba_valor,
                 "estadistica": comprueba_estadistica}


def texto_de_respuesta(c):
    """La solución legible de una comprobación, en LaTeX."""
    r = c["respuesta"]
    if c["tipo"] == "ecuacion":
        if isinstance(r, str):
            return r
        var = c.get("var", "x")
        return ", ".join(f"${var} = {latex(nsimplify(expr(s)))}$" for s in r)
    if c["tipo"] == "sistema":
        return r if isinstance(r, str) else ", ".join(f"${k} = {latex(expr(v))}$" for k, v in r.items())
    if c["tipo"] == "igualdad":
        return f"${latex(expr(r))}$"
    if c["tipo"] == "estadistica":
        valor = ", ".join(str(x) for x in r) if isinstance(r, list) else str(r)
        return f"{c['medida']} {valor.replace('.', ',')}"
    # Un valor se escribe como lo da la fuente ("9.5" → 9,5), no como fracción.
    texto = str(r).replace(".", "{,}") if "." in str(r) else latex(expr(r))
    return f"${texto}$" if "tolerancia" not in c else f"≈ ${texto}$"


def normaliza(texto):
    """"$-\\frac{9}{5}$ y 2,5" → "-9/5y2.5": para buscar un número en un texto."""
    t = re.sub(r"\\frac\{([^{}]*)\}\{([^{}]*)\}", r"\1/\2", texto.replace("{,}", ","))
    return re.sub(r"[\s$]", "", t).replace(",", ".")


def formas(v):
    """Cómo puede aparecer un resultado en una solución escrita: 225/4 vale
    como "225/4", "56.25" o "56.3" (redondeado)."""
    salida = {normaliza(str(v))}
    valor = expr(str(v))
    if valor.is_number and not valor.is_integer:
        for d in (1, 2, 3):
            salida.add(f"{float(valor):.{d}f}")
    return salida


def comprueba_archivo(ruta):
    datos = json.loads(ruta.read_text())
    fallos = []
    for e in datos["ejercicios"]:
        checks = e.get("comprobar") or []
        if not checks:
            e["verificacion"] = "sin_verificar"
            continue
        malos = []
        for c in checks:
            try:
                ok, calculada = COMPROBADORES[c["tipo"]](c)
            except Exception as err:  # una expresión que no se entiende también es un fallo
                ok, calculada = False, f"error: {err}"
            if not ok:
                malos.append(f"{c.get('apartado', '')} esperaba {c['respuesta']!r}, sale {calculada}")
        # Una solución escrita a mano (problemas) tiene que decir lo que sale
        # del cálculo: "165 kg" con respuesta 165. Coma o punto decimal, igual.
        if e.get("solucion_generada"):
            del e["solucion"], e["solucion_generada"]  # se vuelve a escribir abajo
        if e.get("solucion") and not malos:
            texto = normaliza(e["solucion"])
            for c in checks:
                valores = c["respuesta"] if isinstance(c["respuesta"], list) else []
                for v in valores:
                    if not any(forma in texto for forma in formas(v)):
                        malos.append(f"la solución escrita no dice {v}")
        if malos:
            fallos.append(f"{ruta.name} {e['id']}: " + "; ".join(malos))
            e["verificacion"] = "discrepancia"
        else:
            e["verificacion"] = "comprobada"
            if not e.get("solucion"):
                partes = [(f"{c['apartado']}) " if c.get("apartado") else "") + texto_de_respuesta(c) for c in checks]
                e["solucion"] = "; ".join(partes)
                e["solucion_generada"] = True
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n")
    return fallos, datos


def main():
    # Carpetas o archivos sueltos (4.º A y 4.º B comparten carpeta: cada uno
    # pasa solo los suyos, `…/4/a-*.json`).
    rutas = sorted({r for a in map(Path, sys.argv[1:]) for r in ([a] if a.is_file() else a.rglob("*.json"))})
    todos = []
    for ruta in rutas:
        fallos, datos = comprueba_archivo(ruta)
        n = len(datos["ejercicios"])
        ok = sum(e["verificacion"] == "comprobada" for e in datos["ejercicios"])
        print(f"{ruta.name:<40} {n:>3} ejercicios, {ok:>3} comprobados, {len(fallos)} con la solución mal")
        todos += fallos
    for f in todos:
        print("  ✗", f)
    sys.exit(1 if todos else 0)


if __name__ == "__main__":
    main()
