import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]; SA = ["A.2"]; SP = ["A.2", "A.3"]


def op(tipo, dif, saberes, consigna, lista, fuente, ref):
    """lista de (operación como se escribe, con [ ], : y ·  → resultado)."""
    exprs = [(s.replace("[", "(").replace("]", ")").replace(":", "/").replace("·", "*"), r) for s, r in lista]
    ens = [s.replace("·", " \\cdot ").replace(":", " : ").replace("[", "\\left[").replace("]", "\\right]") for s, _ in lista]
    return valores(tipo, dif, saberes, consigna, exprs, fuente, ref, enunciados=ens)


ej("situaciones con enteros", 1, SA, "Escribe el número que mejor representa la situación que se plantea: a) Un avión vuela a 1 292 m de altura.   b) El lunes el termómetro marcaba 6 °C bajo cero.   c) El coche estaba en el sótano 2.   d) Sócrates nació en el año 470 antes de Cristo.",
   solucion="a) +1292   b) −6   c) −2   d) −470", fuente="mv1", ref="cap. 4, ej. 1")
ej("situaciones con enteros", 1, SA, "Indica el significado de los números −5, 0 y +3 en cada una de las situaciones siguientes: a) En un ascensor   b) En un termómetro   c) En una cuenta",
   solucion="Ascensor: sótano 5, planta baja, tercera planta. Termómetro: 5 grados bajo cero, cero grados, 3 grados. Cuenta: debo 5 €, no tengo nada, tengo 3 €", fuente="mv1", ref="cap. 4, ej. 3")
valores("valor absoluto y opuesto", 1, SA, "Calcula:", [("abs(9)", "9"), ("abs(-11)", "11"), ("abs(0)", "0"), ("abs(-6)", "6"), ("-(6)", "-6"), ("-(-4)", "4")], "mv1", "cap. 4, ej. 4 y 5",
        enunciados=["|+9|", "|-11|", "|0|", "|-6|", "\\mathrm{Op}(+6)", "\\mathrm{Op}(-4)"])
ej("ordenar en la recta numérica", 1, SA, "Representa en una recta numérica los siguientes números y ordénalos de menor a mayor: −7, 3, 1, −4, 6, −5, −2 y 0.",
   solucion="$-7 < -5 < -4 < -2 < 0 < 1 < 3 < 6$", fuente="mv1", ref="cap. 4, ej. 7")
ej("comparar enteros", 1, SA, "Completa con el signo < (menor) o > (mayor) según corresponda: a) −11 □ −6   b) −8 □ +4   c) +2 □ +10   d) +3 □ −9   e) −2 □ |−6|. Ordena de menor a mayor: f) +12, −4, −15, +13   g) +3, −25, −9, −6",
   solucion="a) $-11 < -6$   b) $-8 < +4$   c) $+2 < +10$   d) $+3 > -9$   e) $-2 < |-6|$   f) $-15 < -4 < +12 < +13$   g) $-25 < -9 < -6 < +3$", fuente="mv1", ref="cap. 4, ej. 8 y 9")
ej("ordenar en la recta numérica", 2, SA, "Representa gráficamente y ordena en sentido creciente, calcula los opuestos y los valores absolutos de los siguientes números enteros: 9, −5, −6, 4, −3, 5, −6, 0, 8",
   solucion="$-6 = -6 < -5 < -3 < 0 < 4 < 5 < 8 < 9$. Opuestos: −9, 5, 6, −4, 3, −5, 6, 0, −8. Valores absolutos: 9, 5, 6, 4, 3, 5, 6, 0, 8", fuente="mv1", ref="cap. 4, ejercicios y problemas, ej. 10")
op("sumas de enteros", 1, S, "Halla el resultado de las siguientes sumas:", [("(+12)+(+5)+(-4)", "13"), ("(-8)+(-2)+(-10)", "-20"), ("(-15)+(-4)+(+9)", "-10"), ("(-3)+(+11)", "8"), ("(-14)+(-7)+(-11)", "-32"), ("(-7)+(-2)+(+6)", "-3")], "mv1", "cap. 4, ej. 12 y 13")
op("sumas y restas de enteros", 2, S, "Realiza en tu cuaderno las siguientes sumas y diferencias de números enteros:",
   [("+(+4)+(-6)", "-2"), ("-(+5)-(+7)", "-12"), ("-(-6)+(+8)", "14"), ("-(+4)+(+2)-(-5)", "3"), ("-(+3)-(+2)-(+7)", "-12"), ("-(+3)+(-2)+(-5)-(-6)", "-4"), ("-(+2)-(+4)-(-5)-(-6)", "5")], "mv1", "cap. 4, ej. 23")
op("sumas y restas de enteros", 2, S, "Calcula en tu cuaderno:", [("(+7)-(-5)-(+2)+(-6)", "4"), ("-(-9)-(+7)+(-8)+(+6)", "0"), ("+(-1)-(+15)-(-13)+(+7)", "4"), ("-(+2)+(-5)-(-17)-(+8)-(+4)", "-2")], "mv1", "cap. 4, ejercicios y problemas, ej. 1 (la fuente da −6 en el d: está mal)")
EJ[-1]["solucion"] = "a) +4   b) 0   c) 4   d) −2 (la fuente da −6: está mal)"
op("sumas y restas de enteros", 1, S, "Halla y escribe el resultado en tu cuaderno:", [("6-9-5+4-7+1", "-10"), ("11-12+8-14+16-7", "2"), ("1-3-8-12+4+19-2", "-1"), ("-8-16+9+2-8-7+12", "-16")], "mv1", "cap. 4, ejercicios y problemas, ej. 4")
op("sumas y restas de enteros", 1, S, "Calcula las siguientes sumas de números enteros:", [("(+2)-(-9)-(-8)-(-8)", "27"), ("(+4)+(-7)-(+2)+(+1)", "-4"), ("(+2)-(+8)+(-5)-(-3)-(+1)", "-9"), ("(-1)+(-1)+(-5)-(+7)+(-7)", "-21")], "edad1", "quincena 3, para practicar, ej. 2")
op("regla de los signos", 1, S, "Efectúa en tu cuaderno aplicando la regla de los signos:",
   [("(-6)·(-7)", "42"), ("(-24):(+4)", "-6"), ("(-5)·(+8)", "-40"), ("(+49):(-7)", "-7"), ("(-7)·(-9)", "63"), ("(+48):(+6)", "8"), ("(+11)·(+6)", "66"), ("(-60):(-10)", "6"), ("(-12)·(-6)", "72"), ("(+75):(-15)", "-5")], "mv1", "cap. 4, ejercicios y problemas, ej. 3")
op("jerarquía de las operaciones", 2, S, "Utiliza la jerarquía de operaciones para calcular en tu cuaderno:",
   [("4·(10-12)", "-8"), ("-6·(5-1)", "-24"), ("6·(1-5)-10", "-34"), ("10+5·(8-12)", "-10"), ("7·(9-2)-4·(6-12)", "73"), ("5·(12-9)+4·(2-17)", "-45")], "mv1", "cap. 4, ejercicios y problemas, ej. 5")
op("jerarquía de las operaciones", 2, S, "Utiliza la jerarquía de operaciones para calcular en tu cuaderno:",
   [("7-5·4", "-13"), ("3·8-6", "18"), ("5·6-7·4", "2"), ("3·9-5·4", "7"), ("25-5·8+2·6-33", "-36"), ("6·7-40-4·8+57", "27")], "mv1", "cap. 4, ejercicios y problemas, ej. 7 (la fuente da 36 en el e y 23 en el f: están mal)")
EJ[-1]["solucion"] = "a) −13   b) 18   c) 2   d) 7   e) −36   f) 27 (la fuente da 36 y 23 en el e y el f: están mal)"
op("jerarquía de las operaciones", 3, S, "Utiliza la jerarquía de operaciones para calcular en tu cuaderno:",
   [("6·(-5)-3·(-7)+20", "11"), ("-8·(+5)+(-4)·9+50", "-26"), ("(-3)·(+9)-(-6)·(-7)+(-2)·(+5)", "-79"), ("-(-1)·(+6)·(-9)·(+8)-(+5)·(-7)", "-397")], "mv1", "cap. 4, ejercicios y problemas, ej. 9")
op("jerarquía de las operaciones", 2, S, "Realiza las siguientes operaciones:",
   [("+4-(+5)·(-3)", "19"), ("+6+(-9):(+2-5)", "9"), ("-3+[-4-(-26):(+2)]", "6"), ("+8+(-1)·(+6)", "2"), ("-6+(-7):(+7)", "-7"), ("+28-(-36):(-9-9)", "26"), ("+11+(+7)·(+6-8)", "-3"), ("-7-[+4-(-6):(+6)]", "-12"), ("+9+[+5+(-8)·(-1)]", "22")],
   "mv1", "cap. 4, ej. 28 y 29 (la fuente da 30 y 25 en el 29 c y d: están mal)")
EJ[-1]["solucion"] = "a) 19   b) 9   c) 6   d) 2   e) −7   f) 26   g) −3   h) −12   i) 22 (en f y g la fuente da 30 y 25: están mal)"
op("jerarquía con corchetes", 3, S, "Opera respetando la jerarquía de operaciones:",
   [("-4-(+24):(+1-9)-(-1-2)", "2"), ("+7+(-5):(-7+2)-(+1-6)", "13"), ("-6-[+7+(+1)·(-1)]", "-12"), ("+7+[+1-(+10):(+5)]", "6"),
    ("+4+[+2+(+8)·(-6)-(-7+6)]", "-41"), ("-2-[-6+(-4):(-2)-(+7-5)]", "4"), ("+1-[-4+(-10):(-5)]+[+3+(-9):(-9)]", "7"), ("+1-[+3-(-8)·(+8)]+[+6+(+8):(+4)]", "-58")],
   "edad1", "quincena 3, para practicar, ej. 4 y 5 (la fuente da −62 en el 5 d: está mal)")
EJ[-1]["solucion"] = "a) +2   b) +13   c) −12   d) +6   e) −41   f) +4   g) +7   h) −58 (la fuente da −62: está mal)"
op("con calculadora", 2, S, "Utiliza la calculadora para realizar las siguientes operaciones:",
   [("+3+(-2)·(+7)", "-11"), ("-4+(-11):(+11)", "-5"), ("+14-(-27):(-9-9)", "12.5"), ("+5+(+2)·(+9-4)", "15"), ("-3-[+5-(-7):(+7)]", "-9"), ("+8+[+3+(-5)·(-2)]", "21")], "mv1", "cap. 4, ej. 32")
valores("potencias de enteros", 2, S, "Efectúa en tu cuaderno y explica qué conclusiones obtienes:", [("(-3)^4", "81"), ("(+3)^4", "81"), ("-3^4", "-81"), ("+3^4", "81"), ("(-3)^3", "-27"), ("-3^3", "-27")], "mv1", "cap. 4, ejercicios y problemas, ej. 8",
        enunciados=["(-3)^{4}", "(+3)^{4}", "-3^{4}", "+3^{4}", "(-3)^{3}", "-3^{3}"])
EJ[-1]["solucion"] = "a) 81   b) 81   c) −81   d) 81   e) −27   f) −27. Una potencia de base negativa es positiva si el exponente es par y negativa si es impar; en $-3^{4}$ el signo no está elevado"
valores("potencias de enteros", 2, S, "Halla (usa la calculadora en las últimas):", [("(+1)^2374", "1"), ("(-1)^2375", "-1"), ("(-3)^2", "9"), ("(-3)^3", "-27"), ("(+3)^16", "43046721"), ("(-2)^15", "-32768"), ("(-3)^11", "-177147"), ("(-2)^20", "1048576")], "mv1", "cap. 4, ej. 30 y 33",
        enunciados=["(+1)^{2374}", "(-1)^{2375}", "(-3)^{2}", "(-3)^{3}", "(+3)^{16}", "(-2)^{15}", "(-3)^{11}", "(-2)^{20}"])
P_ = "problema con enteros"
calculo(P_, 1, S, "Un autobús comienza el viaje con 45 pasajeros. En la primera parada se bajan 7 y se suben 12. En la segunda se bajan 10 y se suben 8, y en la tercera se bajan 4. ¿Cuántos pasajeros hay en el autobús?", [(None, "45-7+12-10+8-4", "44", None)], "45 − 7 + 12 − 10 + 8 − 4 = 44 pasajeros", "mv1", "cap. 4, ej. 14")
calculo(P_, 1, S, "Un avión vuela a 4000 m y un submarino está sumergido a 60 m, ¿qué distancia en metros les separa?", [(None, "4000-(-60)", "4060", None)], "4000 − (−60) = 4060 m", "mv1", "cap. 4, ej. 15")
calculo(P_, 2, S, "Tales de Mileto vivió hacia el año 600 a. C. y Newton durante el siglo XVII, ¿qué diferencia de siglos hay entre ambas fechas? (Ayuda: representa ambas fechas en una recta numérica.)", [(None, "17-(-6)", "23", None)], "17 − (−6) = 23 siglos", "mv1", "cap. 4, ej. 10")
calculo(P_, 1, S, "En un campo de extracción de petróleo una bomba lo extrae de un pozo a 1528 m de profundidad y lo eleva a un depósito situado a 34 m de altura. ¿Qué nivel ha tenido que superar el petróleo?", [(None, "34-(-1528)", "1562", None)], "34 − (−1528) = 1562 m", "mv1", "cap. 4, ejercicios y problemas, ej. 11")
calculo(P_, 3, S, "La temperatura del aire baja según se asciende en la atmósfera, a razón de 9 °C cada 300 metros. ¿A qué altura vuela un avión si la temperatura del aire es de −90 °C, si la temperatura al nivel del mar en ese punto es de 15 °C?",
        [(None, "(15-(-90))/9*300", "3500", None)], "La temperatura baja 15 − (−90) = 105 °C: $\\frac{105}{9} \\cdot 300 = 3500$ m. (La fuente calcula con 75 °C y da 2500 m: está mal.)", "mv1", "cap. 4, ejercicios y problemas, ej. 12 (la solución de la fuente está mal)")
calculo(P_, 1, S, "Nieves vive en la planta 8 de un edificio y su plaza de garaje está en el sótano 3. ¿Cuántas plantas separan su vivienda de su plaza de garaje?", [(None, "8-(-3)", "11", None)], "8 − (−3) = 11 plantas", "mv1", "cap. 4, ejercicios y problemas, ej. 13")
calculo(P_, 1, ["A.3", "A.6"], "El saldo de la cartilla de ahorros de Manuel es hoy 289 €, pero le cargan una factura de 412 €. ¿Cuál es el saldo ahora?", [(None, "289-412", "-123", None)], "289 − 412 = −123 €", "mv1", "cap. 4, ejercicios y problemas, ej. 16")
calculo(P_, 1, S, "Cuando Manuel fue a la sierra, a las 7 de la mañana el termómetro marcaba −7 °C; a la hora de comer el termómetro había subido 9 °C, y a la hora de volver había vuelto a bajar 5 °C. ¿Qué temperatura hacía a esa hora?", [(None, "-7+9-5", "-3", None)], "−7 + 9 − 5 = −3 °C", "mv1", "cap. 4, ejercicios y problemas, ej. 17")
calculo(P_, 1, ["A.3", "A.6"], "Lourdes tenía ayer en su cartilla −169 euros y hoy tiene 56 euros. ¿Ha ingresado o ha gastado dinero? ¿Qué cantidad?", [(None, "56-(-169)", "225", None)], "Ha ingresado 56 − (−169) = 225 €", "mv1", "cap. 4, ejercicios y problemas, ej. 19")
calculo(P_, 2, S, "¿Cuál es la diferencia de temperatura que debe soportar una persona que pasa de la cámara de conservación de las frutas, que se encuentra a 4 °C, a la de la carne congelada, que está a −18 °C? ¿Y si pasara de la cámara de la carne a la de la fruta?", [(None, "4-(-18)", "22", None)], "22 grados (baja 22 °C); al revés, sube 22 °C", "mv1", "cap. 4, ejercicios y problemas, ej. 20")
calculo(P_, 1, S, "Por la mañana un termómetro marcaba 9° bajo cero. La temperatura baja 12 °C a lo largo de la mañana. ¿Qué temperatura marca al mediodía?", [(None, "-9-12", "-21", None)], "−9 − 12 = −21 °C: 21° bajo cero", "edad1", "quincena 3, para practicar, ej. 11")
calculo(P_, 1, S, "El ascensor de un edificio está en el sótano 1 y sube 5 pisos hasta que se para. ¿A qué planta ha llegado?", [(None, "-1+5", "4", None)], "−1 + 5 = 4: a la planta 4", "edad1", "quincena 3, para practicar, ej. 12")
calculo(P_, 1, ["A.3", "A.6"], "Elena tenía ayer en su cartilla −234 euros y hoy tiene 72 euros. Desde ayer, ¿ha ingresado o ha gastado dinero? ¿Qué cantidad?", [(None, "72-(-234)", "306", None)], "Ha ingresado 72 − (−234) = 306 €", "edad1", "quincena 3, para practicar, ej. 15")
problema("problema con ecuación", 3, ["A.3", "D.2"], "Pacto con el diablo: una persona protestaba por su mala suerte; solo le quedaban unos euros en el bolsillo. El diablo se le acercó y le propuso: «Yo puedo hacer que tu dinero se duplique cada vez que cruces el puente que atraviesa el río. La única condición es que yo te esperaré al otro lado y debes entregarme 24 €». Cuando cruzó por tercera vez, al dar al diablo los 24 € se quedó sin nada. ¿Cuánto dinero tenía en un principio?",
         "2*(2*(2*x-24)-24)-24 = 0", ["21"], "Tenía 21 €: 21 → 42 − 24 = 18 → 36 − 24 = 12 → 24 − 24 = 0", "mv1", "cap. 4, curiosidades")
guarda(materia="matematicas", etapa="eso", curso=1, tema="numeros-enteros", titulo="Números enteros",
       saberes=["A.2", "A.3", "A.6", "D.2"], prefijo="m1-ent")
