"""Arma los cuadros "a media zancada" (piernas juntas) para que la caminata de perfil se vea completa.

Toma el torso de camina_d1 / camina_i1 y le pone las piernas juntas de mira_d / mira_i, alineadas al cinturón.
Resultado: ui/sprites/cuadros/camina_d0.webp y camina_i0.webp.
Uso:  py -3 herramientas\\hacer_paso.py      Requiere: pip install pillow numpy
"""
import sys
import numpy as np
from PIL import Image
from pathlib import Path
D = OUT = str(Path(__file__).resolve().parent.parent / "ui" / "sprites" / "cuadros")
if len(sys.argv) > 2: D, OUT = sys.argv[1], sys.argv[2]
def load(n): return np.array(Image.open(f"{D}/{n}.webp").convert("RGBA")).astype(np.int32)
def cinturon(a):
    oscuro=(a[...,3]>200)&(a[...,:3].max(-1)<70)
    for y in range(80,a.shape[0]):
        xs=np.nonzero(oscuro[y])[0]
        if len(xs)>25: return y, (xs.min()+xs.max())/2, xs.max()-xs.min()
def naranja(a): r,g,b=a[...,0],a[...,1],a[...,2]; return (a[...,3]>30)&(r>170)&(g>60)&(g<190)&(b<90)
def paso(arriba_n, piernas_n):
    A=load(arriba_n); P=load(piernas_n)
    ya,xa,wa=cinturon(A); yp,xp,wp=cinturon(P)
    H,W=A.shape[:2]; out=np.zeros_like(A)
    corte=ya+6
    out[:corte]=A[:corte]
    dx=int(round(xa-xp)); dy=ya-yp
    # piernas juntas: solo la columna del pantalón y los pies de la pose parada (sin sus manos)
    x0,x1=int(xp-wp*0.62),int(xp+wp*0.62)
    for y in range(corte,H):
        ys=y-dy
        if not 0<=ys<H: continue
        for x in range(x0,x1+1):
            xd=x+dx
            if 0<=xd<W and P[ys,x,3]>0: out[y,xd]=P[ys,x]
    # manos, cola y orillas de la zancada que caen debajo del corte: se respetan
    mano=naranja(A); mano[:corte]=False
    trasera = (np.arange(W) < xa-wa*0.5) if arriba_n.startswith("camina_d") else (np.arange(W) > xa+wa*0.5)
    alto_manos = np.zeros(H,bool); alto_manos[corte:corte+40]=True
    sel = mano & (alto_manos[:,None] | trasera[None,:]) & (out[...,3]<250)
    out[sel]=A[sel]
    # quita motitas sueltas: solo se queda la figura más grande
    from collections import deque
    m=out[...,3]>20; visto=np.zeros_like(m); mejor=[]
    for y0,x0 in zip(*np.nonzero(m)):
        if visto[y0,x0]: continue
        q=deque([(y0,x0)]); visto[y0,x0]=True; comp=[]
        while q:
            y,x=q.popleft(); comp.append((y,x))
            for ny,nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
                if 0<=ny<H and 0<=nx<W and m[ny,nx] and not visto[ny,nx]: visto[ny,nx]=True; q.append((ny,nx))
        if len(comp)>len(mejor): mejor=comp
    keep=np.zeros_like(m); ys,xs=zip(*mejor); keep[list(ys),list(xs)]=True
    # conserva la orilla suave pegada a la figura
    cerca=keep.copy(); cerca[1:]|=keep[:-1]; cerca[:-1]|=keep[1:]; cerca[:,1:]|=keep[:,:-1]; cerca[:,:-1]|=keep[:,1:]
    out[~cerca,3]=0
    return out.astype(np.uint8)
for nom,arr,pi in [("camina_d0","camina_d1","mira_d"),("camina_i0","camina_i1","mira_i")]:
    Image.fromarray(paso(arr,pi)).save(f"{OUT}/{nom}.webp","WEBP",lossless=True)
