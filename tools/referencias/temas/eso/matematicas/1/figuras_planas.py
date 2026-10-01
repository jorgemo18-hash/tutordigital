import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
SA = ["B.2"]; SF = ["C.1"]; SFA = ["B.2", "C.1"]
L_ = "abcdefghijklmnopqrstuvwxyz"


def seg(g, m=0, s=0):
    """Un ángulo en segundos, como cuenta: 34° 45′ 30″ → "(34*3600+45*60+30)"."""
    return f"({g}*3600+{m}*60+{s})"


def ang(g, m=0, s=0):
    return f"{g}^{{\\circ}}\\,{m}'\\,{s}''"


def operaciones_angulos(tipo, dif, consigna, lista, fuente, ref, nota=""):
    """lista de (operandos [(g, m, s)], signos ['+', '-'], resultado (g, m, s))."""
    comps, partes, sols = [], [], []
    for i, (ops, signos, r) in enumerate(lista):
        cuenta = seg(*ops[0]) + "".join(sg + seg(*o) for sg, o in zip(signos, ops[1:]))
        texto = ang(*ops[0]) + "".join(f" {sg} " + ang(*o) for sg, o in zip(signos, ops[1:]))
        comps.append({"tipo": "valor", "apartado": L_[i], "expresion": cuenta, "respuesta": seg(*r)})
        partes.append(f"{L_[i]}) ${texto}$")
        sols.append(f"{L_[i]}) ${ang(*r)}$")
    return ej(tipo, dif, SA, consigna + "\n\n" + "   ".join(partes), comps, "   ".join(sols) + nota, fuente, ref)


ej("elementos del plano", 1, SF, "Dibuja cuatro rectas de modo que haya dos paralelas, dos perpendiculares y dos secantes no perpendiculares.",
   solucion="Abierta. Por ejemplo: dos rectas horizontales (paralelas), una vertical que las corta (perpendicular a las dos) y una oblicua (secante no perpendicular)", fuente="mv1", ref="cap. 8, ej. 6")
ej("posiciones de rectas", 1, SF, "Si dos rectas r y s son perpendiculares y trazas una tercera recta p paralela a una de ellas, por ejemplo a r, ¿cómo son las rectas s y p? Haz un dibujo.",
   solucion="s y p son perpendiculares", fuente="mv1", ref="cap. 8, ejercicios y problemas, ej. 4")
ej("posiciones de rectas", 1, SF, "Si dos rectas tienen un punto en común, ¿cuál es su posición relativa? ¿Y si son dos puntos comunes? ¿Y si no tienen ninguno?",
   solucion="Un punto común: secantes. Dos puntos comunes: coincidentes. Ninguno: paralelas", fuente="edad1", ref="quincena 8, para practicar, ej. 1")
ej("mediatriz", 2, SF, "Si m es la mediatriz del segmento AB y D es un punto de la recta m, ¿cuál es la distancia de D a A, sabiendo que la distancia de D a B es 5,52?",
   solucion="5,52: todo punto de la mediatriz está a la misma distancia de los extremos del segmento", fuente="edad1", ref="quincena 8, para practicar, ej. 2")
ej("clasificar ángulos", 1, SA, "Clasifica los ángulos de 0°, 45°, 90°, 135°, 180° y 225° según su amplitud y según su comparación con los ángulos agudo y llano.",
   solucion="0°: nulo, convexo. 45°: agudo, convexo. 90°: recto, convexo. 135°: obtuso, convexo. 180°: llano. 225°: cóncavo", fuente="edad1", ref="quincena 8, para practicar, ej. 3")
ej("forma compleja e incompleja", 1, SA, "a) Pasa a forma compleja los siguientes ángulos: 12 500″; 83′; 230″; 17 600″.   b) Pasa de forma compleja a forma incompleja (en segundos): $12^{\\circ}\\,34'\\,40''$; $13^{\\circ}\\,23'\\,7''$; $49^{\\circ}\\,56'\\,32''$; $1^{\\circ}\\,25'\\,27''$.",
   comprobar=[{"tipo": "valor", "apartado": a, "expresion": e, "respuesta": r} for a, e, r in [
       ("a1", "12500", seg(3, 28, 20)), ("a2", "83*60", seg(1, 23)), ("a3", "230", seg(0, 3, 50)), ("a4", "17600", seg(4, 53, 20)),
       ("b1", seg(12, 34, 40), "45280"), ("b2", seg(13, 23, 7), "48187"), ("b3", seg(49, 56, 32), "179792"), ("b4", seg(1, 25, 27), "5127")]],
   solucion="a) $3^{\\circ}\\,28'\\,20''$; $1^{\\circ}\\,23'$; $3'\\,50''$; $4^{\\circ}\\,53'\\,20''$   b) 45 280″ (la fuente da 45 250″: está mal); 48 187″; 179 792″; 5 127″",
   fuente="mv1", ref="cap. 8, ej. 10 y 11 (la fuente da mal el primero del 11)")
ej("forma compleja e incompleja", 2, SA, "Completa la tabla: a) 8 465″ en minutos y segundos, y en grados, minutos y segundos.   b) $245'\\,32''$ en segundos, y en grados, minutos y segundos.   c) $31^{\\circ}\\,3'\\,55''$ en segundos, y en minutos y segundos.",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "8465", "respuesta": seg(2, 21, 5)}, {"tipo": "valor", "apartado": "b", "expresion": "245*60+32", "respuesta": "14732"},
              {"tipo": "valor", "apartado": "b2", "expresion": "245*60+32", "respuesta": seg(4, 5, 32)}, {"tipo": "valor", "apartado": "c", "expresion": seg(31, 3, 55), "respuesta": "111835"},
              {"tipo": "valor", "apartado": "c2", "expresion": seg(31, 3, 55), "respuesta": "1863*60+55"}],
   solucion="a) $141'\\,5''$ y $2^{\\circ}\\,21'\\,5''$   b) 14 732″ y $4^{\\circ}\\,5'\\,32''$   c) 111 835″ y $1863'\\,55''$", fuente="mv1", ref="cap. 8, ej. 12 (adaptado: la tabla, en texto)")
operaciones_angulos("operaciones con ángulos", 2, "Calcula:",
                    [([(34, 45, 30), (12, 27, 15)], ["+"], (47, 12, 45)), ([(16, 30, 1), (12, 13, 12), (2, 1, 0)], ["+", "+"], (30, 44, 13)), ([(16, 45, 0), (23, 0, 13), (30, 20, 30)], ["+", "+"], (70, 5, 43)),
                     ([(65, 48, 56), (12, 33, 25)], ["-"], (53, 15, 31)), ([(35, 54, 23), (15, 1, 35)], ["-"], (20, 52, 48)), ([(43, 32, 1), (15, 50, 50)], ["-"], (27, 41, 11))],
                    "mv1", "cap. 8, ej. 13 (la fuente da 30° 14′ 14″ en el b: está mal)", " (en el b la fuente da $30^{\\circ}\\,14'\\,14''$: está mal)")
operaciones_angulos("operaciones con ángulos", 2, "Calcula:",
                    [([(54, 25, 10), (32, 17, 14)], ["+"], (86, 42, 24)), ([(14, 30, 15), (62, 1, 16), (42, 0, 1)], ["+", "+"], (118, 31, 32)), ([(15, 23, 0), (73, 0, 10), (70, 28, 38)], ["+", "+"], (158, 51, 48)),
                     ([(67, 4, 23), (15, 4, 37)], ["-"], (51, 59, 46)), ([(33, 32, 1), (15, 35, 20)], ["-"], (17, 56, 41))], "mv1", "cap. 8, ejercicios y problemas, ej. 6 a, b, c, e, f")
operaciones_angulos("operaciones con ángulos", 2, "Realiza las siguientes operaciones:",
                    [([(128, 28, 23), (91, 32, 49)], ["+"], (220, 1, 12)), ([(330, 32, 43), (83, 56, 47)], ["-"], (246, 35, 56))], "edad1", "quincena 8, para practicar, ej. 9 y 10")
ej("operaciones con ángulos", 3, SA, "Realiza las siguientes operaciones: a) $31^{\\circ}\\,38'\\,9'' \\cdot 7$   b) $117^{\\circ}\\,15'\\,34'' : 8$   c) $3 \\cdot 27^{\\circ} + 5 \\cdot 19^{\\circ}$   d) $52^{\\circ} : 4$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": seg(31, 38, 9) + "*7", "respuesta": seg(221, 27, 3)}, {"tipo": "valor", "apartado": "b", "expresion": seg(117, 15, 34), "respuesta": seg(14, 39, 26) + "*8+6"},
              {"tipo": "valor", "apartado": "c", "expresion": "3*27+5*19", "respuesta": "176"}, {"tipo": "valor", "apartado": "d", "expresion": "52/4", "respuesta": "13"}],
   solucion="a) $221^{\\circ}\\,27'\\,3''$   b) $14^{\\circ}\\,39'\\,26''$ y resto 6″   c) $176^{\\circ}$   d) $13^{\\circ}$", fuente="edad1", ref="quincena 8, para practicar, ej. 7, 8, 11 y 12")
ej("ángulo en forma compleja", 1, SA, "Un ángulo mide 3/4 de recto. Expresa esta medida en grados, minutos y segundos.",
   comprobar=[{"tipo": "valor", "expresion": "3/4*90*3600", "respuesta": seg(67, 30)}], solucion="$67^{\\circ}\\,30'$", fuente="mv1", ref="cap. 8, ejercicios y problemas, ej. 5")
ej("ángulo en forma compleja", 2, SA, "La suma de dos ángulos es $125^{\\circ}\\,46'\\,35''$. Si uno de ellos mide $57^{\\circ}\\,55'\\,47''$, ¿cuánto mide el otro?",
   comprobar=[{"tipo": "valor", "expresion": seg(125, 46, 35) + "-" + seg(57, 55, 47), "respuesta": seg(67, 50, 48)}], solucion="$67^{\\circ}\\,50'\\,48''$", fuente="mv1", ref="cap. 8, ejercicios y problemas, ej. 7")
ej("complementario y suplementario", 2, SA, "Calcula los ángulos complementario y suplementario de: a) $35^{\\circ}\\,54'\\,23''$   b) $65^{\\circ}\\,48'\\,56''$   c) $43^{\\circ}\\,32'\\,1''$   d) $30^{\\circ}\\,20'\\,30''$",
   comprobar=[c for i, (a, co, su) in enumerate([((35, 54, 23), (54, 5, 37), (144, 5, 37)), ((65, 48, 56), (24, 11, 4), (114, 11, 4)), ((43, 32, 1), (46, 27, 59), (136, 27, 59)), ((30, 20, 30), (59, 39, 30), (149, 39, 30))])
              for c in ({"tipo": "valor", "apartado": L_[i] + " compl.", "expresion": "90*3600-" + seg(*a), "respuesta": seg(*co)}, {"tipo": "valor", "apartado": L_[i] + " supl.", "expresion": "180*3600-" + seg(*a), "respuesta": seg(*su)})],
   solucion="Complementarios: a) $54^{\\circ}\\,5'\\,37''$   b) $24^{\\circ}\\,11'\\,4''$   c) $46^{\\circ}\\,27'\\,59''$   d) $59^{\\circ}\\,39'\\,30''$. Suplementarios: a) $144^{\\circ}\\,5'\\,37''$   b) $114^{\\circ}\\,11'\\,4''$   c) $136^{\\circ}\\,27'\\,59''$   d) $149^{\\circ}\\,39'\\,30''$",
   fuente="mv1", ref="cap. 8, ej. 15")
ej("complementario y suplementario", 2, SA, "Indica si las siguientes parejas de ángulos son complementarios, suplementarios o ninguna de las dos cosas: a) $15^{\\circ}\\,34'\\,20''$ y $164^{\\circ}\\,25'\\,40''$   b) $65^{\\circ}\\,48'\\,56''$ y $24^{\\circ}\\,12'\\,4''$   c) $43^{\\circ}\\,32'\\,1''$ y $30^{\\circ}\\,26'\\,59''$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": seg(15, 34, 20) + "+" + seg(164, 25, 40), "respuesta": seg(180)}, {"tipo": "valor", "apartado": "b", "expresion": seg(65, 48, 56) + "+" + seg(24, 12, 4), "respuesta": seg(90, 1)},
              {"tipo": "valor", "apartado": "c", "expresion": seg(43, 32, 1) + "+" + seg(30, 26, 59), "respuesta": seg(73, 59)}],
   solucion="a) Suman 180°: suplementarios   b) Suman $90^{\\circ}\\,1'$: ninguna de las dos cosas   c) Suman $73^{\\circ}\\,59'$: ninguna", fuente="mv1", ref="cap. 8, ej. 16")
calculo("complementario y suplementario", 1, SA, "Dado un ángulo de amplitud 37°, ¿cuál es la amplitud de su complementario? ¿Y la de su suplementario? ¿De qué amplitud son los cuatro ángulos que se obtienen al trazar la recta bisectriz de un ángulo de 170°?",
        [("compl.", "90-37", "53", None), ("supl.", "180-37", "143", None), ("bisectriz", "170/2", "85", None), ("los otros dos", "180-85", "95", None)], "Complementario 53° y suplementario 143°. Con la bisectriz de 170° salen dos ángulos de 85° y otros dos de 95°", "edad1", "quincena 8, para practicar, ej. 4 y 5")
calculo("ángulos de un triángulo", 1, SFA, "Calcula el valor del tercer ángulo de un triángulo si dos de ellos miden respectivamente: a) 30° y 80°   b) 20° y 50°   c) 15° y 75°   d) $40^{\\circ}\\,30'$ y $63^{\\circ}\\,45'$. Clasifica después, según sus ángulos, los cuatro triángulos.",
        [("a", "180-30-80", "70", None), ("b", "180-20-50", "110", None), ("c", "180-15-75", "90", None), ("d", "180*60-(40*60+30)-(63*60+45)", "75*60+45", None)],
        "a) 70°, acutángulo   b) 110°, obtusángulo   c) 90°, rectángulo   d) $75^{\\circ}\\,45'$, acutángulo", "mv1", "cap. 8, ej. 39 y 40")
ej("construir triángulos", 1, SF, "Indica razonadamente si es posible construir un triángulo cuyos lados midan: a) 5 cm, 4 cm y 3 cm   b) 10 cm, 2 cm y 5 cm   c) 2 dm, 2 dm y 4 dm   d) 13 m, 12 m y 5 m",
   solucion="a) Sí   b) No: 10 > 2 + 5   c) No: 4 = 2 + 2   d) Sí. Cada lado tiene que ser menor que la suma de los otros dos", fuente="mv1", ref="cap. 8, ej. 42")
ej("ángulos de un triángulo", 1, SFA, "¿Se puede construir un triángulo de modo que sus ángulos midan 105°, 45° y 35°? Razona tu respuesta.",
   comprobar=[{"tipo": "valor", "expresion": "105+45+35", "respuesta": "185"}], solucion="No: 105° + 45° + 35° = 185°, más de 180°", fuente="mv1", ref="cap. 8, ejercicios y problemas, ej. 16")
calculo("ángulos de un triángulo", 2, SFA, "Calcula los ángulos que faltan en estos triángulos: a) ABC, con $A = 42^{\\circ}$ y $C = 66^{\\circ}$; halla B.   b) DEF, con $D = 102^{\\circ}$ y $E = 22^{\\circ}$; halla F.   c) GHI, con $H = 32^{\\circ}$ e $I = 40^{\\circ}$; halla G.   d) JKL, con $J = 70^{\\circ}$ y $L = 42^{\\circ}$; halla K.",
        [("B", "180-42-66", "72", None), ("F", "180-102-22", "56", None), ("G", "180-32-40", "108", None), ("K", "180-70-42", "68", None)], "$B = 72^{\\circ}$, $F = 56^{\\circ}$, $G = 108^{\\circ}$, $K = 68^{\\circ}$", "mv1", "cap. 8, ejercicios y problemas, ej. 18 (adaptado: los dibujos, con los datos en texto)")
calculo("ángulos de un triángulo", 2, SFA, "Si uno de los ángulos de un triángulo rectángulo es de 50°, indica el valor de los demás. Dibuja un triángulo rectángulo con estos ángulos y un cateto de 5 cm.", [(None, "180-90-50", "40", None)], "Los otros dos miden 90° y 40°", "mv1", "cap. 8, ejercicios y problemas, ej. 21")
calculo("ángulos de un triángulo", 3, SFA, "Si dos de los ángulos de un triángulo miden 30° y 70°, ¿cuánto mide el menor de los ángulos que forman las bisectrices correspondientes?", [(None, "180-(180-15-35)", "50", None)],
        "Las bisectrices forman con el lado común un triángulo de ángulos 15° y 35°, así que se cortan formando 130° y su suplementario, 50°: el menor mide 50°", "mv1", "cap. 8, ejercicios y problemas, ej. 22")
ej("puntos notables", 2, SF, "a) ¿Dónde se encuentra el circuncentro de un triángulo rectángulo?   b) ¿En qué punto colocarías un pozo para que tres casas de campo no alineadas estén a la misma distancia del mismo?",
   solucion="a) En la hipotenusa (en su punto medio)   b) En el circuncentro del triángulo cuyos vértices son las casas", fuente="mv1", ref="cap. 8, ej. 44 y ejercicios y problemas, ej. 25")
ej("clasificar cuadriláteros", 2, SF, "Señala si las siguientes afirmaciones son verdaderas: «Si las diagonales de un cuadrilátero son perpendiculares, se trata de un rombo». «Los trapecios rectángulos tienen todos sus ángulos iguales». «Los rectángulos son polígonos equiángulos». «Las diagonales de un paralelogramo se cortan en el punto medio». Justifica tus respuestas.",
   solucion="Falsa: solo es un rombo si además se cortan en su punto medio. Falsa: tienen dos ángulos rectos, uno agudo y otro obtuso. Verdadera. Verdadera", fuente="mv1", ref="cap. 8, ejercicios y problemas, ej. 28")
ej("cuadriláteros", 2, SF, "Averigua qué tipo de paralelogramo aparece si se unen los puntos medios de: a) un cuadrado   b) un rombo   c) un rectángulo",
   solucion="a) Un cuadrado   b) un rectángulo   c) un rombo", fuente="mv1", ref="cap. 8, ej. 48 a–c")
calculo("ángulos de un cuadrilátero", 1, SFA, "Los dos ángulos agudos de un romboide miden 32°. ¿Cuánto mide cada uno de los ángulos obtusos?", [(None, "(360-2*32)/2", "148", None)], "148°", "mv1", "cap. 8, ej. 49")
calculo("ángulos de un polígono", 2, SFA, "Desde uno de los vértices de un hexágono se trazan tres diagonales que dividen al polígono en cuatro triángulos. a) Calcula la suma de los ángulos del hexágono. b) Si el hexágono es regular, calcula el valor de cada uno de sus ángulos interiores. c) En el mismo supuesto, calcula el valor del ángulo central.",
        [("a", "4*180", "720", None), ("b", "720/6", "120", None), ("c", "360/6", "60", None)], "a) 720°   b) 120°   c) 60°", "mv1", "cap. 8, ejercicios y problemas, ej. 26")
calculo("ángulos de un polígono", 2, SFA, "Dibuja un polígono de 9 lados. ¿Cómo se llama? a) ¿Cuántos triángulos puedes formar al trazar todas las diagonales que parten de un vértice? b) ¿Cuánto vale la suma de los ángulos del polígono inicial?",
        [("a", "9-2", "7", None), ("b", "7*180", "1260", None)], "Eneágono. a) 7 triángulos   b) 1260°", "mv1", "cap. 8, ejercicios y problemas, ej. 27")
calculo("ángulos de un polígono", 2, SFA, "¿Cuánto valen los ángulos interior y exterior de un pentágono regular? ¿Cuánto mide el ángulo central y el ángulo interior de un octógono regular?",
        [("interior pentágono", "3*180/5", "108", None), ("exterior pentágono", "360/5", "72", None), ("central octógono", "360/8", "45", None), ("interior octógono", "6*180/8", "135", None)], "Pentágono: interior 108°, exterior 72°. Octógono: central 45°, interior 135°", "mv1", "cap. 8, autoevaluación, ej. 3, y ejercicios y problemas, ej. 10 d")
calculo("diagonales de un polígono", 2, ["C.1", "D.6"], "Calcula el número de diagonales que tienen los siguientes polígonos: a) rombo   b) trapecio   c) trapezoide   d) cuadrado   e) rectángulo   f) hexágono",
        [("cuadriláteros", "4*(4-3)/2", "2", None), ("hexágono", "6*(6-3)/2", "9", None)], "Los cuadriláteros (a–e) tienen 2 diagonales; el hexágono, 9", "mv1", "cap. 8, ejercicios y problemas, ej. 11")
ej("circunferencia", 2, SF, "a) En una circunferencia de radio 7,6, ¿cuál es la distancia entre el centro y cualquiera de sus puntos? ¿Cuánto mide el diámetro?   b) En una circunferencia de radio 4,6, ¿es posible trazar una cuerda de longitud 9,6?   c) Si una recta se encuentra a distancia 2,8 del centro de una circunferencia de radio 8,8, ¿cuáles son sus posiciones relativas?   d) Si los centros de dos circunferencias están a una distancia de 9,9 y una de ellas tiene radio 2,1, ¿cómo deberá ser el radio de la otra para que sean exteriores?",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "2*7.6", "respuesta": "15.2"}, {"tipo": "valor", "apartado": "b", "expresion": "2*4.6", "respuesta": "9.2"}, {"tipo": "valor", "apartado": "d", "expresion": "9.9-2.1", "respuesta": "7.8"}],
   solucion="a) 7,6; el diámetro, 15,2   b) No: la cuerda más larga es el diámetro, 9,2   c) Secantes (la distancia es menor que el radio)   d) Menor que 9,9 − 2,1: R < 7,8", fuente="edad1", ref="quincena 10, para practicar, ej. 1, 2, 4 y 5")
ej("ángulos en la circunferencia", 2, SFA, "a) Si el ángulo central de una circunferencia tiene una amplitud de 160°, ¿cuál será la amplitud del ángulo inscrito correspondiente?   b) ¿Cuál será la amplitud del ángulo central si su ángulo inscrito tiene amplitud 27°? ¿Qué figura se forma cuando el ángulo inscrito es recto?   c) Si una circunferencia tiene longitud 45 y un arco tiene longitud 25, ¿qué amplitud tendrá el ángulo central correspondiente a ese arco?",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "160/2", "respuesta": "80"}, {"tipo": "valor", "apartado": "b", "expresion": "2*27", "respuesta": "54"}, {"tipo": "valor", "apartado": "c", "expresion": "25/45*360", "respuesta": "200"}],
   solucion="a) 80°   b) 54°; si el inscrito es recto, el central es llano y se forma un triángulo rectángulo (su hipotenusa es un diámetro)   c) 200°", fuente="edad1", ref="quincena 10, para practicar, ej. 3, 6 y 7")
guarda(materia="matematicas", etapa="eso", curso=1, tema="figuras-planas", titulo="Figuras planas: rectas, ángulos, polígonos y circunferencia",
       saberes=["B.2", "C.1", "D.6"], prefijo="m1-fig")
