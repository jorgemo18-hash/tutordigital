import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["E.1"]
d = [1, 2, 5, 6, 3, 1, 4, 5, 6, 1, 3, 1, 2, 2, 1, 6, 2, 2, 4, 3, 4, 6, 6, 1, 4]
medidas("media, mediana y moda", 2, S, "Pepa ha tirado un dado 25 veces: 1, 2, 5, 6, 3, 1, 4, 5, 6, 1, 3, 1, 2, 2, 1, 6, 2, 2, 4, 3, 4, 6, 6, 1, 4. a) Haz la tabla de frecuencias absolutas y relativas. b) Calcula la media, la mediana y la moda. ¿Es única la moda?",
        d, [("media", "81/25"), ("mediana", "3"), ("moda", ["1"])], "a) 1: 6 (0,24); 2: 5 (0,2); 3: 3 (0,12); 4: 4 (0,16); 5: 2 (0,08); 6: 5 (0,2).   b) Media 81/25 = 3,24; mediana 3; moda 1 (única)", "mv2", "cap. 12, ej. 3 y 17")
medidas("media", 1, S, "Javier ha tirado un dado 10 veces: 6, 3, 1, 4, 2, 2, 1, 4, 3, 4. Calcula la media aritmética.", [6, 3, 1, 4, 2, 2, 1, 4, 3, 4], [("media", "3")], "3", "mv2", "cap. 12, ej. 11")
medidas("media", 1, S, "Las notas de Lengua de Raquel son 7, 5, 6, 4, 7, 10 y 7. Calcula la media.", [7, 5, 6, 4, 7, 10, 7], [("media", "46/7")], "46/7 ≈ 6,57", "mv2", "cap. 12, ej. 12")
medidas("media, mediana y moda", 1, S, "Sara ha sacado en Matemáticas 9, 7, 8, 6, 9, 10 y 9. Calcula la media, la mediana y la moda.", [9, 7, 8, 6, 9, 10, 9], [("media", "58/7"), ("mediana", "9"), ("moda", ["9"])], "Media 58/7 ≈ 8,29; mediana 9; moda 9", "mv2", "cap. 12, ej. 18")
medidas("media, mediana y moda", 2, S, "Diez familias tienen estas mascotas: 0, 1, 0, 2, 1, 4, 3, 0, 0, 1. Calcula la media, la mediana y la moda.", [0, 1, 0, 2, 1, 4, 3, 0, 0, 1], [("media", "1.2"), ("mediana", "1"), ("moda", ["0"])], "Media 1,2; mediana 1; moda 0", "mv2", "cap. 12, ej. 21")
medidas("media, mediana y moda", 2, S, "Edades de un equipo de balonmano: 12, 14, 13, 12, 15, 11, 12, 12, 13, 14, 11, 12, 12. Calcula la media, la mediana y la moda.", [12, 14, 13, 12, 15, 11, 12, 12, 13, 14, 11, 12, 12], [("media", "163/13"), ("mediana", "12"), ("moda", ["12"])], "Media 163/13 ≈ 12,54; mediana 12; moda 12", "mv2", "cap. 12, ej. 22")
d2 = [19, 18, 20, 19, 18, 21, 19, 17, 16, 20, 16, 19, 20, 21, 18, 17, 20, 19, 22, 21, 23, 21, 17, 18, 17, 19, 21, 20, 16, 19]
medidas("media, mediana y moda", 3, S, "El tamaño de la mano (cm) de los alumnos de una clase es: 19, 18, 20, 19, 18, 21, 19, 17, 16, 20, 16, 19, 20, 21, 18, 17, 20, 19, 22, 21, 23, 21, 17, 18, 17, 19, 21, 20, 16, 19. Calcula la media, la mediana y la moda.", d2, [("media", "571/30"), ("mediana", "19"), ("moda", ["19"])], "Media 571/30 ≈ 19,03 cm; mediana 19; moda 19", "mv2", "cap. 12, ej. 19")
calculo("frecuencias", 2, S, "Se pregunta a unos jóvenes cuántas veces van al cine al mes: 0 veces, 1 joven; 1 vez, 7; 2 veces, 9; 3 veces, 5; 4 veces, 2; 5 veces, 1. Calcula las frecuencias relativas y el ángulo de cada sector en un diagrama de sectores.",
        [("total", "1+7+9+5+2+1", "25", None), ("fr(2)", "9/25", "0.36", None), ("ángulo(2)", "9/25*360", "129.6", None)], "Total 25. Frecuencias relativas 0,04; 0,28; 0,36; 0,2; 0,08; 0,04. Ángulos 14,4°; 100,8°; 129,6°; 72°; 28,8°; 14,4°", "mv2", "cap. 12, ej. 5")
calculo("problema de medias", 3, S, "La media de seis números es 5. Se añaden dos números más y la media sigue siendo 5. ¿Cuánto suman los dos nuevos?", [(None, "8*5-6*5", "10", None)], "Suman 10", "mv2", "cap. 12, ej. 32")
ej("leer gráficos con sentido crítico", 2, ["E.1", "E.3"], "Las ventas de una empresa pasan de 83 451 en enero a 86 316 en diciembre. En una gráfica con el eje vertical de 0 a 100 000 parecen constantes; en otra, con el eje de 83 000 a 86 500, parece que suben mucho. Las dos son correctas: explica por qué dan impresiones tan distintas.",
   solucion="El eje vertical no empieza en el mismo sitio: cortarlo (empezar en 83 000) exagera una subida que es de solo un 3,4 %", fuente="mv2", ref="cap. 12, ej. 27")
guarda(materia="matematicas", etapa="eso", curso=2, tema="estadistica", titulo="Estadística: tablas, gráficos y medidas de centralización",
       saberes=["E.1", "E.3"], prefijo="m2-est")
