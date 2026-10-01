import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
# Aragón (3.º, D.4): ecuaciones lineales y cuadráticas. Las bicuadradas y las de grado mayor
# que 2 (factorizadas) de Marea Verde no entran.
S = ["D.4"]
ecuaciones("primer grado", 1, S, "Resuelve las siguientes ecuaciones:", ["2*x-3 = 4*x-5", "3*x+6 = 9*x-12", "4*x+8 = 12"], "mv3", "cap. 5, act. 4", respuestas=[["1"], ["3"], ["1"]])
ecuaciones("primer grado", 2, S, "Resuelve las siguientes ecuaciones de primer grado:", [
    "-x-6*x-8 = 0", "-1+x = 6", "7*x = 70*x+5", "2*(x+3)-(2*x+1) = 5", "5*(2*x-1)+(x-1) = 5", "12*(x-1)-6*(2+x) = -18", "(2*x+3)+(x-1) = -x-3", "x+2 = 2*x+168", "6*(2*x-3*x+1)-2*x-1 = -1"],
    "mv3", "cap. 5, ejercicios y problemas 1 (en e) la fuente da x = 1/11: errata, es x = 1)",
    respuestas=[["-8/7"], ["7"], ["-5/63"], "identidad", ["1"], ["1"], ["-5/4"], ["-166"], ["3/4"]])
ecuaciones("primer grado", 2, S, "Resuelve:", ["3*x+1-(x+3) = -8", "2*(x+1) = 3*(x-2)", "4*(x-2) = 2*(2*x-1)", "2*(3*x+2)-3*(2*x-1) = 7", "5*(2*x-3)-8*(4*x-9) = 6", "x-7*(2*x+1) = 2*(6-5*x)-13"],
           "ag3", "ecuaciones de 1.er grado, ficha 1, ej. 1 (7, 9, 11, 25, 26 y 50)", respuestas=[["-3"], ["8"], "sin solución", "identidad", ["51/22"], ["-2"]])
ecuaciones("primer grado con denominadores", 2, S, "Resuelve las siguientes ecuaciones de primer grado con denominadores:", [
    "(x-1)/2-(x+1)/3 = 10", "(x-3)/3+(-x+1)/7 = 3", "(x+1)/5+(2*x+6)/10 = 2", "(1-x)/2+(3*x-1)/3 = 1/3", "(2*x-8)/5-(3*x-9)/10 = x-1", "(2*x+3*x)/5-(3*x-6)/10 = 1"],
    "mv3", "cap. 5, ejercicios y problemas 2", respuestas=[["65"], ["81/4"], ["3"], ["1/3"], ["1/3"], ["4/7"]])
ecuaciones("primer grado con denominadores", 3, S, "Resuelve:", [
    "3*(-x+5)/4+2*(x-3)/3 = 6", "x+3*(x-5)/2 = 3+(5*x-21)/2", "6*x/7+4*(x-2)/14-2*(x+2)/7 = 9", "1-(3*x-7)/5 = (5*x+4)/15-(x-1)/3", "(1-x)/3-(x-1)/12 = (3*x-1)/4"],
    "ag3", "ecuaciones de 1.er grado, ficha 1, ej. 2 (22, 25, 30, 41, 51)", respuestas=[["-51"], "identidad", ["71/6"], ["3"], ["4/7"]])
ecuaciones("segundo grado incompleta", 1, S, "Resuelve las siguientes ecuaciones de segundo grado incompletas:", ["3*x^2+6*x = 0", "3*x^2-27 = 0", "x^2-25 = 0", "2*x^2+x = 0", "4*x^2-9 = 0", "5*x^2-10*x = 0"],
           "mv3", "cap. 5, act. 9 (en a) la fuente da x = -6: errata, es x = -2)", respuestas=[["-2", "0"], ["-3", "3"], ["-5", "5"], ["-1/2", "0"], ["-3/2", "3/2"], ["0", "2"]])
ecuaciones("segundo grado incompleta", 1, S, "Resuelve las siguientes ecuaciones de 2.º grado incompletas aplicando el método más conveniente en cada caso (no vale utilizar la fórmula general):", ["x^2-5*x = 0", "x^2-16 = 0", "x^2+49 = 0", "4-25*x^2 = 0", "-x^2-x = 0", "x^2-8 = 0"],
           "ag3", "ecuaciones de 2.º grado, ficha 2, ej. 1 (1, 2, 5, 23, 25 y 22)", respuestas=[["0", "5"], ["-4", "4"], "sin solución", ["-2/5", "2/5"], ["-1", "0"], ["-2*sqrt(2)", "2*sqrt(2)"]])
ecuaciones("segundo grado completa", 2, S, "Resuelve las siguientes ecuaciones de 2.º grado completas:", ["x^2-7*x+10 = 0", "2*x^2+2*x-24 = 0", "3*x^2-9*x+6 = 0", "x^2-4*x-12 = 0"], "mv3", "cap. 5, act. 7",
           respuestas=[["2", "5"], ["-4", "3"], ["1", "2"], ["-2", "6"]])
ej("número de soluciones", 1, S, "Averigua cuántas soluciones tienen las siguientes ecuaciones de 2.º grado: a) $x^{2}+x+4 = 0$   b) $x^{2}-6x+9 = 0$   c) $x^{2}-6x-7 = 0$   d) $x^{2}-3x+5 = 0$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "1^2-4*1*4", "respuesta": "-15"}, {"tipo": "valor", "apartado": "b", "expresion": "(-6)^2-4*1*9", "respuesta": "0"},
              {"tipo": "valor", "apartado": "c", "expresion": "(-6)^2-4*1*(-7)", "respuesta": "64"}, {"tipo": "valor", "apartado": "d", "expresion": "(-3)^2-4*1*5", "respuesta": "-11"}],
   solucion="Discriminante $b^{2}-4ac$: a) $-15 < 0$: ninguna   b) $0$: una (doble)   c) $64 > 0$: dos   d) $-11 < 0$: ninguna", fuente="mv3", ref="cap. 5, act. 8")
ecuaciones("segundo grado completa", 2, S, "Resuelve con la fórmula general:", ["x^2-4*x+21 = 0", "3*x^2-10*x+7 = 0", "x^2-2*x-1 = 0", "x^2+x-1 = 0", "6*x^2-5*x-6 = 0", "-2*x^2+2*x+15 = 0", "x^2+6*x-8 = 0", "3*x^2-6*x-4 = 0"],
           "ag3", "ecuaciones de 2.º grado, ficha 2, ej. 3 (3, 8, 13, 15, 12, 38, 60 y 69)",
           respuestas=["sin solución", ["1", "7/3"], ["1-sqrt(2)", "1+sqrt(2)"], ["(-1-sqrt(5))/2", "(-1+sqrt(5))/2"], ["-2/3", "3/2"], ["(1-sqrt(31))/2", "(1+sqrt(31))/2"], ["-3-sqrt(17)", "-3+sqrt(17)"], ["1-sqrt(21)/3", "1+sqrt(21)/3"]])
ecuaciones("segundo grado completa", 2, S, "Determina el número de soluciones reales que tienen las siguientes ecuaciones de segundo grado calculando su discriminante, y luego resuélvelas:", ["x^2+3*x-4 = 0", "7*x^2+12*x-4 = 0", "3*x^2+7*x+10 = 0", "x^2-x+5 = 0", "6*x^2-2*x-3 = 0", "5*x^2+8*x-6 = 0"],
           "mv3", "cap. 5, ejercicios y problemas 9", respuestas=[["-4", "1"], ["-2", "2/7"], "sin solución", "sin solución", ["(1-sqrt(19))/6", "(1+sqrt(19))/6"], ["(-4-sqrt(46))/5", "(-4+sqrt(46))/5"]])
ecuaciones("segundo grado: operar antes", 2, S, "Resuelve las siguientes ecuaciones de 2.º grado:", ["-x^2-6*x-8 = 0", "x*(-1+x) = 6", "7*x^2 = 70*x", "2*(x+3)-x*(2*x+1) = 5", "5*(2*x-1)+x*(x-1) = 5", "12*(x^2-1)-6*(2+x) = -18", "(2*x+3)*(x-1) = -x-3", "x*(x+2) = 168", "6*(2*x^2-3*x+1)-x*(2*x-1) = -1"],
           "mv3", "cap. 5, ejercicios y problemas 3",
           respuestas=[["-4", "-2"], ["-2", "3"], ["0", "10"], ["-1/2", "1"], ["-10", "1"], ["-1/2", "1"], ["-1", "0"], ["-14", "12"], ["7/10", "1"]])
ecuaciones("segundo grado con denominadores", 3, S, "Resuelve las siguientes ecuaciones de 2.º grado con denominadores:", ["(x^2-1)/2-(x+1)/3 = 10", "(x^2-3)/3+(x^2-x+1)/7 = 3", "(x^2+1)/5+(2*x+6)/10 = 2", "(1-x^2)/2+(3*x-1)/3 = 1/3", "(2*x^2-8)/5-(3*x-9)/10 = x-1", "(2*x+3*x^2)/5-(3*x-6)/10 = 1"],
           "mv3", "cap. 5, ejercicios y problemas 4",
           respuestas=[["-13/3", "5"], ["-27/10", "3"], ["-3", "2"], ["1-sqrt(6)/3", "1+sqrt(6)/3"], ["1/4", "3"], ["(-1-sqrt(97))/12", "(-1+sqrt(97))/12"]])
ecuaciones("segundo grado: operar antes", 3, S, "Resuelve:", ["3*(x^2-1)+2*(x^2-2*x) = 9", "156 = x*(x-1)", "3*x^2-14*x+15 = 0", "(x-14)^2+x^2 = (x+2)^2", "2*(x+2)-x*(2-x) = 0"], "mv3", "cap. 5, autoevaluación 1 a 5",
           respuestas=[["-6/5", "2"], ["-12", "13"], ["5/3", "3"], ["8", "24"], "sin solución"])
ej("coeficiente desconocido", 2, S, "Si 3 es una solución de $x^{2}-5x+a = 0$, ¿cuánto vale $a$?", comprobar=[{"tipo": "ecuacion", "ecuacion": "3^2-5*3+a = 0", "var": "a", "respuesta": ["6"]}],
   solucion="$9-15+a = 0$: $a = 6$", fuente="mv3", ref="cap. 5, act. 13")
ej("coeficiente desconocido", 3, S, "Calcula el valor del coeficiente $b$ en la ecuación $5x^{2}+bx+6 = 0$ sabiendo que una de sus soluciones es 1. ¿Cuál es la otra solución?",
   comprobar=[{"tipo": "ecuacion", "apartado": "b", "ecuacion": "5*1^2+b*1+6 = 0", "var": "b", "respuesta": ["-11"]}, {"tipo": "ecuacion", "apartado": "otra", "ecuacion": "5*x^2-11*x+6 = 0", "respuesta": ["1", "6/5"]}],
   solucion="$b = -11$; la otra solución es $x = \\frac{6}{5}$", fuente="ag3", ref="ecuaciones de 2.º grado, ficha 2, ej. 5")
ej("escribir la ecuación", 2, S, "Escribe una ecuación de segundo grado cuyas soluciones sean 3 y 7. ¿Podrías escribir una ecuación de segundo grado con únicamente una solución real que no fuese doble?",
   solucion="Por ejemplo $(x-3)(x-7) = 0$, es decir, $x^{2}-10x+21 = 0$ (valen todas las de la forma $a(x-3)(x-7) = 0$). No: una ecuación de segundo grado tiene dos soluciones, una doble o ninguna", fuente="mv3", ref="cap. 5, act. 11 y ejercicios y problemas 13")
P_ = "problema de ecuaciones"
problema(P_, 2, ["D.2", "D.4"], "El perímetro de un rectángulo mide 16 cm y su área 15 cm². Calcula sus dimensiones.", "x*(8-x) = 15", ["3", "5"], "Un lado mide 3 cm y el otro 5 cm", "mv3", "cap. 5, act. 12")
problema(P_, 2, ["D.2", "D.4"], "¿Qué número multiplicado por 3 es 40 unidades menor que su cuadrado?", "3*x = x^2-40", ["-5", "8"], "El número 8 o el número -5", "mv3", "cap. 5, act. 25")
problema(P_, 2, ["D.2", "D.4"], "Calcula tres números consecutivos tales que la suma de sus cuadrados sea 365.", "(x-1)^2+x^2+(x+1)^2 = 365", ["-11", "11"], "10, 11 y 12, o bien -12, -11 y -10 (el del medio es 11 o -11)", "mv3", "cap. 5, act. 26")
problema(P_, 2, ["D.2", "D.4"], "El triple del cuadrado de un número aumentado en su duplo es 85. ¿Cuál es el número?", "3*x^2+2*x = 85", ["-17/3", "5"], "El número 5 o el número $-\\frac{17}{3}$", "mv3", "cap. 5, act. 27")
problema(P_, 3, ["D.2", "D.4"], "Dentro de 11 años, la edad de Mario será la mitad del cuadrado de la edad que tenía hace 13 años. ¿Qué edad tiene Mario?", "x+11 = (x-13)^2/2", ["7", "21"], "21 años (con 7 años no podía tener edad hace 13 años)", "mv3", "cap. 5, ejercicios y problemas 33")
problema(P_, 2, ["D.2", "D.4"], "¿Cuál es la edad de una persona si al multiplicarla por 15 le faltan 100 unidades para completar su cuadrado?", "15*x+100 = x^2", ["-5", "20"], "20 años (-5 no vale para una edad)", "mv3", "cap. 5, ejercicios y problemas 26")
problema(P_, 3, ["D.2", "D.4", "C.1"], "Determina los catetos de un triángulo rectángulo cuya suma es 7 cm y la hipotenusa de dicho triángulo mide 5 cm.", "x^2+(7-x)^2 = 25", ["3", "4"], "3 y 4 cm", "mv3", "cap. 5, ejercicios y problemas 37")
problema(P_, 2, ["D.2", "D.4"], "Dos números naturales se diferencian en 2 unidades y la suma de sus cuadrados es 580. ¿Cuáles son dichos números?", "x^2+(x+2)^2 = 580", ["-18", "16"], "16 y 18 (-18 no es natural)", "mv3", "cap. 5, ejercicios y problemas 34")
problema(P_, 1, ["D.2", "D.4"], "Un pastor vende 1/5 de sus ovejas. Después compra 120 y así pasa a tener el doble de las que tenía al principio. ¿Cuántas tenía originalmente?", "x-x/5+120 = 2*x", ["100"], "100 ovejas", "ag3", "problemas de planteamiento, ficha 5, ej. 9")
problema(P_, 2, ["D.2", "D.4"], "Juan ha leído ya la quinta parte de un libro. Cuando lea 90 páginas más, todavía le quedará la mitad del libro. ¿Cuántas páginas tiene el libro? ¿Cuántas páginas lleva leídas?", "x/5+90 = x/2", ["300"], "300 páginas; lleva leídas 60", "ag3", "problemas de planteamiento, ficha 5, ej. 15")
problema(P_, 3, ["D.2", "D.4"], "La juventud de Diofanto duró 1/6 de su vida; se dejó barba después de 1/12 más. Después de 1/7 de su vida se casó. Cinco años después tuvo un hijo. Este vivió exactamente la mitad de tiempo que su padre, y Diofanto murió cuatro años después. Halla la edad de Diofanto.",
         "x/6+x/12+x/7+5+x/2+4 = x", ["84"], "84 años", "ag3", "problemas de planteamiento, ficha 5, ej. 29")
problema(P_, 2, ["D.2", "D.4"], "Problema del bambú (texto indio del siglo IX): un bambú que mide 30 codos y que se eleva sobre un terreno plano se rompe en un punto por la fuerza del viento, de forma que la punta se queda ahora colgando a 16 codos del suelo. ¿A qué altura se ha roto?",
         "x-(30-x) = 16", ["23"], "A 23 codos: la parte rota, de $30-23 = 7$ codos, cuelga desde 23 hasta 16 codos", "ag3", "problemas de planteamiento, ficha 5, ej. 20")
problema(P_, 2, ["D.2", "D.4"], "Restamos al área de un cuadrado su lado y obtenemos 870. Halla el lado de dicho cuadrado (texto matemático babilónico).", "x^2-x = 870", ["-29", "30"], "30 (la otra solución, -29, no vale para un lado)", "ag3", "problemas de planteamiento, ficha 5, ej. 35")
problema(P_, 2, ["D.2", "D.4"], "Uno de los lados de un rectángulo es 3 m más pequeño que el triple del otro. Si el perímetro y el área coinciden numéricamente, halla ambos lados.", "x*(3*x-3) = 2*x+2*(3*x-3)", ["2/3", "3"], "3 m y 6 m (con $x = \\frac{2}{3}$ el otro lado saldría negativo)",
         "ag3", "problemas de planteamiento, ficha 5, ej. 39")
problema(P_, 2, ["D.2", "D.4"], "Se tiene un lote de baldosas cuadradas. Si se forma con ellas un cuadrado de $x$ baldosas por lado sobran 27, y si se toman $x+1$ baldosas por lado faltan 40. Halla las baldosas del lote.", "x^2+27 = (x+1)^2-40", ["33"], "Con $x = 33$: $33^{2}+27 = 1116$ baldosas", "ag3", "problemas de planteamiento, ficha 5, ej. 46")
guarda(materia="matematicas", etapa="eso", curso=3, tema="ecuaciones", titulo="Ecuaciones de primer y segundo grado",
       saberes=["D.2", "D.4", "C.1"], prefijo="m3-ec")
