#!/usr/bin/env python3
"""Reproduce los cuatro archivos de muestra, localmente y sin APIs de IA."""
from pathlib import Path
import subprocess,json,hashlib
base=Path(__file__).resolve().parents[1]/'assets/demos/studio-v1'
source=base/'video-fuente.mp4'
formats=[('horizontal',1920,1080,'recortar'),('vertical',1080,1920,'recortar'),('cuadrado',1080,1080,'recortar'),('barra',1920,540,'contener')]
results=[]
for name,w,h,fit in formats:
 output=base/f'adaptado-{name}.mp4'
 vf=(f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1' if fit=='recortar' else f'scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-vf',vf,'-r','30','-c:v','libx264','-threads','2','-preset','fast','-crf','24','-profile:v','main','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',str(output)],check=True)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]))
 video=next(s for s in probe['streams'] if s['codec_type']=='video')
 assert (video['width'],video['height'],video['codec_name'],video['pix_fmt'])==(w,h,'h264','yuv420p')
 results.append({'nombre':name,'url':'/assets/demos/studio-v1/'+output.name,'ancho':w,'alto':h,'encaje':fit,'duracion':float(probe['format']['duration']),'fps':video['r_frame_rate'],'codec':video['codec_name'],'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
 (base/'adaptaciones-verificadas.json').write_text(json.dumps({'motor':'ffmpeg local','fuente':'/assets/demos/studio-v1/video-fuente.mp4','generacion_ia':False,'variantes':results},ensure_ascii=False,indent=2)+'\n')
 print(name,f'{w}x{h}',output.stat().st_size)
