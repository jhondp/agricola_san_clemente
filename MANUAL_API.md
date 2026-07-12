# MANUAL — Piloto SC

Este manual es la referencia operativa para levantar, correr y seguir construyendo
`piloto_sc`. El código de `api/`, `db/` y `web/` lo cita por número de sección
(buscá `MANUAL.md` en los comentarios) — esta es la primera vez que el archivo
existe, así que los números de acá son los que quedan fijos de ahora en más.

Si buscás el **porqué** de una decisión (por qué Firebase, por qué modelo estrella,
por qué la misma base para el LLM, comparación de infraestructuras) eso ya está
escrito y no se repite acá: está en `../piloto_claude_final/plan-infraestructura.html`
y `../piloto_claude_final/plan-database.html`. Este manual es el **cómo**, paso a
paso, con los comandos exactos. La sección 10 mapea cada tema a su plan.

---

## 0 · Estado actual del piloto (leer primero)

Lo que ya funciona, de punta a punta, en este repositorio:

- **Login con Google + aprobación manual**: `web/index.html` + `web/app.js` +
  `api/auth.py` + tabla `usuarios`. Circuito completo y probado.
- **Gating real (no cosmético)**: `/quien-soy` y `/visualizaciones/resumen` en
  `api/main.py`, protegidas por los dos niveles de guardia de `auth.py`.
- **Auditoría de accesos**: cada pedido a una ruta protegida queda en
  `auditoria_acceso` (`api/db.py::registrar_intento`).
- **Esquema de base de datos completo** (`db/01_schema.sql`): usuarios/auditoría
  operativos + el esqueleto en estrella del EERR (vacío a propósito).
- **Despliegue del frontend listo** (`.github/workflows/deploy-pages.yml`): un
  push a `main` que toque `web/**` lo publica solo en GitHub Pages.

Lo que **falta** construir (roadmap detallado en la sección 9):

- `db/02_views.sql` — las vistas de solo lectura y los 3 roles de base de datos
  (hoy `app_api` lee las tablas directo, no vistas — es deuda respecto del plan).
- El ETL (`etl/reglas.py`, `etl/cargar.py`) — hoy `fact_eerr_mensual` está vacía,
  por eso `/visualizaciones/resumen` devuelve `hay_datos: false` a propósito.
- El chatbot con function calling.
- La mini página de administración para aprobar registros (hoy se hace a mano
  en la tabla `usuarios`).

---

## 1 · Arquitectura en 3 piezas

```
web/ (estático, GitHub Pages)  →  api/ (FastAPI, Render)  →  PostgreSQL (Supabase → Railway)
        │                              │
        └── Firebase Authentication ───┘  (login; la API verifica cada token)
```

Regla que no cambia en ningún paso de este manual: el frontend nunca decide quién
ve qué (`web/app.js` línea 5-8) y nunca guarda un secreto. Todo lo sensible vive
en variables de entorno de la API (`api/config.py`).

---

## 2 · Cuentas y herramientas que necesitás (todas gratis para el piloto)

| Cuenta / herramienta | Para qué | Dónde |
|---|---|---|
| GitHub | Código + hosting del frontend | ya la tenés (este repo) |
| Firebase | Login con Google | console.firebase.google.com |
| Supabase | Base de datos PostgreSQL del piloto | supabase.com |
| Render | Alojar la API | render.com |
| Python 3.11+ | Correr la API en tu máquina | ya instalado / `python3 --version` |
| Docker (opcional) | Postgres local para practicar sin depender de internet | solo si querés probar sin Supabase |

---

## 3 · Base de datos: crear y aplicar el esquema

El archivo `db/01_schema.sql` es la única fuente de verdad del esquema. Se aplica
completo, una sola vez, contra una base vacía.

### 3-A · Opción rápida: Postgres local con Docker (para practicar)

Útil para probar el esquema sin depender de internet ni gastar tu proyecto de
Supabase mientras aprendés. No es lo que usa el piloto en la nube.

```bash
docker run --name piloto-sc-db -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:16
docker exec -it piloto-sc-db psql -U postgres -c "CREATE DATABASE piloto_sc;"
docker exec -i piloto-sc-db psql -U postgres -d piloto_sc < db/01_schema.sql
```

En tu `.env` (sección 5): `DATABASE_URL=postgresql://app_api:CAMBIAR_ESTA_CLAVE@localhost:5432/piloto_sc`
— ojo, antes tenés que cambiar esa clave en `01_schema.sql` o hacer
`ALTER ROLE app_api PASSWORD '...'` a mano tras aplicar el esquema.

### 3-B · Lo que usa el piloto: Supabase

1. `supabase.com` → **New project**. Anotá la contraseña del usuario `postgres`
   que te pide al crear el proyecto (no es la de `app_api`).
2. **Validación:** el proyecto queda con una base PostgreSQL vacía y accesible.
3. Abrí el **SQL Editor** del proyecto, pegá el contenido completo de
   `db/01_schema.sql` y ejecutalo.
4. **Antes de correrlo o inmediatamente después**, cambiá la clave de arranque:
   en el mismo SQL Editor, sin guardar la clave real en ningún archivo:
   ```sql
   ALTER ROLE app_api PASSWORD 'una-clave-fuerte-que-no-se-commitea';
   ```
5. **Validación:** en **Table Editor** aparecen todas las tablas (`usuarios`,
   `auditoria_acceso`, `dim_cuartel`, `dim_cuenta`, `dim_tiempo`,
   `dim_escenario`, `fact_eerr_mensual`), todas vacías salvo lo que cargues a mano.
6. Sacá la cadena de conexión: **Project Settings → Database → Connection
   string**, reemplazando el usuario/contraseña por los de `app_api` que
   pusiste en el paso 4. Esa es tu `DATABASE_URL`.

### 3-C · Verificar los permisos (no te saltees esto)

`app_api` debe poder leer/escribir `usuarios`, insertar en `auditoria_acceso`, y
solo **leer** el resto. Probalo con una conexión usando esa cadena:

```sql
DELETE FROM usuarios;  -- debe fallar: app_api no tiene DELETE
INSERT INTO auditoria_acceso (email, ruta, resultado) VALUES ('test@test.com', '/test', 'ok');  -- debe funcionar
```

---

## 4 · Firebase: login con Google

### 4-1 · Crear el proyecto y activar Google como único proveedor

1. `console.firebase.google.com` → **Add project** (nombre sugerido: `piloto-sc`,
   ya usado en `api/firebase-service-account.json`).
2. **Build → Authentication → Sign-in method** → activar **Google**.
3. Confirmá que **Email/contraseña quede desactivado** — nadie debe poder
   inventarse una cuenta; solo entran cuentas reales de Google
   (checklist del plan 1, sección 08).

### 4-2 · Configuración pública del frontend

1. **Project settings (⚙️) → General → Your apps → Web (`</>`)**. Registrá una
   app (no hace falta Firebase Hosting).
2. Copiá el objeto `firebaseConfig` que te muestra y pegalo en
   `web/firebase-config.js` (copiá primero `web/firebase-config.example.js` si
   no existe todavía):
   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
   };
   export const DOMINIO_SUGERIDO = "empresa.cl";
   ```
3. Este archivo **no se sube al repo** (`.gitignore`), y no hace falta que se
   suba: el `apiKey` es público por diseño, pero mantenerlo aparte deja claro
   qué hay que completar (ver la nota en el propio archivo).

### 4-3 · Cuenta de servicio (la usa el backend, nunca el frontend)

1. **Project settings → Service accounts → Generate new private key**.
2. Descargalo y guardalo como `api/firebase-service-account.json`.
3. **Este archivo SÍ es un secreto real** (a diferencia del `apiKey` de arriba):
   con él, cualquiera puede hacerse pasar por tu backend ante Firebase.
   Ya está en `.gitignore` — verificá con
   `git check-ignore -v api/firebase-service-account.json` que efectivamente
   se ignora antes de tu primer `git add`.
   > Si en algún momento este archivo se compartió, se subió a un lugar
   > público, o simplemente no estás seguro de que siempre estuvo protegido:
   > revocalo y generá uno nuevo desde el mismo panel (**Service accounts →
   > Manage service account permissions** en Google Cloud Console → borrar la
   > clave vieja) en vez de asumir que está bien.

### 4-4 · Nota de seguridad sobre el dominio

`DOMINIO_SUGERIDO` en `firebase-config.js` es **solo cosmético** (sugiere el
dominio en la ventana de Google). El filtro real está en
`api/auth.py::identidad_verificada`, que rechaza cualquier correo cuyo dominio
no sea `ALLOWED_DOMAIN`. Probá esto explícitamente en la sección 7.

---

## 5 · Correr todo en tu máquina

### 5-1 · La API

```bash
cd piloto_sc/api
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # y completar los 4 valores (secciones 3 y 4)
cd ..                               # volver a piloto_sc/, main.py se importa como paquete
uvicorn api.main:app --reload --port 8000
```

**Validación:** `curl http://127.0.0.1:8000/salud` responde `{"ok": true}`.

### 5-2 · El frontend

Nunca abras `web/index.html` con doble clic (`file://`) — los módulos ES de
Firebase no cargan y la API rechazaría el origen igual. Serví la carpeta:

```bash
cd piloto_sc/web
python3 -m http.server 5500
```

Abrí `http://127.0.0.1:5500`. Esto coincide con el `FRONTEND_ORIGIN` por
defecto de `.env.example` — si usás otro puerto, actualizá esa variable y
reiniciá la API.

### 5-3 · Primer login de prueba

Con la API y el frontend corriendo: clic en "Iniciar sesión" → cuenta de Google
del dominio configurado en `ALLOWED_DOMAIN` → deberías caer en la pantalla de
"pendiente de aprobación" (ver sección 7 para aprobarte).

---

## 6 · Desplegar la API (Render) y apuntar el frontend a ella

1. `render.com` → **New → Web Service** → conectar este repositorio.
2. **Root Directory:** `piloto_sc`. **Start Command:**
   `uvicorn api.main:app --host 0.0.0.0 --port $PORT`.
3. Variables de entorno (**Environment**): `DATABASE_URL`, `ALLOWED_DOMAIN`,
   `FRONTEND_ORIGIN` (la URL real de GitHub Pages, sección 8) como texto plano.
4. `GOOGLE_APPLICATION_CREDENTIALS` **no se sube como texto**: en Render, usá
   **Secret Files** para subir el contenido de
   `api/firebase-service-account.json` montado en, por ejemplo,
   `/etc/secrets/firebase-service-account.json`, y poné esa ruta como valor de
   la variable de entorno.
5. **Validación:** `https://tu-servicio.onrender.com/salud` responde
   `{"ok": true}`. El primer pedido puede tardar ~30-50s (el free tier "duerme"
   la API sin uso — ver plan 1, sección 06).
6. Actualizá `API_BASE_URL` en `web/app.js` (línea 17) con esa URL, y hacé commit
   — el workflow de la sección 8 la despliega sola.

---

## 7 · Aprobar un registro y probar el flujo completo

1. Alguien (o vos mismo con otra cuenta) inicia sesión → queda en `usuarios`
   con `estado = 'pendiente'` (esto lo crea `api/db.py::obtener_o_crear_usuario`
   automáticamente, la primera vez que esa persona entra).
2. En **Supabase → Table Editor → usuarios**, cambiá la celda `estado` de esa
   fila a `aprobado` (opcionalmente completá `aprobado_por` con tu nombre).
   Sin escribir SQL — este es el mecanismo de aprobación manual del piloto.
3. La persona vuelve a iniciar sesión (o refresca): ahora ve la pestaña
   "Visualizaciones" con el mensaje `hay_datos: false` (correcto — todavía no
   hay ETL, sección 9).

**Prueba de que el gating es real y no cosmético** (checklist del plan 1):
con un usuario en estado `pendiente`, pedí a mano una ruta protegida:

```bash
curl -H "Authorization: Bearer <token_de_esa_persona>" \
  https://tu-servicio.onrender.com/visualizaciones/resumen
# debe responder 403, nunca datos
```

**Prueba de que el dominio se filtra en el backend:** iniciá sesión con una
cuenta de Gmail personal (fuera de `ALLOWED_DOMAIN`) — el login de Google debe
funcionar, pero `/quien-soy` debe responder 403 y `app.js` debe cerrar la
sesión sola (ver el bloque `if (respuesta.status === 403)` en `web/app.js`).

---

## 8 · Desplegar el frontend (GitHub Pages) y checklist de seguridad

### 8-1 · Configurar GitHub Pages

**Settings → Pages → Source: "GitHub Actions"**. Con eso alcanza — el workflow
`.github/workflows/deploy-pages.yml` ya está en el repo y se dispara solo en
cada push a `main` que toque `web/**`, o manualmente desde la pestaña
**Actions** (`workflow_dispatch`).

### 8-2 · Revisar qué nunca se sube al repositorio

Antes de tu primer `git add` de esta carpeta, confirmá que `.gitignore`
(`piloto_sc/.gitignore`) sigue cubriendo: `api/.env`,
`api/firebase-service-account.json`, `web/firebase-config.js`. Corré
`git status` y revisá la lista de archivos nuevos — si alguno de esos tres
aparece como "para agregar", algo está mal configurado; no lo commitees.

### 8-3 · La clave del rol `app_api`: nunca la real en el repo

`db/01_schema.sql` **sí se sube al repo** (a propósito, es solo estructura) con
una contraseña de arranque (`CAMBIAR_ESTA_CLAVE`) que sirve únicamente para
practicar en Docker local (sección 3-A). La contraseña real de producción:

- se cambia una vez, a mano, en el editor SQL de Supabase/Railway (sección 3-B,
  paso 4) — nunca guardándola en un archivo del repositorio;
- vive solo en tu `.env` local y en las variables de entorno de Render
  (sección 6) — nunca en un commit, nunca en un mensaje de chat pegado en un
  issue o PR.

---

## 9 · Qué falta construir (roadmap, en el orden recomendado)

1. **`db/02_views.sql`** — vistas de solo lectura (`v_gasto_por_cuenta_mes`,
   `v_cuadre_control`, `v_estado_cierre`, etc.) y los 3 roles de base de datos
   descritos en el plan 2 (administrador / ETL / API-solo-vistas). Hoy
   `01_schema.sql` le da a `app_api` `SELECT` directo sobre las tablas
   `dim_*`/`fact_eerr_mensual` — funciona para el piloto, pero es la deuda a
   saldar antes de conectar el LLM (plan 2, sección 07).
2. **El ETL** (`etl/reglas.py`, `etl/cargar.py`) — hoy no existe la carpeta.
   Implementar en el orden del plan 2, sección 04-06: primero
   `staging.eerr_crudo`, después el motor de reglas, después la carga con
   cuadre automático. Empezar por la carga piloto de una sola temporada
   (plan 2, sección 05) antes de automatizar el cierre mensual.
3. **Reemplazar el stub de `/visualizaciones/resumen`** en `api/main.py` por
   una consulta real a `v_cuadre_control` / `fact_eerr_mensual` una vez que el
   ETL haya cargado datos.
4. **El chatbot con function calling** (plan 1, sección 05) — un catálogo
   cerrado de funciones que la API ejecuta contra las vistas de solo lectura
   del punto 1; el LLM nunca escribe SQL.
5. **Mini página de administración** para aprobar/rechazar registros sin entrar
   a Supabase — reemplaza el paso manual de la sección 7 cuando entren más
   usuarios (plan 1, sección 07, Etapa 2).
6. Opcional: correo automático al aprobar un registro.

---

## 10 · Mapa: qué decisión está explicada en qué plan

| Tema | Dónde está la razón completa |
|---|---|
| Por qué Firebase y no otro login | `plan-infraestructura.html`, sección 03 |
| Por qué el frontend nunca decide quién ve qué | `plan-infraestructura.html`, sección 04 |
| Diseño del chatbot con function calling | `plan-infraestructura.html`, sección 05 |
| Comparación de las 4 infraestructuras (Neon/Supabase/Railway/Fly.io) | `plan-infraestructura.html`, sección 06 |
| Por qué modelo estrella y no el Excel ancho actual | `plan-database.html`, sección 02 |
| Por qué separar "dato crudo" de "reglas" (staging) | `plan-database.html`, sección 03 |
| Reglas de prorrateo (`HA-ESP`, `HA-CAM-PROD`, `SAP-DIR`) | `plan-database.html`, sección 06 |
| Misma base para el LLM vs. base aledaña | `plan-database.html`, sección 07 |
| Cuándo escalar de Supabase a Railway | ambos planes, secciones "Etapas"/"Escala" |

---

## 11 · Checklist final antes de cargar datos reales

- [ ] Base migrada a un proveedor con red privada (Railway) — endpoint no
      alcanzable desde internet.
- [ ] `db/02_views.sql` aplicado: el usuario de la API solo lee vistas, nunca
      tablas ni `staging.*`.
- [ ] Respaldo automático activo, **y probado**: restaurar un `pg_dump` en una
      base de prueba y confirmar que abre.
- [ ] Autorización de TI para datos de la empresa en un cloud externo,
      confirmada por escrito.
- [ ] Una segunda persona puede seguir este manual y levantar el sistema sin
      tu ayuda — si solo vos podés, no es sostenible todavía.
