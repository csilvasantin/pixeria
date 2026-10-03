// Canvas PNGs otherwise default to 96 ppi. Write an explicit print density.
export function pngDensity(bytes,ppi=150) {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9);
 chunk.set([112,72,89,115],4);const ppm=Math.round(ppi/.0254);
 v.setUint32(8,ppm);v.setUint32(12,ppm);chunk[16]=1;
 let crc=0xffffffff;for(const b of chunk.slice(4,17)){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}v.setUint32(17,(crc^0xffffffff)>>>0);
 const parts=[bytes.slice(0,8)];let offset=8;
 while(offset<bytes.length){const n=view.getUint32(offset)+12,type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
  if(type!=='pHYs')parts.push(bytes.slice(offset,offset+n));if(type==='IHDR')parts.push(chunk);offset+=n;
 }
 const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){result.set(p,at);at+=p.length;}return result;
}
