import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
SB = ["B.2"]; SC = ["B.2", "C.1"]
P_ = "áreas de figuras planas"
calculo(P_, 2, SB, "Calcula el área de un triángulo equilátero de 8 m de lado (usa Pitágoras para la altura).", [(None, "8*sqrt(8**2-4**2)/2", "16*sqrt(3)", None)], "$16\\sqrt{3} \\approx 27{,}71$ m²", "mv2", "cap. 6, ej. 23")
calculo(P_, 3, SB, "Calcula el área de un hexágono regular de 7 cm de lado (usa Pitágoras para la apotema).", [(None, "6*7*sqrt(7**2-Rational(7,2)**2)/2", "147*sqrt(3)/2", None)], "$\\frac{147\\sqrt{3}}{2} \\approx 127{,}31$ cm²", "mv2", "cap. 6, ej. 24")
calculo(P_, 2, SB, "Calcula el área de un pentágono regular de 4 cm de lado y 3,4 cm de radio.", [(None, "5*4*sqrt(3.4**2-2**2)/2", "27.5", 0.01)], "Apotema $\\sqrt{3{,}4^{2} - 2^{2}} \\approx 2{,}75$ cm; área ≈ 27,5 cm²", "mv2", "cap. 6, ej. 22")
calculo(P_, 3, SB, "Calcula el área de un rombo de 4 cm de lado cuya diagonal mayor mide 6 cm.", [(None, "6*2*sqrt(4**2-3**2)/2", "6*sqrt(7)", None)], "$6\\sqrt{7} \\approx 15{,}87$ cm² (la otra diagonal mide $2\\sqrt{7}$)", "mv2", "cap. 6, ej. 29")
calculo(P_, 2, SB, "Calcula el área de un triángulo isósceles cuyos lados iguales miden 7 cm y su perímetro 20 cm.", [(None, "6*sqrt(7**2-3**2)/2", "6*sqrt(10)", None)], "Base 6 cm, altura $\\sqrt{40}$: área $6\\sqrt{10} \\approx 18{,}97$ cm²", "mv2", "cap. 6, ej. 30")
calculo(P_, 2, SB, "¿Cuál es el área de un rectángulo cuya diagonal mide 13 cm y su altura 5 cm?", [(None, "5*sqrt(13**2-5**2)", "60", None)], "Base 12 cm: área 60 cm²", "mv2", "cap. 6, ej. 31")
calculo(P_, 2, SB, "Calcula el perímetro de un rombo cuyas diagonales miden 24 y 10 cm.", [(None, "4*sqrt(12**2+5**2)", "52", None)], "Lado 13 cm: perímetro 52 cm", "mv2", "cap. 6, ej. 32")
calculo(P_, 3, SB, "Un posavasos puede ser cuadrado de 12 cm de lado o circular de 7 cm de radio. a) Calcula las dos superficies. b) ¿Cuánto reborde necesita cada uno? c) ¿Cuál es menor?",
        [("a1", "12**2", "144", None), ("a2", "pi*7**2", "153.94", 0.01), ("b1", "4*12", "48", None), ("b2", "2*pi*7", "43.98", 0.01)],
        "a) 144 cm² y $49\\pi \\approx 153{,}94$ cm²   b) 48 cm y $14\\pi \\approx 43{,}98$ cm   c) El cuadrado tiene menos superficie; el círculo, menos reborde", "mv2", "cap. 6, ej. 38")
calculo(P_, 3, SB, "Un terreno rectangular de 200 m por 60 m y otro cuadrado tienen el mismo perímetro. Calcula las diagonales y las áreas. ¿Cuál tiene más superficie?",
        [("lado", "2*(200+60)/4", "130", None), ("área cuadrado", "130**2", "16900", None), ("área rectángulo", "200*60", "12000", None), ("diag. cuadrado", "130*sqrt(2)", "183.85", 0.01), ("diag. rect.", "sqrt(200**2+60**2)", "208.81", 0.01)],
        "Lado del cuadrado 130 m. Diagonales ≈ 183,85 m y ≈ 208,81 m. Áreas 16900 m² y 12000 m²: el cuadrado tiene más", "mv2", "cap. 6, ej. 37")
P_ = "cuerpos: volúmenes y áreas"
calculo(P_, 2, SC, "Calcula la diagonal de un ortoedro de lados 8, 3 y 5 cm.", [(None, "sqrt(8**2+3**2+5**2)", "7*sqrt(2)", None)], "$\\sqrt{98} = 7\\sqrt{2} \\approx 9{,}90$ cm", "mv2", "cap. 7, ej. 22")
calculo(P_, 1, SB, "Calcula el área total y el volumen de un cubo de 10 cm de lado.", [("área", "6*10**2", "600", None), ("volumen", "10**3", "1000", None)], "600 cm² y 1000 cm³", "mv2", "cap. 7, ej. 50")
calculo(P_, 2, SB, "Calcula la superficie lateral y total de un prisma hexagonal regular de 12 cm de altura y 6 cm de lado de la base.", [("lateral", "6*6*12", "432", None), ("total", "432+2*6*6*sqrt(6**2-3**2)/2", "432+108*sqrt(3)", None)], "Lateral 432 cm²; total $432 + 108\\sqrt{3} \\approx 619{,}06$ cm²", "mv2", "cap. 7, ej. 37")
calculo(P_, 2, SB, "Calcula el volumen de un cono de generatriz 8 cm y radio de la base 3 cm.", [(None, "pi*3**2*sqrt(8**2-3**2)/3", "3*pi*sqrt(55)", None)], "$3\\sqrt{55}\\,\\pi \\approx 69{,}90$ cm³ (altura $\\sqrt{55}$)", "mv2", "cap. 7, ej. 35")
calculo(P_, 2, SB, "Un cono tiene 7 cm de altura y 2 cm de radio. Calcula su volumen, su generatriz y su superficie lateral.", [("volumen", "pi*2**2*7/3", "28*pi/3", None), ("generatriz", "sqrt(7**2+2**2)", "sqrt(53)", None), ("lateral", "pi*2*sqrt(53)", "2*pi*sqrt(53)", None)], "$V = \\frac{28\\pi}{3} \\approx 29{,}32$ cm³; $g = \\sqrt{53} \\approx 7{,}28$ cm; lateral $2\\sqrt{53}\\,\\pi \\approx 45{,}74$ cm²", "mv2", "cap. 7, ej. 56")
calculo(P_, 2, SB, "Un rectángulo de lados 3 y 8 cm gira alrededor de su lado mayor. Calcula la superficie lateral y total del cilindro que genera.", [("lateral", "2*pi*3*8", "48*pi", None), ("total", "48*pi+2*pi*3**2", "66*pi", None)], "Lateral $48\\pi \\approx 150{,}80$ cm²; total $66\\pi \\approx 207{,}35$ cm²", "mv2", "cap. 7, ej. 57")
calculo(P_, 3, SB, "Llenamos de arena un cono de 7 cm de altura y 4 cm de radio y la vaciamos en un cilindro de 4 cm de radio. ¿Qué altura alcanza la arena?", [(None, "(pi*4**2*7/3)/(pi*4**2)", "7/3", None)], "$\\frac{7}{3} \\approx 2{,}33$ cm (un tercio de la altura del cono)", "mv2", "cap. 7, ej. 52")
calculo(P_, 2, SB, "Calcula la superficie y el volumen de una esfera cuya circunferencia máxima mide $10\\pi$ m.", [("superficie", "4*pi*5**2", "100*pi", None), ("volumen", "4*pi*5**3/3", "500*pi/3", None)], "Radio 5 m: $S = 100\\pi \\approx 314{,}16$ m²; $V = \\frac{500\\pi}{3} \\approx 523{,}60$ m³", "mv2", "cap. 7, ej. 53")
calculo(P_, 2, SB, "Duplicamos la arista de un cubo de 5 cm. ¿Qué pasa con el área de una cara? ¿Y con el volumen?", [("cara", "10**2/5**2", "4", None), ("volumen", "10**3/5**3", "8", None)], "La cara se multiplica por 4 (de 25 a 100 cm²) y el volumen por 8 (de 125 a 1000 cm³)", "mv2", "cap. 7, ej. 59")
calculo(P_, 3, SB, "Un depósito cilíndrico de 100 L tiene 100 cm de altura. ¿Cuánto mide el radio de su base?", [(None, "sqrt(100000/(pi*100))", "17.84", 0.01)], "≈ 17,84 cm (100 L = 100 000 cm³)", "mv2", "cap. 7, ej. 60")
calculo(P_, 2, SC, "Calcula el radio de la esfera inscrita y el de la circunscrita a un cubo de 10 cm de lado.", [("inscrita", "10/2", "5", None), ("circunscrita", "sqrt(3*10**2)/2", "5*sqrt(3)", None)], "Inscrita 5 cm; circunscrita $5\\sqrt{3} \\approx 8{,}66$ cm", "mv2", "cap. 7, ej. 49")
calculo("relación de Euler", 1, ["C.1"], "Cuenta caras, aristas y vértices de un cubo, un prisma hexagonal y una pirámide triangular, y comprueba que $C + V = A + 2$.", [("cubo", "6+8-12", "2", None), ("prisma", "8+12-18", "2", None), ("pirámide", "4+4-6", "2", None)], "Cubo 6, 12, 8; prisma hexagonal 8, 18, 12; pirámide triangular 4, 6, 4. En los tres $C + V - A = 2$", "mv2", "cap. 7, ej. 12")
guarda(materia="matematicas", etapa="eso", curso=2, tema="areas-y-volumenes", titulo="Áreas y volúmenes",
       saberes=["B.1", "B.2", "C.1"], prefijo="m2-are")
