import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["D.4"]
sistemas("sustitución", 2, S, "Resuelve por el método de sustitución:", [["2*x+4*y = -5", "3*x-6*y = 7"], ["2*x+4*y = 0", "3*x+6*y = 11"], ["5*x-7*y = 1", "8*x+7*y = 10"]], "mv2", "cap. 10, ej. 38")
sistemas("igualación", 2, S, "Resuelve por el método de igualación:", [["6*x+7*y = 8", "-2*x+3*y = -4"], ["2*x-3*y = -5", "4*x+2*y = 14"], ["7*x-4*y = 3", "3*x+2*y = 5"]], "mv2", "cap. 10, ej. 39")
sistemas("reducción", 2, S, "Resuelve por el método de reducción:", [["3*x+y = 4", "2*x-5*y = 14"], ["5*x+3*y = 2", "4*x+y = 7"], ["2*x+3*y = 0", "3*x-2*y = 13"]], "mv2", "cap. 10, ej. 40")
sistemas("tipos de sistema", 3, S, "Resuelve por sustitución e indica si alguno no tiene solución o tiene infinitas:", [["3*x-2*y = -4", "6*x-4*y = -8"], ["3*x-2*y = -4", "9*x-6*y = 1"], ["3*x-2*y = -4", "2*x+3*y = 1"]], "mv2", "cap. 10, ej. 45")
sistemas("sustitución", 1, S, "Resuelve por sustitución:", [["x+y = 12", "x-y = 2"], ["x+3*y = -2", "2*x-y = 3"], ["3*x-4*y = -6", "x+2*y = 8"], ["x+2*y = 0", "2*x-y = 5"], ["2*x-y = -2", "4*x+y = 5"]], "ag2", "ficha 3, ej. 1", respuestas=[{"x":"7","y":"5"},{"x":"1","y":"-1"},{"x":"2","y":"3"},{"x":"2","y":"-1"},{"x":"1/2","y":"3"}])
sistemas("igualación", 2, S, "Resuelve por igualación:", [["3*x-y = 10", "2*x+y = 10"], ["x-2*y = -8", "-x+3*y = 10"], ["3*y+10*x = -3", "-5*x-6*y = 0"], ["x+3*y = 25", "y-9*x = 27"]], "ag2", "ficha 3, ej. 2", respuestas=[{"x":"4","y":"2"},{"x":"-4","y":"2"},{"x":"-2/5","y":"1/3"},{"x":"-2","y":"9"}])
sistemas("reducción", 2, S, "Resuelve por reducción:", [["x+y = 2", "x-y = 6"], ["3*x-4*y = -1", "x-3*y = -7"], ["8*x+9*y = 60", "10*x-3*y = 18"], ["2*x+3*y = 8", "x = 2*y"], ["2*y+3*x = 6", "5*x-10 = 5*y"]], "ag2", "ficha 3, ej. 3", respuestas=[{"x":"4","y":"-2"},{"x":"5","y":"4"},{"x":"3","y":"4"},{"x":"16/7","y":"8/7"},{"x":"2","y":"0"}])
sistemas("con denominadores", 3, S, "Resuelve por el método que prefieras:", [["x/2+2*y = 10", "x-3*y = 6"], ["2*x/3-3*y/2 = 1", "x+y = 4"], ["x-(y+1)/4 = 3", "x/2+4 = -y"], ["3*(x-2)/4+2*(y-3)/5 = 2/5", "2*(y-4)/3+3*(x-1)/2 = 3/2"]], "ag2", "ficha 3, ej. 8", respuestas=[{"x":"12","y":"2"},{"x":"42/13","y":"10/13"},{"x":"2","y":"-5"},{"x":"2","y":"4"}])
sistemas("con paréntesis", 3, S, "Resuelve:", [["1-x/2 = 3*y-3", "2*(3-x) = (14*y+14)/3"]], "ag2", "ficha 3, ej. 4", respuestas=[{"x":"-4","y":"2"}])
guarda(materia="matematicas", etapa="eso", curso=2, tema="sistemas-de-ecuaciones", titulo="Sistemas de ecuaciones lineales",
       saberes=["D.4"], prefijo="m2-sis")
