"""Análisis y organización de archivos.

Regla de oro: la IA solo LEE y PROPONE. Los archivos se mueven únicamente cuando
Elías presiona "Aplicar" en la ventana, y cada plan aplicado se puede deshacer.
"""
import json
import shutil
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from datos import CARPETA_DATOS, carpeta_especial, raices_permitidas

EXT_TEXTO = {".txt", ".csv", ".md", ".json", ".m", ".pq", ".dax", ".sql", ".py", ".bas",
             ".vba", ".cls", ".bat", ".ps1", ".xml", ".html", ".js", ".css", ".log", ".ini"}
CATEGORIAS = {
    "Excel": {".xlsx", ".xlsm", ".xlsb", ".xls", ".csv"},
    "Power BI": {".pbix", ".pbit"},
    "PDF": {".pdf"},
    "Word": {".docx", ".doc"},
    "PowerPoint": {".pptx", ".ppt"},
    "Imágenes": {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".heic"},
    "Comprimidos": {".zip", ".rar", ".7z"},
    "Instaladores": {".exe", ".msi"},
    "Accesos directos": {".lnk", ".url"},
    "Código": {".py", ".m", ".pq", ".dax", ".sql", ".bas", ".vba", ".bat", ".ps1"},
}

_plan_actual = None  # plan propuesto que espera clic de Elías


class RutaNoPermitida(Exception):
    pass


def resolver(cfg, ruta):
    """Convierte alias ('escritorio') o ruta en Path y valida que esté en carpetas permitidas."""
    if ruta.strip().upper() in ("ESCRITORIO", "DOCUMENTOS", "DESCARGAS"):
        p = carpeta_especial(ruta.strip())
    else:
        p = Path(ruta).expanduser()
    p = p.resolve()
    for raiz in raices_permitidas(cfg):
        if p == raiz or p.is_relative_to(raiz):
            return p, raiz
    raise RutaNoPermitida(f"'{ruta}' está fuera de las carpetas permitidas: "
                          + ", ".join(str(r) for r in raices_permitidas(cfg)))


def categoria(ext):
    for nombre, exts in CATEGORIAS.items():
        if ext in exts:
            return nombre
    return "Otros"


def _mb(b):
    return round(b / 1_048_576, 1)


def analizar_carpeta(cfg, carpeta):
    base, _ = resolver(cfg, carpeta)
    hoy = datetime.now()
    archivos, subcarpetas = [], []
    for e in base.iterdir():
        try:
            if e.is_dir():
                subcarpetas.append(e.name)
            elif e.is_file():
                st = e.stat()
                archivos.append((e, st.st_size, datetime.fromtimestamp(st.st_mtime)))
        except OSError:
            continue
    por_cat = Counter(categoria(a.suffix.lower()) for a, _, _ in archivos)
    viejos = [a for a in archivos if (hoy - a[2]).days > 90]
    grandes = sorted(archivos, key=lambda x: -x[1])[:10]
    dup = defaultdict(list)
    for a, s, _ in archivos:
        clave = (a.stem.lower().replace(" (1)", "").replace(" - copia", "").replace("(2)", "").strip(), s)
        dup[clave].append(a.name)
    duplicados = [v for v in dup.values() if len(v) > 1]
    return {
        "carpeta": str(base),
        "total_archivos": len(archivos),
        "total_subcarpetas": len(subcarpetas),
        "tamano_total_mb": _mb(sum(s for _, s, _ in archivos)),
        "por_tipo": dict(por_cat.most_common()),
        "sin_tocar_90_dias": len(viejos),
        "mas_grandes": [{"archivo": a.name, "mb": _mb(s)} for a, s, _ in grandes],
        "posibles_duplicados": duplicados[:20],
        "subcarpetas": subcarpetas[:50],
    }


def listar_carpeta(cfg, carpeta, maximo=200):
    base, _ = resolver(cfg, carpeta)
    filas = []
    for e in sorted(base.iterdir(), key=lambda x: x.name.lower())[:maximo]:
        try:
            st = e.stat()
            filas.append({"nombre": e.name, "tipo": "carpeta" if e.is_dir() else categoria(e.suffix.lower()),
                          "mb": _mb(st.st_size) if e.is_file() else None,
                          "modificado": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d")})
        except OSError:
            continue
    return {"carpeta": str(base), "elementos": filas}


def leer_archivo(cfg, ruta, max_caracteres=20000):
    p, _ = resolver(cfg, ruta)
    if p.suffix.lower() not in EXT_TEXTO:
        return {"error": f"Solo leo archivos de texto/código ({', '.join(sorted(EXT_TEXTO))})."}
    texto = p.read_text(encoding="utf-8", errors="replace")
    return {"archivo": str(p), "contenido": texto[:max_caracteres], "recortado": len(texto) > max_caracteres}


def proponer_plan(cfg, motivo, movimientos):
    """Valida y guarda el plan; NO mueve nada."""
    global _plan_actual
    validos, rechazados = [], []
    for m in movimientos:
        try:
            origen, raiz = resolver(cfg, m["origen"])
            if not origen.exists():
                raise FileNotFoundError(f"No existe: {origen}")
            destino = Path(m["carpeta_destino"])
            destino = (destino if destino.is_absolute() else origen.parent / destino).resolve()
            resolver(cfg, str(destino))  # el destino también debe estar en zona permitida
            validos.append({"origen": str(origen), "carpeta_destino": str(destino)})
        except Exception as e:  # noqa: BLE001 - se reporta al modelo
            rechazados.append({"movimiento": m, "motivo": str(e)})
    _plan_actual = {"motivo": motivo, "movimientos": validos} if validos else None
    return {"plan_mostrado_a_elias": bool(validos), "movimientos_validos": len(validos),
            "rechazados": rechazados,
            "nota": "El plan NO se ha ejecutado. Elías debe presionar 'Aplicar' en la ventana."}


def plan_actual():
    return _plan_actual


def aplicar_plan():
    """Se llama solo desde el botón 'Aplicar' de la interfaz."""
    global _plan_actual
    if not _plan_actual:
        return "No hay plan pendiente."
    hechos, errores = [], []
    for m in _plan_actual["movimientos"]:
        try:
            origen = Path(m["origen"])
            dest_dir = Path(m["carpeta_destino"])
            dest_dir.mkdir(parents=True, exist_ok=True)
            destino = dest_dir / origen.name
            n = 2
            while destino.exists():
                destino = dest_dir / f"{origen.stem} ({n}){origen.suffix}"
                n += 1
            shutil.move(str(origen), str(destino))
            hechos.append({"de": str(origen), "a": str(destino)})
        except Exception as e:  # noqa: BLE001
            errores.append(f"{m['origen']}: {e}")
    bitacora = CARPETA_DATOS / "planes" / f"plan_{datetime.now():%Y%m%d_%H%M%S}.json"
    bitacora.write_text(json.dumps({"motivo": _plan_actual["motivo"], "movimientos": hechos},
                                   ensure_ascii=False, indent=1), encoding="utf-8")
    _plan_actual = None
    txt = f"Listo: moví {len(hechos)} archivo(s). Puedes deshacerlo."
    if errores:
        txt += f" {len(errores)} no se pudieron mover: " + "; ".join(errores[:3])
    return txt


def descartar_plan():
    global _plan_actual
    _plan_actual = None


def deshacer_ultimo():
    planes = sorted((CARPETA_DATOS / "planes").glob("plan_*.json"))
    if not planes:
        return "No hay movimientos que deshacer."
    ultimo = planes[-1]
    datos = json.loads(ultimo.read_text(encoding="utf-8"))
    regresados = 0
    for m in reversed(datos["movimientos"]):
        a, de = Path(m["a"]), Path(m["de"])
        if a.exists() and not de.exists():
            de.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(a), str(de))
            regresados += 1
            try:
                a.parent.rmdir()  # borra la carpeta que creó el plan si quedó vacía
            except OSError:
                pass
    ultimo.rename(ultimo.with_suffix(".deshecho"))
    return f"Regresé {regresados} archivo(s) a su lugar original."
