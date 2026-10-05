"""Recorta las poses del GB Saurio desde la hoja de referencia y les quita el fondo blanco.

Uso:  py -3 herramientas\\recortar_sprites.py ruta\\a\\gb_saurio_referencia.jpg
Genera los PNG transparentes en ui\\sprites\\. Si cambias la hoja, ajusta las cajas de RECORTES.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# nombre: (x1, y1, x2, y2) en la hoja de 944 x 1112 px
RECORTES = {
    "frente":      (292, 18, 668, 684),   # pulgar arriba, cuerpo completo
    "lado":        (8, 22, 298, 512),
    "espalda":     (48, 528, 308, 1028),
    "sorprendido": (722, 34, 912, 196),
    "preocupado":  (722, 214, 912, 366),
    "emocionado":  (722, 379, 912, 530),
    "saludo":      (722, 545, 912, 731),
    "senalar":     (336, 760, 612, 1016),
    "pensando":    (606, 785, 776, 1016),
    "oreja":       (782, 785, 914, 1016),
}
UMBRAL = 238  # más claro que esto y conectado al borde = fondo
HUECOS = {"oreja": 400}  # fondo atrapado (p. ej. entre mano y cabeza) mayor a N píxeles también se quita


def _regiones(mascara):
    """Etiqueta regiones conectadas (4 vecinos) de una máscara booleana."""
    h, w = mascara.shape
    etiqueta = np.zeros((h, w), np.int32)
    n = 0
    for y0, x0 in zip(*np.nonzero(mascara)):
        if etiqueta[y0, x0]:
            continue
        n += 1
        etiqueta[y0, x0] = n
        cola = deque([(y0, x0)])
        while cola:
            y, x = cola.popleft()
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mascara[ny, nx] and not etiqueta[ny, nx]:
                    etiqueta[ny, nx] = n
                    cola.append((ny, nx))
    return etiqueta, n


def quitar_fondo(img, hueco_min=None):
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    claro = (a.min(axis=2) >= UMBRAL)
    fondo = np.zeros((h, w), bool)
    cola = deque()
    for x in range(w):
        for y in (0, h - 1):
            if claro[y, x]:
                cola.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if claro[y, x]:
                cola.append((y, x))
    while cola:
        y, x = cola.popleft()
        if fondo[y, x] or not claro[y, x]:
            continue
        fondo[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not fondo[ny, nx] and claro[ny, nx]:
                cola.append((ny, nx))
    if hueco_min:
        etq, n = _regiones(claro & ~fondo)
        for i in range(1, n + 1):
            zona = etq == i
            if zona.sum() >= hueco_min:
                fondo |= zona
    # solo se queda el personaje (la pieza más grande); quita pedazos de poses vecinas
    etq, n = _regiones(~fondo)
    if n > 1:
        tamanos = np.bincount(etq.ravel())[1:]
        fondo = etq != (np.argmax(tamanos) + 1)
    alfa = Image.fromarray(np.where(fondo, 0, 255).astype(np.uint8))
    alfa = alfa.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))  # borde suave
    rgba = img.convert("RGBA")
    rgba.putalpha(alfa)
    return rgba.crop(rgba.getbbox())


def main(hoja, destino):
    hoja = Image.open(hoja)
    destino.mkdir(parents=True, exist_ok=True)
    for nombre, caja in RECORTES.items():
        quitar_fondo(hoja.crop(caja), HUECOS.get(nombre)).save(destino / f"{nombre}.png", optimize=True)
        print("ok", nombre)


if __name__ == "__main__":
    main(sys.argv[1], Path(__file__).resolve().parent.parent / "ui" / "sprites")
