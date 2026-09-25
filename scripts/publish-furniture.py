"""Idempotent Stock publication of exported GLBs and individual render posters."""
import pathlib,json,base64,urllib.request,hashlib,concurrent.futures,threading,sys
out=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/Users/csilvasantin/Claude/furniture-4376');repo=pathlib.Path(__file__).resolve().parents[1]
target=repo/'assets/furniture/catalog.json'
items=json.loads(target.read_text()) if target.exists() else []
lock=threading.Lock()
def publish(row):
 slug=row['slug']
 data=(out/(row['file']+'.glb')).read_bytes();meta={k:row[k] for k in ['schema','slug','xpace','inventoryIds','quantity','dimensionsCm','baseLocal']}
 payload={'type':'furni','mime':'model/gltf-binary','motor':'Blender · TrinityMacMini','base64':base64.b64encode(data).decode(),'poster':'data:image/jpeg;base64,'+base64.b64encode((out/(row['file']+'.jpg')).read_bytes()).decode(),'title':slug.title()+' · '+row['title'],'tags':['3d','mueble',slug],'quality':'better','externalRef':'furniture:'+row['xpace']+':'+row['inventoryIds'][0],'prompt':json.dumps(meta,separators=(',',':')),'comment':'Mueble individual. Cantidad: '+str(row['quantity'])+'. Inventario #4375: '+', '.join(row['inventoryIds']),'contentHash':hashlib.sha256(data).hexdigest()}
 req=urllib.request.Request('https://api.admira.store/stock/publish',data=json.dumps(payload).encode(),headers={'User-Agent':'Mozilla/5.0','Content-Type':'application/json','Origin':'https://www.pixeria.com'})
 r=json.load(urllib.request.urlopen(req,timeout=180));assert r.get('id'),r
 item={**row,**r,'title':payload['title'],'type':'furni','mime':'model/gltf-binary','tags':payload['tags'],'prompt':payload['prompt'],'externalRef':payload['externalRef']};item['url']='https://api.admira.store/stock/asset/'+r['id'];item['poster']='https://api.admira.store/stock/poster/'+r['id']
 req=urllib.request.Request(item['url'],headers={'User-Agent':'Mozilla/5.0'});download=urllib.request.urlopen(req,timeout=60).read();assert hashlib.sha256(download).digest()==hashlib.sha256(data).digest()
 item['sha256']=hashlib.sha256(data).hexdigest()
 with lock:
  items.append(item);target.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n');print(row['file'],r['id'],flush=True)
rows=[row for slug in ['alsea','xtanco'] for row in json.loads((out/(slug+'-export.json')).read_text()) if not any(i['file']==row['file'] for i in items)]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for result in pool.map(publish,rows): pass
