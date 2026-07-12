# Portal Agrícola San Clemente

Sitio del portal corporativo: infografías públicas + recursos privados con login (Google vía Firebase) y aprobación manual de acceso.

Para el manual operativo completo (arquitectura, endpoints, esquema de base de datos, estado de seguridad, cómo correr todo en local, despliegue y hoja de ruta pendiente), ver **[`modelo_piloto.md`](modelo_piloto.md)**.

## Resumen rápido

- **Frontend:** HTML/CSS/JS estático en la raíz del repo (`index.html`, `app.js`, `firebase-config.js`, `styles.css`, y las páginas de infografías/diagramas), servido por GitHub Pages.
- **Backend:** API en `api/` (FastAPI), desplegada en Render.
- **Base de datos:** esquema en `db/01_schema.sql`, aplicado en Supabase (PostgreSQL).
- **Login:** Firebase Authentication (Google) + aprobación manual del estado del usuario en la tabla `usuarios`.

## Correr en local

```bash
# API
cd api
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # completar valores
cd .. && uvicorn api.main:app --reload --port 8000

# Frontend (en otra terminal)
python3 -m http.server 5500
```

Detalle completo en `modelo_piloto.md`, sección 9.
