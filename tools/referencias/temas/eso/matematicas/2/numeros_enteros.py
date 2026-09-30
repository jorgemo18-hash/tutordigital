import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]
valores("jerarquía de operaciones", 1, S, "Realiza las operaciones:", [("(34+52)*5", "430"), ("89*2+12", "190"), ("55+67*3+13", "269"), ("280-110*2+90", "150")], "mv2", "cap. 2, ej. 1",
        enunciados=["(34 + 52) \\cdot 5", "89 \\cdot 2 + 12", "55 + 67 \\cdot 3 + 13", "280 - 110 \\cdot 2 + 90"])
valores("jerarquía de operaciones", 2, S, "Realiza las operaciones:", [("23*6+(35-13)/11-4*7", "112"), ("48/4*8/2-(3*12)/6", "42"), ("357-23*7+280/14", "216"), ("20*9-11*7+265/53", "108")], "mv2", "cap. 2, ej. 4",
        enunciados=["23 \\cdot 6 + (35 - 13) : 11 - 4 \\cdot 7", "48 : 4 \\cdot 8 : 2 - (3 \\cdot 12) : 6", "357 - 23 \\cdot 7 + 280 : 14", "20 \\cdot 9 - 11 \\cdot 7 + 265 : 53"])
valores("sumas y restas con paréntesis", 1, S, "Efectúa:", [("6-(8+10-1-2)", "-9"), ("7+(2-8-1)-(8-1+6)", "-13"), ("(10-2-7)-(1-9-16)", "25"), ("-(9-6-8)-(-7-10+2)", "20")], "mv2", "cap. 2, ej. 5")
valores("paréntesis y corchetes", 2, S, "Quita paréntesis y efectúa:", [("15+(2-8-(10-3))", "2"), ("7-((5-8)-(6-12))", "4"), ("(5-14)-(2-(2-4-3))", "-16"), ("(1-11+6)-((3-2)-(4-16))", "-17"), ("(8-(4-16))-(10-(5-12))", "3")], "mv2", "cap. 2, ej. 6",
        enunciados=["15 + [2 - 8 - (10 - 3)]", "7 - [(5 - 8) - (6 - 12)]", "(5 - 14) - [2 - (2 - 4 - 3)]", "(1 - 11 + 6) - [(3 - 2) - (4 - 16)]", "[8 - (4 - 16)] - [10 - (5 - 12)]"])
valores("regla de los signos", 1, S, "Aplica la regla de los signos:", [("4*8", "32"), ("(-11)*(-5)", "55"), ("12*(-6)", "-72"), ("(-11)*(-10)", "110"), ("16/4", "4"), ("(-12)/6", "-2"), ("24/(-3)", "-8"), ("(-81)/(-9)", "9"), ("(-63)/7", "-9"), ("(-30)/(-10)", "3")], "mv2", "cap. 2, ej. 7",
        enunciados=["(+4) \\cdot (+8)", "(-11) \\cdot (-5)", "(+12) \\cdot (-6)", "(-11) \\cdot (-10)", "(+16) : (+4)", "(-12) : (+6)", "(+24) : (-3)", "(-81) : (-9)", "(-63) : (+7)", "(-30) : (-10)"])
valores("posición de los paréntesis", 2, S, "Efectúa y compara cómo cambia el resultado según los paréntesis:", [("18-7*3", "-3"), ("(18-7)*3", "33"), ("(-12)-4*(-8)", "20"), ("((-12)-4)*(-8)", "128"), ("(-5)*7+(-3)", "-38"), ("(-5)*(7+(-3))", "-20")], "mv2", "cap. 2, ej. 8",
        enunciados=["18 - 7 \\cdot 3", "(18 - 7) \\cdot 3", "(-12) - 4 \\cdot (-8)", "[(-12) - 4] \\cdot (-8)", "(-5) \\cdot (+7) + (-3)", "(-5) \\cdot [(+7) + (-3)]"])
ej("ordenar, opuesto y valor absoluto", 1, ["A.2", "A.4"], "Ordena de mayor a menor y halla el opuesto y el valor absoluto de: $-5,\\ 7,\\ -3,\\ 0,\\ -6,\\ 1,\\ 2$",
   solucion="$7 > 2 > 1 > 0 > -3 > -5 > -6$. Opuestos: $5, -7, 3, 0, 6, -1, -2$. Valores absolutos: $5, 7, 3, 0, 6, 1, 2$", fuente="mv2", ref="cap. 2, ej. 9")
P_ = "problema de enteros"
problema(P_, 1, ["A.2", "A.3"], "¿De qué planta ha salido un ascensor que, después de subir 7 pisos, llega al piso 4?", "x+7 = 4", ["-3"], "Del sótano 3 (planta $-3$)", "mv2", "cap. 2, ej. 11")
problema(P_, 1, ["A.2", "A.3"], "Jaime ha empezado un negocio y de momento pierde 100 € cada día. Comparado con su situación actual, ¿cuál era su situación hace 5 días?", "x = 5*100", ["500"], "Tenía 500 € más que ahora", "mv2", "cap. 2, ej. 12")
problema(P_, 2, ["A.2", "A.3"], "¿A qué edad se casó una persona que nació en el año 9 antes de Cristo y se casó en el año 19 después de Cristo? (No existe el año 0.)", "x = 19+9-1", ["27"], "27 años", "mv2", "cap. 2, ej. 14")
problema(P_, 1, ["A.2", "A.3"], "Hace una hora el termómetro marcaba $-5$ °C y ahora marca $5$ °C. ¿Ha subido o bajado la temperatura? ¿Cuánto?", "x = 5-(-5)", ["10"], "Ha subido 10 °C", "mv2", "cap. 2, ej. 17")
problema(P_, 1, ["A.2", "A.3"], "Por la mañana un termómetro marcaba 7 grados bajo cero y la temperatura baja 12 °C a lo largo de la mañana. ¿Qué marca al mediodía?", "x = -7-12", ["-19"], "$-19$ °C", "mv2", "cap. 2, ej. 18")
problema(P_, 1, ["A.2", "A.3"], "¿A qué planta llega un ascensor que estaba en el sótano 2 y sube 7 pisos?", "x = -2+7", ["5"], "A la planta 5", "mv2", "cap. 2, ej. 19")
problema(P_, 2, ["A.2", "A.3"], "Antonio tenía 15 € el lunes por la mañana. Lunes: le devuelven 10 €. Martes: vende sellos por 5 €. Miércoles: compra cromos por 3 €. Jueves: se toma un helado de 1 €. ¿Cuánto tiene al final? ¿Cuánto ha variado su dinero?", "x = 15+10+5-3-1", ["26"], "26 €: ha aumentado 11 €", "mv2", "cap. 2, ej. 10")
problema(P_, 3, ["A.3", "D.2"], "El diablo le promete a un hombre duplicarle el dinero cada vez que cruce un puente, a cambio de darle 24 € al otro lado. Tras cruzar tres veces, al pagar los 24 € se queda sin nada. ¿Cuánto dinero tenía al principio?", "2*(2*(2*x-24)-24)-24 = 0", ["21"], "21 €", "mv2", "cap. 2, ej. 21")
guarda(materia="matematicas", etapa="eso", curso=2, tema="numeros-enteros", titulo="Números enteros y operaciones",
       saberes=["A.2", "A.3", "A.4"], prefijo="m2-ent")
