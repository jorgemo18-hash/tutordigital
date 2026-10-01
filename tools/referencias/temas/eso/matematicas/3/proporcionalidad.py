import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.5"]
P_ = "proporcionalidad directa"
calculo(P_, 1, S, "En una receta nos dicen que para hacer una mermelada de fresa necesitamos un kilogramo de azúcar por cada dos kilogramos de fresas. Queremos hacer 5 kilogramos de mermelada: ¿cuántos kilogramos de azúcar y cuántos de fresas debemos poner?",
        [("fresas", "5*2/3", "10/3", None), ("azúcar", "5*1/3", "5/3", None)], "$\\frac{10}{3} \\approx 3{,}33$ kg de fresas y $\\frac{5}{3} \\approx 1{,}67$ kg de azúcar", "mv3", "cap. 6, act. 2")
calculo(P_, 1, S, "La altura de un árbol es proporcional a su sombra (a una misma hora). Un árbol que mide 1,2 m tiene una sombra de 2,3 m. ¿Qué altura tendrá un árbol cuya sombra mida 4,2 m?",
        [(None, "4.2*1.2/2.3", "2.19", 0.005)], "$h = \\frac{4{,}2 \\cdot 1{,}2}{2{,}3} \\approx 2{,}19$ m (la fuente redondea a 2,1)", "mv3", "cap. 6, act. 3 (la fuente da ≈ 2,1 m; sale 2,19)")
calculo(P_, 1, S, "a) Hemos gastado 72 l de gasolina para recorrer 960 km. ¿Cuántos litros necesitaremos para una distancia de 1500 km?   b) Un libro de 420 páginas pesa 200 g. ¿Cuánto pesará un libro de la misma colección de 300 páginas?   c) Con 76 € hemos pagado 12,5 m de tela. ¿Cuánto nos costarán 22,5 m?",
        [("a", "1500*72/960", "112.5", None), ("b", "300*200/420", "142.86", 0.005), ("c", "22.5*76/12.5", "136.8", None)], "a) 112,5 l   b) ≈ 142,86 g   c) 136,8 €", "mv3", "cap. 6, act. 5 y 7; ejercicios y problemas 2")
calculo(P_, 2, S, "Copia en tu cuaderno, calcula la razón de proporcionalidad y completa la tabla de proporcionalidad directa: litros: 6,25; __; 0,75; 1,4; __ — euros: __; 15; 2,25; __; 4,5.",
        [("razón", "0.75/2.25", "1/3", None), ("euros de 6,25 l", "6.25*3", "18.75", None), ("litros de 15 €", "15/3", "5", None), ("euros de 1,4 l", "1.4*3", "4.2", None), ("litros de 4,5 €", "4.5/3", "1.5", None)],
        "Razón litros/euros $k = \\frac{0{,}75}{2{,}25} = \\frac{1}{3}$. litros: 6,25; 5; 0,75; 1,4; 1,5 — euros: 18,75; 15; 2,25; 4,2; 4,5", "mv3", "cap. 6, ejercicios y problemas 1")
calculo("proporciones", 1, S, "Calcula los términos que faltan para completar las proporciones: a) $\\frac{24}{100} = \\frac{30}{x}$   b) $\\frac{x}{80} = \\frac{46}{12}$   c) $\\frac{3{,}6}{12{,}8} = \\frac{x}{60}$",
        [("a", "100*30/24", "125", None), ("b", "80*46/12", "306.67", 0.005), ("c", "60*3.6/12.8", "16.875", None)], "a) $x = 125$   b) $x \\approx 306{,}67$   c) $x = 16{,}875$", "mv3", "cap. 6, act. 10")
problema("proporcionalidad compuesta", 2, S, "Seis personas realizan un viaje de ocho días y pagan en total 40 800 €. ¿Cuánto pagarán 15 personas si su viaje dura 5 días?", "x = 40800/(6*8)*15*5", ["63750"], "63 750 € (cada persona y día cuesta 850 €)", "mv3", "cap. 6, act. 8")
calculo("proporcionalidad compuesta", 2, S, "a) Un camión ha transportado en 3 viajes 220 sacos de patatas de 24 kg cada uno. ¿Cuántos viajes serán necesarios para transportar 550 sacos de 30 kg cada uno?   b) Una edición de 350 libros de 210 páginas cada uno alcanza un peso total de 70 kg. ¿Cuántos kg pesará otra edición de 630 libros de 140 páginas cada uno?",
        [("a", "550*30*3/(220*24)", "9.375", None), ("b", "630*140*70/(350*210)", "84", None)], "a) Saldrían 9,375: hacen falta 10 viajes   b) 84 kg", "mv3", "cap. 6, ejercicios y problemas 5 y 6")
P_ = "porcentajes"
calculo(P_, 2, ["A.5", "A.6"], "Calcula el precio final de un lavavajillas que costaba 430 € más un 21 % de IVA, al que se le ha aplicado un descuento sobre el coste total del 15 %.",
        [(None, "430*1.21*0.85", "442.255", None)], "≈ 442,26 €", "mv3", "cap. 6, act. 9")
calculo(P_, 2, ["A.5", "A.6"], "Copia en tu cuaderno y completa: a) De una factura de 127 € he pagado 111 €. Me han aplicado un __ % de descuento.   b) Me han descontado el 12 % de una factura de __ € y he pagado 365 €.   c) Por pagar al contado un mueble me han descontado el 15 % y me he ahorrado 100 €. ¿Cuál era el precio del mueble sin descuento?",
        [("a", "(127-111)/127*100", "12.6", 0.05), ("b", "365/0.88", "414.77", 0.005), ("c", "100/0.15", "666.67", 0.005)], "a) ≈ 12,6 %   b) ≈ 414,77 €   c) ≈ 666,67 €", "mv3", "cap. 6, act. 12")
problema(P_, 2, ["A.5", "A.6"], "El modelo de teléfono móvil que costaba 285 € + IVA está ahora con un 15 % de descuento. ¿Cuál es su precio rebajado? (IVA 21 %)", "x = 285*1.21*0.85", ["293.1225"], "≈ 293,12 €", "mv3", "cap. 6, ejercicios y problemas 8")
calculo(P_, 1, ["A.5", "A.6"], "a) Por retrasarse dos meses en el pago de una deuda de 1520 €, una persona debe pagar un recargo del 12 %. ¿Cuánto tiene que devolver en total?   b) ¿Qué tanto por ciento de descuento se ha aplicado en una factura de 1820 € si finalmente se pagaron 1274 €?",
        [("a", "1520*1.12", "1702.4", None), ("b", "(1820-1274)/1820*100", "30", None)], "a) 1702,40 €   b) 30 %", "mv3", "cap. 6, ejercicios y problemas 9 y 10")
problema(P_, 2, ["A.5", "A.6", "D.2"], "Al comprar un televisor he obtenido un 22 % de descuento, por lo que al final he pagado 483,60 €. ¿Cuál era el precio del televisor sin descuento?", "x-x*22/100 = 483.6", ["620"], "620 €", "mv3", "cap. 6, ejercicios y problemas 11")
problema(P_, 2, ["A.5", "A.6", "D.2"], "El precio de un viaje se anuncia a 907,50 € IVA incluido. ¿Cuál era el precio sin IVA? (IVA 21 %)", "x+x*21/100 = 907.5", ["750"], "750 €", "mv3", "cap. 6, ejercicios y problemas 13")
problema(P_, 2, ["A.5", "A.6", "D.2"], "¿Qué incremento porcentual se ha efectuado sobre un artículo que antes valía 38 € y ahora se paga a 47,12 €?", "38+38*x/100 = 47.12", ["24"], "Un 24 %", "mv3", "cap. 6, ejercicios y problemas 14")
P_ = "escalas"
calculo(P_, 1, S, "a) La distancia real entre dos pueblos es 18,5 km. Si en el mapa están a 10 cm de distancia, ¿a qué escala está dibujado?   b) ¿Qué altura tiene un edificio si su maqueta construida a escala 1 : 300 presenta una altura de 12 cm?   c) Un mapa está dibujado a escala 1 : 700 000. La distancia real entre dos ciudades es 21 km. ¿Cuál es su distancia en el mapa?",
        [("a", "18.5*100000/10", "185000", None), ("b", "300*12/100", "36", None), ("c", "21*100000/700000", "3", None)], "a) 1 : 185 000   b) 3600 cm = 36 m   c) 3 cm", "mv3", "cap. 6, act. 13 y 14; ejercicios y problemas 15")
calculo(P_, 2, S, "Copia en tu cuaderno y completa la tabla: tamaño en el dibujo 24 cm de largo y 5 cm de ancho, escala 1 : 25 000 (¿tamaño real?); tamaño en el dibujo 6 cm, tamaño real 15 km (¿escala?); tamaño real 450 m, escala 1 : 30 000 (¿tamaño en el dibujo?).",
        [("largo (km)", "24*25000/100000", "6", None), ("ancho (km)", "5*25000/100000", "1.25", None), ("escala", "15*100000/6", "250000", None), ("dibujo (cm)", "450*100/30000", "1.5", None)],
        "6 km de largo y 1,25 km de ancho; escala 1 : 250 000; 1,5 cm", "mv3", "cap. 6, ejercicios y problemas 18")
P_ = "proporcionalidad inversa"
calculo(P_, 1, S, "a) Al cortar una cantidad de madera hemos conseguido 6 paneles de 2,25 m de largo. ¿Cuántos paneles conseguiremos si ahora tienen 1,5 m de largo?   b) Para llenar un depósito se abren tres grifos que lanzan 2 litros por minuto cada uno y tardan 6 horas. ¿Cuánto tiempo tardarán 4 grifos similares que lanzan 5 litros por minuto cada uno?",
        [("a", "2.25*6/1.5", "9", None), ("b", "3*2*6/(4*5)", "1.8", None)], "a) 9 paneles   b) 1,8 h = 1 hora y 48 minutos", "mv3", "cap. 6, act. 18 y 19")
calculo(P_, 2, S, "Copia en tu cuaderno, calcula la razón de proporcionalidad inversa y completa la tabla: magnitud A: 4; 7,5; __; 3,6; __ — magnitud B: __; 12; 0,18; __; 10.",
        [("razón", "7.5*12", "90", None), ("B de 4", "90/4", "22.5", None), ("A de 0,18", "90/0.18", "500", None), ("B de 3,6", "90/3.6", "25", None), ("A de 10", "90/10", "9", None)],
        "$k' = 7{,}5 \\cdot 12 = 90$. A: 4; 7,5; 500; 3,6; 9 — B: 22,5; 12; 0,18; 25; 10", "mv3", "cap. 6, ejercicios y problemas 19")
calculo(P_, 2, S, "¿Qué velocidad debe llevar un automóvil para recorrer en 4 horas cierta distancia si a 80 km/h ha tardado 5 horas y 15 minutos?", [(None, "80*5.25/4", "105", None)], "Recorre $80 \\cdot 5{,}25 = 420$ km: 105 km/h", "mv3", "cap. 6, ejercicios y problemas 20")
calculo(P_, 2, S, "En la granja se hace el pedido de forraje para alimentar a 240 vacas durante 9 semanas. Si vende 60 vacas, ¿cuántas semanas le durará el forraje? ¿Y si en lugar de vender, compra treinta vacas? ¿Y si decide rebajar la ración una cuarta parte con las 240 vacas?",
        [("vende 60", "9*240/180", "12", None), ("compra 30", "9*240/270", "8", None), ("ración 3/4", "9/(3/4)", "12", None)], "12 semanas; 8 semanas; 12 semanas", "mv3", "cap. 6, ejercicios y problemas 22")
calculo("proporcionalidad compuesta", 3, S, "a) En un almacén se guardan reservas de comida para 80 personas durante 15 días con 3 raciones diarias. ¿Cuántos días duraría la misma comida para 75 personas con 4 raciones diarias?   b) Diez operarios instalan 3600 m de valla en 6 días. ¿Cuántos días tardarán 12 operarios en instalar 5040 m de valla?",
        [("a", "80*15*3/(75*4)", "12", None), ("b", "5040/(3600/6/10*12)", "7", None)], "a) 12 días   b) 7 días (cada operario instala 60 m al día)", "mv3", "cap. 6, ejercicios y problemas 26 y 27")
P_ = "repartos proporcionales"
calculo(P_, 1, S, "Cinco personas comparten lotería, con 10, 6, 12, 7 y 5 participaciones respectivamente. Si han obtenido un premio de 18 000 €, ¿cuánto corresponde a cada uno?",
        [("10", "18000*10/40", "4500", None), ("6", "18000*6/40", "2700", None), ("12", "18000*12/40", "5400", None), ("7", "18000*7/40", "3150", None), ("5", "18000*5/40", "2250", None)], "4500 €, 2700 €, 5400 €, 3150 € y 2250 €", "mv3", "cap. 6, act. 24")
calculo(P_, 2, S, "En un concurso se acumula puntuación de forma inversamente proporcional al número de errores. Los cuatro finalistas, con 6, 5, 2 y 1 error, deben repartirse los 1400 puntos. ¿Cuántos puntos recibirá cada uno?",
        [("6 errores", "1400*(1/6)/(1/6+1/5+1/2+1)", "125", None), ("5 errores", "1400*(1/5)/(1/6+1/5+1/2+1)", "150", None), ("2 errores", "1400*(1/2)/(1/6+1/5+1/2+1)", "375", None), ("1 error", "1400*1/(1/6+1/5+1/2+1)", "750", None)],
        "125, 150, 375 y 750 puntos", "mv3", "cap. 6, act. 25")
calculo(P_, 2, S, "En el testamento, el abuelo establece que quiere repartir entre sus nietos 22 200 €, de manera proporcional a sus edades, 12, 15 y 18 años, cuidando que la mayor cantidad sea para los nietos menores. ¿Cuánto recibirá cada uno?",
        [("12 años", "22200*(1/12)/(1/12+1/15+1/18)", "9000", None), ("15 años", "22200*(1/15)/(1/12+1/15+1/18)", "7200", None), ("18 años", "22200*(1/18)/(1/12+1/15+1/18)", "6000", None)],
        "Reparto inversamente proporcional: 9000 €, 7200 € y 6000 €", "mv3", "cap. 6, act. 26")
calculo(P_, 2, S, "Se ha decidido penalizar a las empresas que más contaminan. Para ello se reparten 2 350 000 € para subvencionar a tres empresas que presentan un 12 %, 20 % y 15 % de grado de contaminación. ¿Cuánto recibirá cada una?",
        [("12 %", "2350000*(1/12)/(1/12+1/20+1/15)", "979166.67", 0.005), ("20 %", "2350000*(1/20)/(1/12+1/20+1/15)", "587500", None), ("15 %", "2350000*(1/15)/(1/12+1/20+1/15)", "783333.33", 0.005)],
        "Inversamente proporcional al grado de contaminación: ≈ 979 166,67 €, 587 500 € y ≈ 783 333,33 € (la fuente da 9 791 666,67 €, 5 875 000 € y 7 833 333,33 €: cada cantidad multiplicada por 10, y entre las tres suman más de lo que se reparte)",
        "mv3", "cap. 6, ejercicios y problemas 33 (las cantidades de la fuente están multiplicadas por 10: errata)")
calculo(P_, 1, S, "Un trabajo se paga a 3120 €. Tres operarios lo realizan aportando el primero 22 jornadas, el segundo 16 jornadas y el tercero 14 jornadas. ¿Cuánto recibirá cada uno?",
        [("22", "3120/52*22", "1320", None), ("16", "3120/52*16", "960", None), ("14", "3120/52*14", "840", None)], "60 € por jornada: 1320 €, 960 € y 840 €", "mv3", "cap. 6, ejercicios y problemas 30")
P_ = "mezclas y aleaciones"
calculo(P_, 2, ["A.5", "A.6"], "Mezclamos 3 kg de almendras a 14 €/kg, 1,5 kg de nueces a 6 €/kg y 1,75 kg de anacardos a 18 €/kg. Calcula el precio final del paquete de 250 g de mezcla de frutos secos.",
        [("€/kg", "(3*14+1.5*6+1.75*18)/(3+1.5+1.75)", "13.2", None), ("paquete", "13.2/4", "3.3", None)], "13,20 €/kg; el paquete de 250 g, 3,30 €", "mv3", "cap. 6, ejercicios y problemas 34")
problema(P_, 2, ["A.5", "D.2"], "¿Cuántos litros de zumo de pomelo a 2,40 €/l deben mezclarse con 4 litros de zumo de naranja a 1,80 €/l para obtener una mezcla a 2,13 €/l?", "(2.4*x+1.8*4)/(x+4) = 2.13", ["44/9"], "$\\frac{1{,}32}{0{,}27} = \\frac{44}{9} \\approx 4{,}89$ litros", "mv3", "cap. 6, act. 29")
calculo(P_, 2, S, "a) Un lingote de oro pesa 340 g y contiene 280,5 g de oro puro. ¿Cuál es su ley?   b) ¿Cuántos gramos de oro contiene una joya de 0,900 de ley, que se ha formado con una aleación de 60 g de 0,950 de ley y 20 g de 0,750 de ley?",
        [("a", "280.5/340", "0.825", None), ("b", "0.95*60+0.75*20", "72", None)], "a) Ley 0,825   b) $57+15 = 72$ g de oro (y, en efecto, $\\frac{72}{80} = 0{,}9$)", "mv3", "cap. 6, ejercicios y problemas 37 y 38")
guarda(materia="matematicas", etapa="eso", curso=3, tema="proporcionalidad", titulo="Proporcionalidad directa e inversa, porcentajes, escalas y repartos",
       saberes=["A.5", "A.6", "D.2"], prefijo="m3-prop")
