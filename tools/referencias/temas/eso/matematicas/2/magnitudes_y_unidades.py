import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["B.1"]
calculo("cambio de unidades de longitud", 1, S, "Completa: a) $50$ m $= \\square$ hm $= 5000\\ \\square$   b) $300$ hm $= 30\\ \\square = \\square$ m   c) $\\square$ dm $= \\square$ m $= 2300$ mm   d) $40$ km $= 4000\\ \\square = \\square$ dm",
        [("a", "50/100", "0.5", None), ("b", "300*100", "30000", None), ("c", "2300/100", "23", None), ("d", "40*10000", "400000", None)], "a) 0,5 hm = 5000 cm   b) 30 km = 30000 m   c) 23 dm = 2,3 m   d) 4000 dam = 400000 dm", "mv2", "cap. 5, ej. 2")
calculo("ordenar medidas", 1, S, "Ordena de menor a mayor: 2,7 m; 30 cm; 0,005 km; 2600 mm; 0,024 hm; 26 dm.", [("en m", "0.024*100", "2.4", None)], "30 cm < 0,024 hm (2,4 m) < 2600 mm = 26 dm (2,6 m) < 2,7 m < 0,005 km (5 m)", "mv2", "cap. 5, ej. 3")
calculo("problema de longitudes", 2, S, "Unos amigos van a recorrer 400 km a pie, a 5 km por hora y 6 horas al día. ¿Cuántos días tardarán?", [(None, "400/(5*6)", "40/3", None)], "$\\frac{40}{3} \\approx 13{,}3$: 14 días", "mv2", "cap. 5, ej. 5")
calculo("problema de longitudes", 2, S, "Un paquete de 500 folios mide 6 cm de grosor. ¿Cuánto mide un folio? ¿Cuántos folios hay en una caja de 21 cm de alto?", [("folio", "6/500", "0.012", None), ("caja", "21/0.012", "1750", None)], "Un folio mide 0,012 cm (0,12 mm); en la caja caben 1750 folios", "mv2", "cap. 5, ej. 6")
calculo("problema de longitudes", 2, S, "Un parque rectangular mide 100 m de largo y 75 m de ancho. ¿Cuántas vueltas debe dar Juan para correr 5 km?", [(None, "5000/(2*(100+75))", "100/7", None)], "Cada vuelta mide 350 m: $\\frac{100}{7} \\approx 14{,}3$ vueltas", "mv2", "cap. 5, ej. 7")
calculo("cambio de unidades de superficie", 2, S, "Completa: a) $3{,}5$ dam² $= \\square$ m² $= \\square$ dm²   b) $0{,}08$ km² $= \\square$ m² $= \\square$ cm²   c) $6075$ m² $= \\square$ dm² $= \\square$ hm²",
        [("a1", "3.5*100", "350", None), ("a2", "350*100", "35000", None), ("b1", "0.08*10**6", "80000", None), ("b2", "80000*10**4", "800000000", None), ("c1", "6075*100", "607500", None), ("c2", "6075/10**4", "0.6075", None)],
        "a) 350 m² = 35000 dm²   b) 80000 m² = 800000000 cm²   c) 607500 dm² = 0,6075 hm²", "mv2", "cap. 5, ej. 9")
calculo("superficies agrarias", 2, S, "El padre de Juan quiere comprar un terreno de 7,3 ha a 3,2 € el m². ¿Cuánto le costará?", [(None, "7.3*10000*3.2", "233600", None)], "233 600 €", "mv2", "cap. 5, ej. 15")
calculo("volumen y capacidad", 2, S, "Completa: a) $2$ m³ $= \\square$ L   b) $33$ cL $= \\square$ dm³   c) $500$ mm³ $= \\square$ mL   d) $0{,}02$ hm³ $= \\square$ L",
        [("a", "2*1000", "2000", None), ("b", "33/100", "0.33", None), ("c", "500/1000", "0.5", None), ("d", "0.02*10**9", "20000000", None)], "a) 2000 L   b) 0,33 dm³   c) 0,5 mL   d) 20 000 000 L", "mv2", "cap. 5, ej. 19")
calculo("volumen y capacidad", 3, S, "En una urbanización de 42 familias se recogen cada semana 27 m³ de residuos. ¿Cuántos litros produce cada familia al día?", [(None, "27000/(42*7)", "91.84", 0.01)], "≈ 91,8 litros por familia y día", "mv2", "cap. 5, ej. 20")
calculo("masa", 1, S, "Expresa en gramos: a) 2,7 dag   b) 51,3 kg   c) 3 dag 5 g 26,29 dg", [("a", "2.7*10", "27", None), ("b", "51.3*1000", "51300", None), ("c", "30+5+2.629", "37.629", None)], "a) 27 g   b) 51 300 g   c) 37,629 g", "mv2", "cap. 5, ej. 22")
calculo("densidad", 2, ["B.1", "B.3"], "La densidad del oro es 19,3 y la de la plata 10,5 (g/cm³). Dos pulseras tienen la misma masa, una de oro y otra de plata. ¿Cuál tiene mayor volumen?", [("razón", "19.3/10.5", "1.84", 0.01)], "La de plata: su volumen es unas 1,84 veces el de la de oro", "mv2", "cap. 5, ej. 25")
calculo("tiempo", 1, S, "Joaquín tarda 15 minutos en ir a la escuela. Si el curso tiene 50 semanas de lunes a viernes, ¿cuánto tiempo pasa al año en ese trayecto (solo ida)?", [(None, "15*5*50/60", "62.5", None)], "3750 minutos = 62,5 horas", "mv2", "cap. 5, ej. 29")
calculo("tiempo", 2, S, "Siete guardas se reparten por igual un servicio de 24 horas. ¿Cuánto tiempo vigila cada uno, en horas y minutos?", [(None, "24*60/7", "1440/7", None)], "$\\frac{1440}{7} \\approx 205{,}7$ min: unas 3 h 26 min", "mv2", "cap. 5, ej. 33")
calculo("cambio de moneda", 2, ["B.1", "A.5"], "Con 1 € = 1,3 \\$ = 0,86 £ = 131 ¥ (yenes), un móvil cuesta 500 € en España, 500 \\$ + 50 \\$ de envío en EE. UU. ¿Dónde es más barato?", [("EE. UU. en €", "550/1.3", "423.08", 0.01)], "En EE. UU.: 550 \\$ ≈ 423,08 €, menos que 500 €", "mv2", "cap. 5, ej. 38 (adaptado: sin la opción de China, porque el enunciado confunde yenes y yuanes)")
guarda(materia="matematicas", etapa="eso", curso=2, tema="magnitudes-y-unidades", titulo="Magnitudes y unidades de medida",
       saberes=["A.5", "B.1", "B.3"], prefijo="m2-med")
