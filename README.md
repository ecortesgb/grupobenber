# GB Dashboards

Dashboards internos de Grupo Benber (Avance GB, RRHH). Publicados via GitHub Pages.

## Centro de Mando Pospago
Cobranza, calidad y activaciones pospago. Se genera y publica a mano con `actualizar_ahora.bat` cuando llega información nueva de altas (cifrado): `https://ecortesgb.github.io/grupobenber/pospago/`.
Código y guía de instalación en [`centro-mando-pospago/`](centro-mando-pospago/LEEME.md). Para instalar con Claude Code: *"instala el centro de mando pospago"*.

## Avance GB
Se genera en la PC con `avance-src/build_dashboard.py` y se publica en `https://ecortesgb.github.io/grupobenber/` **cifrado con contraseña** (AES-GCM, comprimido).
La contraseña va en `avance-src/config.json` (`{"clave": "..."}`, ver `config.ejemplo.json`), que **no se sube** (.gitignore). Sin ese archivo el script no genera nada.

