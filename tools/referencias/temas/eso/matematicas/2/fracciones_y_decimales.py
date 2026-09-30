import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.2", "A.3"]
valores("operaciones combinadas con fracciones", 3, S, "Realiza los cálculos:", [("(Rational(5,2)+Rational(2,3))/5*Rational(1,8)", "19/240"), ("Rational(4,1)/(Rational(3,5)-Rational(2,3))+1", "-59"), ("(Rational(1,3)-Rational(4,9))/(Rational(5,3)-Rational(9,2))-2", "-100/51"), ("(Rational(4,3)*Rational(9,8))/(Rational(5,6)+Rational(9,8))", "36/47")], "mv2", "cap. 2, ej. 22",
        enunciados=["\\frac{\\frac{5}{2} + \\frac{2}{3}}{5} \\cdot \\frac{1}{8}", "\\frac{4}{\\frac{3}{5} - \\frac{2}{3}} + 1", "\\frac{\\frac{1}{3} - \\frac{4}{9}}{\\frac{5}{3} - \\frac{9}{2}} - 2", "\\left(\\frac{4}{3} \\cdot \\frac{9}{8}\\right) : \\left(\\frac{5}{6} + \\frac{9}{8}\\right)"])
valores("producto y cociente de fracciones", 1, S, "Calcula y simplifica:", [("Rational(4,3)*Rational(9,8)", "3/2"), ("Rational(4,5)*Rational(2,6)", "4/15"), ("Rational(5,6)/Rational(2,3)", "5/4"), ("Rational(3,16)/Rational(3,10)", "5/8")], "mv2", "cap. 2, ej. 38",
        enunciados=["\\frac{4}{3} \\cdot \\frac{9}{8}", "\\frac{4}{5} \\cdot \\frac{2}{6}", "\\frac{5}{6} : \\frac{2}{3}", "\\frac{3}{16} : \\frac{3}{10}"])
valores("suma y resta de fracciones", 1, S, "Completa y calcula:", [("Rational(7,6)+Rational(5,3)", "17/6"), ("Rational(7,10)-Rational(5,14)", "12/35")], "mv2", "cap. 2, ej. 33",
        enunciados=["\\frac{7}{6} + \\frac{5}{3} = \\frac{7}{6} + \\frac{\\square}{6}", "\\frac{7}{10} - \\frac{5}{14} = \\frac{\\square}{70} - \\frac{\\square}{70}"])
ej("fracciones propias e impropias", 1, ["A.2"], "Indica cuáles son propias y cuáles impropias, y escribe las impropias como número mixto: $\\frac{8}{3},\\ \\frac{2}{5},\\ \\frac{5}{2},\\ \\frac{16}{7},\\ \\frac{21}{4},\\ \\frac{5}{6}$",
   solucion="Propias: $\\frac{2}{5}$ y $\\frac{5}{6}$. Impropias: $\\frac{8}{3} = 2\\frac{2}{3}$, $\\frac{5}{2} = 2\\frac{1}{2}$, $\\frac{16}{7} = 2\\frac{2}{7}$, $\\frac{21}{4} = 5\\frac{1}{4}$", fuente="mv2", ref="cap. 2, ej. 26–27")
P_ = "problema de fracciones"
problema(P_, 1, S, "Si una persona vive 80 años y se pasa durmiendo un tercio de su vida, ¿cuánto ha dormido?", "x = 80/3", ["80/3"], "$\\frac{80}{3} \\approx 26{,}7$ años", "mv2", "cap. 2, ej. 25")
problema(P_, 2, ["A.3", "D.2"], "María es 70 cm más alta que la mitad de su altura. ¿Qué estatura tiene?", "x = x/2+70", ["140"], "140 cm", "mv2", "cap. 2, ej. 24")
problema(P_, 2, S, "Un iceberg tiene sumergidas nueve décimas partes de su volumen. Si emergen 318 km³, ¿cuál es el volumen sumergido? ¿Y el total?", "x/10 = 318", ["3180"], "Total 3180 km³; sumergido 2862 km³", "mv2", "cap. 2, ej. 30")
problema(P_, 1, S, "En un bosque hay pinos, robles y encinas. Los pinos ocupan los 3/7 y los robles 1/3. ¿Qué parte ocupan las encinas?", "x = 1-Rational(3,7)-Rational(1,3)", ["5/21"], "$\\frac{5}{21}$ del bosque", "mv2", "cap. 2, ej. 31")
problema(P_, 1, S, "Una familia gasta 1/3 de sus ingresos en recibos y 3/7 en comida. ¿Qué parte le queda?", "x = 1-Rational(1,3)-Rational(3,7)", ["5/21"], "$\\frac{5}{21}$", "mv2", "cap. 2, ej. 34")
problema(P_, 3, S, "Se gastan 250 litros de agua por persona y día, y los hogares consumen los 3/20. Si se desperdicia 1/7 de lo que consume un hogar, ¿cuántos litros se desperdician al día en una casa de 5 habitantes?", "x = 250*5*Rational(3,20)*Rational(1,7)", ["375/14"], "$\\frac{375}{14} \\approx 26{,}8$ litros", "mv2", "cap. 2, ej. 35")
problema(P_, 2, S, "Un profesor lleva 5 horas corrigiendo exámenes y aún le queda 1/4 sin corregir. ¿Cuánto tiempo más necesitará?", "Rational(3,4)*x = 5", ["20/3"], "El total son $\\frac{20}{3}$ h; le quedan $\\frac{5}{3}$ h = 1 h 40 min", "mv2", "cap. 2, ej. 36")
problema(P_, 2, S, "En un teatro de 500 localidades dicen que se han vendido los 5/4 de las entradas. ¿Cuántas serían? ¿Tiene sentido?", "x = Rational(5,4)*500", ["625"], "625: no tiene sentido, es más que el aforo", "mv2", "cap. 2, ej. 29")
ej("redondeo y truncamiento", 1, ["A.2"], "a) Aproxima por truncamiento a las décimas y a las centésimas: $9{,}235$ y $57{,}0001$.   b) Redondea a las décimas y a las centésimas: $8{,}9351$ y $77{,}992$.",
   solucion="a) $9{,}2$ y $9{,}23$; $57{,}0$ y $57{,}00$.   b) $8{,}9$ y $8{,}94$; $78{,}0$ y $77{,}99$", fuente="mv2", ref="cap. 2, ej. 42–43")
problema("problema de decimales", 1, ["A.3"], "Vicente compró 15 bolígrafos a 0,72 € y 8 lapiceros a 0,57 €. ¿Cuánto gastó?", "x = 15*0.72+8*0.57", ["15.36"], "15,36 €", "mv2", "cap. 2, ej. 45")
problema("problema de decimales", 2, ["A.3"], "Pilar compró tres bolígrafos iguales por 1,53 € y un cuaderno que cuesta cuatro veces más que cada bolígrafo. ¿Cuánto cuesta el cuaderno?", "x = 4*1.53/3", ["2.04"], "2,04 €", "mv2", "cap. 2, ej. 46")
guarda(materia="matematicas", etapa="eso", curso=2, tema="fracciones-y-decimales", titulo="Fracciones y decimales",
       saberes=["A.2", "A.3", "A.4"], prefijo="m2-fra")
