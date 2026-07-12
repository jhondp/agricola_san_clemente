-- ============================================================================
--  piloto_sc — esquema de base de datos
--  Dos bloques, con propósitos distintos:
--
--  1) USUARIOS Y AUDITORÍA — ya operativo. Sostiene el login con aprobación
--     manual: Firebase dice QUIÉN es la persona, esta tabla dice SI PUEDE PASAR.
--
--  2) ESQUELETO DEL MODELO EERR — tablas vacías, en forma de estrella
--     (dimensiones + un hecho). Las crea este archivo para que la base quede
--     "lista para el ETL" desde ya, pero NINGÚN dato entra todavía: eso es
--     una etapa posterior, no incluida en este piloto.
--
--  Cómo se aplica y qué validar en cada paso: ver MANUAL.md, sección 3.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- para generar UUID en auditoria_acceso

-- ============================================================================
--  1) USUARIOS Y AUDITORÍA
-- ============================================================================

-- Una fila por persona que alguna vez inició sesión. 'email' es la clave:
-- Firebase ya garantiza que ese correo es real y fue verificado por Google.
CREATE TABLE usuarios (
    email         TEXT PRIMARY KEY,
    estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    rol           TEXT NOT NULL DEFAULT 'visualizador',
    solicitado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    aprobado_en   TIMESTAMPTZ,
    aprobado_por  TEXT           -- quién cambió el estado (lo escribís vos, a mano)
);
COMMENT ON COLUMN usuarios.estado IS
  'pendiente = recién se registró, aún nadie lo revisó. '
  'aprobado = puede ver Visualizaciones. rechazado = acceso denegado explícito.';

-- Un renglón por cada vez que alguien golpeó una ruta protegida de la API,
-- haya salido bien o mal. Sirve para responder "¿quién entró y cuándo?" sin
-- adivinar, y para notar patrones raros (muchos rechazos seguidos, etc.).
CREATE TABLE auditoria_acceso (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email     TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    ruta      TEXT NOT NULL,
    resultado TEXT NOT NULL      -- 'ok' | 'pendiente' | 'rechazado' | 'token_invalido' | 'dominio_invalido'
);
CREATE INDEX ix_auditoria_email_fecha ON auditoria_acceso (email, creado_en);

-- ============================================================================
--  2) ESQUELETO DEL MODELO EERR (vacío — lo llenará el ETL, etapa futura)
-- ============================================================================

-- Grano operativo: cuartel/huerto. Por ahora solo la forma; se llena cuando
-- se construya el ETL (ver informe de auditoría, sección "plan de cuentas").
CREATE TABLE dim_cuartel (
    sk_cuartel     SERIAL PRIMARY KEY,
    id_cuartel     TEXT NOT NULL UNIQUE,   -- variedad+año plantación+estado+polinizante+grupo
    variedad       TEXT,
    ano_plantacion SMALLINT,
    campo          TEXT,
    ubicacion      TEXT,
    especie        TEXT,                  -- manzana / cítrico / uva
    hectareas      NUMERIC(12, 4)
);

-- Plan de cuentas de gestión: CONCEPTO → ITEM → DESCRIPCIÓN.
CREATE TABLE dim_cuenta (
    sk_cuenta    SERIAL PRIMARY KEY,
    concepto     TEXT NOT NULL,
    item         TEXT NOT NULL,
    descripcion  TEXT NOT NULL,
    distribucion TEXT,                    -- 'HA-ESP' | 'HA-CAM-PROD' | 'SAP-DIR' (regla de prorrateo)
    UNIQUE (concepto, item, descripcion)
);

-- Un renglón por mes de temporada (períodos 1..24, ENE→DIC ×2).
CREATE TABLE dim_tiempo (
    sk_tiempo     SERIAL PRIMARY KEY,
    temporada     TEXT NOT NULL,           -- '24-25'
    periodo_orden SMALLINT NOT NULL,       -- 1..24
    periodo_label TEXT NOT NULL,           -- '01-ENE'..'24-DIC'
    UNIQUE (temporada, periodo_orden)
);

-- Los 4 escenarios del EERR.
CREATE TABLE dim_escenario (
    sk_escenario SERIAL PRIMARY KEY,
    etapa        TEXT NOT NULL UNIQUE      -- 'PPTO' | 'REAL' | 'PROY' | 'ANT'
);

-- La tabla de hechos: un monto por cuartel × cuenta × mes × escenario.
-- Vacía hasta que exista el ETL — hoy solo confirma que el modelo "cierra".
CREATE TABLE fact_eerr_mensual (
    sk_tiempo    INTEGER NOT NULL REFERENCES dim_tiempo(sk_tiempo),
    sk_cuartel   INTEGER NOT NULL REFERENCES dim_cuartel(sk_cuartel),
    sk_cuenta    INTEGER NOT NULL REFERENCES dim_cuenta(sk_cuenta),
    sk_escenario INTEGER NOT NULL REFERENCES dim_escenario(sk_escenario),
    monto_clp    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    monto_usd    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (sk_tiempo, sk_cuartel, sk_cuenta, sk_escenario)
);

-- ============================================================================
--  ROL DE LA API — solo lo que este piloto necesita: leer/escribir usuarios,
--  registrar auditoría, y leer el esqueleto del EERR (para cuando haya datos).
--
--  ¡OJO! Este archivo se sube al repositorio (no está en .gitignore). La
--  contraseña de abajo es SOLO un valor de arranque para practicar en local
--  (Docker, MANUAL.md sección 3-A). En Supabase o cualquier base real, NO
--  ejecutes esta línea con esta clave: cambiala primero, o corré después
--  (directo en el editor SQL de Supabase, sin guardarlo en ningún archivo):
--    ALTER ROLE app_api PASSWORD 'una-clave-fuerte-que-no-se-commitea';
--  Esa clave real va solo en tu .env local / en las variables de entorno de
--  Render — nunca en un archivo que se suba a git (MANUAL.md sección 3 y 8.3).
-- ============================================================================
CREATE ROLE app_api LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';
GRANT SELECT, INSERT, UPDATE ON usuarios TO app_api;
GRANT INSERT ON auditoria_acceso TO app_api;
GRANT SELECT ON dim_cuartel, dim_cuenta, dim_tiempo, dim_escenario, fact_eerr_mensual TO app_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_api;
