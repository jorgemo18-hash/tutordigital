import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]
ej("signo de una potencia", 1, S, "Determina el signo de las potencias: a) $(-1)^{9}$   b) $(5)^{12}$   c) $(-12)^{-5}$   d) $(8)^{-4}$",
   solucion="a) negativo (base negativa, exponente impar)   b) positivo   c) negativo   d) positivo", fuente="mv3", ref="cap. 2, act. 1")
valores("propiedades de las potencias", 1, S, "Expresa en forma de una única potencia:", [
    ("(-7)^3*(-7)^5*(-7)^2*(-7)^6", "(-7)^16"), ("3^2*3^7*3*3^4*3^3", "3^17"), ("(-6)^4*4^4*(-1)^4*(-5)^4", "120^4"),
    ("(-8)^9/(-8)^3", "(-8)^6"), ("(-3)^2/(-3)^7", "(-3)^(-5)"), ("((-2)^5)^6", "(-2)^30"), ("(7^3)^(-5)", "7^(-15)")], "mv3", "cap. 2, act. 2 a 6",
    enunciados=["(-7)^{3} \\cdot (-7)^{5} \\cdot (-7)^{2} \\cdot (-7)^{6}", "3^{2} \\cdot 3^{7} \\cdot 3 \\cdot 3^{4} \\cdot 3^{3}", "(-6)^{4} \\cdot 4^{4} \\cdot (-1)^{4} \\cdot (-5)^{4}",
                "(-8)^{9} : (-8)^{3}", "(-3)^{2} : (-3)^{7}", "\\left((-2)^{5}\\right)^{6}", "\\left(7^{3}\\right)^{-5}"])
valores("potencias de base racional", 1, S, "Calcula:", [
    ("(5/3)^3", "125/27"), ("(-2/7)^(-4)", "2401/16"), ("(-1/6)^4", "1/1296"), ("(-5/2)^(-2)", "4/25")], "mv3", "cap. 2, act. 7",
    enunciados=["\\left(\\frac{5}{3}\\right)^{3}", "\\left(-\\frac{2}{7}\\right)^{-4}", "\\left(-\\frac{1}{6}\\right)^{4}", "\\left(-\\frac{5}{2}\\right)^{-2}"])
valores("potencias de base racional", 2, S, "Expresa como una única potencia:", [
    ("(-3/4)^3*(-3/4)^2*(-3/4)^(-8)", "(-3/4)^(-3)"), ("(5/4)^6*(-2/3)^6*(-1/7)^6", "(5/42)^6"), ("(-3/5)^(-4)*(-3/8)^(-4)*(-1/4)^(-4)", "(9/160)^(-4)"),
    ("(-2/5)^4/(-2/5)^7", "(-2/5)^(-3)"), ("(5/8)^3/(5/8)^(-2)", "(5/8)^5"), ("(1/5)^(-3)/(2/9)^(-3)", "(9/10)^(-3)"), ("(-6)^5/(-2/9)^5", "27^5")], "mv3", "cap. 2, act. 8a, 9, 10 y 11",
    enunciados=["\\left(-\\frac{3}{4}\\right)^{3} \\cdot \\left(-\\frac{3}{4}\\right)^{2} \\cdot \\left(-\\frac{3}{4}\\right)^{-8}", "\\left(\\frac{5}{4}\\right)^{6} \\cdot \\left(-\\frac{2}{3}\\right)^{6} \\cdot \\left(-\\frac{1}{7}\\right)^{6}",
                "\\left(-\\frac{3}{5}\\right)^{-4} \\cdot \\left(-\\frac{3}{8}\\right)^{-4} \\cdot \\left(-\\frac{1}{4}\\right)^{-4}", "\\left(-\\frac{2}{5}\\right)^{4} : \\left(-\\frac{2}{5}\\right)^{7}",
                "\\left(\\frac{5}{8}\\right)^{3} : \\left(\\frac{5}{8}\\right)^{-2}", "\\left(\\frac{1}{5}\\right)^{-3} : \\left(\\frac{2}{9}\\right)^{-3}", "(-6)^{5} : \\left(-\\frac{2}{9}\\right)^{5}"])
valores("propiedades de las potencias", 2, S, "Expresa en forma de única potencia:", [
    ("2^5*(-3)^5*(-1)^5", "6^5"), ("4^3*(-2)^3*(-1)^3*5^3", "40^3"), ("(-5)^2*(-5)^4*5", "5^7"), ("(-9)^2*9^3*9^4*9", "9^10"),
    ("(-18)^4/(-3)^4", "6^4"), ("(-3)^2/(-3)^4", "(-3)^(-2)")], "mv3", "cap. 2, ejercicios y problemas 1 (a, c, d, e, f, h)",
    enunciados=["2^{5} \\cdot (-3)^{5} \\cdot (-1)^{5}", "4^{3} \\cdot (-2)^{3} \\cdot (-1)^{3} \\cdot 5^{3}", "(-5)^{2} \\cdot (-5)^{4} \\cdot 5", "(-9)^{2} \\cdot 9^{3} \\cdot 9^{4} \\cdot 9",
                "(-18)^{4} : (-3)^{4}", "(-3)^{2} : (-3)^{4}"])
valores("exponente negativo", 2, S, "Expresa en forma de potencia de exponente positivo:", [
    ("(-4)^(-3)", "(-1/4)^3"), ("9^(-3)", "(1/9)^3"), ("(-2)^5/(-2)^9", "(1/2)^4"), ("(-5)*(-5)^2/(-5)^6", "(-1/5)^3")], "mv3", "cap. 2, ejercicios y problemas 3",
    enunciados=["(-4)^{-3}", "(9)^{-3}", "(-2)^{5} : (-2)^{9}", "(-5) \\cdot (-5)^{2} : (-5)^{6}"])
valores("potencias de base racional", 3, S, "Expresa en forma de única potencia:", [
    ("(2/3)^(-4)*(2/3)^3*(2/3)^5", "(2/3)^4"), ("(1/6)^3*(3/5)^3*(-6/7)^3", "(-3/35)^3"), ("(-5/3)^4/(-2/3)^4", "(5/2)^4"),
    ("(4/9)^3/(4/9)^5", "(4/9)^(-2)"), ("((-4/3)^(-3))^5", "(-4/3)^(-15)"), ("((2/7)^(-1))^(-3)", "(2/7)^3")], "mv3", "cap. 2, ejercicios y problemas 6",
    enunciados=["\\left(\\frac{2}{3}\\right)^{-4} \\cdot \\left(\\frac{2}{3}\\right)^{3} \\cdot \\left(\\frac{2}{3}\\right)^{5}", "\\left(\\frac{1}{6}\\right)^{3} \\cdot \\left(\\frac{3}{5}\\right)^{3} \\cdot \\left(-\\frac{6}{7}\\right)^{3}",
                "\\left(-\\frac{5}{3}\\right)^{4} : \\left(-\\frac{2}{3}\\right)^{4}", "\\left(\\frac{4}{9}\\right)^{3} : \\left(\\frac{4}{9}\\right)^{5}", "\\left(\\left(-\\frac{4}{3}\\right)^{-3}\\right)^{5}", "\\left(\\left(\\frac{2}{7}\\right)^{-1}\\right)^{-3}"])
valores("operaciones con potencias de exponente entero", 2, S, "Simplifica, mediante las propiedades de las potencias, dejando el resultado como entero o fracción (salvo si es muy elevado, en cuyo caso puede dejarse como potencia); no vale usar calculadora:", [
    ("((5/2)^3)^(-4)*(4/5)^(-2)", "2^8/5^10"), ("(6/5)^6*(-10/3)^(-4)", "3^10*2^2/5^10"), ("2^(-3)*(-2)^4*(-4)^(-1)/(-2)", "1/4"), ("2*(-1)^3-4*(-1)^2+2*(-1)", "-8"),
    ("(1/2)^(-3)*(-1/4)^2/2^(-1)", "1"), ("2*(-2)^4+3*(-2)^3-4*(-2)^2-3*(-2)", "-2")], "ag3", "potencias, ficha 4, ej. 1 (1–3, 5–7)",
    enunciados=["\\left[\\left(\\frac{5}{2}\\right)^{3}\\right]^{-4} \\cdot \\left(\\frac{4}{5}\\right)^{-2}", "\\left(\\frac{6}{5}\\right)^{6} \\cdot \\left(-\\frac{10}{3}\\right)^{-4}", "\\frac{2^{-3} \\cdot (-2)^{4} \\cdot (-4)^{-1}}{-2}",
                "2 \\cdot (-1)^{3}-4 \\cdot (-1)^{2}+2 \\cdot (-1)", "\\frac{\\left(\\frac{1}{2}\\right)^{-3} \\cdot \\left(-\\frac{1}{4}\\right)^{2}}{2^{-1}}", "2 \\cdot (-2)^{4}+3 \\cdot (-2)^{3}-4 \\cdot (-2)^{2}-3 \\cdot (-2)"])
valores("operaciones con potencias de exponente entero", 3, S, "Simplifica, mediante las propiedades de las potencias; no vale usar calculadora:", [
    ("((4/9)^(-1)*(5/4)^3)/((25/3)^2*(1/3)^(-3)*2^(-7))", "3/10"), ("((2/3)^2*(2/3)^(-5))^(-3)/((2/3)^(-5)/(2/3)^(-8))^(-2)", "(2/3)^15"),
    ("((1/5)^(-5)/(1/5)^(-9))/((1/5)^3*(1/5)^(-10)/(1/5))", "1/5^12"), ("2^3*8^(-3)*12^(-1)*(-3)^2/(6^2*16^(-2)*3^(-3))", "9/4"),
    ("6^4*9^2*2^(-4)*3^(-5)*2^(-1)/(18^3*2^(-5)*3^6*(3^3)^(-3))", "2"), ("(2^(-4)*4^3)^2*5*5^0/(100^2*(5^2)^(-3))", "125"), ("(8/9)^(-2)*((-2/3)^2)^3*(3/2)^(-1)*9", "2/3"),
    ("(1/2)^(-8)/(((4^2)^(-3))^2*64^3)", "2^14")], "ag3", "potencias, ficha 4, ej. 1 (8–10, 22, 23, 28, 29 y 31)",
    enunciados=["\\frac{\\left(\\frac{4}{9}\\right)^{-1} \\cdot \\left(\\frac{5}{4}\\right)^{3}}{\\left(\\frac{25}{3}\\right)^{2} \\cdot \\left(\\frac{1}{3}\\right)^{-3} \\cdot 2^{-7}}",
                "\\frac{\\left[\\left(\\frac{2}{3}\\right)^{2} \\cdot \\left(\\frac{2}{3}\\right)^{-5}\\right]^{-3}}{\\left[\\left(\\frac{2}{3}\\right)^{-5} : \\left(\\frac{2}{3}\\right)^{-8}\\right]^{-2}}",
                "\\frac{\\left(\\frac{1}{5}\\right)^{-5} : \\left(\\frac{1}{5}\\right)^{-9}}{\\left(\\frac{1}{5}\\right)^{3} \\cdot \\left(\\frac{1}{5}\\right)^{-10} : \\frac{1}{5}}",
                "\\frac{2^{3} \\cdot 8^{-3} \\cdot 12^{-1} \\cdot (-3)^{2}}{6^{2} \\cdot 16^{-2} \\cdot 3^{-3}}", "\\frac{6^{4} \\cdot 9^{2} \\cdot 2^{-4} \\cdot 3^{-5} \\cdot 2^{-1}}{18^{3} \\cdot 2^{-5} \\cdot 3^{6} \\cdot \\left(3^{3}\\right)^{-3}}",
                "\\frac{\\left(2^{-4} \\cdot 4^{3}\\right)^{2} \\cdot 5 \\cdot 5^{0}}{100^{2} \\cdot \\left(5^{2}\\right)^{-3}}", "\\left(\\frac{8}{9}\\right)^{-2} \\cdot \\left[\\left(-\\frac{2}{3}\\right)^{2}\\right]^{3} \\cdot \\left(\\frac{3}{2}\\right)^{-1} \\cdot 9",
                "\\frac{\\left(\\frac{1}{2}\\right)^{-8}}{\\left[\\left(4^{2}\\right)^{-3}\\right]^{2} \\cdot 64^{3}}"])
valores("potencias de base racional", 3, S, "Calcula:", [("((-2/3)^2*(-1/6)^2)/((3/8)^(-4)*(3/8)^6)", "64/729")], "mv3", "cap. 2, act. 12b",
        enunciados=["\\frac{\\left(\\frac{-2}{3}\\right)^{2} \\cdot \\left(\\frac{-1}{6}\\right)^{2}}{\\left(\\frac{3}{8}\\right)^{-4} \\cdot \\left(\\frac{3}{8}\\right)^{6}}"])
S = ["A.2", "A.3"]
valores("notación científica", 1, ["A.2"], "Expresa en forma de notación científica:", [
    ("140000000", "1.4*10^8"), ("32800", "3.28*10^4"), ("71000000000000000", "7.1*10^16"), ("0.0000075", "7.5*10^(-6)"),
    ("-18000000", "-1.8*10^7"), ("0.00000000042", "4.2*10^(-10)"), ("-0.009", "-9*10^(-3)"), ("0.00000000007", "7*10^(-11)")], "mv3", "cap. 2, ejercicios y problemas 8 (la fuente da 4,2·10¹⁰ en f): falta el signo menos del exponente)",
    enunciados=["140\\,000\\,000", "32\\,800", "71\\,000\\,000\\,000\\,000\\,000", "0{,}0000075", "-18\\,000\\,000", "0{,}00000000042", "-0{,}009", "0{,}00000000007"])
calculo("operaciones en notación científica", 2, S, "Efectúa las operaciones en notación científica: a) $0{,}000257 + 1{,}4 \\cdot 10^{-5}$   b) $200\\,000\\,000 - 3{,}5 \\cdot 10^{6} + 8{,}5 \\cdot 10^{5}$   c) $(1{,}3 \\cdot 10^{5}) \\cdot (6{,}1 \\cdot 10^{-3})$   d) $(4{,}7 \\cdot 10^{-8}) \\cdot (3 \\cdot 10^{6}) \\cdot (2{,}5 \\cdot 10^{-4})$   e) $(5 \\cdot 10^{-8}) : (1{,}5 \\cdot 10^{-3})$   f) $(3{,}25 \\cdot 10^{-5}) \\cdot (5 \\cdot 10^{2}) : (6{,}15 \\cdot 10^{-7})$",
        [("a", "0.000257+1.4*10^(-5)", "2.71*10^(-4)", None), ("b", "200000000-3.5*10^6+8.5*10^5", "1.97*10^8", 0.005 * 10**8), ("c", "1.3*10^5*6.1*10^(-3)", "7.93*10^2", None),
         ("d", "4.7*10^(-8)*3*10^6*2.5*10^(-4)", "3.525*10^(-5)", None), ("e", "5*10^(-8)/(1.5*10^(-3))", "3.333*10^(-5)", 0.0005 * 10**-5), ("f", "3.25*10^(-5)*5*10^2/(6.15*10^(-7))", "2.64*10^4", 0.005 * 10**4)],
        "a) $2{,}71 \\cdot 10^{-4}$   b) $\\approx 1{,}97 \\cdot 10^{8}$ (exacto $1{,}9735 \\cdot 10^{8}$)   c) $7{,}93 \\cdot 10^{2}$   d) $3{,}525 \\cdot 10^{-5}$   e) $\\approx 3{,}333 \\cdot 10^{-5}$   f) $\\approx 2{,}64 \\cdot 10^{4}$", "mv3", "cap. 2, act. 15 a 17")
calculo("operaciones en notación científica", 2, S, "Realiza las operaciones y expresa el resultado en notación científica: a) $4 \\cdot 10^{3} + 2{,}4 \\cdot 10^{6} - 1{,}7 \\cdot 10^{5} - 3 \\cdot 10^{3}$   b) $2{,}3 \\cdot 10^{-5} - 3{,}45 \\cdot 10^{-4} + 6 \\cdot 10^{-3}$   c) $3 \\cdot 10^{-4} \\cdot 4{,}5 \\cdot 10^{2}$   d) $1{,}8 \\cdot 10^{5} : 5 \\cdot 10^{8}$",
        [("a", "4*10^3+2.4*10^6-1.7*10^5-3*10^3", "2.231*10^6", None), ("b", "2.3*10^(-5)-3.45*10^(-4)+6*10^(-3)", "5.678*10^(-3)", None), ("c", "3*10^(-4)*4.5*10^2", "1.35*10^(-1)", None), ("d", "1.8*10^5/(5*10^8)", "3.6*10^(-4)", None)],
        "a) $2{,}231 \\cdot 10^{6}$   b) $5{,}678 \\cdot 10^{-3}$   c) $1{,}35 \\cdot 10^{-1}$ (la fuente da $1{,}35 \\cdot 10^{1}$: errata)   d) $3{,}6 \\cdot 10^{-4}$", "mv3", "cap. 2, ejercicios y problemas 10 (en c) la fuente da 1,35·10¹: errata)")
calculo("operaciones en notación científica", 3, S, "Calcula y expresa en notación científica: a) $0{,}00829 + 4 \\cdot 10^{-3} + 7{,}45 \\cdot 10^{-5} - 6{,}32 \\cdot 10^{-4}$   b) $5 \\cdot 10^{6} - 2{,}8 \\cdot 10^{7} - 3 \\cdot 10^{5}$   c) $\\frac{2{,}4 \\cdot 10^{-3} - 1{,}5 \\cdot 10^{-4}}{0{,}025 + 3 \\cdot 10^{-4}}$   d) $\\frac{(1{,}3 \\cdot 10^{4}) \\cdot (5 \\cdot 10^{3})}{(4 \\cdot 10^{5}) \\cdot (2{,}3 \\cdot 10^{6})}$",
        [("a", "0.00829+4*10^(-3)+7.45*10^(-5)-6.32*10^(-4)", "1.17*10^(-2)", 0.005 * 10**-2), ("b", "5*10^6-2.8*10^7-3*10^5", "-2.33*10^7", None),
         ("c", "(2.4*10^(-3)-1.5*10^(-4))/(0.025+3*10^(-4))", "8.89*10^(-2)", 0.005 * 10**-2), ("d", "(1.3*10^4*5*10^3)/(4*10^5*2.3*10^6)", "7.065*10^(-5)", 0.0005 * 10**-5)],
        "a) $\\approx 1{,}17 \\cdot 10^{-2}$   b) $-2{,}33 \\cdot 10^{7}$   c) $\\approx 8{,}89 \\cdot 10^{-2}$   d) $\\approx 7{,}07 \\cdot 10^{-5}$ (sale $7{,}065\\ldots$; la fuente redondea a $7{,}06$)", "mv3", "cap. 2, ejercicios y problemas 13 (a, b) y 14")
calculo("operaciones en notación científica", 2, S, "Opera y expresa en notación científica: a) $32\\,000\\,000^{2}$   b) $10^{10} + 9 \\cdot 10^{10}$   c) $5{,}5 \\cdot 10^{-3} + 2{,}2 \\cdot 10^{-7}$   d) $7{,}23 \\cdot 10^{-7} - 7{,}23 \\cdot 10^{-3}$   e) $\\frac{5 \\cdot 10^{7}}{2 \\cdot 10^{-6}}$   f) $\\frac{(1{,}2 \\cdot 10^{-5})^{2}}{10^{10} + 9 \\cdot 10^{10}}$   g) $(2 \\cdot 10^{3})^{5} \\cdot 0{,}5 \\cdot 10^{-7}$",
        [("a", "32000000^2", "1.024*10^15", None), ("b", "10^10+9*10^10", "1*10^11", None), ("c", "5.5*10^(-3)+2.2*10^(-7)", "5.50022*10^(-3)", None), ("d", "7.23*10^(-7)-7.23*10^(-3)", "-7.229277*10^(-3)", None),
         ("e", "5*10^7/(2*10^(-6))", "2.5*10^13", None), ("f", "(1.2*10^(-5))^2/(10^10+9*10^10)", "1.44*10^(-21)", None), ("g", "(2*10^3)^5*0.5*10^(-7)", "1.6*10^9", None)],
        "a) $1{,}024 \\cdot 10^{15}$   b) $1 \\cdot 10^{11}$   c) $5{,}50022 \\cdot 10^{-3}$   d) $-7{,}229277 \\cdot 10^{-3}$   e) $2{,}5 \\cdot 10^{13}$   f) $1{,}44 \\cdot 10^{-21}$   g) $1{,}6 \\cdot 10^{9}$", "ag3", "potencias, ficha 5, ej. 3 (l–n, p–s)")
calculo("problema de notación científica", 2, S, "Se estima que el volumen del agua de los océanos es de 1 285 600 000 km³ y el volumen de agua dulce es de 35 000 000 km³. Escribe esas cantidades en notación científica y calcula la proporción de agua dulce.",
        [("proporción", "35000000/1285600000*100", "2.72", 0.005)], "$1{,}2856 \\cdot 10^{9}$ km³ y $3{,}5 \\cdot 10^{7}$ km³; el agua dulce es ≈ 2,72 % de la de los océanos", "mv3", "cap. 2, act. 18")
calculo("problema de notación científica", 2, S, "A Juan le han hecho un análisis de sangre y tiene 5 millones de glóbulos rojos en cada mm³. Escribe en notación científica el número aproximado de glóbulos rojos que tiene Juan estimando que tiene 5 litros de sangre.",
        [(None, "5*10^6*5*10^6", "2.5*10^13", None)], "5 litros = 5 dm³ = $5 \\cdot 10^{6}$ mm³: $5 \\cdot 10^{6} \\cdot 5 \\cdot 10^{6} = 2{,}5 \\cdot 10^{13}$ glóbulos rojos. La fuente da $2{,}5 \\cdot 10^{3}$: errata", "mv3", "cap. 2, act. 20 (la fuente da 2,5·10³: errata)")
calculo("problema de notación científica", 2, S, "La estrella Sirio está a unos 8,611 años luz de nuestro planeta. Expresa en metros, mediante notación científica, la distancia que recorrería una nave espacial que realizara un trayecto de ida y vuelta a Sirio. (Un año luz es aproximadamente igual a $9{,}46 \\cdot 10^{12}$ km.)",
        [(None, "2*8.611*9.46*10^12*1000", "1.629*10^17", 0.0005 * 10**17)], "$\\approx 1{,}629 \\cdot 10^{17}$ m", "mv3", "cap. 2, ejercicios y problemas 11")
calculo("problema de notación científica", 3, S, "La masa de un electrón en reposo se estima en $9{,}11 \\cdot 10^{-31}$ kg, la de un protón en $1{,}672 \\cdot 10^{-27}$ kg, y la de un neutrón en $1{,}64 \\cdot 10^{-27}$ kg. Calcula la masa de un átomo de carbono 14, formado por seis protones, seis electrones y 6 + 2 = 8 neutrones.",
        [(None, "6*1.672*10^(-27)+6*9.11*10^(-31)+8*1.64*10^(-27)", "2.32*10^(-26)", 0.005 * 10**-26)], "$\\approx 2{,}32 \\cdot 10^{-26}$ kg", "mv3", "cap. 2, ejercicios y problemas 12")
calculo("problema de notación científica", 2, S, "Se estima que existen 40 millones de bacterias en un gramo de tierra. Expresa en notación científica de forma aproximada el número de bacterias que existen en unos camiones que están descargando 50 toneladas métricas de arena en una playa.",
        [(None, "40*10^6*50*10^6", "2*10^15", None)], "50 t = $5 \\cdot 10^{7}$ g: $4 \\cdot 10^{7} \\cdot 5 \\cdot 10^{7} = 2 \\cdot 10^{15}$ bacterias. La fuente da $4 \\cdot 10^{13}$: errata", "mv3", "cap. 2, ejercicios y problemas 15 (la fuente da 4·10¹³: errata)")
calculo("problema de notación científica", 2, S, "Vemos en Internet que la masa de Marte es de 639E21 kg, que la masa de Júpiter es de 1.898E27 kg, y que la masa de la Tierra es de 5.972E24 kg. a) Calcula cuántas veces cabría la Tierra en el planeta Júpiter. b) Calcula la relación entre la masa de la Tierra y la de Marte.",
        [("a", "1.898*10^27/(5.972*10^24)", "318", 0.5), ("b", "5.972*10^24/(639*10^21)", "9.34", 0.01)], "a) ≈ 318 veces   b) la masa de la Tierra es ≈ 9,34 veces la de Marte", "mv3", "cap. 2, ejercicios y problemas 18")
calculo("problema de notación científica", 2, S, "a) La estrella más cercana a nuestro sistema solar es α-Centauri, que está a una distancia de tan solo 4,3 años luz. Expresa, en km, esta distancia en notación científica (velocidad de la luz: 300 000 km/s). b) ¿Cuántos años tardaría en llegar una nave espacial viajando a 10 km/s?",
        [("a", "4.3*365*24*3600*300000", "4.068*10^13", 0.0005 * 10**13), ("b", "4.3*300000/10", "129000", None)],
        "a) $\\approx 4{,}068 \\cdot 10^{13}$ km   b) 30 000 veces más que la luz: $4{,}3 \\cdot 30\\,000 = 129\\,000 = 1{,}29 \\cdot 10^{5}$ años", "ag3", "potencias, ficha 5, ej. 4")
calculo("problema de notación científica", 3, S, "a) Calcula el volumen aproximado (en m³) de la Tierra, tomando como valor medio de su radio 6371 km, dando el resultado en notación científica con dos cifras decimales (volumen de la esfera: $\\frac{4}{3}\\pi r^{3}$). b) Halla la superficie aproximada (en m²) de la Tierra.",
        [("a", "4/3*pi*(6371000)^3", "1.08*10^21", 0.005 * 10**21), ("b", "4*pi*6371000^2", "5.10*10^14", 0.005 * 10**14)], "a) $\\approx 1{,}08 \\cdot 10^{21}$ m³   b) $\\approx 5{,}10 \\cdot 10^{14}$ m²", "ag3", "potencias, ficha 5, ej. 5")
calculo("problema de notación científica", 2, S, "En una balanza de precisión pesamos cien granos de arroz, obteniendo un valor de 0,0000277 kg. ¿Cuántos granos hay en 1000 toneladas de arroz? Utiliza notación científica.",
        [(None, "1000*1000/(0.0000277/100)", "3.61*10^12", 0.005 * 10**12)], "$\\approx 3{,}61 \\cdot 10^{12}$ granos", "ag3", "potencias, ficha 5, ej. 6")
valores("raíz cuadrada", 1, ["A.2", "A.3"], "Calcula mentalmente las siguientes raíces:", [
    ("sqrt(49)", "7"), ("sqrt(25)", "5"), ("sqrt(100)", "10"), ("sqrt(64)", "8"), ("sqrt(81)", "9"), ("sqrt(12100)", "110"), ("sqrt(0.49)", "0.7"), ("sqrt(33640000)", "5800")], "mv3", "cap. 2, act. 29 y ejercicios y problemas 19 y 20",
    enunciados=["\\sqrt{49}", "\\sqrt{25}", "\\sqrt{100}", "\\sqrt{64}", "\\sqrt{81}", "\\sqrt{12\\,100}", "\\sqrt{0{,}49}", "\\sqrt{33\\,640\\,000}"])
calculo("aproximación de raíces", 1, ["A.2", "A.3"], "Calcula mentalmente las aproximaciones enteras de las siguientes raíces: a) $\\sqrt{51}$   b) $\\sqrt{27}$   c) $\\sqrt{102}$   d) $\\sqrt{63}$   e) $\\sqrt{80}$   f) $\\sqrt{2}$   g) $\\sqrt{123}$",
        [("a", "sqrt(51)", "7", 0.5), ("b", "sqrt(27)", "5", 0.5), ("c", "sqrt(102)", "10", 0.5), ("d", "sqrt(63)", "8", 0.5), ("e", "sqrt(80)", "9", 0.5), ("f", "sqrt(2)", "1", 0.5), ("g", "sqrt(123)", "11", 0.5)],
        "a) 7   b) 5   c) 10   d) 7 (por defecto) u 8 (por exceso)   e) 8 (por defecto) o 9 (por exceso)   f) 1   g) 11", "mv3", "cap. 2, act. 30")
ej("raíces que existen", 1, ["A.2"], "Indica qué raíces cuadradas van a ser números naturales, cuáles números irracionales y cuáles no existen: a) $\\sqrt{36}$   b) $\\sqrt{-25}$   c) $\\sqrt{-100}$   d) $\\sqrt{32}$   e) $\\sqrt{-7}$   f) $\\sqrt{10}$   g) $\\sqrt{100}$",
   solucion="a) 6, natural   b) no existe   c) no existe   d) irracional   e) no existe   f) irracional   g) 10, natural", fuente="mv3", ref="cap. 2, act. 31")
guarda(materia="matematicas", etapa="eso", curso=3, tema="potencias-y-raices", titulo="Potencias de exponente entero, notación científica y raíces",
       saberes=["A.2", "A.3"], prefijo="m3-pot")
