import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["E.2"]
calculo("regla de Laplace", 1, S, "Una bolsa tiene 20 bolas blancas y 1 negra. ¿Qué probabilidad hay de sacar la negra? ¿Y una blanca?", [("negra", "1/21", "1/21", None), ("blanca", "20/21", "20/21", None)], "Negra $\\frac{1}{21}$; blanca $\\frac{20}{21}$", "mv2", "cap. 12, ejemplo")
calculo("regla de Laplace", 2, S, "Se saca una carta de una baraja española de 40 cartas. Calcula la probabilidad de: a) una figura; b) un número impar; c) una espada; d) una espada o una figura; e) la sota de oros.",
        [("a", "12/40", "3/10", None), ("b", "16/40", "2/5", None), ("c", "10/40", "1/4", None), ("d", "(10+9)/40", "19/40", None), ("e", "1/40", "1/40", None)],
        "a) $\\frac{3}{10}$   b) $\\frac{2}{5}$   c) $\\frac{1}{4}$   d) $\\frac{19}{40}$ (10 espadas y 9 figuras que no son espadas)   e) $\\frac{1}{40}$", "mv2", "cap. 12, actividad resuelta")
calculo("regla de Laplace", 2, S, "Se saca una carta de la baraja española. Calcula la probabilidad de que sea: a) el as de copas; b) una copa; c) un as; d) el as de copas o un oro; e) un as o una copa.",
        [("a", "1/40", "1/40", None), ("b", "10/40", "1/4", None), ("c", "4/40", "1/10", None), ("d", "11/40", "11/40", None), ("e", "13/40", "13/40", None)],
        "a) $\\frac{1}{40}$   b) $\\frac{1}{4}$   c) $\\frac{1}{10}$   d) $\\frac{11}{40}$   e) $\\frac{13}{40}$", "mv2", "cap. 12, act. 16")
calculo("regla de Laplace", 1, S, "¿Qué probabilidad hay de sacar bola roja de una bolsa con 7 rojas y 3 blancas? ¿Y de sacar un 5 con un dado?", [("roja", "7/10", "7/10", None), ("5", "1/6", "1/6", None)], "Roja $\\frac{7}{10}$; un 5, $\\frac{1}{6}$", "mv2", "cap. 12, actividades resueltas")
ej("tipos de sucesos", 1, S, "Clasifica en imposible, poco probable, posible, muy probable o seguro: a) tener un accidente de tráfico; b) salir de paseo y cruzar alguna calle; c) que te caiga un rayo al salir de paseo; d) que mañana nazca algún niño en París; e) que mañana no amanezca; f) que mañana llueva.",
   solucion="a) poco probable   b) muy probable   c) poco probable   d) seguro (prácticamente)   e) imposible   f) posible", fuente="mv2", ref="cap. 12, ej. 2")
calculo("frecuencia relativa y probabilidad", 2, S, "Una urna tiene 10 bolas numeradas del 0 al 9. Se saca una bola, se anota y se devuelve, 1000 veces. Salió el 0 79 veces y el 1 102 veces; la frecuencia relativa del 2 fue 0,12. a) ¿Cuál es la frecuencia absoluta del 2? b) ¿Y la frecuencia absoluta acumulada hasta el 2? c) ¿La frecuencia relativa acumulada hasta el 1? d) ¿A qué valor deberían acercarse las frecuencias relativas?",
        [("a", "0.12*1000", "120", None), ("b", "79+102+120", "301", None), ("c", "(79+102)/1000", "0.181", None), ("d", "1/10", "0.1", None)],
        "a) 120   b) 301   c) 0,181   d) A 0,1 (1 entre 10): ley de los grandes números", "mv2", "cap. 12, ej. 1")
ej("frecuencia o simetría", 1, S, "Para saber la probabilidad de que un incendio haya sido intencionado, ¿te basarías en frecuencias relativas o la asignarías por simetría?",
   solucion="En frecuencias relativas: los casos no son equiprobables, no se puede aplicar Laplace", fuente="mv2", ref="cap. 12, act. 17")
guarda(materia="matematicas", etapa="eso", curso=2, tema="probabilidad", titulo="Azar y probabilidad",
       saberes=["E.2"], prefijo="m2-prb")
