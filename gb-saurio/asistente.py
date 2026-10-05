"""Cerebro de GB Saurio: conversación con Claude + herramientas locales."""
import json
from datetime import date

import anthropic

import archivos
import datos

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

SISTEMA = """Eres GB Saurio, un dinosaurio 3D que vive en la laptop de Elías Cortés y es su asistente personal.
Elías es Director en Grupo Benber (operación comercial para Telefónica Movistar México en Coppel, Elektra, Suburbia y Cimaco).
Domina Excel, Power Pivot, DAX, Power Query (M), VBA, SQL y Power BI; está aprendiendo Python, Notion y AppSheet.

Cómo trabajas:
- Respondes en español, corto y directo: tus respuestas aparecen en una burbuja pequeña. Máximo ~120 palabras salvo que pida detalle o código.
- Explicas la lógica en lenguaje muy simple. Cuando des código, lo das completo y listo para usar.
- Llevas sus pendientes: si menciona algo que tiene que hacer, regístralo con agregar_pendiente (pon fecha compromiso si la dice o se deduce; si no, pregúntala en una línea).
- Tomas notas con guardar_nota cuando te lo pide o cuando algo vale la pena recordar.
- Organización de archivos: primero usa analizar_carpeta / listar_carpeta, luego propone con proponer_plan_organizacion.
  NUNCA digas que moviste archivos: solo propones; Elías decide con el botón "Aplicar". No propongas mover accesos directos ni instaladores sin explicar por qué.
- Sugieres mejoras y automatizaciones con mentalidad de arquitecto de datos (modelos limpios, DAX eficiente, Power Query en vez de pasos manuales).
- Reuniones: solo empiezas o terminas de escuchar cuando Elías lo pide (herramienta reunion). Nunca por iniciativa propia.
- Si algo que propones puede dañar algo existente, dilo explícitamente antes.
"""

HERRAMIENTAS = [
    {"name": "agregar_pendiente",
     "description": "Registra un pendiente de Elías en su lista.",
     "input_schema": {"type": "object", "properties": {
         "titulo": {"type": "string", "description": "Qué hay que hacer, en una frase."},
         "fecha_compromiso": {"type": "string", "description": "YYYY-MM-DD"},
         "prioridad": {"type": "string", "enum": ["Alta", "Media", "Baja"]},
         "detalle": {"type": "string"}},
         "required": ["titulo"]}},
    {"name": "listar_pendientes",
     "description": "Devuelve los pendientes. estado: Abierto (default), Hecho o Todos.",
     "input_schema": {"type": "object", "properties": {
         "estado": {"type": "string", "enum": ["Abierto", "Hecho", "Todos"]}}}},
    {"name": "actualizar_pendiente",
     "description": "Cambia un pendiente existente (marcar Hecho, mover fecha, prioridad o título).",
     "input_schema": {"type": "object", "properties": {
         "id": {"type": "integer"},
         "estado": {"type": "string", "enum": ["Abierto", "Hecho"]},
         "fecha_compromiso": {"type": "string", "description": "YYYY-MM-DD"},
         "prioridad": {"type": "string", "enum": ["Alta", "Media", "Baja"]},
         "titulo": {"type": "string"}},
         "required": ["id"]}},
    {"name": "guardar_nota",
     "description": "Guarda una nota o minuta.",
     "input_schema": {"type": "object", "properties": {
         "titulo": {"type": "string"}, "contenido": {"type": "string"},
         "tipo": {"type": "string", "enum": ["nota", "minuta"]}},
         "required": ["titulo", "contenido"]}},
    {"name": "buscar_notas",
     "description": "Busca en las notas y minutas guardadas por texto.",
     "input_schema": {"type": "object", "properties": {"texto": {"type": "string"}}}},
    {"name": "analizar_carpeta",
     "description": "Resumen de una carpeta: tipos de archivo, tamaños, archivos viejos, posibles duplicados. "
                    "carpeta puede ser 'escritorio', 'documentos', 'descargas' o una ruta dentro de ellas.",
     "input_schema": {"type": "object", "properties": {"carpeta": {"type": "string"}}, "required": ["carpeta"]}},
    {"name": "listar_carpeta",
     "description": "Lista archivos y subcarpetas (nombre, tipo, MB, fecha).",
     "input_schema": {"type": "object", "properties": {"carpeta": {"type": "string"}}, "required": ["carpeta"]}},
    {"name": "leer_archivo",
     "description": "Lee un archivo de texto o código (.txt, .csv, .m, .dax, .sql, .py, .bas, etc.) para revisarlo u optimizarlo.",
     "input_schema": {"type": "object", "properties": {"ruta": {"type": "string"}}, "required": ["ruta"]}},
    {"name": "reunion",
     "description": "Empieza o termina de escuchar una reunión (Teams/Zoom/Meet: micrófono + audio de la laptop). "
                    "Úsala SOLO cuando Elías lo pida explícitamente (p. ej. 'toma minuta de esta junta', 'ya terminó la reunión'). "
                    "Al terminar, la transcripción y la minuta se hacen solas.",
     "input_schema": {"type": "object", "properties": {
         "accion": {"type": "string", "enum": ["iniciar", "terminar"]}}, "required": ["accion"]}},
    {"name": "proponer_plan_organizacion",
     "description": "Muestra a Elías un plan para mover archivos. NO mueve nada: él lo aplica con un botón. "
                    "carpeta_destino puede ser relativa a la carpeta del archivo (ej. 'Excel/2026') o absoluta.",
     "input_schema": {"type": "object", "properties": {
         "motivo": {"type": "string", "description": "Explicación corta del plan."},
         "movimientos": {"type": "array", "items": {"type": "object", "properties": {
             "origen": {"type": "string", "description": "Ruta completa del archivo"},
             "carpeta_destino": {"type": "string"}},
             "required": ["origen", "carpeta_destino"]}}},
         "required": ["motivo", "movimientos"]}},
]


class Asistente:
    MAX_MENSAJES = 60  # al llegar aquí se inicia conversación nueva (pendientes y notas persisten)

    def __init__(self, cfg, al_proponer_plan=None, al_cambiar_pendientes=None, al_reunion=None):
        self.cfg = cfg
        self.cliente = anthropic.Anthropic(api_key=cfg["api_key"] or None)
        self.mensajes = []
        self.origen = "chat"
        self.al_proponer_plan = al_proponer_plan or (lambda plan: None)
        self.al_cambiar_pendientes = al_cambiar_pendientes or (lambda: None)
        self.al_reunion = al_reunion or (lambda accion: "No disponible.")

    def _sistema(self):
        hoy = date.today()
        return SISTEMA + f"\nHoy es {DIAS[hoy.weekday()]} {hoy.isoformat()}."

    def _ejecutar(self, nombre, e):
        cfg = self.cfg
        if nombre == "agregar_pendiente":
            id_ = datos.agregar_pendiente(e["titulo"], e.get("fecha_compromiso"), e.get("prioridad", "Media"),
                                          e.get("detalle", ""), origen=self.origen)
            self.al_cambiar_pendientes()
            return {"ok": True, "id": id_}
        if nombre == "listar_pendientes":
            return datos.listar_pendientes(e.get("estado", "Abierto"))
        if nombre == "actualizar_pendiente":
            ok = datos.actualizar_pendiente(e["id"], **{k: v for k, v in e.items() if k != "id"})
            self.al_cambiar_pendientes()
            return {"ok": ok}
        if nombre == "guardar_nota":
            return {"ok": True, "id": datos.guardar_nota(e["titulo"], e["contenido"], e.get("tipo", "nota"))}
        if nombre == "buscar_notas":
            return datos.buscar_notas(e.get("texto", ""))
        if nombre == "analizar_carpeta":
            return archivos.analizar_carpeta(cfg, e["carpeta"])
        if nombre == "listar_carpeta":
            return archivos.listar_carpeta(cfg, e["carpeta"])
        if nombre == "leer_archivo":
            return archivos.leer_archivo(cfg, e["ruta"])
        if nombre == "reunion":
            return {"resultado": self.al_reunion(e["accion"])}
        if nombre == "proponer_plan_organizacion":
            r = archivos.proponer_plan(cfg, e["motivo"], e["movimientos"])
            if archivos.plan_actual():
                self.al_proponer_plan(archivos.plan_actual())
            return r
        return {"error": f"Herramienta desconocida: {nombre}"}

    def preguntar(self, texto):
        """Envía un mensaje y resuelve todas las herramientas. Devuelve el texto final."""
        if len(self.mensajes) >= self.MAX_MENSAJES:
            self.mensajes = []
        self.mensajes.append({"role": "user", "content": texto})
        for _ in range(15):  # tope de vueltas por seguridad
            try:
                with self.cliente.messages.stream(
                    model=self.cfg["modelo"],
                    max_tokens=32000,
                    system=self._sistema(),
                    tools=HERRAMIENTAS,
                    messages=self.mensajes,
                    # Haiku no acepta el parámetro de esfuerzo
                    extra_body={} if "haiku" in self.cfg["modelo"] else {"output_config": {"effort": self.cfg["esfuerzo"]}},
                ) as stream:
                    resp = stream.get_final_message()
            except anthropic.AuthenticationError:
                self.mensajes.pop()
                return "No tengo una API key válida. Revisa config.json (campo api_key)."
            except anthropic.RateLimitError:
                self.mensajes.pop()
                return "Claude está saturado en este momento. Intenta en un minuto."
            except anthropic.APIConnectionError:
                self.mensajes.pop()
                return "No tengo conexión a internet o a la API de Claude."
            except anthropic.APIStatusError as err:
                self.mensajes = []  # se reinicia para no arrastrar un historial inválido
                return f"Error de la API ({err.status_code}). Reinicié la conversación; vuelve a intentar."

            self.mensajes.append({"role": "assistant", "content": resp.content})

            if resp.stop_reason == "refusal":
                self.mensajes = []
                return "No puedo ayudar con eso. Reinicié la conversación."
            usos = [b for b in resp.content if b.type == "tool_use"]
            if resp.stop_reason != "tool_use" or not usos:
                texto_final = "".join(b.text for b in resp.content if b.type == "text").strip()
                if resp.stop_reason == "max_tokens":
                    texto_final += "\n\n(La respuesta se cortó por largo.)"
                return texto_final or "Listo."

            resultados = []
            for u in usos:
                try:
                    r = self._ejecutar(u.name, u.input)
                    resultados.append({"type": "tool_result", "tool_use_id": u.id,
                                       "content": json.dumps(r, ensure_ascii=False, default=str)})
                except Exception as err:  # noqa: BLE001 - el error se le devuelve a Claude
                    resultados.append({"type": "tool_result", "tool_use_id": u.id,
                                       "content": f"Error: {err}", "is_error": True})
            self.mensajes.append({"role": "user", "content": resultados})
        return "Me tomó demasiados pasos; intenta pedirlo más concreto."

    def procesar_reunion(self, transcripcion, titulo):
        prompt = (f"Esta es la transcripción automática de la reunión «{titulo}». Puede tener errores de reconocimiento.\n"
                  "1) Guarda una minuta con guardar_nota (tipo 'minuta'): resumen, decisiones, acuerdos con responsable y fecha.\n"
                  "2) Registra con agregar_pendiente SOLO los acuerdos que le tocan a Elías, con fecha si se mencionó.\n"
                  "3) Respóndeme en 5 líneas máximo qué guardaste.\n\n"
                  f"<transcripcion>\n{transcripcion}\n</transcripcion>")
        self.origen = "reunión"
        try:
            return self.preguntar(prompt)
        finally:
            self.origen = "chat"
