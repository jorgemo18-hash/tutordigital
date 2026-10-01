import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from escribe import *  # noqa: E402,F403
from _fuentes import registra  # noqa: E402

registra()
S = ["A.3"]; SR = ["A.2", "A.4"]


def calc(s):
    """"4,6 · 7,5" (como se escribe) → "4.6*7.5" (la cuenta)."""
    return s.replace(",", ".").replace("·", "*").replace(":", "/").replace(" ", "")


def en(s):
    return s.replace(",", "{,}").replace("·", " \\cdot ").replace(":", " : ")


def dec(tipo, dif, saberes, consigna, lista, fuente, ref):
    return valores(tipo, dif, saberes, consigna, [(calc(s), r) for s, r in lista], fuente, ref, enunciados=[en(s) for s, _ in lista])


def v(ap, e, r):
    return {"tipo": "valor", "apartado": ap, "expresion": e, "respuesta": r}


ej("decimal a fracción", 1, SR, "Transforma en fracciones los siguientes números decimales: a) 0,87   b) 0,0701   c) 30,56   d) 17,03   e) 10,050",
   comprobar=[v("a", "87/100", "0.87"), v("b", "701/10000", "0.0701"), v("c", "3056/100", "30.56"), v("d", "1703/100", "17.03"), v("e", "1005/100", "10.05")],
   solucion="a) $\\frac{87}{100}$   b) $\\frac{701}{10000}$   c) $\\frac{3056}{100}$   d) $\\frac{1703}{100}$ (la fuente da $\\frac{1703}{10}$: está mal)   e) $\\frac{1005}{100}$", fuente="mv1", ref="cap. 6, ej. 2 (la fuente se equivoca en el d)")
ej("decimal a fracción", 1, SR, "Convierte en fracción los siguientes números decimales: a) 0,124   b) 5,23   c) 49,350   d) 0,013",
   comprobar=[v("a", "31/250", "0.124"), v("b", "523/100", "5.23"), v("c", "987/20", "49.35"), v("d", "13/1000", "0.013")],
   solucion="a) $\\frac{124}{1000} = \\frac{31}{250}$   b) $\\frac{523}{100}$   c) $\\frac{4935}{100} = \\frac{987}{20}$   d) $\\frac{13}{1000}$", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 12")
ej("descomposición decimal", 1, ["A.2"], "Completa las siguientes igualdades: a) $38{,}532 = 38 + \\frac{\\square}{10} + \\frac{\\square}{100} + \\frac{\\square}{1000}$   b) $0{,}078 = \\frac{\\square}{10} + \\frac{\\square}{100} + \\frac{\\square}{1000}$   c) $6{,}36 = \\frac{\\square}{100}$",
   comprobar=[v("a", "38+5/10+3/100+2/1000", "38.532"), v("b", "0/10+7/100+8/1000", "0.078"), v("c", "636/100", "6.36")],
   solucion="a) $38 + \\frac{5}{10} + \\frac{3}{100} + \\frac{2}{1000}$   b) $\\frac{0}{10} + \\frac{7}{100} + \\frac{8}{1000}$   c) $\\frac{636}{100}$", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 11 a–c")
ej("comparar decimales", 1, SR, "Señala qué número es el mayor en cada una de las siguientes parejas: a) 0,87 y 0,789   b) 3,58 y 4,1   c) 7,005 y 7,1   d) 32,4 y 27,9. Escribe después dos números decimales que sean, simultáneamente, mayores que 6,147 y menores que 6,2.",
   solucion="a) 0,87   b) 4,1   c) 7,1   d) 32,4. Por ejemplo, 6,178 y 6,1623 (cualquiera entre 6,147 y 6,2)", fuente="mv1", ref="cap. 6, ej. 4 y 5")
ej("ordenar decimales", 2, SR, "a) Ordena de menor a mayor los números: 5,67; 5,68; 5,6666; 5,63; 5,5; 5,8; 5,6070.   b) Ordena de mayor a menor los números: 7,45; 6,9999; 7,3456; 7,4378; 7,44444; 7,4501; 7,45012.",
   solucion="a) $5{,}5 < 5{,}607 < 5{,}63 < 5{,}6666 < 5{,}67 < 5{,}68 < 5{,}8$   b) $7{,}45012 > 7{,}4501 > 7{,}45 > 7{,}44444 > 7{,}4378 > 7{,}3456 > 6{,}9999$", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 3 y 4")
ej("ordenar fracciones y decimales", 2, SR, "Ordena de menor a mayor los siguientes números: 1/2; 0,45; 0,999; 2/3; 0,75; 5/4; 0,3939; 1/5.",
   comprobar=[v("1/5", "1/5", "0.2"), v("2/3", "2/3", "0.667"), v("5/4", "5/4", "1.25")], solucion="$\\frac{1}{5} < 0{,}3939 < 0{,}45 < \\frac{1}{2} < \\frac{2}{3} < 0{,}75 < 0{,}999 < \\frac{5}{4}$", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 9")
EJ[-1]["comprobar"][1]["tolerancia"] = 0.001
dec("suma y resta de decimales", 1, S, "Realiza las operaciones:", [("17,03 + 5,46", "22.49"), ("26,84 + 15,57", "42.41"), ("6,64 - 5,47", "1.17"), ("35,21 - 23,57", "11.64"), ("27,3 + 5,87", "33.17"), ("2,553 + 6,7", "9.253"), ("13,51 - 4,7", "8.81"), ("9,1 - 8,57", "0.53")], "mv1", "cap. 6, ej. 6 y 7")
dec("suma y resta de decimales", 1, S, "Halla:", [("5,57 + 32,6 + 9,115", "47.285"), ("46,77 - 15,6 + 2,3", "33.47"), ("33,2 - 16,53 - 12,4", "4.27")], "mv1", "cap. 6, ej. 8 (la fuente da 28,87 en el b: está mal)")
EJ[-1]["solucion"] = "a) 47,285   b) 33,47 (la fuente da 28,87, que sería restando 2,3: está mal)   c) 4,27"
dec("suma y resta de decimales", 2, S, "Efectúa las operaciones:", [("1,34 + 51,7", "53.04"), ("53,4 - 3,72", "49.68"), ("4,83 + 9,77 - 5,9", "8.7"), ("1,42 - 9,77", "-8.35")], "mv1", "cap. 6, ejercicios y problemas, ej. 13")
ej("término que falta", 1, S, "Rellena adecuadamente los lugares vacíos: a) $6{,}36 + \\square = 10$   b) $36{,}76 - \\square = 10$   c) $6{,}54 - \\square = 1{,}38$   d) $2{,}7 + \\square = 15{,}29$",
   comprobar=[v("a", "6.36+3.64", "10"), v("b", "36.76-26.76", "10"), v("c", "6.54-5.16", "1.38"), v("d", "2.7+12.59", "15.29")],
   solucion="a) 3,64   b) 26,76   c) 5,16   d) 12,59", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 14")
dec("producto de decimales", 1, S, "Calcula:", [("4,6·7,5", "34.5"), ("1,16·3,52", "4.0832"), ("3,2·5,1·1,4", "22.848"), ("2,3·4,11·3,5", "33.0855"), ("4·(3,01 + 2,4)", "21.64"), ("5,3·(12 + 3,14)", "80.242"), ("3,9·(25,8 - 21,97)", "14.937")], "mv1", "cap. 6, ej. 9 y 10")
dec("multiplicar y dividir por la unidad seguida de ceros", 1, S, "Realiza las siguientes operaciones:", [("43,76·10", "437.6"), ("43,76·1000", "43760"), ("0,017·10", "0.17"), ("3,76:10", "0.376"), ("5,67:100", "0.0567")], "mv1", "cap. 6, ejercicios y problemas, ej. 15")
dec("división de decimales", 2, S, "Efectúa las siguientes divisiones:", [("42,78:6", "7.13"), ("15,2:3,8", "4"), ("12,505:4,1", "3.05")], "mv1", "cap. 6, ej. 13 a–c")
ej("fracción a decimal", 1, SR, "Determina el desarrollo decimal de las fracciones siguientes: a) $\\frac{13}{50}$   b) $\\frac{110}{9}$   c) $\\frac{22}{12}$   d) $\\frac{170}{125}$   e) $\\frac{53}{22}$. Convierte también en número decimal f) $\\frac{9}{2}$ y g) $\\frac{31}{4}$.",
   comprobar=[v("a", "13/50", "0.26"), v("d", "170/125", "1.36"), v("f", "9/2", "4.5"), v("g", "31/4", "7.75")] + [dict(v(a, e, r), tolerancia=0.001) for a, e, r in [("b", "110/9", "12.222"), ("c", "22/12", "1.8333"), ("e", "53/22", "2.40909")]],
   solucion="a) 0,26   b) 12,222…   c) 1,8333…   d) 1,36   e) 2,40909…   f) 4,5   g) 7,75", fuente="mv1", ref="cap. 6, ej. 12 y ejercicios y problemas, ej. 18")
ej("decimal exacto o periódico", 3, SR, "Determina cuáles de las siguientes fracciones tienen representación decimal finita (decídelo sin calcularlas): a) $\\frac{12}{20}$   b) $\\frac{5}{7}$   c) $\\frac{12}{5}$   d) $\\frac{12}{45}$   e) $\\frac{9}{48}$",
   comprobar=[v("a", "12/20", "0.6"), v("c", "12/5", "2.4"), v("e", "9/48", "0.1875")],
   solucion="a) Sí ($\\frac{3}{5}$)   b) No   c) Sí   d) No ($\\frac{4}{15}$)   e) Sí: $\\frac{9}{48} = \\frac{3}{16}$ y 16 solo tiene el factor 2 (la fuente dice que no: está mal). Una fracción irreducible da un decimal exacto si su denominador solo tiene los factores 2 y 5",
   fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 24 (la fuente se equivoca en el e)")
ej("redondeo y truncamiento", 1, ["A.2"], "a) Redondea a las décimas los números siguientes: 5,67; 5,68; 5,6666; 7,45; 6,9999; 7,3456; 7,4378.   b) Redondea a las centésimas: 5,676767; 5,688989; 5,6666; 7,459; 6,9999; 7,3456; 7,4378.   c) Trunca por las centésimas esos mismos números.",
   solucion="a) 5,7; 5,7; 5,7; 7,5; 7,0; 7,3; 7,4   b) 5,68; 5,69; 5,67; 7,46; 7,00; 7,35; 7,44   c) 5,67; 5,68; 5,66; 7,45; 6,99; 7,34; 7,43", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 6, 7 y 10")
ej("redondeo y truncamiento", 2, ["A.2"], "Escribe un número decimal que satisfaga la siguiente condición: sus truncamientos coinciden con sus redondeos. Construye otro en el que ninguno de sus truncamientos coincida con los redondeos.",
   solucion="Por ejemplo, 31,4312 (todas sus cifras decimales son menores o iguales que 4) y 68,798 (todas mayores o iguales que 5)", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 35 y 36")
dec("operaciones combinadas con decimales", 2, S, "Calcula:", [("49 - 4,5·0,01", "48.955"), ("0,5 + 0,4:0,1", "4.5"), ("7,52 - 37·0,1", "3.82"), ("0,97 - 0,1·0,01", "0.969"), ("6,3:0,1 + 15·0,08 + 0,59", "64.79"), ("5,2:0,01 - 5,6·5 - 29", "463"), ("0,73:0,001 - 5,1·11 - 7,3", "666.6")], "edad1", "quincena 4, para practicar, ej. 1 y 2")
dec("operaciones combinadas con decimales", 3, S, "Calcula:", [("5·(10,5 - 1,9)·0,001", "0.043"), ("30·(0,74 + 0,36):0,01", "3300"), ("9,8·(14 - 4,2):0,1", "960.4"), ("1,9·(0,61 - 0,52)·0,01", "0.00171"),
                                                          ("0,39 + 4,2·(0,3 + 60·0,1)", "26.85"), ("62 - 3,8·(0,33 + 0,84:0,1)", "28.826"), ("0,2 - 0,8·(20 + 9,8:0,01)", "-799.8"), ("1,4 - 0,4·(0,25 + 0,75:0,01)", "-28.7")],
    "edad1", "quincena 4, para practicar, ej. 3 y 4 (la fuente da 961,2 en el 3 c: está mal)")
EJ[-1]["solucion"] = "a) 0,043   b) 3300   c) 960,4 ($9{,}8 \\cdot 9{,}8 = 96{,}04$; la fuente pone 96,12 y da 961,2: está mal)   d) 0,00171   e) 26,85   f) 28,826   g) −799,8   h) −28,7"
ej("uso de paréntesis con calculadora", 2, S, "Usa la calculadora o una hoja de cálculo y analiza el uso de paréntesis: a) 2.34186 / 987.6543 + 8.981342 * 654.9234 − 25.98   b) 2.34186 / (987.6543 + 8.981342) * (654.9234 − 25.98)   c) (2.34186 / 987.6543) + (8.981342 * 654.9234) − 25.98   d) (2.34186 / 987.6543) + 8.981342 * (654.9234 − 25.98)",
   comprobar=[dict(v(a, e, r), tolerancia=0.0001) for a, e, r in [("a", "2.34186/987.6543+8.981342*654.9234-25.98", "5856.11341"), ("b", "2.34186/(987.6543+8.981342)*(654.9234-25.98)", "1.477869473"),
                                                                  ("c", "(2.34186/987.6543)+(8.981342*654.9234)-25.98", "5856.11341"), ("d", "(2.34186/987.6543)+8.981342*(654.9234-25.98)", "5648.758145")]],
   solucion="a) 5856,11341   b) 1,477869473   c) 5856,11341   d) 5648,758145. La calculadora o el ordenador usan la jerarquía de operaciones: a) se calcula como c)", fuente="mv1", ref="cap. 6, ejercicios y problemas, ej. 41")
P_ = "problema de decimales"
calculo(P_, 1, S, "Si se reparten equitativamente 270 euros entre 120 personas, ¿qué cantidad recibe cada persona?", [(None, "270/120", "2.25", None)], "2,25 €", "mv1", "cap. 6, ejercicios y problemas, ej. 25")
calculo(P_, 1, S, "Manuel compró en la papelería 4 bolígrafos y 3 lapiceros. Si cada bolígrafo costaba 0,78 euros y cada lapicero 0,63 euros, ¿cuánto se gastó Manuel?", [(None, "4*0.78+3*0.63", "5.01", None)], "5,01 €", "mv1", "cap. 6, ejercicios y problemas, ej. 32")
calculo(P_, 2, S, "Claudia se ha comprado tres bolígrafos iguales que, en total, le han costado 2,46 euros. También compró un cuaderno que costaba el cuádruple que cada bolígrafo. Calcula el precio del cuaderno.", [(None, "2.46/3*4", "3.28", None)], "3,28 €", "mv1", "cap. 6, ejercicios y problemas, ej. 33")
calculo(P_, 2, S, "Un depósito contiene 46,22 litros de agua que vamos a traspasar a botellas de litro y medio. Halla cuántas botellas llenaremos e indica la cantidad de agua sobrante.", [("botellas", "floor(46.22/1.5)", "30", None), ("sobra", "46.22-30*1.5", "1.22", None)], "30 botellas se llenan y sobran 1,22 litros", "mv1", "cap. 6, ejercicios y problemas, ej. 34")
calculo(P_, 2, ["A.2", "A.3"], "El examen de Matemáticas constaba de cuatro ejercicios. En ellos Jaime obtuvo las siguientes calificaciones: 5, 7, 8 y 7. Calcula la nota media del examen de Jaime y aproxímala tanto por truncamiento como por redondeo hasta las décimas.", [(None, "(5+7+8+7)/4", "6.75", None)], "Nota media 6,75; por redondeo 6,8; por truncamiento 6,7", "mv1", "cap. 6, ejercicios y problemas, ej. 38")
calculo(P_, 2, ["A.3", "A.5", "A.6"], "Los padres de Alicia están comprando varias macetas y plantas. El importe de todo ello es de 135,80 euros. El comercio realiza un descuento del 2,5 % si se paga en metálico y no con tarjeta de crédito. Si los padres de Alicia optan por el pago en metálico, ¿qué cantidad deberán abonar?", [(None, "135.80*(1-0.025)", "132.405", None)], "132,405 €, que como no se puede pagar en metálico se redondea a las centésimas: 132,41 €", "mv1", "cap. 6, ejercicios y problemas, ej. 39")
calculo(P_, 1, ["A.3", "A.6"], "Ana compró 12 gominolas y 14 chicles. Cada gominola cuesta 0,10 € y cada chicle 0,15. Pagó con un billete de 10 €. ¿Cuánto dinero le tienen que devolver?", [(None, "10-(12*0.10+14*0.15)", "6.70", None)], "10 − (1,20 + 2,10) = 6,70 €", "edad1", "quincena 4, para practicar, ej. 5")
calculo(P_, 2, S, "Yo vivo en un quinto piso. Entre cada piso hay 15 escalones iguales que miden cada uno 0,175 m. Además hay que pasar un escalón en el portal que mide 0,15 m. ¿A cuántos metros de altura está el suelo de mi piso?", [(None, "5*15*0.175+0.15", "13.275", None)], "75 · 0,175 + 0,15 = 13,275 m", "edad1", "quincena 4, para practicar, ej. 6")
calculo(P_, 2, S, "Un coche consume una media de 4,2 litros de gasolina cada 100 km. Tiene el depósito lleno y son 45 litros. Recorre 888 km. ¿Cuántos litros de gasolina quedan, aproximadamente, en el depósito?", [(None, "45-888*4.2/100", "7.704", None)], "45 − 888 · 0,042 = 7,704 ≈ 8 litros", "edad1", "quincena 4, para practicar, ej. 7")
calculo(P_, 2, S, "Un depósito contiene 124 litros de zumo. Con 57 litros se llenan botellas de 0,25 litros cada una y con el resto que queda en el depósito se llenan botellas de 0,5 litros. ¿Cuántas botellas se llenan en total?", [(None, "57/0.25+(124-57)/0.5", "362", None)], "228 + 134 = 362 botellas", "edad1", "quincena 4, para practicar, ej. 8")
calculo(P_, 2, ["A.3", "B.1"], "Un paquete de 500 folios tiene un grosor de 6,8 cm y pesa 0,884 g. ¿Cuál es el grosor, en mm, de un folio? ¿Cuál es el peso, en gramos, de un folio?", [("grosor", "68/500", "0.136", None), ("peso", "0.884/500", "0.001768", None)],
        "Grosor: 68 mm : 500 = 0,136 mm (la fuente divide 0,68 y da 0,00136 mm: está mal, 6,8 cm son 68 mm). Peso: 0,001768 g", "edad1", "quincena 4, para practicar, ej. 9 (la fuente se equivoca de unidad en el grosor)")
calculo(P_, 3, S, "Una caja contiene 35 bombones iguales y pesa 0,471 kg. El peso de la caja vacía es 149 g. ¿Cuántos kg pesa la caja después de comernos 26 bombones?", [("bombones", "(0.471-0.149)/35*9", "0.0828", None), ("con la caja", "(0.471-0.149)/35*9+0.149", "0.2318", None)],
        "Cada bombón pesa 0,322 : 35 = 0,0092 kg; los 9 que quedan pesan 0,0828 kg (lo que da la fuente) y, con la caja vacía, 0,2318 kg. El enunciado es ambiguo: «la caja» puede ser solo el contenido o todo", "edad1", "quincena 4, para practicar, ej. 10 (enunciado ambiguo)")
calculo(P_, 3, ["A.3", "B.1"], "Un grifo no cierra bien y pierde 2 ml de agua cada 5 segundos. ¿Cuántos litros se perderán en una semana?", [(None, "2/5*60*60*24*7/1000", "241.92", None)],
        "0,4 ml por segundo: 0,4 · 604 800 s = 241 920 ml = 241,92 litros. (La fuente pasa de minutos a horas multiplicando por 12 en vez de por 60 y da 24,192 litros: está mal.)", "edad1", "quincena 4, para practicar, ej. 14 (la solución de la fuente está mal)")
guarda(materia="matematicas", etapa="eso", curso=1, tema="numeros-decimales", titulo="Números decimales",
       saberes=["A.2", "A.3", "A.4", "A.5", "A.6", "B.1"], prefijo="m1-dec")
