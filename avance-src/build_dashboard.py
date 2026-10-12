#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_dashboard.py — Generador del Dashboard de Avance GB (Grupo Benber)
=========================================================================

QUÉ HACE
--------
Lee tu tabla plana (una fila por tienda por día, exportada desde tu tabla
dinámica / Power Pivot) y genera UN SOLO archivo HTML autocontenido
(dashboard.html) con todo embebido: los datos (como JSON compacto y
codificado por diccionario), el logo, GBsaurio y los logos de cadena.
Ese HTML lo subes a donde quieras compartirlo (GitHub Pages, SharePoint,
etc.) y cualquiera lo abre en el navegador — sin backend, sin límites de
cuota, sin que dependa de que tu Excel esté abierto.

USO
---
    python build_dashboard.py "Layout_Avance_GB.xlsx" --sheet Hoja1

Parámetros:
    archivo           Ruta al .xlsx/.xlsm/.csv con la tabla plana (posicional, requerido)
    --sheet NOMBRE     Nombre de la hoja si es un Excel con varias hojas (default: la primera)
    --out RUTA         Nombre del HTML de salida (default: dashboard.html)
    --titulo TEXTO      Título de la página (default: "GrupoBenber")

REQUISITOS DE LA TABLA PLANA
-----------------------------
Una fila por TIENDA por DÍA. Columnas esperadas (nombres exactos de tu
tabla dinámica) — ver COLUMN_MAP más abajo para el detalle completo.
Si falta una columna opcional, el script avisa y sigue (esa métrica sale
en 0). Si falta una columna obligatoria (Fecha, IDPDV, Nombre PDV), se
detiene y te dice cuál falta.

POR QUÉ LA TABLA SOLO TRAE DATOS "CRUDOS"
------------------------------------------
Por diseño, esta tabla NO debe traer columnas de "%", "Gap" ni nada ya
calculado — eso lo calcula el HTML en el navegador, a partir de las
cantidades base (Altas, Cuota, Registros, Checks, etc.). Esto evita el
error más común en estos reportes: promediar porcentajes ya calculados en
vez de recalcularlos desde la suma de sus componentes. Aquí SIEMPRE se
recalcula: % = suma(numerador) / suma(denominador), nunca se promedian
columnas de "%" fila por fila.

La única excepción real son las columnas de Piso Semanal — SÍ se
recalculan aquí (ver PISO_BASE / fórmula más abajo), reconstruida con la
regla de negocio exacta que definiste (piso base por POSC y cadena, más
incremento por checks extra en la semana, con Pospago valiendo doble).
Por eso "Piso Actual" y "Gap Piso Semanal" YA NO son necesarias en el
export — el HTML las calcula solas, de forma transparente y auditable.

QUÉ SE DESCARTA A PROPÓSITO (y por qué)
-----------------------------------------
Estas columnas, si vienen en tu archivo, se IGNORAN porque son 100%
redundantes o se recalculan mejor en el navegador:
  - Cualquier "% ..." o "Gap ..." ya calculado           -> se recalcula
  - Prom Promotor                                         -> = Checks Cumple Totales
  - Dimens Promotor                                        -> = POSC * 6/7
  - Dimens Pdv                                             -> = f(Total Posc)
  - Tope Checks                                            -> = 9 * POSC
  - Piso Actual / Gap Piso Semanal                         -> se recalculan (ver arriba)
  - Total Posc / Total Pdv's                               -> redundantes con POSC (1 fila = 1 tienda)
No pasa nada si las dejas en tu tabla — el script simplemente no las lee.
"""

import argparse
import json
import os
import sys
from datetime import datetime, date, time

try:
    import openpyxl
except ImportError:
    print("Falta la librería openpyxl. Instala con: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

try:
    from brand_assets import BRAND_ASSETS
except ImportError:
    print("ERROR: no se encontró brand_assets.py en la misma carpeta que este script.", file=sys.stderr)
    print("       Ese archivo trae el logo, GBsaurio y los logos de cadena embebidos.", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Mapeo de columnas: clave interna -> nombre EXACTO de columna en tu tabla
# ---------------------------------------------------------------------------

REQUIRED = ["fecha", "idpdv", "nombre_pdv"]

# Dimensiones (categóricas, una por tienda — se toman del primer renglón de
# esa tienda que se encuentre, no deberían variar día a día)
DIMENSIONS = {
    "region": "REGION",
    "subdireccion": "SUBDIRECCION GB",
    "gerente_lider": "GERENTE / LIDER",
    "lider": "LIDER",
    "supervisor": "SUPERVISOR",
    "sub_terr": "SUB_TERR",
    "plaza": "PLAZA",
    "cadena": "CADENA",
    "clasificacion": "CLASS",
    "tipo_ekt": "TIPO EKT",
}

# Estático numérico por tienda
STORE_STATIC = {
    "posc": "POSC",
}
# Pago fijo por check de la tienda (Regular/Vida Cara/Frontera): lo usa Piso Semanal para sugerir líneas
STORE_STATIC_NUM = {
    "unitario": "Pago Unitario",
}

COLUMN_MAP = {
    "fecha": "Fecha",
    "idpdv": "IDPDV",
    "nombre_pdv": "NOMBRE PDV",
    "semana": "Semana Año",

    "cuota_t": "Cuota Total GB",
    "cuota_temm": "Cuota Temm GB",
    "cuota_porta": "Cuota Porta GB",
    "cuota_pospago": "Cuota Pospago GB",

    "altas_t": "Altas Reg Totales",
    "altas_temm": "Altas Reg Temm",
    "altas_porta": "Altas Reg Portabilidad",
    "altas_pospago": "Altas Reg Pospago",

    "reg_t": "Registros Totales",
    "reg_temm": "Registros Temm",
    "reg_porta": "Registros Porta",
    "reg_pospago": "Registros Pospago",

    "nonat_t": "Total No Natural",
    "nonat_temm": "Temm No Natural",
    "nonat_porta": "Porta No Natural",
    "impulso": "Impulso Total",

    "altas_ly_t": "Altas Total Interanual",
    "altas_ly_temm": "Altas Temm Interanual",
    "altas_ly_porta": "Altas Porta Interanual",

    "altas_lm_t": "Altas Total Intermensual",
    "altas_lm_temm": "Altas Temm Intermensual",
    "altas_lm_porta": "Altas Porta Intermensual",

    "checks": "Checks Cumple Totales",
    "cuota_checks": "Cuota Checks Al Día",
    "cobertura": "Prom Cobertura",

    "visitas_sup": "Visitas Supervisor",
    "tiempo_visita_sup": "Prom Tiempo Visita Sup",
    "pdvs_visitados_sup": "Pdv's Visitados Sup",

    # Estatus "Arranque rápido": promotores (nuevo ingreso o reingreso) con menos de 2 semanas que
    # checaron en la tienda ese día, y el día de arranque (1..14) del más nuevo; 0 = ninguno.
    "nuevos_ing": "Nuevos Ingreso",
    "dia_arranque": "Dia Arranque",

    # Ronda 18: hora de entrada/salida del supervisor en cada check -- se leen como hora de reloj
    # y se guardan en SEGUNDOS DESDE MEDIANOCHE (ver to_time_seconds), no como fracción/otro tipo,
    # para que el HTML pueda sumarlas y promediarlas igual que cualquier otra métrica cruda.
    "checkin_sup_sec": "CheckIn Promedio Sup",
    "checkout_sup_sec": "CheckOut Promedio Sup",
}

# Columnas de COLUMN_MAP que son HORA DE RELOJ (no cantidad) -- usan to_time_seconds en vez de
# to_num al construir el dataset.
TIME_METRICS = {"checkin_sup_sec", "checkout_sup_sec"}

# Todas las métricas numéricas de fila (además de fecha/semana/dimensiones)
ROW_METRICS = [k for k in COLUMN_MAP if k not in ("fecha", "idpdv", "nombre_pdv", "semana")]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def to_num(v):
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0.0


def to_time_seconds(v):
    """Convierte un valor de hora (datetime.time, datetime.datetime, serial de Excel como
    fracción de día, o texto 'HH:MM[:SS]') a segundos desde medianoche (entero, 0-86399).
    None/vacío -> 0 -- mismo criterio de "faltante = 0" que to_num(), y además coincide con
    cómo ya viene tu tabla real: los días sin visita del supervisor ya traen 00:00:00, no
    una celda vacía, así que 0 es el valor correcto para "sin dato" en ambos casos."""
    if v is None or v == "":
        return 0
    if isinstance(v, datetime):
        return v.hour * 3600 + v.minute * 60 + v.second
    if isinstance(v, time):
        return v.hour * 3600 + v.minute * 60 + v.second
    if isinstance(v, (int, float)):
        # Serial de Excel: la parte fraccionaria del número es la hora del día.
        return int(round((v % 1) * 86400))
    s = str(v).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            t = datetime.strptime(s, fmt).time()
            return t.hour * 3600 + t.minute * 60 + t.second
        except ValueError:
            continue
    return 0


def to_date_str(v):
    """Normaliza un valor de fecha (datetime, date, serial de Excel, texto) a 'YYYY-MM-DD'."""
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)):
        # Serial de Excel (base 1899-12-30)
        try:
            base = date(1899, 12, 30)
            from datetime import timedelta
            return (base + timedelta(days=int(v))).isoformat()
        except Exception:
            return None
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def load_rows(path, sheet=None):
    """Lee el archivo (xlsx/xlsm/csv) y regresa (headers, filas_como_dicts)."""
    if path.lower().endswith((".csv",)):
        import csv
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            headers = reader.fieldnames or []
        return headers, rows

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet] if sheet else wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    headers = next(it)
    headers = [h.strip() if isinstance(h, str) else h for h in headers]
    rows = []
    for r in it:
        if all(v is None for v in r):
            continue
        rows.append(dict(zip(headers, r)))
    return headers, rows


def check_columns(headers):
    headers_set = set(h for h in headers if h)
    missing_required = []
    for key in REQUIRED:
        col = COLUMN_MAP[key]
        if col not in headers_set:
            missing_required.append(col)
    if missing_required:
        print("ERROR: faltan columnas obligatorias en tu archivo:", file=sys.stderr)
        for c in missing_required:
            print(f"   - {c}", file=sys.stderr)
        sys.exit(1)

    missing_optional = []
    all_optional = {**COLUMN_MAP, **DIMENSIONS, **STORE_STATIC}
    for key, col in all_optional.items():
        if key in REQUIRED:
            continue
        if col not in headers_set:
            missing_optional.append(col)
    if missing_optional:
        print("Aviso: no se encontraron estas columnas opcionales (esa métrica saldrá en 0/vacío):")
        for c in sorted(set(missing_optional)):
            print(f"   - {c}")
        print()


# ---------------------------------------------------------------------------
# Construcción del dataset compacto (dict-encoded)
# ---------------------------------------------------------------------------

def build_dataset(rows):
    dict_pools = {dim: [] for dim in DIMENSIONS}
    dict_index = {dim: {} for dim in DIMENSIONS}

    def dict_idx(dim, value):
        value = value if value not in (None, "") else "(Sin dato)"
        value = str(value).strip()
        if value not in dict_index[dim]:
            dict_index[dim][value] = len(dict_pools[dim])
            dict_pools[dim].append(value)
        return dict_index[dim][value]

    store_index = {}          # idpdv -> posición en STORES
    store_idpdv = []
    store_nombre = []
    store_posc = []
    store_unitario = []
    store_dim_idx = {dim: [] for dim in DIMENSIONS}

    fecha_index = {}
    fecha_list = []
    semana_index = {}
    semana_list = []

    row_store = []
    row_fecha = []
    row_semana = []
    row_metric = {k: [] for k in ROW_METRICS}

    skipped_sin_fecha = 0

    for r in rows:
        idpdv_raw = r.get(COLUMN_MAP["idpdv"])
        if idpdv_raw is None or idpdv_raw == "":
            continue
        idpdv = str(idpdv_raw).strip()

        fecha_str = to_date_str(r.get(COLUMN_MAP["fecha"]))
        if fecha_str is None:
            skipped_sin_fecha += 1
            continue

        if idpdv not in store_index:
            store_index[idpdv] = len(store_idpdv)
            store_idpdv.append(idpdv)
            store_nombre.append(str(r.get(COLUMN_MAP["nombre_pdv"]) or "").strip())
            store_posc.append(int(to_num(r.get(STORE_STATIC["posc"], 1)) or 1))
            store_unitario.append(to_num(r.get(STORE_STATIC_NUM["unitario"])) or 541.0)
            for dim, col in DIMENSIONS.items():
                store_dim_idx[dim].append(dict_idx(dim, r.get(col)))
        s_i = store_index[idpdv]

        if fecha_str not in fecha_index:
            fecha_index[fecha_str] = len(fecha_list)
            fecha_list.append(fecha_str)
        f_i = fecha_index[fecha_str]

        semana_val = str(r.get(COLUMN_MAP.get("semana", ""), "") or "").strip() or "(Sin semana)"
        if semana_val not in semana_index:
            semana_index[semana_val] = len(semana_list)
            semana_list.append(semana_val)
        w_i = semana_index[semana_val]

        row_store.append(s_i)
        row_fecha.append(f_i)
        row_semana.append(w_i)
        for k in ROW_METRICS:
            col = COLUMN_MAP[k]
            if k in TIME_METRICS:
                row_metric[k].append(to_time_seconds(r.get(col)))
            else:
                row_metric[k].append(round(to_num(r.get(col)), 4))

    if skipped_sin_fecha:
        print(f"Aviso: se omitieron {skipped_sin_fecha} filas sin fecha reconocible.")

    # Ordenar fechas y semanas cronológicamente, remapeando índices
    fecha_order = sorted(range(len(fecha_list)), key=lambda i: fecha_list[i])
    fecha_remap = {old: new for new, old in enumerate(fecha_order)}
    fecha_list_sorted = [fecha_list[i] for i in fecha_order]
    row_fecha = [fecha_remap[i] for i in row_fecha]

    def semana_sort_key(s):
        # "26-S31" -> (26, 31); si no calza el patrón, va al final
        try:
            a, b = s.split("-S")
            return (int(a), int(b))
        except Exception:
            return (9999, 9999)

    semana_order = sorted(range(len(semana_list)), key=lambda i: semana_sort_key(semana_list[i]))
    semana_remap = {old: new for new, old in enumerate(semana_order)}
    semana_list_sorted = [semana_list[i] for i in semana_order]
    row_semana = [semana_remap[i] for i in row_semana]

    dataset = {
        "dicts": dict_pools,
        "stores": {
            "idpdv": store_idpdv,
            "nombre": store_nombre,
            "posc": store_posc,
            "unitario": store_unitario,
            **store_dim_idx,
        },
        "fechas": fecha_list_sorted,
        "semanas": semana_list_sorted,
        "rows": {
            "store": row_store,
            "fecha": row_fecha,
            "semana": row_semana,
            **row_metric,
        },
        "meta": {
            "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "n_filas": len(row_store),
            "n_tiendas": len(store_idpdv),
            "n_dias": len(fecha_list_sorted),
        },
    }
    return dataset


# ---------------------------------------------------------------------------
# Histórico (semanal/mensual) -- dataset compacto, dict-encoded, separado del
# detalle diario. Cada fila = 1 tienda x 1 periodo (semana "YY-SNN" o mes
# "YYYY-MM"); 'dias' = cuántos días reales componen ese periodo (necesario
# porque aquí 1 fila YA NO equivale a 1 día -- ver generador_historico.py).
# ---------------------------------------------------------------------------

HIST_DIMS_CAT = ["REGION", "SUBDIRECCION GB", "GERENTE / LIDER", "LIDER",
                  "SUPERVISOR", "SUB_TERR", "CADENA", "CLASS", "TIPO EKT"]

HIST_METRICS = {
    "cuota_t": "Cuota Total GB", "cuota_temm": "Cuota Temm GB",
    "cuota_porta": "Cuota Porta GB", "cuota_pospago": "Cuota Pospago GB",
    "altas_t": "Altas Reg Totales", "altas_temm": "Altas Reg Temm",
    "altas_porta": "Altas Reg Portabilidad", "altas_pospago": "Altas Reg Pospago",
    "reg_t": "Registros Totales", "reg_temm": "Registros Temm",
    "reg_porta": "Registros Porta", "reg_pospago": "Registros Pospago",
    "checks": "Checks Cumple Totales", "cuota_checks": "Cuota Checks Al Día",
    "cobertura_dias": "Prom Cobertura",
    "visitas_sup": "Visitas Supervisor", "pdvs_visitados_sup": "Pdv's Visitados Sup",
    "tiempo_visita_sup": "Prom Tiempo Visita Sup",
}


def build_historico_dataset(path):
    if not path:
        return None
    headers, rows = load_rows(path, None)
    if not rows:
        return None

    dicts, cols = {}, {}
    for k in HIST_DIMS_CAT:
        vals = sorted(set(str(r.get(k) or "") for r in rows))
        idx = {v: i for i, v in enumerate(vals)}
        dicts[k] = vals
        cols[k] = [idx[str(r.get(k) or "")] for r in rows]

    periodos = sorted(set(str(r.get("Periodo") or "") for r in rows))
    pidx = {p: i for i, p in enumerate(periodos)}

    out = {
        "periodos": periodos,
        "dicts": dicts,
        "rows": {
            "idpdv": [int(to_num(r.get("IDPDV"))) for r in rows],
            "nombre": [str(r.get("NOMBRE PDV") or "") for r in rows],
            "posc": [int(to_num(r.get("POSC"))) for r in rows],
            "periodo": [pidx[str(r.get("Periodo") or "")] for r in rows],
            "dias": [int(to_num(r.get("Dias En Periodo"))) for r in rows],
            **{k: [to_num(r.get(col)) for r in rows] for k, col in HIST_METRICS.items()},
            **cols,
        },
    }
    return out


# ---------------------------------------------------------------------------
# Render final
# ---------------------------------------------------------------------------

def render_html(dataset, template_path, out_path, titulo, hist_semanal=None, hist_mensual=None):
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    data_json = json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
    assets_json = json.dumps(BRAND_ASSETS, ensure_ascii=False, separators=(",", ":"))
    hist_json = json.dumps({"semanal": hist_semanal, "mensual": hist_mensual}, ensure_ascii=False, separators=(",", ":"))

    # Inventario / Sell Out (lo genera MotorPython/generador_inventario.py); si no existe, esas secciones quedan vacias.
    inv_path = os.path.join(os.getcwd(), "inventario_generado.json")  # datos: carpeta desde donde se corre (AvanceGB_Herramienta)
    inv_json = "null"
    if os.path.exists(inv_path):
        with open(inv_path, "r", encoding="utf-8") as f:
            inv_json = f.read().replace("</", "<\\/")

    # Módulos JS (Inventario, Sell Out, Diagnóstico): AvanceGB_Herramienta/modulos/*.js, en orden alfabético.
    mod_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modulos")
    mods = ""
    if os.path.isdir(mod_dir):
        for nombre in sorted(os.listdir(mod_dir)):
            if nombre.endswith(".js") and not nombre.startswith("_"):
                with open(os.path.join(mod_dir, nombre), "r", encoding="utf-8") as f:
                    mods += f.read() + "\n"
    html = html.replace("/*__MODULOS_INV_DIAG__*/", mods)
    html = html.replace("__DATA_JSON__", data_json)
    # Promotores: bloque comprimido (lo genera CalculoBase/exportar_promotores.py); sin archivo, las secciones de promotores no aparecen.
    prm_path = os.path.join(os.getcwd(), "promotores_datos.json")  # datos: carpeta desde donde se corre (AvanceGB_Herramienta)
    prm_json = "null"
    if os.path.exists(prm_path):
        with open(prm_path, "r", encoding="utf-8") as f:
            prm_json = f.read().strip()
    html = html.replace("__PROMOTORES_ENC__", prm_json)
    html = html.replace("__INVENTARIO_JSON__", inv_json)
    # Coordenadas de tiendas para las rutas (generador_coordenadas.py); sin archivo, las rutas se arman solo por plaza.
    coord_path = os.path.join(os.getcwd(), "coordenadas_generado.json")  # datos: carpeta desde donde se corre (AvanceGB_Herramienta)
    coord_json = "null"
    if os.path.exists(coord_path):
        with open(coord_path, "r", encoding="utf-8") as f:
            coord_json = f.read().replace("</", "<\\/")
    html = html.replace("__COORDENADAS_JSON__", coord_json)
    html = html.replace("__ASSETS_JSON__", assets_json)
    html = html.replace("__HISTORICO_JSON__", hist_json)
    html = html.replace("__TITULO__", titulo)
    html = html.replace("__GENERADO__", dataset["meta"]["generado"])

    # Librería html2canvas (MIT) embebida para el botón "Imagen" de las tablas -- igual que Chart.js,
    # va dentro del HTML para no depender de internet. Si falta el archivo, el botón avisa que no está.
    h2c_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor", "html2canvas.min.js")
    h2c = ""
    if os.path.exists(h2c_path):
        with open(h2c_path, "r", encoding="utf-8") as f:
            h2c = f.read().replace("</script", "<\\/script")
    else:
        print("Aviso: falta vendor/html2canvas.min.js -- el botón de captura de tablas no funcionará.", file=sys.stderr)
    html = html.replace("/*__HTML2CANVAS__*/", h2c)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    size_kb = len(html.encode("utf-8")) / 1024
    print(f"\nListo: {out_path}  ({size_kb:,.0f} KB)")
    print(f"  Tiendas: {dataset['meta']['n_tiendas']}   Días: {dataset['meta']['n_dias']}   Filas: {dataset['meta']['n_filas']}")
    if hist_semanal:
        print(f"  Histórico semanal: {len(hist_semanal['rows']['idpdv']):,} filas, {len(hist_semanal['periodos'])} periodos")
    if hist_mensual:
        print(f"  Histórico mensual: {len(hist_mensual['rows']['idpdv']):,} filas, {len(hist_mensual['periodos'])} periodos")


def main():
    ap = argparse.ArgumentParser(description="Genera el Dashboard de Avance GB (HTML autocontenido).")
    ap.add_argument("archivo", help="Ruta al .xlsx/.xlsm/.csv con la tabla plana (una fila por tienda por día)")
    ap.add_argument("--sheet", default=None, help="Nombre de la hoja (si no, se usa la primera)")
    ap.add_argument("--out", default="dashboard.html", help="Nombre del HTML de salida")
    ap.add_argument("--titulo", default="GrupoBenber", help="Título de la página")
    ap.add_argument("--template", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard_template.html"), help="Ruta a la plantilla HTML (default: avance-src/)")
    ap.add_argument("--region", default=None,
                     help="Si se da, genera el dashboard SOLO con las tiendas de esta región "
                          "(ej. NORTE, SUR, CENTRO, OCCIDENTE) -- para publicar un HTML por región, "
                          "con los datos de las demás regiones fuera del archivo (no solo ocultos).")
    ap.add_argument("--historico-semanal", default=None,
                     help="CSV con el histórico semanal (1 fila = 1 tienda x semana) para los meses "
                          "anteriores a la ventana de detalle diario -- ver generador_historico.py.")
    ap.add_argument("--historico-mensual", default=None,
                     help="CSV con el histórico mensual (1 fila = 1 tienda x mes), mismo origen que --historico-semanal.")
    args = ap.parse_args()

    print(f"Leyendo {args.archivo} ...")
    headers, rows = load_rows(args.archivo, args.sheet)
    check_columns(headers)

    if args.region:
        region_col = DIMENSIONS["region"]
        antes = len(rows)
        objetivo = args.region.strip().upper()
        rows = [r for r in rows if str(r.get(region_col, "") or "").strip().upper() == objetivo]
        print(f"Filtrado por región '{args.region}': {len(rows)} de {antes} filas.")
        if not rows:
            print(f"ERROR: no se encontraron filas para la región '{args.region}'.", file=sys.stderr)
            sys.exit(1)

    print(f"Procesando {len(rows)} filas ...")
    dataset = build_dataset(rows)

    hist_semanal = build_historico_dataset(args.historico_semanal)
    hist_mensual = build_historico_dataset(args.historico_mensual)

    render_html(dataset, args.template, args.out, args.titulo, hist_semanal, hist_mensual)


if __name__ == "__main__":
    main()
