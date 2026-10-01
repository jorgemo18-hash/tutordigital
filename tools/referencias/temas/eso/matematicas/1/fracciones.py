import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]; SR = ["A.2", "A.4"]
FR = r"(\(-\d+\)|\d+)/(\d+)"


def calc(s):
    """"7/2 : 3/4" → "(7/2)/(3/4)": la cuenta que hace el ordenador."""
    return re.sub(FR, r"(\1/\2)", s).replace("·", "*").replace(":", "/")


def en(s):
    """"7/2 : 3/4" → "\\frac{7}{2} : \\frac{3}{4}": como se escribe."""
    s = re.sub(FR, lambda m: "\\frac{" + m.group(1).strip("()") + "}{" + m.group(2) + "}", s)
    return s.replace("·", " \\cdot ").replace(":", " : ").replace("(", "\\left(").replace(")", "\\right)").replace("{\\left(", "{(").replace("\\right)}", ")}")


def fr(tipo, dif, saberes, consigna, lista, fuente, ref):
    return valores(tipo, dif, saberes, consigna, [(calc(s), r) for s, r in lista], fuente, ref, enunciados=[en(s) for s, _ in lista])


ej("fracción de una figura", 1, ["A.2"], "Una caja de quesitos tiene 8 porciones iguales. Escribe la fracción que representan los quesitos que quedan en la caja cuando hay: a) 8 quesitos   b) 3 quesitos   c) 5 quesitos   d) 1 quesito.",
   solucion="a) $\\frac{8}{8}$   b) $\\frac{3}{8}$   c) $\\frac{5}{8}$   d) $\\frac{1}{8}$", fuente="mv1", ref="cap. 5, ej. 1 (adaptado: las fotos de la caja, descritas con palabras)")
ej("fracción de una figura", 1, ["A.2"], "Expresa mediante una fracción la parte coloreada de cada figura: a) un rectángulo dividido en 4 partes iguales con 1 coloreada   b) uno dividido en 5 partes con 2 coloreadas   c) uno dividido en 2 partes con 1 coloreada   d) uno dividido en 3 partes con 2 coloreadas.",
   solucion="a) $\\frac{1}{4}$   b) $\\frac{2}{5}$   c) $\\frac{1}{2}$   d) $\\frac{2}{3}$", fuente="mv1", ref="cap. 5, ejercicios y problemas, ej. 8 (adaptado: las figuras, descritas con palabras)")
fr("fracción de un número", 1, S, "Calcula:", [("1/13·39", "3"), ("1/10·50", "5"), ("1/7·35", "5"), ("1/3·21", "7")], "mv1", "cap. 5, ejercicios y problemas, ej. 9")
EJ[-1]["enunciado"] = "Calcula: a) $\\frac{1}{13}$ de 39   b) $\\frac{1}{10}$ de 50   c) $\\frac{1}{7}$ de 35   d) $\\frac{1}{3}$ de 21"
for c in EJ[-1]["comprobar"]: c.pop("enunciado")
ej("fracciones equivalentes", 1, SR, "Decide si las siguientes parejas de fracciones son o no equivalentes: a) $\\frac{4}{3}$ y $\\frac{12}{9}$   b) $\\frac{2}{5}$ y $\\frac{10}{15}$   c) $\\frac{4}{8}$ y $\\frac{3}{6}$   d) $\\frac{3}{7}$ y $\\frac{4}{9}$   e) $\\frac{5}{8}$ y $\\frac{105}{168}$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "4*9-3*12", "respuesta": "0"}, {"tipo": "valor", "apartado": "c", "expresion": "4*6-8*3", "respuesta": "0"}, {"tipo": "valor", "apartado": "e", "expresion": "5*168-8*105", "respuesta": "0"}],
   solucion="a) Sí   b) No ($2 \\cdot 15 \\neq 5 \\cdot 10$)   c) Sí   d) No   e) Sí (los productos cruzados son iguales)", fuente="mv1", ref="cap. 5, ej. 8 y 14")
ej("fracciones equivalentes", 1, SR, "Decide calculando mentalmente cuáles de las siguientes fracciones son equivalentes a $\\frac{1}{3}$: a) $\\frac{2}{6}$   b) $\\frac{-1}{-3}$   c) $\\frac{1}{2}$   d) $\\frac{7}{21}$   e) $\\frac{5}{15}$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "2/6", "respuesta": "1/3"}, {"tipo": "valor", "apartado": "b", "expresion": "(-1)/(-3)", "respuesta": "1/3"}, {"tipo": "valor", "apartado": "d", "expresion": "7/21", "respuesta": "1/3"}, {"tipo": "valor", "apartado": "e", "expresion": "5/15", "respuesta": "1/3"}],
   solucion="a), b), d) y e)", fuente="mv1", ref="cap. 5, ejercicios y problemas, ej. 12")
fr("simplificar fracciones", 1, SR, "Reduce las siguientes fracciones a su expresión irreducible:", [("48/18", "8/3"), ("14/49", "2/7"), ("8/8", "1"), ("60/148", "15/37")], "mv1", "cap. 5, ej. 13")
ej("fracción irreducible de una cantidad", 1, ["A.2"], "Escribe en forma de fracción irreducible las cantidades: a) 30 minutos de una hora   b) 45 minutos de una hora   c) 4 meses de un año   d) 6 meses de un año   e) 3 días de una semana   f) 6 horas de un día",
   comprobar=[{"tipo": "valor", "apartado": a, "expresion": e, "respuesta": r} for a, e, r in [("a", "30/60", "1/2"), ("b", "45/60", "3/4"), ("c", "4/12", "1/3"), ("d", "6/12", "1/2"), ("e", "3/7", "3/7"), ("f", "6/24", "1/4")]],
   solucion="a) $\\frac{1}{2}$   b) $\\frac{3}{4}$   c) $\\frac{1}{3}$   d) $\\frac{1}{2}$   e) $\\frac{3}{7}$   f) $\\frac{1}{4}$", fuente="mv1", ref="cap. 5, ejercicios y problemas, ej. 20")
fr("número mixto", 1, ["A.2"], "Convierte en fracción los siguientes números mixtos:", [("4+1/3", "13/3"), ("5+2/9", "47/9"), ("3+4/7", "25/7"), ("2+1/4", "9/4"), ("7+3/11", "80/11")], "mv1", "cap. 5, ejercicios y problemas, ej. 10")
EJ[-1]["enunciado"] = "Convierte en fracción los siguientes números mixtos: a) $4\\frac{1}{3}$   b) $5\\frac{2}{9}$   c) $3\\frac{4}{7}$   d) $2\\frac{1}{4}$   e) $7\\frac{3}{11}$"
for c in EJ[-1]["comprobar"]: c.pop("enunciado")
ej("número mixto", 1, ["A.2"], "Escribe como número mixto las fracciones: a) $\\frac{11}{6}$   b) $\\frac{34}{5}$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "1+5/6", "respuesta": "11/6"}, {"tipo": "valor", "apartado": "b", "expresion": "6+4/5", "respuesta": "34/5"}],
   solucion="a) $1\\frac{5}{6}$   b) $6\\frac{4}{5}$", fuente="mv1", ref="cap. 5, ej. 24")
ej("comparar fracciones", 2, SR, "En cada uno de los siguientes pares de fracciones, indica cuál es la mayor: a) $\\frac{7}{8}$ y $\\frac{3}{2}$   b) $\\frac{7}{8}$ y $\\frac{10}{11}$   c) $\\frac{2}{3}$ y $\\frac{14}{21}$   d) $\\frac{11}{18}$ y $\\frac{14}{21}$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "3/2-7/8", "respuesta": "5/8"}, {"tipo": "valor", "apartado": "b", "expresion": "10/11-7/8", "respuesta": "3/88"},
              {"tipo": "valor", "apartado": "c", "expresion": "14/21-2/3", "respuesta": "0"}, {"tipo": "valor", "apartado": "d", "expresion": "14/21-11/18", "respuesta": "1/18"}],
   solucion="a) $\\frac{7}{8} < \\frac{3}{2}$   b) $\\frac{7}{8} < \\frac{10}{11}$   c) Son iguales: $\\frac{14}{21} = \\frac{2}{3}$ (la fuente pone <)   d) $\\frac{11}{18} < \\frac{14}{21}$ (la fuente pone >)",
   fuente="mv1", ref="cap. 5, ej. 22 (la fuente se equivoca en el c y el d)")
ej("ordenar fracciones", 2, SR, "Ordena las siguientes fracciones de menor a mayor: $\\frac{12}{7}$, $\\frac{4}{7}$, $\\frac{8}{5}$, $\\frac{6}{11}$",
   comprobar=[{"tipo": "valor", "apartado": "1.º < 2.º", "expresion": "4/7-6/11", "respuesta": "2/77"}, {"tipo": "valor", "apartado": "3.º < 4.º", "expresion": "12/7-8/5", "respuesta": "4/35"}],
   solucion="$\\frac{6}{11} < \\frac{4}{7} < \\frac{8}{5} < \\frac{12}{7}$", fuente="mv1", ref="cap. 5, ej. 23")
fr("suma y resta de fracciones", 1, S, "Calcula:", [("5/9+2/9", "7/9"), ("4/13+6/13", "10/13"), ("3/5+6/5", "9/5"), ("7/1+2/1", "9"), ("4+8/1", "12"), ("1+2/5", "7/5"), ("5/6-1/6", "2/3"), ("1-4/7", "3/7"), ("8/3-1", "5/3")], "mv1", "cap. 5, ej. 5 y 6")
fr("suma y resta de fracciones", 2, S, "Realiza las siguientes sumas y restas de fracciones:", [("4/5+2/3", "22/15"), ("5/6+2/9", "19/18"), ("7/8+3/2", "19/8"), ("13/100+17/24", "503/600"), ("3/14-1/6", "1/21"), ("5/6-3/5", "7/30"), ("11/10-11/24", "77/120"), ("10/21-1/3", "1/7")], "mv1", "cap. 5, ej. 9 y 10")
fr("suma y resta de fracciones", 2, S, "Calcula:", [("1/2+1/3+1/4", "13/12"), ("3/2+5/6+5/3", "4"), ("1/2+1/3+1/6", "1"), ("7/6+3/10+1/4", "103/60"), ("11/8+5/6-4/3", "7/8"), ("11/3-5/12+13/18", "143/36"), ("15/6-4/9-1/2", "14/9")], "mv1", "cap. 5, ej. 11 y 12")
fr("suma y resta de fracciones", 2, S, "Calcula:", [("5/6+7/9+4/3", "53/18"), ("5/6+7/9-1/3", "23/18"), ("2/3+11/15-1/5", "6/5"), ("8/12+2/5-1/2-1/10", "7/15")], "edad1", "quincena 5, para practicar, ej. 1 (la fuente da 5/18 y 43/9 en el b y el c: están mal)")
EJ[-1]["solucion"] = "a) $\\frac{53}{18}$   b) $\\frac{23}{18}$   c) $\\frac{6}{5}$   d) $\\frac{7}{15}$ (en el b y el c la fuente da $\\frac{5}{18}$ y $\\frac{43}{9}$: están mal)"
fr("fracciones negativas", 2, S, "Efectúa las siguientes operaciones:", [("-5/3-7/2", "-31/6"), ("4/7+(-7)/9", "-13/63"), ("(-9)/5+(-1)/8", "-77/40")], "mv1", "cap. 5, ej. 25")
fr("producto de fracciones", 1, S, "Multiplica las siguientes fracciones y simplifica el resultado:", [("2/3·4/5", "8/15"), ("7·5/9", "35/9"), ("8·1/7", "8/7"), ("6/10·11/2", "33/10"), ("2/9·3/8", "1/12"), ("9/12·4/3", "1"), ("14/6·5/21", "5/9"), ("6/5·10/3", "4")], "mv1", "cap. 5, ej. 15 y 16")
fr("división de fracciones", 1, S, "Calcula y simplifica:", [("7/2:3/4", "14/3"), ("11/6:2/5", "55/12"), ("5/7:5/7", "1"), ("6/4:12/8", "1"), ("16/5:3", "16/15"), ("15/2:5/4", "6"), ("6/5:1/5", "6"), ("4/3:4/7", "7/3"), ("15:3/5", "25")], "mv1", "cap. 5, ej. 19 y 20")
fr("operaciones combinadas con fracciones", 2, S, "Efectúa las siguientes operaciones:", [("8/3·(6/5·1/4)", "4/5"), ("(8/3·6/5)·1/4", "4/5"), ("7/2+(5/3·9/8)", "43/8"), ("(7/2+5/3)·9/8", "93/16"), ("7/2·(5/3+9/8)", "469/48")], "mv1", "cap. 5, ej. 17 y 18")
fr("operaciones combinadas con fracciones", 3, S, "Calcula:", [("6/7·(9/4+3/8)", "9/4"), ("(8+2/5):(6-9/4)", "56/25"), ("7/9:4/3+8/12·2/5", "17/20"), ("8/12+2/5:6/7", "17/15"), ("5/6+7/9·4/3-1/2", "37/27"), ("5/6+7/9·(4/3-1/2)", "40/27")], "edad1", "quincena 5, para practicar, ej. 3")
fr("jerarquía con fracciones", 3, S, "Realiza las siguientes operaciones (con GeoGebra o a mano) y compara los resultados de la primera y la última. ¿Son iguales? ¿Por qué?", [("(2/5+7/5)·1/4-4/3", "-53/60"), ("2/5+7/5·1/4-4/3", "-7/12"), ("2/5+7/5·(1/4-4/3)", "-67/60"), ("2/5·1/4+7/5·1/4-4/3", "-53/60")], "mv1", "cap. 5, ej. 21 (adaptado: la tabla de GeoGebra, en texto)")
EJ[-1]["solucion"] = "a) $-\\frac{53}{60} \\approx -0{,}88$   b) $-\\frac{7}{12} \\approx -0{,}58$   c) $-\\frac{67}{60} \\approx -1{,}12$   d) $-\\frac{53}{60}$. La primera y la última son iguales por la propiedad distributiva"
P_ = "problema de fracciones"
calculo(P_, 1, S, "Ana ha recibido de sus padres 36 euros y su hermano menor, Ernesto, la tercera parte de lo que ha percibido Ana. ¿Qué cantidad recibió Ernesto?", [(None, "36/3", "12", None)], "12 €", "mv1", "cap. 5, ejercicios y problemas, ej. 2")
calculo(P_, 1, S, "Una persona dispone de 1172 euros y ha decidido invertir tres cuartas partes de esa cantidad en cierto producto bancario. ¿Cuál es el importe de lo invertido?", [(None, "3/4*1172", "879", None)], "879 €", "mv1", "cap. 5, ejercicios y problemas, ej. 5")
calculo(P_, 2, S, "Una figura maciza pesa ocho kilos y medio. ¿Cuánto pesará una figura y media?", [(None, "17/2*3/2", "51/4", None)], "$\\frac{17}{2} \\cdot \\frac{3}{2} = \\frac{51}{4}$: doce kilos y tres cuartos", "mv1", "cap. 5, ejercicios y problemas, ej. 6")
calculo(P_, 1, S, "Pilar ha leído las 3/4 partes de un libro de 300 hojas. Javier ha leído los 6/8 del mismo libro. ¿Cuántas páginas han leído cada uno? ¿Cómo son las fracciones utilizadas?", [("Pilar", "3/4*300", "225", None), ("Javier", "6/8*300", "225", None)], "Los dos han leído 225 hojas: las fracciones son equivalentes", "mv1", "cap. 5, ejercicios y problemas, ej. 11")
calculo(P_, 3, S, "Si se congela, el agua aumenta su volumen en 1/10. Metes en el congelador una botella de un litro y medio, ¿cuánto debes dejar vacío para que no explote?",
        [("agua", "(3/2)/(11/10)", "15/11", None), ("vacío", "3/2-15/11", "3/22", None)],
        "El agua x cumple $x \\cdot \\frac{11}{10} = \\frac{3}{2}$: $x = \\frac{15}{11}$ L. Hay que dejar vacío $\\frac{3}{22}$ L, siempre $\\frac{1}{11}$ de la botella. (La fuente dice que se llena con 19/22 de litro, que no cuadra: son 30/22 = 15/11.)",
        "mv1", "cap. 5, ejercicios y problemas, ej. 13 (un dato de la solución de la fuente está mal)")
ej("comparar fracciones", 2, ["A.4"], "En una obra de teatro han trabajado los 3/8 del alumnado de 1.º A, 1/2 del de 1.º B y 4/5 del de 1.º C. ¿En qué clase han trabajado más estudiantes? Ordena las clases según que hayan trabajado más o menos estudiantes.",
   comprobar=[{"tipo": "valor", "apartado": "B − A", "expresion": "1/2-3/8", "respuesta": "1/8"}, {"tipo": "valor", "apartado": "C − B", "expresion": "4/5-1/2", "respuesta": "3/10"}],
   solucion="$\\frac{3}{8} < \\frac{1}{2} < \\frac{4}{5}$: han trabajado más (en proporción) en 1.º C, luego 1.º B y luego 1.º A", fuente="mv1", ref="cap. 5, ejercicios y problemas, ej. 15")
calculo(P_, 1, S, "En un almacén quieren envasar tres mil litros en botellas de 1/3, ¿cuántas botellas necesitan?", [(None, "3000/(1/3)", "9000", None)], "9000 botellas", "mv1", "cap. 5, ejercicios y problemas, ej. 18")
problema(P_, 2, ["A.3", "D.2"], "En una bolsa de 24 bolas, las bolas blancas son 1/4 de ellas. Sin sacar ninguna, ¿cuántas bolas blancas debo añadir para conseguir que las blancas fuesen la mitad?", "24/4+x = (24+x)/2", ["12"], "Debo añadir 12 bolas blancas", "edad1", "quincena 5, para practicar, ej. 7")
calculo(P_, 2, S, "Un coche lleva circulando 26 minutos, en los cuales ha recorrido 2/3 de su trayecto. ¿Cuánto tiempo empleará en recorrer todo el trayecto, yendo siempre a la misma velocidad?", [(None, "26/(2/3)", "39", None)], "Tardará 39 minutos", "edad1", "quincena 5, para practicar, ej. 8")
calculo(P_, 2, S, "Una pelota, al caer al suelo, rebota hasta los 3/8 de la altura desde la que se la suelta. Si se la deja caer desde 1024 cm, ¿a qué altura llegará tras el tercer bote?", [(None, "1024*(3/8)^3", "54", None)], "Llegará a 54 cm de altura", "edad1", "quincena 5, para practicar, ej. 9")
calculo(P_, 3, S, "En un pinar de 210 pinos se talaron sus 3/5 partes; poco después hubo un incendio, en el que se quemaron los 5/7 de los pinos que quedaban. ¿Cuántos pinos sobrevivieron?", [(None, "210*(2/5)*(2/7)", "24", None)], "Quedan 84 pinos tras la tala y se quema 60: sobrevivieron 24 pinos", "edad1", "quincena 5, para practicar, ej. 10")
calculo(P_, 2, ["A.3", "A.6"], "La familia de Óscar gasta 1/3 de su presupuesto en vivienda y 1/5 en alimentación. ¿Qué fracción del presupuesto queda para otros gastos? Sus ingresos mensuales son de 2235 euros. ¿Cuánto pagarán por la vivienda?", [("otros", "1-1/3-1/5", "7/15", None), ("vivienda", "2235/3", "745", None)], "Para otros gastos quedan $\\frac{7}{15}$ del presupuesto. En vivienda gastan 745 €", "edad1", "quincena 5, para practicar, ej. 11")
calculo(P_, 1, S, "Cada paso de Eva mide aproximadamente 3/5 de metro. ¿Cuántos pasos dará para recorrer 6 km?", [(None, "6000/(3/5)", "10000", None)], "10 000 pasos", "edad1", "quincena 5, para practicar, ej. 13")
guarda(materia="matematicas", etapa="eso", curso=1, tema="fracciones", titulo="Fracciones",
       saberes=["A.2", "A.3", "A.4", "A.6", "D.2"], prefijo="m1-fra")
