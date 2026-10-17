"""Quita los restos de fondo blanco de los cuadros de animación (ui/sprites/cuadros/*.webp).

Los cuadros vienen de imágenes con fondo blanco: entre las piernas, junto a la cola y bajo los pies
quedan manchas blancas que no se notan en una página blanca pero sí sobre un escritorio oscuro.
Regla: toda mancha blanca que empiece debajo del cinturón (de la mitad para abajo) es fondo, porque
ahí Saurio solo tiene pantalón negro, piel naranja y garras. La camisa y la gorra quedan intactas.

Uso:  py -3 herramientas\\limpiar_cuadros.py            (limpia todos los cuadros en su lugar)
Requiere: pip install pillow numpy
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

CARPETA = Path(__file__).resolve().parent.parent / "ui" / "sprites" / "cuadros"
CLARO = 200        # qué tan claro debe ser un pixel para considerarlo "blanco"
INICIO = 0.55      # una mancha que empieza debajo de esta altura (fracción) es fondo
AJUSTES = {"escribe": 0.78}  # sentado: la camisa queda más abajo
MOTA = 150         # pedazos sueltos más chicos que esto (pixeles) se borran


def manchas(mascara):
    """Componentes conectados (4 vecinos) de una máscara booleana."""
    alto, ancho = mascara.shape
    visto = np.zeros_like(mascara)
    for y0, x0 in zip(*np.nonzero(mascara)):
        if visto[y0, x0]:
            continue
        cola, pixeles = deque([(y0, x0)]), []
        visto[y0, x0] = True
        while cola:
            y, x = cola.popleft()
            pixeles.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < alto and 0 <= nx < ancho and mascara[ny, nx] and not visto[ny, nx]:
                    visto[ny, nx] = True
                    cola.append((ny, nx))
        yield pixeles


def limpiar(ruta):
    im = np.array(Image.open(ruta).convert("RGBA"))
    rgb, alfa = im[..., :3].astype(int), im[..., 3]
    alto = im.shape[0]
    inicio = AJUSTES.get(ruta.stem, INICIO)
    blanco = (rgb.min(-1) > CLARO) & (rgb.max(-1) - rgb.min(-1) < 45) & (alfa > 0)
    quitar = np.zeros_like(blanco)
    for pix in manchas(blanco):
        if min(y for y, _ in pix) > alto * inicio:
            ys, xs = zip(*pix)
            quitar[list(ys), list(xs)] = True
    # orilla: pixeles claros pegados a lo que se quitó (el "halo" gris del recorte)
    orilla = np.zeros_like(quitar)
    orilla[1:] |= quitar[:-1]; orilla[:-1] |= quitar[1:]
    orilla[:, 1:] |= quitar[:, :-1]; orilla[:, :-1] |= quitar[:, 1:]
    orilla &= (rgb.min(-1) > 165) & (rgb.max(-1) - rgb.min(-1) < 60)
    # semitransparentes claros abajo (sombra del piso mal recortada)
    abajo = np.zeros_like(quitar); abajo[int(alto * inicio):] = True
    sombra = abajo & (alfa < 200) & (rgb.min(-1) > 150)
    total = quitar | orilla | sombra
    # motitas sueltas: pedacitos de fondo que quedaron flotando lejos del cuerpo
    for pix in manchas((alfa > 20) & ~total):
        if len(pix) < MOTA:
            ys, xs = zip(*pix)
            total[list(ys), list(xs)] = True
    im[total, 3] = 0
    Image.fromarray(im).save(ruta, "WEBP", lossless=True)
    return int(total.sum())


if __name__ == "__main__":
    carpeta = Path(sys.argv[1]) if len(sys.argv) > 1 else CARPETA
    for r in sorted(carpeta.glob("*.webp")):
        print(f"{r.name}: {limpiar(r)} pixeles de fondo quitados")
