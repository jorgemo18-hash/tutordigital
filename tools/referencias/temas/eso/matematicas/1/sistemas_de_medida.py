import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["B.1"]; SE = ["B.1", "B.3"]
L_ = "abcdefghijklmnopqrstuvwxyz"


def cambios(tipo, dif, saberes, consigna, lista, fuente, ref, nota=None):
    """lista de (texto del apartado, cuenta en la unidad pedida, respuesta como la da la fuente o corregida, texto de la respuesta)."""
    comps = [{"tipo": "valor", "apartado": L_[i], "expresion": e, "respuesta": r} for i, (_, e, r, _) in enumerate(lista)]
    enunciado = consigna + " " + "   ".join(f"{L_[i]}) {t}" for i, (t, _, _, _) in enumerate(lista))
    solucion = "   ".join(f"{L_[i]}) {s}" for i, (_, _, _, s) in enumerate(lista)) + (f" {nota}" if nota else "")
    return ej(tipo, dif, saberes, enunciado, comps, solucion, fuente, ref)


ej("magnitudes y unidades", 1, S, "Clasifica como magnitudes o unidades de medida: a) Litro   b) Tiempo   c) Hora   d) Memoria de un ordenador   e) Gramo   f) Altitud   g) Presión   h) Kilómetros por hora",
   solucion="Magnitudes: b), d), f) y g). Unidades de medida: a), c), e) y h)", fuente="mv1", ref="cap. 7, ej. 1")
ej("magnitudes y unidades", 1, S, "Indica al menos una unidad del Sistema Internacional de Unidades (o de uso habitual) adecuada para expresar las siguientes magnitudes: a) La edad de una persona   b) El tamaño de un huerto   c) La capacidad de una botella   d) La distancia entre Segovia y Albacete   e) La masa de un camión",
   solucion="a) Año   b) hectárea (o m²)   c) litro   d) kilómetro   e) tonelada", fuente="mv1", ref="cap. 7, ej. 4")
ej("estimar medidas", 1, SE, "Estima cuál es la respuesta correcta a estas medidas: 1) Juan mide: 7 mm; 300 km; 1,7 m; 1,7 cm.   2) La longitud de este tenedor que está sobre mi mesa mide: 5,8 mm; 3,9 km; 1,7 m; 24 cm.   3) En la botella de agua que está en mi nevera cabe: 2,7 m³; 7 ml; 1,5 l; 9,4 cm³.   4) Elena pesa: 47 g; 470 g; 470 kg; 47 kg.   5) Ese autobús parado en la esquina mide: 12,5 cm; 12,5 mm; 12,5 m; 12,5 km.   6) El suelo de este aula mide: 1 m²; 30 m²; 30 cm²; 30 km².",
   solucion="1) 1,7 m   2) 24 cm   3) 1,5 l   4) 47 kg   5) 12,5 m   6) 30 m²", fuente="mv1", ref="cap. 7, ejercicios y problemas, ej. 21")
ej("estimar medidas", 1, SE, "Indica, en cada caso, la medida más aproximada: a) Masa de un autobús: 3 t; 4 qm; 7000 g.   b) Masa de un gorrión: 2 kg; 150 g; 30 mg.   c) Masa de un gato: 350 g; 1 qm; 25 kg.   d) Masa de una lenteja: 4 dag; 2 g; 5 dg.",
   solucion="a) 3 t   b) 150 g   c) 350 g, según la fuente (ninguna es buena: un gato adulto pesa unos 4 kg)   d) 5 dg", fuente="mv1", ref="cap. 7, ejercicios y problemas, ej. 41")
ej("elegir la unidad", 1, SE, "Escribe la unidad que utilizarías para medir la superficie de los siguientes objetos: a) Una habitación   b) Un país   c) La sección de un tubo   d) Una mesa",
   solucion="a) m²   b) km²   c) mm²   d) cm² (o m²)", fuente="mv1", ref="cap. 7, ejercicios y problemas, ej. 12")
cambios("cambio de unidades de longitud", 1, S, "Expresa las siguientes longitudes en decímetros:",
        [("54 cm", "54/10", "5.4", "5,4 dm"), ("21,08 m", "21.08*10", "210.8", "210,8 dm"), ("8,7 hm", "8.7*1000", "8700", "8700 dm"), ("327 mm", "327/100", "3.27", "3,27 dm")], "mv1", "cap. 7, ej. 9 (la fuente da 870 dm en el c: está mal)",
        nota="(La fuente da 870 dm en el c, pero 1 hm = 1000 dm.)")
cambios("cambio de unidades de longitud", 1, S, "Realiza los cambios de unidades que se indican:",
        [("15,2 hm = … dm", "15.2*1000", "15200", "15 200 dm"), ("257 cm = … dam", "257/1000", "0.257", "0,257 dam"), ("3 500 dam = … km", "3500/100", "35", "35 km"), ("345 mm = … m", "345/1000", "0.345", "0,345 m"),
         ("0,234 km = … dm", "0.234*10000", "2340", "2340 dm"), ("23 000 cm = … hm", "23000/10000", "2.3", "2,3 hm"), ("2,5 km = … dam", "2.5*100", "250", "250 dam")], "mv1", "cap. 7, ej. 10 (la fuente da 23,4 dm en el e: está mal)",
        nota="(La fuente da 23,4 dm en el e: está mal, 1 km = 10 000 dm.)")
cambios("medidas complejas", 2, S, "Expresa las siguientes longitudes en las unidades que se indican en cada caso:",
        [("8 m 1 mm en decímetros", "8*10+1/100", "80.01", "80,01 dm"), ("3,5 km 27 dam en decímetros", "3.5*10000+27*100", "37700", "37 700 dm"), ("13 km 21 mm en milímetros", "13*10^6+21", "13000021", "13 000 021 mm"),
         ("7 hm 15 cm en decímetros", "7*1000+15/10", "7001.5", "7001,5 dm"), ("2 dam 5 dm en metros", "2*10+5/10", "20.5", "20,5 m"), ("0,6 m 340 mm en centímetros", "0.6*100+340/10", "94", "94 cm")], "mv1", "cap. 7, ej. 11")
cambios("cambio de unidades de longitud", 2, S, "Expresa en micras:", [("0,00067 mm", "0.00067*1000", "0.67", "0,67 µm"), ("25,7 m", "25.7*10^6", "25700000", "25 700 000 µm"), ("0,0768 dm", "0.0768*10^5", "7680", "7680 µm"), ("0,000002 cm", "0.000002*10^4", "0.02", "0,02 µm")],
        "mv1", "cap. 7, ejercicios y problemas, ej. 8")
cambios("cambio de unidades de superficie", 2, S, "Calcula los metros cuadrados de estas superficies:", [("4,59 dm²", "4.59/100", "0.0459", "0,0459 m²"), ("10,2 hm²", "10.2*10^4", "102000", "102 000 m²"), ("4 391 mm²", "4391/10^6", "0.004391", "0,004391 m²"), ("501 dam²", "501*100", "50100", "50 100 m²")], "mv1", "cap. 7, ej. 14")
cambios("cambio de unidades de superficie", 2, S, "Expresa las siguientes superficies en las unidades que se indican en cada caso:",
        [("8 m² 1 cm² en decímetros cuadrados", "8*100+1/100", "800.01", "800,01 dm²"), ("2 dam² 15 dm² en metros cuadrados", "2*100+15/100", "200.15", "200,15 m²"), ("7 hm² 65 m² en milímetros cuadrados", "(7*10^4+65)*10^6", "70065000000", "70 065 000 000 mm²")], "mv1", "cap. 7, ej. 15 a, b y d")
cambios("hectáreas y áreas", 1, S, "La superficie de un campo de fútbol es de 7 140 metros cuadrados. Expresa esta medida en cada una de estas unidades:",
        [("centímetros cuadrados", "7140*10^4", "71400000", "71 400 000 cm²"), ("decámetros cuadrados", "7140/100", "71.4", "71,40 dam²"), ("hectáreas", "7140/10^4", "0.714", "0,714 ha"), ("áreas", "7140/100", "71.4", "71,4 a")], "mv1", "cap. 7, ej. 17")
cambios("hectáreas y áreas", 1, S, "Expresa las siguientes superficies en áreas:", [("1 678 ha", "1678*100", "167800", "167 800 a"), ("5 ha", "5*100", "500", "500 a"), ("8 ha 20 a", "8*100+20", "820", "820 a"), ("28 100 ca", "28100/100", "281", "281 a")], "mv1", "cap. 7, ej. 16")
cambios("cambio de unidades de volumen", 2, S, "Resuelve:", [("23 km³ = … m³", "23*10^9", "23000000000", "$23 \\cdot 10^{9}$ m³"), ("25 m³ = … cm³", "25*10^6", "25000000", "$25 \\cdot 10^{6}$ cm³"), ("302 hm³ = … m³", "302*10^6", "302000000", "$3{,}02 \\cdot 10^{8}$ m³"), ("80 m³ = … dam³", "80/1000", "0.08", "0,08 dam³")], "mv1", "cap. 7, ej. 18")
cambios("volumen y capacidad", 1, S, "Expresa en litros:", [("5,8 dm³", "5.8", "5.8", "5,8 L"), ("39 m³", "39*1000", "39000", "39 000 L"), ("931 cm³", "931/1000", "0.931", "0,931 L"), ("8 425 mm³", "8425/10^6", "0.008425", "0,008425 L"), ("3 dam³", "3*10^6", "3000000", "3 000 000 L")], "mv1", "cap. 7, ejercicios y problemas, ej. 24")
cambios("volumen y capacidad", 2, S, "Expresa en centímetros cúbicos:", [("2,75 hL", "2.75*100*1000", "275000", "275 000 cm³"), ("72,8 cL", "72.8*10", "728", "728 cm³"), ("6,24 kL", "6.24*10^6", "6240000", "6 240 000 cm³"), ("3,75 dL", "3.75*100", "375", "375 cm³"), ("45 L", "45*1000", "45000", "45 000 cm³"), ("895 mL", "895", "895", "895 cm³")], "mv1", "cap. 7, ejercicios y problemas, ej. 26")
ej("ordenar medidas", 2, S, "Ordena de menor a mayor estas medidas: a) 7,0001 hm³   b) 23 000 L   c) 8 mL   d) 4 mm³",
   comprobar=[{"tipo": "valor", "apartado": "a en litros", "expresion": "7.0001*10^9", "respuesta": "7000100000"}, {"tipo": "valor", "apartado": "d en mL", "expresion": "4/1000", "respuesta": "0.004"}],
   solucion="d < c < b < a: 4 mm³ = 0,004 mL; 8 mL; 23 000 L; 7,0001 hm³ = 7 000 100 000 L. (La fuente pone d < c < a < b: está mal.)", fuente="mv1", ref="cap. 7, ej. 25 (la fuente se equivoca de orden)")
cambios("unidades de capacidad", 1, S, "Expresa en kilolitros:", [("34 L", "34/1000", "0.034", "0,034 kL"), ("1 232 cL", "1232/100/1000", "0.01232", "0,01232 kL"), ("57 daL", "57*10/1000", "0.57", "0,57 kL"), ("107 hL", "107*100/1000", "10.7", "10,7 kL")], "mv1", "cap. 7, ej. 23")
cambios("unidades de capacidad", 1, S, "Añade la medida necesaria para que sume 5 litros:", [("500 cL + … cL", "500/100+0", "5", "0 cL"), ("25 dL + … dL", "25/10+25/10", "5", "25 dL"), ("500 mL + … mL", "(500+4500)/1000", "5", "4500 mL"), ("225 mL + …", "(225+4775)/1000", "5", "4775 mL")], "mv1", "cap. 7, ej. 24")
calculo("unidades de capacidad", 2, S, "Calcula esta resta: 5 cL − 5 cm³.", [(None, "50-5", "45", None)], "5 cL − 5 cm³ = 50 mL − 5 mL = 45 mL = 4,5 cL", "mv1", "cap. 7, ejercicios y problemas, ej. 35")
cambios("unidades de masa", 1, S, "Expresa en gramos las siguientes masas:", [("1,6 dag", "1.6*10", "16", "16 g"), ("49 kg", "49*1000", "49000", "49 000 g"), ("240,5 kg 7,5 dag", "240.5*1000+7.5*10", "240575", "240 575 g"), ("2 dag 15,10 dg", "2*10+15.10/10", "21.51", "21,51 g")],
        "mv1", "cap. 7, ej. 29 (la fuente da 24 125 g en el c: está mal)", nota="(La fuente da 24 050 + 75 = 24 125 g en el c: está mal, 240,5 kg son 240 500 g.)")
cambios("unidades de masa", 2, S, "Expresa en kilogramos:", [("4 t 6 q 3,7 mag", "4000+600+37", "4637", "4637 kg"), ("3,46 t 869 dag", "3460+869/100", "3468.69", "3468,69 kg"), ("424 q 561 hg", "42400+561/10", "42456.1", "42 456,1 kg"), ("6,3 t 4,1 mag 8,92 kg", "6300+41+8.92", "6349.92", "6349,92 kg")],
        "mv1", "cap. 7, ejercicios y problemas, ej. 40 (q: quintal métrico, 100 kg; mag: miriagramo, 10 kg)")
P_ = "problema de medida"
calculo(P_, 1, S, "Si Iker mide 1,35 metros y Laura mide 134 centímetros, ¿quién es más alto?", [(None, "135-134", "1", None)], "Iker: 1,35 m = 135 cm, 1 cm más", "mv1", "cap. 7, ej. 6")
calculo(P_, 1, S, "Calcula el volumen (en litros y en cm³) de una caja que mide 10 cm de ancho, 20 cm de largo y 5 cm de alto.", [("cm³", "10*20*5", "1000", None)], "1000 cm³ = 1 litro", "mv1", "cap. 7, ej. 27")
calculo(P_, 2, S, "Una furgoneta puede cargar 1,2 t. Debe transportar 72 cajas que contienen 25 envases de paquetes de jabón, con un peso de 750 g cada uno. ¿Puede transportarlos de un solo viaje?", [("kg", "72*25*750/1000", "1350", None)], "No: 72 · 25 · 750 = 1 350 000 g = 1,35 t, más de 1,2 t", "mv1", "cap. 7, ej. 31")
calculo(P_, 2, S, "Utiliza la calculadora para resolver el siguiente problema: un camión puede cargar 3,5 t. Debe transportar 88 cajas que contienen 120 envases de paquetes de jabón, con un peso de 328 g cada uno. ¿Puede hacer el porte de un solo viaje?", [("g", "88*120*328", "3463680", None)], "Sí: 88 · 120 · 328 = 3 463 680 g = 3,46368 t < 3,5 t", "mv1", "cap. 7, ej. 33")
calculo(P_, 2, S, "Una caja llena de libros pesa 25 kg, 7 hg y 4 dag y vacía pesa 200 g y 5 dg. Halla el peso de los libros en gramos.", [("llena", "25000+700+40", "25740", None), ("libros", "25740-200.5", "25539.5", None)], "Caja llena: 25 740 g; vacía: 200,5 g; libros: 25 539,5 g", "mv1", "cap. 7, ejercicios y problemas, ej. 43")
calculo(P_, 3, ["B.1", "B.2"], "Quieres embaldosar tu habitación, que mide 3,5 m de largo por 2,5 m de ancho. No quieres tener que cortar ninguna baldosa, pues entonces muchas se rompen. Al ir a comprarlas hay baldosas de: a) 40 cm por 20 cm; b) 50 cm por 35 cm; c) 25 cm por 18 cm. ¿Te sirve alguna? ¿Cuántas baldosas comprarías? Indica en m² cuánto mide tu habitación.",
        [("baldosas", "(350/35)*(250/50)", "50", None), ("área", "3.5*2.5", "8.75", None)], "Sirven las de 50 × 35 cm (350 : 35 = 10 y 250 : 50 = 5): 50 baldosas. La habitación mide 8,75 m²", "mv1", "cap. 7, ejercicios y problemas, ej. 13")
calculo(P_, 2, ["B.1", "A.6"], "Un terreno rústico de 6 ha cuesta 144 000 euros. ¿A cuánto sale el metro cuadrado? Compáralo con el precio del terreno urbanizable, que cuesta unos 350 euros el metro cuadrado.", [(None, "144000/60000", "2.4", None)], "2,4 €/m², muchísimo menos que el urbanizable", "mv1", "cap. 7, ejercicios y problemas, ej. 15")
calculo(P_, 3, ["B.1", "A.6"], "En una comunidad el agua se paga cada dos meses. Las tarifas van por tramos: los primeros 25 m³ a 0,30 €/m³; entre 25 y 50 m³ a 0,5291 €/m³; de 50 m³ en adelante a 0,55 €/m³. Si la media de consumo de agua por persona y día es 170 L, ¿cuánto pagará una persona que viva sola? ¿Cuánto pagará una familia de 6 miembros?",
        [("una persona", "170*60/1000*0.30", "3.06", None), ("familia", "25*0.30+25*0.5291+(170*60*6/1000-50)*0.55", "26.8875", None)],
        "Una persona: 170 · 60 = 10 200 L = 10,2 m³, todo en el primer tramo: 3,06 €. Familia: 61,2 m³: 25 · 0,30 + 25 · 0,5291 + 11,2 · 0,55 = 26,8875 ≈ 26,89 €", "mv1", "cap. 7, ejercicios y problemas, ej. 37")
calculo(P_, 3, S, "Un grifo gotea 25 mm³ cada 4 s. ¿Cuánta agua se pierde en una hora? ¿Y en un mes?", [("hora (mm³)", "25*3600/4", "22500", None), ("mes de 30 días (cm³)", "22500*24*30/1000", "16200", None)],
        "En una hora 22 500 mm³ = 22,5 cm³; en un mes de 30 días, 16 200 cm³ = 16,2 L. (La fuente toma los mm³ por cm³ y da 22,5 L y 16,2 m³: está mal.)", "mv1", "cap. 7, ejercicios y problemas, ej. 30 (la solución de la fuente confunde mm³ y cm³)")
guarda(materia="matematicas", etapa="eso", curso=1, tema="sistemas-de-medida", titulo="Magnitudes y sistemas de medida",
       saberes=["A.6", "B.1", "B.2", "B.3"], prefijo="m1-med")
