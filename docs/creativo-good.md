# Recrear vídeo con GOOD local

GOOD usa Wan 2.1 VACE 1.3B mediante el flujo nativo de outpainting de ComfyUI. Genera vídeo en las zonas enmascaradas de todos los fotogramas; no usa una imagen fija como fondo. La recreación de imagen conserva su motor separado.

Primera etapa: primeros 3 segundos, 854 × 480 px horizontal o 480 × 854 px vertical. Muestreo temporal de 49 fotogramas a 16 fps, 20 pasos; exportación a 25 fps, original central superpuesto y audio original copiado sin generar ni cambiar la música. El lienzo interno de la IA es 864 × 480 (o 480 × 864); se recortan 5 píxeles por cada extremo externo para entregar 480p. No se recorta el original.

## Instalación validada

- ComfyUI oficial: `6607f36b53c7b695b160ac5b52d595e9e3752a2d`.
- Python 3.12, PyTorch con MPS; entorno virtual separado. Consultar el manifiesto local para versiones exactas.
- Pesos oficiales Comfy-Org / Wan 2.1: `wan2.1_vace_1.3B_fp16.safetensors`, `umt5_xxl_fp16.safetensors`, `wan_2.1_vae.safetensors` (unos 16 GB en total). No se suben al repositorio.
- ComfyUI escucha en `127.0.0.1:8189`, sin nodos de pago ni extensiones; el puente escucha en `127.0.0.1:6385`.
- `tools/creativo-good/install-local.py <directorio GOOD>` instala los lanzadores del usuario actual después de instalar el entorno y los pesos. Para detenerlos se utiliza `launchctl bootout` sobre sus dos plist de `~/Library/LaunchAgents`.

El Creativo solicita `/health` para enlazar con el puente. Chrome puede pedir permiso para acceder al servicio local. La pareja permanece en memoria, no se publica una clave en JavaScript. El puente valida Host, Origin y cabecera de sesión; solo admite Studio y los dos puertos locales de verificación. No acepta URLs ni rutas de archivo del cliente. No se expone a la red ni abre túneles.

## Recuperación

El identificador incluye hash de los bytes originales, motor/version, orientación y ajustes de la prueba. La petición se reclama una sola vez, se guarda antes de enviarla a ComfyUI y no se reenvía ante una respuesta incierta. Al recargar, el Creativo consulta el mismo identificador. Una desconexión deja la observación pendiente y conserva el original. No vuelve a generar ni a publicar en Stock automáticamente.

Las pruebas anteriores de fondo fijo conservan sus resultados y se identifican como tales. Las nuevas órdenes `/recrear video horizontal|vertical` tienen otro identificador y nunca utilizan la API de imagen.

GOOD necesita este Mac encendido. No hay consumo de créditos de un proveedor; el cálculo utiliza el equipo local. BETTER y BEST quedan pendientes y no existe sustitución automática por un motor de pago.
