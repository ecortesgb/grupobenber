"""GB Saurio: mascota 3D de escritorio con Claude.

Ventana sin bordes, transparente y siempre encima. La mascota (imágenes 2D) y el chat
viven en ui/index.html; Python hace el trabajo real (Claude, archivos, pendientes, reuniones).
"""
import json
import os
import sys
import threading
from pathlib import Path

from PySide6.QtCore import QObject, QPoint, Qt, QTimer, QUrl, Signal, Slot
from PySide6.QtGui import QAction, QColor, QIcon, QPixmap, QPainter
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QApplication, QMenu, QSystemTrayIcon

import archivos
import datos
import reuniones
from asistente import Asistente

CHICA = (230, 290)    # solo la mascota (con espacio para el globo)
GRANDE = (420, 700)   # mascota + panel de chat


class Puente(QObject):
    """Todo lo que la página web puede pedirle a Python, y lo que Python le avisa."""
    respuesta = Signal(str)       # texto de Saurio
    estado = Signal(str)          # idle | pensando | hablando | feliz | escuchando | alerta
    plan = Signal(str)            # JSON del plan de organización propuesto
    pendientes = Signal(str)      # JSON de la lista de pendientes
    aviso = Signal(str)           # mensaje corto (recordatorios, errores)

    def __init__(self, ventana, cfg):
        super().__init__()
        self.ventana = ventana
        self.cfg = cfg
        self.ocupado = threading.Lock()
        self.grabadora = reuniones.Grabadora()
        self.asistente = Asistente(
            cfg,
            al_proponer_plan=lambda p: self.plan.emit(json.dumps(p, ensure_ascii=False)),
            al_cambiar_pendientes=self._emitir_pendientes,
            al_reunion=self.reunion_desde_chat)

    # ---------- chat ----------
    @Slot(str)
    def enviar(self, texto):
        if not self.cfg["api_key"]:
            self.respuesta.emit("Me falta la API key de Claude. Ponla en config.json (campo api_key) y reiníciame.")
            return
        threading.Thread(target=self._trabajar, args=(self.asistente.preguntar, texto), daemon=True).start()

    def _trabajar(self, fn, *args):
        with self.ocupado:
            self.estado.emit("pensando")
            try:
                r = fn(*args)
            except Exception as e:  # noqa: BLE001
                r = f"Algo falló: {e}"
            self.respuesta.emit(r)
            problema = r.startswith(("Algo falló", "No tengo", "Error", "Claude está saturado", "No pude", "Me falta"))
            if self.grabadora.grabando:
                self.estado.emit("escuchando")  # sigue en modo reunión
            else:
                self.estado.emit("preocupado" if problema else "hablando")

    # ---------- ventana ----------
    @Slot(int, int)
    def mover(self, dx, dy):
        self.ventana.move(self.ventana.pos() + QPoint(dx, dy))

    @Slot(bool)
    def expandir(self, grande):
        w, h = GRANDE if grande else CHICA
        g = self.ventana.geometry()
        # crece hacia arriba y a la izquierda: la mascota no "brinca" de lugar
        self.ventana.setGeometry(g.right() - w + 1, g.bottom() - h + 1, w, h)

    @Slot()
    def ocultar(self):
        self.ventana.hide()

    # ---------- pendientes ----------
    def _emitir_pendientes(self):
        self.pendientes.emit(json.dumps(datos.listar_pendientes(), ensure_ascii=False))

    @Slot()
    def pedirPendientes(self):
        self._emitir_pendientes()

    @Slot(int)
    def completarPendiente(self, id_):
        datos.actualizar_pendiente(id_, estado="Hecho")
        self._emitir_pendientes()
        self.estado.emit("feliz")

    @Slot()
    def exportarExcel(self):
        try:
            ruta = datos.exportar_pendientes_excel()
            if sys.platform == "win32":
                os.startfile(ruta)  # noqa: S606
            self.aviso.emit(f"Excel listo: {ruta.name}")
        except Exception as e:  # noqa: BLE001
            self.aviso.emit(f"No pude crear el Excel: {e}")

    def revisar_vencidos(self):
        urgentes = datos.pendientes_por_atender()
        if urgentes:
            vencidos = sum(1 for p in urgentes if p["vencido"])
            txt = f"Tienes {len(urgentes)} pendiente(s) para hoy"
            txt += f", {vencidos} ya vencido(s)." if vencidos else "."
            self.aviso.emit(txt)
            self.estado.emit("alerta")

    # ---------- archivos ----------
    @Slot()
    def aplicarPlan(self):
        self.aviso.emit(archivos.aplicar_plan())
        self.estado.emit("feliz")

    @Slot()
    def descartarPlan(self):
        archivos.descartar_plan()
        self.aviso.emit("Plan descartado. No moví nada.")

    @Slot()
    def deshacer(self):
        self.aviso.emit(archivos.deshacer_ultimo())

    # ---------- reuniones ----------
    def reunion_desde_chat(self, accion):
        """Claude lo usa cuando Elías pide por chat empezar o terminar de escuchar una reunión."""
        if accion == "iniciar" and self.grabadora.grabando:
            return "Ya estaba escuchando la reunión."
        if accion == "terminar" and not self.grabadora.grabando:
            return "No estaba escuchando ninguna reunión."
        self.reunion()
        if accion == "iniciar":
            return "Escuchando." if self.grabadora.grabando else "No pude empezar a escuchar (revisa el aviso en pantalla)."
        return "Detenido. La minuta se hará en cuanto termine la transcripción; no hace falta responder más."

    @Slot()
    def reunion(self):
        if not reuniones.disponible():
            self.aviso.emit("Para escuchar reuniones corre una vez instalar_reuniones.bat")
            return
        if not self.grabadora.grabando:
            try:
                n = self.grabadora.iniciar()
                self.aviso.emit("Escuchando la reunión (tu micrófono + audio de Teams)…" if n == 2
                                else "Escuchando solo tu micrófono (no encontré el audio de la laptop)…")
                self.estado.emit("escuchando")
            except Exception as e:  # noqa: BLE001
                self.aviso.emit(f"No pude abrir el micrófono: {e}")
            return
        carpeta = self.grabadora.detener()
        self.aviso.emit("Reunión detenida. Transcribiendo en tu laptop…")
        threading.Thread(target=self._trabajar, args=(self._minuta, carpeta), daemon=True).start()

    def _minuta(self, carpeta):
        texto = reuniones.Grabadora.transcribir(
            carpeta, self.cfg["modelo_transcripcion"],
            al_avance=lambda p: self.aviso.emit(f"Transcribiendo… {p}%"))
        if not self.cfg.get("conservar_audio"):
            reuniones.borrar_audio(carpeta)  # solo se queda el texto
        if not texto.strip():
            return "No escuché nada en la grabación."
        if not self.cfg["api_key"]:
            return f"Transcripción guardada en {carpeta}, pero sin API key no puedo hacer la minuta."
        r = self.asistente.procesar_reunion(texto, f"Reunión {carpeta.name}")
        self._emitir_pendientes()
        return r


def icono():
    pm = QPixmap(64, 64)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.Antialiasing)
    p.setBrush(QColor("#2fae66"))
    p.setPen(Qt.NoPen)
    p.drawEllipse(4, 4, 56, 56)
    p.setBrush(QColor("white"))
    p.drawEllipse(36, 18, 12, 12)
    p.end()
    return QIcon(pm)


def main():
    os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", "--enable-gpu-rasterization --ignore-gpu-blocklist")
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    cfg = datos.cargar_config()

    vista = QWebEngineView()
    vista.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
    vista.setAttribute(Qt.WA_TranslucentBackground)
    vista.setStyleSheet("background: transparent")
    vista.page().setBackgroundColor(Qt.transparent)
    vista.settings().setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
    vista.setContextMenuPolicy(Qt.NoContextMenu)

    puente = Puente(vista, cfg)
    canal = QWebChannel()
    canal.registerObject("puente", puente)
    vista.page().setWebChannel(canal)
    vista.load(QUrl.fromLocalFile(str(Path(__file__).resolve().parent / "ui" / "index.html")))

    pantalla = app.primaryScreen().availableGeometry()
    vista.setGeometry(pantalla.right() - CHICA[0] - 20, pantalla.bottom() - CHICA[1] - 10, *CHICA)
    vista.show()

    # Ícono en la bandeja (junto al reloj) para mostrar/ocultar/salir
    bandeja = QSystemTrayIcon(icono())
    bandeja.setToolTip("GB Saurio")
    menu = QMenu()
    a_mostrar = QAction("Mostrar / ocultar")
    a_mostrar.triggered.connect(lambda: vista.setVisible(not vista.isVisible()))
    a_salir = QAction("Salir")
    a_salir.triggered.connect(app.quit)
    menu.addAction(a_mostrar)
    menu.addAction(a_salir)
    bandeja.setContextMenu(menu)
    bandeja.activated.connect(lambda r: vista.setVisible(not vista.isVisible())
                              if r == QSystemTrayIcon.Trigger else None)
    bandeja.show()

    # Recordatorio de pendientes vencidos: al arrancar y cada N minutos
    reloj = QTimer()
    reloj.timeout.connect(puente.revisar_vencidos)
    reloj.start(int(cfg["recordatorio_minutos"]) * 60_000)
    vista.loadFinished.connect(lambda ok: QTimer.singleShot(2500, puente.revisar_vencidos))

    if not cfg["api_key"]:
        QTimer.singleShot(3000, lambda: puente.aviso.emit("Falta la API key en config.json"))

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
