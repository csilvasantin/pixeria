# Pixeria

Pixeria is a static website for `pixeria.com`, positioned as a global reference for AI content creation.

**Mejoras recientes (junio 2026):**
- Nuevo hero cinematografico optimizado (242 KB vs 1.8 MB anterior)
- Navegacion movil completa (hamburger + overlay)
- Seccion "Modelos destacados" con recomendaciones concretas y editables
- Nueva seccion /labs/ como hub editorial de herramientas en produccion (Lanetro, Pixer Feed, Stream Deck Bridge).
- "Labs" en lugar de "Tool" + barra superior Pixeria oscura en /tool/ para que se sienta parte del sitio (el puente Lanetro/Yarig sigue intacto)
- Conexion real: Pixer Feed (el pipeline que empuja contenido IA a pantallas y directo en eventos Admira/Xtanco). Mencion en hero panel, intro, Pixeria Index y radar note.
- Micro-interacciones, hovers, active states en nav, focus visible
- JSON-LD, copy refinements, CTAs de newsletter, footer actualizado
- Mantiene diseno editorial oscuro premium, cero dependencias externas

## Local preview

Open `index.html` directly or serve the folder:

```bash
python3 -m http.server 9134
```

## Deploy

GitHub Pages deploys from `.github/workflows/pages.yml` on every push to `main`.

Para actualizar el radar de modelos edita directamente el bloque `.radar-live` en `index.html`.
