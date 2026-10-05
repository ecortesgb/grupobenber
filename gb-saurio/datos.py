"""Datos de GB Saurio: configuración, pendientes y notas (SQLite local).

Todo vive en %USERPROFILE%\\GbSaurio\\ para no mezclarlo con el repositorio.
"""
import json
import os
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path

CARPETA_APP = Path(__file__).resolve().parent
CARPETA_DATOS = Path.home() / "GbSaurio"
CARPETA_DATOS.mkdir(parents=True, exist_ok=True)
(CARPETA_DATOS / "planes").mkdir(exist_ok=True)
(CARPETA_DATOS / "reuniones").mkdir(exist_ok=True)

CONFIG_DEFECTO = {
    "proveedor": "claude",          # "claude" (API de Anthropic, de paga) u "ollama" (gratis, en tu laptop)
    "api_key": "",
    "modelo": "claude-opus-5-5",
    "ollama_url": "http://localhost:11434",
    "ollama_modelo": "qwen3:8b",
    "esfuerzo": "medium",
    "carpetas_permitidas": ["ESCRITORIO", "DOCUMENTOS", "DESCARGAS"],
    "modelo_transcripcion": "small",
    "recordatorio_minutos": 60,
    "conservar_audio": False,
}


def cargar_config():
    cfg = dict(CONFIG_DEFECTO)
    ruta = CARPETA_APP / "config.json"
    if ruta.exists():
        cfg.update(json.loads(ruta.read_text(encoding="utf-8-sig")))
    if not cfg.get("api_key"):
        cfg["api_key"] = os.environ.get("ANTHROPIC_API_KEY", "")
    return cfg


def usa_ollama(cfg):
    return cfg.get("proveedor", "claude").lower() == "ollama"


def ia_lista(cfg):
    """Ollama no necesita llave; Claude sí."""
    return usa_ollama(cfg) or bool(cfg["api_key"])


# ---------- Carpetas especiales de Windows (resuelve OneDrive\Escritorio, etc.) ----------
_CLAVES_SHELL = {
    "ESCRITORIO": "Desktop",
    "DOCUMENTOS": "Personal",
    "DESCARGAS": "{374DE290-123F-4565-9164-39C4925E467B}",
}
_RESPALDO = {"ESCRITORIO": "Desktop", "DOCUMENTOS": "Documents", "DESCARGAS": "Downloads"}


def carpeta_especial(alias):
    alias = alias.upper()
    if sys.platform == "win32":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders") as k:
                valor, _ = winreg.QueryValueEx(k, _CLAVES_SHELL[alias])
                return Path(os.path.expandvars(valor))
        except OSError:
            pass
    return Path.home() / _RESPALDO[alias]


def raices_permitidas(cfg):
    raices = []
    for c in cfg["carpetas_permitidas"]:
        p = carpeta_especial(c) if c.upper() in _CLAVES_SHELL else Path(os.path.expandvars(os.path.expanduser(c)))
        if p.exists():
            raices.append(p.resolve())
    return raices


# ---------- Base de datos ----------
def conexion():
    con = sqlite3.connect(CARPETA_DATOS / "saurio.db")
    con.row_factory = sqlite3.Row
    con.executescript("""
        CREATE TABLE IF NOT EXISTS pendientes(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            detalle TEXT DEFAULT '',
            fecha_compromiso TEXT,
            prioridad TEXT DEFAULT 'Media',
            estado TEXT DEFAULT 'Abierto',
            origen TEXT DEFAULT 'chat',
            creado TEXT,
            completado TEXT);
        CREATE TABLE IF NOT EXISTS notas(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            contenido TEXT NOT NULL,
            tipo TEXT DEFAULT 'nota',
            creado TEXT);
    """)
    return con


def ahora():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def agregar_pendiente(titulo, fecha_compromiso=None, prioridad="Media", detalle="", origen="chat"):
    with conexion() as con:
        cur = con.execute(
            "INSERT INTO pendientes(titulo,detalle,fecha_compromiso,prioridad,origen,creado) VALUES(?,?,?,?,?,?)",
            (titulo, detalle or "", fecha_compromiso, prioridad or "Media", origen, ahora()))
        return cur.lastrowid


def listar_pendientes(estado="Abierto"):
    with conexion() as con:
        sql = "SELECT * FROM pendientes"
        args = ()
        if estado and estado != "Todos":
            sql += " WHERE estado=?"
            args = (estado,)
        sql += " ORDER BY COALESCE(fecha_compromiso,'9999-12-31'), CASE prioridad WHEN 'Alta' THEN 0 WHEN 'Media' THEN 1 ELSE 2 END"
        filas = [dict(r) for r in con.execute(sql, args)]
    hoy = date.today().isoformat()
    for f in filas:
        f["vencido"] = bool(f["estado"] == "Abierto" and f["fecha_compromiso"] and f["fecha_compromiso"] < hoy)
    return filas


def actualizar_pendiente(id, **campos):
    permitidos = {k: v for k, v in campos.items() if k in ("titulo", "detalle", "fecha_compromiso", "prioridad", "estado") and v is not None}
    if not permitidos:
        return False
    if permitidos.get("estado") == "Hecho":
        permitidos["completado"] = ahora()
    sets = ", ".join(f"{k}=?" for k in permitidos)
    with conexion() as con:
        cur = con.execute(f"UPDATE pendientes SET {sets} WHERE id=?", (*permitidos.values(), id))
        return cur.rowcount > 0


def pendientes_por_atender():
    """Abiertos que vencen hoy o ya vencieron."""
    hoy = date.today().isoformat()
    return [p for p in listar_pendientes() if p["fecha_compromiso"] and p["fecha_compromiso"] <= hoy]


def guardar_nota(titulo, contenido, tipo="nota"):
    with conexion() as con:
        cur = con.execute("INSERT INTO notas(titulo,contenido,tipo,creado) VALUES(?,?,?,?)",
                          (titulo, contenido, tipo, ahora()))
        return cur.lastrowid


def buscar_notas(texto="", limite=10):
    with conexion() as con:
        filas = con.execute(
            "SELECT * FROM notas WHERE titulo LIKE ? OR contenido LIKE ? ORDER BY id DESC LIMIT ?",
            (f"%{texto}%", f"%{texto}%", limite))
        return [dict(r) for r in filas]


def exportar_pendientes_excel():
    """Genera un Excel con todos los pendientes para reportar a Dirección."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.worksheet.table import Table, TableStyleInfo

    filas = listar_pendientes("Todos")
    wb = Workbook()
    ws = wb.active
    ws.title = "Pendientes"
    enc = ["ID", "Pendiente", "Detalle", "Fecha compromiso", "Prioridad", "Estado",
           "Origen", "Creado", "Completado", "Días de atraso"]
    ws.append(enc)
    hoy = date.today()
    rojo = PatternFill("solid", fgColor="F8D7DA")
    for f in filas:
        atraso = None
        if f["estado"] == "Abierto" and f["fecha_compromiso"]:
            atraso = max((hoy - date.fromisoformat(f["fecha_compromiso"])).days, 0)
        ws.append([f["id"], f["titulo"], f["detalle"],
                   date.fromisoformat(f["fecha_compromiso"]) if f["fecha_compromiso"] else None,
                   f["prioridad"], f["estado"], f["origen"], f["creado"], f["completado"], atraso])
        if atraso:
            for c in ws[ws.max_row]:
                c.fill = rojo
    for celda in ws["D"][1:]:
        celda.number_format = "dd/mm/yyyy"
    anchos = [6, 45, 40, 16, 10, 10, 10, 17, 17, 14]
    for i, w in enumerate(anchos):
        ws.column_dimensions[chr(65 + i)].width = w
    if filas:
        tabla = Table(displayName="tPendientes", ref=f"A1:J{len(filas) + 1}")
        tabla.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
        ws.add_table(tabla)
    else:
        for c in ws[1]:
            c.font = Font(bold=True)
    ws.freeze_panes = "A2"

    # Hoja resumen para el reporte
    r = wb.create_sheet("Resumen")
    abiertos = [f for f in filas if f["estado"] == "Abierto"]
    hechos = [f for f in filas if f["estado"] == "Hecho"]
    a_tiempo = [f for f in hechos if f["fecha_compromiso"] and f["completado"] and f["completado"][:10] <= f["fecha_compromiso"]]
    con_fecha = [f for f in hechos if f["fecha_compromiso"]]
    r.append(["Indicador", "Valor"])
    r.append(["Pendientes abiertos", len(abiertos)])
    r.append(["Vencidos", sum(1 for f in abiertos if f["vencido"])])
    r.append(["Cerrados", len(hechos)])
    r.append(["% cumplimiento en fecha", (len(a_tiempo) / len(con_fecha)) if con_fecha else None])
    r["B5"].number_format = "0%"
    for c in r[1]:
        c.font = Font(bold=True)
    r.column_dimensions["A"].width = 28

    destino = CARPETA_DATOS / f"Pendientes_{hoy:%Y%m%d}.xlsx"
    wb.save(destino)
    return destino
