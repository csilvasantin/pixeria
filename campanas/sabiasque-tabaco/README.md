# Serie “¿Sabías que?” del tabaco — Xtanco

Mini-campaña de contenidos para las **pantallas de los Xtancos**, distribuida
automáticamente por el metatag **`sabiasqueXtanco`**.

Son **5 contenidos segmentados** que se muestran **en bucle**:

| # | Segmento | Titular |
|---|----------|---------|
| 1 | Género · **Hombre** | El estanco hereda un privilegio real de casi 400 años |
| 2 | Género · **Mujer**  | Las cigarreras de Sevilla inspiraron la Carmen de la ópera |
| 3 | Edad · **Joven**    | En el estanco hay mucho más que tabaco (servicios oficiales) |
| 4 | Edad · **Adulto**   | “Estanco” significa literalmente “monopolizado” |
| 5 | Edad · **Sénior**   | El estanco de barrio, de los comercios más longevos de España |

> Enfoque **responsable**: son curiosidades histórico-culturales del estanco.
> No incentivan el consumo; el contenido para el público joven se centra en los
> servicios del estanco (sellos, lotería, trámites), no en fumar.

## Archivos

- **`slide.html?i=N`** — motor de contenido. Cada `N` (1–5) es una pieza autónoma
  y direccionable. Lleva el metatag `pixer-tags = sabiasqueXtanco`.
- **`bucle.html`** — reproductor a pantalla completa que rota los 5 con crossfade
  (8 s cada uno). **Esto es lo que apunta la pantalla del Xtanco.**
- **`feed.json`** — manifiesto para la distribución automática (id, url, tag y
  segmento de cada pieza).

## Puesta en marcha

1. En la pantalla del Xtanco, abrir:
   `https://pixeria.com/campanas/sabiasque-tabaco/bucle.html`
2. La distribución automática selecciona esta campaña por su metatag
   `sabiasqueXtanco` en cualquier Xtanco de la red.

## Segmentación

Los segmentos (`genero`, `edad`) siguen el mismo esquema que
`pixeria.com/segmentados` (Omnypublicity / gemelo digital), de modo que cada
pieza puede servirse al circuito correspondiente además de en el bucle general.

## Editar / ampliar

Los textos viven en el array `CONTENTS` dentro de `slide.html`. Para añadir un
contenido nuevo: añade un objeto al array, súbelo en `feed.json` y sube `TOTAL`
en `bucle.html`.
