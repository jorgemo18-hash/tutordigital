import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["D.4"]; SP = ["D.2", "D.4"]
# --- Marea Verde, cap. 10 ---
ecuaciones("ecuación de un paso", 1, S, "Resuelve mentalmente:", ["x+3 = 2", "x-2 = 3", "x/5 = 1", "x/3+2/3 = 4/3"], "mv2", "cap. 10, ej. 11")
ecuaciones("ecuación de un paso", 1, S, "Resuelve:", ["x+6 = 3", "15 = 11+x", "7-x = 2", "3 = 9-x", "-12 = 3*x", "4*x = 11", "x/(-2) = 3", "x/7 = 3/14"], "mv2", "cap. 10, ej. 22 (series 1–4)")
ecuaciones("x en los dos miembros", 1, S, "Resuelve las siguientes ecuaciones:", ["2*x-5 = 4*x-7", "x-12 = 7*x+6", "x-1 = x+5*x+9", "x+9 = 3*x-3", "5*x-x+7 = 2*x+15", "2*x-27 = x", "3*x-4+x = 8", "3-10 = x+1"], "mv2", "cap. 10, ej. 13")
ecuaciones("x en los dos miembros", 2, S, "Resuelve:", ["x+3*x = 16", "3*x-2+4*x = 3-3*x+1", "4*x-3+x = 3*x+7", "x+4+4*x = 2-2*x+5", "6*x+4-2*x = 3+2*x-7"], "mv2", "cap. 10, ej. 22 (5.ª serie)")
ecuaciones("con paréntesis", 2, S, "Resuelve:", ["5*(x-2) = 70", "-2*(3*x-4) = 2*x+5", "2*(x+7) = x", "3*(x+3*x) = x+50", "2*x-(2*x-3)+x = 4"], "mv2", "cap. 10, ej. 17–20")
ecuaciones("con paréntesis", 2, S, "Resuelve:", ["3+4*(2-x) = 9-2*x", "13+3*(2*x+5) = 2*(x+3)-1", "7-2*(3*x-5) = 13-2*(4*x-7)", "5*x-3*(2*x-4) = 36-3*(4*x+6)", "2*(x+4)+3*x = -34-3*(5*x+6)", "3*x-4*(x-1) = 8-5*x"], "mv2", "cap. 10, ej. 22 (7.ª serie)")
ecuaciones("con denominadores", 2, S, "Resuelve:", ["x/3-2 = 4", "3*x/5+4 = 3", "x/2+x/2+3 = 5", "x+x/5 = 7", "x/3+x/6 = 12", "x/6+x/3+x/2 = 5", "(x-3)/5 = x", "4*x/3+5*x/6 = x/3+2"], "mv2", "cap. 10, ej. 22 (6.ª y 8.ª serie)")
# --- Alfonso González ---
ecuaciones("con paréntesis", 2, S, "Resuelve e indica si alguna es una identidad o no tiene solución:", ["2*(x-1) = 4*(2*x-3)", "6*(x+3) = 2*(5*x-8)", "5*(x-1) = 5*(x+2)", "2*(3*x+2)-3*(2*x-1) = 7", "5*(2*x-3)-8*(4*x-9) = 6"], "ag2", "ficha 1, ej. 3", respuestas=["5/3", "17/2", "sin solución", "identidad", "51/22"])
ecuaciones("paréntesis anidados", 3, S, "Resuelve:", ["5*(2*x-4*(3*x+1)) = -10*x+20", "x-13 = 4*(3*x-4*(x-2))", "3*(6*x-5*(x-3)) = 15-3*(x-5)", "3-2*x+4*(3+5*(x+1)) = 10*x-7"], "ag2", "ficha 1, ej. 4", respuestas=["-1", "9", "-5/2", "-21/4"])
ecuaciones("con denominadores", 3, S, "Resuelve quitando denominadores:", ["(x-1)/2+(x+1)/4 = 2", "(2*x-1)/3+(x+3)/5 = 2", "(x+2)/6-x/2 = 3", "1+(x+1)/3 = x/4", "(3*x+8)/3 = (2*x-1)/6", "(5*x-9)/4-(3*x+5)/4 = 2/3"], "ag2", "ficha 1, ej. 5", respuestas=["3", "2", "-8", "-16", "-17/4", "25/3"])
ecuaciones("con denominadores", 3, S, "Resuelve:", ["x-2*(x-1) = x/2-(x+1)/3", "(5-x)/15-9/5 = -x-(1-x)/3", "Rational(2,3)*(2*(x+1)-(x+1)/2) = 5*(x/2-(2*x-1)/6)"], "ag2", "ficha 1, ej. 5", respuestas=["2", "17/9", "-1"])
# --- IES Oja ---
ecuaciones("con paréntesis", 2, S, "Resuelve:", ["3*(x-6) = -5*(2-x)", "1-2*(x-4) = 4*x-3*(2-5*x)", "-4*(x-2) = 3*(2-x)"], "oja", "ej. 2")
ecuaciones("con denominadores", 2, S, "Resuelve:", ["2*x+1 = (x-6)/5", "x/2-4 = x/3+3", "x/4+5/3 = x/6-1/2"], "oja", "ej. 3")
# --- Problemas (Marea Verde, cap. 10) ---
P_ = "problema"
problema(P_, 2, SP, "Si un repartidor ha dejado los 2/5 de los paquetes que llevaba en la primera casa y aún le quedan 99 kg por repartir, ¿cuántos kilos tenía al principio?", "x-2*x/5 = 99", ["165"], "165 kg", "mv2", "cap. 10, ej. 23")
problema(P_, 2, SP, "En una granja hay 70 animales entre gallinas y conejos, y entre todos suman 180 patas. ¿Cuántas gallinas hay?", "2*x+4*(70-x) = 180", ["50"], "50 gallinas (y 20 conejos)", "mv2", "cap. 10, ej. 25")
problema(P_, 1, SP, "Halla el número tal que su doble más tres sea igual que su triple menos dos.", "2*x+3 = 3*x-2", ["5"], "5", "mv2", "cap. 10, ej. 26")
problema(P_, 2, SP, "Repartimos 150 € entre tres personas de forma que la primera recibe el doble que la segunda y esta el triple que la tercera. ¿Cuánto le corresponde a cada una?", "6*x+3*x+x = 150", ["15"], "90 €, 45 € y 15 €", "mv2", "cap. 10, ej. 27")
problema(P_, 3, SP, "El ángulo mayor de un triángulo mide el doble que el menor, y este mide 20° menos que el mediano. ¿Cuánto mide cada ángulo? (Los tres suman 180°.)", "x+(x+20)+2*x = 180", ["40"], "40°, 60° y 80°", "mv2", "cap. 10, ej. 28")
problema(P_, 1, SP, "Si al quíntuplo de un número le restas dos, obtienes 27. ¿Cuál es el número?", "5*x-2 = 27", ["29/5"], "29/5 = 5,8", "mv2", "cap. 10, ej. 29")
problema(P_, 1, SP, "Un número y su siguiente suman 87. ¿Cuáles son?", "x+(x+1) = 87", ["43"], "43 y 44", "mv2", "cap. 10, ej. 30")
problema(P_, 2, SP, "Un bolígrafo cuesta el triple que un lápiz. Cinco lápices y cuatro bolígrafos me han costado 2,55 €. ¿Cuánto cuesta cada uno?", "5*x+4*3*x = 2.55", ["0.15"], "Lápiz 0,15 €; bolígrafo 0,45 €", "mv2", "cap. 10, ej. 31")
problema(P_, 2, SP, "En el monedero llevo diez monedas, unas de 50 céntimos y otras de 20 céntimos. Si tengo 2,90 € en total, ¿cuántas monedas hay de cada tipo?", "50*x+20*(10-x) = 290", ["3"], "3 de 50 céntimos y 7 de 20 céntimos", "mv2", "cap. 10, ej. 32")
problema(P_, 2, SP, "El perímetro de un rectángulo es de 120 m y la altura mide 24 m más que la base. ¿Cuánto miden la base y la altura?", "2*x+2*(x+24) = 120", ["18"], "Base 18 m; altura 42 m", "mv2", "cap. 10, ej. 33")
problema(P_, 2, SP, "Laura dice que si al triple de su edad le restas la mitad, el resultado es 30. ¿Qué edad tiene Laura?", "3*x-3*x/2 = 30", ["20"], "20 años", "mv2", "cap. 10, ej. 34")
problema(P_, 2, SP, "Un hijo tiene 12 años y su padre 35. ¿Cuántos años deben pasar para que la edad del padre sea el doble que la del hijo?", "35+t = 2*(12+t)", ["11"], "11 años", "mv2", "cap. 10, ej. 35", var="t")
problema(P_, 2, SP, "Calcula los lados de un triángulo isósceles de perímetro 18 cm, sabiendo que cada lado igual mide 3 cm más que el desigual.", "x+2*(x+3) = 18", ["4"], "Lado desigual 4 cm; lados iguales 7 cm", "mv2", "cap. 10, ej. 37")
problema(P_, 2, SP, "Si a la tercera parte de un número le sumas dos, obtienes lo mismo que si al número le sumas uno y divides entre dos. ¿Qué número es?", "x/3+2 = (x+1)/2", ["9"], "9", "mv2", "cap. 10, ej. 38")
problema(P_, 2, SP, "Hemos comprado 12 artículos entre mesas y sillas. Cada mesa cuesta 130 €, cada silla 60 € y en total hemos pagado 860 €. ¿Cuántas mesas y cuántas sillas hemos comprado?", "130*x+60*(12-x) = 860", ["2"], "2 mesas y 10 sillas", "mv2", "cap. 10, ej. 40")
problema(P_, 3, SP, "Epitafio de Diofanto: su infancia fue la sexta parte de su vida; una duodécima parte después le salió barba; tras una séptima parte se casó; cinco años después nació su hijo, que vivió la mitad que su padre; y Diofanto murió cuatro años después que su hijo. a) Escribe la ecuación. b) ¿Cuántos años vivió?", "x/6+x/12+x/7+5+x/2+4 = x", ["84"], "a) $\\frac{x}{6}+\\frac{x}{12}+\\frac{x}{7}+5+\\frac{x}{2}+4 = x$; b) 84 años", "mv2", "cap. 10, ej. 42")
# --- Problemas (IES Oja) ---
problema(P_, 2, SP, "Juan tiene 50 años y su hijo Manuel 30. ¿Hace cuántos años la edad del hijo era la mitad de la del padre?", "30-t = (50-t)/2", ["10"], "Hace 10 años", "oja", "ej. 10", var="t")
problema(P_, 2, SP, "Paula tiene 12 años y su madre 44. ¿Cuántos años tienen que pasar para que la edad de la madre sea el triple de la de su hija?", "44+t = 3*(12+t)", ["4"], "4 años", "oja", "ej. 14", var="t")
problema(P_, 3, SP, "Un recipiente está lleno de agua. Si sacamos primero la mitad de su contenido y después la mitad de lo que quedaba, aún quedan 400 litros. ¿Qué capacidad tiene?", "x-x/2-x/4 = 400", ["1600"], "1600 litros", "oja", "ej. 16")
problema(P_, 2, SP, "Encuentra un número cuya mitad, más su cuarta parte, más 1, sea igual al propio número.", "x/2+x/4+1 = x", ["4"], "4", "oja", "ej. 13")
guarda(materia="matematicas", etapa="eso", curso=2, tema="ecuaciones-primer-grado", titulo="Ecuaciones de primer grado",
       saberes=["D.2", "D.4"], prefijo="m2-ec1")
