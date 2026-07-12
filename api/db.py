"""
Toda la conversación con Postgres pasa por acá — el resto del backend no
sabe (ni le importa) que hay SQL detrás de estas funciones.

Se abre una conexión nueva por pedido (`with _conectar() as con`), simple y
correcto para el volumen de un piloto. Si el tráfico creciera mucho, esto es
lo primero que se cambiaría por un "pool" de conexiones — no antes.
"""
from __future__ import annotations

from dataclasses import dataclass

import psycopg2
import psycopg2.extras

from . import config


def _conectar():
    return psycopg2.connect(config.DATABASE_URL)


@dataclass
class RegistroUsuario:
    email: str
    estado: str   # 'pendiente' | 'aprobado' | 'rechazado'
    rol: str


def obtener_o_crear_usuario(email: str) -> RegistroUsuario:
    """
    Si el correo ya está en `usuarios`, devuelve su fila. Si es la primera vez
    que esta persona inicia sesión, la inserta con estado 'pendiente' —
    este es el momento exacto en que nace una "solicitud de registro".
    """
    with _conectar() as con, con.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("SELECT email, estado, rol FROM usuarios WHERE email = %s", (email,))
        fila = cur.fetchone()
        if fila is None:
            cur.execute(
                "INSERT INTO usuarios (email, estado) VALUES (%s, 'aprobado') "
                "RETURNING email, estado, rol",
                (email,),
            )
            fila = cur.fetchone()
            con.commit()
        return RegistroUsuario(email=fila["email"], estado=fila["estado"], rol=fila["rol"])


def registrar_intento(email: str, ruta: str, resultado: str) -> None:
    """Deja rastro de cada pedido a una ruta protegida, salga bien o mal."""
    with _conectar() as con, con.cursor() as cur:
        cur.execute(
            "INSERT INTO auditoria_acceso (email, ruta, resultado) VALUES (%s, %s, %s)",
            (email, ruta, resultado),
        )
        con.commit()
