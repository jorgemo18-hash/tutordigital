import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["D.4"]
ecuaciones("incompleta", 1, S, "Resuelve las siguientes ecuaciones de segundo grado incompletas:", ["3*x^2+9*x = 0", "2*x^2-8 = 0", "x^2-81 = 0", "2*x^2+5*x = 0"], "mv2", "cap. 10, ej. 35")
ecuaciones("incompleta", 1, S, "Resuelve sin usar la fórmula general:", ["x^2-5*x = 0", "x^2-16 = 0", "2*x^2-18 = 0", "5*x^2+x = 0", "x^2 = x", "4*x^2-1 = 0", "9*x^2-4 = 0", "x^2+16 = 0"], "ag2", "ficha 2, ej. 1", respuestas=[["0","5"],["-4","4"],["-3","3"],["-1/5","0"],["0","1"],["-1/2","1/2"],["-2/3","2/3"],"sin solución"])
ecuaciones("incompleta", 2, S, "Resuelve:", ["x*(x+2) = 0", "25*x^2-9 = 0", "x*(x-1)-2*x = -6*x", "(x+1)*(x-1) = 2*(x^2-13)"], "ag2", "ficha 2, ej. 1", respuestas=[["-2","0"],["-3/5","3/5"],["-3","0"],["-5","5"]])
ecuaciones("completa", 2, S, "Resuelve las siguientes ecuaciones de segundo grado completas:", ["x^2-5*x+6 = 0", "2*x^2+5*x-7 = 0", "3*x^2-8*x+2 = 0", "x^2-x-12 = 0"], "mv2", "cap. 10, ej. 36")
ecuaciones("completa", 2, S, "Resuelve con la fórmula general:", ["x^2-6*x+8 = 0", "x^2-4*x+4 = 0", "x^2-4*x+21 = 0", "x^2-2*x-3 = 0", "3*x^2-10*x+7 = 0", "6*x^2-5*x-6 = 0", "x^2+x-1 = 0"], "ag2", "ficha 2, ej. 2", respuestas=[["2","4"],["2"],"sin solución",["-1","3"],["1","7/3"],["-2/3","3/2"],None])
ecuaciones("completa", 2, S, "Resuelve:", ["x^2+5*x-6 = 0", "7*x^2+12*x = 0", "3*x^2+75 = 0", "x^2-2*x+7 = 0", "6*x^2-5*x-7 = 0", "x^2-9 = 0"], "mv2", "cap. 10, ej. 43")
ecuaciones("con coeficientes fraccionarios", 3, S, "Resuelve:", ["x^2/2-x-4 = 0", "2*x^2/3-8*x/3+2 = 0", "x^2-5*x/2+1 = 0", "x^2/9-x+2 = 0"], "ag2", "ficha 2, ej. 2", respuestas=[["-2","4"],["1","3"],["1/2","2"],["3","6"]])
ecuaciones("pasar a la forma general", 3, S, "Opera hasta llegar a la forma general y resuelve:", ["2*x^2+5*x = 5+3*x-x^2", "4*x*(x+1) = 15", "-x*(x+2)+3 = 0", "(2*x-3)^2 = 1", "(4-3*x)^2-64 = 0", "(x-1)*(x-2) = 6", "x*(x+2) = 3*(x+2)", "(x+3)*(x-3) = 3*x-11"], "ag2", "ficha 2, ej. 7", respuestas=[["-5/3","1"],["-5/2","3/2"],["-3","1"],["1","2"],["-4/3","4"],["-1","4"],["-2","3"],["1","2"]])
ecuaciones("factorizada", 2, S, "Resuelve sin desarrollar los productos:", ["(x+2)*(x-5) = 0", "(x-3)*(x-1) = 0", "(4*x-8)*(x+1) = 0", "(2*x-4)*3*x = 0"], "ag2", "ficha 2, ej. 2", respuestas=[["-2","5"],["1","3"],["-1","2"],["0","2"]])
problema("problema", 3, ["D.2", "D.4"], "Se aumenta el lado de una baldosa cuadrada en 9 cm y su área queda multiplicada por 16. ¿Qué lado tenía la baldosa?", "(x+9)^2 = 16*x^2", ["-9/5", "3"], "3 cm (la otra solución, $-\\frac{9}{5}$, no vale para una longitud)", "mv2", "cap. 10, 4 (actividad resuelta)")
guarda(materia="matematicas", etapa="eso", curso=2, tema="ecuaciones-segundo-grado", titulo="Ecuaciones de segundo grado",
       saberes=["D.4"], prefijo="m2-ec2")
