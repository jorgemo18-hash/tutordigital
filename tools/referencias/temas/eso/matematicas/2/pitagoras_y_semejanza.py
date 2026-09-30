import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["B.2", "C.1"]
P_ = "teorema de Pitágoras"
calculo(P_, 1, S, "¿Se puede construir un triángulo rectángulo de catetos 10 cm y 6 cm e hipotenusa 15 cm? Razona.", [(None, "10**2+6**2", "136", None), (None, "15**2", "225", None)], "No: $10^{2}+6^{2} = 136 \\neq 225 = 15^{2}$", "mv2", "cap. 6, ej. 1")
calculo(P_, 1, S, "Calcula la hipotenusa de los triángulos rectángulos de catetos: a) 16 cm y 12 cm   b) 40 m y 30 m   c) 5 dm y 9,4 dm   d) 2,9 km y 6,3 km",
        [("a", "sqrt(16**2+12**2)", "20", None), ("b", "sqrt(40**2+30**2)", "50", None), ("c", "sqrt(5**2+9.4**2)", "10.65", 0.01), ("d", "sqrt(2.9**2+6.3**2)", "6.94", 0.01)],
        "a) 20 cm   b) 50 m   c) ≈ 10,65 dm   d) ≈ 6,94 km", "mv2", "cap. 6, ej. 5")
calculo(P_, 2, S, "Calcula el cateto que falta, conocidos la hipotenusa y un cateto: a) 25 cm y 15 cm   b) 35 m y 21 m   c) 42 dm y 25 dm   d) 6,1 km y 4,2 km",
        [("a", "sqrt(25**2-15**2)", "20", None), ("b", "sqrt(35**2-21**2)", "28", None), ("c", "sqrt(42**2-25**2)", "33.75", 0.01), ("d", "sqrt(6.1**2-4.2**2)", "4.42", 0.01)],
        "a) 20 cm   b) 28 m   c) ≈ 33,75 dm   d) ≈ 4,42 km", "mv2", "cap. 6, ej. 6")
calculo(P_, 1, S, "¿Cuánto mide la diagonal de un rectángulo de 8,2 cm por 6,9 cm?", [(None, "sqrt(8.2**2+6.9**2)", "10.72", 0.01)], "≈ 10,72 cm", "mv2", "cap. 6, ej. 4")
calculo(P_, 1, S, "Calcula la diagonal de un cuadrado de 8 m de lado.", [(None, "sqrt(8**2+8**2)", "8*sqrt(2)", None)], "$8\\sqrt{2} \\approx 11{,}31$ m", "mv2", "cap. 6, ej. 7")
calculo(P_, 2, S, "Un triángulo rectángulo tiene un cateto de 6 cm y la hipotenusa de 10 cm. ¿Cuál es su perímetro? ¿Y su área?", [("perímetro", "6+10+sqrt(10**2-6**2)", "24", None), ("área", "6*sqrt(10**2-6**2)/2", "24", None)], "El otro cateto mide 8 cm: perímetro 24 cm, área 24 cm²", "mv2", "cap. 6, ej. 9")
calculo(P_, 2, S, "Para sujetar un árbol se ata una cuerda a 2,5 m de altura y se fija al suelo a 3 m del tronco. ¿Cuánta cuerda hace falta?", [(None, "sqrt(2.5**2+3**2)", "3.91", 0.01)], "≈ 3,91 m", "mv2", "cap. 6, ej. 27")
calculo(P_, 2, S, "Una cometa tiene una cuerda de 15 m y está justo encima de una farola que está a 5 m de Javier. ¿A qué altura está la cometa?", [(None, "sqrt(15**2-5**2)", "10*sqrt(2)", None)], "$10\\sqrt{2} \\approx 14{,}14$ m", "mv2", "cap. 6, ej. 28")
calculo(P_, 2, S, "Una escalera debe alcanzar 7 m de altura y se separa 2 m de la pared. ¿Cuánto mide?", [(None, "sqrt(7**2+2**2)", "sqrt(53)", None)], "$\\sqrt{53} \\approx 7{,}28$ m", "mv2", "cap. 6, ej. 36")
calculo(P_, 2, S, "¿Cuánto debe medir el travesaño diagonal de una ventana de 1,2 m de ancho y 1,5 m de alto?", [(None, "sqrt(1.2**2+1.5**2)", "1.92", 0.01)], "≈ 1,92 m", "mv2", "cap. 6, ej. 39")
calculo(P_, 3, S, "Un cubo tiene 8 cm de arista. Calcula la diagonal de una cara y la diagonal del cubo.", [("cara", "sqrt(8**2+8**2)", "8*sqrt(2)", None), ("cubo", "sqrt(3*8**2)", "8*sqrt(3)", None)], "Cara: $8\\sqrt{2} \\approx 11{,}31$ cm; cubo: $8\\sqrt{3} \\approx 13{,}86$ cm", "mv2", "cap. 6, ej. 41")
calculo(P_, 3, S, "Un cono tiene 10 cm de altura y 12 cm de generatriz. ¿Cuánto mide el radio de la base?", [(None, "sqrt(12**2-10**2)", "2*sqrt(11)", None)], "$2\\sqrt{11} \\approx 6{,}63$ cm", "mv2", "cap. 6, ej. 43")
calculo(P_, 3, S, "La pirámide de Keops tiene unos 230 m de lado de base y la altura de una cara mide unos 180 m. ¿Cuánto mide la altura de la pirámide?", [(None, "sqrt(180**2-115**2)", "138.47", 0.01)], "≈ 138,5 m", "mv2", "cap. 6, ej. 40")
P_ = "semejanza y Thales"
ej(P_, 2, S, "¿Son semejantes? a) Un triángulo con ángulos de 30° y 20° y otro con ángulos de 120° y 20°.   b) Un isósceles con ángulo desigual de 80° y otro isósceles con un ángulo igual de 50°.   c) $A = 40°$, $b = 8$, $c = 12$ y $A' = 40°$, $b' = 4$, $c' = 6$.   d) Lados 3, 4, 6 y 12, 16, 24 cm.",
   solucion="a) Sí (130°, 30°, 20° en los dos)   b) Sí (80°, 50°, 50°)   c) Sí (ángulo igual y lados proporcionales, razón 2)   d) Sí (razón 4)", fuente="mv2", ref="cap. 6, ej. 10")
calculo(P_, 2, S, "Calcula el dato que falta para que los triángulos sean semejantes: a) $a = 15$, $b = 9$, $c = 12$ cm; $a' = 10$, $b' = 4$ cm, ¿$c'$?   b) $A = 50°$, $b = 3$, $c = 7$; $A' = 50°$, $b' = 18$, ¿$c'$?",
        [("b", "7*18/3", "42", None)], "b) $c' = 42$ cm (razón 6). En a) los datos no son proporcionales ($10/15 \\neq 4/9$): no hay $c'$ que los haga semejantes", "mv2", "cap. 6, ej. 11")
calculo(P_, 2, S, "Los lados de un triángulo miden 12, 14 y 14 cm. Otro semejante tiene 80 cm de perímetro. ¿Cuánto miden sus lados?", [("a", "12*80/40", "24", None), ("b", "14*80/40", "28", None)], "24, 28 y 28 cm (razón 2)", "mv2", "cap. 6, ej. 12")
calculo(P_, 2, S, "La sombra de un edificio mide 15 m y la del primer piso 2 m. Si el primer piso mide 3 m de alto, ¿cuánto mide el edificio?", [(None, "15*3/2", "22.5", None)], "22,5 m", "mv2", "cap. 6, ej. 15")
calculo(P_, 2, S, "Un triángulo rectángulo de altura 6 cm y base 15 cm es semejante a otro de base 30 cm. Calcula la altura del nuevo triángulo y las áreas de ambos.", [("altura", "6*30/15", "12", None), ("área 1", "15*6/2", "45", None), ("área 2", "30*12/2", "180", None)], "Altura 12 cm; áreas 45 cm² y 180 cm² (se multiplica por $2^{2}$)", "mv2", "cap. 6, ej. 20")
calculo(P_, 3, S, "En un mapa a escala 1 : 5 000 000 un pueblo ocupa 700 cm². ¿Cuál es su superficie real?", [(None, "700*5000000**2/10**10", "1750000", None)], "1 750 000 km² (el área se multiplica por el cuadrado de la escala). El dato es poco realista: sale más grande que España", "mv2", "cap. 6, ej. 18")
guarda(materia="matematicas", etapa="eso", curso=2, tema="pitagoras-y-semejanza", titulo="Teorema de Pitágoras, Thales y semejanza",
       saberes=["B.2", "C.1"], prefijo="m2-pit")
