import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.1", "D.6"]
ej("problema de ingenio", 3, ["A.4", "D.6"], "El hotel de los líos: un hotel tiene infinitas puertas cerradas. Un cliente las abre todas; un segundo cierra las pares; un tercero cambia las múltiplos de 3 (abre las cerradas y cierra las abiertas); un cuarto hace lo mismo con las múltiplos de 4, y así sucesivamente. ¿Qué puertas quedan abiertas por la mañana?",
   solucion="Las de los cuadrados perfectos (1, 4, 9, 16…): son los únicos números con un número impar de divisores", fuente="mv2", ref="cap. 1, ej. 1")
calculo("problema de ingenio", 3, ["B.2", "D.6"], "Rodeamos la Tierra (radio ≈ 6240 km) con un cable. ¿Cuánto hay que alargarlo para que quede separado 2 m del suelo en todo el ecuador? ¿Menos de 15 m? ¿Entre 15 m y 15 km? ¿Más?", [(None, "2*pi*2", "4*pi", None)], "$2\\pi \\cdot 2 = 4\\pi \\approx 12{,}57$ m: menos de 15 m, sea cual sea el radio", "mv2", "cap. 1, ej. 2")
problema("problema de ingenio", 3, ["A.3", "D.2"], "Un muchacho regala a una amiga la mitad de sus cachorros más medio; de lo que le queda, a un amigo la mitad más medio; a su prima, la mitad de lo que queda más medio, y a su primo la mitad de lo que queda más medio. Le queda un cachorro. ¿Cuántos tenía?",
         "((((x-(x/2+Rational(1,2)))/2-Rational(1,2)) - ((x-(x/2+Rational(1,2)))/2-Rational(1,2))/2 - Rational(1,2)) - ((((x-(x/2+Rational(1,2)))/2-Rational(1,2)) - ((x-(x/2+Rational(1,2)))/2-Rational(1,2))/2 - Rational(1,2)))/2 - Rational(1,2)) = 1", ["31"], "31 cachorros (quedan 15, 7, 3 y 1; conviene hacerlo marcha atrás: $(1 + \\frac{1}{2}) \\cdot 2 = 3$…)", "mv2", "cap. 1, ej. 4")
ej("problema de ingenio", 3, ["A.4", "D.6"], "El producto de las edades de mis tres hijas es 36 y la suma es el número de tu casa. —Me falta un dato. —Tienes razón: la mayor toca el piano. ¿Qué edades tienen?",
   solucion="2, 2 y 9: de las ternas con producto 36, las únicas con la misma suma (13) son 1, 6, 6 y 2, 2, 9; «la mayor» descarta 1, 6, 6", fuente="mv2", ref="cap. 1, ej. 6")
ej("problema de ingenio", 2, S, "¿Cómo repartir 8 litros en dos partes iguales usando solo tres jarras de 8, 5 y 3 litros?",
   solucion="(8,0,0) → (3,5,0) → (3,2,3) → (6,2,0) → (6,0,2) → (1,5,2) → (1,4,3) → (4,4,0)", fuente="mv2", ref="cap. 1, ej. 9")
problema("problema de ingenio", 2, ["A.3", "D.2"], "Para vaciar una piscina, primero se saca la tercera parte, después la mitad del resto y aún quedan 150 m³. ¿Qué capacidad tiene?", "x-x/3-(x-x/3)/2 = 150", ["450"], "450 m³", "mv2", "cap. 1, ej. 14")
ej("estimación", 2, ["B.3", "A.2"], "Estima el largo, el alto y el ancho de tu habitación. Si un bote de pintura de 5,20 € pinta 10 m², ¿cuánto costará pintarla?",
   solucion="Abierta: depende de la estimación. Por ejemplo, 4 × 3 × 2,5 m dan unas paredes de 35 m² + techo 12 m² = 47 m² → 5 botes = 26 €", fuente="mv2", ref="cap. 1, ej. 10")
guarda(materia="matematicas", etapa="eso", curso=2, tema="resolucion-de-problemas", titulo="Resolución de problemas y estrategias",
       saberes=["A.1", "D.6"], prefijo="m2-res")
