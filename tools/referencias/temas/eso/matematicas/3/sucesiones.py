import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
# Aragón (3.º, D.1 y A.4): patrones y regla de formación (término general). Las sumas de
# términos (y las sumas infinitas) de Marea Verde no entran: Aragón no las pone en 3.º.
S = ["D.1", "A.4"]


def sistema(ecs, resp, vars_=("x", "y"), apartado=None):
    c = {"tipo": "sistema", "ecuaciones": ecs, "vars": list(vars_), "respuesta": resp}
    if apartado: c["apartado"] = apartado
    return c


def ecuacion(ec, resp, var="x", apartado=None):
    c = {"tipo": "ecuacion", "ecuacion": ec, "respuesta": resp}
    if var != "x": c["var"] = var
    if apartado: c["apartado"] = apartado
    return c


calculo("término de una sucesión", 1, S, "1) Escribe los diez primeros términos de las sucesiones: a) $-1, -2, -3, -4, \\ldots$   b) $1, 4, 9, 16, \\ldots$   c) $1, 3, 5, 7, \\ldots$   2) Escribe el término que ocupa el lugar 100 de cada una.",
        [("a", "-100", "-100", None), ("b", "100^2", "10000", None), ("c", "2*100-1", "199", None)],
        "Términos: a) $-1, -2, \\ldots, -10$ ($a_n = -n$)   b) $1, 4, 9, \\ldots, 100$ ($b_n = n^{2}$)   c) $1, 3, 5, \\ldots, 19$ ($c_n = 2n-1$). Lugar 100: a) $-100$   b) 10 000   c) 199 (la fuente da 201, que es el término 101: errata)", "mv3", "cap. 3, act. 1 y 2 (en c) la fuente da 201: errata)")
valores("término de una sucesión", 1, S, "Escribe los cuatro primeros términos de las siguientes sucesiones (se dan el cuarto de cada una para comprobar):", [
    ("2*4^2+1", "33"), ("(4*4-1)/(3*4)", "5/4"), ("3*(3*(3*1+5)+5)+5", "92"), ("2*(2*5+2)+5", "29")], "mv3", "cap. 3, act. 4",
    enunciados=["a_n = 2n^{2}+1", "v_n = \\frac{4n-1}{3n}", "c_1 = 1,\\ c_n = 3c_{n-1}+5", "d_1 = 2,\\ d_2 = 5,\\ d_n = 2d_{n-1}+d_{n-2}"])
ej("término general", 2, S, "Escribe la expresión del término general de las siguientes sucesiones: a) $\\{-1, 1, -1, 1, -1, 1, -1, 1, \\ldots\\}$   b) $\\{0, 3, 8, 15, 24, 35, \\ldots\\}$   c) $\\{2, 4, 6, 8, 10, \\ldots\\}$   d) $\\left\\{\\frac{1}{4}, \\frac{3}{5}, \\frac{5}{6}, \\frac{7}{7}, \\frac{9}{8}, \\ldots\\right\\}$",
   solucion="a) $a_n = (-1)^{n}$   b) $b_n = n^{2}-1$   c) $c_n = 2n$   d) $d_n = \\frac{2n-1}{n+3}$", fuente="mv3", ref="cap. 3, act. 5")
ej("progresión aritmética", 1, S, "Señala razonadamente si la siguiente sucesión es una progresión aritmética: $\\{1, 10, 100, 1000, 100\\,000, \\ldots\\}$",
   solucion="No: la diferencia entre términos consecutivos no es constante (9, 90, 900…). Cada término se obtiene multiplicando por 10: es una progresión geométrica, $a_n = 10^{n-1}$", fuente="mv3", ref="cap. 3, act. 8")
ej("progresión aritmética", 2, S, "Dada una progresión aritmética de la que se conocen dos términos, $a_3 = 4$ y $a_{10} = 18$: a) Calcula su diferencia. b) Calcula su término general.",
   comprobar=[sistema(["x+2*y = 4", "x+9*y = 18"], {"x": "0", "y": "2"})], solucion="Con $a_1 = x$ y $d = y$: $x+2y = 4$, $x+9y = 18$. a) $d = 2$ ($a_1 = 0$)   b) $a_n = 2n-2$", fuente="mv3", ref="cap. 3, act. 10")
problema("progresión aritmética", 1, S, "Calcula el primer término de una progresión aritmética con diferencia 2 y $a_{30} = 60$.", "x+29*2 = 60", ["2"], "$a_1 = 2$", "mv3", "cap. 3, act. 11")
problema("progresión aritmética", 2, S, "¿Cuál es el término general de una progresión aritmética con $a_{22} = 45$ y $d = 3$?", "x+21*3 = 45", ["-18"], "$a_1 = -18$: $a_n = -18+(n-1) \\cdot 3 = 3n-21$", "mv3", "cap. 3, act. 12")
problema("progresión aritmética", 2, ["D.1", "D.2"], "Los lados de un pentágono están en progresión aritmética de diferencia 5. Sabiendo además que su perímetro es 65, calcula el valor de los lados.",
         "x+(x+5)+(x+10)+(x+15)+(x+20) = 65", ["3"], "3, 8, 13, 18 y 23", "mv3", "cap. 3, act. 13")
calculo("progresión aritmética", 2, S, "Calcula la expresión general de las progresiones aritméticas: a) De diferencia $d = 2{,}5$ y primer término 2.   b) De diferencia $d = -2$ y primer término 0.   c) De diferencia $d = \\frac{1}{3}$ y segundo término 5.   d) De diferencia $d = 4$ y quinto término 1.",
        [("a", "2+(7-1)*2.5", "2.5*7-0.5", None), ("b", "0+(7-1)*(-2)", "-2*7+2", None), ("c", "5+(7-2)*(1/3)", "7/3+13/3", None), ("d", "1+(7-5)*4", "4*7-19", None)],
        "a) $a_n = 2+(n-1) \\cdot 2{,}5 = 2{,}5n-0{,}5$ (la fuente da $2{,}5n-5$: errata)   b) $a_n = -2n+2$   c) $a_n = \\frac{n}{3}+\\frac{13}{3}$   d) $a_n = 4n-19$ (la comprobación mira el término 7 con las dos formas)", "mv3", "cap. 3, act. 15 (en a) la fuente da 2,5n − 5: errata)")
calculo("contar términos", 2, S, "¿Cuántos múltiplos de 7 están comprendidos entre el 4 y el 893?", [(None, "floor(893/7)-floor(4/7)", "127", None)],
        "Van de $7 = 7 \\cdot 1$ a $889 = 7 \\cdot 127$: son 127. La fuente da 126: errata", "mv3", "cap. 3, act. 16 (la fuente da 126: errata)")
calculo("progresión aritmética", 2, ["D.1", "D.2"], "Un nadador se entrena en una piscina de 50 m y quiere controlar las pérdidas de velocidad por cansancio. Cronometra en cinco días consecutivos los tiempos que tarda en hacer 2, 5, 8, 11 y 14 largos. a) Halla el término general de la sucesión $a_n$ que da los metros recorridos en el día $n$. b) ¿Cuántos metros habrá nadado en dichos cronometrajes?",
        [("a, día 5", "100+(5-1)*150", "14*50", None)], "a) $a_n = 100+(n-1) \\cdot 150$   b) 100, 250, 400, 550 y 700 metros", "mv3", "cap. 3, act. 22")
problema("progresión geométrica", 2, S, "Averigua la razón de una progresión geométrica cuyo primer término es 27 y el cuarto es 8.", "27*x^3 = 8", ["2/3"], "$r = \\frac{2}{3}$", "mv3", "cap. 3, act. 23")
problema("progresión geométrica", 1, S, "El cuarto término de una progresión geométrica es $\\frac{1}{9}$ y la razón $\\frac{1}{3}$. Halla el primer término.", "x*(1/3)^3 = 1/9", ["3"], "$a_1 = 3$", "mv3", "cap. 3, act. 24")
calculo("progresión geométrica", 2, S, "Halla el sexto término de la siguiente progresión geométrica: $\\{\\sqrt{2}, 2, 2\\sqrt{2}, 4, \\ldots\\}$", [(None, "sqrt(2)*sqrt(2)^5", "8", None)], "$r = \\sqrt{2}$, $a_6 = \\sqrt{2} \\cdot (\\sqrt{2})^{5} = 8$", "mv3", "cap. 3, act. 25")
ej("progresión geométrica", 3, S, "Dada una progresión geométrica de la que se conocen dos términos, $a_3 = -8$ y $a_{11} = -2048$: a) Calcula su razón. b) Calcula su término general.",
   comprobar=[ecuacion("x^8 = -2048/(-8)", ["-2", "2"], apartado="a")],
   solucion="a) $r^{8} = 256$, así que $r = 2$ o $r = -2$.   b) Con $r = -2$: $a_n = (-2)^{n}$; con $r = 2$: $a_n = -2^{n}$ (las dos cumplen $a_3 = -8$ y $a_{11} = -2048$; la fuente solo da la primera)", fuente="mv3", ref="cap. 3, act. 26 (la fuente da solo r = −2)")
calculo("progresión geométrica", 2, ["D.1", "D.2"], "Cierta clase de alga, llamada clorella, se reproduce doblando su cantidad cada dos horas y media. Si se tiene en el momento inicial un kilo, al cabo de dos horas y media hay dos kilos. a) Haz una tabla de valores en la que indiques para cada periodo de reproducción el número de kilos de clorella. b) Indica el término general. c) Al cabo de 4 días han transcurrido 40 periodos: ¿consideras posible este crecimiento?",
        [("c", "2^40", "1.0995*10^12", 0.0001 * 10**12)], "a) 1, 2, 4, 8, 16…   b) $a_n = 2^{n-1}$ (kilos en el periodo $n$)   c) No: saldrían del orden de $2^{40} \\approx 1{,}1 \\cdot 10^{12}$ kg de algas", "mv3", "cap. 3, act. 27")
calculo("progresión aritmética", 1, S, "a) Calcula el término que ocupa el lugar 100 de una progresión aritmética cuyo primer término es 4 y la diferencia es 5.   b) El décimo término de una progresión aritmética es 45 y la diferencia es 4. Halla el primer término.   c) El término sexto de una progresión aritmética es 4 y la diferencia $\\frac{1}{2}$. Halla el término 20.",
        [("a", "4+99*5", "499", None), ("b", "45-9*4", "9", None), ("c", "4+14*(1/2)", "11", None)], "a) 499   b) 9   c) 11", "mv3", "cap. 3, ejercicios y problemas (primera numeración) 1 y 2; (segunda numeración) 3")
problema("progresión aritmética", 2, S, "Sabiendo que el primer término de una progresión aritmética es 4, la diferencia 7 y el término $n$-ésimo 88, halla $n$.", "4+(n-1)*7 = 88", ["13"], "$n = 13$", "mv3", "cap. 3, ejercicios y problemas (segunda numeración) 1", var="n")
ej("progresión aritmética", 2, S, "Halla el primer término de una progresión aritmética y la diferencia, sabiendo que $a_3 = 24$ y $a_{10} = 66$.",
   comprobar=[sistema(["x+2*y = 24", "x+9*y = 66"], {"x": "12", "y": "6"})], solucion="$a_1 = 12$; $d = 6$", fuente="mv3", ref="cap. 3, ejercicios y problemas (segunda numeración) 2")
problema("progresión aritmética", 3, ["D.1", "D.2", "C.1"], "Calcula los lados de un triángulo rectángulo sabiendo que sus medidas, expresadas en metros, están en progresión aritmética de diferencia 3.",
         "x^2+(x+3)^2 = (x+6)^2", ["-3", "9"], "9, 12 y 15 m (la solución $x = -3$ no vale para una longitud)", "mv3", "cap. 3, ejercicios y problemas (segunda numeración) 4")
problema("progresión aritmética", 2, ["D.1", "D.2"], "Sabiendo que las medidas de los tres ángulos de un triángulo están en progresión aritmética y que uno de ellos mide 100°, calcula los otros dos.",
         "3*x = 180", ["60"], "El del medio mide 60° (la suma es $3 \\cdot a_2 = 180°$), así que la diferencia es 40°: los otros miden 20° y 60°", "mv3", "cap. 3, ejercicios y problemas 21")
calculo("progresión aritmética", 1, ["D.1", "D.2"], "Por el alquiler de una casa se acuerda pagar 800 euros al mes durante el primer año, y cada año se aumentará el alquiler en 50 euros mensuales. ¿Cuánto se pagará mensualmente al cabo de 12 años?",
        [(None, "800+11*50", "1350", None)], "1350 € (el año 12 es $a_{12} = 800+11 \\cdot 50$)", "mv3", "cap. 3, ejercicios y problemas 26")
problema("progresión aritmética", 2, ["D.1", "D.2"], "Las edades de cuatro hermanos forman una progresión aritmética, y su suma es 32 años. El mayor tiene 6 años más que el menor. Halla las edades de los cuatro hermanos.",
         "x+(x+2)+(x+4)+(x+6) = 32", ["5"], "La diferencia es $6 : 3 = 2$ años: 5, 7, 9 y 11 años", "mv3", "cap. 3, ejercicios y problemas 27")
calculo("progresión aritmética", 1, ["D.1", "D.2"], "Un esquiador comienza la pretemporada de esquí haciendo pesas en un gimnasio durante una hora. Decide incrementar el entrenamiento 10 minutos cada día. ¿Cuánto tiempo deberá entrenar al cabo de 15 días?",
        [(None, "60+14*10", "200", None)], "$a_{15} = 60+14 \\cdot 10 = 200$ minutos", "mv3", "cap. 3, ejercicios y problemas 28 (primera pregunta)")
problema("progresión aritmética", 3, ["D.1", "D.2"], "En una sala de cine, la primera fila de butacas dista de la pantalla 86 dm, y la sexta, 134 dm. ¿En qué fila estará una persona si su distancia a la pantalla es de 230 dm?",
         "86+(n-1)*(134-86)/5 = 230", ["16"], "La diferencia es $48 : 5 = 9{,}6$ dm: fila 16", "mv3", "cap. 3, ejercicios y problemas 29", var="n")
ej("progresión geométrica", 2, S, "El quinto término de una progresión geométrica es 81 y el primero es 1. Halla los cinco primeros términos de dicha progresión.",
   comprobar=[ecuacion("x^4 = 81", ["-3", "3"])], solucion="$r^{4} = 81$, $r = 3$ o $r = -3$: 1, 3, 9, 27 y 81; o bien 1, −3, 9, −27 y 81", fuente="mv3", ref="cap. 3, ejercicios y problemas 31")
problema("progresión geométrica", 2, S, "En una progresión geométrica de primer término 7 y razón 2, un cierto término es 28 672. ¿Qué lugar ocupa dicho término?", "7*2^(n-1) = 28672", ["13"], "$2^{n-1} = 4096 = 2^{12}$: el lugar 13", "mv3", "cap. 3, ejercicios y problemas 32", var="n")
problema("progresión geométrica", 2, S, "En una progresión geométrica se sabe que el término decimoquinto es igual a 512 y que el término décimo es igual a 16. Halla el primer término y la razón.",
         "16*x^5 = 512", ["2"], "$r^{5} = 32$, $r = 2$; $a_1 = \\frac{16}{2^{9}} = \\frac{1}{32}$", "mv3", "cap. 3, ejercicios y problemas 34")
problema("progresión geométrica", 3, ["D.1", "D.2"], "Tres números están en progresión geométrica; el segundo es 32 unidades mayor que el primero, y el tercero, 96 unidades mayor que el segundo. Halla los números.",
         "32*x = 96", ["3"], "Como $a_3-a_2 = r(a_2-a_1)$, la razón es 3; $a_1 \\cdot 3 - a_1 = 32$ da $a_1 = 16$: 16, 48 y 144", "mv3", "cap. 3, ejercicios y problemas 48")
guarda(materia="matematicas", etapa="eso", curso=3, tema="sucesiones", titulo="Sucesiones: patrones, progresiones aritméticas y geométricas",
       saberes=["D.1", "A.4", "D.2", "C.1"], prefijo="m3-suc")
