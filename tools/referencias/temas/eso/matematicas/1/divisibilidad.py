import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.4"]
L_ = "abcdefghijklmnopqrstuvwxyz"


def multiplos(nums, d):
    """Los que la fuente da como múltiplos de d: el resto tiene que ser 0."""
    return [{"tipo": "valor", "apartado": str(n), "expresion": f"{n} % {d}", "respuesta": "0"} for n in nums]


def v(ap, e, r):
    c = {"tipo": "valor", "expresion": e, "respuesta": str(r)}
    if ap: c["apartado"] = ap
    return c


ej("múltiplos", 1, S, "¿Cuáles de los siguientes números son múltiplos de 12? 12, 13, 22, 24, 25, 100, 112, 142, 144",
   comprobar=multiplos([12, 24, 144], 12), solucion="12, 24 y 144", fuente="mv1", ref="cap. 2, ej. 11")
ej("múltiplos", 1, S, "Halla los múltiplos de 11 comprendidos entre 12 y 90.",
   comprobar=multiplos([22, 33, 44, 55, 66, 77, 88], 11), solucion="22, 33, 44, 55, 66, 77, 88", fuente="mv1", ref="cap. 2, ej. 12")
ej("múltiplo, divisor, divisible", 1, S, "Completa con las expresiones «ser múltiplo de», «ser divisor de» o «ser divisible por»: a) 40 es … 10.   b) 2 es … 10.   c) 4 es … 8.   d) 935 es … 11.   e) 90 es … 45.   f) 3 es … 15.",
   comprobar=[v("a", "40 % 10", 0), v("d", "935 % 11", 0), v("e", "90 % 45", 0)],
   solucion="a) múltiplo de   b) divisor de   c) divisor de   d) múltiplo de   e) múltiplo de (o divisible por)   f) divisor de", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 30")
ej("criterios de divisibilidad", 1, S, "Di cuáles de los siguientes números son múltiplos de 2: 23, 24, 56, 77, 89, 90, 234, 621, 400, 4520, 3411, 46295, 16392, 385500. Los números elegidos, ¿coinciden con los divisores de 2? ¿Y con los que son divisibles por 2?",
   comprobar=multiplos([24, 56, 90, 234, 400, 4520, 16392, 385500], 2),
   solucion="Múltiplos de 2: 24, 56, 90, 234, 400, 4520, 16392, 385500. No coinciden con los divisores de 2 (solo 1 y 2); sí con los divisibles por 2", fuente="mv1", ref="cap. 2, ej. 15")
ej("criterios de divisibilidad", 2, S, "Di cuáles de los siguientes números son múltiplos de 5. ¿Y de 10? ¿Cuáles coinciden? ¿Por qué? 23, 24, 56, 77, 89, 90, 234, 621, 400, 4520, 3411, 46295, 16392, 385500",
   comprobar=multiplos([90, 400, 4520, 46295, 385500], 5) + [v(f"{n} (10)", f"{n} % 10", 0) for n in (90, 400, 4520, 385500)],
   solucion="Múltiplos de 5: 90, 400, 4520, 46295, 385500. Múltiplos de 10: 90, 400, 4520, 385500. Todos los múltiplos de 10 lo son de 5, pero no al revés (46295 acaba en 5)", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 22")
ej("criterios de divisibilidad", 2, S, "Sustituye A por un valor apropiado para que: a) 24A75 sea múltiplo de 3.   b) 1107A sea múltiplo de 6.   c) 5A439 sea múltiplo de 11.",
   comprobar=[v("a A=0", "24075 % 3", 0), v("a A=3", "24375 % 3", 0), v("a A=6", "24675 % 3", 0), v("a A=9", "24975 % 3", 0),
              v("b A=0", "11070 % 6", 0), v("b A=6", "11076 % 6", 0), v("c A=4", "54439 % 11", 0)],
   solucion="a) A = 0, 3, 6 o 9   b) A = 0 o A = 6 (la fuente solo da 6, pero 11070 también es múltiplo de 6)   c) A = 4", fuente="mv1", ref="cap. 2, ej. 17 (a la solución de la fuente le falta A = 0 en el b)")
ej("criterios de divisibilidad", 2, S, "¿Todos los números divisibles por 3 lo son por 9? ¿Y al revés? Razona la respuesta.",
   solucion="No: 6 es divisible por 3 pero no por 9. Al revés, sí: 3 es un factor de 9, así que si un número es divisible por 9 lo es por 3", fuente="mv1", ref="cap. 2, ej. 18")
ej("criterios de divisibilidad", 2, S, "¿Sabrías deducir un criterio de divisibilidad por 15? Pon un ejemplo.",
   solucion="Un número es múltiplo de 15 si lo es de 3 y de 5: si acaba en 0 o en 5 y la suma de sus cifras es múltiplo de 3. Por ejemplo, 345", fuente="mv1", ref="cap. 2, ej. 19")
ej("criterios de divisibilidad", 2, S, "Escribe verdadero o falso: 2567 es divisible por 2; 498650 es divisible por 5; 98370034 es divisible por 3; 78337650 es divisible por 6; 984486728 es divisible por 4; 23009845 es divisible por 11.",
   comprobar=[v("b", "498650 % 5", 0), v("d", "78337650 % 6", 0), v("e", "984486728 % 4", 0)],
   solucion="Falso, verdadero, falso, verdadero, verdadero, falso", fuente="mv1", ref="cap. 2, ej. 20 (adaptado: la tabla, en texto)")
ej("criterios de divisibilidad", 2, S, "Escribe verdadero o falso: 327 es divisible por 11; 494530 es divisible por 4; 39470034 es divisible por 6; 7855650 es divisible por 3; 985555328 es divisible por 2; 20000045 es divisible por 10.",
   comprobar=[v("c", "39470034 % 6", 0), v("d", "7855650 % 3", 0), v("e", "985555328 % 2", 0)],
   solucion="Falso, falso, verdadero, verdadero, verdadero, falso", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 24 (adaptado: la tabla, en texto)")
ej("criterios de divisibilidad", 3, S, "Sustituye x e y por valores apropiados para que el número 256x81y sea divisible por 9 y por 10 a la vez.",
   comprobar=[v(None, "2565810 % 90", 0)], solucion="y = 0 (para ser divisible por 10) y x = 5 (2 + 5 + 6 + x + 8 + 1 = 22 + x tiene que ser múltiplo de 9): 2565810", fuente="mv1", ref="cap. 2, ej. 23")
ej("criterios de divisibilidad", 3, S, "Sustituye x e y por valores apropiados para que el número 256x81y sea divisible por 2 y por 11 a la vez.",
   comprobar=[v(str(n), f"{n} % 22", 0) for n in (2561812, 2563814, 2565816, 2567818)], solucion="2561812, 2563814, 2565816, 2567818", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 28")
ej("criterios de divisibilidad", 2, S, "¿Qué único número con tres cifras iguales es divisible por 2 y por 9 a la vez?",
   comprobar=[v(None, "666 % 18", 0)], solucion="666", fuente="mv1", ref="cap. 2, ej. 24")
ej("divisores", 1, S, "Calcula todos los divisores de los siguientes números: a) 65   b) 33   c) 60   d) 75   e) 100   f) 150",
   comprobar=[v(L_[i], f"divisor_count({n})", k) for i, (n, k) in enumerate([(65, 4), (33, 4), (60, 12), (75, 6), (100, 9), (150, 12)])],
   solucion="a) 1, 5, 13, 65   b) 1, 3, 11, 33   c) 1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60   d) 1, 3, 5, 15, 25, 75   e) 1, 2, 4, 5, 10, 20, 25, 50, 100   f) 1, 2, 3, 5, 6, 10, 15, 25, 30, 50, 75, 150",
   fuente="mv1", ref="cap. 2, ej. 25")
ej("número de divisores", 2, S, "La descomposición en factores primos de 15000 es $2^{3} \\cdot 3 \\cdot 5^{4}$. ¿Cuántos divisores tiene? (Se aumenta en uno cada exponente y se multiplican.)",
   comprobar=[v("factorización", "2^3*3*5^4", 15000), v("divisores", "divisor_count(15000)", 40)], solucion="Exponentes 3, 1 y 4: $4 \\cdot 2 \\cdot 5 = 40$ divisores", fuente="edad1", ref="quincena 2, para practicar, ej. 5")
ej("número de divisores", 2, S, "¿Cuántos divisores tiene el número 810?",
   comprobar=[v("factorización", "2*3^4*5", 810), v("divisores", "divisor_count(810)", 20)], solucion="$810 = 2 \\cdot 3^{4} \\cdot 5$: $2 \\cdot 5 \\cdot 2 = 20$ divisores", fuente="edad1", ref="quincena 2, para practicar, ej. 6")
ej("divisores", 2, S, "Halla los divisores de 6728. ($6728 = 2^{3} \\cdot 29^{2}$; calcula primero el número de divisores, resultará más fácil.)",
   comprobar=[v("factorización", "2^3*29^2", 6728), v("divisores", "divisor_count(6728)", 12)],
   solucion="$4 \\cdot 3 = 12$ divisores: 1, 2, 4, 8, 29, 58, 116, 232, 841, 1682, 3364, 6728. (La fuente da bien el número, 12, pero la lista que escribe es la de 22707 = $3^{3} \\cdot 29^{2}$: está mal.)",
   fuente="edad1", ref="quincena 2, para practicar, ej. 7 (la lista de divisores de la fuente está mal)")
ej("números primos", 2, S, "Decide razonadamente si 247 es primo o no. (Los posibles primos que pueden dividir a 247 son los menores que $\\sqrt{247}$: 2, 3, 5, 7, 11, 13.) ¿Y 131?",
   comprobar=[v("247", "247 % 13", 0), v("131", "divisor_count(131)", 2)], solucion="247 = 13 · 19: es compuesto. 131 no es divisible por 2, 3, 5, 7 ni 11: es primo", fuente="edad1", ref="quincena 2, para practicar, ej. 9 y 10")
ej("números primos", 2, S, "¿Te atreverías a repetir la criba de Eratóstenes, pero hasta el 150?",
   solucion="2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149", fuente="mv1", ref="cap. 2, ej. 28")
ej("factorización", 1, S, "Descompón en factores primos los siguientes números: a) 40   b) 56   c) 75   d) 90   e) 110   f) 124   g) 290   h) 366",
   comprobar=[v(L_[i], e, n) for i, (e, n) in enumerate([("2^3*5", 40), ("2^3*7", 56), ("5^2*3", 75), ("2*3^2*5", 90), ("2*5*11", 110), ("2^2*31", 124), ("2*5*29", 290), ("2*3*61", 366)])],
   solucion="a) $2^{3} \\cdot 5$   b) $2^{3} \\cdot 7$   c) $3 \\cdot 5^{2}$   d) $2 \\cdot 3^{2} \\cdot 5$   e) $2 \\cdot 5 \\cdot 11$   f) $2^{2} \\cdot 31$   g) $2 \\cdot 5 \\cdot 29$   h) $2 \\cdot 3 \\cdot 61$", fuente="mv1", ref="cap. 2, ej. 30 y 31")
ej("factorización", 2, S, "Descompón en factores primos los siguientes números: a) 1290   b) 3855   c) 4520   d) 5342   e) 1530   f) 2457   g) 7440",
   comprobar=[v(L_[i], e, n) for i, (e, n) in enumerate([("2*3*5*43", 1290), ("3*5*257", 3855), ("2^3*5*113", 4520), ("2*2671", 5342), ("2*3^2*5*17", 1530), ("3^3*7*13", 2457), ("2^4*3*5*31", 7440)])],
   solucion="a) $2 \\cdot 3 \\cdot 5 \\cdot 43$   b) $3 \\cdot 5 \\cdot 257$   c) $2^{3} \\cdot 5 \\cdot 113$   d) $2 \\cdot 2671$   e) $2 \\cdot 3^{2} \\cdot 5 \\cdot 17$   f) $3^{3} \\cdot 7 \\cdot 13$   g) $2^{4} \\cdot 3 \\cdot 5 \\cdot 31$", fuente="mv1", ref="cap. 2, ej. 32 y ejercicios y problemas, ej. 31")
ej("factorización", 2, S, "Averigua cuáles son los números cuyas descomposiciones factoriales son: a) $x = 2^{3} \\cdot 3^{2} \\cdot 7$   b) $y = 5^{2} \\cdot 2^{2} \\cdot 11$   c) $z = 2 \\cdot 5^{2} \\cdot 7$",
   comprobar=[v("a", "2^3*3^2*7", 504), v("b", "5^2*2^2*11", 1100), v("c", "2*5^2*7", 350)], solucion="a) 504   b) 1100   c) 350", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 33")
ej("M.C.D.", 1, S, "Calcula el M.C.D. de: a) 60 y 45   b) 120 y 55   c) 34 y 66   d) 320 y 80   e) 30, 12 y 22   f) 66, 45 y 10   g) 75, 15 y 20   h) 82, 44 y 16",
   comprobar=[v(L_[i], e, r) for i, (e, r) in enumerate([("gcd(60,45)", 15), ("gcd(120,55)", 5), ("gcd(34,66)", 2), ("gcd(320,80)", 80), ("gcd(gcd(30,12),22)", 2), ("gcd(gcd(66,45),10)", 1), ("gcd(gcd(75,15),20)", 5), ("gcd(gcd(82,44),16)", 2)])],
   solucion="a) 15   b) 5   c) 2   d) 80   e) 2   f) 1 (la fuente da 3, pero 10 no es múltiplo de 3)   g) 5   h) 2", fuente="mv1", ref="cap. 2, ej. 35 y 36 (la fuente da 3 en el f: está mal)")
ej("m.c.m.", 2, S, "Calcula el m.c.m. de: a) 60 y 45   b) 120 y 55   c) 34 y 66   d) 320 y 80   e) 30, 12 y 22   f) 66, 45 y 10   g) 75, 15 y 20   h) 82, 44 y 16",
   comprobar=[v(L_[i], e, r) for i, (e, r) in enumerate([("lcm(60,45)", "2^2*3^2*5"), ("lcm(120,55)", "2^3*3*5*11"), ("lcm(34,66)", "2*3*11*17"), ("lcm(320,80)", "2^6*5"), ("lcm(lcm(30,12),22)", "2^2*3*5*11"), ("lcm(lcm(66,45),10)", "2*3^2*5*11"), ("lcm(lcm(75,15),20)", "2^2*3*5^2"), ("lcm(lcm(82,44),16)", "2^4*11*41")])],
   solucion="a) $2^{2} \\cdot 3^{2} \\cdot 5 = 180$   b) $2^{3} \\cdot 3 \\cdot 5 \\cdot 11 = 1320$   c) $2 \\cdot 3 \\cdot 11 \\cdot 17 = 1122$   d) $2^{6} \\cdot 5 = 320$   e) $2^{2} \\cdot 3 \\cdot 5 \\cdot 11 = 660$   f) $2 \\cdot 3^{2} \\cdot 5 \\cdot 11 = 990$   g) $2^{2} \\cdot 3 \\cdot 5^{2} = 300$   h) $2^{4} \\cdot 11 \\cdot 41 = 7216$",
   fuente="mv1", ref="cap. 2, ej. 37 y 38")
ej("m.c.m. y M.C.D.", 2, S, "Calcula el m.c.m. y el M.C.D. de los siguientes números: a) 24, 60 y 80   b) 60, 84 y 132   c) 270, 315 y 360   d) 240, 270 y 36",
   comprobar=[c for i, (a, b, cc, m, d) in enumerate([(24, 60, 80, 240, 4), (60, 84, 132, 4620, 12), (270, 315, 360, 7560, 45), (240, 270, 36, 2160, 6)])
              for c in (v(L_[i] + " m.c.m.", f"lcm(lcm({a},{b}),{cc})", m), v(L_[i] + " M.C.D.", f"gcd(gcd({a},{b}),{cc})", d))],
   solucion="a) m.c.m. $2^{4} \\cdot 3 \\cdot 5 = 240$; M.C.D. 4   b) m.c.m. 4620; M.C.D. 12   c) m.c.m. 7560; M.C.D. 45   d) m.c.m. 2160; M.C.D. 6", fuente="mv1", ref="cap. 2, ejercicios y problemas, ej. 36")
ej("m.c.m. y M.C.D.", 2, S, "Halla el mínimo común múltiplo de: a) 72, 60   b) 150, 90   c) 9, 24, 6   d) 36, 15, 4. Halla el máximo común divisor de: e) 72, 24   f) 56, 81   g) 84, 108, 36   h) 54, 60, 18. (Es conveniente que primero hagas la descomposición factorial de esos números.)",
   comprobar=[v(L_[i], e, r) for i, (e, r) in enumerate([("lcm(72,60)", 360), ("lcm(150,90)", 450), ("lcm(lcm(9,24),6)", 72), ("lcm(lcm(36,15),4)", 180),
                                                          ("gcd(72,24)", 24), ("gcd(56,81)", 1), ("gcd(gcd(84,108),36)", 12), ("gcd(gcd(54,60),18)", 6)])],
   solucion="a) 360   b) 450   c) 72   d) 180   e) 24   f) 1 (primos entre sí)   g) 12   h) 6", fuente="edad1", ref="quincena 2, para practicar, ej. 11 y 12")
P_ = "problema de m.c.m. o M.C.D."
calculo(P_, 2, S, "María y Paula tienen 25 cuentas blancas, 15 cuentas azules y 90 cuentas rojas. Quieren hacer el mayor número de collares iguales sin que sobre ninguna cuenta. a) ¿Cuántos collares iguales pueden hacer? b) ¿Qué número de cuentas de cada color tendrá cada collar?",
        [("a", "gcd(gcd(25,15),90)", "5", None), ("b", "(25+15+90)/5", "26", None)], "a) M.C.D.(25, 15, 90) = 5 collares.   b) 26 cuentas en cada collar: 5 blancas, 3 azules y 18 rojas", "mv1", "cap. 2, ej. 39")
calculo(P_, 2, S, "Un autobús pasa por una parada cada 18 minutos, otro cada 25 minutos y un tercer autobús cada 36 minutos. Si a las 9 de la mañana han pasado en ese lugar los tres autobuses a la vez, ¿a qué hora vuelven a coincidir?",
        [(None, "lcm(lcm(18,25),36)", "900", None)], "m.c.m.(18, 25, 36) = 900 minutos = 15 horas: vuelven a coincidir a las 24:00, es decir, a las 12 de la noche", "mv1", "cap. 2, ej. 40")
calculo(P_, 1, S, "Se compran en una floristería 24 rosas y 36 claveles. ¿Cuántos centros de mesa se pueden elaborar si se coloca la máxima cantidad de flores sin que sobre ninguna? ¿Cuántas rosas y claveles se colocan en cada centro de mesa?",
        [("centros", "gcd(24,36)", "12", None), ("rosas", "24/12", "2", None), ("claveles", "36/12", "3", None)], "M.C.D.(24, 36) = 12 centros de mesa, con 2 rosas y 3 claveles cada uno", "mv1", "cap. 2, ej. 41")
calculo(P_, 2, S, "Raúl tiene varios avisos en su móvil: uno que da una señal cada 60 minutos, otro que da una señal cada 150 minutos y un tercero que da una señal cada 360 minutos. Si a las 10 de la mañana las 3 señales de aviso han coincidido: a) ¿Cuántas horas como mínimo han de pasar para que vuelvan a coincidir? b) ¿A qué hora volverán a dar la señal otra vez juntos?",
        [("a", "lcm(lcm(60,150),360)/60", "30", None)], "a) m.c.m.(60, 150, 360) = 1800 minutos = 30 horas.   b) 30 horas = 1 día y 6 horas: al día siguiente a las 16 horas", "mv1", "cap. 2, ej. 42")
calculo(P_, 2, S, "¿Cuál será la menor cantidad de caramelos que se puede repartir en partes iguales entre grupos de 20, 30 o 60 niños? Determina en cada caso cuántos caramelos les toca a cada niño.",
        [("caramelos", "lcm(lcm(20,30),60)", "60", None)], "m.c.m.(20, 30, 60) = 60 caramelos: a cada niño le tocan 3, 2 o 1", "mv1", "cap. 2, ej. 43")
calculo(P_, 2, S, "María y Jorge tienen 30 bolas blancas, 27 azules y 42 rojas y quieren hacer el mayor número posible de hileras iguales. ¿Cuántas hileras pueden hacer?",
        [(None, "gcd(gcd(30,27),42)", "3", None)], "M.C.D.(30, 27, 42) = 3 hileras", "edad1", "quincena 2, para practicar, ej. 14")
calculo(P_, 2, S, "Un ebanista quiere cortar una plancha de 10 dm de largo y 6 de ancho, en cuadrados lo más grandes posibles y cuyo lado sea un número entero de decímetros. ¿Cuál debe ser la longitud del lado?",
        [(None, "gcd(10,6)", "2", None)], "M.C.D.(10, 6) = 2 dm", "edad1", "quincena 2, para practicar, ej. 15")
calculo(P_, 3, S, "Pedro tiene una forma muy peculiar de dar el teléfono a sus amigos: les dice que consta de nueve cifras, que no se repite ninguna y que, leyéndolo de izquierda a derecha, se cumple: la primera cifra es un múltiplo de 3 mayor que 6; las dos primeras cifras forman un múltiplo de 2 y de 5; las tres primeras cifras forman un número par múltiplo de 3; las cuatro primeras cifras forman un número que es múltiplo de 5 pero no de 2; las cinco primeras cifras forman un número múltiplo de 2 y de 3; las seis primeras cifras forman un número múltiplo de 11; la séptima cifra es un múltiplo de 7; las ocho primeras cifras forman un número impar; las cuatro últimas cifras forman un múltiplo de 11. ¿Sabrías averiguar cuál es su teléfono?",
        [("2 primeras", "90 % 10", "0", None), ("3 primeras", "906 % 6", "0", None), ("5 primeras", "90654 % 6", "0", None), ("6 primeras", "906543 % 11", "0", None), ("4 últimas", "3718 % 11", "0", None)],
        "906 543 718", "mv1", "cap. 2, ejercicios y problemas, ej. 26")
guarda(materia="matematicas", etapa="eso", curso=1, tema="divisibilidad", titulo="Divisibilidad: múltiplos, divisores, primos, m.c.m. y M.C.D.",
       saberes=["A.4"], prefijo="m1-div")
