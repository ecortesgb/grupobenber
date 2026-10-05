"""Grabación y transcripción local de reuniones.

Graba DOS fuentes a la vez: tu micrófono y lo que suena en la laptop (Teams/Zoom/Meet),
usando WASAPI loopback de Windows. Transcribe en tu PC con faster-whisper (el audio no sale de la laptop;
solo el texto se manda a Claude para hacer la minuta).
"""
import wave
from datetime import datetime

from datos import CARPETA_DATOS

TASA = 16000  # Whisper trabaja a 16 kHz mono


def disponible():
    try:
        import numpy  # noqa: F401
        import pyaudiowpatch  # noqa: F401
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


class _Fuente:
    """Una entrada de audio que se guarda como WAV 16 kHz mono en disco (no llena la RAM)."""

    def __init__(self, pa, info, ruta):
        import numpy as np
        import pyaudiowpatch as pyaudio
        self.np = np
        self.canales = max(1, int(info["maxInputChannels"]))
        self.tasa_origen = int(info["defaultSampleRate"])
        self.wav = wave.open(str(ruta), "wb")
        self.wav.setnchannels(1)
        self.wav.setsampwidth(2)
        self.wav.setframerate(TASA)
        self.stream = pa.open(format=pyaudio.paInt16, channels=self.canales, rate=self.tasa_origen,
                              input=True, input_device_index=info["index"],
                              frames_per_buffer=1024, stream_callback=self._cb)

    def _cb(self, datos, frames, tiempo, estado):
        import pyaudiowpatch as pyaudio
        np = self.np
        x = np.frombuffer(datos, dtype=np.int16).astype(np.float32)
        x = x.reshape(-1, self.canales).mean(axis=1)  # a mono
        n = int(len(x) * TASA / self.tasa_origen)
        if n > 0:
            x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)  # a 16 kHz
            self.wav.writeframes(x.astype(np.int16).tobytes())
        return (None, pyaudio.paContinue)

    def cerrar(self):
        self.stream.stop_stream()
        self.stream.close()
        self.wav.close()


class Grabadora:
    def __init__(self):
        self.fuentes = []
        self.pa = None
        self.carpeta = None

    @property
    def grabando(self):
        return bool(self.fuentes)

    def iniciar(self):
        import pyaudiowpatch as pyaudio
        self.pa = pyaudio.PyAudio()
        self.carpeta = CARPETA_DATOS / "reuniones" / datetime.now().strftime("%Y%m%d_%H%M")
        self.carpeta.mkdir(parents=True, exist_ok=True)
        wasapi = self.pa.get_host_api_info_by_type(pyaudio.paWASAPI)
        mic = self.pa.get_device_info_by_index(wasapi["defaultInputDevice"])
        self.fuentes.append(_Fuente(self.pa, mic, self.carpeta / "microfono.wav"))
        bocina = self.pa.get_device_info_by_index(wasapi["defaultOutputDevice"])
        loop = None
        if bocina.get("isLoopbackDevice"):
            loop = bocina
        else:
            for d in self.pa.get_loopback_device_info_generator():
                if bocina["name"] in d["name"]:
                    loop = d
                    break
        if loop:
            self.fuentes.append(_Fuente(self.pa, loop, self.carpeta / "sistema.wav"))
        return len(self.fuentes)

    def detener(self):
        for f in self.fuentes:
            f.cerrar()
        self.fuentes = []
        if self.pa:
            self.pa.terminate()
            self.pa = None
        return self.carpeta

    @staticmethod
    def transcribir(carpeta, modelo="small", al_avance=None):
        """Mezcla micrófono + sistema y transcribe. Devuelve el texto y lo guarda en transcripcion.txt."""
        import numpy as np
        from faster_whisper import WhisperModel

        pistas = []
        for nombre in ("microfono.wav", "sistema.wav"):
            ruta = carpeta / nombre
            if ruta.exists():
                with wave.open(str(ruta), "rb") as w:
                    pistas.append(np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768)
        if not pistas or max(len(p) for p in pistas) < TASA:
            return ""
        largo = max(len(p) for p in pistas)
        mezcla = np.zeros(largo, dtype=np.float32)
        for p in pistas:
            mezcla[:len(p)] += p
        mezcla = np.clip(mezcla, -1, 1)

        modelo_w = WhisperModel(modelo, device="cpu", compute_type="int8")
        segmentos, info = modelo_w.transcribe(mezcla, language="es", vad_filter=True)
        lineas = []
        for s in segmentos:
            m, seg = divmod(int(s.start), 60)
            lineas.append(f"[{m:02d}:{seg:02d}] {s.text.strip()}")
            if al_avance and info.duration:
                al_avance(min(99, int(s.end / info.duration * 100)))
        texto = "\n".join(lineas)
        (carpeta / "transcripcion.txt").write_text(texto, encoding="utf-8")
        return texto

