"""Original deterministic PBR maps for Xtanco Best; no external texture downloads."""
from pathlib import Path
import hashlib,json,argparse
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',required=True,help='Best asset output directory; maps go in its textures subdirectory')
parser.add_argument('--font',required=True,help='Arial.ttf used for the recorded atlas, or an explicitly documented alternative')
args=parser.parse_args()
OUT=Path(args.output).resolve()/'textures';OUT.mkdir(parents=True,exist_ok=True)
font_path=str(Path(args.font).resolve())
rng=np.random.default_rng(436420261008)
def save(name,a):
    if a.ndim==2:a=np.repeat(a[...,None],3,axis=-1)
    im=Image.fromarray(np.clip(a*255,0,255).astype('uint8'))
    limit=512 if name.endswith('roughness') else 768 if name.endswith('normal') else 1536
    if max(im.size)>limit:im=im.resize((limit,limit),Image.Resampling.LANCZOS)
    im.save(OUT/(name+'.png'),optimize=True)
def normals(height,strength):
    gy,gx=np.gradient(height);v=np.stack([-gx*strength,-gy*strength,np.ones_like(gx)],axis=-1)
    v/=np.linalg.norm(v,axis=-1)[...,None];return v*.5+.5
n=1024;y,x=np.mgrid[0:n,0:n]/n
warp=y+.010*np.sin(x*17)+.004*np.sin(x*41+y*8)
grain=.55*np.sin(warp*940+3*np.sin(x*9))+.19*np.sin(warp*3100)+.09*np.sin(warp*5400)
pores=rng.normal(0,.07,(n,n));height=grain*.3+pores*.03
rgb=np.clip(np.array([176,138,90])[None,None,:]/255+(grain*.029+.013*np.sin(warp*195)+pores*.03)[...,None],0,1)
save('best-oak-color',rgb);save('best-oak-normal',normals(height,3.8));save('best-oak-roughness',np.clip(.51+grain*.07+pores*.08,.35,.67))
n=1024
base=Image.new('RGB',(n,n),(216,208,184));d=ImageDraw.Draw(base)
height_im=Image.new('L',(n,n),124);hd=ImageDraw.Draw(height_im)
rough_im=Image.new('L',(n,n),122);rd=ImageDraw.Draw(rough_im)
for k in range(24000):
    cx=int(rng.integers(n));cy=int(rng.integers(n));radius=float(rng.uniform(.7,7));sides=int(rng.integers(4,7))
    angles=np.linspace(0,np.pi*2,sides,endpoint=False)+rng.random()
    polygon=[(cx+np.cos(a)*radius*float(rng.uniform(.6,1.4)),cy+np.sin(a)*radius*float(rng.uniform(.6,1.4))) for a in angles]
    color=[(171,163,144),(190,181,159),(237,230,210),(209,198,174),(113,110,101)][k%5]
    d.polygon(polygon,fill=color);hd.polygon(polygon,fill=int(rng.integers(115,137)));rd.polygon(polygon,fill=int(rng.integers(68,103)))
base.save(OUT/'best-terrazzo-color.png',optimize=True)
save('best-terrazzo-normal',normals(np.asarray(height_im.filter(ImageFilter.GaussianBlur(.6)),dtype=float)/255,1.4))
rough=np.asarray(rough_im,dtype=float)/255+rng.normal(0,.005,(n,n));save('best-terrazzo-roughness',rough)
n=768;y,x=np.mgrid[0:n,0:n]/n
h=rng.normal(0,.05,(n,n))+.03*np.sin(x*140+y*121)
save('best-stucco-normal',normals(h,1.3));save('best-stucco-roughness',np.clip(.85+rng.normal(0,.025,(n,n)),.75,.95))
h=.10*np.sin(y*3200)+rng.normal(0,.025,(n,n))
save('best-metal-normal',normals(h,.9));save('best-metal-roughness',np.clip(.26+.04*np.sin(y*3200)+rng.normal(0,.005,(n,n)),.18,.35))
atlas=Image.new('RGB',(1536,512),(240,233,214));draw=ImageDraw.Draw(atlas)
font=ImageFont.truetype(font_path,34);small=ImageFont.truetype(font_path,20)
names=['SELECCIÓN','PAPEL','FILTROS','ACCESORIOS','RECARGAS','CLÁSICOS'];colors=['#30584a','#293e52','#8e5940','#737347','#a5533f','#695344']
for i,name in enumerate(names):
    xx=(i%3)*512;yy=(i//3)*256
    draw.rectangle((xx+10,yy+10,xx+502,yy+246),outline=colors[i],width=5)
    draw.rectangle((xx+10,yy+10,xx+502,yy+62),fill=colors[i]);draw.text((xx+28,yy+15),'SELECCIÓN',font=font,fill='#f0e9d6')
    draw.text((xx+26,yy+102),name,font=font,fill=colors[i]);draw.text((xx+26,yy+160),'REFERENCIA · %02d'%(i+1),font=small,fill=colors[i])
    for j in range(55):
        width=1+j%3;draw.rectangle((xx+312+j*3,yy+176,xx+312+j*3+width,yy+222),fill=colors[i])
atlas.save(OUT/'best-packaging-atlas.png',optimize=True)
json.dump({'generator':'original deterministic numpy/Pillow artwork','seed':436420261008,'maps':[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.glob('*.png'))],'license':'original procedural artwork authored for this project; no third-party texture assets','font_used_for_rasterization':font_path,'font_sha256':hashlib.sha256(Path(font_path).read_bytes()).hexdigest(),'labels':'Illustrative generic product references; not actual tobacco SKUs, no fabricated brands'},open(OUT/'provenance.json','w'),indent=2,ensure_ascii=False)
print('TEXTURES_READY',len(list(OUT.glob('*.png'))))
