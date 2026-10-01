import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]


def division(dividendo, divisor, cociente, resto, ap):
    return [{"tipo": "valor", "apartado": f"{ap} cociente", "expresion": f"floor({dividendo}/{divisor})", "respuesta": str(cociente)},
            {"tipo": "valor", "apartado": f"{ap} resto", "expresion": f"{dividendo} % {divisor}", "respuesta": str(resto)}]


ej("potencias de 10", 1, ["A.2"], "Escribe mediante potencias de 10 los siguientes números: a) 7653   b) 30500   c) 275643   d) 200543",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "7*10^3+6*10^2+5*10+3", "respuesta": "7653"},
              {"tipo": "valor", "apartado": "b", "expresion": "3*10^4+5*10^2", "respuesta": "30500"},
              {"tipo": "valor", "apartado": "c", "expresion": "2*10^5+7*10^4+5*10^3+6*10^2+4*10+3", "respuesta": "275643"},
              {"tipo": "valor", "apartado": "d", "expresion": "2*10^5+5*10^2+4*10+3", "respuesta": "200543"}],
   solucion="a) $7 \\cdot 10^{3} + 6 \\cdot 10^{2} + 5 \\cdot 10 + 3$   b) $3 \\cdot 10^{4} + 5 \\cdot 10^{2}$   c) $2 \\cdot 10^{5} + 7 \\cdot 10^{4} + 5 \\cdot 10^{3} + 6 \\cdot 10^{2} + 4 \\cdot 10 + 3$   d) $2 \\cdot 10^{5} + 5 \\cdot 10^{2} + 4 \\cdot 10 + 3$",
   fuente="mv1", ref="cap. 2, ej. 1")
ej("valor de posición", 1, ["A.2"], "¿Qué lugar ocupa la cifra 5 en los siguientes números? ¿En cuál de los números tiene mayor valor? ¿Y menor? a) 508744   b) 65339001   c) 7092157   d) 9745",
   solucion="a) Centenas de millar   b) unidades de millón   c) decenas   d) unidades. Tiene el mayor valor en b) y el menor en d)", fuente="mv1", ref="cap. 2, ej. 2")
ej("sistema binario", 2, ["A.2"], "¿Podrías escribir los números del 1 al 10 en el sistema binario?",
   solucion="1, 10, 11, 100, 101, 110, 111, 1000, 1001, 1010", fuente="mv1", ref="cap. 2, ej. 4")
valores("sacar factor común", 1, S, "Saca factor común y calcula mentalmente:", [("23*4-23*3", "23"), ("540*8+540*2", "5400"), ("55*13-55*3", "550"), ("600*33-600*3", "18000")], "mv1", "cap. 2, ej. 5",
        enunciados=["23 \\cdot 4 - 23 \\cdot 3", "540 \\cdot 8 + 540 \\cdot 2", "55 \\cdot 13 - 55 \\cdot 3", "600 \\cdot 33 - 600 \\cdot 3"])
EJ[-1]["solucion"] = "a) $23 \\cdot (4 - 3) = 23$   b) $540 \\cdot (8 + 2) = 5400$   c) $55 \\cdot (13 - 3) = 550$   d) $600 \\cdot (33 - 3) = 18000$"
ej("división: D = d · c + r", 1, S, "Realiza las siguientes divisiones y comprueba con cada una de ellas la propiedad $D = d \\cdot c + r$: a) 6738 : 456   b) 34540 : 30   c) 240035 : 981   d) 397 : 45",
   comprobar=division(6738, 456, 14, 354, "a") + division(34540, 30, 1151, 10, "b") + division(240035, 981, 244, 671, "c") + division(397, 45, 8, 37, "d"),
   solucion="a) $6738 = 456 \\cdot 14 + 354$   b) $34540 = 30 \\cdot 1151 + 10$   c) $240035 = 981 \\cdot 244 + 671$   d) $397 = 45 \\cdot 8 + 37$", fuente="mv1", ref="cap. 2, ej. 7")
ej("división con calculadora", 2, S, "Halla, utilizando solo la calculadora, los cocientes y los restos de las siguientes divisiones: a) 654 : 77   b) 543 : 7   c) 8374 : 85   d) 9485 : 11   e) 6590 : 41",
   comprobar=division(654, 77, 8, 38, "a") + division(543, 7, 77, 4, "b") + division(8374, 85, 98, 44, "c") + division(9485, 11, 862, 3, "d") + division(6590, 41, 160, 30, "e"),
   solucion="a) $654 = 77 \\cdot 8 + 38$   b) $543 = 7 \\cdot 77 + 4$   c) $8374 = 85 \\cdot 98 + 44$   d) $9485 = 11 \\cdot 862 + 3$   e) $6590 = 41 \\cdot 160 + 30$", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 6")
valores("operaciones combinadas", 1, S, "Realiza las siguientes operaciones:", [("(55+12)*4", "268"), ("66*2+10", "142"), ("55+70*3+11", "276"), ("330-10*2+82", "392")], "mv1", "cap. 2, ejercicios y problemas, ej. 7",
        enunciados=["(55 + 12) \\cdot 4", "66 \\cdot 2 + 10", "55 + 70 \\cdot 3 + 11", "330 - 10 \\cdot 2 + 82"])
valores("el papel de los paréntesis", 2, S, "Di cuáles de las siguientes operaciones tienen el mismo resultado. Después hazlas en la calculadora y comprueba la importancia de añadir los paréntesis.",
        [("2*(46-16)", "60"), ("2*46-16", "76"), ("2*46-2*16", "60"), ("2*(46+16)", "124"), ("2*46+16", "108")], "mv1", "cap. 2, ejercicios y problemas, ej. 8 y 9",
        enunciados=["2 \\cdot (46 - 16)", "2 \\cdot 46 - 16", "2 \\cdot 46 - 2 \\cdot 16", "2 \\cdot (46 + 16)", "2 \\cdot 46 + 16"])
EJ[-1]["solucion"] = "a) 60   b) 76   c) 60   d) 124   e) 108. Tienen el mismo resultado la a y la c"
valores("operaciones combinadas", 2, S, "Realiza las siguientes operaciones:", [("4*(44+5)-6*2+9", "193"), ("2*(3+11)-(4+12)", "12"), ("(18-4)*5+3*7-13", "78"), ("5*12+(3-2)*4-3+4*5-5", "76")], "mv1", "cap. 2, ejercicios y problemas, ej. 10",
        enunciados=["4 \\cdot (44 + 5) - 6 \\cdot 2 + 9", "2 \\cdot (3 + 11) - (4 + 12)", "(18 - 4) \\cdot 5 + 3 \\cdot 7 - 13", "5 \\cdot 12 + (3 - 2) \\cdot 4 - 3 + 4 \\cdot 5 - 5"])
valores("operaciones combinadas", 2, S, "Realiza las siguientes operaciones:", [("4*(65+7)-5*2+4", "282"), ("2*(3+9)-(4+8)", "12"), ("(22-4)*5+3*2-1", "95"), ("5*4+(4-2)*5-3+4*6-5", "46")], "mv1", "cap. 2, ejercicios y problemas, ej. 16 (la fuente da 264 en el a: está mal)",
        enunciados=["4 \\cdot (65 + 7) - 5 \\cdot 2 + 4", "2 \\cdot (3 + 9) - (4 + 8)", "(22 - 4) \\cdot 5 + 3 \\cdot 2 - 1", "5 \\cdot 4 + (4 - 2) \\cdot 5 - 3 + 4 \\cdot 6 - 5"])
valores("operaciones combinadas", 1, S, "Calcula:", [("255+45*5", "480"), ("215+40/5", "223"), ("90-12*6", "18"), ("18*6-45/3+18", "111"), ("24*9+33/3-27", "200"), ("14*18-48/2-6", "222")], "edad1", "quincena 1, para practicar, ej. 9 y 10",
        enunciados=["255 + 45 \\cdot 5", "215 + 40 : 5", "90 - 12 \\cdot 6", "18 \\cdot 6 - 45 : 3 + 18", "24 \\cdot 9 + 33 : 3 - 27", "14 \\cdot 18 - 48 : 2 - 6"])
valores("operaciones combinadas", 2, S, "Calcula:", [("28*(24-16)*2", "448"), ("488*(88+32)/8", "7320"), ("87*(39-12)/3", "783"), ("16+6*(6+16*2)", "244"), ("240+24*(48+40*8)", "9072"), ("60+12*(28-20/4)", "336")], "edad1", "quincena 1, para practicar, ej. 11 y 12",
        enunciados=["28 \\cdot (24 - 16) \\cdot 2", "488 \\cdot (88 + 32) : 8", "87 \\cdot (39 - 12) : 3", "16 + 6 \\cdot (6 + 16 \\cdot 2)", "240 + 24 \\cdot (48 + 40 \\cdot 8)", "60 + 12 \\cdot (28 - 20 : 4)"])
P_ = "problema de números naturales"
calculo(P_, 1, S, "En un partido de baloncesto, un jugador de 2,05 m de altura ha encestado 12 canastas de dos puntos y 5 de tres puntos. ¿Cuántos puntos anotó?", [(None, "12*2+5*3", "39", None)], "12 · 2 + 5 · 3 = 39 puntos (la altura no hace falta)", "edad1", "quincena 1, para practicar, ej. 1")
calculo(P_, 1, ["A.2", "A.3"], "En el número 611, se cambia la cifra de las decenas por un 7, y se obtiene un nuevo número. ¿Cuál es la diferencia entre estos dos números?", [(None, "671-611", "60", None)], "671 − 611 = 60", "edad1", "quincena 1, para practicar, ej. 2")
calculo(P_, 1, S, "Mi padre tiene 36 años, mi madre 34 y yo 12. ¿Cuántos años tendrá mi madre cuando yo tenga 21 años?", [(None, "34+(21-12)", "43", None)], "Faltan 21 − 12 = 9 años: tendrá 34 + 9 = 43 años", "edad1", "quincena 1, para practicar, ej. 3")
problema(P_, 1, S, "Al restar de 91 un número se obtiene otro formado por dos cuatros. ¿Cuál fue el número restado?", "91-x = 44", ["47"], "91 − 44 = 47", "edad1", "quincena 1, para practicar, ej. 5")
calculo(P_, 1, S, "En mi casa hay 3 habitaciones. En cada habitación están 4 amigos y 2 gatos. Cada amigo tiene 5 €. ¿Cuántos euros tienen mis amigos?", [(None, "3*4*5", "60", None)], "3 · 4 = 12 amigos, 12 · 5 = 60 € (los gatos no cuentan)", "edad1", "quincena 1, para practicar, ej. 6")
calculo(P_, 2, S, "Mi hermano tiene 38 € y yo tengo 45. El precio de cada disco es 7 €. ¿Cuántos discos puedo comprar, como máximo, con mi dinero?", [(None, "floor(45/7)", "6", None)], "45 : 7 = 6, resto 3: 6 discos (el dinero del hermano no cuenta)", "edad1", "quincena 1, para practicar, ej. 7")
calculo(P_, 1, S, "Pepe tiene 37 años y conduce un autobús en el que están 11 viajeros. En la primera parada bajan 5 personas y suben 4. En la siguiente parada suben 8 y bajan 3. Con estas dos paradas, ¿cuántos viajeros están en el autobús?", [(None, "11-5+4+8-3", "15", None)], "11 − 5 + 4 + 8 − 3 = 15 viajeros", "edad1", "quincena 1, para practicar, ej. 8")
calculo(P_, 2, S, "Sabemos que para el viaje de fin de curso son necesarios 3 autobuses, ya que viajarán 103 alumnos. En los dos primeros autobuses viajan el mismo número de estudiantes y en el tercero un alumno más que en los otros dos. ¿Cuántas personas viajan en cada autobús?",
        [("cociente", "floor(103/3)", "34", None), ("resto", "103 % 3", "1", None)], "103 = 3 · 34 + 1: en los dos primeros van 34 y en el tercero 35", "mv1", "cap. 2, ejercicios y problemas, ej. 17")
ej("explicar un truco con álgebra", 3, ["A.3", "D.2"], "¡Magia! Sigue los siguientes pasos: 1) Piensa en dos números naturales de una cifra. 2) Multiplica el primero por 2 y súmale 8. 3) Multiplica el resultado anterior por 5. 4) Suma el segundo número que habías pensado al resultado anterior. 5) Resta 40 al último resultado. ¿Qué ocurre? ¿Es casualidad? ¿Pasará siempre lo mismo? ¿Puedes explicarlo?",
   comprobar=[{"tipo": "igualdad", "expresion": "(2*x+8)*5+y-40", "respuesta": "10*x+y"}],
   solucion="Sale un número de dos cifras: la primera es el primer número pensado y la segunda, el segundo. Si los números son x e y, $(2x + 8) \\cdot 5 + y - 40 = 10x + y$", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 18")
calculo("recuento", 2, ["A.1"], "Calcula cuántos cuadrados puedes contar en una cuadrícula de 3 × 3 casillas.", [(None, "9+4+1", "14", None)], "9 de 1 × 1, 4 de 2 × 2 y 1 de 3 × 3: en total 14 cuadrados", "mv1", "cap. 2, ejercicios y problemas, ej. 27 (adaptado: la figura, descrita con palabras)")
guarda(materia="matematicas", etapa="eso", curso=1, tema="numeros-naturales", titulo="Números naturales: sistema decimal y operaciones",
       saberes=["A.1", "A.2", "A.3", "D.2"], prefijo="m1-nat")
