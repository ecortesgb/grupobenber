"""Voz de Saurio: lo despiertas diciendo "GB Saurio" (o con 🎤) y te contesta hablando.

- Oído: escucha tu micrófono en la laptop. Mientras espera, solo revisa el inicio de cada frase para ver
  si dijiste "GB Saurio"; lo demás se descarta al momento. Nada se graba en disco ni sale de la laptop.
  Transcribe con faster-whisper (el mismo de las reuniones).
- Boca: la voz en español de Windows, que se queda cargada para contestar sin demora.
"""
import base64
import re
import subprocess
import sys
import threading
import unicodedata
from collections import deque

TASA = 16000
MAX_SEGUNDOS = 40        # tope por si nunca te callas
SILENCIO_FIN = 1.2       # segundos callado después de hablar = terminaste
SIN_HABLAR_MAX = 6       # si en 6 s no dijiste nada, deja de escuchar
REVISAR_A = 1.6          # segundos del inicio de una frase que se revisan buscando "GB Saurio"
PAUSA_FRASE = 0.5        # silencio que separa una frase de otra
VOCABULARIO = ("GB Saurio, Benber, pendientes, Coppel, Elektra, Suburbia, Cimaco, Movistar, "
               "Telefónica, Power BI, Excel, cuota, minuta, reunión.")
# Whisper (sin vocabulario) escribe "GB Saurio" de muchas formas: "Jebe Saudio", "Jebes aurio", "G. B. Saurio",
# "GbSaurio"... Se busca en las letras pegadas (sin espacios ni acentos) o, si solo dijiste "Saurio", como palabra
# suelta (así "necesario" u "horario" no lo despiertan).
_GB_SAURIO = re.compile(r"[gjy]e?[bv]e?s?a?u[rd][iey]?[oa]s?")
_SAURIO = re.compile(r"\b(?:s[aá]u?(?:ri[oó]?|r[oó])s?|z[aá]ur[iy]o|sabr[iy]o)\b", re.I)

_modelos = {}
_candado_modelo = threading.Lock()


def bitacora(msg):
    """Deja rastro de lo que oyó (volumen y texto, nunca audio) en GbSaurio\\voz.log para revisar fallas."""
    from datetime import datetime
    from datos import CARPETA_DATOS
    ruta = CARPETA_DATOS / "voz.log"
    try:
        if ruta.exists() and ruta.stat().st_size > 300_000:
            ruta.unlink()  # ponytail: se reinicia al llegar a 300 KB, no hace falta rotación
        with ruta.open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")
    except OSError:
        pass


def puede_oir():
    import reuniones
    return reuniones.disponible()


def _modelo(nombre):
    """Whisper tarda unos segundos en cargar: se carga una vez y se reusa."""
    with _candado_modelo:
        if nombre not in _modelos:
            from faster_whisper import WhisperModel
            _modelos[nombre] = WhisperModel(nombre, device="cpu", compute_type="int8")
        return _modelos[nombre]


def precargar(nombre):
    threading.Thread(target=_modelo, args=(nombre,), daemon=True).start()


def transcribir(audio, modelo="base", vocabulario=True):
    if audio is None or len(audio) < TASA * 0.4:
        return ""
    m = _modelo(modelo)
    with _candado_modelo:
        segmentos, _ = m.transcribe(audio, language="es", vad_filter=True, beam_size=1,
                                    initial_prompt=VOCABULARIO if vocabulario else None)
        return " ".join(s.text.strip() for s in segmentos).strip()


def llamado(texto):
    """Si en el texto lo llamaron ("GB Saurio"), devuelve lo que dijiste después (puede ser ""); si no, None."""
    m = _SAURIO.search(texto)
    if m:
        return texto[m.end():].strip(" ,.;:!?¡¿")
    t = unicodedata.normalize("NFD", texto)
    letras, pos = [], []
    for i, ch in enumerate(t):
        if ch.isascii() and ch.isalpha():
            letras.append(ch.lower())
            pos.append(i)
    m = _GB_SAURIO.search("".join(letras))
    if not m:
        return None
    fin = pos[m.end() - 1] + 1
    while fin < len(t) and (t[fin].isalpha() or unicodedata.combining(t[fin])):
        fin += 1  # termina la palabra donde quedó el nombre
    return unicodedata.normalize("NFC", t[fin:]).strip(" ,.;:!?¡¿")


def dijo_saurio(texto):
    return llamado(texto or "") is not None


def sin_palabra(texto):
    """'GB Saurio, ¿qué pendientes tengo?' -> 'qué pendientes tengo' (solo si lo llamaste al inicio)."""
    return llamado(texto) if dijo_saurio(texto[:40]) else texto.strip()


class Oido:
    """Un solo micrófono con dos modos:
    - vigilando: espera "GB Saurio" (si está prendida la palabra de activación).
    - grabando: guarda lo que dices hasta que te callas y lo entrega a al_terminar(audio, por_palabra).
    """

    def __init__(self, al_terminar, al_despertar=None, pausado=lambda: False, modelo="base"):
        self.al_terminar = al_terminar
        self.al_despertar = al_despertar or (lambda: None)
        self.pausado = pausado            # True mientras Saurio habla, piensa o graba una reunión
        self.modelo = modelo
        self.vigilar = False
        self.modo = "apagado"
        self.stream = None
        self.pa = None
        self.candado = threading.Lock()
        self.piso = 300.0
        self._reiniciar_frase()

    @property
    def activo(self):
        return self.modo == "grabando"

    # ---------- abrir / cerrar el micrófono ----------
    def _abrir(self):
        if self.stream:
            return
        import pyaudiowpatch as pyaudio
        self.pa = pyaudio.PyAudio()
        wasapi = self.pa.get_host_api_info_by_type(pyaudio.paWASAPI)
        mic = self.pa.get_device_info_by_index(wasapi["defaultInputDevice"])
        self.canales = max(1, int(mic["maxInputChannels"]))
        self.tasa = int(mic["defaultSampleRate"])
        self.stream = self.pa.open(format=pyaudio.paInt16, channels=self.canales, rate=self.tasa, input=True,
                                   input_device_index=mic["index"], frames_per_buffer=1024,
                                   stream_callback=self._cb)
        self.nivel_max, self.nivel_t, self.error_cb = 0.0, 0.0, False
        bitacora(f"micrófono abierto: {mic['name']} ({self.tasa} Hz, {self.canales} canales)")

    def _cerrar(self):
        stream, pa = self.stream, self.pa
        self.stream = self.pa = None
        if stream:
            try:
                stream.stop_stream()
                stream.close()
            finally:
                pa.terminate()

    def vigilancia(self, si):
        """Prende o apaga la escucha de "GB Saurio"."""
        with self.candado:
            self.vigilar = si
            if si and self.modo == "apagado":
                self._abrir()
                self._reiniciar_frase()
                self.modo = "vigilando"
            elif not si and self.modo == "vigilando":
                self.modo = "apagado"
                self._cerrar()

    def escuchar_ya(self):
        """Botón 🎤: empieza a grabar ahora mismo."""
        with self.candado:
            self._abrir()
            self._empezar_grabacion([], hablo=False, por_palabra=False)

    # ---------- el audio llega aquí en trocitos ----------
    def _a16k(self, datos):
        import numpy as np
        x = np.frombuffer(datos, dtype=np.int16).astype(np.float32).reshape(-1, self.canales).mean(axis=1)
        n = int(len(x) * TASA / self.tasa)
        return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x) if n else x[:0]

    def _cb(self, datos, frames, tiempo, estado):
        import pyaudiowpatch as pyaudio
        try:
            self._procesar(self._a16k(datos))
        except Exception as e:  # noqa: BLE001 - un trocito raro nunca debe tumbar el micrófono
            if not self.error_cb:
                self.error_cb = True
                bitacora(f"error procesando audio: {e!r}")
        return (None, pyaudio.paContinue)

    def _procesar(self, x):
        import numpy as np
        dur = len(x) / TASA
        volumen = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0
        umbral = max(450.0, self.piso * 3)
        voz = volumen > umbral
        if not voz:  # el ruido del cuarto se va midiendo solo
            self.piso = 0.97 * self.piso + 0.03 * volumen
        # cada 5 s, si hubo sonido, deja en la bitácora qué tan fuerte llegó (para calibrar el umbral)
        self.nivel_max, self.nivel_t = max(self.nivel_max, volumen), self.nivel_t + dur
        if self.nivel_t >= 5:
            if self.nivel_max > 150:
                bitacora(f"nivel {self.modo}: máx {self.nivel_max:.0f}, umbral {umbral:.0f}, ruido {self.piso:.0f}")
            self.nivel_max, self.nivel_t = 0.0, 0.0
        if self.modo == "grabando":
            self._grabar(x, dur, voz)
        elif self.modo == "vigilando":
            self._vigilar(x, dur, voz)

    def _grabar(self, x, dur, voz):
        self.trozos.append(x)
        self.total += dur
        if voz:
            self.hablo, self.callado = True, 0.0
        else:
            self.callado += dur
        if ((self.hablo and self.callado > SILENCIO_FIN) or self.total > MAX_SEGUNDOS
                or (not self.hablo and self.total > SIN_HABLAR_MAX)):
            self.modo = "entregando"  # antes de soltar el hilo: si no, podría pisar el "vigilando" que pone terminar()
            threading.Thread(target=self.terminar, daemon=True).start()

    def _vigilar(self, x, dur, voz):
        if self.pausado():
            self._reiniciar_frase()
            return
        self.previo.append(x)  # medio segundo antes de que empieces a hablar
        if not self.en_frase:
            if voz:
                self.en_frase = True
                self.frase = list(self.previo)
                self.largo = sum(len(t) for t in self.frase) / TASA
                self.callado = 0.0
            return
        self.frase.append(x)
        self.largo += dur
        self.callado = 0.0 if voz else self.callado + dur
        termino = self.callado > PAUSA_FRASE
        if self.estado_revision == "no":
            if termino:
                self._reiniciar_frase()  # no era para Saurio: se tira
            return
        if self.estado_revision == "si":
            # ¡te oyó! sigue grabando lo que dices después de "GB Saurio".
            # Si ya dijiste algo más después de lo revisado, eso es tu pregunta: no hay que esperar más.
            siguio = (self.largo - self.callado) > self.revisado + 0.3
            self._empezar_grabacion(self.frase, hablo=not termino or siguio, por_palabra=True)
            threading.Thread(target=self.al_despertar, daemon=True).start()
            return
        if self.estado_revision is None and (self.largo >= REVISAR_A or (termino and self.largo >= 0.5)):
            self.estado_revision = "revisando"
            self.revisado = self.largo
            muestra = __import__("numpy").concatenate(self.frase)
            threading.Thread(target=self._revisar, args=(muestra,), daemon=True).start()
        if termino and self.estado_revision == "revisando":
            return  # espera la revisión antes de tirar la frase
        if termino and self.estado_revision is None:
            self._reiniciar_frase()  # ruido cortito

    def _revisar(self, muestra):
        try:
            texto = transcribir((muestra / 32768).astype('float32'), self.modelo, vocabulario=False)
        except Exception as e:  # noqa: BLE001
            bitacora(f"error revisando frase: {e!r}")
            texto = ""
        self.estado_revision = "si" if dijo_saurio(texto) else "no"
        bitacora(f"frase revisada ({len(muestra) / TASA:.1f} s): {texto!r} -> {self.estado_revision}")

    def _reiniciar_frase(self):
        self.previo = deque(maxlen=8)
        self.en_frase = False
        self.frase = []
        self.largo = 0.0
        self.callado = 0.0
        self.estado_revision = None
        self.revisado = 0.0

    def _empezar_grabacion(self, inicio, hablo, por_palabra):
        self.trozos = list(inicio)
        self.total = 0.0  # los límites cuentan desde ahora
        self.hablo = hablo
        self.callado = 0.0
        self.por_palabra = por_palabra
        self.modo = "grabando"

    def terminar(self):
        """Deja de grabar y entrega el audio (16 kHz mono, -1..1). Seguro de llamar dos veces."""
        import numpy as np
        with self.candado:
            if self.modo not in ("grabando", "entregando"):
                return
            trozos, hablo, por_palabra = self.trozos, self.hablo or self.por_palabra, self.por_palabra
            self.trozos = []
            self._reiniciar_frase()
            if self.vigilar:
                self.modo = "vigilando"
            else:
                self.modo = "apagado"
                self._cerrar()
        audio = (np.concatenate(trozos) / 32768).astype(np.float32) if hablo and trozos else None
        bitacora(f"grabación terminada: hablaste={hablo}, {sum(len(t) for t in trozos) / TASA:.1f} s, "
                 f"por palabra={por_palabra}")
        self.al_terminar(audio, por_palabra)

    def apagar(self):
        with self.candado:
            self.vigilar = False
            self.modo = "apagado"
            self._cerrar()


# ---------- boca ----------
# PowerShell se queda abierto con la voz cargada; cada línea que recibe (texto en base64) la dice y responde FIN.
_PS = r"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'es*' } |
     Sort-Object { $_.VoiceInfo.Culture.Name -ne 'es-MX' } | Select-Object -First 1
if (-not $v) { [Console]::Out.WriteLine('SINVOZ'); exit 3 }
$s.SelectVoice($v.VoiceInfo.Name)
$s.Rate = __VELOCIDAD__
[Console]::Out.WriteLine('LISTO')
while ($null -ne ($l = [Console]::In.ReadLine())) {
  $s.Speak([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($l)))
  [Console]::Out.WriteLine('FIN')
}
"""


def para_leer(texto, limite=450):
    """Lo que tiene sentido decir en voz alta: sin código, sin markdown, sin emojis, y corto."""
    t = re.sub(r"<think>.*?</think>", " ", texto, flags=re.S)
    t = re.sub(r"```.*?```", " Te dejé el código en el chat. ", t, flags=re.S)
    t = re.sub(r"https?://\S+", "el enlace del chat", t)
    t = re.sub(r"[`*_#>|]", "", t)
    t = re.sub(r"^\s*[-•]\s*", "", t, flags=re.M)
    t = re.sub(r"[\U0001F000-\U0001FFFF☀-➿️]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) > limite:
        corte = max(t.rfind(". ", 0, limite), t.rfind("? ", 0, limite), t.rfind("! ", 0, limite))
        t = (t[:corte + 1] if corte > 80 else t[:limite]) + " El resto está en el chat."
    return t


class Boca:
    def __init__(self, velocidad=1, sin_voz=None):
        self.velocidad = max(-10, min(10, int(velocidad)))
        self.sin_voz = sin_voz or (lambda: None)
        self.proc = None
        self.turno = 0
        self.hablando = False
        self.candado = threading.Lock()
        self.sin_espanol = False

    def preparar(self):
        """Abre PowerShell con la voz cargada (tarda ~1 s la primera vez; después ya no)."""
        if sys.platform != "win32" or self.sin_espanol:
            return None
        with self.candado:
            if self.proc and self.proc.poll() is None:
                return self.proc
            script = _PS.replace("__VELOCIDAD__", str(self.velocidad))
            proc = subprocess.Popen(
                ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand",
                 base64.b64encode(script.encode("utf-16-le")).decode("ascii")],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                text=True, encoding="ascii", errors="ignore", creationflags=0x08000000)
            primera = proc.stdout.readline().strip()
            if primera != "LISTO":
                self.sin_espanol = primera == "SINVOZ"
                proc.kill()
                if self.sin_espanol:
                    self.sin_voz()
                return None
            self.proc = proc
            return proc

    def decir(self, texto, al_terminar):
        """Habla en segundo plano. al_terminar() se llama al acabar, salvo que alguien lo calle antes."""
        self.callar()
        t = para_leer(texto)
        if sys.platform != "win32" or self.sin_espanol or not t:
            return False
        self.turno += 1
        turno = self.turno
        self.hablando = True

        def hablar():
            proc = self.preparar()
            ok = False
            if proc and turno == self.turno:
                try:
                    proc.stdin.write(base64.b64encode(t.encode("utf-8")).decode("ascii") + "\n")
                    proc.stdin.flush()
                    ok = proc.stdout.readline().strip() == "FIN"
                except (OSError, ValueError):
                    pass
            if turno == self.turno:  # nadie lo calló
                self.hablando = False
                if not ok:
                    self.proc = None
                al_terminar()
        threading.Thread(target=hablar, daemon=True).start()
        return True

    def callar(self):
        self.turno += 1
        if self.hablando and self.proc:
            self.proc.kill()  # cortar a media frase; se vuelve a abrir solo
            self.proc = None
            threading.Thread(target=self.preparar, daemon=True).start()
        self.hablando = False


if __name__ == "__main__":  # autoprueba: py -3 voz.py
    for t, esperado in [("Jebe Saudio", ""), ("Jebes Aureo, anota que mañana revisó el reporte", "anota que mañana revisó el reporte"),
                        ("G. B. Saurio, ¿qué pendientes tengo?", "qué pendientes tengo"), ("GbSaurio", ""),
                        ("Jebesa Urio", ""), ("Saurio, apaga", "apaga"), ("Jebes aurio, que pendientes tengo", "que pendientes tengo"),
                        ("Necesito el horario de mañana.", None), ("Es necesario el reporte", None),
                        ("El sábado vamos al cine.", None), ("Oye, ya mandaste la cuota de copel.", None)]:
        assert llamado(t) == esperado, (t, llamado(t))
    assert sin_palabra("Anota que mañana reviso") == "Anota que mañana reviso"
    assert sin_palabra("GB Saurio, ¿qué pendientes tengo?") == "qué pendientes tengo"
    print("ok")
