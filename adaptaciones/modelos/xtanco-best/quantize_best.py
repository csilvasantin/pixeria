"""Loss-minimized glTF KHR_mesh_quantization for normal/tangent only.

No position, UV, texture, index, scene transform or physical dimension changes.
The existing bundled r160 GLTFLoader handles this standard extension directly.
"""
import json,struct
from pathlib import Path
import numpy as np

def quantize_normals(path,output=None):
    path=Path(path);raw=path.read_bytes();n,t=struct.unpack_from('<II',raw,12)
    document=json.loads(raw[20:20+n]);off=20+n;length,typ=struct.unpack_from('<II',raw,off)
    assert typ==0x004e4942
    binary=raw[off+8:off+8+length]
    attrs={p['attributes'][key]:key for mesh in document['meshes'] for p in mesh['primitives'] for key in ('NORMAL','TANGENT') if key in p['attributes']}
    references={i:[]for i in range(len(document['bufferViews']))}
    for i,a in enumerate(document['accessors']):
        if 'bufferView'in a:references[a['bufferView']].append(i)
    replacements={};quantized=0;max_error=0
    for idx,key in attrs.items():
        a=document['accessors'][idx];vi=a['bufferView'];v=document['bufferViews'][vi]
        width=3 if key=='NORMAL' else 4
        if a['componentType']!=5126 or a.get('byteOffset',0)or v.get('byteStride')or len(references[vi])!=1:continue
        assert v['byteLength']==a['count']*width*4
        old=np.frombuffer(binary,dtype='<f4',count=a['count']*width,offset=v['byteOffset']).reshape((-1,width))
        assert np.max(np.abs(old))<1.0001
        packed=np.rint(np.clip(old,-1,1)*32767).astype('<i2')
        max_error=max(max_error,float(np.max(np.abs(packed.astype(float)/32767-old))))
        replacements[vi]=packed.tobytes();a['componentType']=5122;a['normalized']=True
        a.pop('min',None);a.pop('max',None);quantized+=1
    # Every bufferView is repacked on a four-byte boundary; embedded images unchanged.
    parts=[];cursor=0
    for i,v in enumerate(document['bufferViews']):
        payload=replacements.get(i,binary[v['byteOffset']:v['byteOffset']+v['byteLength']])
        v['byteOffset']=cursor;v['byteLength']=len(payload);parts.append(payload)
        pad=(-len(payload))%4
        if pad:parts.append(b'\0'*pad)
        cursor+=len(payload)+pad
    document['buffers'][0]['byteLength']=cursor
    for key in ('extensionsUsed','extensionsRequired'):
        if 'KHR_mesh_quantization'not in document.setdefault(key,[]):document[key].append('KHR_mesh_quantization')
    doc=json.dumps(document,separators=(',',':'),ensure_ascii=False).encode();doc+=b' '*((-len(doc))%4)
    data=b''.join(parts);result=struct.pack('<III',0x46546c67,2,12+8+len(doc)+8+len(data))+struct.pack('<II',len(doc),0x4e4f534a)+doc+struct.pack('<II',len(data),0x004e4942)+data
    (Path(output).resolve()if output else path).write_bytes(result)
    return {'extension':'KHR_mesh_quantization','attributes':['NORMAL','TANGENT'],'accessors':quantized,'bytes_saved':len(raw)-len(result),'max_component_error':max_error,'positions_uv_transforms_unchanged':True}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',required=True,help='Freshly exported unquantized GLB')
    parser.add_argument('--output',required=True,help='Separate quantized GLB output')
    args=parser.parse_args()
    if Path(args.input).resolve()==Path(args.output).resolve():parser.error('CLI output must differ from input; build_best owns its generated in-place export.')
    print(json.dumps(quantize_normals(args.input,args.output)))
