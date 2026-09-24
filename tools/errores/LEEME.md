# Tabla de revisión de las respuestas-trampa

Jorge revisa las respuestas-trampa como tabla, no como PDF. Para regenerarla:

```
node tools/errores/datosDeLaTabla.mjs /tmp/trampas.json
python3 tools/errores/tablaDeRevision.py /tmp/trampas.json respuestas-trampa-enteros.xlsx
```

Dos ejemplos de cada batería (semillas fijas `revision-1` y `revision-2`), cuatro
apartados cada uno. Las trampas salen de `server/lib/generadorEjercicios/errores/`.
