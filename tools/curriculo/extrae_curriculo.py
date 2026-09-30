#!/usr/bin/env python3
"""EL CURRÍCULO OFICIAL DE ESO DE ARAGÓN, DE LOS PDF A DATOS.

Fuente: anexo II de la ORDEN ECD/1172/2022, de 2 de agosto (currículo y
evaluación de la ESO en Aragón), un PDF por materia, tal como los publica
Educaragón. Jorge los subió el 24/9/2026.

Qué saca de cada materia:
  - competencias específicas: código (CE.M.1) y enunciado;
  - criterios de evaluación: código (1.1), competencia a la que pertenecen,
    columna/curso del anexo ("Matemáticas (1º - 3º ESO)", "1º ESO"...) y texto;
  - saberes básicos por curso: bloque ("A. Sentido numérico"), apartado
    ("A.2. Cantidad") y sus viñetas, LITERALES (solo se quitan los cortes de
    línea y los guiones de partición de palabra).

Cómo: los criterios y los saberes están en TABLAS dentro del PDF. Se leen
con pdfplumber usando la POSICIÓN de cada celda: la columna de saberes es la
que está bajo la cabecera "Conocimientos, destrezas y actitudes"; las
orientaciones para la enseñanza (columna derecha) no se guardan. Las
competencias se leen del texto de la sección I.

No es infalible: el formato cambia un poco de una materia a otra. Por eso
se escribe también un informe con los recuentos de cada materia, para
revisar a ojo las que salgan raras, y tests/curriculo comprueba muestras
literales contra el PDF.

Uso (una vez, en local; el resultado se commitea en
server/lib/curriculo/aragon-<etapa>/):
  python3 tools/curriculo/extrae_curriculo.py <carpeta_de_pdfs> server/lib/curriculo/aragon-eso
  python3 tools/curriculo/extrae_curriculo.py <carpeta> server/lib/curriculo/aragon-primaria primaria
  python3 tools/curriculo/extrae_curriculo.py <carpeta> server/lib/curriculo/aragon-bachillerato bachillerato

PRIMARIA Y BACHILLERATO (30/9/2026): los anexos tienen la MISMA estructura
que los de ESO (I competencias, II criterios en tabla, III saberes por
curso). Lo que cambia es cómo se nombran los cursos: en Primaria, por
CICLOS ("Primer ciclo" = 1.º y 2.º); en Bachillerato, por el nombre de la
materia con I o II ("Matemáticas II" = 2.º). La etapa se pasa como tercer
argumento y solo toca eso: con "eso" (o sin nada) sale exactamente lo de
antes.
Los PDF se nombran "02.26 Matemáticas.pdf" (el número se quita del nombre).
Tarda unos 4 minutos para las 40 materias.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

CODIGO_CE = re.compile(r"CE\.([A-ZÁÉÍÓÚÑ]{1,6})\.(\d+)")
# "III.2.1. Matemáticas 1º de ESO" o "III.3. Concreción de los saberes
# básicos, Biología y Geología, 3º de ESO": un apartado de la sección III que
# nombra un curso (y no es la descripción de los bloques).
SECCION_CURSO = re.compile(r"III\.\d+(?:\.\d+)?\.\s*(.+)")
BLOQUE = re.compile(r"^([A-H])\.\s+([A-ZÁÉÍÓÚÑ¿][^:]{2,140})$")
# "A.2. Cantidad:" y, en Geografía e Historia, "A2. Sociedad del conocimiento."
APARTADO = re.compile(r"^([A-H])\.?(\d{1,2})\.\s*(.*)$")
# El texto de un criterio empieza por mayúscula ("1.1. Interpretar…"): así
# no se toma por criterio una línea de una explicación que empieza por un
# número ("…el criterio\n9.3 atiende a…", Matemáticas de Bachillerato).
CRITERIO = re.compile(r"(?:(?<=\n)|^)(\d{1,2})\.(\d{1,2})\.?\s+(?=[A-ZÁÉÍÓÚÑ¿¡«\"“])")
# Guiones de viñeta: el normal, los tipográficos y los de la fuente Symbol
# (U+F02D, U+F0B7), que algunos anexos usan.
GUIONES = "\\-\u2010-\u2015\u2212\u2500\u2501\u23af\u23bc\u2022\u25aa\u25cf\u25cb\u25a0\u00b7\uf02d\uf0b7\uf0a7"
VINETA = re.compile(f"^[{GUIONES}]\\s*")
# Sub-apartados numerados ("1. Estrategias y técnicas:"), en Tecnología y Lengua.
NUMERADO = re.compile(r"^\d{1,2}\.\s+\S")


def limpia(texto):
    """Une líneas y quita los guiones de partición ("no-\\ntación")."""
    if not texto:
        return ""
    t = texto.replace("­", "")
    t = re.sub(r"(\w)-\n(\w)", lambda m: m.group(1) + m.group(2) if m.group(2).islower() else m.group(0), t)
    t = re.sub(r"\s*\n\s*", " ", t)
    return re.sub(r"\s{2,}", " ", t).strip()


def slug(nombre):
    s = unicodedata.normalize("NFD", nombre)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def sin_glifos(texto):
    """Los "(cid:31)" que deja pdfplumber cuando la viñeta es un glifo sin
    traducción a texto (Lenguas Extranjeras de Primaria) pasan a ser una
    viñeta normal: son las que separan un saber del siguiente. Delante de un
    criterio ("• 1.1.") se quitan donde se leen los criterios."""
    return re.sub(r"\(cid:\d+\)\s*", "\u2022 ", texto)


def texto_de_celda(pagina, bbox):
    x0, top, x1, bottom = bbox
    try:
        # dedupe_chars: algunos anexos (Educación Física) llevan el texto
        # pintado dos veces, un poco desplazado, y sin esto sale mezclado.
        return sin_glifos(pagina.crop((x0 + 0.5, top + 0.5, x1 - 0.5, bottom - 0.5)).dedupe_chars().extract_text() or "")
    except ValueError:
        return ""


# ── competencias ───────────────────────────────────────────────────────────
def competencias(texto_completo):
    """Cada competencia va precedida de "Competencia específica de la materia
    … N:" y seguida de "Descripción". Si una materia no usa ese encabezado,
    se cae al patrón general (código a principio de línea)."""
    salida, vistos = [], set()
    patrones = [
        # El enunciado es una frase: acaba en el primer punto de final de
        # línea (a veces no hay "Descripción" detrás).
        r"Competencia[s]? espec[ií]fica[^\n]*?[:.]\s*\n\s*(CE\.[A-ZÁÉÍÓÚÑ]{1,6}\.\d+)\.?\s+(.+?\.)(?=\s*\n)",
        r"(?m)^\s*(CE\.[A-ZÁÉÍÓÚÑ]{1,6}\.\d+)\.?\s+(.+?\.)(?=\s*\n\s*(?:Descripci|\n))",
    ]
    for patron in patrones:
        for m in re.finditer(patron, texto_completo, re.S):
            codigo = m.group(1)
            texto = limpia(m.group(2))
            if codigo in vistos or len(texto) > 700:
                continue
            vistos.add(codigo)
            salida.append({"codigo": codigo, "texto": texto})
        if salida:
            break
    # Solo las del prefijo de la materia (el texto cita a veces las de otras).
    if salida:
        prefijos = {}
        for c in salida:
            pre = c["codigo"].rsplit(".", 1)[0]
            prefijos[pre] = prefijos.get(pre, 0) + 1
        propio = max(prefijos, key=prefijos.get)
        salida = [c for c in salida if c["codigo"].startswith(propio + ".")]
    return sorted(salida, key=lambda c: int(c["codigo"].rsplit(".", 1)[1]))


# ── recorrido de tablas ────────────────────────────────────────────────────
def filas_con_celdas(pagina):
    """Cada fila de cada tabla como (altura, [(x0, x1, texto)])."""
    for tabla in pagina.find_tables():
        for fila in tabla.rows:
            celdas = []
            for c in fila.cells:
                if c is None:
                    continue
                txt = texto_de_celda(pagina, c)
                if txt.strip():
                    celdas.append((c[0], c[2], txt))
            if celdas:
                yield fila.bbox[1], celdas


def texto_de_pagina(pagina):
    """El texto de la página, soltando después lo que pdfplumber guarda de
    ella: con los PDF de cien páginas la memoria se acababa."""
    texto = pagina.extract_text() or ""
    pagina.flush_cache()
    return texto


def en_orden_de_lectura(pagina):
    """Las líneas de texto y las filas de tabla de la página, de arriba abajo:
    (0, línea) o (1, celdas). Un apartado ("III.2.2. Segundo ciclo…") que
    empieza a media página cambia de curso SOLO lo que queda debajo; antes
    se leían primero todas las líneas y el final del curso anterior, en esa
    misma página, se iba al siguiente."""
    eventos = [(l["top"], 0, sin_glifos(l["text"])) for l in pagina.extract_text_lines()]
    eventos += [(top, 1, celdas) for top, celdas in filas_con_celdas(pagina)]
    eventos.sort(key=lambda e: (e[0], e[1]))
    pagina.flush_cache()
    return [(tipo, x) for _, tipo, x in eventos]


def solapa(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))


def criterios_y_saberes(pdf):
    criterios = []
    saberes = {}  # curso -> lista de filas de texto de saber (en orden)
    bloques = {}  # curso -> lista de (posición, bloque)
    ce_actual = None
    columnas_criterio = []  # [(x0, x1, etiqueta)]
    curso_actual = None
    col_saber = None  # (x0, x1) de "Conocimientos, destrezas y actitudes"
    en_saberes = False
    en_seccion_iii = False
    # En la IV (orientaciones y situaciones de aprendizaje) algunos anexos
    # vuelven a copiar criterios: no son nuevos y salían repetidos
    # (Proyecto de Investigación de Bachillerato, 30/9).
    en_seccion_iv = False
    bloque_pendiente = None  # un título de bloque visto antes de saber el curso
    enunciados = {}  # CE → enunciado leído de la tabla de criterios
    ce_enunciando = None
    crudo = []  # el texto de todas las celdas, para la comprobación literal

    for pagina in pdf.pages:
        # Solo la primera fila de tabla de la página puede ser la
        # continuación de un criterio cortado por el salto de página.
        primera_fila = True
        for tipo, cosa in en_orden_de_lectura(pagina):
            if tipo == 0:
                linea = cosa
                m = SECCION_CURSO.match(linea.strip())
                if m and re.search(MARCA_CURSO[ETAPA], m.group(1).strip(), re.I if ETAPA != "bachillerato" else 0) \
                        and not re.search(r"Descripci", m.group(1)):
                    curso_actual = limpia(m.group(1))
                    saberes.setdefault(curso_actual, [])
                    bloques.setdefault(curso_actual, [])
                    en_saberes = True
                if re.match(r"^\s*III\.\s*Saberes b", linea):
                    en_seccion_iii = True
                if re.match(r"^\s*IV\.\s", linea):
                    en_saberes = False
                    en_seccion_iii = False
                    en_seccion_iv = True
                continue
            celdas = cosa
            es_primera, primera_fila = primera_fila, False
            crudo.extend(t for _, _, t in celdas)
            textos = [limpia(t) for _, _, t in celdas]
            # Competencia de la tabla de criterios ("CE.M.1" sola en su celda);
            # las filas siguientes, hasta el primer punto final, son su
            # enunciado (se usa si no se pudo leer de la sección I).
            es_codigo = False
            for t in textos:
                m = re.fullmatch(r"(CE\.[A-ZÁÉÍÓÚÑ]{1,6}\.\d+)\.?", t)
                if m:
                    ce_actual = m.group(1)
                    ce_enunciando = ce_actual
                    enunciados[ce_actual] = ""
                    es_codigo = True
            if not es_codigo and ce_enunciando and len(textos) == 1 and not re.match(r"\d+\.\d+", textos[0]):
                enunciados[ce_enunciando] = (enunciados[ce_enunciando] + " " + textos[0]).strip()
                if enunciados[ce_enunciando].endswith("."):
                    ce_enunciando = None
            elif not es_codigo:
                ce_enunciando = None
            # Cabecera de columnas de criterios: celdas cortas con "ESO" o "º".
            if len(celdas) >= 1 and all(len(t) < 60 and re.search(MARCA_COLUMNA[ETAPA], t.strip(), re.I if ETAPA != "bachillerato" else 0) for t in textos) \
                    and not any(re.match(r"\d+\.\d+", t) for t in textos):
                columnas_criterio = [(x0, x1, limpia(t)) for x0, x1, t in celdas]
                continue
            # Cabecera de saberes. Las materias de un solo curso no tienen
            # apartado por curso: sus saberes van a "curso único".
            for x0, x1, t in celdas:
                # La cabecera es la frase SOLA: algunos saberes empiezan por
                # "Conocimientos, destrezas y actitudes que permitan…".
                # En Primaria le sigue "(introducir cambios o extensiones de
                # forma justificada)", como a las columnas de criterios.
                if re.fullmatch(r"Conocimientos,? destrezas( y( actitudes)?)?\.?(\s*\([^)]*\))*", limpia(t), re.I):
                    # Si la celda de cabecera ocupa casi todo el ancho (la
                    # tabla la fusiona con "Orientaciones"), la columna de
                    # saberes es el 40 % izquierdo, que es lo que ocupa en
                    # todos los anexos.
                    col_saber = (x0, x1) if (x1 - x0) < pagina.width * 0.6 else (x0, x0 + pagina.width * 0.4)
                    if curso_actual is None and en_seccion_iii:
                        curso_actual = "Curso único"
                        saberes.setdefault(curso_actual, [])
                        bloques.setdefault(curso_actual, [])
                        if bloque_pendiente:
                            bloques[curso_actual].append((0, bloque_pendiente))
                        en_saberes = True
            # De la IV en adelante no se coge nada más.
            if en_seccion_iv:
                continue
            # Criterios.
            if not en_saberes:
                for x0, x1, t in celdas:
                    t = re.sub(f"(?m)^[{GUIONES}]\\s*", "", t)
                    etiqueta = None
                    mejor = 0
                    for c0, c1, e in columnas_criterio:
                        s = solapa(x0, x1, c0, c1)
                        if s > mejor:
                            mejor, etiqueta = s, e
                    primero = CRITERIO.search(t)
                    inicio = primero.start() if primero else len(t)
                    # Un criterio partido por un salto de página: la celda de
                    # la página siguiente empieza por el final del criterio
                    # anterior DE ESA COLUMNA (y puede traer los siguientes).
                    # Solo en celdas estrechas (una columna) y con la misma
                    # competencia: las anchas son enunciados u orientaciones.
                    if inicio and es_primera and etiqueta and (x1 - x0) < pagina.width * 0.5:
                        previo = next((c for c in reversed(criterios)
                                       if c["columna"] == etiqueta and c["competencia"] == ce_actual), None)
                        if previo:
                            # Los trozos, para que la comprobación literal
                            # busque cada uno en su celda (juntos no están).
                            previo.setdefault("trozos", [previo["texto"]]).append(limpia(t[:inicio]))
                            previo["texto"] = limpia(previo["texto"] + " " + t[:inicio])
                    if not primero:
                        continue
                    partes = CRITERIO.split(t[inicio:])
                    # split: ['', n, m, texto, n, m, texto...]
                    for i in range(1, len(partes) - 2, 3):
                        criterios.append({
                            "codigo": f"{partes[i]}.{partes[i + 1]}",
                            "competencia": ce_actual,
                            "columna": etiqueta,
                            "texto": limpia(partes[i + 2]),
                        })
                continue
            # Título de bloque ("A. Sentido numérico"): celda ancha, a veces
            # antes de que aparezca la cabecera de columnas.
            for x0, x1, t in celdas:
                lt = limpia(t)
                if BLOQUE.match(lt) and (x1 - x0) > pagina.width * 0.5:
                    if curso_actual:
                        bloques[curso_actual].append((len(saberes[curso_actual]), lt))
                    elif en_seccion_iii:
                        bloque_pendiente = lt
            # Saberes: la celda bajo la columna de "Conocimientos…", no las anchas.
            if curso_actual and col_saber:
                ancho = col_saber[1] - col_saber[0]
                for x0, x1, t in celdas:
                    lt = limpia(t)
                    if BLOQUE.match(lt) and (x1 - x0) > pagina.width * 0.5:
                        continue
                    # Dentro de la columna de saberes: si la celda se sale por la
                    # derecha, es de las orientaciones (o ancha) y no se coge.
                    if solapa(x0, x1, *col_saber) > 0.6 * (x1 - x0) and x1 <= col_saber[1] + 12:
                        if re.fullmatch(r"(Conocimientos,? destrezas( y( actitudes)?)?\.?|actitudes\.?)(\s*\([^)]*\))*", lt, re.I):
                            continue
                        saberes[curso_actual].append(t)
    # El mismo criterio dos veces (la tabla repetida en el anexo, o una
    # celda que pdfplumber lee en dos tablas y una la corta): se queda el
    # completo. Dos criterios con el mismo número y textos distintos (una
    # errata del BOA, Psicología 4.2) se quedan los dos.
    def mismo(a, b):
        return (a["competencia"], a["codigo"], a["columna"]) == (b["competencia"], b["codigo"], b["columna"])
    unicos = []
    for c in criterios:
        if any(mismo(c, o) and o["texto"].startswith(c["texto"]) for o in criterios if o is not c and len(o["texto"]) > len(c["texto"])):
            continue
        if any(mismo(c, u) and u["texto"] == c["texto"] for u in unicos):
            continue
        unicos.append(c)
    return unicos, saberes, bloques, enunciados, crudo


def estructura_saberes(filas, bloques):
    """De las celdas de saber (en orden) a bloques → apartados → viñetas."""
    salida = []
    bloque = None
    apartado = None
    marcas = dict(bloques)

    def nuevo_bloque(titulo):
        nonlocal bloque, apartado
        bloque = {"bloque": titulo, "apartados": []}
        apartado = None
        salida.append(bloque)

    for i, celda in enumerate(filas):
        if i in marcas:
            nuevo_bloque(marcas[i])
        # Viñetas: cada línea que empieza por guion abre una nueva.
        texto = celda.replace("­", "")
        lineas = texto.split("\n")
        actual = []
        items = []
        for ln in lineas:
            s = ln.strip()
            if not s:
                continue
            if APARTADO.match(VINETA.sub("", s)) or VINETA.match(s) or NUMERADO.match(s):
                if actual:
                    items.append("\n".join(actual))
                actual = [s]
            else:
                actual.append(s)
        if actual:
            items.append("\n".join(actual))
        for it in items:
            plano = limpia(it)
            # "− A.1. Arquitectura…" (Digitalización): guion y código.
            m = APARTADO.match(VINETA.sub("", plano))
            if m:
                if bloque is None or not bloque["bloque"].startswith(m.group(1)):
                    nuevo_bloque(m.group(1) + ".")
                resto = m.group(3)
                nombre, sep, tras = resto.partition(":")
                if not sep or len(nombre) > 120:
                    # Sin dos puntos: el nombre es la primera frase.
                    nombre, sep, tras = resto.partition(". ")
                apartado = {"codigo": f"{m.group(1)}.{m.group(2)}", "nombre": limpia(nombre), "saberes": []}
                bloque["apartados"].append(apartado)
                tras = tras.strip()
                if tras:
                    for v in re.split(f"\\s[{GUIONES}]\\s?(?=[A-ZÁÉÍÓÚÑ¿])", " " + tras):
                        v = VINETA.sub("", v.strip())
                        if v:
                            apartado["saberes"].append(v)
                continue
            v = VINETA.sub("", plano)
            if not v:
                continue
            if apartado is None:
                if bloque is None:
                    nuevo_bloque("")
                apartado = {"codigo": "", "nombre": "", "saberes": []}
                bloque["apartados"].append(apartado)
            if VINETA.match(plano) or NUMERADO.match(plano) or not apartado["saberes"]:
                apartado["saberes"].append(v)
            else:
                # Continuación de la viñeta anterior (cortada entre celdas o páginas).
                apartado["saberes"][-1] = limpia(apartado["saberes"][-1] + " " + v)
    return salida


def materia(ruta):
    with pdfplumber.open(ruta) as pdf:
        completo = sin_glifos("\n".join(texto_de_pagina(p) for p in pdf.pages))
        comps = competencias(completo)
        crits, filas, bloques, enunciados, crudo = criterios_y_saberes(pdf)
    # Las competencias que la sección I no dejó leer, de la tabla de criterios.
    vistos = {c["codigo"] for c in comps}
    prefijo = comps[0]["codigo"].rsplit(".", 1)[0] if comps else None
    for codigo, texto in enunciados.items():
        if codigo not in vistos and texto and (prefijo is None or codigo.startswith(prefijo + ".")):
            comps.append({"codigo": codigo, "texto": limpia(texto), "de": "tabla de criterios"})
    # CADA CRITERIO, CON SU COMPETENCIA: el criterio "2.1" es de la
    # competencia 2 (así numera el anexo). Si la tabla no dejó leer el
    # código de la competencia, o usa otro prefijo que la sección I (en
    # Laboratorio, "CE.LAB" frente a "CE.LRCV"), se asigna por el número.
    prefijo = prefijo or (crits[0]["competencia"].rsplit(".", 1)[0] if crits and crits[0]["competencia"] else None)
    if prefijo:
        for c in crits:
            n = c["codigo"].split(".")[0]
            propio = f"{prefijo}.{n}"
            if c["competencia"] != propio:
                if c["competencia"]:
                    c["competencia_en_tabla"] = c["competencia"]
                c["competencia"] = propio
        # Competencias con criterios pero sin enunciado leído: se dejan,
        # sin texto, para que sus criterios no queden sueltos.
        codigos = {c["codigo"] for c in comps}
        for c in crits:
            if c["competencia"] not in codigos:
                comps.append({"codigo": c["competencia"], "texto": "", "sin_enunciado": True})
                codigos.add(c["competencia"])
    comps.sort(key=lambda c: int(c["codigo"].rsplit(".", 1)[1]))
    for c in crits:
        c["cursos"] = cursos_de(c["columna"] or "")
    # "1Dibujo Técnico I": el número de la celda de al lado pegado.
    saberes = [
        {"etiqueta": re.sub(r"^\d\s*(?=[A-ZÁÉÍÓÚ])", "", curso), "cursos": cursos_de(curso), "bloques": estructura_saberes(filas[curso], bloques.get(curso, []))}
        for curso in filas if filas[curso]
    ]
    calidad = literalidad(comps, crits, saberes, completo, crudo)
    for c in crits:
        c.pop("trozos", None)
    return {
        "fuente": FUENTES[ETAPA],
        "archivo": Path(ruta).name,
        "competencias": comps,
        "criterios": crits,
        "saberes": saberes,
        "calidad": calidad,
    }


def normal(t):
    """Para comparar sin que cuenten saltos de línea, espacios ni guiones."""
    t = t.replace("\u00ad", "")
    t = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", t)
    t = re.sub(f"[\\s{GUIONES}]+", "", t)
    return t.lower()


def literalidad(comps, crits, saberes, completo, crudo):
    """¿Está cada texto extraído, tal cual, en el PDF? Se busca en el texto
    de la página y en el de cada celda (en las tablas, el texto de página
    mezcla las columnas línea a línea). Devuelve el % y los que no aparecen,
    para revisarlos a mano."""
    fuente = normal(completo) + "|" + "|".join(normal(c) for c in crudo)
    textos = [("competencia", c["codigo"], c["texto"]) for c in comps]
    textos += [("criterio", c["codigo"], trozo) for c in crits for trozo in c.get("trozos", [c["texto"]])]
    for s in saberes:
        for b in s["bloques"]:
            for a in b["apartados"]:
                textos += [("saber", a["codigo"], v) for v in a["saberes"]]
    fallos = [t for t in textos if normal(t[2]) not in fuente]
    total = len(textos) or 1
    return {
        "literal": round(100 * (total - len(fallos)) / total, 1),
        "no_encontrados": [f"{t[0]} {t[1]}: {t[2][:120]}" for t in fallos],
    }


# La etapa que se está extrayendo (tercer argumento; ver el docstring).
ETAPA = "eso"
FUENTES = {
    "eso": "ORDEN ECD/1172/2022, anexo II (Aragón)",
    "primaria": "ORDEN ECD/1112/2022, anexo II, con las modificaciones de la ORDEN ECD/866/2024 (Aragón)",
    "bachillerato": "ORDEN ECD/1173/2022, anexo II, con las modificaciones de las ÓRDENES ECD/886/2024 y ECD/739/2025 (Aragón)",
}
# Cómo se reconoce que una cabecera o un apartado nombra un curso.
MARCA_CURSO = {
    "eso": r"ESO|curso|º|Secundari|Primer|Segundo|Tercer|Cuarto",
    "primaria": r"ciclo|Primaria|curso|º",
    "bachillerato": r"Bachillerato|curso|º|\bI{1,2}$",
}
MARCA_COLUMNA = {
    "eso": r"ESO|º|curso",
    "primaria": r"ciclo|º|curso",
    "bachillerato": r"Bachillerato|º|curso|\bI{1,2}$",
}
CICLOS = {"primer": [1, 2], "segundo": [3, 4], "tercer": [5, 6], "tercero": [5, 6]}


ORDINALES = {"primer": 1, "primero": 1, "segundo": 2, "tercer": 3, "tercero": 3, "cuarto": 4}


def cursos_de(etiqueta):
    """"Matemáticas (1º - 3º ESO)" → [1, 2, 3]; "Curso segundo de…" → [2];
    "Curso único" o una etiqueta sin curso → [] (vale para el que se imparta)."""
    if ETAPA == "primaria":
        ciclos = re.findall(r"\b(primer|segundo|tercer|tercero)\s+ciclo", etiqueta.lower())
        if ciclos:
            return sorted({c for w in ciclos for c in CICLOS[w]})
    if ETAPA == "bachillerato":
        if re.search(r"\bII\s*$", etiqueta.strip()):
            return [2]
        if re.search(r"\bI\s*$", etiqueta.strip()):
            return [1]
    e = etiqueta.lower()
    numeros = [int(n) for n in re.findall(r"(\d)\s*\.?\s*[º°]", e)]
    if not numeros:
        numeros = [ORDINALES[w] for w in re.findall(r"\b(primero|primer|segundo|tercero|tercer|cuarto)\b", e)]
    if len(numeros) == 2 and re.search(r"\d\s*\.?\s*[º°]\s*[-–a]\s*\d", e):
        return list(range(numeros[0], numeros[1] + 1))
    return sorted(set(numeros))


# ERRATAS DEL BOA QUE CAMBIAN A QUÉ CURSOS VA UNA MATERIA. Se corrigen aquí,
# a la vista, en vez de esconder un caso especial en el extractor.
#   - Educación en Valores Cívicos y Éticos (Primaria): el anexo dice que
#     "está diseñada para cursarse en el tercer ciclo", pero su único apartado
#     de saberes se titula "III.2.1. Primer ciclo de Educación Primaria".
#     El anexo III le da 45 minutos en 5.º y en 6.º.
CURSOS_CORREGIDOS = {
    ("primaria", "Educación en Valores Cívicos y Éticos"): ([5, 6], "Tercer ciclo de Educación Primaria"),
}


# Criterios con el número mal impreso en el BOA. (etapa, materia, comienzo
# del texto) → (competencia, código).
#   - Ciencias Sociales (Primaria), tercer ciclo: bajo CE.CS.2, tras el 2.3,
#     el BOA imprime "6.4. Identificar problemas ligados al desarrollo
#     sostenible…"; es el 2.4 (el 6.4 del ciclo es "Presentar los
#     resultados…", como en los otros dos).
CRITERIOS_CORREGIDOS = {
    ("primaria", "Ciencias Sociales", "Identificar problemas ligados al desarrollo sostenible"): ("CE.CS.2", "2.4"),
}


def corrige_criterios(datos, etapa):
    for c in datos["criterios"]:
        for (e, materia, comienzo), (competencia, codigo) in CRITERIOS_CORREGIDOS.items():
            if e == etapa and materia == datos["materia"] and c["texto"].startswith(comienzo):
                c["competencia"], c["codigo"] = competencia, codigo


def corrige_cursos(datos, correccion):
    if not correccion:
        return
    cursos, etiqueta = correccion
    for s in datos["saberes"]:
        s["cursos"] = cursos
        s["etiqueta"] = etiqueta
    for c in datos["criterios"]:
        c["cursos"] = cursos


def main():
    global ETAPA
    entrada, salida = Path(sys.argv[1]), Path(sys.argv[2])
    ETAPA = sys.argv[3] if len(sys.argv) > 3 else "eso"
    salida.mkdir(parents=True, exist_ok=True)
    informe = []
    for ruta in sorted(entrada.glob("*.pdf")):
        datos = materia(ruta)
        datos["materia"] = nombre_de_archivo(ruta.name)
        corrige_cursos(datos, CURSOS_CORREGIDOS.get((ETAPA, datos["materia"])))
        corrige_criterios(datos, ETAPA)
        nombre = slug(datos["materia"])
        (salida / f"{nombre}.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1))
        n_sab = {s["etiqueta"]: sum(len(a["saberes"]) for b in s["bloques"] for a in b["apartados"]) for s in datos["saberes"]}
        informe.append({
            "materia": datos["materia"], "archivo": nombre,
            "competencias": len(datos["competencias"]), "criterios": len(datos["criterios"]),
            "criterios_sin_competencia": sum(1 for c in datos["criterios"] if not c["competencia"]),
            "saberes_por_curso": n_sab,
        })
        informe[-1]["literal"] = datos["calidad"]["literal"]
        print(f"{datos['materia']:<48} CE={len(datos['competencias']):>2} crit={len(datos['criterios']):>3} "
              f"literal={datos['calidad']['literal']:>5}% saberes={sum(n_sab.values())}")
    (salida / "_calidad.json").write_text(json.dumps(informe, ensure_ascii=False, indent=1))
    # El índice ligero que carga el servidor (server/lib/curriculo/).
    indice = []
    for fila in informe:
        d = json.loads((salida / f"{fila['archivo']}.json").read_text())
        cursos = sorted({c for s in d["saberes"] for c in s["cursos"]} | {c for k in d["criterios"] for c in k["cursos"]})
        fp = "grado básico" in json.dumps(d["saberes"], ensure_ascii=False) or d["materia"].startswith(("Ámbito de Ciencias", "Ámbito de Comunicación"))
        etapa = {"eso": "FP Básica" if fp else "ESO", "primaria": "Primaria", "bachillerato": "Bachillerato"}[ETAPA]
        indice.append({"slug": fila["archivo"], "materia": d["materia"], "cursos": cursos,
                       "etapa": etapa, "literal": d["calidad"]["literal"]})
    (salida / "_indice.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1))


def nombre_de_archivo(archivo):
    """'087ffbae-02.26_Matema_ticas.pdf' → 'Matemáticas'."""
    s = re.sub(r"^[0-9a-f]{8}-", "", archivo)
    s = re.sub(r"\.pdf$", "", s)
    s = re.sub(r"^(\d+\.\d+[a-z]?|\d+-)[_\s]?", "", s)
    # "07 Lengua Castellana…" (los cortes del BOA) y "3- [02.02] Ciencias
    # Sociales" (los anexos modificados de Educaragón).
    s = re.sub(r"^\d{1,2}\s+", "", s)
    s = re.sub(r"^\s*\[\d+\.\d+\]\s*", "", s)
    s = s.replace("_", " ")
    # Los nombres llegan con la tilde separada ("Matema ticas"): se recompone.
    s = unicodedata.normalize("NFC", s)
    return re.sub(r"\s+", " ", s).strip()


if __name__ == "__main__":
    main()
