"""Buzón de avisos: tus macros, scripts y tareas programadas le avisan a Saurio.

Escucha solo en tu laptop (127.0.0.1). Cada aviso debe traer la contraseña del buzón
(%USERPROFILE%\\GbSaurio\\buzon_token.txt, se crea sola) para que ninguna página web
ni programa ajeno pueda mandarle mensajes.

POST /aviso  con JSON:
  {"texto": "Reporte de ventas listo",       (obligatorio)
   "estado": "feliz",                         (opcional: feliz, alerta, preocupado, hablando)
   "origen": "Centro de Mando",               (opcional: quién avisa)
   "pendiente": {"titulo": "...", "fecha_compromiso": "2026-10-09", "prioridad": "Alta"}}  (opcional)
GET /salud  responde {"ok": true} para saber si Saurio está prendido.
"""
import hmac
import json
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import datos

ESTADOS = {"feliz", "alerta", "preocupado", "hablando"}
RUTA_TOKEN = datos.CARPETA_DATOS / "buzon_token.txt"


def token():
    if not RUTA_TOKEN.exists():
        RUTA_TOKEN.write_text(secrets.token_urlsafe(24), encoding="utf-8")
    return RUTA_TOKEN.read_text(encoding="utf-8").strip()


def validar(cuerpo):
    """Revisa el JSON del aviso y devuelve (aviso_limpio, error)."""
    if not isinstance(cuerpo, dict) or not str(cuerpo.get("texto", "")).strip():
        return None, "Falta el campo texto."
    aviso = {
        "texto": str(cuerpo["texto"]).strip()[:500],
        "estado": cuerpo.get("estado") if cuerpo.get("estado") in ESTADOS else "alerta",
        "origen": str(cuerpo.get("origen") or "Automatización").strip()[:60],
        "pendiente": None,
    }
    p = cuerpo.get("pendiente")
    if p is not None:
        if not isinstance(p, dict) or not str(p.get("titulo", "")).strip():
            return None, "El pendiente necesita titulo."
        aviso["pendiente"] = {
            "titulo": str(p["titulo"]).strip()[:200],
            "fecha_compromiso": p.get("fecha_compromiso") or None,
            "prioridad": p.get("prioridad") if p.get("prioridad") in ("Alta", "Media", "Baja") else "Media",
        }
    return aviso, None


def registrar(aviso):
    """Guarda el aviso como nota (para preguntarle a Saurio "¿qué falló hoy?") y el pendiente si viene."""
    datos.guardar_nota(f"{aviso['origen']}: {aviso['texto'][:80]}", aviso["texto"], tipo="aviso")
    if aviso["pendiente"]:
        p = aviso["pendiente"]
        datos.agregar_pendiente(p["titulo"], p["fecha_compromiso"], p["prioridad"], origen=aviso["origen"])


class Buzon:
    def __init__(self, puerto, al_recibir):
        self.al_recibir = al_recibir  # se llama con el aviso limpio
        self.clave = token()
        buzon = self

        class Manejador(BaseHTTPRequestHandler):
            def _responder(self, codigo, cuerpo):
                datos_ = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
                self.send_response(codigo)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(datos_)))
                self.end_headers()
                self.wfile.write(datos_)

            def do_GET(self):  # noqa: N802
                if self.path == "/salud":
                    self._responder(200, {"ok": True})
                else:
                    self._responder(404, {"error": "Ruta desconocida."})

            def do_POST(self):  # noqa: N802
                if self.path != "/aviso":
                    return self._responder(404, {"error": "Ruta desconocida."})
                if not hmac.compare_digest(self.headers.get("X-Saurio-Token", ""), buzon.clave):
                    return self._responder(401, {"error": "Contraseña del buzón incorrecta."})
                largo = int(self.headers.get("Content-Length") or 0)
                if largo > 20_000:
                    return self._responder(413, {"error": "Aviso demasiado largo."})
                try:
                    cuerpo = json.loads(self.rfile.read(largo).decode("utf-8-sig") or "{}")
                except (ValueError, UnicodeDecodeError):
                    return self._responder(400, {"error": "El cuerpo no es JSON válido."})
                aviso, error = validar(cuerpo)
                if error:
                    return self._responder(400, {"error": error})
                try:
                    registrar(aviso)
                    buzon.al_recibir(aviso)
                except Exception as e:  # noqa: BLE001 - quien avisa nunca debe tronar por Saurio
                    return self._responder(500, {"error": str(e)})
                self._responder(200, {"ok": True})

            def log_message(self, *args):  # sin ruido en consola
                pass

        self.servidor = ThreadingHTTPServer(("127.0.0.1", int(puerto)), Manejador)

    def iniciar(self):
        threading.Thread(target=self.servidor.serve_forever, daemon=True).start()

    def detener(self):
        self.servidor.shutdown()
