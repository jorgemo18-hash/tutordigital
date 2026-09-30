import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.4"]
def mm(a, b):
    from sympy import ilcm, igcd
    return ilcm(a, b), igcd(a, b)
pares = [(4, 8), (2, 3), (3, 12), (7, 10), (6, 12), (6, 9), (10, 15), (2, 5), (4, 6), (4, 1), (3, 7)]
ej("m.c.m. y M.C.D. mental", 1, S, "Calcula mentalmente el m.c.m. y el M.C.D.:\n\n" + "   ".join(f"{'abcdefghijk'[i]}) {a} y {b}" for i, (a, b) in enumerate(pares)),
   comprobar=[c for i, (a, b) in enumerate(pares) for c in (
       {"tipo": "valor", "apartado": "abcdefghijk"[i], "expresion": f"lcm({a},{b})", "respuesta": str(mm(a, b)[0])},
       {"tipo": "valor", "apartado": "abcdefghijk"[i], "expresion": f"gcd({a},{b})", "respuesta": str(mm(a, b)[1])})],
   solucion="; ".join(f"{'abcdefghijk'[i]}) m.c.m. {mm(a, b)[0]}, M.C.D. {mm(a, b)[1]}" for i, (a, b) in enumerate(pares)), fuente="mv2", ref="cap. 4, ej. 9")
pares = [(8, 40), (15, 35), (84, 360)]
ej("m.c.m. y M.C.D.", 2, S, "Calcula el m.c.m. y el M.C.D. de: a) 8 y 40   b) 15 y 35   c) 84 y 360",
   comprobar=[c for i, (a, b) in enumerate(pares) for c in (
       {"tipo": "valor", "apartado": "abc"[i], "expresion": f"lcm({a},{b})", "respuesta": str(mm(a, b)[0])},
       {"tipo": "valor", "apartado": "abc"[i], "expresion": f"gcd({a},{b})", "respuesta": str(mm(a, b)[1])})],
   solucion="; ".join(f"{'abc'[i]}) m.c.m. {mm(a, b)[0]}, M.C.D. {mm(a, b)[1]}" for i, (a, b) in enumerate(pares)), fuente="mv2", ref="cap. 4, ej. 10")
ej("m.c.m. y M.C.D. factorizados", 2, S, "Calcula el m.c.m. y el M.C.D. sin calcular los números:\n\na) $m = 2 \\cdot 2 \\cdot 2 \\cdot 3$, $n = 2 \\cdot 3 \\cdot 3 \\cdot 5$   b) $m = 3 \\cdot 5$, $n = 2 \\cdot 7$   c) $m = 2^{2} \\cdot 3 \\cdot 5^{2}$, $n = 2^{2} \\cdot 3^{2}$   d) $m = 3 \\cdot 5 \\cdot 7^{2}$, $n = 2 \\cdot 5^{2} \\cdot 7$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "lcm(24,90)", "respuesta": "360"}, {"tipo": "valor", "apartado": "a", "expresion": "gcd(24,90)", "respuesta": "6"},
              {"tipo": "valor", "apartado": "b", "expresion": "lcm(15,14)", "respuesta": "210"}, {"tipo": "valor", "apartado": "b", "expresion": "gcd(15,14)", "respuesta": "1"},
              {"tipo": "valor", "apartado": "c", "expresion": "lcm(300,36)", "respuesta": "900"}, {"tipo": "valor", "apartado": "c", "expresion": "gcd(300,36)", "respuesta": "12"},
              {"tipo": "valor", "apartado": "d", "expresion": "lcm(735,350)", "respuesta": "7350"}, {"tipo": "valor", "apartado": "d", "expresion": "gcd(735,350)", "respuesta": "35"}],
   solucion="a) m.c.m. $2^{3} \\cdot 3^{2} \\cdot 5 = 360$, M.C.D. $2 \\cdot 3 = 6$   b) m.c.m. 210, M.C.D. 1   c) m.c.m. $2^{2} \\cdot 3^{2} \\cdot 5^{2} = 900$, M.C.D. $2^{2} \\cdot 3 = 12$   d) m.c.m. $2 \\cdot 3 \\cdot 5^{2} \\cdot 7^{2} = 7350$, M.C.D. $5 \\cdot 7 = 35$", fuente="mv2", ref="cap. 4, ej. 7")
ej("divisores", 1, S, "Busca todos los divisores de 210.", comprobar=[{"tipo": "valor", "expresion": "divisor_count(210)", "respuesta": "16"}],
   solucion="1, 2, 3, 5, 6, 7, 10, 14, 15, 21, 30, 35, 42, 70, 105 y 210 (16 divisores)", fuente="mv2", ref="cap. 4, ej. 5")
ej("criterios de divisibilidad", 1, S, "Sustituye $A$ por una cifra para que: a) $24A75$ sea múltiplo de 5   b) $1107A$ sea múltiplo de 3   c) $5A439$ sea múltiplo de 6",
   solucion="a) Cualquier cifra (acaba en 5)   b) $A = 0$, 3, 6 o 9   c) Imposible: acaba en 9, es impar y no puede ser múltiplo de 6", fuente="mv2", ref="cap. 4, ej. 3")
ej("criterios de divisibilidad", 2, S, "¿Verdadero o falso? 30 087 es divisible por 3; 78 344 es divisible por 6; 87 300 es múltiplo de 11; 2 985 644 es múltiplo de 4; 1 es divisor de 13; 98 es divisor de 3.",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "30087 % 3", "respuesta": "0"}, {"tipo": "valor", "apartado": "b", "expresion": "78344 % 6", "respuesta": "2"},
              {"tipo": "valor", "apartado": "c", "expresion": "87300 % 11", "respuesta": "4"}, {"tipo": "valor", "apartado": "d", "expresion": "2985644 % 4", "respuesta": "0"}],
   solucion="V, F, F, V, V, F", fuente="mv2", ref="cap. 4, ej. 6")
P_ = "problema de m.c.m. o M.C.D."
ej(P_, 2, S, "Un artesano tiene 32 piedras de coral, 88 de turquesa, 56 perlas y 66 de azabache. Quiere hacer el mayor número posible de collares iguales usándolas todas. ¿Cuántos puede hacer?",
   comprobar=[{"tipo": "valor", "expresion": "gcd(gcd(32,88),gcd(56,66))", "respuesta": "2"}], solucion="2 collares (M.C.D. = 2)", fuente="mv2", ref="cap. 4, ej. 13")
ej(P_, 2, S, "El ordenador de Lucía pasa el antivirus cada 180 minutos y se actualiza cada 240. ¿Cada cuántos minutos hace las dos cosas a la vez?",
   comprobar=[{"tipo": "valor", "expresion": "lcm(180,240)", "respuesta": "720"}], solucion="Cada 720 minutos (12 horas)", fuente="mv2", ref="cap. 4, ej. 14")
ej(P_, 2, S, "En una carretera hay un teléfono de emergencia cada 10 km, un pozo cada 15 km y una gasolinera cada 20 km. ¿Cada cuánto coinciden los tres?",
   comprobar=[{"tipo": "valor", "expresion": "lcm(lcm(10,15),20)", "respuesta": "60"}], solucion="Cada 60 km", fuente="mv2", ref="cap. 4, ej. 15")
ej(P_, 2, S, "Sonia tiene 12 gorritos, 6 collares, 18 anillos y 36 caramelos, y quiere hacer bolsas iguales con todo. ¿Para cuántos amigos le alcanza? ¿Qué lleva cada bolsa?",
   comprobar=[{"tipo": "valor", "expresion": "gcd(gcd(12,6),gcd(18,36))", "respuesta": "6"}], solucion="6 bolsas: 2 gorritos, 1 collar, 3 anillos y 6 caramelos cada una", fuente="mv2", ref="cap. 4, ej. 16")
ej(P_, 3, S, "Tres farolas se encienden cada 12, 18 y 60 segundos. A las 18:30 coinciden encendidas. ¿Cuántas veces coincidirán en los 5 minutos siguientes?",
   comprobar=[{"tipo": "valor", "expresion": "lcm(lcm(12,18),60)", "respuesta": "180"}, {"tipo": "valor", "expresion": "floor(300/180)", "respuesta": "1"}], solucion="Coinciden cada 180 s: 1 vez (a las 18:33)", fuente="mv2", ref="cap. 4, ej. 11")
ej("números primos", 2, S, "Comprueba si 2047 es primo probando los divisores primos menores que su raíz cuadrada.",
   comprobar=[{"tipo": "valor", "expresion": "23*89", "respuesta": "2047"}], solucion="No es primo: $2047 = 23 \\cdot 89$", fuente="mv2", ref="cap. 4, ej. 18")
guarda(materia="matematicas", etapa="eso", curso=2, tema="divisibilidad", titulo="Divisibilidad: múltiplos, divisores, m.c.m. y M.C.D.",
       saberes=["A.4"], prefijo="m2-div")
