import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]; SA = ["A.2"]


def pot(e):
    """"7^8*7^2" → "7^{8} \\cdot 7^{2}" (sin reordenar)."""
    return tex(e)


def sol_potencias():
    """La solución escrita como potencias (la generada las calcularía: 7^15 → 4747561509943)."""
    e = EJ[-1]
    e["solucion"] = "   ".join(f"{c['apartado']}) ${tex(c['respuesta'])}$" for c in e["comprobar"])


valores("calcular potencias", 1, S, "Calcula en tu cuaderno las siguientes potencias:",
        [("7^3", "343"), ("8^4", "4096"), ("5^5", "3125"), ("3^5", "243"), ("5^2", "25"), ("5^3", "125"), ("3^4", "81"), ("1^47", "1"), ("9^0", "1"), ("10^8", "100000000")],
        "mv1", "cap. 3, ejercicios y problemas, ej. 1")
valores("calcular potencias", 1, S, "Calcula en tu cuaderno las siguientes potencias:",
        [("3^5", "243"), ("7^4", "2401"), ("4^5", "1024"), ("9^4", "6561"), ("25^2", "625"), ("16^3", "4096")], "mv1", "cap. 3, ej. 2")
valores("potencias de base 0 y 1", 1, S, "Calcula mentalmente:", [("1^2689", "1"), ("0^9826", "0"), ("1927^0", "1"), ("0^1382", "0"), ("1^1000", "1"), ("1961^0", "1")], "mv1", "cap. 3, ej. 6")
ej("potencias de 10", 1, SA, "Busca los exponentes de las potencias siguientes: a) $10^{\\square} = 10\\,000$   b) $10^{\\square} = 10\\,000\\,000$   c) $10^{\\square} = 100$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "10^4", "respuesta": "10000"}, {"tipo": "valor", "apartado": "b", "expresion": "10^7", "respuesta": "10000000"}, {"tipo": "valor", "apartado": "c", "expresion": "10^2", "respuesta": "100"}],
   solucion="a) 4   b) 7   c) 2", fuente="mv1", ref="cap. 3, ej. 8")
ej("potencias de 10", 1, SA, "Expresa en forma polinómica usando potencias de 10: a) 12 345   b) 6 780 912   c) 500 391   d) 9 078 280",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "1*10^4+2*10^3+3*10^2+4*10+5", "respuesta": "12345"},
              {"tipo": "valor", "apartado": "b", "expresion": "6*10^6+7*10^5+8*10^4+9*10^2+1*10+2", "respuesta": "6780912"},
              {"tipo": "valor", "apartado": "c", "expresion": "5*10^5+3*10^2+9*10+1", "respuesta": "500391"},
              {"tipo": "valor", "apartado": "d", "expresion": "9*10^6+7*10^4+8*10^3+2*10^2+8*10", "respuesta": "9078280"}],
   solucion="a) $1 \\cdot 10^{4} + 2 \\cdot 10^{3} + 3 \\cdot 10^{2} + 4 \\cdot 10 + 5$   b) $6 \\cdot 10^{6} + 7 \\cdot 10^{5} + 8 \\cdot 10^{4} + 9 \\cdot 10^{2} + 1 \\cdot 10 + 2$   c) $5 \\cdot 10^{5} + 3 \\cdot 10^{2} + 9 \\cdot 10 + 1$   d) $9 \\cdot 10^{6} + 7 \\cdot 10^{4} + 8 \\cdot 10^{3} + 2 \\cdot 10^{2} + 8 \\cdot 10$",
   fuente="mv1", ref="cap. 3, ej. 9")
valores("potencias de 10", 1, SA, "Calcula:", [("4*10^5", "400000"), ("6*10^7", "60000000"), ("9*10^3", "9000"), ("56*10^4", "560000")], "mv1", "cap. 3, ej. 11")
ej("potencias de 10", 1, SA, "Expresa en forma de potencia en tu cuaderno: a) 100 000   b) 1 000 000   c) 10 000 000",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "10^5", "respuesta": "100000"}, {"tipo": "valor", "apartado": "b", "expresion": "10^6", "respuesta": "1000000"}, {"tipo": "valor", "apartado": "c", "expresion": "10^7", "respuesta": "10000000"}],
   solucion="a) $10^{5}$   b) $10^{6}$   c) $10^{7}$", fuente="mv1", ref="cap. 3, ejercicios y problemas, ej. 3")
valores("una sola potencia", 1, S, "Escribe en forma de una única potencia:", [("7^5*7^6*7^4", "7^15"), ("4^4*4^6*4^7", "4^17"), ("2^20*2^17", "2^37"), ("3^6*3^7*3^3", "3^16")], "mv1", "cap. 3, ej. 16",
        enunciados=[pot(e) for e in ("7^5*7^6*7^4", "4^4*4^6*4^7", "2^20*2^17", "3^6*3^7*3^3")])
sol_potencias()
valores("propiedades de las potencias", 1, S, "Escribe con una única potencia:", [("7^8*7^2", "7^10"), ("5^12/5^6", "5^6"), ("(2^7)^3", "2^21"), ("9^5*9^11", "9^16"), ("8^9/8^3", "8^6"), ("(3^10)^4", "3^40")], "edad1", "quincena 1, para practicar, ej. 13",
        enunciados=["7^{8} \\cdot 7^{2}", "5^{12} : 5^{6}", "(2^{7})^{3}", "9^{5} \\cdot 9^{11}", "8^{9} : 8^{3}", "(3^{10})^{4}"])
sol_potencias()
valores("potencia de un producto y de un cociente", 2, S, "Escribe con una única potencia:", [("2^7*5^7", "10^7"), ("10^6/5^6", "2^6"), ("6^5*5^5", "30^5"), ("9^8/3^8", "3^8")], "edad1", "quincena 1, para practicar, ej. 14",
        enunciados=["2^{7} \\cdot 5^{7}", "10^{6} : 5^{6}", "6^{5} \\cdot 5^{5}", "9^{8} : 3^{8}"])
sol_potencias()
valores("potencia de un producto y de un cociente", 1, S, "Calcula:", [("(2*5)^4", "10000"), ("(32/4)^3", "512")], "mv1", "cap. 3, ej. 14", enunciados=["(2 \\cdot 5)^{4}", "(32 : 4)^{3}"])
valores("potencia de un producto", 2, S, "Escribe en forma de una única potencia y calcula:", [("2^5*5^5", "10^5"), ("10^4*3^4", "30^4"), ("2^20*5^20", "10^20"), ("10^10*5^10", "50^10")], "mv1", "cap. 3, ej. 19",
        enunciados=["2^{5} \\cdot 5^{5}", "10^{4} \\cdot 3^{4}", "2^{20} \\cdot 5^{20}", "10^{10} \\cdot 5^{10}"])
EJ[-1]["solucion"] = "a) $10^{5} = 100\\,000$   b) $30^{4} = 810\\,000$   c) $10^{20}$   d) $50^{10}$"
valores("una sola potencia", 2, S, "Calcula utilizando la calculadora (escribe primero el resultado como una sola potencia):",
        [("53^3*53^2*53", "53^6"), ("71^3*71^2", "71^5"), ("3.2^2*3.2", "3.2^3"), ("82^3*82", "82^4")], "mv1", "cap. 3, ej. 20 (la fuente da $53^{4}$ en el a: está mal)",
        enunciados=["53^{3} \\cdot 53^{2} \\cdot 53", "71^{3} \\cdot 71^{2}", "3{,}2^{2} \\cdot 3{,}2", "82^{3} \\cdot 82"])
EJ[-1]["solucion"] = "a) $53^{6} = 22\\,164\\,361\\,129$ (la fuente da $53^{4}$, pero $3 + 2 + 1 = 6$)   b) $71^{5}$   c) $3{,}2^{3}$   d) $82^{4}$"
EJ[-1]["comprobar"][0]["respuesta"] = "22164361129"
valores("propiedades de las potencias", 3, S, "Efectúa las siguientes operaciones con potencias dando el resultado en forma de potencia de una sola base, la que creas más adecuada en cada caso:",
        [("(4^5*4^2)^3/16", "4^19"), ("1^3*3^3", "3^3"), ("(16^4/8^3)^4", "2^28"), ("(5^3/5^2)^3", "5^3"), ("((7^5*7^2)^2)^3", "7^42"), ("(27^2*9^2)^3", "3^30")], "mv1", "cap. 3, ejercicios y problemas, ej. 13 (la fuente da 9 en el e: está mal)",
        enunciados=["(4^{5} \\cdot 4^{2})^{3} : 16", "1^{3} \\cdot 3^{3}", "(16^{4} : 8^{3})^{4}", "(5^{3} : 5^{2})^{3}", "((7^{5} \\cdot 7^{2})^{2})^{3}", "(27^{2} \\cdot 9^{2})^{3}"])
sol_potencias()
valores("propiedades de las potencias", 3, S, "Efectúa las siguientes operaciones dando el resultado como una única potencia:",
        [("2^10*2^2*2^2", "2^14"), ("(5^10*25^2)^4", "5^56"), ("4^3*4^5*(4^5)^2", "4^18"), ("16^7/8^2", "2^22"), ("(16^7)^3/(8^2)^2", "2^72"), ("3^4*(3^2/3^5)", "3")], "mv1", "cap. 3, ejercicios y problemas, ej. 14",
        enunciados=["2^{10} \\cdot 2^{2} \\cdot 2^{2}", "(5^{10} \\cdot 25^{2})^{4}", "4^{3} \\cdot 4^{5} \\cdot (4^{5})^{2}", "16^{7} : 8^{2}", "(16^{7})^{3} : (8^{2})^{2}", "3^{4} \\cdot (3^{2} : 3^{5})"])
sol_potencias()
valores("simplificar con potencias", 2, S, "Simplifica y calcula en tu cuaderno:", [("(3*2^4*5^3)/(3*2^2*5^2)", "20"), ("(6^3*4^5*11^3)/(2^4*3*11^2)", "50688")], "mv1", "cap. 3, ejercicios y problemas, ej. 8 (la fuente da 1584 en el b: está mal)",
        enunciados=["(3 \\cdot 2^{4} \\cdot 5^{3}) : (3 \\cdot 2^{2} \\cdot 5^{2})", "(6^{3} \\cdot 4^{5} \\cdot 11^{3}) : (2^{4} \\cdot 3 \\cdot 11^{2})"])
EJ[-1]["solucion"] = "a) $2^{2} \\cdot 5 = 20$   b) $2^{9} \\cdot 3^{2} \\cdot 11 = 50688$ (la fuente da $11 \\cdot 2^{4} \\cdot 3^{2} = 1584$: está mal)"
valores("jerarquía con potencias", 2, S, "Calcula en tu cuaderno:", [("2+5^2+(14/2)+1^7", "35"), ("3+4^2+(12/6)+1^14", "22"), ("3^2+3^3+3^4+3^0", "118"), ("4^3+7*3^2", "127")], "mv1", "cap. 3, ejercicios y problemas, ej. 28",
        enunciados=["2 + 5^{2} + (14 : 2) + 1^{7}", "3 + 4^{2} + (12 : 6) + 1^{14}", "3^{2} + 3^{3} + 3^{4} + 3^{0}", "4^{3} + 7 \\cdot 3^{2}"])
valores("cuadrados con calculadora", 1, S, "Usa la calculadora (tecla $x^{2}$) para obtener:", [("13^2", "169"), ("43^2", "1849"), ("75^2", "5625"), ("82^2", "6724")], "mv1", "cap. 3, ejercicios y problemas, ej. 17")
ej("cuadrados y cubos", 1, S, "Indica cuáles de los siguientes números son cuadrados y cuáles son cubos: a) 1   b) 2   c) 4   d) 8   e) 16   f) 27   g) 1000",
   comprobar=[{"tipo": "valor", "apartado": "e", "expresion": "4^2", "respuesta": "16"}, {"tipo": "valor", "apartado": "f", "expresion": "3^3", "respuesta": "27"}, {"tipo": "valor", "apartado": "g", "expresion": "10^3", "respuesta": "1000"}],
   solucion="a) Cuadrado y cubo   b) ninguno   c) cuadrado   d) cubo   e) cuadrado ($16 = 4^{2}$; la fuente dice «nada»: está mal)   f) cubo   g) cubo", fuente="mv1", ref="cap. 3, ejercicios y problemas, ej. 19 (la fuente da mal el e)")
ej("cuadrados y cubos", 1, S, "Dibuja en un papel cuadriculado un cuadrado de lado igual a 2 cuadrados pequeños. ¿Cuántos cuadrados pequeños tiene? Dibuja también cuadrados de lados 3, 4 y 5 cuadrados pequeños e indica cuántos cuadrados pequeños tienen. Exprésalo en forma de potencias. Con cubitos se forman cubos mayores de lado 2, 3, 4 y 5. ¿Cuántos cubitos son necesarios en cada caso?",
   comprobar=[{"tipo": "valor", "apartado": "cuadrado 5", "expresion": "5^2", "respuesta": "25"}, {"tipo": "valor", "apartado": "cubo 5", "expresion": "5^3", "respuesta": "125"}],
   solucion="Cuadrados: $2^{2} = 4$, $3^{2} = 9$, $4^{2} = 16$, $5^{2} = 25$. Cubos: $2^{3} = 8$, $3^{3} = 27$, $4^{3} = 64$, $5^{3} = 125$", fuente="mv1", ref="cap. 3, ejercicios y problemas, ej. 11 y 12")
valores("raíces cuadradas exactas", 1, S, "Halla en tu cuaderno:", [("sqrt(4)", "2"), ("sqrt(25)", "5"), ("sqrt(81)", "9"), ("sqrt(9)", "3"), ("sqrt(64)", "8"), ("sqrt(16)", "4"), ("sqrt(225)", "15"), ("sqrt(100)", "10"), ("sqrt(121)", "11"), ("sqrt(289)", "17")], "mv1", "cap. 3, ejercicios y problemas, ej. 20 y 21 a, f")
valores("raíces cuadradas", 1, S, "Usa la calculadora para obtener las raíces cuadradas de 121, 144, 625 y 2025. Calcula mentalmente las raíces cuadradas de 100, 10 000 y 1 000 000.",
        [("sqrt(121)", "11"), ("sqrt(144)", "12"), ("sqrt(625)", "25"), ("sqrt(2025)", "45"), ("sqrt(100)", "10"), ("sqrt(10000)", "100"), ("sqrt(1000000)", "1000")], "mv1", "cap. 3, ejercicios y problemas, ej. 24 y 27")
ej("raíz cuadrada entera", 2, S, "a) Se quieren plantar árboles en un jardín de forma que llenen un cuadrado. Hay 26 árboles. ¿Cuántos árboles habrá en cada lado del cuadrado? ¿Sobrará algún árbol?   b) Escribe el número 111 entre los cuadrados de dos números consecutivos.",
   comprobar=[{"tipo": "valor", "apartado": "a lado", "expresion": "floor(sqrt(26))", "respuesta": "5"}, {"tipo": "valor", "apartado": "a sobran", "expresion": "26-5^2", "respuesta": "1"},
              {"tipo": "valor", "apartado": "b", "expresion": "floor(sqrt(111))", "respuesta": "10"}],
   solucion="a) 5 árboles por lado y sobra 1 ($5^{2} = 25$)   b) $10^{2} < 111 < 11^{2}$", fuente="mv1", ref="cap. 3, ejercicios y problemas, ej. 30 y 31")
calculo("patrones con cuadrados", 2, ["A.3", "D.1"], "Con 9 cuadrados hemos formado un cuadrado mayor de lado 3. ¿Cuántos cuadraditos debemos añadir para formar el siguiente cuadrado de lado 4? ¿Es 3 + 3 + 1? Y si ya tenemos el cuadrado de lado 4, ¿cuántos para formar el cuadrado de lado 5?",
        [("lado 4", "4^2-3^2", "7", None), ("lado 5", "5^2-4^2", "9", None)], "7 = 3 + 3 + 1, sí; para el de lado 5, 4 + 4 + 1 = 9", "mv1", "cap. 3, ejercicios y problemas, ej. 32")
P_ = "problema de potencias y raíces"
calculo(P_, 1, S, "En la pastelería quieren colocar en una caja cuadrada 196 bombones formando el mayor cuadrado posible, ¿cuántos bombones tendrá de lado? ¿Cuántos bombones se necesitan para formar el cuadrado que tenga un bombón más por lado?",
        [("lado", "sqrt(196)", "14", None), ("más", "15^2", "225", None)], "14 bombones de lado; con uno más por lado, $15^{2} = 225$", "mv1", "cap. 3, ejercicios y problemas, ej. 25")
calculo(P_, 1, S, "Una finca tiene forma cuadrada y mide 36 m de lado. Si el metro cuadrado se paga a 500 €, ¿cuánto vale la finca?", [(None, "36^2*500", "648000", None)], "$36^{2} \\cdot 500 = 648\\,000$ €", "mv1", "cap. 3, ejercicios y problemas, ej. 33")
calculo(P_, 2, S, "El suelo de una cocina es cuadrado y está formado por 121 losas cuadradas de 40 cm x 40 cm. Halla la medida del lado de la cocina y su área.",
        [("lado", "sqrt(121)*40", "440", None), ("área", "440^2", "193600", None)], "$\\sqrt{121} = 11$ losas por lado: 11 · 40 = 440 cm de lado; área $440^{2} = 193\\,600$ cm² = 19,36 m²", "mv1", "cap. 3, ejercicios y problemas, ej. 34")
calculo(P_, 1, S, "Preguntan la edad a una profesora de Matemáticas y contesta: «Mi edad se obtiene si del cubo de 3 se suma el cuadrado de 2». ¿Qué edad tiene?", [(None, "3^3+2^2", "31", None)], "$3^{3} + 2^{2} = 27 + 4 = 31$ años", "mv1", "cap. 3, ejercicios y problemas, ej. 35")
calculo(P_, 1, S, "Luis y Miriam tienen canicas. Luis tiene 8 elevado al cuadrado. Miriam tiene 2 elevado a la sexta potencia. ¿Quién tiene más canicas?", [("Luis", "8^2", "64", None), ("Miriam", "2^6", "64", None)], "Luis $8^{2} = 64$ y Miriam $2^{6} = 64$: tienen las mismas", "mv1", "cap. 3, ejercicios y problemas, ej. 37")
calculo(P_, 1, ["A.1", "A.3"], "En un restaurante se puede elegir entre cuatro primeros platos, cuatro segundos y cuatro postres. ¿Cuántos menús distintos pueden hacerse?", [(None, "4^3", "64", None)], "$4 \\cdot 4 \\cdot 4 = 4^{3} = 64$ menús distintos", "mv1", "cap. 3, ejercicios y problemas, ej. 38")
calculo(P_, 1, S, "En un envase de un supermercado hay 16 cajas de batidos de chocolate, y cada caja tiene 8 batidos de 200 centímetros cúbicos. Expresa el número total de batidos de cada envase en forma de potencia de 2.", [(None, "2^4*2^3", "128", None)], "$2^{4} \\cdot 2^{3} = 2^{7} = 128$ batidos", "mv1", "cap. 3, ejercicios y problemas, ej. 16")
guarda(materia="matematicas", etapa="eso", curso=1, tema="potencias-y-raices", titulo="Potencias y raíces cuadradas",
       saberes=["A.1", "A.2", "A.3", "D.1"], prefijo="m1-pot")
