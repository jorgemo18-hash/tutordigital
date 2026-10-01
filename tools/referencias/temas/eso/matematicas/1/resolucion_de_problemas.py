import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
P_ = "problema de la vida cotidiana"
calculo(P_, 1, ["A.3"], "El cuentakilómetros del padre de Juan marca 64 731 km. Si las revisiones son cada 5 000 km, ¿cuántos kilómetros le faltan para la próxima revisión?",
        [(None, "65000-64731", "269", None)], "Le faltan 65 000 − 64 731 = 269 km (la próxima revisión es a los 65 000 km, pues 5 000 · 13 = 65 000)", "mv1", "cap. 1, ej. 3")
calculo(P_, 1, ["A.3"], "La piscina de Inés tiene forma de rectángulo. Sus lados miden 10 m de largo y 7 m de ancho. Desea rodear la piscina con una valla. El metro de valla vale 12 €. ¿Cuánto costará hacer la valla?",
        [(None, "(10+7)*2*12", "408", None)], "(10 + 7) · 2 · 12 = 408 €", "mv1", "cap. 1, ej. 4")
calculo("estimación", 1, ["A.2", "A.3"], "Si tu paga semanal es de ocho euros, y ahorras toda la paga de un mes, ¿podrías comprarte un móvil (que estimas que vale unos 300 euros)? ¿Y con todas las pagas de un año?",
        [("mes", "8*5", "40", None), ("año", "52*8", "416", None)], "En un mes hay 4 o 5 semanas: como mucho 8 · 5 = 40 €, mucho menos que 300 €. En un año hay 52 semanas: 52 · 8 = 416 €, ahora sí llega", "mv1", "cap. 1, ej. 5")
ej("estimación", 2, ["A.1", "A.2"], "Informan que a una manifestación han ido 40 000 personas, ¿cómo crees que las han contado?",
   solucion="Abierta. Por ejemplo: contar las personas que hay en un metro cuadrado y multiplicar por los metros cuadrados que ocupa la manifestación", fuente="mv1", ref="cap. 1, ej. 7")
ej("estimación", 2, ["A.1", "A.2"], "¿Cuántos granos de arroz hay en un kilo?",
   solucion="Abierta. Contarlos uno a uno no es razonable: se pesa una cantidad pequeña de granos contados y se hace la proporción (por ejemplo, si 100 granos pesan 2,7 g, en un kilo hay unos 37 000)", fuente="mv1", ref="cap. 1, ej. 11")
calculo("patrones", 2, ["D.1", "D.6"], "«Las torres de Hanoi»: cuenta la leyenda que en tres agujas de oro hay sesenta y cuatro discos, todos de distinto tamaño, colocados de mayor a menor. Unos monjes cambian continuamente de sitio estos discos, uno cada segundo, con estas reglas: en cada movimiento solo se puede mover un disco, y no se puede colocar nunca un disco encima de otro de menor tamaño. Cuando hayan pasado todos los discos de una de las agujas a otra se acabará el mundo. ¿Cuánto falta para que termine el mundo? (Hazlo más fácil para empezar: prueba con 2, 3 y 4 discos.)",
        [("3 discos", "2^3-1", "7", None), ("4 discos", "2^4-1", "15", None), ("64 discos", "2^64-1", "18446744073709551615", None)],
        "Con 2 discos hacen falta 3 movimientos; con 3, 3 + 1 + 3 = 7 = 8 − 1; con 4, 7 + 1 + 7 = 15 = 16 − 1. Con n discos, $2^{n} - 1$. Con 64 discos, $2^{64} - 1 = 18446744073709551615$ segundos, unos 585 000 millones de años. (La fuente da 4 611 686 018 427 387 903, que es $2^{62} - 1$: está mal.)",
        "mv1", "cap. 1, ej. 13 (la solución de la fuente está mal)")
calculo("problema de ingenio", 2, ["A.3", "D.6"], "Cuadrado mágico: con los números del 10 al 18 completa un cuadro de 3 × 3 de forma que obtengas la misma suma en todas direcciones: en horizontal, en vertical, e incluso en las dos diagonales.",
        [("suma de cada línea", "(10+11+12+13+14+15+16+17+18)/3", "42", None), ("fila 1", "11+18+13", "42", None), ("diagonal", "11+14+17", "42", None)],
        "La suma de los 9 números es 126, así que cada línea suma 42 y el central es 14. Una solución: 11, 18, 13 / 16, 14, 12 / 15, 10, 17 (hay más)", "mv1", "cap. 1, ej. 14")
ej("problema de lógica", 2, ["D.6"], "«Color del pelo»: tres amigas A, B, C, una rubia, otra morena y otra pelirroja, están jugando a las cartas sentadas en una mesa circular; cada una pasa una carta a la que está a su derecha. La amiga B ha pasado una carta a la rubia. La amiga A ha pasado una carta a la que ha pasado una carta a la pelirroja. ¿Cuál es el color del pelo de A, B y C?",
   solucion="A es rubia, B pelirroja y C morena", fuente="mv1", ref="cap. 1, ej. 15")
problema("problema con ecuación", 2, ["D.2"], "Una persona es 80 cm más alta que la mitad de su altura. ¿Qué estatura tiene?", "x/2+80 = x", ["160"], "$\\frac{x}{2} + 80 = x$: mide 160 cm", "mv1", "cap. 1, ej. 16")
calculo("consumo", 1, ["A.3", "A.6"], "Observa las ofertas de una tienda. Camisetas: antes 15 €, oferta 12 €. Chaquetas: antes 40 €, oferta 30 €. Pantalones: antes 32 €, oferta 28 €. Camisas: antes 25 €, oferta 21 €. Una persona aprovecha estas ofertas y compra cinco camisas, una chaqueta, dos pantalones y tres camisetas. Averigua cuánto se gasta y cuánto se ahorra por comprar esa ropa en ofertas.",
        [("gasto", "5*21+30+2*28+3*12", "227", None), ("sin oferta", "5*25+40+2*32+3*15", "274", None), ("ahorro", "274-227", "47", None)],
        "Gasta 5 · 21 + 30 + 2 · 28 + 3 · 12 = 227 €. Sin rebajas habría gastado 274 €: se ahorra 47 €", "mv1", "cap. 1, ej. 18 (adaptado: la tabla, en texto)")
calculo(P_, 2, ["A.3"], "Se han apuntado 25 estudiantes a un viaje. Al pagar el billete, 5 de ellos se dan cuenta de que no han traído dinero. El resto decide pagárselo, y abonan cada uno 3 €. ¿Cuánto cuesta cada billete?",
        [(None, "(25-5)*3/5", "12", None)], "Los 20 que pagan ponen 20 · 3 = 60 € para 5 billetes: cada billete cuesta 12 €", "mv1", "cap. 1, ej. 19")
calculo("magia con números", 2, ["A.4", "D.6"], "¡Hagamos magia! Dile a una persona que piense un número de tres cifras, que escriba ese número y, de nuevo, las tres cifras, para formar un número de seis cifras. Pídele que lo divida entre 7, luego entre 11 y luego entre 13. Se quedará sorprendida al comprobar que el resultado es el número que escribió. ¿Sabes por qué?",
        [(None, "7*11*13", "1001", None)], "Si el número es abc, abcabc = 1001 · abc, y 7 · 11 · 13 = 1001: dividir entre 7, 11 y 13 es dividir entre 1001", "mv1", "cap. 1, ej. 27")
calculo("problema de ingenio", 2, ["A.4", "D.6"], "Resuelve el crucigrama: coloca un número en cada casilla de un cuadro de 3 × 3 de forma que los productos de las filas sean 24, 35 y 30, y los productos de las columnas sean 6, 50 y 84.",
        [("fila 1", "2*2*6", "24", None), ("fila 2", "1*5*7", "35", None), ("fila 3", "3*5*2", "30", None), ("col. 1", "2*1*3", "6", None), ("col. 2", "2*5*5", "50", None), ("col. 3", "6*7*2", "84", None)],
        "Filas: 2, 2, 6 / 1, 5, 7 / 3, 5, 2", "mv1", "cap. 1, ej. 28 (adaptado: la cuadrícula, descrita con palabras)")
calculo("tablas de datos", 2, ["A.3", "E.1"], "La jefa de estudios de un colegio ha anotado el número de alumnos y alumnas que han faltado a clase (lunes, martes, miércoles, jueves, viernes). 1.º A: 2, 3, 5, 1, 3. 1.º B: 3, 4, 1, 3, 2. 2.º A: 2, 6, 3, 4, 3. 2.º B: 5, 1, 0, 2, 1. 3.º A: 4, 2, 3, 1, 0. 3.º B: 6, 3, 1, 2, 3. 4.º A: 2, 3, 1, 4, 0. 4.º B: 4, 2, 2, 2, 0. a) Haz la tabla y completa la última fila y la última columna (los totales). b) Sabiendo que el número total de alumnos y alumnas de Secundaria de ese colegio es 205, averigua cuántos había en el colegio el jueves.",
        [("jueves", "1+3+4+2+1+2+4+2", "19", None), ("lunes", "2+3+2+5+4+6+2+4", "28", None), ("total", "28+24+16+19+12", "99", None), ("b", "205-19", "186", None)],
        "a) Totales por clase: 14, 13, 18, 9, 10, 15, 10, 10. Totales por día: 28, 24, 16, 19, 12; total 99.   b) El jueves faltaron 19: había 205 − 19 = 186", "mv1", "cap. 1, ejercicios y problemas, ej. 1 (adaptado: la tabla, en texto)")
calculo("patrones", 1, ["D.1", "A.4"], "«El extraordinario 37»: 37 · 3 = 111; 37 · 6 = 222; 37 · 9 = 333. Consigue tú ahora 444, 555, 666…",
        [("444", "37*12", "444", None), ("555", "37*15", "555", None), ("666", "37*18", "666", None)], "37 · 12 = 444; 37 · 15 = 555; 37 · 18 = 666, y así con los múltiplos de 3", "mv1", "cap. 1, ejercicios y problemas, ej. 2")
calculo("patrones", 1, ["D.1"], "Triángulos: 1 · 9 + 2 = 11; 12 · 9 + 3 = 111; 123 · 9 + 4 = 1111; 1234 · 9 + 5 = 11111. Comprueba que el triángulo sigue hasta llegar a + 10.",
        [("+6", "12345*9+6", "111111", None), ("+7", "123456*9+7", "1111111", None), ("+8", "1234567*9+8", "11111111", None), ("+9", "12345678*9+9", "111111111", None), ("+10", "123456789*9+10", "1111111111", None)],
        "12345 · 9 + 6 = 111111; 123456 · 9 + 7 = 1111111; 1234567 · 9 + 8 = 11111111; 12345678 · 9 + 9 = 111111111; 123456789 · 9 + 10 = 1111111111", "mv1", "cap. 1, ejercicios y problemas, ej. 4")
calculo("operaciones", 2, ["A.3", "D.6"], "Números en fuga: estas operaciones se han quedado sin resolver por falta de algunos números. ¿Puedes completarlas? a) $4\\square 2 : \\square 5 = 17$, resto 7.   b) $2\\square 3\\square \\cdot 75 = 2\\square 0050$",
        [("a", "25*17+7", "432", None), ("b", "2934*75", "220050", None)], "a) 432 : 25 = 17, resto 7.   b) 2934 · 75 = 220050", "mv1", "cap. 1, ejercicios y problemas, ej. 6 b y c (el a, con siete soluciones, no se copia)")
calculo(P_, 3, ["A.3", "D.6"], "Dos mujeres habían ido al mercado a vender 30 manzanas cada una. La primera tenía la intención de vender cada dos manzanas por un euro. ¿Cuánto pensaba ganar? La segunda quería vender cada tres manzanas por dos euros. ¿Cuánto ganaría? Pero no querían hacerse la competencia, por lo que llegaron al siguiente acuerdo: vender ambas cada cinco (2 + 3) manzanas por tres (1 + 2) euros. Lo habían vendido todo. ¿Han ganado 36 €? ¡Les sobra un euro! Con la venta anterior iban a ganar 35 € y han ganado 36 €. ¿Puedes explicarles qué ha ocurrido?",
        [("primera", "30/2*1", "15", None), ("segunda", "30/3*2", "20", None), ("juntas", "60/5*3", "36", None)],
        "La primera pensaba ganar 15 € (0,50 € cada manzana) y la segunda 20 € (0,67 € cada una). Juntas, 60 manzanas a 3 € cada 5 son 36 €: cada manzana a 0,60 €, más que el precio medio de las ventas iniciales (35/60 ≈ 0,58 €). Por eso ganan 1 € más", "mv1", "cap. 1, ejercicios y problemas, ej. 7")
valores("jerarquía de las operaciones", 1, ["A.3"], "Letras y números: si sigues el orden alfabético, estas cuatro operaciones dan como resultado letras con las que podrás formar una palabra.",
        [("(8+10)/3+7*1-5", "8"), ("(23-15)+2*4", "16"), ("1*4+6/2+5*1", "12"), ("45*(1+0)-45+1", "1")], "mv1", "cap. 1, ejercicios y problemas, ej. 9",
        enunciados=["(8 + 10) : 3 + 7 \\cdot 1 - 5", "(23 - 15) + 2 \\cdot 4", "1 \\cdot 4 + 6 : 2 + 5 \\cdot 1", "45 \\cdot (1 + 0) - 45 + 1"])
EJ[-1]["solucion"] = "8, 16, 12 y 1: H, O, L, A → HOLA"
ej("problema de lógica", 3, ["D.6"], "Juan, Jaime y Jorge tienen cada uno dos oficios. Hay un barbero, un chófer, un tabernero, un músico, un pintor y un jardinero. ¿A qué se dedica cada uno de ellos? Sabiendo que: 1) el chófer se burló del músico porque tenía el pelo largo; 2) el músico y el jardinero pescan con Juan; 3) el pintor compró al tabernero vino; 4) el chófer cortejaba a la hermana del pintor; 5) Jaime debía 5 dólares al jardinero; 6) Jorge vio a lo lejos a Jaime y al pintor.",
   solucion="Juan: barbero y pintor. Jaime: músico y tabernero. Jorge: chófer y jardinero", fuente="mv1", ref="cap. 1, ejercicios y problemas, ej. 11")
ej("generalizar", 3, ["D.6"], "Nos dan 16 bolas del mismo tamaño, pero una de ellas pesa un poco menos que las otras. Para averiguar cuál es disponemos de una balanza de dos platos. ¿Cuál es el mínimo número de pesadas que necesitas efectuar para, sin tener en cuenta la buena suerte, determinar la bola? ¿Y si son 32 bolas? ¿Y si son 27? ¿Y si 13? Generaliza el problema a cualquier número de bolas.",
   solucion="3, 4, 3 y 3 pesadas. Con 3 bolas basta 1 pesada; con 9, 2 (se hacen tres grupos de 3); con 27, 3. En general, si el número de bolas k cumple $3^{n-1} < k \\le 3^{n}$, hacen falta n pesadas: se reparten en tres grupos y se pesan dos iguales", fuente="mv1", ref="cap. 1, ejercicios y problemas, ej. 13")
problema("problema con ecuación", 3, ["A.3", "D.2", "D.6"], "Un rajá dejó a sus hijas cierto número de perlas y determinó que se hiciera del siguiente modo: la hija mayor tomaría una perla y un séptimo de lo que quedara. La segunda hija recibiría dos perlas y un séptimo de lo que restase. La tercera joven recibiría tres perlas y un séptimo de lo que quedara. Y así sucesivamente. Hecha la división, cada una de las hermanas recibió el mismo número de perlas. ¿Cuántas perlas había? ¿Cuántas hijas tenía el rajá?",
         "1+(x-1)/7 = 2+(x-(1+(x-1)/7)-2)/7", ["36"], "Había 36 perlas: el rajá tenía 6 hijas y a cada una le dejó 6 perlas", "mv1", "cap. 1, ejercicios y problemas, ej. 14")
ej("patrones", 2, ["D.1", "D.6"], "a) Piensa un número de tres cifras. b) Escríbelo al revés y resta el menor del mayor. c) Escribe el resultado al revés y súmalo al resultado de la resta. d) Escribe la solución final. e) Prueba con varios números, ¿qué observas? ¿Hay algún caso en el que no se obtenga la misma solución?",
   solucion="Sale siempre 1089 (por ejemplo, 321 − 123 = 198 y 198 + 891 = 1089), escribiendo la resta con tres cifras (099 + 990). No sale si las cifras primera y última son iguales: la resta da 0. (La solución de la fuente llega a 0 porque no tiene en cuenta las llevadas: está mal.)",
   fuente="mv1", ref="cap. 1, ej. 12 a–e (la solución de la fuente está mal)")
guarda(materia="matematicas", etapa="eso", curso=1, tema="resolucion-de-problemas", titulo="Resolución de problemas y estrategias",
       saberes=["A.1", "A.2", "A.3", "A.4", "A.6", "D.1", "D.2", "D.6", "E.1"], prefijo="m1-res")
