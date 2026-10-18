#!/usr/bin/env python3
"""Loopback-only bridge for Creativo GOOD. Persistent, content-addressed jobs.
Only explicitly allowed Studio origins can pair, submit and retrieve media.
No provider API keys or paid network operations are used.
"""
import asyncio,hashlib,json,os,secrets,time,uuid,math,subprocess
from pathlib import Path
from aiohttp import web,ClientSession,ClientTimeout
import imageio_ffmpeg
from workflow import workflow,VERSION,MODEL,ENCODER,VAE,FPS,FRAMES
ROOT=Path(os.environ['CREATIVO_GOOD_HOME']).resolve()
COMFY='http://127.0.0.1:8189'
PORT=6385
ORIGINS={'https://admira.studio','https://www.admira.studio','http://127.0.0.1:6382','http://127.0.0.1:6384'}
TOKEN=secrets.token_urlsafe(32)
FF=imageio_ffmpeg.get_ffmpeg_exe()
JOBS=ROOT/'jobs';INPUT=ROOT/'input';OUTPUT=ROOT/'output'
for p in [JOBS,INPUT,OUTPUT]:p.mkdir(parents=True,exist_ok=True)
lock=asyncio.Lock();tasks=set()

def read_job(key):
 if len(key)!=64 or any(c not in 'abcdef0123456789' for c in key):raise web.HTTPNotFound()
 p=JOBS/key/'job.json'
 if not p.exists():raise web.HTTPNotFound()
 return json.loads(p.read_text())
def save_job(job,**fields):
 job.update(fields,updatedAt=time.time());p=JOBS/job['id']/'job.json';p.parent.mkdir(exist_ok=True)
 temp=p.with_suffix('.tmp');temp.write_text(json.dumps(job,indent=2));temp.replace(p)
 return job

def public(job):return {k:v for k,v in job.items() if k not in {'original','errorDetail'}}|{'elapsedSeconds':round(job.get('completedAt',time.time())-job['createdAt'],1),'remainingSeconds':job.get('samplingRemainingSeconds'),'tier':'GOOD','model':'Wan 2.1 VACE 1.3B','local':True}

@web.middleware
async def access(request,handler):
 if request.host not in {f'127.0.0.1:{PORT}',f'localhost:{PORT}'}:raise web.HTTPForbidden()
 origin=request.headers.get('Origin')
 if origin not in ORIGINS:raise web.HTTPForbidden(text='Studio origin required')
 headers={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Private-Network':'true'}
 if request.method=='OPTIONS':
  response=web.Response(headers={'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Creativo-Good','Access-Control-Max-Age':'600'})
 else:
  if request.path!='/health' and not secrets.compare_digest(request.headers.get('X-Creativo-Good',''),TOKEN):raise web.HTTPForbidden()
  try:response=await handler(request)
  except web.HTTPException as e:response=e
 response.headers.update(headers);return response

async def health(request):
 ready=all((ROOT/'models'/folder/file).exists() for folder,file in [('diffusion_models',MODEL),('text_encoders',ENCODER),('vae',VAE)])
 try:
  async with ClientSession(timeout=ClientTimeout(total=3)) as s:
   async with s.get(COMFY+'/system_stats') as r:engine=r.status==200
 except Exception:engine=False
 return web.json_response({'ok':ready and engine,'token':TOKEN,'engine':VERSION,'limits':{'seconds':3,'height':480,'width':854},'message':'GOOD local · prueba de 3 segundos · 480p'})

async def ffmpeg(*args):
 process=await asyncio.create_subprocess_exec(FF,'-hide_banner','-loglevel','error','-y',*map(str,args),stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
 _,err=await process.communicate()
 if process.returncode:raise RuntimeError('ffmpeg: '+err.decode()[-2000:])

async def prepare(job):
 p=JOBS/job['id'];original=p/'original.mp4'
 # Keep original aspect and every edge, use even pixels for H264 and VAE.
 import av
 with av.open(str(original)) as media:
  streams=media.streams.video
  if not streams:raise RuntimeError('No video stream')
  src=streams[0];w,h=src.width,src.height
  duration=float(src.duration*src.time_base) if src.duration else float(media.duration/av.time_base)
  if duration<3:raise RuntimeError('La prueba necesita al menos 3 segundos de vídeo.')
  audio=bool(media.streams.audio)
 if w*h>64000000:raise RuntimeError('Source too large')
 W,H=(864,480) if job['orientation']=='horizontal' else (480,864)
 factor=min(W/w,H/h);sw=max(2,round(w*factor/2)*2);sh=max(2,round(h*factor/2)*2)
 if sw==W and sh==H:raise RuntimeError('El vídeo ya tiene el formato solicitado.')
 left=(W-sw)//2;top=(H-sh)//2
 filename=job['id']+'.mp4'
 await ffmpeg('-i',original,'-an','-vf',f'scale={sw}:{sh},fps={FPS}','-frames:v',FRAMES,'-c:v','libx264','-crf','15','-pix_fmt','yuv420p',INPUT/filename)
 graph=workflow(filename,W,H,left,top,W-sw-left,H-sh-top,'good/'+job['id'])
 (p/'workflow.json').write_text(json.dumps(graph,indent=2))
 save_job(job,width=854 if W>H else 480,height=480 if W>H else 854,duration=3,sourceWidth=w,sourceHeight=h,sourceRect={'x':left,'y':top,'width':sw,'height':sh},audioOriginal=audio,modelWidth=W,modelHeight=H)
 return graph

async def finish(job,record):
 outputs=record.get('outputs',{});files=[]
 for output in outputs.values():
  for value in output.values():
   if isinstance(value,list):files.extend(x for x in value if isinstance(x,dict) and x.get('filename','').endswith('.mp4'))
 if not files:raise RuntimeError('Comfy did not return a video')
 item=files[-1];generated=(OUTPUT/item.get('subfolder','')/item['filename']).resolve()
 if not generated.is_relative_to(OUTPUT):raise RuntimeError('Invalid output path')
 save_job(job,state='muxing',phase='Conservando el original y su audio')
 # Compose the untouched moving source over generated frames, then trim exactly.
 p=JOBS/job['id'];rect=job['sourceRect'];W=job['modelWidth'];H=job['modelHeight'];fw=job['width'];fh=job['height'];cx=(W-fw)//2;cy=(H-fh)//2
 filt=f"[0:v]crop={fw}:{fh}:{cx}:{cy},setsar=1[bg];[1:v]scale={rect['width']}:{rect['height']},setsar=1[original];[bg][original]overlay={rect['x']-cx}:{rect['y']-cy}:shortest=1,fps=25,format=yuv420p[v]"
 await ffmpeg('-i',generated,'-i',p/'original.mp4','-filter_complex',filt,'-map','[v]','-map','1:a?','-t','3','-c:v','libx264','-crf','18','-c:a','copy','-movflags','+faststart',p/'result.mp4')
 save_job(job,state='complete',phase='Resultado listo',samplingRemainingSeconds=0,completedAt=time.time(),size=(p/'result.mp4').stat().st_size)

async def execute(job,resume=False):
 async with lock:
  try:
   async with ClientSession(timeout=ClientTimeout(total=30)) as s:
    if not resume:
     save_job(job,state='preparing',phase='Preparando 3 segundos del original')
     graph=await prepare(job)
     # Persist intent BEFORE POST. Unknown submissions are never automatically replayed.
     prompt_id=str(uuid.uuid5(uuid.NAMESPACE_URL,VERSION+job['id']))
     save_job(job,state='submitting',phase='Cargando GOOD',promptId=prompt_id)
     async with s.post(COMFY+'/prompt',json={'prompt':graph,'prompt_id':prompt_id,'client_id':'creativo-good'}) as r:
      data=await r.json()
      if r.status!=200:raise RuntimeError('Workflow rejected: '+json.dumps(data)[:2500])
     save_job(job,state='generating',phase='Generando los laterales con movimiento')
    async with s.ws_connect(COMFY+'/ws?clientId=creativo-good') as ws:
     while True:
      async with s.get(COMFY+'/history/'+job['promptId']) as r:record=(await r.json()).get(job['promptId'])
      if record:
       if record.get('status',{}).get('status_str')=='error':raise RuntimeError(json.dumps(record.get('status'))[:4000])
       if record.get('status',{}).get('completed'):
        (JOBS/job['id']/'comfy-history.json').write_text(json.dumps(record,indent=2));await finish(job,record);break
      if resume:
       async with s.get(COMFY+'/queue') as r:queue=await r.json()
       queued=any(x[1]==job['promptId'] for kind in ['queue_running','queue_pending'] for x in queue.get(kind,[]))
       if not queued:raise RuntimeError('La ejecución anterior se interrumpió. No se repetirá automáticamente.')
      try:
       msg=await asyncio.wait_for(ws.receive_json(),timeout=3)
       if msg.get('type')=='progress':
        value=msg['data'];now=time.time();first=job.get('samplingFirstStepAt',now);step=value.get('value',0);total=value.get('max',0);remaining=round((now-first)/(step-1)*(total-step)) if step>1 else None;save_job(job,step=step,steps=total,samplingFirstStepAt=first,samplingRemainingSeconds=remaining,phase='Generando los laterales con movimiento')
      except (asyncio.TimeoutError,TypeError,ValueError):pass
   # Release large weights after each job so the desktop recovers its memory.
   async with ClientSession() as s:
    await s.post(COMFY+'/free',json={'unload_models':True,'free_memory':True})
  except Exception as e:
   save_job(job,state='failed',phase='La prueba se ha detenido. El original está guardado.',errorDetail=str(e));print('GOOD failed:',job['id'],e,flush=True)

def schedule(job,resume=False):
 task=asyncio.create_task(execute(job,resume));tasks.add(task);task.add_done_callback(tasks.discard)

async def submit(request):
 orientation=request.query.get('orientation','horizontal')
 if orientation not in {'horizontal','vertical'}:raise web.HTTPBadRequest()
 blob=await request.read()
 if not blob:raise web.HTTPBadRequest()
 digest=hashlib.sha256(blob).hexdigest();key=hashlib.sha256((VERSION+digest+orientation+'0:3:480:20').encode()).hexdigest()
 try:job=read_job(key)
 except web.HTTPNotFound:
  if tasks:raise web.HTTPConflict(text='GOOD está ocupado. Espera a que termine la prueba actual.')
  p=JOBS/key;p.mkdir(exist_ok=True);(p/'original.mp4').write_bytes(blob)
  job={'id':key,'digest':digest,'orientation':orientation,'state':'queued','phase':'En cola','createdAt':time.time(),'engine':VERSION};save_job(job);schedule(job)
 return web.json_response(public(job))
async def status(request):return web.json_response(public(read_job(request.match_info['id'])))
async def result(request):
 job=read_job(request.match_info['id'])
 if job['state']!='complete':raise web.HTTPConflict()
 return web.FileResponse(JOBS/job['id']/'result.mp4',headers={'Content-Type':'video/mp4'})
async def startup(app):
 for path in JOBS.glob('*/job.json'):
  job=json.loads(path.read_text())
  if job['state'] in {'submitting','generating','muxing'} and job.get('promptId'):schedule(job,True)
  elif job['state'] in {'queued','preparing'}:save_job(job,state='failed',phase='Prueba interrumpida antes de generar. Original guardado.')
app=web.Application(middlewares=[access],client_max_size=100000000)
app.router.add_get('/health',health);app.router.add_post('/jobs',submit);app.router.add_get('/jobs/{id}',status);app.router.add_get('/jobs/{id}/result',result);app.router.add_route('OPTIONS','/{path:.*}',lambda r:web.Response())
app.on_startup.append(startup)
if __name__=='__main__':web.run_app(app,host='127.0.0.1',port=PORT,access_log=None)
