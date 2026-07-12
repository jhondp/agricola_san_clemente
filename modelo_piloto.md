# Cómo Construir un Portal Corporativo Seguro a Costo Cero
**Manual Definitivo Paso a Paso para Principiantes**

Este documento es una guía explicada con "peras y manzanas" para que cualquier persona, sin conocimientos previos avanzados de programación, entienda exactamente qué construimos, cómo funciona por debajo, y cómo puede replicar esta misma arquitectura en un proyecto nuevo.

---

## 1. La Filosofía del Sistema (Analogía)
Imagina que construimos un Club VIP (El Portal de la Empresa):
1. **GitHub Pages (El Terreno):** Es donde está construida la casa. Cualquiera puede pasar por la calle y ver la fachada.
2. **Frontend - HTML/JS (La Casa):** Son las paredes, los colores y las puertas de tu club.
3. **Firebase (El Guardia en la Puerta):** Le pide el carnet a la gente. Solo verifica si el carnet (Cuenta de Google) es falso o verdadero.
4. **Supabase (La Lista de Invitados):** Es un cuaderno donde anotamos quién tiene permitido pasar al salón VIP y quién no.
5. **FastAPI en Render (El Gerente del Club):** Es el cerebro. El guardia (Firebase) le pasa el carnet al gerente (Render), el gerente revisa la lista de invitados (Supabase), y le avisa por radio a la casa (Frontend) si debe abrir la puerta de la zona VIP o no.

---

## 2. Paso a Paso: Cómo replicarlo en un Proyecto Nuevo

### Fase 1: El Frontend (La Fachada)
1. **Crear los archivos visuales:** Creas tus archivos `.html`, `.css` (para el diseño) y `app.js` (para la interactividad básica). 
2. **Subirlo a GitHub:** Creas una cuenta en GitHub, subes tus archivos y activas una opción gratuita llamada **GitHub Pages**. En 1 minuto, GitHub te da un enlace web público donde tu página ya está viva en internet.
3. **El problema:** Hasta aquí, tu web es pública. Si pones información secreta, cualquiera que adivine el enlace podrá leerla.

### Fase 2: El Guardia de Seguridad (Firebase)
Para saber *quién* está visitando la página, usamos Google Firebase (100% gratuito).
1. Entras a `console.firebase.google.com`, creas un proyecto y activas "Authentication" (elegir Iniciar sesión con Google).
2. Firebase te dará un texto de configuración (un bloque de código). Copias eso y lo pegas en un archivo nuevo en tu proyecto llamado `firebase-config.js`.
3. Con eso, ya puedes poner un botón en tu web que diga "Iniciar Sesión". Cuando la gente hace clic, sale la clásica ventanita de Google pidiendo su correo.

### Fase 3: La Cortina Negra (Protegiendo el Frontend)
Aun si el usuario inicia sesión, necesitamos esconder el contenido secreto para quienes no tienen permiso.
1. En cada archivo HTML que sea secreto (ej. `diagrama.html`), justo antes de que termine la etiqueta `</head>`, pones este código CSS inyectado:
   ```html
   <style id="auth-guard">
     body > *:not(header) { opacity: 0 !important; pointer-events: none !important; }
   </style>
   ```
   *¿Qué hace esto?* Vuelve toda la página invisible e intocable por defecto, excepto el menú superior. 

### Fase 4: La Base de Datos (La Lista VIP en Supabase)
Necesitamos un lugar para guardar a nuestros empleados y saber si están aprobados.
1. Entras a `supabase.com` y creas un proyecto nuevo gratis. Esto te dará una base de datos PostgreSQL en la nube.
2. Abres el "SQL Editor" en Supabase y creas una tabla llamada `usuarios` con tres columnas: `email` (correo), `estado` (aprobado o pendiente) y `rol` (empleado, admin).
3. Creas una segunda tabla llamada `auditoria_acceso` para guardar un historial (log) de todas las veces que alguien intenta entrar a tu web.

### Fase 5: El Cerebro (El Servidor en Render)
El Frontend (HTML) no debe hablar directamente con la Base de Datos por seguridad (cualquiera podría presionar F12 y robarte la contraseña de Supabase). Necesitamos un intermediario seguro.
1. Creas una carpeta llamada `api` y programas un servidor en lenguaje Python usando una herramienta llamada **FastAPI**.
2. **La lógica del servidor:**
   - Recibe el "Ticket" de Google del usuario que intenta entrar.
   - Revisa si el dominio del correo es válido (ej. `@tuempresa.com`). Si no lo es, lo rechaza.
   - Si es válido, se conecta a Supabase y busca el correo. 
   - Si el correo no existe, lo guarda con el estado `"pendiente"`.
   - Le responde a la página web: *El usuario juan@tuempresa.com es válido, pero está en estado 'pendiente'.*
3. Subes este código a GitHub, y abres una cuenta en **Render.com**. Conectas Render a tu GitHub, y Render automáticamente encenderá tu servidor Python en internet y te dará un link (ej. `tu-api.onrender.com`).

### Fase 6: La Conexión Final y el "Optimistic UI"
Ahora conectamos la Fase 1 con la Fase 5 en nuestro archivo `app.js`.
1. Cuando el usuario inicia sesión con Google, el archivo `app.js` toma el ticket y hace un "fetch" (una llamada telefónica) al link de Render.
2. Si Render responde que el usuario está `"aprobado"`, el `app.js` hace dos cosas visuales:
   - Aparece el menú oculto de "Recursos".
   - Destruye la cortina negra (`<style id="auth-guard">`), haciendo que el contenido secreto se vuelva visible suavemente.
3. **El toque profesional (Caché):** Como Render gratuito a veces se queda dormido y tarda en responder, programamos el `app.js` para que guarde el estado del usuario en la memoria del navegador (`sessionStorage`). Así, cuando el usuario cambia a otra página secreta, la web recuerda que ya está aprobado y quita la cortina negra instantáneamente en 1 milisegundo, sin tener que esperar a que Render vuelva a responder.

---

## 3. Resumen de Herramientas Usadas
Si quieres replicar esto, este es tu arsenal:
* **VS Code:** Para escribir los códigos.
* **GitHub Pages:** Para alojar lo visual.
* **Firebase:** Para iniciar sesión con Google.
* **Supabase:** Para la base de datos (PostgreSQL).
* **Python (FastAPI):** Para el cerebro que toma decisiones.
* **Render:** Para darle vida al cerebro en internet 24/7.

---

## 4. Mapa Real del Repositorio (dónde vive cada pieza hoy)

La arquitectura de las secciones 1-3 no es teoría: ya está construida en este mismo repositorio. Así se reparte en carpetas y archivos concretos:

```
agricola_san_clemente/
├── index.html, acceso_denegado.html, *.html   → El Frontend (la Casa)
├── app.js                                      → La lógica de login/gating (Fase 6)
├── firebase-config.js                          → Credenciales públicas de Firebase (Fase 2)
├── styles.css                                  → Estilos del sitio
├── api/                                        → El Cerebro (FastAPI, Fase 5)
│   ├── main.py                                 → Las rutas HTTP
│   ├── auth.py                                 → El guardia (valida el token de Firebase)
│   ├── db.py                                   → Toda la conversación con Postgres
│   ├── config.py                               → Variables de entorno (nunca hardcodeadas)
│   ├── requirements.txt                        → Dependencias Python
│   ├── .env / .env.example                     → Secretos locales / plantilla pública
│   └── firebase-service-account.json           → Credencial privada de Firebase (secreto real)
├── db/
│   └── 01_schema.sql                           → El esquema completo de Supabase (Fase 4)
└── modelo_piloto/                              → Documentación de arquitectura y planes de escalamiento
    ├── RESUMEN_PROYECTO.md
    ├── plan-infraestructura.html
    └── plan-database.html
```

Todos los comentarios dentro del código (`main.py`, `auth.py`, `config.py`, `.env.example`, `firebase-config.js`, `01_schema.sql`) que decían *"ver MANUAL.md, sección X"* fueron actualizados para apuntar a este archivo (`modelo_piloto.md`) — el `MANUAL.md` que citaban ya no existe. Esta sección 4 en adelante cumple ese rol de manual operativo.

---

## 5. Las 4 Rutas de la API (lo único que el servidor sabe hacer hoy)

`api/main.py` expone deliberadamente el mínimo necesario para sostener el piloto:

| Ruta | Requiere login | Qué hace |
|---|---|---|
| `GET /salud` | No | Confirma que el servidor está vivo. Responde `{"ok": true}`. Úsala para probar que Render no está dormido. |
| `GET /quien-soy` | Sí (token válido) | Devuelve `email`, `estado` (`pendiente`/`aprobado`/`rechazado`) y `rol` de quien pregunta. La usa `app.js` para decidir si muestra el menú "Recursos". |
| `GET /visualizaciones/resumen` | Sí, y además `estado == "aprobado"` | El dato "protegido" de verdad. Hoy responde siempre `{"temporada": "24-25", "hay_datos": false, "mensaje": "..."}` porque el ETL que llenaría esto todavía no existe — es honesto en vez de inventar números. |

`api/auth.py` implementa dos "niveles de guardia" reutilizables como dependencias de FastAPI:
- `identidad_verificada` (`RequiereIdentidad`): valida el token de Firebase y el `email_verified`, y busca/crea al usuario en la tabla `usuarios`. No exige estado aprobado — solo confirma "quién sos".
- `usuario_aprobado` (`RequiereAprobado`): además exige `estado == "aprobado"`. Es la que protege datos reales.

Cada pedido a una ruta protegida —salga bien o mal— se registra en `auditoria_acceso` vía `db.registrar_intento(...)`.

---

## 6. Estado Actual de Seguridad — ¡Importante, léase antes de dar por sentado el filtro de dominio!

El diseño original (documentado en la Fase 5 y en `plan-infraestructura.html`) es: *cualquier cuenta de Google puede intentar iniciar sesión, pero solo se acepta el token si el dominio del correo coincide con `ALLOWED_DOMAIN` (`sclem.cl`)*.

**Ese filtro está actualmente apagado.** El commit más reciente (`ac7db6c — "Apagar lógica de dominio"`) comentó estas líneas en `api/auth.py`:

```python
# if dominio != config.ALLOWED_DOMAIN:
#     db.registrar_intento(email, "/quien-soy", "dominio_invalido")
#     raise HTTPException(
#         status.HTTP_403_FORBIDDEN,
#         f"Solo se admiten correos @{config.ALLOWED_DOMAIN}",
#     )
```

En la práctica, esto significa que **hoy cualquier cuenta de Google (Gmail personal incluido) puede loguearse y quedar registrada como `pendiente`** en la tabla `usuarios` — el único freno real que queda es la aprobación manual (sección 7). Esto probablemente se desactivó a propósito para pruebas (quizás para permitir que alguien sin correo `@sclem.cl` probara el flujo), pero es el tipo de cambio que hay que recordar revertir antes de considerar esto "producción": sin el filtro de dominio, la primera línea de defensa pasa a ser 100% la revisión manual en Supabase.

Lo mismo aplica al lado del frontend: `firebase-config.js` ya no le pasa el parámetro `hd` (dominio sugerido) al popup de Google (`// Se eliminó para permitir cualquier correo`), así que ni siquiera hay una sugerencia visual del dominio esperado.

**Checklist de seguridad vigente:**
- [x] El frontend nunca decide quién ve qué — toda decisión pasa por la API.
- [x] Ningún secreto real vive en el frontend (`firebase-config.js` solo tiene el `apiKey` público).
- [x] `api/.env` y `api/firebase-service-account.json` están en `.gitignore` (confirmado con `git check-ignore`).
- [x] Cada intento de acceso a una ruta protegida queda auditado.
- [ ] **Filtro de dominio de correo — actualmente desactivado (ver arriba).**
- [ ] Vistas SQL de solo lectura para blindar una futura IA (pendiente, sección 8).
- [ ] Mini-panel de administración para aprobar usuarios sin entrar a Supabase a mano (pendiente).

---

## 7. Cómo Aprobar a un Usuario (el único paso manual del sistema)

1. La persona inicia sesión con Google en el sitio. `api/db.py::obtener_o_crear_usuario` la inserta automáticamente en `usuarios` con `estado = 'pendiente'` la primera vez.
2. En Supabase → **Table Editor** → tabla `usuarios`, se busca esa fila y se cambia manualmente la columna `estado` a `aprobado` (opcionalmente completando `aprobado_por` con el nombre de quien aprueba).
3. La próxima vez que esa persona entra (o refresca la página), `app.js` vuelve a preguntarle a `/quien-soy`, ve `estado: "aprobado"`, guarda ese valor en `sessionStorage` (el "Optimistic UI" de la Fase 6) y revela el menú "Recursos" y las páginas privadas.

Las páginas consideradas privadas hoy (lista en `app.js`, constante `PAGINAS_PRIVADAS`): `Comparativa_Cerezas_vs_Manzanas.html`, `Ciclos_y_Temporadas.html`, `Indicadores_de_Gestion.html`, `Diagrama_Agricola.html`, `Diagrama_Conservera.html`, `Diagrama_Central_Fruticola.html`, `Diagrama_Exportadora.html`, `Cuestionario_Agricola.html`. Las tres infografías grandes (Cerezas, Manzanas, Centrales Frutícolas) e `index.html` quedan públicas.

---

## 8. El Esquema de Base de Datos (`db/01_schema.sql`)

Dos bloques con propósitos distintos:

**a) Usuarios y auditoría — ya operativo:**
- `usuarios (email PK, estado, rol, solicitado_en, aprobado_en, aprobado_por)` — `estado` restringido por `CHECK` a `pendiente` / `aprobado` / `rechazado`.
- `auditoria_acceso (id, email, creado_en, ruta, resultado)` — un renglón por cada pedido a una ruta protegida.

**b) Esqueleto del modelo EERR — creado pero vacío, a la espera del ETL:**
- `dim_cuartel` (huerto/cuartel: variedad, año de plantación, campo, especie, hectáreas)
- `dim_cuenta` (plan de cuentas de gestión: concepto → ítem → descripción, con la regla de prorrateo `HA-ESP` / `HA-CAM-PROD` / `SAP-DIR`)
- `dim_tiempo` (períodos 1-24 por temporada)
- `dim_escenario` (`PPTO` / `REAL` / `PROY` / `ANT`)
- `fact_eerr_mensual` (la tabla de hechos: monto CLP/USD por cuartel × cuenta × mes × escenario)

El rol `app_api` (con el que se conecta la API) solo tiene `SELECT`/`INSERT`/`UPDATE` sobre `usuarios`, `INSERT` sobre `auditoria_acceso`, y `SELECT` sobre las tablas `dim_*`/`fact_eerr_mensual` — todavía no existen las "vistas de solo lectura" que el plan de infraestructura recomienda como capa de seguridad adicional antes de conectar un LLM.

⚠️ El archivo `01_schema.sql` se sube al repositorio con una contraseña de arranque de ejemplo (`CAMBIAR_ESTA_CLAVE`) solo para practicar en Docker local. La clave real de producción se cambia a mano en el editor SQL de Supabase y solo vive en `api/.env` / variables de entorno de Render — nunca en un archivo del repo.

---

## 9. Cómo Correr Todo en Local (rutas actuales, ya migradas a la raíz)

**La API:**
```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # completar DATABASE_URL, ALLOWED_DOMAIN, etc.
cd ..
uvicorn api.main:app --reload --port 8000
```
Validación: `curl http://127.0.0.1:8000/salud` → `{"ok": true}`.

**El frontend:**
```bash
python3 -m http.server 5500
```
Abrir `http://127.0.0.1:5500` (nunca con doble clic / `file://`: los módulos ES de Firebase no cargan). Este puerto debe coincidir con `FRONTEND_ORIGIN` en `api/.env`.

**Detalle a tener presente:** `app.js` define `API_BASE_URL = "http://127.0.0.1:8000"` (línea 8) pero el `fetch` real a `/quien-soy` (línea 93) apunta *hardcodeado* a `https://agricola-san-clemente.onrender.com`, no a esa constante. Es decir, hoy `app.js` siempre habla con la API en la nube incluso corriendo el frontend en local — `API_BASE_URL` quedó como una variable sin uso real. Para probar contra la API local hay que cambiar esa URL a mano en el `fetch`.

---

## 10. Estado del Despliegue en la Nube

- **Frontend:** GitHub Pages, sirviendo directamente la raíz del repositorio (sin workflow de GitHub Actions).
- **Backend:** Render, en `https://agricola-san-clemente.onrender.com` (URL hardcodeada en `app.js`).
- **Base de datos:** Supabase (PostgreSQL), con el esquema de la sección 8 ya aplicado.
- **Firebase:** proyecto `piloto-sc`, con Google como único proveedor de login habilitado.

---

## 11. Lo que Falta Construir (hoja de ruta, en orden recomendado)

1. **`db/02_views.sql`** — vistas de solo lectura y roles separados (administrador / ETL / API-solo-vistas). Hoy `app_api` lee las tablas `dim_*`/`fact_eerr_mensual` directo; es deuda técnica antes de conectar cualquier IA.
2. **El ETL** (no existe todavía ninguna carpeta `etl/`) — scripts que tomen los Excel del EERR, apliquen las reglas de prorrateo (`HA-ESP`, `HA-CAM-PROD`, `SAP-DIR`) y carguen `fact_eerr_mensual`.
3. **Reemplazar el stub de `/visualizaciones/resumen`** por una consulta real una vez que el ETL haya cargado datos.
4. **El chatbot con function calling** — un catálogo cerrado de funciones que la API ejecuta contra las vistas de solo lectura del punto 1; el LLM nunca debe poder escribir SQL directo.
5. **Mini-panel de administración** para aprobar/rechazar usuarios sin entrar a Supabase a mano.
6. **Decidir sobre el filtro de dominio** (sección 6): reactivarlo, reemplazarlo por algo más flexible (lista de dominios permitidos, o aprobación manual como único filtro de forma permanente), o documentar formalmente que es una decisión de negocio dejarlo así.
7. Opcional: correo automático al aprobar un registro.

Los "por qué" detrás de estas decisiones (por qué Firebase, por qué modelo estrella, comparación de infraestructuras Neon/Supabase/Railway/Fly.io, cuándo separar la base del LLM) están desarrollados con más profundidad en `modelo_piloto/plan-infraestructura.html` y `modelo_piloto/plan-database.html`.
