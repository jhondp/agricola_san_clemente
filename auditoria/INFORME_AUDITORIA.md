# Auditoría del modelo Power BI — Área Control de Gestión (ASC / San Clemente)

*Elaborado a partir de: metadatos INFO.VIEW, Model.bim/VertiPaq (.vpax), código M de las 125 particiones, layout del reporte (91 páginas) y muestras de datos. Fecha: 2026-07-08.*

---

## 1. Entendimiento del negocio

### 1.1 Qué mide el modelo
Control presupuestario de una operación frutícola (unidad **ASC — San Clemente**, con módulos en desarrollo para Centrales, Exportadora, Foods y Conservera). El eje analítico es el **Estado de Resultados (EERR) por temporada agrícola** (jul–jun aprox., 24 meses de columnas ENE→DIC×2 por temporada), comparando 4 escenarios (**ETAPA**): `PPTO` (presupuesto), `REAL`, `PROY` (proyección/forecast) y `ANT` (temporada anterior), en **CLP y USD**, con indicadores unitarios por **hectárea, caja exportada y kg** (cosechado/procesado/exportado).

La unidad de análisis operativa es el **cuartel/huerto** (`ID` = variedad + año plantación + estado + polinizante + grupo), agregable a campo → ubicación → especie. El plan de cuentas de gestión es **CONCEPTO → ITEM → DESCRIPCION** (con atributos FIJO/VAR, BASE, DISTRIBUCION).

### 1.2 Flujo de datos actual (linaje reconstruido)

```
SAP (KSB1, export manual a Excel)          Excel PPTO/PROY (carga manual)
        │                                          │
        ▼                                          ▼
G:\ (Google Drive compartido) — 44 archivos Excel/XLSB
  • MAPEO * (xlsb): cuenta SAP → plan EERR + distribución de costos
  • EERR PPTO/REAL/PROY - SCLEM.xlsx (hoja BASE, ~85–232 MB c/u):
    ya traen los 24 meses en columnas, CLP y USD ya convertidos
        │
        ▼  Power Query (88 consultas M)
19 × BASE_<ETAPA>_<TEMPORADA>  (una consulta por escenario×temporada,
        │                       cada una lee la hoja BASE de su Excel)
        ▼  Table.Combine + join MES_ACUM_ET (flag del mes de cierre)
BASE_CONS_CIERRE_MENSUAL_EV      2,4 M filas × 110 cols (matriz ancha)
        │                        + columnas MES_ACTUAL / ACUM / RESTO / TOTAL
        ├──► EV_2   (unpivot 56 columnas)   ⚠ 126,7 M filas — 848 MB (35 % del modelo)
        ├──► PER    (unpivot 8 períodos × 2 monedas + pivot ETAPA)  14,3 M filas
        │      └──► PER_ING / PER_CJEX / PER_KGCOS / PER_PROD / PER_SUP
        └──► PER_ID_ETAP_TEMP  (pivot por temporada)  14,3 M filas (copia)
                                 + 63 medidas duplicadas por temporada

BASE_SAP_23-24/24-25/25-26 ──► BASE_SAP_CONS (798 K filas × 76 cols, detalle documento)
BASE_HIST_EERR_CONS (+8 derivadas)  — histórico EERR consolidado
Módulo RRHH: FICHA COLABORADOR, REM, DIAS FALTAS, CAPACITACION, SINIESTRABILIDAD
```

### 1.3 Cifras clave del modelo

| Métrica | Valor | Comentario |
|---|---|---|
| Tamaño pbix / memoria | 504 MB / **2,4 GB** | Al límite de Pro (1 GB) si se publica |
| Filas totales | **169,4 M** | 75 % en EV_2 (126,7 M) |
| Tablas | 125 (55 ocultas) | 88 M + 37 calculadas; ~15 son LocalDateTable automáticas |
| Columnas | 4.999 | 3.832 de texto |
| Medidas | 286 | 102 en PER + 63 duplicadas por temporada en PER_ID_ETAP_TEMP |
| Relaciones | 47 | Mayoría hacia LocalDateTables o tablas ORDEN_* de ordenamiento; **no hay star schema**: las tablas grandes están desconectadas entre sí |
| Páginas del reporte | 91 | ~48 son la misma plantilla repetida por métrica/escenario; 6 se llaman "Duplicado de…" |
| Orígenes | 44 archivos Excel/XLSB en `G:\` | Cero bases de datos |

### 1.4 Concentración de uso (verificado contra layout y VertiPaq)

Cruce entre las 663 referencias de visuales del reporte y el tamaño en memoria de cada familia de tablas:

| Familia | Memoria | Páginas donde aparece | Referencias en visuales |
|---|---|---|---|
| **CIERRE_MENSUAL (EV → EV_2 → PER → PER_ID_ETAP_TEMP + VARIABLES)** | **1.419 MB (58,8 %)** | **63 de 74 (85 %)** | 368 + 45 (61 %) |
| BASE_<ETAPA>_<TEMP> ×19 (solo alimentan a EV, no se visualizan) | 304 MB (12,6 %) | 0 | 0 |
| ESC (otra unidad de negocio) | 140 MB (5,8 %) | pocas | bajas |
| BASE_SAP_CONS (+3 anuales) | 129 MB (5,3 %) | **2 de 74** | 6 (0,9 %) |
| RRHH | 120 MB (5,0 %) | ~8 | 13 |
| LocalDateTables automáticas | 78 MB (3,2 %) | — | 0 |
| HIST_EERR + MAPEO + CARGA_PPTO + lookups | ~45 MB | resto | resto |

**Conclusión**: el pbix se sostiene sobre UNA cadena — `BASE_CONS_CIERRE_MENSUAL_PER` y sus derivadas. `BASE_SAP_CONS` es una fuente paralela casi sin uso en el reporte (solo páginas 000–002) y **no alimenta a PER**: son carriles separados. Optimizar la cadena EV→PER resuelve el 85 % del reporte.

**Aclaraciones de alcance**:
- `R_BCC_TOT_TOT_SCLEM` **no es una tabla del pbix**: es una hoja dentro de los Excel EERR (el "resumen por cuartel" que alimenta la hoja BASE). Se usa en este informe solo como evidencia de diseño para `dim_cuartel`.
- Existen 223 referencias de formato condicional a una tabla `BASE_CONS` que ya no existe en el modelo (residuo de copiar/pegar visuales). Power BI las ignora, pero confirman el patrón de plantillas clonadas.

### 1.5 Reglas de negocio desentrañadas del código M

1. **Cierre mensual**: la tabla `MES_ACUM` / `MES_ACUM_ET` marca con un `2` el mes vigente de cada temporada×etapa. `EV` la cruza y calcula `MES_ACTUAL`, `ACUM_ACTUAL`, `RESTO_AÑO_ACTUAL` con cadenas de 24 `if/else` (×4 métricas ×2 monedas ≈ 200 líneas de M). **El cierre se "ejecuta" editando ese flag** en un Excel mantenedor.
2. **Distribución de costos**: los costos SAP no asignables a cuartel se prorratean (columnas `CECO_DISTR`, `% TEMP_DISTR`, `MONTO CLP DISTR.`, reglas `HA-ESP`, `HA-CAM-PROD`, `SAP-DIR`) — esta lógica vive en los Excel MAPEO/EERR, no en el pbix.
3. **Conversión USD**: ocurre aguas arriba, en los Excel EERR (columnas `*_USD` ya vienen calculadas). No hay tabla de tipo de cambio en el modelo.
4. **Llaves**: todo se une por **claves concatenadas de texto** (`ID_FINAL` = TEMPORADA&ETAPA&ID&UBICACIÓN&CAMPO; `ID_ETAPA_EVOL` = 7 campos con guiones). La sola columna `ID_FINAL` de EV_2 pesa **283 MB** (388 K valores distintos).
5. **Gasto real no presupuestado** cae a un `ID NO PRESUPUESTADO` por campo (fila comodín con dimensiones `<>`).

---

## 2. Auditoría de tablas y requerimientos

### 2.1 Problemas estructurales transversales

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| P1 | **Granularidad artificial**: los hechos viajan en formato ancho (24 meses × 2 monedas = 53 columnas de valor) y luego se despivotan DENTRO del modelo | EV → EV_2 (×56), EV → PER (×16) | El mismo dato existe 3–4 veces; 126 M filas que deberían ser < 5 M |
| P2 | **Moneda como filas** (PERIODO = `ACUM_ACTUAL` vs `ACUM_ACTUAL_USD`) en vez de dos columnas de medida | muestra 09 | Duplica filas de PER; obliga al slicer MONEDA |
| P3 | **Temporada como columnas + medidas clonadas** (`24-25 REAL/HA`, `25-26 REAL/HA`…) | PER_ID_ETAP_TEMP: 63 medidas | Cada temporada nueva = crear columnas y ~16 medidas a mano |
| P4 | **Dimensiones incrustadas en los hechos**: atributos de cuartel (17 cols), plan de cuentas (7 cols) y cantidades productivas (12 cols) repetidos en cada fila de gasto | BASE_SAP_CONS 76 cols; EV 110 cols | Infla memoria (83 % del modelo es texto dimensional repetido) e impide consistencia |
| P5 | **Sin relaciones entre hechos**: SAP_CONS, PER, HIST y RRHH son islas; los filtros no se propagan, cada página filtra su propia tabla | 47 relaciones, ninguna entre tablas grandes | No se puede cruzar real SAP vs EERR sin duplicar lógica |
| P6 | **Sin dimensión fecha real**: el período es una etiqueta de texto (`01-ENE`…`24-DIC`) ordenada por tablas ORDEN_*; Auto date/time encendido genera 15 LocalDateTables (≈ 90 MB) | vpax | Sin time-intelligence nativa; sin comparación inter-temporada por fecha calendario |
| P7 | **Cantidades como texto**: 3.832 de 4.999 columnas son Text, incluyendo montos y kg en varias BASE_* | 02_columnas | Errores silenciosos de agregación; peor compresión |

### 2.2 Qué le falta a cada familia de tablas

**BASE_SAP_CONS (hecho transaccional, 798 K filas)**
- Falta: clave de documento estable (Nº doc + posición), tipo de cambio aplicado, separación de las ~30 columnas dimensionales a dimensiones.
- Sobra: columnas de auditoría del export (USUARIO, CLAVE REFERENCIA…) que nadie usa en visuales (solo 9 de 76 columnas aparecen en el reporte).

**BASE_<ETAPA>_<TEMPORADA> ×19 + EV/EV_2/PER (hecho EERR)**
- Falta: columna **fecha** (primer día del mes) derivable de temporada+posición 1–24; monto CLP y USD como **dos columnas**; eliminar filas cero (la muestra REAL trae filas 100 % en cero).
- Sobra: EV_2 completa (existe solo para alimentar 3 tablas "VARIABLES |" de un informe dinámico — se reemplaza con field parameters sobre PER); PER_ID_ETAP_TEMP completa (es PER re-pivoteada; se reemplaza con calculation groups).

**BASE_MAPEO_* ×8 y ORDEN_* ×5 (dimensiones de facto)**
- Falta: consolidarlas en una **dimensión plan-de-cuentas** única versionada por temporada, con el orden como atributo (no como tablas sueltas re-joineadas en cada BASE_*).

**Módulo RRHH (00_*)**
- Falta: dimensión colaborador conformada (hoy FICHA_COLABORADOR y BASE_COLABORADOR coexisten casi idénticas) y relación con la dimensión campo/ubicación para cruzar dotación con costos.

**Ausentes en todo el ecosistema**
- Tabla de **tipo de cambio** (mes × TC) — hoy el USD es una caja negra de Excel.
- **Maestro de cuarteles** (dim huerto) independiente de los EERR.
- Tabla de **parámetros de cierre** (temporada, mes cerrado) — hoy es el flag `2` en MES_ACUM.

---

## 3. Matriz de oportunidades de automatización

| # | Proceso manual actual | Dolor | Solución propuesta | Esfuerzo | Impacto |
|---|---|---|---|---|---|
| A1 | Marcar el mes de cierre editando `MES_ACUM` (flag `2`) y refrescar todo | Refresh completo de 169 M filas por un flag | Tabla `param_cierre` (temporada, mes); los acumulados se calculan en DAX/SQL contra ella | Bajo | Alto |
| A2 | Alta de temporada nueva: crear carpetas, 4+ consultas `BASE_*_26_27`, editar `Table.Combine`, clonar columnas y ~16 medidas | Días de trabajo y errores cada año | Ingesta por **convención de carpeta** (loop sobre `G:\...\TEMPORADA *`) + esquema largo: temporada es un dato, no una estructura | Medio | Alto |
| A3 | Export SAP KSB1 → Excel → pegar en carpeta | Sin trazabilidad ni validación | Script Python de ingesta con validaciones (totales, cuentas sin mapeo, duplicados) y log de carga; el archivo Excel sigue siendo el buzón de entrada | Bajo | Alto |
| A4 | Workbooks EERR de 85–232 MB que calculan distribución de costos y USD con fórmulas | Lentitud, riesgo de fórmula rota, un solo editor a la vez | Mover prorrateo y conversión FX a SQL (reglas DISTRIBUCION + tabla TC); el Excel queda solo como captura de PPTO/PROY | Alto | Muy alto |
| A5 | 63 medidas clonadas por temporada + 88 medidas de variantes (/HA, /CJ, /KG × 4 escenarios) | Mantenimiento explosivo | **Calculation groups** (escenario, unitario, moneda): ~15 medidas base generan todas las combinaciones | Medio | Alto |
| A6 | ~48 páginas-plantilla repetidas + 6 "Duplicado de" + tablas "VARIABLES \|" manuales | Reporte inmantenible, 16,5 MB de layout | **Field parameters** nativos + 1 página por familia (ya existe el patrón en las páginas "DINAMICO") | Medio | Alto |
| A7 | EV_2 (126,7 M filas) recalculada en cada refresh solo para el informe dinámico | Refresh eterno, pbix de 504 MB | Eliminarla; el unpivot deja de existir cuando el hecho nace en formato largo | Bajo (tras A6) | Muy alto |
| A8 | Publicación manual del pbix de 504 MB | Subidas fallidas, sin versionado | Modelo delgado (< 100 MB estimado post-limpieza) o conexión a SQL + refresh programado | — | Medio |

---

## 4. Roadmap de migración a SQL

### 4.1 Contexto de conectividad (actualizado)
La empresa dispone de la arquitectura **SAP HANA → SAP Datasphere → ODBC**, con vistas preparadas por TI consumibles desde herramientas externas. Esto significa que el escenario **REAL puede extraerse por ODBC directamente desde Datasphere** (vía `pyodbc` en Python o conector ODBC en Power BI), eliminando el export manual KSB1→Excel. Los escenarios **PPTO / PROY y las cantidades productivas** seguirán naciendo en Excel del área (arquitectura híbrida): el Excel se conserva como *formulario de entrada*, nunca como motor de cálculo ni almacén.

**Solicitud a TI para habilitar la extracción** (4 ítems): (1) usuario de base de datos del space de Datasphere con acceso SQL habilitado (*Database User*); (2) host, puerto y nombre de las vistas expuestas — como mínimo, líneas de costo equivalentes a KSB1 (ceco, clase de coste, fecha contabilización, monto, moneda, material); (3) confirmación del driver SAP HANA Client (`HDBODBC`); (4) registro de la IP de salida del equipo en la allowlist de Datasphere.

### 4.2 Arquitectura objetivo (star schema)

```
DIMENSIONES                            HECHOS
dim_tiempo (fecha, mes_temp 1-24,      fact_eerr_mensual
            temporada, año calend.)      grano: cuartel × cuenta × mes ×
dim_cuartel (ID, variedad, año_plant,           escenario × temporada
            estado, polinizante,         medidas: monto_clp, monto_usd
            campo, ubicación, especie)  fact_sap_movimiento
dim_cuenta (concepto>item>descripción,    grano: documento SAP línea
            fijo/var, base, órdenes)      medidas: monto_clp, monto_distr, cantidad
dim_escenario (PPTO/REAL/PROY/ANT)     fact_produccion
dim_mapeo_sap (cta contable→dim_cuenta,   grano: cuartel × temporada × escenario
            vigencia por temporada)       medidas: sup_ha, plantas, kg_*, cajas_*
dim_tipo_cambio (mes, tc_clp_usd)      fact_rrhh_* (dotación, ausentismo, rem)
param_cierre (temporada, mes_cerrado)
```

Claves sustitutas enteras en lugar de `ID_FINAL`/`ID_ETAPA_EVOL` concatenados. Los acumulados (`ACUM_ACTUAL`, `RESTO_AÑO`, `TOTAL`) y todos los unitarios (/HA, /CJ, /KG) **dejan de ser columnas**: son medidas DAX (o vistas SQL) sobre el hecho mensual + `param_cierre` + `fact_produccion`. Tamaño estimado del hecho EERR sin filas cero: **3–6 M filas** (vs 141 M actuales entre EV_2+PER+copias).

### 4.3 Fases

**Fase 0 — Quick wins dentro del pbix (1–2 semanas, sin SQL)**
Desactivar Auto date/time (−90 MB); quitar de la carga columnas no usadas de BASE_SAP_CONS y las llaves concatenadas donde no sostienen relaciones; borrar páginas duplicadas; reemplazar PER_ID_ETAP_TEMP por calculation groups. Meta: pbix < 250 MB y refresh a la mitad, sin cambiar ningún número.

**Fase 1 — Staging automatizado con Python (2–4 semanas)**
Ya existe precedente (`replicar_cierre_mensual_per.py` replica PER fuera de Power BI). Dos ramas de ingesta hacia PostgreSQL (esquema `staging`):
- **REAL**: extracción por ODBC desde las vistas de Datasphere (`pyodbc`), incremental por fecha de contabilización, con log de carga.
- **PPTO / PROY / cantidades / RRHH**: ingesta de los Excel de `G:\` por convención de carpeta → validación (totales de control, cuentas sin mapeo, duplicados) → carga.

Un comando (`python cargar.py --temporada 25-26 --etapa REAL`) reemplaza el refresh de las 19 consultas BASE_*. El flujo es **humano-en-el-medio controlado**: el pipeline exporta a Excel solo lo que requiere criterio (excepciones de mapeo, plantilla de proyección, ajustes), y re-ingesta esas plantillas con validación de esquema — nunca se exporta el dato masivo a Excel para "analizarlo" allá.

**Fase 2 — Modelo dimensional en SQL (4–6 semanas)**
Construir dims y hechos con SQL versionado en Git (patrón dbt: staging → intermediate → marts). Migrar aquí la lógica hoy repartida entre M y los Excel EERR: unpivot (trivial en SQL), prorrateo de distribución, conversión USD contra `dim_tipo_cambio`. **Validación en paralelo**: comparar totales SQL vs pbix actual por temporada×etapa×concepto hasta cuadrar al peso.

**Fase 3 — Power BI delgado (2–3 semanas)**
Nuevo pbix conectado a PostgreSQL (Import sobre el star schema): ~10 tablas, ~15 medidas base + calculation groups, field parameters para los informes dinámicos. Reporte objetivo: ≤ 25 páginas. El pbix actual queda congelado como respaldo hasta cerrar una temporada completa en paralelo.

**Fase 4 — Operación (continuo)**
Refresh programado (Task Scheduler ejecuta la carga Python; gateway personal si se publica al Service), log de cargas, alertas de cuentas sin mapeo. Cuando TI disponga de un servidor, la base migra tal cual (PostgreSQL local → servidor es un `pg_dump`).

### 4.4 Viabilidad

| Factor | Evaluación |
|---|---|
| Técnica | **Alta**: orígenes 100 % archivos accesibles; lógica M ya extraída y documentada; script Python precedente que replica la transformación núcleo |
| Riesgo principal | Los Excel EERR encapsulan prorrateo y FX sin documentar → Fase 2 exige validación paralela contra el pbix actual |
| Dependencias | Ninguna externa para Fases 0–3 (PostgreSQL/Express locales, gratis). Publicar con refresh automático al Service requiere gateway |
| Retorno esperado | Modelo de 2,4 GB → < 200 MB; refresh de horas → minutos incrementales; alta de temporada de días → 1 comando; mantenimiento de medidas ÷ 10 |

---

## 5. Anexos disponibles
- `05_particiones_codigo_m.csv` / código M completo por tabla (extraído a texto)
- `03_medidas.csv` — las 286 medidas con su DAX
- `07_modelo.vpax` — métricas VertiPaq por columna
- Linaje detallado y tamaños: sección 1.2 y 1.3 de este informe
