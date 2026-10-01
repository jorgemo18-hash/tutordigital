import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
# Aragón (3.º): A.6 información numérica en contextos financieros sencillos y consumo responsable
# (calidad-precio), y A.5 cambio de divisas. El interés simple y compuesto, los préstamos y las
# tablas de amortización del capítulo de Marea Verde no entran: Aragón los pone en 4.º (A.6).
S = ["A.6", "A.5"]
P_ = "comisiones bancarias"
calculo(P_, 1, S, "Una chica desea realizar varias transferencias desde su banca online. La primera, de 30 € a su madre: no le urge que le llegue el dinero. La segunda, a su casera, de 365 €: debe llegarle en el mismo día. La tercera, para pagar la letra de su coche a su financiera de EE. UU., de 250 €: debe llegar en menos de 24 horas. Su banco cobra comisiones por realizar transferencias urgentes del 2,5 % si son nacionales y del 4 % si son al extranjero. Calcula: a) El importe total de comisiones que va a pagar. b) El importe total que va a pagar.",
        [("a", "365*0.025+250*0.04", "19.125", None), ("b", "365*0.025+250*0.04+30+365+250", "664.125", None)], "a) 19,125 € ≈ 19,13 €   b) 664,125 € ≈ 664,13 €", "mv3", "cap. 7, act. 17")
calculo(P_, 2, S, "Un hombre acude a la ventanilla de su banco a realizar varias operaciones: ingresar dinero en una de sus cuentas, realizar una transferencia urgente a su hijo, que vive en Alemania, de 1375 €, y otra transferencia no urgente a un cliente suyo por importe de 543 €. Aprovechando que está allí, el banco le dice que debe pagar la comisión por el mantenimiento de sus tarjetas, 10 €/anual, y la de administración por tener abierta una cuenta con ellos, 7 €/anual. Calcula el total de comisiones que ese día paga dicho hombre sabiendo que el importe de realizar transferencias urgentes es del 3,5 % y que las no urgentes no suponen un gasto a los clientes.",
        [(None, "1375*0.035+10+7", "65.125", None)], "$1375 \\cdot 0{,}035+10+7 = 65{,}125$ € ≈ 65,13 €", "mv3", "cap. 7, ejercicios y problemas 27")
calculo(P_, 2, S, "Una entidad bancaria determina que las transferencias tendrán una comisión del 0,4 % de cada importe. Por otro lado, la comisión mínima a cobrar debe ser de 5 €. A partir de estos datos calcula el total a pagar por un cliente que realiza transferencias por valor de: a) 4956 €   b) 3,5 €   c) 321 €   d) 1879,10 €",
        [("a", "4956*1.004", "4975.824", None), ("b", "3.5+5", "8.5", None), ("c", "321+5", "326", None), ("d", "1879.10*1.004", "1886.6164", None), ("c, comisión", "321*0.004", "1.284", None)],
        "a) Comisión 19,824 €: total 4975,824 €   b) La comisión sería 0,014 €, no llega al mínimo: total 3,5 + 5 = 8,5 €   c) La comisión sería 1,284 €, no llega al mínimo: total 326 €   d) Comisión 7,5164 €: total 1886,6164 €", "mv3", "cap. 7, ejercicios y problemas 28")
calculo(P_, 2, S, "La plataforma de pago GooglePay cobra a una empresa por facturar a través de ella las siguientes comisiones: si factura menos de 1500 € al mes, cobrará 3,2 % + 0,45 € por cada transacción; si factura entre 1500 € y 12 000 € al mes, cobrará 2,6 % + 0,40 € por cada transacción; si factura entre 12 001 € y 99 999 € al mes, cobrará 1,8 % + 0,30 € por cada transacción. Señala en cada caso cuánto tendrá que pagar la empresa a GooglePay de comisiones: a) Factura 650 € realizando 7 transacciones. b) Factura 5340 € realizando 24 transacciones. c) Factura 45 520 € realizando 145 transacciones.",
        [("a", "650*0.032+7*0.45", "23.95", None), ("b", "5340*0.026+24*0.40", "148.44", None), ("c", "45520*0.018+145*0.3", "862.86", None)], "a) 23,95 €   b) 148,44 €   c) 862,86 €",
        "mv3", "cap. 7, ejercicios y problemas 29 (a, b, c; el apartado d, 111 000 €, cae en un tramo que la tabla no da)")
P_ = "cambio de divisas"
TABLA = "Tipos de cambio: 1 € = 0,86 £ = 1,3 \\$ = 3,6 soles = 9 bolivianos = 131 yenes = 8 yuanes = 11,1 dírhams."
calculo(P_, 1, S, TABLA + " Cambia 1200 € a libras, soles, bolivianos, yenes y dírhams.",
        [("libras", "1200*0.86", "1032", None), ("soles", "1200*3.6", "4320", None), ("bolivianos", "1200*9", "10800", None), ("yenes", "1200*131", "157200", None), ("dírhams", "1200*11.1", "13320", None)],
        "1032 £; 4320 soles; 10 800 bolivianos; 157 200 yenes; 13 320 dírhams", "mv3", "cap. 7, act. 22 (adaptado: los tipos de cambio del cuadro del libro se dan en el enunciado)")
calculo(P_, 2, S, TABLA + " Cambia a euros las siguientes cantidades: a) 390 \\$   b) 4051,5 dírhams   c) 104 800 yenes   d) 5103 bolivianos",
        [("a", "390/1.3", "300", None), ("b", "4051.5/11.1", "365", None), ("c", "104800/131", "800", None), ("d", "5103/9", "567", None)],
        "a) 300 €   b) 365 € (la fuente divide entre 1,1 en vez de 11,1 y da 3683,18 €: errata)   c) 800 €   d) 567 €", "mv3", "cap. 7, act. 23 (adaptado: tipos de cambio en el enunciado; en b) la fuente divide entre 1,1: errata)")
calculo(P_, 2, S, TABLA + " Jessica se quiere comprar una tableta. En España cuesta 350 €; en Estados Unidos, 400 \\$ y 60 \\$ de transporte; en China, 2700 yuanes y 200 yuanes de transporte. ¿Dónde es más barato comprar la tableta?",
        [("EE. UU.", "(400+60)/1.3", "353.85", 0.005), ("China", "(2700+200)/8", "362.5", None)],
        "España 350 €; EE. UU. ≈ 353,85 €; China 362,50 €: es más barato comprarla en España. La fuente suma «2700 + 20», calcula 337,5 € con 2700 y concluye que es más barato en China: errata", "mv3", "cap. 7, act. 24 (adaptado: tipos de cambio en el enunciado; la fuente se equivoca en el precio de China)")
calculo(P_, 1, S, "Con la siguiente tabla de equivalencias: 1 € = 0,6 £ = 1,1 \\$ = 2,5 soles = 7 bolivianos = 106 yenes = 8 yuanes = 15 dírhams, cambia 3000 € a libras, soles, bolivianos, yenes y dírhams.",
        [("libras", "3000*0.6", "1800", None), ("soles", "3000*2.5", "7500", None), ("bolivianos", "3000*7", "21000", None), ("yenes", "3000*106", "318000", None), ("dírhams", "3000*15", "45000", None)],
        "1800 £; 7500 soles; 21 000 bolivianos; 318 000 yenes; 45 000 dírhams", "mv3", "cap. 7, ejercicios y problemas 30")
calculo(P_, 1, S, "Sara ha comprado un ordenador que cuesta 400 €. Les quiere decir a sus amigos el precio en su moneda nacional. a) ¿Qué diría al de Japón si el tipo de cambio es 102 yenes? b) ¿Y al de EE. UU. si el tipo de cambio es 1,1 \\$? c) ¿Y al de Bolivia si el tipo de cambio es 7 bolivianos?",
        [("a", "400*102", "40800", None), ("b", "400*1.1", "440", None), ("c", "400*7", "2800", None)],
        "a) 40 800 yenes   b) 440 \\$   c) 2800 bolivianos (la fuente calcula a) y c) con 131 yenes y 9 bolivianos, los tipos de otro ejercicio, y da 52 400 yenes y 3600 bolivianos: errata)", "mv3", "cap. 7, ejercicios y problemas 31 (la fuente usa otros tipos de cambio en a y c: errata)")
calculo(P_, 2, S, "Joaquín se quiere comprar un móvil que en España cuesta 500 €; en Estados Unidos, 500 \\$ y 50 \\$ por el transporte; en China, 4550 yuanes y 0 yuanes de transporte. ¿Dónde es más barato comprar ese móvil? El tipo de cambio en Estados Unidos es de 1,2 dólares y el de China es de 6 yuanes.",
        [("EE. UU.", "550/1.2", "458.33", 0.005), ("China", "4550/6", "758.33", 0.005)], "España 500 €; EE. UU. ≈ 458,33 €; China ≈ 758,33 €: es más barato en Estados Unidos", "mv3", "cap. 7, ejercicios y problemas 32")
calculo(P_, 1, S, "a) Marina ha vuelto de un viaje de Estados Unidos con 650 \\$ en metálico. Los cambia a euros. El tipo de cambio vigente es 1,2 dólares. ¿Cuántos euros tendrá?   b) Andrés ha vuelto de un viaje del Reino Unido con 50 £ en metálico. Los cambia a euros. El tipo de cambio vigente es 0,87 libras. ¿Cuántos euros tendrá?",
        [("a", "650/1.2", "541.67", 0.005), ("b", "50/0.87", "57.47", 0.005)], "a) ≈ 541,67 € (la fuente trunca a 541,6 €)   b) ≈ 57,47 €", "mv3", "cap. 7, autoevaluación 11 y 12")
calculo(P_, 3, S, "En el cuadro siguiente se presentan los tipos de cambio de un grupo de monedas respecto al dólar de EE. UU.: 1 dólar canadiense = 0,613 \\$; 1 € = 0,886 \\$; 1 £ = 1,564 \\$. Calcula el resto de las relaciones entre las monedas utilizando los tipos de cambio cruzados: a) dólares canadienses por dólar   b) euros por dólar   c) dólares canadienses por euro   d) dólares canadienses por libra   e) euros por libra",
        [("a", "1/0.613", "1.631", 0.0005), ("b", "1/0.886", "1.1287", 0.0005), ("c", "0.886/0.613", "1.445", 0.0005), ("d", "1.564/0.613", "2.5513", 0.0005), ("e", "1.564/0.886", "1.7652", 0.0005)],
        "a) ≈ 1,631   b) ≈ 1,1287 (la fuente da 1,1286)   c) ≈ 1,445   d) ≈ 2,5513   e) ≈ 1,7652; y los inversos: 0,6393 £/\\$, 0,692 €/dólar canadiense, 0,3919 £/dólar canadiense, 0,5665 £/€", "mv3", "cap. 7, ejercicios y problemas 33 (adaptado: la tabla se da en el texto)")
ej("tipo de cambio", 2, S, "Si el euro se deprecia frente al dólar, ¿esto es importante?, ¿por qué?, ¿qué ocurre con el dinero que dan los turistas extranjeros en España?, ¿podrán comprar más o menos en nuestro país? Si el tipo de cambio dólar/euro disminuye desde 1,35 hasta 1,05, ¿qué significa para los europeos?",
   solucion="Comprar en Europa es más barato para los estadounidenses y comprar en EE. UU. es más caro para los europeos: antes con un euro se conseguían 1,35 dólares y ahora solo 1,05. Los europeos que viajen allí tendrán menos dólares y podrán comprar menos cosas", fuente="mv3", ref="cap. 7, act. 20")
P_ = "calidad-precio"
calculo(P_, 2, ["A.6", "B.2"], "En una pizzería, la pizza de 20 cm de diámetro vale 3 euros y la de 40 cm vale 6 euros. ¿Cuál tiene mejor precio?",
        [("área pequeña", "pi*10^2", "100*pi", None), ("área grande", "pi*20^2", "400*pi", None), ("cm²/€, pequeña", "100*pi/3", "104.72", 0.005), ("cm²/€, grande", "400*pi/6", "209.44", 0.005)],
        "Áreas $100\\pi$ y $400\\pi$ cm²: la grande tiene el cuádruple de pizza y solo cuesta el doble. Mejor precio la grande (≈ 209 cm² por euro frente a ≈ 105)", "mv3", "cap. 6, curiosidades (revista)")
calculo(P_, 2, ["A.6", "A.5"], "Calcula el precio del litro de zumo que se consigue mezclando 8 litros de zumo de piña a 2,5 €/l, 15 litros de zumo de naranja a 1,6 €/l y 5 litros de zumo de uva a 1,2 €/l. ¿A cuánto debe venderse una botella de litro y medio si se le aplica un aumento del 40 % sobre el precio de coste?",
        [("€/l", "(8*2.5+15*1.6+5*1.2)/(8+15+5)", "25/14", None), ("botella", "(25/14)*1.5*1.4", "3.75", None)], "Precio de coste $\\frac{25}{14} \\approx 1{,}79$ €/l; la botella, $\\frac{75}{28}$ € de coste y 3,75 € de venta", "mv3", "cap. 6, ejercicios y problemas 35")
guarda(materia="matematicas", etapa="eso", curso=3, tema="educacion-financiera", titulo="Educación financiera: comisiones, cambio de divisas y calidad-precio",
       saberes=["A.5", "A.6", "B.2"], prefijo="m3-fin")
