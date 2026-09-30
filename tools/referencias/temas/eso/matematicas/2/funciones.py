import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["D.5"]
ej("cuadrantes", 1, ["D.5"], "Sin representarlos, di en qué cuadrante o eje están: $M = (4, -\\frac{5}{2})$, $N = (\\frac{1}{2}, \\frac{1}{2})$, $P = (-6, -\\frac{9}{5})$, $Q = (-\\frac{7}{2}, 5)$, $R = (2, 0)$, $S = (-7, 0)$, $T = (0, -\\frac{7}{2})$, $U = (0, 7)$, $O = (0, 0)$.",
   solucion="M: 4.º; N: 1.º; P: 3.º; Q: 2.º; R y S: eje de abscisas; T y U: eje de ordenadas; O: origen", fuente="mv2", ref="cap. 11, ej. 2")
ej("simetría en el plano", 2, ["D.5", "C.4"], "Una vasija tiene sus vértices en $A(3,2)$, $B(6,2)$, $C(7,6)$, $D(5,8)$, $E(5,11)$, $F(4,11)$, $G(4,8)$ y $H(2,6)$. a) Escribe las coordenadas de la vasija reflejada respecto del eje Y. b) ¿Y respecto del eje X? c) ¿Qué relación hay entre las coordenadas?",
   solucion="a) $(-3,2), (-6,2), (-7,6), (-5,8), (-5,11), (-4,11), (-4,8), (-2,6)$: cambia de signo la $x$   b) $(3,-2), (6,-2), (7,-6), (5,-8), (5,-11), (4,-11), (4,-8), (2,-6)$: cambia de signo la $y$", fuente="mv2", ref="cap. 11, ej. 3–4")
ej("interpretar una gráfica", 2, S, "Juan sale en bici y su distancia a casa (km) según el tiempo (h) pasa por los puntos $(0,0)$, $(1,50)$, $(2,60)$, $(3,30)$, $(5,30)$ y $(6,0)$, unidos por segmentos. a) ¿A qué distancia máxima llega? b) ¿Cuánto tiempo está parado? c) ¿Cuánto tarda en volver desde el punto más lejano? d) ¿A qué distancia está a las dos horas? e) ¿Cuándo va más deprisa?",
   solucion="a) 60 km   b) 2 h (de 3 a 5 h)   c) 4 h   d) 60 km   e) En la primera hora, a 50 km/h", fuente="mv2", ref="cap. 11, ej. 10")
ej("es o no función", 1, S, "¿Son funciones? Si lo son, di cuál es la variable independiente y cuál la dependiente: a) La temperatura del puré a lo largo del tiempo. b) El precio de una camiseta y su color. c) El área de un cuadrado y su lado. d) El precio de las naranjas compradas y su peso. e) El volumen de una esfera y su radio.",
   solucion="a) Sí: tiempo → temperatura   b) No   c) Sí: lado → área   d) Sí: peso → precio   e) Sí: radio → volumen", fuente="mv2", ref="cap. 11, ej. 14")
ej("tabla, gráfica y fórmula", 1, S, "Haz una tabla con cuatro valores y escribe la fórmula de: a) El precio de la miel si el kilo cuesta 7 €. b) Un número y su mitad. c) El perímetro de un triángulo equilátero y su lado.",
   solucion="a) $y = 7x$ (3 kg → 21 €)   b) $y = \\frac{x}{2}$   c) $P = 3l$ (lado 5 → 15)", fuente="mv2", ref="cap. 11, ej. 13")
calculo("función lineal", 2, S, "Una bañera de 500 litros se vacía a razón de 25 litros por minuto. Escribe la fórmula, di cuál es la variable independiente y calcula cuánta agua queda a los 8 minutos y cuándo se vacía.",
        [("8 min", "500-25*8", "300", None), ("vacía", "500/25", "20", None)], "$y = 500 - 25x$ ($x$ en minutos). A los 8 min quedan 300 L; se vacía a los 20 min", "mv2", "cap. 11, ej. 20")
calculo("función lineal", 1, S, "En una papelería 10 lápices cuestan 2,5 €. Escribe la expresión algebraica y calcula el precio de 7 lápices.", [(None, "2.5/10*7", "1.75", None)], "$y = 0{,}25x$; 7 lápices cuestan 1,75 €", "mv2", "cap. 11, ej. 23")
ej("función lineal", 1, S, "Expresa con una tabla y con palabras la función $d = 100t$. ¿Cuál es la variable dependiente?",
   solucion="Distancia en función del tiempo, a velocidad constante 100: $t = 1, 2, 3 \\to d = 100, 200, 300$. La dependiente es $d$", fuente="mv2", ref="cap. 11, ej. 17")
ej("describir una situación con una gráfica", 2, S, "Juan y Luna salen de casa de Luna por un camino llano, descansan un rato y regresan por el mismo camino, pero más despacio. Dibuja una gráfica (tiempo, distancia) que lo describa.",
   solucion="Un tramo recto de subida, un tramo horizontal (descanso) y un tramo de bajada hasta 0 menos inclinado que el de subida", fuente="mv2", ref="cap. 11, ej. 24")
guarda(materia="matematicas", etapa="eso", curso=2, tema="funciones", titulo="Tablas, gráficas y funciones",
       saberes=["C.4", "D.5"], prefijo="m2-fun")
