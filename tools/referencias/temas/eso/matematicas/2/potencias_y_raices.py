import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]; SA = ["A.2"]
valores("calcular potencias", 1, S, "Calcula:", [("25**0", "1"), ("5*10**4", "50000"), ("2**4", "16"), ("4**2", "16"), ("6**3", "216")], "mv2", "cap. 3, ej. 2",
        enunciados=["25^{0}", "5 \\cdot 10^{4}", "2^{4}", "4^{2}", "6^{3}"])
ej("potencias de 10", 1, SA, "Escribe como potencia de 10: a) un millón; b) un billón; c) una centena de millar.", solucion="a) $10^{6}$   b) $10^{12}$   c) $10^{5}$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "10**6", "respuesta": "1000000"}, {"tipo": "valor", "apartado": "b", "expresion": "10**12", "respuesta": "1000000000000"}, {"tipo": "valor", "apartado": "c", "expresion": "10**5", "respuesta": "100000"}], fuente="mv2", ref="cap. 3, ej. 1")
ej("notación científica", 2, SA, "Escribe de forma abreviada (número por potencia de 10): a) $600\\,000\\,000$   b) $250\\,000\\,000$   c) $914\\,000\\,000\\,000$   d) La distancia de la Tierra al Sol, $150\\,000\\,000$ km.",
   solucion="a) $6 \\cdot 10^{8}$   b) $2{,}5 \\cdot 10^{8}$   c) $9{,}14 \\cdot 10^{11}$   d) $1{,}5 \\cdot 10^{8}$ km",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "6*10**8", "respuesta": "600000000"}, {"tipo": "valor", "apartado": "b", "expresion": "2.5*10**8", "respuesta": "250000000"}, {"tipo": "valor", "apartado": "c", "expresion": "9.14*10**11", "respuesta": "914000000000"}, {"tipo": "valor", "apartado": "d", "expresion": "1.5*10**8", "respuesta": "150000000"}], fuente="mv2", ref="cap. 3, ej. 3–4")
valores("propiedades de las potencias", 2, S, "Calcula aplicando las propiedades de las potencias:", [("(2**5/2)**3*2**4", "2**16"), ("(7**4)**2", "7**8"), ("6**5/3**5", "2**5"), ("(15/5)**3", "27"), ("(75/5)**4", "15**4"), ("8**2/2**5", "2")], "mv2", "cap. 3, ej. 5",
        enunciados=["(2^{5} : 2)^{3} \\cdot 2^{4}", "(7^{4})^{2}", "6^{5} : 3^{5}", "(15 : 5)^{3}", "(75 : 5)^{4}", "8^{2} : 2^{5}"])
ej("potencia de un producto no es la suma", 1, S, "a) Calcula $(2+3)^{2}$ y $2^{2}+3^{2}$. ¿Son iguales?   b) Calcula $6^{2}+8^{2}$ y $(6+8)^{2}$. ¿Son iguales?",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "(2+3)**2-(2**2+3**2)", "respuesta": "12"}, {"tipo": "valor", "apartado": "b", "expresion": "(6+8)**2-(6**2+8**2)", "respuesta": "96"}],
   solucion="a) 25 y 13: no son iguales (diferencia 12)   b) 100 y 196: no (diferencia 96)", fuente="mv2", ref="cap. 3, ej. 9")
valores("una sola potencia", 3, S, "Da el resultado como una única potencia:", [("(5**3*5**2)**3", "5**15"), ("(16**2/4**3)**3", "4**3"), ("(9**2/3**3)**2", "3**2"), ("9**4*27**2", "3**14"), ("(5**10*5**2)**2", "5**24"), ("(9**5*81**2)**3", "3**54")], "mv2", "cap. 3, ej. 15–16",
        enunciados=["(5^{3} \\cdot 5^{2})^{3}", "(16^{2} : 4^{3})^{3}", "(9^{2} : 3^{3})^{2}", "9^{4} \\cdot 27^{2}", "(5^{10} \\cdot 5^{2})^{2}", "(9^{5} \\cdot 81^{2})^{3}"])
ej("factorizar con potencias", 2, ["A.4"], "Descompón en factores primos usando potencias: 12, 36, 48, 100, 1000 y 144.",
   comprobar=[{"tipo": "valor", "apartado": "abcdef"[i], "expresion": e, "respuesta": str(n)} for i, (n, e) in enumerate( [(12, "2**2*3"), (36, "2**2*3**2"), (48, "2**4*3"), (100, "2**2*5**2"), (1000, "2**3*5**3"), (144, "2**4*3**2")])],
   solucion="$12 = 2^{2} \\cdot 3$; $36 = 2^{2} \\cdot 3^{2}$; $48 = 2^{4} \\cdot 3$; $100 = 2^{2} \\cdot 5^{2}$; $1000 = 2^{3} \\cdot 5^{3}$; $144 = 2^{4} \\cdot 3^{2}$", fuente="mv2", ref="cap. 3, ej. 14")
valores("raíces cuadradas exactas", 1, S, "Halla:", [("sqrt(121)", "11"), ("sqrt(49)", "7"), ("sqrt(1)", "1"), ("sqrt(0)", "0"), ("sqrt(169)", "13"), ("sqrt(196)", "14"), ("sqrt(36)", "6"), ("sqrt(144)", "12")], "mv2", "cap. 3, ej. 20")
ej("la raíz de una suma", 1, S, "Escribe $=$ o $\\neq$: a) $\\sqrt{64+36}\\ \\square\\ \\sqrt{64}+\\sqrt{36}$   b) $\\sqrt{9+16}\\ \\square\\ \\sqrt{9}+\\sqrt{16}$",
   comprobar=[{"tipo": "valor", "apartado": "a", "expresion": "sqrt(64)+sqrt(36)-sqrt(64+36)", "respuesta": "4"}, {"tipo": "valor", "apartado": "b", "expresion": "sqrt(9)+sqrt(16)-sqrt(9+16)", "respuesta": "2"}],
   solucion="a) $\\neq$ (10 frente a 14)   b) $\\neq$ (5 frente a 7)", fuente="mv2", ref="cap. 3, ej. 26")
valores("operaciones combinadas con potencias y raíces", 2, S, "Calcula:", [("5*sqrt(16)-32/2**3+2*sqrt(144)+sqrt(49)", "47"), ("3*10**2-5*sqrt(64)+7**0", "261"), ("5*3**2-2*(1+sqrt(36))-2", "29"), ("32/2**3-2*sqrt(25)+2**2", "-2")], "mv2", "cap. 3, ej. 28",
        enunciados=["5 \\cdot \\sqrt{16} - 32 : 2^{3} + 2\\sqrt{144} + \\sqrt{49}", "3 \\cdot 10^{2} - 5 \\cdot \\sqrt{64} + 7^{0}", "5 \\cdot 3^{2} - 2 \\cdot (1 + \\sqrt{36}) - 2", "32 : 2^{3} - 2 \\cdot \\sqrt{25} + 2^{2}"])
P_ = "problema de potencias y raíces"
problema(P_, 1, S, "Un chalé está sobre una parcela cuadrada de 7225 m². ¿Cuánto mide el lado?", "x^2 = 7225", ["-85", "85"], "85 m (la solución $-85$ no vale para un lado)", "mv2", "cap. 3, ej. 29")
problema(P_, 1, S, "La cara de un cubo mide 36 cm². ¿Cuál es su volumen?", "x = 6**3", ["216"], "216 cm³ (la arista mide 6 cm)", "mv2", "cap. 3, ej. 11")
problema(P_, 1, S, "Un campo cuadrado mide 3600 m². ¿Cuántos metros de valla hacen falta para vallarlo?", "x = 4*sqrt(3600)", ["240"], "240 m", "mv2", "cap. 3, ej. 17")
problema(P_, 2, S, "Una parcela cuadrada mide 8100 m². Halla el área de otra cuyo lado sea el doble.", "x = (2*sqrt(8100))**2", ["32400"], "32 400 m² (cuatro veces más)", "mv2", "cap. 3, ej. 33")
problema(P_, 2, SA, "La luz del Sol, que viaja a unos 300 000 km/s, tarda 8,25 minutos en llegar a la Tierra. ¿Qué distancia hay, en notación científica?", "x = 300000*8.25*60", ["148500000"], "$1{,}485 \\cdot 10^{8}$ km (148500000 km)", "mv2", "cap. 3, ej. 31")
problema(P_, 3, ["A.3", "D.2"], "Juan quiere plantar formando un cuadrado: con sus plantas le sobran 4, y para hacer un cuadrado con una planta más por lado le faltan 9. ¿Cuántas plantas tiene?", "x^2+4 = (x+1)^2-9", ["6"], "40 plantas (lado 6: $6^{2}+4 = 40$)", "mv2", "cap. 3, ej. 35")
guarda(materia="matematicas", etapa="eso", curso=2, tema="potencias-y-raices", titulo="Potencias, raíces cuadradas y notación científica",
       saberes=["A.2", "A.3", "A.4"], prefijo="m2-pot")
