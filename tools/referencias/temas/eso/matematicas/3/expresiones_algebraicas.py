import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
# Aragón (3.º, D.4): equivalencia de expresiones algebraicas (operaciones, identidades notables,
# factor común). La división larga, la regla de Ruffini y las fracciones algebraicas de Marea
# Verde no entran: Aragón no las pone en 3.º.
S = ["D.4"]
ej("lenguaje algebraico", 1, ["D.2", "D.3"], "Reescribe, en lenguaje algebraico, los siguientes enunciados, referidos a dos números cualesquiera $x$ e $y$: a) El triple de su diferencia   b) La suma de sus cuadrados   c) El cuadrado de su suma   d) El inverso de su producto   e) La suma de sus opuestos   f) El producto de sus cuadrados",
   solucion="a) $3(x-y)$   b) $x^{2}+y^{2}$   c) $(x+y)^{2}$   d) $\\frac{1}{xy}$   e) $-x-y$   f) $x^{2}y^{2}$", fuente="mv3", ref="cap. 4, act. 3")
ej("lenguaje algebraico", 1, ["D.2", "D.3"], "Escribe las expresiones algebraicas que nos proporcionan la longitud de una circunferencia y el área de un trapecio.",
   solucion="$L = 2\\pi r$; $A = \\frac{(B+b)h}{2}$", fuente="mv3", ref="cap. 4, act. 2")
expresiones("lenguaje algebraico", 1, ["D.2", "D.3", "A.5"], "Una tienda de ropa anuncia en sus escaparates que está de rebajas y que todos sus artículos están rebajados un 30 % sobre el precio impreso en cada etiqueta. Escribe lo que pagaremos por una prenda en función de lo que aparece en su etiqueta ($p$):",
            [("p-30/100*p", "0.7*p")], "mv3", "cap. 4, act. 4")
valores("valor numérico", 1, ["D.3", "D.4"], "Calcula el valor numérico de las siguientes expresiones algebraicas para los valores que se indican:", [
    ("-3*(-2)^2+4/(-2)-5", "-19"), ("3*(1/2)+(1/3+1/2)/(2-(1/2)^3)+(1/3)*(1/2)^2-1", "37/36"), ("2^2+2*2-7", "1"), ("(3+(-2))^2-(3^2+(-2)^2)", "-12"), ("1^2+3*1+7", "11")],
    "mv3", "cap. 4, act. 5 y 7",
    enunciados=["-3x^{2}+\\frac{4}{x}-5 \\text{ para } x = -2", "3b+\\frac{a+b}{2-b^{3}}+a b^{2}-1 \\text{ para } a = \\frac{1}{3},\\ b = \\frac{1}{2}", "x^{2}+2x-7 \\text{ para } x = 2",
                "(a+b)^{2}-(a^{2}+b^{2}) \\text{ para } a = 3,\\ b = -2", "c^{2}+3c+7 \\text{ para } c = 1"])
valores("valor numérico", 1, ["D.3", "D.4"], "Considera el polinomio $p(x) = x^{3}-3x+2$. Halla los siguientes valores numéricos de $p$:", [
    ("0^3-3*0+2", "2"), ("1^3-3*1+2", "0"), ("(-1)^3-3*(-1)+2", "4"), ("(-2)^3-3*(-2)+2", "0"), ("(1/2)^3-3*(1/2)+2", "5/8")], "mv3", "cap. 4, act. 10",
    enunciados=["p(0)", "p(1)", "p(-1)", "p(-2)", "p\\left(\\frac{1}{2}\\right)"])
valores("valor numérico", 2, ["D.3", "D.4"], "Halla el valor numérico de las siguientes expresiones en los números que se indican:", [
    ("(1-3)/(1+1)", "-1"), ("(-2)/((-2)^2-2*(-2)+1)", "-2/9"), ("(3+(-1)-2)/(3^2+3*(-1)^2)", "0"), ("(-2*(-1)+0^2-4)/((-1)^2*2-3*(-1)*0*2)", "-1")], "mv3", "cap. 4, ejercicios y problemas 6",
    enunciados=["\\frac{x-3}{x+1} \\text{ en } x = 1", "\\frac{x}{x^{2}-2x+1} \\text{ para } x = -2", "\\frac{x+y-2}{x^{2}+3y^{2}} \\text{ en } x = 3 \\text{ e } y = -1", "\\frac{-2a+b^{2}-4}{a^{2}c-3abc} \\text{ para } a = -1,\\ b = 0 \\text{ y } c = 2"])
ej("monomios y polinomios", 1, ["D.3", "D.4"], "a) En cada uno de los siguientes monomios señala su coeficiente, su parte literal y su grado: $-12x^{3}$;  $a^{4}b^{3}c$;  $4xy^{2}$.   b) Para cada uno de los siguientes polinomios destaca su grado y los monomios que lo constituyen: $5x^{4}+7x^{2}-x$;  $6x^{2}+10-2x^{3}$;  $2xy^{3}-x^{5}+7x^{2}y^{2}$.",
   solucion="a) $-12x^{3}$: coeficiente $-12$, parte literal $x^{3}$, grado 3; $a^{4}b^{3}c$: coeficiente 1, parte literal $a^{4}b^{3}c$, grado 8; $4xy^{2}$: coeficiente 4, parte literal $xy^{2}$, grado 3.   b) Grado 4: $5x^{4}, 7x^{2}, -x$; grado 3: $-2x^{3}, 6x^{2}, 10$; grado 5: $-x^{5}, 7x^{2}y^{2}, 2xy^{3}$", fuente="mv3", ref="cap. 4, act. 8 y 9")
expresiones("suma y resta de polinomios", 1, S, "Realiza las siguientes sumas y diferencias de polinomios:", [
    ("(-x^3+x-5)+(2*x^2+5*x+4)+(-4*x^3-2*x^2+3*x)", "-5*x^3+9*x-1"), ("(x^2+4)+(-2*x+4)+(-6*x^3+3*x^2+x+1)-x^2", "-6*x^3+3*x^2-x+9"),
    ("(5*x^2+2)-(-2*x)", "5*x^2+2*x+2"), ("(-2*x^3+4*x)-(-2*x-1)", "-2*x^3+6*x+1"), ("(7*x^2-2*x)-(3*x^3+4*x^2-x+1)", "-3*x^3+3*x^2-x-1")], "mv3", "cap. 4, act. 11 y 16 (en c) la fuente da 5x² + 2x + x: errata)")
calculo("suma de polinomios", 1, S, "Considera los polinomios $p = x^{2}-x+1$, $q = -x^{3}+2x-3$, así como el polinomio suma $s = p+q$. Halla los valores que adopta cada uno de ellos para $x = -2$, es decir, calcula $p(-2)$, $q(-2)$ y $s(-2)$. Estudia si existe alguna relación entre esos tres valores.",
        [("p(−2)", "(-2)^2-(-2)+1", "7", None), ("q(−2)", "-(-2)^3+2*(-2)-3", "1", None), ("s(−2)", "-(-2)^3+(-2)^2+(-2)-2", "8", None)],
        "$p(-2) = 7$; $q(-2) = 1$; $s(-2) = 8 = p(-2)+q(-2)$ ($s = -x^{3}+x^{2}+x-2$)", "mv3", "cap. 4, act. 13")
expresiones("producto de polinomios", 2, S, "Efectúa los siguientes productos de polinomios:", [
    ("(-2*x)*(3*x^2-4)", "-6*x^3+8*x"), ("(2*x^3+1)*(-4*x+5)", "-8*x^4+10*x^3-4*x+5"), ("(4*x^3-x^2-1)*(2*x+6)", "8*x^4+22*x^3-6*x^2-2*x-6"),
    ("(a-2)*(4-3*a)", "-3*a^2+10*a-8"), ("(3*a-b^2)*(2*b-a^2)", "a^2*b^2-3*a^3-2*b^3+6*a*b")], "mv3", "cap. 4, act. 15 y 18")
expresiones("producto de polinomios", 2, S, "Realiza los siguientes productos de polinomios:", [
    ("x*(-3*x^2+4*x+2)*x^2", "-3*x^5+4*x^4+2*x^3"), ("(-2*x+1)*(5*x^2-x+3)*(-x)", "10*x^4-7*x^3+7*x^2-3*x"), ("(3*a-1)*(2-a)*(5-4*a)", "12*a^3-43*a^2+43*a-10")], "mv3", "cap. 4, act. 19")
expresiones("producto de polinomios", 2, S, "Efectúa los siguientes productos:", [
    ("(3*x^2+5*x-6)*(8*x^2-3*x+4)", "24*x^4+31*x^3-51*x^2+38*x-24"), ("(5*x^3-4*x^2+x-2)*(x^3-7*x^2+3)", "5*x^6-39*x^5+29*x^4+6*x^3+2*x^2+3*x-6"),
    ("(a*b^2+a^2*b+a*b)*(a*b-a*b^2)", "a^3*b^2+a^2*b^2-a^2*b^4-a^3*b^3"), ("(x^2*y^2-2*x*y)*(2*x*y+4)", "2*x^3*y^3-8*x*y")], "ag3", "polinomios, ficha 7 (repaso), ej. 7 (a, b, d, f)")
expresiones("producto de polinomios", 3, S, "Calcula los productos:", [
    ("(3*a*x/2-y/5)*(-b*y/3)", "(-15*a*b*x*y+2*b*y^2)/30"), ("(0.1*x+0.2*y-0.3*z)*(0.3*x-0.2*y+0.1*z)", "0.03*x^2-0.04*y^2-0.03*z^2+0.04*x*y-0.08*x*z+0.08*y*z"),
    ("(x-y)*(y-1)*(x+a)", "x^2*y+x*y*a-x^2-x*a-y^2*x+y*x-y^2*a+y*a")], "mv3", "cap. 4, ejercicios y problemas 10 (en c) la fuente omite el término xy: errata)")
expresiones("operaciones combinadas con polinomios", 2, S, "Realiza las siguientes operaciones combinadas de polinomios:", [
    ("(x^3+2)*((4*x^2+2)-(2*x^2+x+1))", "2*x^5-x^4+x^3+4*x^2-2*x+2"), ("(4*x+3)*(2*x-5)-(6*x^2-10*x-12)", "2*x^2-4*x-3"), ("(x^2-3)*(x+1)-(x^2+5)*(x-2)", "3*x^2-8*x+7"),
    ("(2*x^2+x-2)*(x^2-3*x+2)-(5*x^3-3*x^2+4)", "2*x^4-10*x^3+2*x^2+8*x-8"), ("2*x^2+x-2-(x^2-3*x+2)*(5*x^3-3*x^2+4)", "-5*x^5+18*x^4-19*x^3+4*x^2+13*x-10")], "ag3", "polinomios, ficha 3, ej. 4 (a, b, c, e, g)")
ej("operaciones con polinomios", 2, S, "Considera los polinomios $p(x) = 2x^{3}-x^{2}+4x-1$, $q(x) = -x^{4}-3x^{3}+2x^{2}-x-5$ y $r(x) = x^{2}-3x+2$. Haz las siguientes operaciones: a) $p+q+r$   b) $p-q$   c) $p \\cdot r$   d) $p \\cdot r-q$",
   comprobar=[{"tipo": "igualdad", "apartado": "a", "expresion": "(2*x^3-x^2+4*x-1)+(-x^4-3*x^3+2*x^2-x-5)+(x^2-3*x+2)", "respuesta": "-x^4-x^3+2*x^2-4"},
              {"tipo": "igualdad", "apartado": "b", "expresion": "(2*x^3-x^2+4*x-1)-(-x^4-3*x^3+2*x^2-x-5)", "respuesta": "x^4+5*x^3-3*x^2+5*x+4"},
              {"tipo": "igualdad", "apartado": "c", "expresion": "(2*x^3-x^2+4*x-1)*(x^2-3*x+2)", "respuesta": "2*x^5-7*x^4+11*x^3-15*x^2+11*x-2"},
              {"tipo": "igualdad", "apartado": "d", "expresion": "(2*x^3-x^2+4*x-1)*(x^2-3*x+2)-(-x^4-3*x^3+2*x^2-x-5)", "respuesta": "2*x^5-6*x^4+14*x^3-17*x^2+12*x+3"}],
   fuente="mv3", ref="cap. 4, ejercicios y problemas 9")
expresiones("factor común", 1, S, "De cada uno de los siguientes polinomios extrae algún factor que sea común a sus monomios:", [
    ("-10*x^3-15*x^2+20*x", "5*x*(-2*x^2-3*x+4)"), ("30*x^4+24*x^2", "6*x^2*(5*x^2+4)")], "mv3", "cap. 4, act. 20")
expresiones("factor común", 2, S, "Extrae el máximo factor común posible:", [
    ("6*x^2-2*x+4*x^3", "2*x*(3*x-1+2*x^2)"), ("-2*x*(x-3)^2+4*x^2*(x-3)", "2*x*(x-3)*(x+3)"), ("2*x^3+4*x^2-8*x", "2*x*(x^2+2*x-4)")], "ag3", "polinomios, ficha 7 (repaso), ej. 6 (a, d, g)")
expresiones("identidades notables", 1, S, "Desarrolla las siguientes expresiones utilizando la identidad notable correspondiente, y simplifica:", [
    ("(x+2)^2", "x^2+4*x+4"), ("(x-3)^2", "x^2-6*x+9"), ("(x+4)*(x-4)", "x^2-16"), ("(2*x+3)^2", "4*x^2+12*x+9"), ("(3*x-2)^2", "9*x^2-12*x+4"),
    ("(2*x+1)*(2*x-1)", "4*x^2-1"), ("(4*b+2)^2", "16*b^2+16*b+4"), ("(5*b-3)^2", "25*b^2-30*b+9")], "ag3", "polinomios, ficha 5, ej. 1 (4, 5, 6, 13, 14, 15, 19 y 20)")
expresiones("identidades notables", 2, S, "Desarrolla las siguientes potencias:", [
    ("(3*x-y)^2", "9*x^2-6*x*y+y^2"), ("(2*a+x/2)^2", "4*a^2+2*a*x+x^2/4"), ("(4*y-2/y)^2", "16*y^2-16+4/y^2"), ("(5*a+a^2)^2", "25*a^2+10*a^3+a^4"),
    ("(-a^2+2*b^2)^2", "a^4-4*a^2*b^2+4*b^4"), ("((2/3)*y-1/y)^2", "(4/9)*y^2-4/3+1/y^2")], "mv3", "cap. 4, act. 33")
expresiones("identidades notables", 2, S, "Realiza los cálculos:", [
    ("(1+x)^2", "1+2*x+x^2"), ("(-x+2)^2", "x^2-4*x+4"), ("(2*a-3)^2", "4*a^2-12*a+9"), ("(x^2+1)^3", "x^6+3*x^4+3*x^2+1"), ("(2*b-4)^3", "8*b^3-48*b^2+96*b-64")],
    "mv3", "cap. 4, act. 31 (en f) la fuente da 24b en vez de 96b: errata)")
expresiones("identidades notables", 1, S, "Efectúa estos productos:", [
    ("(3*x+2)*(3*x-2)", "9*x^2-4"), ("(2*x+4*y)*(2*x-4*y)", "4*x^2-16*y^2"), ("(4*x^2+3)*(4*x^2-3)", "16*x^4-9"), ("(3*a-5*b)*(3*a+5*b)", "9*a^2-25*b^2"), ("(-x^2+5*x)*(x^2+5*x)", "-x^4+25*x^2")],
    "mv3", "cap. 4, act. 35")
expresiones("factorizar con identidades notables", 2, S, "Expresa como cuadrado de una suma o de una diferencia, o como suma por diferencia, las siguientes expresiones algebraicas:", [
    ("a^2-6*a+9", "(a-3)^2"), ("4*x^2+4*x+1", "(2*x+1)^2"), ("4*y^2-12*y+9", "(2*y-3)^2"), ("y^4+6*x*y^2+9*x^2", "(y^2+3*x)^2"),
    ("9*x^2-25", "(3*x-5)*(3*x+5)"), ("4*a^4-81*b^2", "(2*a^2+9*b)*(2*a^2-9*b)"), ("49-25*x^2", "(7-5*x)*(7+5*x)")], "mv3", "cap. 4, act. 34 (a, b, d, f) y 36 (a, b, c)")
expresiones("identidades notables", 3, S, "Opera y simplifica:", [
    ("(3*x+2)*(x^2+3*x-2)-(3*x+2)*(3*x-2)", "3*x^3+2*x^2"), ("(3*x+2)^2+(3*x-2)^2", "18*x^2+8"), ("(2*x-5)^2-(2*x^2-5*x+3)*(2*x^2-1)", "-4*x^4+10*x^3-25*x+28")],
    "ag3", "polinomios, ficha 5 (l, m, n)")
expresiones("potencias de polinomios", 3, S, "Calcula las potencias:", [
    ("(x+2*y-z)^2", "x^2+4*y^2+z^2+4*x*y-2*x*z-4*y*z"), ("(x-3*y)^3", "x^3-9*x^2*y+27*x*y^2-27*y^3"), ("(a+b/3)^2", "a^2+(2/3)*a*b+(1/9)*b^2"), ("(x^2-2*z^3)^2", "x^4-4*x^2*z^3+4*z^6")],
    "mv3", "cap. 4, ejercicios y problemas 15")
expresiones("división por un monomio", 2, S, "Calcula los siguientes cocientes:", [
    ("(2*x^3-8*x^2+6*x)/(2*x)", "x^2-4*x+3"), ("(5*a^3+60*a^2-20)/5", "a^3+12*a^2-4"), ("(16*x^3+40*x^2)/(8*x^2)", "2*x+5"), ("(6*x^2*y^3-4*x*y^2)/(x*y^2)", "6*x*y-4"), ("(4*x^3*y^3*z^4)/(3*x^2*y*z^2)", "(4/3)*x*y^2*z^2")],
    "mv3", "cap. 4, act. 40 y ejercicios y problemas 12b")
ej("truco algebraico", 3, ["D.2", "D.3", "D.4"], "Vamos a adivinar el número que resulta tras manipular repetidamente un número desconocido. Convierte en una expresión algebraica las sucesivas alteraciones del número desconocido y justifica lo que ocurre: 1) Dile a un compañero que escriba en un papel un número par y que no lo muestre. 2) Que lo multiplique por 5. 3) Que al resultado anterior le sume 5. 4) Que multiplique por 2 lo obtenido. 5) Que al resultado anterior le sume 10. 6) Que multiplique por 5 lo obtenido. 7) Que divida entre 100 la última cantidad. 8) Que al resultado precedente le reste la mitad del número que escribió. 9) Independientemente del número desconocido original, ¿qué número ha surgido?",
   comprobar=[{"tipo": "igualdad", "expresion": "((2*n*5+5)*2+10)*5/100-n", "respuesta": "1"}],
   solucion="Con el número par $2n$: $\\frac{[(10n+5) \\cdot 2+10] \\cdot 5}{100}-n = \\frac{100n+100}{100}-n = 1$. Siempre sale 1. La fuente escribe «−10» en el paso 5 y obtiene 0, pero el enunciado dice «le sume 10»", fuente="mv3", ref="cap. 4, ejercicios y problemas 2 (la fuente resta 10 en vez de sumarlo y da 0)")
guarda(materia="matematicas", etapa="eso", curso=3, tema="expresiones-algebraicas", titulo="Expresiones algebraicas y polinomios: operaciones e identidades notables",
       saberes=["D.2", "D.3", "D.4", "A.5"], prefijo="m3-pol")
