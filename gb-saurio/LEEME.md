# GB Saurio · mascota 3D asistente

Un dinosaurio 3D que vive en la esquina de tu pantalla, siempre encima de las ventanas, conectado a Claude.
Haz clic en él para abrir el chat; arrástralo para moverlo. Ícono junto al reloj para ocultarlo o salir.

## Qué hace
| Función | Cómo |
|---|---|
| Chat con Claude | Le escribes lo que necesites: ideas, DAX, M, VBA, revisar procesos. |
| Pendientes con fecha compromiso | Dile "tengo que mandar X el viernes" y lo registra. Pestaña **Pendientes** para marcarlos hechos. Te avisa cada hora si algo vence hoy o ya venció. |
| Reporte de cumplimiento | Botón **Exportar a Excel**: tabla de pendientes + hoja Resumen (abiertos, vencidos, % cumplido en fecha). |
| Notas | "Anota que…" o "¿qué anoté sobre Elektra?". |
| Ordenar escritorio / descargas | Analiza la carpeta y **propone** un plan. Nada se mueve hasta que presionas **Aplicar**; **Deshacer** regresa todo. |
| Revisar código | "Revisa el archivo C:\…\medidas.dax y optimízalo" (lee .dax, .m, .sql, .bas, .py, .csv, .txt…). |
| Minutas de reuniones | Botón **Reunión** para grabar, otra vez para detener. Graba tu micrófono **y** el audio de Teams/Zoom, transcribe **en tu laptop** y Claude arma la minuta y te registra tus acuerdos como pendientes. |

## Instalar (una vez)
1. Ten Python 3.10 a 3.13 instalado (el mismo que usas con `py -3`).
2. Doble clic en `instalar.bat`. Se abre `config.json`: pega tu API key de Anthropic (console.anthropic.com → API Keys) y guarda.
3. Doble clic en `iniciar.bat`.
4. Opcional: `instalar_reuniones.bat` para las minutas (la primera transcripción descarga ~500 MB del modelo de voz).
5. Opcional: `iniciar_con_windows.bat` para que arranque solo al prender la laptop.

## Configuración (`config.json`)
| Campo | Para qué |
|---|---|
| `api_key` | Tu llave de Claude. También puede ir en la variable de entorno `ANTHROPIC_API_KEY`. **Nunca la subas al repo** (`config.json` está en `.gitignore`). |
| `modelo` | `claude-opus-5-5` (más capaz). Para gastar menos: `claude-sonnet-5-5`. |
| `esfuerzo` | `low`, `medium` o `high`: cuánto piensa antes de responder (más = mejor y más caro). |
| `carpetas_permitidas` | Las únicas carpetas que puede ver y ordenar. `ESCRITORIO`, `DOCUMENTOS` y `DESCARGAS` se ubican solas aunque estén en OneDrive. Puedes agregar rutas, p. ej. `"C:\\ARCHIVOS GB"`. |
| `modelo_transcripcion` | `small` (equilibrado), `base` (más rápido), `medium` (más preciso, más lento). |
| `recordatorio_minutos` | Cada cuánto revisa pendientes vencidos. |

## Dónde quedan tus datos
Todo en `%USERPROFILE%\GbSaurio\`: `saurio.db` (pendientes y notas), `planes\` (bitácora para deshacer), `reuniones\` (audio y transcripción), y los Excel exportados.
El audio nunca sale de la laptop; a Claude solo se le manda el texto.

## Cómo está hecho (simple)
- `saurio.py` abre una ventana transparente sin bordes y la conecta con la página `ui/`.
- `ui/mascota.js` muestra al GB Saurio en 2D con las poses recortadas de la hoja de referencia (`ui/sprites/`). Respira, habla, brinca y cambia de pose: piensa (mano en la barbilla), escucha (mano en la oreja), se sorprende, se preocupa si algo falla, saluda al darle clic y se pone de lado cuando lo arrastras.
- `herramientas/recortar_sprites.py` vuelve a generar las poses si cambias la hoja: `py -3 herramientas\recortar_sprites.py hoja.jpg` (requiere `pip install pillow numpy`).
- `asistente.py` platica con Claude y le da "herramientas": pendientes, notas, ver carpetas, leer archivos y proponer planes.
- `archivos.py` solo deja leer dentro de las carpetas permitidas; mover archivos solo ocurre con tu clic.
- `reuniones.py` graba con WASAPI de Windows y transcribe con faster-whisper.

## Limitaciones del prototipo
- Solo Windows (la grabación del audio del sistema usa WASAPI).
- La conversación se reinicia sola cuando se hace muy larga; pendientes y notas sí se conservan.
- Transcribir una reunión de 1 hora en CPU puede tardar 10–20 min.
- Avísales a los participantes cuando grabes una reunión.
