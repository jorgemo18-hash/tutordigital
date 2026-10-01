import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["D.4"]


def problema_sistema(tipo, dif, saberes, texto, ecs, resp, solucion, fuente, ref, vars_=("x", "y")):
    """Problema que se plantea con un sistema: la comprobación lo resuelve; la solución, escrita."""
    return ej(tipo, dif, saberes, texto, [{"tipo": "sistema", "ecuaciones": ecs, "vars": list(vars_), "respuesta": resp}], solucion, fuente, ref)


ej("sistemas lineales", 1, S, "Razona si son o no sistemas de ecuaciones lineales los siguientes sistemas: a) $\\begin{cases} xy+2y = 6 \\\\ 2x-3y = 1 \\end{cases}$   b) $\\begin{cases} 5y-x = 4 \\\\ 2x-3y = -1 \\end{cases}$   c) $\\begin{cases} 4x-2 = y \\\\ 3x+5y = 2 \\end{cases}$   d) $\\begin{cases} x^{2}+y = 2 \\\\ 3x+y^{2} = 4 \\end{cases}$",
   solucion="a) No: el término $xy$ no es de primer grado   b) Sí   c) Sí   d) No: los términos $x^{2}$ e $y^{2}$ no son de primer grado", fuente="mv3", ref="cap. 5, act. 17")
sistemas("clasificar sistemas", 2, ["D.4", "D.5"], "Representa los siguientes sistemas y clasifícalos:", [["x+3*y = 4", "-2*x+y = -1"], ["2*x-y = 3", "-y+2*x = 1"], ["x-3*y = 3", "2*x-6*y = 6"]], "mv3", "cap. 5, act. 18",
         respuestas=[{"x": "1", "y": "1"}, "sin solución", "infinitas"])
EJ[-1]["solucion"] = "a) Las rectas se cortan en el punto (1, 1): sistema compatible determinado   b) Las rectas son paralelas: sistema incompatible   c) Las rectas son coincidentes: sistema compatible indeterminado"
sistemas("método de sustitución", 1, S, "Resuelve los siguientes sistemas por el método de sustitución:", [["3*x+4*y = -7", "x-2*y = 1"], ["2*x+4*y = 0", "3*x+y = 5"], ["3*x-2*y = 2", "2*x+3*y = 10"]], "mv3", "cap. 5, act. 19",
         respuestas=[{"x": "-1", "y": "-1"}, {"x": "2", "y": "-1"}, {"x": "2", "y": "2"}])
sistemas("método de igualación", 1, S, "Resuelve los siguientes sistemas por el método de igualación:", [["3*x+y = 2", "-2*x+3*y = -5"], ["2*x-3*y = -5", "4*x+2*y = 14"], ["7*x-4*y = 3", "3*x+2*y = 5"]], "mv3", "cap. 5, act. 20",
         respuestas=[{"x": "1", "y": "-1"}, {"x": "2", "y": "3"}, {"x": "1", "y": "1"}])
sistemas("método de reducción", 1, S, "Resuelve los siguientes sistemas por el método de reducción:", [["3*x+y = 4", "2*x-5*y = 14"], ["5*x+3*y = 2", "4*x+y = 7"], ["2*x+3*y = 0", "3*x-2*y = 13"]], "mv3", "cap. 5, act. 21",
         respuestas=[{"x": "2", "y": "-2"}, {"x": "19/7", "y": "-27/7"}, {"x": "3", "y": "-2"}])
sistemas("método de sustitución", 2, S, "Resuelve los siguientes sistemas por el método de sustitución:", [["2*x-5*y = -4", "3*x-y = 7"], ["3*x+y = 4", "2*x+5*y = 7"], ["6*x+5*y = 7", "2*x+3*y = 1"]], "mv3", "cap. 5, ejercicios y problemas 14",
         respuestas=[{"x": "3", "y": "2"}, {"x": "1", "y": "1"}, {"x": "2", "y": "-1"}])
sistemas("método de igualación", 2, S, "Resuelve los siguientes sistemas por el método de igualación:", [["-2*x+3*y = 13", "3*x-7*y = -27"], ["5*x-2*y = -3", "4*x-y = 0"], ["9*x-5*y = 4", "-8*x+3*y = -5"]], "mv3", "cap. 5, ejercicios y problemas 15",
         respuestas=[{"x": "-2", "y": "3"}, {"x": "1", "y": "4"}, {"x": "1", "y": "1"}])
sistemas("método de reducción", 2, S, "Resuelve los siguientes sistemas por el método de reducción:", [["3*x-5*y = 1", "2*x+y = 5"], ["4*x+3*y = 14", "-x-6*y = 7"], ["9*x-5*y = 4", "-7*x+5*y = -2"]], "mv3", "cap. 5, ejercicios y problemas 16",
         respuestas=[{"x": "2", "y": "1"}, {"x": "5", "y": "-2"}, {"x": "1", "y": "1"}])
sistemas("sistemas con fracciones", 3, S, "Resuelve los siguientes sistemas por el método que creas más apropiado:", [
    ["(4*x-1)/3-(2*y+2)/5 = -1", "(x+3)/2+(4*y-1)/3 = 7"], ["(3*x-1)/2-(y+3)/5 = -3", "3*x+y = -1"], ["(x+1)/2+(y+2)/3 = 2", "3*x-2*y = 1"]], "mv3", "cap. 5, ejercicios y problemas 18",
    respuestas=[{"x": "1", "y": "4"}, {"x": "-1", "y": "2"}, {"x": "1", "y": "1"}])
sistemas("sistemas con fracciones", 3, S, "Resuelve los siguientes sistemas por el método más indicado en cada caso:", [
    ["2*x/3-3*y/2 = 1", "x+y = 4"], ["x-2*(y-4) = 6", "x-6+2*y = 8"], ["3*(x-2)/4+2*(y-3)/5 = 2/5", "2*(y-4)/3+3*(x-1)/2 = 3/2"], ["2*x-3*(y+2) = x", "-7*y-3*(y-x)/2 = 9"],
    ["(x+1)/2-(y-2)/3 = 1/3", "x/3+(y+1)/2 = 1/2"]], "ag3", "sistemas, ficha 3, ej. 6 (5, 6, 9, 15 y 12)",
    respuestas=[{"x": "42/13", "y": "10/13"}, {"x": "6", "y": "4"}, {"x": "2", "y": "4"}, {"x": "6", "y": "0"}, {"x": "-15/13", "y": "10/13"}])
sistemas("sistemas con otras letras", 2, S, "Resuelve los siguientes sistemas:", [["3*m-n = 17", "2*m+n = 8"], ["a-b = -18", "10*a-2*b = -12"], ["3*m-4*n = -6", "2*m+4*n = 16"], ["3*p-2*t = 2", "6*p-8*t = 6"]], "ag3", "sistemas, ficha 3, ej. 3 (3 y 5) y ej. 4 (5 y 11; en el último la ficha usa las letras p y q)",
         respuestas=[{"m": "5", "n": "-2"}, {"a": "3", "b": "21"}, {"m": "2", "n": "3"}, {"p": "1/3", "t": "-1/2"}], vars_=("m", "n"))
# El helper `sistemas` usa las mismas letras para todos los apartados: se corrigen las de b) y d).
EJ[-1]["comprobar"][1]["vars"] = ["a", "b"]
EJ[-1]["comprobar"][3]["vars"] = ["p", "t"]
sistemas("clasificar sistemas", 2, ["D.4", "D.5"], "Resuelve los siguientes sistemas por el método de igualación y comprueba la solución gráficamente. ¿De qué tipo es cada sistema?", [["-2*x+6*y = 13", "x-3*y = 8"], ["x-y = -3", "4*x-4*y = -12"], ["x-y = 4", "-x+3*y = -5"]],
         "mv3", "cap. 5, ejercicios y problemas 23 (en c) la fuente da x = 9/2: errata)", respuestas=["sin solución", "infinitas", {"x": "7/2", "y": "-1/2"}])
EJ[-1]["solucion"] = "a) Incompatible (rectas paralelas)   b) Compatible indeterminado (la misma recta)   c) Compatible determinado: $x = \\frac{7}{2}$, $y = -\\frac{1}{2}$ (la fuente da $x = \\frac{9}{2}$, que no cumple $x-y = 4$)"
ej("completar un sistema", 3, S, "Completa los siguientes sistemas incompletos de forma que se cumpla lo que se pide en cada uno: a) Compatible indeterminado: $\\begin{cases} (\\ \\ )x+3y = (\\ \\ ) \\\\ 2x-y = 3 \\end{cases}$   b) Incompatible: $\\begin{cases} -5x+y = 2 \\\\ (\\ \\ )x+y = 6 \\end{cases}$   c) Que su solución sea $x = 2$ e $y = 1$: $\\begin{cases} 3x-y = (\\ \\ ) \\\\ (\\ \\ )x+y = 7 \\end{cases}$",
   comprobar=[{"tipo": "sistema", "apartado": "a", "ecuaciones": ["-6*x+3*y = -9", "2*x-y = 3"], "vars": ["x", "y"], "respuesta": "infinitas"},
              {"tipo": "sistema", "apartado": "b", "ecuaciones": ["-5*x+y = 2", "-5*x+y = 6"], "vars": ["x", "y"], "respuesta": "sin solución"},
              {"tipo": "sistema", "apartado": "c", "ecuaciones": ["3*x-y = 5", "3*x+y = 7"], "vars": ["x", "y"], "respuesta": {"x": "2", "y": "1"}}],
   solucion="a) $-6x+3y = -9$   b) $-5x+y = 6$   c) $3x-y = 5$, $3x+y = 7$", fuente="mv3", ref="cap. 5, ejercicios y problemas 19 (a, b, c)")
P_ = "problema de sistemas"
problema_sistema(P_, 1, ["D.2", "D.4"], "En un hotel hay 47 habitaciones simples y dobles. Si en total tiene 57 camas, ¿cuántas habitaciones son simples y cuántas son dobles?", ["x+y = 47", "x+2*y = 57"], {"x": "37", "y": "10"},
                 "37 habitaciones simples y 10 dobles", "mv3", "cap. 5, act. 23")
problema_sistema(P_, 1, ["D.2", "D.4"], "En una granja hay 100 animales entre gallinas y conejos, y entre todos los animales suman 280 patas. ¿Cuántas gallinas hay en la granja?", ["x+y = 100", "2*x+4*y = 280"], {"x": "60", "y": "40"},
                 "60 gallinas (y 40 conejos)", "mv3", "cap. 5, act. 24")
problema_sistema(P_, 2, ["D.2", "D.4"], "La suma de las edades de María y Alberto es 32 años. Dentro de 8 años, la edad de Alberto será dos veces la edad de María. ¿Qué edad tiene cada uno en la actualidad?", ["x+y = 32", "y+8 = 2*(x+8)"], {"x": "8", "y": "24"},
                 "Alberto tiene 24 años y María 8", "mv3", "cap. 5, act. 30")
problema_sistema(P_, 1, ["D.2", "D.4"], "Encuentra dos números cuya diferencia sea 24 y su suma sea 123.", ["x-y = 24", "x+y = 123"], {"x": "147/2", "y": "99/2"}, "73,5 y 49,5", "mv3", "cap. 5, act. 31")
problema_sistema(P_, 2, ["D.2", "D.4"], "Van cargados un asno y un mulo. El asno se quejaba del peso que llevaba encima. El mulo le contestó: «Si yo llevara uno de tus sacos, llevaría el doble de carga que tú, pero si tú tomas uno de los míos, los dos llevaremos igual carga». ¿Cuántos sacos lleva cada uno?",
                 ["y+1 = 2*(x-1)", "x+1 = y-1"], {"x": "5", "y": "7"}, "El asno lleva 5 sacos y el mulo 7", "mv3", "cap. 5, ejercicios y problemas 30")
problema_sistema(P_, 2, ["D.2", "D.4", "A.6"], "María quiere formar bandejas de un kilogramo con mazapanes y polvorones. Si los polvorones le cuestan a 5 euros el kilo y los mazapanes a 7 euros el kilo, y quiere que el precio de cada bandeja sea de 6 euros, ¿qué cantidad deberá poner de cada producto? Si quiere formar 25 bandejas, ¿qué cantidad de polvorones y de mazapanes va a necesitar?",
                 ["x+y = 1", "5*x+7*y = 6"], {"x": "1/2", "y": "1/2"}, "Medio kilo de cada producto en cada bandeja; para 25 bandejas, 12,5 kg de polvorones y 12,5 kg de mazapanes", "mv3", "cap. 5, ejercicios y problemas 36")
problema_sistema(P_, 1, ["D.2", "D.4"], "Dos bocadillos y un refresco cuestan 5 €. Tres bocadillos y dos refrescos cuestan 8 €. ¿Cuál es el precio del bocadillo y el del refresco?", ["2*x+y = 5", "3*x+2*y = 8"], {"x": "2", "y": "1"},
                 "El bocadillo cuesta 2 € y el refresco 1 €", "mv3", "cap. 5, ejercicios y problemas 44")
problema_sistema(P_, 2, ["D.2", "D.4"], "En una pelea entre arañas y avispas hay 70 cabezas y 488 patas. Sabiendo que una araña tiene 8 patas y una avispa 6, ¿cuántas avispas y arañas hay en la pelea?", ["x+y = 70", "8*x+6*y = 488"], {"x": "34", "y": "36"},
                 "34 arañas y 36 avispas", "mv3", "cap. 5, ejercicios y problemas 48")
problema_sistema(P_, 2, ["D.2", "D.4"], "Yolanda tiene 6 años más que su hermano Pablo, y su madre tiene 50 años. Dentro de 2 años la edad de la madre será el doble de la suma de las edades de sus hijos. ¿Qué edades tienen?", ["x = y+6", "52 = 2*((x+2)+(y+2))"], {"x": "14", "y": "8"},
                 "Yolanda tiene 14 años y Pablo 8", "mv3", "cap. 5, ejercicios y problemas 50")
problema_sistema(P_, 2, ["D.2", "D.4"], "Un padre tiene el doble de edad que su hijo. Hace 17 años tenía el triple. Halla la edad de ambos.", ["x = 2*y", "x-17 = 3*(y-17)"], {"x": "68", "y": "34"}, "68 y 34 años", "ag3", "problemas de planteamiento, ficha 5, ej. 50")
problema_sistema(P_, 3, ["D.2", "D.4", "A.5"], "Se desea mezclar vino de 55 cént./litro con otro de 40 cént./litro, de modo que la mezcla resulte a 45 cént./litro. ¿Cuántos litros de cada clase deberán mezclarse para obtener 300 litros de la mezcla deseada?", ["x+y = 300", "55*x+40*y = 45*300"], {"x": "100", "y": "200"},
                 "100 litros del vino de 55 cént. y 200 litros del de 40 cént.", "ag3", "problemas de planteamiento, ficha 5, ej. 65")
problema_sistema(P_, 2, ["D.2", "D.4"], "Hace 10 años la edad de un abuelo era el cuádruple de la edad del nieto, mientras que dentro de 20 años solo será el doble. Halla sus edades.", ["x-10 = 4*(y-10)", "x+20 = 2*(y+20)"], {"x": "70", "y": "25"},
                 "El abuelo 70 años y el nieto 25", "ag3", "problemas de planteamiento, ficha 5, ej. 64")
problema_sistema(P_, 2, ["D.2", "D.4"], "Un padre, preocupado por motivar a su hijo en Matemáticas, se compromete a darle 1 € por problema bien hecho, mientras que, si está mal, el hijo le devolverá 0,5 €. Después de realizar 60 problemas, el hijo ganó 30 €. ¿Cuántos problemas resolvió correctamente?", ["x+y = 60", "x-0.5*y = 30"], {"x": "40", "y": "20"},
                 "40 problemas bien (y 20 mal)", "ag3", "problemas de planteamiento, ficha 5, ej. 73")
problema_sistema(P_, 2, ["D.2", "D.4"], "Entre Juan y Pedro tienen 40 €, pero si Juan le diera 5 € a Pedro entonces este tendría el triple que su amigo. ¿Cuánto dinero tiene cada uno?", ["x+y = 40", "y+5 = 3*(x-5)"], {"x": "15", "y": "25"},
                 "Juan 15 € y Pedro 25 €", "ag3", "problemas de planteamiento, ficha 5, ej. 74")
guarda(materia="matematicas", etapa="eso", curso=3, tema="sistemas-de-ecuaciones", titulo="Sistemas de dos ecuaciones lineales con dos incógnitas",
       saberes=["D.2", "D.4", "D.5", "A.5", "A.6"], prefijo="m3-sis")
