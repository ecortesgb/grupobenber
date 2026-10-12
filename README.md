# GB Dashboards

Dashboards internos de Grupo Benber (Avance GB, RRHH). Publicados via GitHub Pages.

## Centro de Mando Pospago
Cobranza, calidad y activaciones pospago. Se genera y publica solo L–V 6:00 pm (cifrado): `https://ecortesgb.github.io/grupobenber/pospago/`.
Código y guía de instalación en [`centro-mando-pospago/`](centro-mando-pospago/LEEME.md). Para instalar con Claude Code: *"instala el centro de mando pospago"*.

## Skills para el equipo
Las skills de Claude viven en [`.claude/skills/`](.claude/skills/). Claude Code las carga solas al abrir este repo, y cualquiera puede instalarlas en otro proyecto o agente (Claude Code, Cursor, Codex, Copilot…) con el CLI [`skills`](https://github.com/vercel-labs/skills):

| Acción | Comando |
|---|---|
| Ver qué skills hay | `npx skills add ecortesgb/grupobenber -l` |
| Instalar todas en el proyecto actual | `npx skills add ecortesgb/grupobenber` |
| Instalar una sola | `npx skills add ecortesgb/grupobenber -s centro-mando-pospago` |
| Instalar para todos tus proyectos | agrega `-g` |
| Traer la última versión | `npx skills update` |
| Desinstalar | `npx skills remove centro-mando-pospago` |

En Windows, si falla el symlink, agrega `--copy`. Para no enviar telemetría: `set DISABLE_TELEMETRY=1`.

**Crear una skill nueva:** `npx skills init .claude/skills/<nombre>`. Esto crea un `SKILL.md`; llena `name` y `description` (la descripción es lo que hace que Claude la use), haz commit y push, y el equipo la recibe con `npx skills update`.
Reglas: una carpeta por skill, el nombre en minúsculas-con-guiones y **nada de claves ni datos sensibles** (el repo es público). Si una skill depende de archivos del repo (como `centro-mando-pospago`), dilo en el `SKILL.md`.
