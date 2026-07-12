"""
Configuración: todo lo que cambia entre "en mi máquina" y "en la nube" vive
acá, leído de variables de entorno — nunca escrito a mano en otro archivo.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()  # lee el archivo .env si existe (no hace nada en producción real)


def _requerida(nombre: str) -> str:
    valor = os.environ.get(nombre)
    if not valor:
        raise RuntimeError(
            f"Falta la variable de entorno {nombre}. "
            f"Copiá .env.example a .env y completala (ver modelo_piloto.md, sección 9)."
        )
    return valor


DATABASE_URL = _requerida("DATABASE_URL")
ALLOWED_DOMAIN = os.environ.get("ALLOWED_DOMAIN", "sclem.cl")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "https://jhondp.github.io")
GOOGLE_APPLICATION_CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get("FIREBASE_CREDENTIALS")
FIREBASE_JSON_STR = os.environ.get("FIREBASE_JSON")
