<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Tutordigital · App</title>
  <style>
  /* ... otras reglas CSS ... */

  /* =============================
     MÓVIL: composer en 2 filas
     - Fila 1: preview adjunto (si existe)
     - Fila 2: input (100%)
     - Fila 3: botones (no se cortan)
     Además: cuando el input tiene foco, ocultamos iconos para ganar espacio.
     ============================= */
  @media (max-width: 600px){
    /* 2 filas reales: preview + input arriba, botones abajo */
    .footerRow{
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    /* Preview del adjunto: siempre arriba y a ancho completo */
    #attachPreview{
      order: 0;
      flex: 1 1 100%;
      width: 100%;
      margin-bottom: 6px;
    }

    /* Input: fila completa, que se vea lo que escribes */
    #inp{
      order: 1;
      flex: 1 1 100%;
      width: 100%;
      min-width: 0;
      padding: 12px 12px;
      font-size: 16px; /* iOS: evita zoom */
      line-height: 1.2;
    }

    /* Botonera: tercera fila */
    #kbd, .moreWrap, #more, #mic, #btn{
      order: 2;
    }

    /* Botones más compactos pero usables */
    button.send{
      padding: 10px 10px;
      font-size: 14px;
      border-radius: 10px;
      line-height: 1;
      white-space: nowrap;
    }

    /* Iconos con ancho fijo */
    #kbd, #more, #mic{
      width: 44px;
      padding: 10px;
      text-align: center;
      flex: 0 0 auto;
    }

    /* Enviar: que no se recorte */
    #btn{
      min-width: 96px;
      padding: 10px 14px;
      flex: 1 1 auto;
    }

    /* === Cuando el input está en foco: escondemos iconos para ganar ancho === */
    .footerRow:focus-within #kbd,
    .footerRow:focus-within #more,
    .footerRow:focus-within #mic{
      display: none;
    }

    .footerRow:focus-within #btn{
      flex: 0 0 auto;
      min-width: 120px;
    }

    .footerRow:focus-within #attachPreview{
      /* mantenemos el preview arriba incluso con teclado */
      display: flex;
    }
  }
  </style>
</head>
<body>
<!-- contenido -->
</body>
</html>