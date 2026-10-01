import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]
valores("operaciones con enteros", 1, S, "Calcula:", [
    ("3-(4*3-2*5)^2-(3-5)^3", "7"), ("5-3^2-2*(-5)-(7-9)^2", "2"),
    ("7-2*(3-5)^2+2*(-3)+8-(-2)^2", "-3"), ("2-(2*3-3*4)^2-(2-4)^3", "-26")], "mv3", "cap. 1, act. 3",
    enunciados=["3-(4 \\cdot 3-2 \\cdot 5)^{2}-(3-5)^{3}", "5-3^{2}-2 \\cdot (-5)-(7-9)^{2}",
                "7-2 \\cdot (3-5)^{2}+2 \\cdot (-3)+8-(-2)^{2}", "2-(2 \\cdot 3-3 \\cdot 4)^{2}-(2-4)^{3}"])
valores("operaciones con enteros", 2, S, "Resuelve paso a paso:", [
    ("(-5+4*(-2)+7)/(7-(3-4)*(-1))", "-1"), ("(-8-7*(-4+6)/(2+(-3))+5-4*2^2)*(-2)", "10")], "mv3", "cap. 1, ejercicios y problemas 1; autoevaluación 1",
    enunciados=["(-5+4 \\cdot (-2)+7) : (7-(3-4) \\cdot (-1))", "\\left(-8-7 \\cdot (-4+6) : (2+(-3))+5-4 \\cdot 2^{2}\\right) \\cdot (-2)"])
valores("forma mixta", 1, ["A.2", "A.4"], "Pasa a forma mixta las fracciones:", [
    ("50/7", "7+1/7"), ("25/11", "2+3/11"), ("101/6", "16+5/6"), ("-30/7", "-4-2/7"), ("-50/13", "-3-11/13")], "mv3", "cap. 1, act. 4 y 5",
    enunciados=["\\frac{50}{7}", "\\frac{25}{11}", "\\frac{101}{6}", "\\frac{-30}{7}", "\\frac{-50}{13}"])
ej("ordenar fracciones", 1, ["A.2", "A.4"], "Ordena de menor a mayor: $\\frac{8}{9};\\ \\frac{-8}{9};\\ \\frac{4}{5};\\ \\frac{38}{45};\\ \\frac{77}{90};\\ \\frac{-9}{8}$",
   solucion="$-\\frac{9}{8} < -\\frac{8}{9} < \\frac{4}{5} < \\frac{38}{45} < \\frac{77}{90} < \\frac{8}{9}$ (con denominador común 360: $-405 < -320 < 288 < 304 < 308 < 320$)", fuente="mv3", ref="cap. 1, ejercicios y problemas 2")
ej("decimal exacto o periódico", 2, ["A.2", "A.4"], "Sin hacer la división, indica si las siguientes fracciones tienen expresión decimal exacta o periódica: a) $\\frac{21}{750}$   b) $\\frac{75}{21}$   c) $\\frac{11}{99}$   d) $\\frac{35}{56}$",
   solucion="Se simplifica y se mira el denominador: a) $\\frac{7}{250}$, $250 = 2 \\cdot 5^{3}$: exacta.   b) $\\frac{25}{7}$: periódica.   c) $\\frac{1}{9}$: periódica.   d) $\\frac{5}{8}$, $8 = 2^{3}$: exacta", fuente="mv3", ref="cap. 1, act. 14")
# Fracción generatriz: la comprobación suma el decimal como serie geométrica (parte que no se repite + periodo/(1-10^-k)),
# que es otro camino distinto de la regla que da la respuesta.
valores("fracción generatriz", 1, ["A.2", "A.4"], "Pasa a fracción y simplifica:", [
    ("0.125", "1/8"), ("6.66", "333/50"), ("1.4142", "7071/5000")], "mv3", "cap. 1, act. 15 (la fuente da 7071/9999 en a), que es la de 1,41424142…: errata)",
    enunciados=["0{,}125", "6{,}66", "1{,}4142"])
valores("fracción generatriz", 2, ["A.2", "A.4"], "Pasa a fracción y simplifica:", [
    ("1+0.4142/(1-10^(-4))", "14141/9999"), ("0.125/(1-10^(-3))", "125/999"), ("6+0.6/(1-10^(-1))", "20/3"),
    ("1.0+0.04142/(1-10^(-4))", "52066/49995"), ("0.7+0.0125/(1-10^(-3))", "3559/4995"), ("6.7+0.06/(1-10^(-1))", "203/30")], "mv3", "cap. 1, act. 16 y 17",
    enunciados=["1{,}41424142\\ldots", "0{,}125125\\ldots", "6{,}666\\ldots", "1{,}041424142\\ldots", "0{,}7125125\\ldots", "6{,}7666\\ldots"])
valores("fracción generatriz", 2, ["A.2", "A.4"], "Halla la fracción generatriz de los siguientes números decimales. Comprueba el resultado haciendo la división a mano:", [
    ("0.6/(1-10^(-1))", "2/3"), ("0.2+0.03/(1-10^(-1))", "7/30"), ("0.12+0.0035/(1-10^(-2))", "1223/9900"),
    ("0.126/(1-10^(-3))", "14/111"), ("0.34+0.005/(1-10^(-1))", "311/900"), ("1.1+0.08/(1-10^(-1))", "107/90"), ("25.372", "6343/250")], "ag3", "fracciones, ficha 10, ej. 1 (2, 3, 6, 8, 9, 10 y 12)",
    enunciados=["0{,}\\overline{6}", "0{,}2\\overline{3}", "0{,}12\\overline{35}", "0{,}\\overline{126}", "0{,}34\\overline{5}", "1{,}1\\overline{8}", "25{,}372"])
valores("operaciones con decimales periódicos", 3, ["A.3", "A.4"], "Determina la fracción generatriz de:", [
    ("0.3/(1-10^(-1))+0.6/(1-10^(-1))", "1"), ("0.8/(1-10^(-1))*2.5", "20/9"), ("0.65/(0.65/(1-10^(-2)))", "99/100"),
    ("0.125/(0.125/(1-10^(-3)))", "999/1000")], "mv3", "cap. 1, act. 18 y autoevaluación 8c",
    enunciados=["0{,}333\\ldots + 0{,}666\\ldots", "0{,}888\\ldots \\cdot 2{,}5", "0{,}65 : 0{,}656565\\ldots", "\\frac{0{,}125}{0{,}125125125\\ldots}"])
valores("operaciones combinadas con fracciones", 2, S, "Efectúa las siguientes operaciones combinadas, simplificando siempre en todos los pasos y respetando la jerarquía:", [
    ("(32+1/2-4)-(16-3/2-2)", "16"), ("1/4+1/3*6/5", "13/20"), ("(1/4+1/3)*6/5", "7/10"), ("1-2/3*1/5", "13/15"),
    ("(1-2/3)*1/5", "1/15"), ("(-1+1/2-1/3)*6/5", "-1")], "ag3", "fracciones, ficha 5, ej. 1 (e–i, l)",
    enunciados=["\\left(32+\\frac{1}{2}-4\\right)-\\left(16-\\frac{3}{2}-2\\right)", "\\frac{1}{4}+\\frac{1}{3} \\cdot \\frac{6}{5}", "\\left(\\frac{1}{4}+\\frac{1}{3}\\right) \\cdot \\frac{6}{5}",
                "1-\\frac{2}{3} \\cdot \\frac{1}{5}", "\\left(1-\\frac{2}{3}\\right) \\cdot \\frac{1}{5}", "\\left(-1+\\frac{1}{2}-\\frac{1}{3}\\right) \\cdot \\frac{6}{5}"])
valores("operaciones combinadas con fracciones", 3, S, "Calcula y simplifica:", [
    ("2/3*((3/2)/(1/3))^2+(2-1/2)^2", "63/4"), ("3/4*((3/2)/(3/4))^3+(2-3/2)^2", "25/4"), ("8/3*((3/4)/(1/2))^2+(1/2-1)^3", "47/8")], "mv3", "cap. 1, ejercicios y problemas 31",
    enunciados=["\\frac{2}{3} \\cdot \\left(\\frac{3}{2} : \\frac{1}{3}\\right)^{2}+\\left(2-\\frac{1}{2}\\right)^{2}", "\\frac{3}{4} \\cdot \\left(\\frac{3}{2} : \\frac{3}{4}\\right)^{3}+\\left(2-\\frac{3}{2}\\right)^{2}",
                "\\frac{8}{3} \\cdot \\left(\\frac{3}{4} : \\frac{1}{2}\\right)^{2}+\\left(\\frac{1}{2}-1\\right)^{3}"])
valores("fracciones de términos fraccionarios", 3, S, "Resuelve paso a paso y simplifica:", [
    ("(3/5-(2/5)/(4/6))/((3/5)/(1/6-2))", "0"), ("(2/3-(5/6)/(2-11/3))/(2/6)", "7/2"), ("1/((3+(4/5)/(6/10)))", "3/13")], "mv3", "cap. 1, ejercicios y problemas 12 y 10; autoevaluación 4",
    enunciados=["\\frac{\\frac{3}{5}-\\frac{2}{5} : \\frac{4}{6}}{\\frac{3}{5} : \\left(\\frac{1}{6}-2\\right)}", "\\frac{\\frac{2}{3}-\\frac{5}{6} : \\left(2-\\frac{11}{3}\\right)}{\\frac{2}{6}}",
                "\\text{la fracción inversa de } 3+\\frac{4}{5} : \\frac{6}{10}"])
calculo("fracción de una cantidad", 1, S, "a) Calcula las dos terceras partes de la sexta parte del 80 % de 900.   b) Halla el número tal que sus cuatro tercios valen 520.   c) ¿Cuántos botes de tres octavos de litro puedo llenar con 12 litros?   d) Calcula la fracción por la que hay que multiplicar 450 para obtener 720.",
        [("a", "2/3*1/6*80/100*900", "80", None), ("b", "520/(4/3)", "390", None), ("c", "12/(3/8)", "32", None), ("d", "720/450", "8/5", None)],
        "a) 80   b) 390   c) 32 botes   d) $\\frac{8}{5}$", "mv3", "cap. 1, ejercicios y problemas 13 a 16")
calculo("punto medio de dos fracciones", 2, ["A.2", "A.4"], "Halla la fracción que cae justo en medio de $\\frac{3}{2}$ y $\\frac{9}{4}$ en la recta numérica (pista: la media aritmética $\\frac{a+b}{2}$). Representa las tres fracciones en la recta numérica.",
        [(None, "(3/2+9/4)/2", "15/8", None)], "$\\frac{15}{8}$, entre $\\frac{3}{2} = \\frac{12}{8}$ y $\\frac{9}{4} = \\frac{18}{8}$. La fuente da $\\frac{21}{8}$, que no está entre las dos: errata", "mv3", "cap. 1, ejercicios y problemas 8 (la fuente da 21/8: errata)")
calculo("aproximación y error relativo", 2, ["A.2", "B.3"], "Aproxima los números 32 567 y 1,395 con 2 cifras significativas y di en cuál se comete menor error relativo.",
        [("32 567", "abs(33000-32567)/32567*100", "1.33", 0.01), ("1,395", "abs(1.4-1.395)/1.395*100", "0.36", 0.01)],
        "33 000, con error relativo ≈ 1,33 %; 1,4, con error relativo ≈ 0,36 %: menor en el segundo", "mv3", "cap. 1, ejercicios y problemas 20")
calculo("aproximación y error relativo", 3, ["A.2", "B.3"], "Aproximamos $\\pi$ por $3+\\frac{1}{7+\\frac{1}{16}}$. a) Simplifica hasta una fracción impropia irreducible. b) Halla el error absoluto y el error relativo.",
        [("a", "3+1/(7+1/16)", "355/113", None), ("b", "abs(355/113-pi)/pi*100", "8.5*10^(-6)", 10**-7)],
        "a) $\\frac{355}{113}$   b) error absoluto ≈ $2{,}7 \\cdot 10^{-7}$; error relativo ≈ $8{,}5 \\cdot 10^{-6}$ %", "mv3", "cap. 1, ejercicios y problemas 22")
calculo("aproximación y error relativo", 2, ["A.2", "B.3"], "Aproxima los números 9859 y 9,945 con 2 cifras significativas y calcula los errores relativos cometidos (en %). ¿Cuál es menor?",
        [("9859", "abs(9900-9859)/9859*100", "0.42", 0.01), ("9,945", "abs(9.9-9.945)/9.945*100", "0.45", 0.01)],
        "9900: error absoluto 41, error relativo ≈ 0,42 %. 9,9: error absoluto 0,045, error relativo ≈ 0,45 %. Es un poco menor el del primero", "mv3", "cap. 1, autoevaluación 6")
P_ = "problema de fracciones"
calculo(P_, 2, S, "Si en una clase el 77,777… % de los alumnos aprueban y hay más de 30 alumnos, pero menos de 40, ¿cuántos alumnos son y cuántos aprueban?",
        [("porcentaje", "77.7/100+0.07/100/(1-10^(-1))", "7/9", None), ("aprueban", "7/9*36", "28", None)],
        "77,777… % = $\\frac{7}{9}$: el número de alumnos es múltiplo de 9 entre 30 y 40. Son 36 alumnos y aprueban 28", "mv3", "cap. 1, ejercicios y problemas 18")
calculo(P_, 2, S, "¿Cuántas botellas de 3/4 de litro necesito para tener la misma cantidad que en 60 botellas de 3/5 de litro?", [(None, "60*(3/5)/(3/4)", "48", None)], "48 botellas", "mv3", "cap. 1, ejercicios y problemas 23")
calculo(P_, 2, S, "Halla un número entero no nulo de tal forma que su mitad, su tercera parte, su cuarta parte, su quinta parte, su sexta parte y su séptima parte sean números enteros.",
        [(None, "lcm(lcm(lcm(4,5),6),7)", "420", None)], "420 (el mínimo común múltiplo de 2, 3, 4, 5, 6 y 7; también vale cualquier múltiplo)", "mv3", "cap. 1, ejercicios y problemas 24")
calculo(P_, 2, S, "Halla la fracción resultante: a) Quito 1 tercio de lo que tengo y luego añado 1 tercio de lo que queda. b) Añado 1 tercio de lo que tengo y después quito 1 tercio del resultado.",
        [("a", "(1-1/3)*(1+1/3)", "8/9", None), ("b", "(1+1/3)*(1-1/3)", "8/9", None)], "a) $\\frac{8}{9}$   b) $\\frac{8}{9}$", "mv3", "cap. 1, ejercicios y problemas 26")
calculo(P_, 2, S, "Darío da pasos de 3/5 de metro y su perro Rayo da pasos de 1/4 de metro. Si ambos van a igual velocidad y Rayo da 360 pasos por minuto, ¿cuántos pasos por minuto dará Darío?",
        [(None, "360*(1/4)/(3/5)", "150", None)], "150 pasos por minuto", "mv3", "cap. 1, ejercicios y problemas 28")
calculo(P_, 3, S, "Una medusa crece cada semana un tercio de su volumen. a) ¿Cuántas semanas deben pasar para que su volumen se multiplique por más de 3? b) Si su volumen actual es de 1200 cm³, ¿cuál era su volumen hace 3 semanas?",
        [("a, 3 semanas", "(4/3)^3", "64/27", None), ("a, 4 semanas", "(4/3)^4", "256/81", None), ("b", "1200/(4/3)^3", "506.25", None)],
        "a) 4 semanas: $\\left(\\frac{4}{3}\\right)^{3} \\approx 2{,}37 < 3$ y $\\left(\\frac{4}{3}\\right)^{4} \\approx 3{,}16 > 3$.   b) 506,25 cm³", "mv3", "cap. 1, autoevaluación 9")
problema(P_, 3, ["A.3", "D.2"], "A un trabajador le bajan el sueldo la sexta parte; de lo que le queda, el 25 % se va destinado a impuestos y, por último, del resto que le queda las dos quintas partes se las gasta en pagar la hipoteca del piso. Si aún tiene disponibles 450 €, ¿cuánto cobraba antes de la bajada de sueldo? ¿Cuánto paga de impuestos y de hipoteca?",
         "x*5/6*3/4*3/5 = 450", ["1200"], "Cobraba 1200 €. Ahora cobra 1000 €, paga 250 € de impuestos y 300 € de hipoteca", "mv3", "cap. 1, autoevaluación 10")
calculo(P_, 1, S, "Roberto sale de casa con 50 € para realizar la compra. En la carnicería gasta las 2/5 partes de esa cantidad. Destina después la 1/3 parte de lo que le queda en la frutería. Finalmente, por el camino pierde la mitad de las vueltas. ¿Con cuánto dinero regresará a casa?",
        [(None, "50*(1-2/5)*(1-1/3)*(1/2)", "10", None)], "Le quedan 10 €", "ag3", "fracciones, ficha 11, ej. 2")
calculo(P_, 2, S, "Un depósito contiene 600 m³ de agua. Para regar una finca se extraen el lunes los 2/5 del depósito y el martes 1/3 del agua que quedaba. ¿Qué cantidad de agua se sacó cada día? ¿Cuántos litros de agua quedarán el miércoles en el depósito? ¿Qué fracción del depósito quedará el miércoles?",
        [("lunes", "2/5*600", "240", None), ("martes", "1/3*(600-240)", "120", None), ("litros", "(600-240-120)*1000", "240000", None), ("fracción", "(600-240-120)/600", "2/5", None)],
        "Lunes 240 m³, martes 120 m³; quedan 240 m³ = 240 000 litros, $\\frac{2}{5}$ del depósito", "ag3", "fracciones, ficha 11, ej. 7")
problema(P_, 2, ["A.3", "D.2"], "De un depósito, primero se gasta la mitad del agua, y luego la cuarta parte de lo que quedaba. Al final quedan 12 litros. Halla, razonadamente, qué fracción del depósito queda y la capacidad del depósito.",
         "x*(1-1/2)*(1-1/4) = 12", ["32"], "Quedan $\\frac{3}{8}$ del depósito; la capacidad es 32 litros", "ag3", "fracciones, ficha 11, ej. 10")
guarda(materia="matematicas", etapa="eso", curso=3, tema="numeros-racionales", titulo="Números racionales: fracciones, decimales y aproximaciones",
       saberes=["A.2", "A.3", "A.4", "B.3", "D.2"], prefijo="m3-rac")
