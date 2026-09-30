"""REGENERA los ejercicios de referencia desde sus scripts y los comprueba.

    python3 tools/referencias/genera.py                       # todo
    python3 tools/referencias/genera.py temas/eso/matematicas/2   # una carpeta
"""
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
carpeta = AQUI / (sys.argv[1] if len(sys.argv) > 1 else "temas")
for script in sorted(carpeta.rglob("*.py")):
    if not script.name.startswith("_"):
        subprocess.run([sys.executable, str(script)], check=True)
datos = AQUI.parents[1] / "server/lib/ejerciciosReferencia/datos"
sys.exit(subprocess.run([sys.executable, str(AQUI / "comprueba.py"), str(datos)]).returncode)
