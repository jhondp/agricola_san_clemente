"""
El guardia de la API. Dos niveles, porque resuelven preguntas distintas:

  identidad_verificada  -> "¿quién sos, y qué dice tu registro?"
                           Siempre responde si el token es válido y del
                           dominio correcto — sin importar el estado.
                           La usa /quien-soy: el frontend necesita saber
                           "pendiente" para mostrar el mensaje de espera.

  usuario_aprobado      -> "¿podés ver datos?"
                           Además exige estado == 'aprobado'. La usa
                           cualquier ruta que sirva información real
                           (hoy: /visualizaciones/resumen).

Ninguna decide nada por su cuenta: ambas se apoyan en Firebase (verificar
que el token es real) y en la tabla `usuarios` (verificar el estado).
"""
from __future__ import annotations

from dataclasses import dataclass

import firebase_admin
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from . import config, db

_app = firebase_admin.initialize_app(credentials.Certificate(config.GOOGLE_APPLICATION_CREDENTIALS))


@dataclass
class Usuario:
    email: str
    estado: str
    rol: str


def _token_de(authorization: str) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Falta el header Authorization: Bearer <token>",
        )
    return authorization.removeprefix("Bearer ").strip()


def identidad_verificada(authorization: str = Header(default="")) -> Usuario:
    token = _token_de(authorization)

    try:
        info = firebase_auth.verify_id_token(token)
    except Exception as exc:  # token vencido, falsificado, o de otro proyecto Firebase
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado") from exc

    email = info.get("email", "")
    email_verificado = info.get("email_verified", False)
    dominio = email.split("@")[-1] if "@" in email else ""

    if not email_verificado:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "El correo electrónico no está verificado",
        )

    registro = db.obtener_o_crear_usuario(email)
    return Usuario(email=registro.email, estado=registro.estado, rol=registro.rol)


def usuario_aprobado(usuario: Usuario = Depends(identidad_verificada)) -> Usuario:
    if usuario.estado != "aprobado":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Tu registro todavía no fue aprobado",
        )
    return usuario


RequiereIdentidad = Depends(identidad_verificada)
RequiereAprobado = Depends(usuario_aprobado)
