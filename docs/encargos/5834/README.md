# #5834 · NEXT STEP preview · Mac Studio

ES: Preview de rama, sin merge ni publicación en producción. Conserva borradores e historial; siete composiciones y trece salidas. Ciclo iniciar/pausar/reanudar/reiniciar/detener verificado en ES/EN, con órdenes desconocidas sin efecto. Abrir el gemelo inicia otro reloj de sesión; no se promete sincronización entre pestañas ni hardware.

EN: Branch preview, without merge or production publication. Drafts/history retained; seven compositions and thirteen outputs. ES/EN start/pause/resume/restart/stop checked; unknown commands have no effect. Opening the twin starts a separate session clock; cross-tab and physical player synchronisation are not claimed.

## Local review / Revisión local

- Studio: http://127.0.0.1:8481/creador/?lang=es → Experto `/demo`.
- Campaign: http://127.0.0.1:8481/campanas/next-step/?lang=en .
- Twin: http://127.0.0.1:8482/xpacios/sneakerstore/?campaign=next-step&view=jordan&lang=es .
- MCP help preview: http://127.0.0.1:8483/mcp → `help({topic:"next-step"})`.

Run `python3 scripts/next-step-preview.py --port 8481 --session-fixture` in Pixeria; run `python3 -m http.server 8482 --bind 127.0.0.1` in admira-store; run `npx wrangler@4 dev --local --port 8483 --ip 127.0.0.1` in xpaceos-mcp. The session fixture belongs only to the loopback development server; existing production authentication is unchanged.

## Evidence / Evidencia

`preview-campaign-en.png`: real Chrome window capture, with local URL, English controls and seven installation tabs. Twin captures are in admira-store `admira-xp/docs/encargos/5834/`.

`media-verification.json`: all thirteen delivered MP4 files checked with ffprobe: declared native width/height, 25 fps, 32 seconds, no audio.

Pages previews are created only by `next-step-preview.yml` on the exact #5834 branch. It rejects the production branch and compares the canonical production deployment ID before and after publication. Existing auth/Functions remain in the package. The Pixeria PR stacks on #4663 to keep that pending work separate; no #4663 or #5125 branch is merged.

Pending / Pendiente: read `encargo_estado(5834)` and `encargo_estado(5412)` once the Studio's Admira.live MCP connection is available. No MCP credential was present in this session; unauthenticated requests were refused. This record does not mark the assignment done. XpaceOS help changes remain on their own branch and local Worker preview; the production MCP is not deployed.
