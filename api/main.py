"""
Cuatro rutas, nada más — el mínimo que sostiene todo el flujo de este piloto:

  GET /salud                     — confirma que la API está viva (sin login)
  GET /quien-soy                 — identidad + estado de aprobación
  GET /visualizaciones/resumen   — el dato protegido, solo para aprobados
  (el ETL que llenará ese resumen con datos reales es una etapa posterior)

Correr en local: ver MANUAL.md, sección 5.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .auth import RequiereAprobado, RequiereIdentidad, Usuario

app = FastAPI(title="Piloto SC — API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)


@app.get("/salud")
def salud() -> dict:
    return {"ok": True}


@app.get("/quien-soy")
def quien_soy(usuario: Usuario = RequiereIdentidad) -> dict:
    db.registrar_intento(usuario.email, "/quien-soy", usuario.estado)
    return {"email": usuario.email, "estado": usuario.estado, "rol": usuario.rol}


@app.get("/visualizaciones/resumen")
def visualizaciones_resumen(usuario: Usuario = RequiereAprobado) -> dict:
    db.registrar_intento(usuario.email, "/visualizaciones/resumen", "ok")
    # TODO(etapa futura): reemplazar por una consulta real a fact_eerr_mensual
    # una vez que exista el ETL. Por ahora la tabla existe pero está vacía —
    # se lo decimos así al frontend en vez de inventar números.
    return {
        "temporada": "24-25",
        "hay_datos": False,
        "mensaje": "Todavía no hay datos cargados para esta temporada.",
    }
