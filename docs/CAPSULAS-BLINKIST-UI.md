# Cápsulas Blinkist · UI en Pixeria / Stock

Fecha: 2026-10-05 (Europe/Madrid)

## Qué hace este PR

Formulario **📚 Nueva cápsula** en `stock.html` (botón en la barra de filtros;
se abre solo al filtrar por Cápsulas). Publica `type: capsula` al Stock con el
mismo contrato que Cafebrería (`selectBooks` en `assets/xpaces/capsulas.mjs`).

| Campo UI | Stock |
|----------|-------|
| URL Blinkist (o título+autor) | `prompt` (URL canónica o `blinkist:manual:…`) |
| Tesis | `title` |
| Consejero + tema | `tags`: `formacion`, `<consejero>`, `<tema>`, `blinkist` + `quality: good` |
| PARA CARBONO (+ SILICIO/APLICACIÓN opcionales) | `comment` con bloques + `Fuente:` |
| Publicar | `POST https://api.admira.store/stock/publish` (texto; sin fichero) |

Código: `assets/capsula-publicar.mjs` (payload) · `app.js` (`publishToStock`
acepta capsula sin URL; `bindCapsulaForm`).

## Qué NO hace (a propósito)

- **No pide composición 9:16 / 16:9** en la UI. Eso sigue en
  `admira-next-web/tools/capsulas/capsula.sh <id> ~/capsulas/<slug> --publicar`.
- **No añade un botón “generar Grok Video”**. El worker `pixer-worker` puede
  seguir disparando `capsule-tiktok` en `waitUntil` si tiene
  `ADMIRANEXT_INGEST_TOKEN` (puente previo). El payload manda `skipVideo: true`
  como pista; el worker aún no lo honra — follow-up en `pixer-worker` si se
  quiere apagar el puente por request.

## Cómo probar

1. Abrir `https://www.pixeria.com/stock.html` (o preview del PR) con login Admira.
2. Pulsar **📚 Nueva cápsula** (o filtrar tipo Cápsulas).
3. Pegar una URL Blinkist, tesis, consejero, tema, PARA CARBONO → Publicar.
4. Filtrar Stock → Cápsulas: debe aparecer el texto.
5. Cafebrería / Xpace: tras refresco del índice (~5 min o al volver a la pestaña),
   `selectBooks` incluye la pieza si lleva tag `blinkist` o URL Blinkist.

Ensayo local del módulo (sin publicar):

```bash
node --test test/capsula-publicar.test.mjs capsulas.test.mjs
```

## Sync a admira.studio

Pixeria es la fuente; studio se sincroniza desde este repo.

Copiar (o dejar que el pipeline de sync traiga):

- `assets/capsula-publicar.mjs` (nuevo)
- `app.js` (publish texto + bind)
- `stock.html` (panel + toggle)
- `test/capsula-publicar.test.mjs`, `capsulas.test.mjs`
- este doc

No hace falta tocar `assets/xpaces/capsulas.mjs` en studio: el contrato de
lectura no cambia. Tras el deploy de pixeria, el índice vivo alimenta ambos.

## Pipeline de vídeo (aparte)

```
Stock type:capsula  →  (opcional) worker capsule-tiktok → clip 15s «bruto»
                    →  capsula.sh --publicar → 9:16 + 16:9 con externalRef capsula:<id>
```

Ver `/workspace/huang/store/CAPSULAS-CONOCIMIENTO-CAFEBRERIA.md` §3–4.
