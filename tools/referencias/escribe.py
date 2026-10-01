"""AYUDAS PARA ESCRIBIR LOS EJERCICIOS DE REFERENCIA de un tema.

Cada tema es un script en tools/referencias/temas/{etapa}/{materia}/{curso}/
que llama a estas funciones y termina con `guarda(...)`. El producto es el
JSON de server/lib/ejerciciosReferencia/datos/; el script existe para poder
corregir una errata y regenerarlo. Después, SIEMPRE:

    python3 tools/referencias/comprueba.py server/lib/ejerciciosReferencia/datos

Las reglas (qué fuentes, qué se comprueba, qué no se inventa) están en
tools/referencias/README.md.
"""
import json, re
from pathlib import Path
from sympy import symbols, solve, Eq, simplify, nsimplify, latex, Rational
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application

T = standard_transformations + (implicit_multiplication_application,)
L = {c: symbols(c) for c in "abcmnptxyz"}
def P(s): return parse_expr(s.replace("^", "**"), local_dict=dict(L), transformations=T)

def tex(s):
    """Expresión tal como se escribe → LaTeX, sin reordenar (sympy reordena)."""
    s = s.replace("**", "^")
    s = re.sub(r"Rational\((-?\d+),\s*(\d+)\)", r"(\1)/\2", s)
    while "/" in s:
        i = s.index("/")
        m = re.match(r"\((?:[^()]|\([^()]*\))*\)|[\w.]+", s[i + 1:])
        den = m.group(0)
        j = i - 1
        if s[j] == ")":
            nivel = 0
            while True:
                nivel += s[j] == ")"; nivel -= s[j] == "("
                if nivel == 0: break
                j -= 1
            num = s[j + 1:i - 1]
        else:
            while j > 0 and re.match(r"[\w*.^]", s[j - 1]): j -= 1
            num = s[j:i]
        d = den[1:-1] if den.startswith("(") and den.endswith(")") else den
        s = s[:j] + "\\frac{" + num + "}{" + d + "}" + s[i + 1 + len(den):]
    s = re.sub(r"sqrt\(([^()]*)\)", r"\\sqrt{\1}", s)
    s = re.sub(r"\^(\d+|\([^()]*\))", lambda m: "^{" + m.group(1).strip("()") + "}", s)
    s = s.replace("*", " \\cdot ").replace("-", " - ").replace("+", " + ").replace("=", " = ").replace(".", "{,}")
    s = re.sub(r"(\d) \\cdot ([a-z(])", r"\1\2", s)
    s = s.replace("} \\cdot (", "}(")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^- ", "-", s)
    for a in ("( - ", "{ - ", "= - ", "[ - "): s = s.replace(a, a.replace(" - ", "-"))
    return s

def sol_ec(ec, var="x"):
    izq, der = ec.split("=")
    d = simplify(P(izq) - P(der))
    if d == 0: return "identidad"
    r = [v for v in solve(Eq(P(izq), P(der)), L[var]) if v.is_real]
    return [str(nsimplify(v)) for v in sorted(r, key=float)] if r else "sin solución"

EJ = []
FUENTES = {}
def fuente(clave, nombre, url, licencia): FUENTES[clave] = {"nombre": nombre, "url": url, "licencia": licencia}

def ej(tipo, dif, saberes, enunciado, comprobar=None, solucion=None, fuente=None, ref=None):
    e = {"id": None, "tipo": tipo, "dificultad": dif, "saberes": saberes, "enunciado": enunciado}
    if solucion: e["solucion"] = solucion
    if comprobar: e["comprobar"] = comprobar
    e["fuente"] = fuente; e["ref"] = ref
    EJ.append(e); return e

def ecuaciones(tipo, dif, saberes, consigna, lista, fuente, ref, var="x", respuestas=None):
    """lista de ecuaciones en notación de ordenador; respuesta de la fuente si la da (si no, la calcula el código)."""
    comps, partes = [], []
    for i, ec in enumerate(lista):
        letra = "abcdefghijklmnopqrstuvwxyz"[i]
        r = respuestas[i] if respuestas and respuestas[i] is not None else sol_ec(ec, var)
        if isinstance(r, str) and r not in ("identidad", "sin solución"): r = [r]
        c = {"tipo": "ecuacion", "apartado": letra, "ecuacion": ec, "enunciado": tex(ec), "respuesta": r}
        if var != "x": c["var"] = var
        comps.append(c); partes.append(f"{letra}) ${tex(ec)}$")
    return ej(tipo, dif, saberes, consigna + "\n\n" + "   ".join(partes), comps, None, fuente, ref)

def problema(tipo, dif, saberes, texto, planteo, respuesta, solucion, fuente, ref, var="x"):
    c = {"tipo": "ecuacion", "ecuacion": planteo, "respuesta": respuesta}
    if var != "x": c["var"] = var
    return ej(tipo, dif, saberes, texto, [c], solucion, fuente, ref)

RAIZ = Path(__file__).resolve().parents[2]


def guarda(*, materia, etapa, curso, tema, titulo, saberes, prefijo, opcion=None):
    for i, e in enumerate(EJ, 1): e["id"] = f"{prefijo}-{i:03d}"
    usadas = {e["fuente"] for e in EJ}
    datos = {"materia": materia, "etapa": etapa, "curso": curso, **({"opcion": opcion} if opcion else {}), "tema": tema, "titulo": titulo, "saberes": saberes,
             "fuentes": {k: v for k, v in FUENTES.items() if k in usadas}, "ejercicios": EJ}
    ruta = RAIZ / "server/lib/ejerciciosReferencia/datos" / etapa / materia / str(curso) / f"{tema}.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n")
    print(ruta.relative_to(RAIZ), len(EJ))


def sol_sis(ecs, vars_):
    from sympy import solve as _s
    eqs = [Eq(P(a), P(b)) for a, b in (e.split("=") for e in ecs)]
    r = _s(eqs, [L[v] for v in vars_], dict=True)
    if not r: return "sin solución"
    if len(r[0]) < len(vars_): return "infinitas"
    return {v: str(r[0][L[v]]) for v in vars_}

def tex_sis(ecs):
    return "\\begin{cases} " + " \\\\ ".join(tex(e) for e in ecs) + " \\end{cases}"

def sistemas(tipo, dif, saberes, consigna, lista, fuente, ref, vars_=("x", "y"), respuestas=None):
    comps, partes = [], []
    for i, ecs in enumerate(lista):
        letra = "abcdefghijklmnopqrstuvwxyz"[i]
        r = respuestas[i] if respuestas and respuestas[i] is not None else sol_sis(ecs, vars_)
        comps.append({"tipo": "sistema", "apartado": letra, "ecuaciones": ecs, "vars": list(vars_), "enunciado": tex_sis(ecs), "respuesta": r})
        partes.append(f"{letra}) ${tex_sis(ecs)}$")
    return ej(tipo, dif, saberes, consigna + "\n\n" + "   ".join(partes), comps, None, fuente, ref)

def expresiones(tipo, dif, saberes, consigna, lista, fuente, ref):
    """lista de (expresión, resultado simplificado). Comprueba que son la misma expresión."""
    comps, partes = [], []
    for i, (e, r) in enumerate(lista):
        letra = "abcdefghijklmnopqrstuvwxyz"[i]
        comps.append({"tipo": "igualdad", "apartado": letra, "expresion": e, "enunciado": tex(e), "respuesta": r})
        partes.append(f"{letra}) ${tex(e)}$")
    return ej(tipo, dif, saberes, consigna + "\n\n" + "   ".join(partes), comps, None, fuente, ref)

def valores(tipo, dif, saberes, consigna, lista, fuente, ref, enunciados=None):
    """lista de (expresión a evaluar, resultado) — cálculo numérico exacto."""
    comps, partes = [], []
    for i, (e, r) in enumerate(lista):
        letra = "abcdefghijklmnopqrstuvwxyz"[i]
        en = enunciados[i] if enunciados else tex(e)
        comps.append({"tipo": "valor", "apartado": letra, "expresion": e, "enunciado": en, "respuesta": r})
        partes.append(f"{letra}) ${en}$")
    return ej(tipo, dif, saberes, consigna + "\n\n" + "   ".join(partes), comps, None, fuente, ref)

def reinicia():
    EJ.clear()

def calculo(tipo, dif, saberes, texto, cuentas, solucion, fuente, ref):
    """Problema cuya solución es un cálculo: cuentas = [(apartado, expresión, respuesta, tolerancia o None)]."""
    comps = []
    for ap, e, r, tol in cuentas:
        c = {"tipo": "valor", "expresion": e, "respuesta": r}
        if ap: c["apartado"] = ap
        if tol: c["tolerancia"] = tol
        comps.append(c)
    return ej(tipo, dif, saberes, texto, comps, solucion, fuente, ref)

def medidas(tipo, dif, saberes, texto, datos, pedidas, solucion, fuente, ref):
    """pedidas: [(medida, respuesta)] sobre los mismos datos."""
    comps = [{"tipo": "estadistica", "apartado": m, "datos": datos, "medida": m, "respuesta": r} for m, r in pedidas]
    return ej(tipo, dif, saberes, texto, comps, solucion, fuente, ref)
