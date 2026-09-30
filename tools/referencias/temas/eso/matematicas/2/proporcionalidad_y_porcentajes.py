import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.5"]; SF = ["A.5", "A.6"]
P_ = "proporcionalidad directa"
problema(P_, 1, S, "Con 8 kg de harina hemos hecho 15 pasteles. ¿Cuántos podemos hacer con 30 kg?", "x/30 = 15/8", ["225/4"], "$56{,}25$: 56 pasteles", "mv2", "cap. 9, ej. 3")
ej(P_, 2, S, "Completa la tabla de proporcionalidad directa y calcula la constante:\n\n| Litros de gasolina | 8 | 25 | | 4 | |\n|---|---|---|---|---|---|\n| Euros | 11,36 | | 56,8 | | 25,56 |",
   comprobar=[{"tipo": "valor", "apartado": "k", "expresion": "11.36/8", "respuesta": "1.42"}, {"tipo": "valor", "apartado": "a", "expresion": "25*1.42", "respuesta": "35.5"}, {"tipo": "valor", "apartado": "b", "expresion": "56.8/1.42", "respuesta": "40"}, {"tipo": "valor", "apartado": "c", "expresion": "4*1.42", "respuesta": "5.68"}, {"tipo": "valor", "apartado": "d", "expresion": "25.56/1.42", "respuesta": "18"}],
   solucion="Constante 1,42 €/l. Faltan: 35,5 €; 40 l; 5,68 €; 18 l", fuente="mv2", ref="cap. 9, ej. 4")
problema(P_, 2, S, "Cada gominola cuesta 5 céntimos y pesa 4 g. Compramos una bolsa de 100 g. ¿Cuántas gominolas trae y cuánto cuesta?", "x = 100/4", ["25"], "25 gominolas, 1,25 €", "mv2", "cap. 9, ej. 10")
problema(P_, 2, S, "Expresa en euros 1400 $, si cada euro cotiza a 1,26 $.", "1.26*x = 1400", ["10000/9"], "$1111{,}11$ € (= 10000/9)", "mv2", "cap. 9, ej. 13")
P_ = "proporcionalidad inversa"
problema(P_, 2, S, "Con 48 € puedo comprar 20 piezas de madera. Si costaran 1,50 € cada una, ¿cuántas podría comprar?", "1.5*x = 48", ["32"], "32 piezas", "mv2", "cap. 9, ej. 6")
problema(P_, 2, S, "Tenemos pienso para 45 vacas durante 30 días. Si vendemos 9 vacas, ¿para cuántos días tendremos?", "36*x = 45*30", ["75/2"], "37,5 días", "mv2", "cap. 9, ej. 8")
ej(P_, 2, S, "Completa la tabla de proporcionalidad inversa:\n\n| Velocidad (km/h) | 90 | 120 | | 75 | |\n|---|---|---|---|---|---|\n| Tiempo (h) | 4,5 | | 10 | | 3 |",
   comprobar=[{"tipo": "valor", "apartado": "k", "expresion": "90*4.5", "respuesta": "405"}, {"tipo": "valor", "apartado": "a", "expresion": "405/120", "respuesta": "3.375"}, {"tipo": "valor", "apartado": "b", "expresion": "405/10", "respuesta": "40.5"}, {"tipo": "valor", "apartado": "c", "expresion": "405/75", "respuesta": "5.4"}, {"tipo": "valor", "apartado": "d", "expresion": "405/3", "respuesta": "135"}],
   solucion="Producto constante 405. Faltan: 3,375 h; 40,5 km/h; 5,4 h; 135 km/h", fuente="mv2", ref="cap. 9, ej. 9")
problema(P_, 2, S, "Con dos grifos un depósito se llena en 4 horas y media. ¿Cuánto tardarán cinco grifos iguales?", "5*x = 2*4.5", ["1.8"], "1,8 h (1 h 48 min)", "mv2", "cap. 9, ej. 11")
problema(P_, 2, S, "Para vaciar un depósito se han usado 17 cubos de 22 litros. ¿Cuántos cubos de 34 litros harían falta?", "34*x = 17*22", ["11"], "11 cubos", "mv2", "cap. 9, ej. 18")
ej("directa o inversa", 1, S, "¿Directa o inversamente proporcionales? a) Árboles talados y kilos de leña. b) Velocidad del tren y tiempo que tarda. c) Tamaño de la bolsa y número de bolsas para la compra. d) Distancia recorrida y gasolina gastada. e) Invitados y tamaño del trozo de tarta. f) Radio de una circunferencia y su longitud.",
   solucion="a) directa   b) inversa   c) inversa   d) directa   e) inversa   f) directa", fuente="mv2", ref="cap. 9, ej. 17")
P_ = "porcentajes"
problema(P_, 1, SF, "Una batidora vale 110 € + IVA (21 %). ¿Cuál es el precio final?", "x = 110*1.21", ["133.1"], "133,10 €", "mv2", "cap. 9, ej. 5")
problema(P_, 2, SF, "Un pantalón costaba 36 € y en rebajas se vende a 28 €. ¿Qué porcentaje han rebajado?", "36*(1-x/100) = 28", ["200/9"], "Un 22,2 % (= 200/9 %)", "mv2", "cap. 9, ej. 15")
problema(P_, 2, SF, "Una televisión cuesta 847 € con el IVA (21 %) incluido. ¿Cuál es el precio sin IVA?", "1.21*x = 847", ["700"], "700 €", "mv2", "cap. 9, ej. 16")
problema(P_, 2, SF, "El agua al congelarse aumenta un 10 % su volumen. ¿Cuántos litros de agua hacen falta para una barra de hielo de 75 dm³?", "1.1*x = 75", ["750/11"], "68,18 litros (= 750/11)", "mv2", "cap. 9, ej. 14")
problema(P_, 2, SF, "Un portátil cuesta 899 € con el IVA (21 %) incluido. ¿Cuál es su precio sin IVA?", "1.21*x = 899", ["89900/121"], "742,98 € (= 89900/121)", "mv2", "cap. 9, ej. 23")
problema(P_, 3, SF, "Un empleado que gana 1154 € netos al mes sufre un recorte del 5 %. ¿Cuánto deja de ganar en un trimestre?", "x = 3*1154*0.05", ["173.1"], "173,10 €", "mv2", "cap. 9, ej. 21")
P_ = "escalas"
problema(P_, 2, S, "En un mapa a escala 1 : 250 000, la distancia entre dos puntos es de 0,15 m. ¿Cuál es la distancia real en km?", "x = 0.15*250000/1000", ["37.5"], "37,5 km", "mv2", "cap. 9, ej. 26")
problema(P_, 2, S, "En un dibujo el campo de fútbol mide 24 cm por 16 cm. El campo real mide 90 m de largo. ¿Cuánto mide de ancho? ¿A qué escala está dibujado?", "x/16 = 90/24", ["60"], "60 m de ancho; escala 1 : 375", "mv2", "cap. 9, ej. 25")
P_ = "proporcionalidad compuesta"
problema(P_, 3, S, "Con 840 kg de pienso se alimenta a 12 animales durante 8 días. ¿Cuántos animales se podrían alimentar con 2130 kg durante 15 días?", "x = 12*(2130/840)*(8/15)", ["568/35"], "16,2: 16 animales", "mv2", "cap. 9, ej. 28")
guarda(materia="matematicas", etapa="eso", curso=2, tema="proporcionalidad-y-porcentajes", titulo="Proporcionalidad y porcentajes",
       saberes=["A.5", "A.6"], prefijo="m2-pro")
