"""Voz de Saurio: te escucha cuando presionas 🎤 y te contesta hablando.

- Oído: graba SOLO tu micrófono mientras hablas y se detiene solo cuando te callas.
  Transcribe en tu laptop con faster-whisper (el audio nunca sale de la laptop y no se guarda).
- Boca: lee la respuesta con la voz en español de Windows (sin internet, sin costo).
"""
import base64
import re
import subprocess
import sys
import threading

TASA = 16000
MAX_SEGUNDOS = 40        # tope por si nunca te callas
SILENCIO_FIN = 1.4       # segundos callado después de hablar = terminaste
SIN_HABLAR_MAX = 7       # si en 7 s no dijiste nada, deja de escuchar
VOCABULARIO = ("Saurio, Benber, pendientes, Coppel, Elektra, Suburbia, Cimaco, Movistar, "
               "Telefónica, Power BI, Excel, cuota, minuta, reunión.")

_modelo = None
_candado_modelo = threading.Lock()


def puede_oir():
    import reuniones
    return reuniones.disponible()


def _cargar_modelo(nombre):
    """Whisper tarda unos segundos en cargar: se carga una vez y se reusa."""
    global _modelo
    with _candado_modelo:
        if _modelo is None or _modelo[0] != nombre:
            from faster_whisper import WhisperModel
            _modelo = (nombre, WhisperModel(nombre, device="cpu", compute_type="int8"))
        return _modelo[1]


def transcribir(audio, modelo="small"):
    if audio is None or len(audio) < TASA * 0.4:
        return ""
    segmentos, _ = _cargar_modelo(modelo).transcribe(
        audio, language="es", vad_filter=True, beam_size=1, initial_prompt=VOCABULARIO)
    return " ".join(s.text.strip() for s in segmentos).strip()


class Oido:
    """Micrófono en modo 'presiona y habla'. Llama a al_terminar(audio) cuando te callas o presionas otra vez."""

    def __init__(self):
        self.stream = None
        self.pa = None
        self.candado = threading.Lock()

    @property
    def activo(self):
        return self.stream is not None

    def iniciar(self, al_terminar, modelo="small"):
        import numpy as np
        import pyaudiowpatch as pyaudio
        self.np = np
        self.al_terminar = al_terminar
        self.trozos = []
        self.hablo = False
        self.callado = 0.0
        self.total = 0.0
        self.piso = None
        self.pa = pyaudio.PyAudio()
        wasapi = self.pa.get_host_api_info_by_type(pyaudio.paWASAPI)
        mic = self.pa.get_device_info_by_index(wasapi["defaultInputDevice"])
        self.canales = max(1, int(mic["maxInputChannels"]))
        self.tasa = int(mic["defaultSampleRate"])
        self.stream = self.pa.open(format=pyaudio.paInt16, channels=self.canales, rate=self.tasa, input=True,
                                   input_device_index=mic["index"], frames_per_buffer=1024,
                                   stream_callback=self._cb)
        # mientras hablas, Whisper se va cargando
        threading.Thread(target=_cargar_modelo, args=(modelo,), daemon=True).start()

    def _cb(self, datos, frames, tiempo, estado):
        import pyaudiowpatch as pyaudio
        np = self.np
        x = np.frombuffer(datos, dtype=np.int16).astype(np.float32).reshape(-1, self.canales).mean(axis=1)
        self.trozos.append(x)
        dur = len(x) / self.tasa
        self.total += dur
        volumen = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0
        if self.piso is None or self.total < 0.3:  # ruido del cuarto
            self.piso = volumen if self.piso is None else min(self.piso, volumen)
        umbral = max(500.0, (self.piso or 0) * 3)
        if volumen > umbral:
            self.hablo, self.callado = True, 0.0
        else:
            self.callado += dur
        fin = ((self.hablo and self.callado > SILENCIO_FIN) or self.total > MAX_SEGUNDOS
               or (not self.hablo and self.total > SIN_HABLAR_MAX))
        if fin:
            threading.Thread(target=self.terminar, daemon=True).start()
            return (None, pyaudio.paComplete)
        return (None, pyaudio.paContinue)

    def terminar(self):
        """Cierra el micrófono y entrega el audio (16 kHz mono, -1..1). Seguro de llamar dos veces."""
        with self.candado:
            if not self.stream:
                return
            stream, self.stream = self.stream, None
            try:
                stream.stop_stream()
                stream.close()
            finally:
                self.pa.terminate()
                self.pa = None
        np = self.np
        audio = None
        if self.hablo and self.trozos:
            x = np.concatenate(self.trozos)
            n = int(len(x) * TASA / self.tasa)
            audio = (np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x) / 32768).astype(np.float32)
        self.trozos = []
        self.al_terminar(audio)


# ---------- boca ----------
_PS = r"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$v = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'es*' } |
     Sort-Object { $_.VoiceInfo.Culture.Name -ne 'es-MX' } | Select-Object -First 1
if (-not $v) { exit 3 }
$s.SelectVoice($v.VoiceInfo.Name)
$s.Rate = __VELOCIDAD__
$s.Speak([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__TEXTO__')))
"""


def para_leer(texto, limite=450):
    """Lo que tiene sentido decir en voz alta: sin código, sin markdown, sin emojis, y corto."""
    t = re.sub(r"```.*?```", " Te dejé el código en el chat. ", texto, flags=re.S)
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
    def __init__(self, velocidad=1):
        self.proc = None
        self.velocidad = int(velocidad)
        self.turno = 0

    def decir(self, texto, al_terminar, sin_voz=None):
        """Habla en segundo plano. al_terminar() solo se llama si nadie lo calló antes."""
        self.callar()
        if sys.platform != "win32":
            return False
        t = para_leer(texto)
        if not t:
            return False
        script = (_PS.replace("__VELOCIDAD__", str(max(-10, min(10, self.velocidad))))
                  .replace("__TEXTO__", base64.b64encode(t.encode("utf-8")).decode("ascii")))
        self.turno += 1
        turno = self.turno
        self.proc = subprocess.Popen(
            ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand",
             base64.b64encode(script.encode("utf-16-le")).decode("ascii")],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=0x08000000)

        def esperar(proc):
            codigo = proc.wait()
            if turno != self.turno:
                return  # lo callaron o empezó otra frase
            if codigo == 3 and sin_voz:
                sin_voz()
            al_terminar()
        threading.Thread(target=esperar, args=(self.proc,), daemon=True).start()
        return True

    def callar(self):
        self.turno += 1
        if self.proc and self.proc.poll() is None:
            self.proc.kill()
        self.proc = None
