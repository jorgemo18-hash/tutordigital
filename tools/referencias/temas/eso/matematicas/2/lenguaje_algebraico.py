import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S2 = ["D.2"]; S3 = ["D.3", "D.4"]
ej("traducir al lenguaje algebraico", 1, S2, "Expresa en lenguaje algebraico:\n\na) El triple de un número más su mitad.   b) La edad de una persona dentro de 10 años.   c) La sexta parte de un número menos su cuadrado.   d) La diferencia entre dos números consecutivos.",
   solucion="a) $3x + \\frac{x}{2}$   b) $x + 10$   c) $\\frac{x}{6} - x^{2}$   d) $(x + 1) - x = 1$", fuente="mv2", ref="cap. 10, act. 1")
ej("traducir al lenguaje algebraico", 1, S2, "Si llamamos $x$ a la edad de Luis, expresa algebraicamente:\n\na) Lola tiene la edad que Luis tenía hace 11 años.   b) Jordi tiene la edad que Luis tendrá dentro de 2 años.   c) Los años que faltan para que Luis cumpla 30.   d) Carmen tiene la mitad de la edad de Luis.",
   solucion="a) $x - 11$   b) $x + 2$   c) $30 - x$   d) $\\frac{x}{2}$", fuente="mv2", ref="cap. 10, ej. 1")
ej("traducir al lenguaje algebraico", 1, S2, "En una granja hay un número desconocido de ovejas. Indica en lenguaje algebraico el número de patas y de orejas que hay.",
   solucion="Si hay $x$ ovejas: $4x$ patas y $2x$ orejas", fuente="mv2", ref="cap. 10, ej. 2")
ej("traducir al lenguaje algebraico", 2, S2, "Escribe con expresiones algebraicas: Raquel tiene $x$ cromos; Pepe tiene 10 más que Raquel; Teresa tiene el triple que Pepe; Carmela tiene tantos como Raquel y Pepe juntos; Marta tiene la mitad que Teresa.",
   solucion="Raquel $x$; Pepe $x + 10$; Teresa $3(x + 10)$; Carmela $2x + 10$; Marta $\\frac{3(x + 10)}{2}$", fuente="mv2", ref="cap. 10, ej. 4")
ej("relacionar enunciado y expresión", 1, S2, "Relaciona cada enunciado con su expresión: a) sumar 9 al triple de un número; b) restar 7 a la mitad de un número; c) el triple de un número más el doble del siguiente; d) lo que nos devuelven si pagamos una compra con 20 €; e) el perímetro de un octógono regular; f) la edad de alguien hace 3 años.\n\n1) $3x + 2(x + 1)$   2) $3x + 9$   3) $8x$   4) $\\frac{x}{2} - 7$   5) $x - 3$   6) $20 - x$",
   solucion="a-2, b-4, c-1, d-6, e-3, f-5", fuente="mv2", ref="cap. 10, ej. 5")
ej("el mago adivina", 2, S2, "Un mago propone: piensa un número, súmale 7, multiplica el resultado por 2, réstale 10 y réstale el número. Adela dice 9 y el mago contesta que pensó 5. ¿Cómo lo supo?",
   comprobar=[{"tipo": "igualdad", "expresion": "2*(x+7)-10-x", "respuesta": "x+4"}], solucion="La cuenta es $2(x + 7) - 10 - x = x + 4$: el mago resta 4 a lo que le dicen ($9 - 4 = 5$)", fuente="mv2", ref="cap. 10, act. 2")
ej("el mago adivina", 2, S2, "Piensa un número, multiplícalo por 10, réstale el número que has pensado y divide el resultado entre 9. ¡Has obtenido el número que pensaste! Escribe la expresión y explica el truco.",
   comprobar=[{"tipo": "igualdad", "expresion": "(10*x-x)/9", "respuesta": "x"}], solucion="$\\frac{10x - x}{9} = \\frac{9x}{9} = x$", fuente="mv2", ref="cap. 10, act. 20")
valores("valor numérico", 1, ["D.3"], "Calcula el valor numérico:", [("6*3+4*2", "26"), ("2-3*(-5)", "17"), ("5*(-1)+9*(-1)-7*2", "-28")], "mv2", "cap. 10, act. 5",
        enunciados=["6x + 4y \\text{ para } x = 3,\\ y = 2", "2 - 3a \\text{ para } a = -5", "5a + 9b - 7c \\text{ para } a = -1,\\ b = -1,\\ c = 2"])
valores("valor numérico", 1, ["D.3"], "Halla $y$ para el valor de $x$ indicado:", [("0.5+3*3", "9.5"), ("1.6*0.75", "1.2"), ("4+1.5*2.1", "7.15")], "mv2", "cap. 10, ej. 6",
        enunciados=["y = 0{,}5 + 3x \\text{ para } x = 3", "y = 1{,}6x \\text{ para } x = 0{,}75", "y = 4 + 1{,}5x \\text{ para } x = 2{,}1"])
valores("valor numérico de un polinomio", 2, ["D.3"], "Dado $p(x) = 3x^{6} + 7x^{2} - x$, halla $p(0)$, $p(1)$, $p(-1)$ y $p(2)$.", [("3*0**6+7*0**2-0", "0"), ("3+7-1", "9"), ("3*(-1)**6+7*(-1)**2-(-1)", "11"), ("3*2**6+7*2**2-2", "218")], "mv2", "cap. 10, act. 7",
        enunciados=["p(0)", "p(1)", "p(-1)", "p(2)"])
expresiones("reducir términos semejantes", 1, S3, "Simplifica:", [("3*a^2*b-2*a^2*b+7*a^2*b", "8*a^2*b"), ("5*x*y+7*x*y-2*x*y", "10*x*y"), ("6*x+9*x-3*x", "12*x"), ("3*a*b+8*a*b-6*a*b", "5*a*b")], "mv2", "cap. 10, ej. 7")
expresiones("operar y reducir", 2, S3, "Realiza las operaciones:", [("3*x+5*x-2*y+9*y-4*x-3*y", "4*x+4*y"), ("(2*x-5*x^2)-(3*x^2+5*x)", "-8*x^2-3*x"), ("3*(7*x-3)-2*(2*x+5)", "17*x-19"), ("2*a-5*a+7*a-8*a+b", "-4*a+b")], "mv2", "cap. 10, ej. 8")
expresiones("suma de polinomios", 2, S3, "Realiza las sumas:", [("(-x^3+x-5)+(2*x^2+5*x+4)+(-4*x^3-2*x^2+3*x)", "-5*x^3+9*x-1"), ("(x^2+4)+(-2*x+4)+(-6*x^3+3*x^2+x+1)-x^2", "-6*x^3+3*x^2-x+9")], "mv2", "cap. 10, act. 8")
expresiones("producto de polinomios", 3, S3, "Efectúa los productos:", [("(-2*x)*(3*x^2-4)", "-6*x^3+8*x"), ("(2*x^3+1)*(-4*x+5)", "-8*x^4+10*x^3-4*x+5"), ("(4*x^3-x^2-1)*(2*x+6)", "8*x^4+22*x^3-6*x^2-2*x-6"), ("(-1)*(8*x^2+7*x-9)", "-8*x^2-7*x+9")], "mv2", "cap. 10, act. 9")
ej("coeficiente y parte literal", 1, ["D.3"], "Señala el coeficiente, la parte literal y el número de términos de:\n\na) $3 - 14xy$   b) $2a + 6b - 9c$   c) $6xy + 8$   d) $2xy + 6 - 4y$",
   solucion="a) 2 términos: $3$ y $-14xy$ (coef. $-14$, parte literal $xy$)   b) 3 términos, coef. 2, 6 y $-9$; partes literales $a$, $b$, $c$   c) 2 términos: $6xy$ y $8$   d) 3 términos: $2xy$, $6$ y $-4y$", fuente="mv2", ref="cap. 10, act. 4")
ej("grado de un polinomio", 1, ["D.3"], "Indica el grado y los monomios de: a) $3x^{6} + 7x^{2} - x$   b) $7x^{3} + 8x^{5} - 6x^{2}$   c) $3xy^{6} + 7xy^{2} - 2xy$",
   solucion="a) grado 6   b) grado 5   c) grado 7", fuente="mv2", ref="cap. 10, act. 6")
guarda(materia="matematicas", etapa="eso", curso=2, tema="lenguaje-algebraico", titulo="Lenguaje algebraico y expresiones",
       saberes=["D.2", "D.3", "D.4"], prefijo="m2-alg")
