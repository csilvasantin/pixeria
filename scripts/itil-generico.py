#!/usr/bin/env python3
"""Genera el icono GENÉRICO «pendiente» de la capa ITIL en los 4 niveles (8/16/32/64 bits).
Se usa para cualquier elemento ITIL del inventario que aún no tiene dibujo propio, para que
ningún elemento desaparezca. Dibujado con PIL (sin IA generativa). Uso: python3 scripts/itil-generico.py"""
import json, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont
BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets/xpaces/itil')
random.seed(4380)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
def font(p, s):
    try: return ImageFont.truetype(p, s)
    except Exception: return ImageFont.load_default()

# 8 bits: caja de equipo con «?» y piloto L (paleta cuantizada del resto de sprites)
GRID = [
 "................",
 "................",
 ".kkkkkkkkkkkkkk.",
 ".kwwwwwwwwwwwwk.",
 ".kwsssskkssssdk.",
 ".kwsssk..kssdsk.",
 ".kwsssssskssssk.",
 ".kwssssskkssssk.",
 ".kwssssskssssdk.",
 ".kwssssssssssdk.",
 ".kwssssskssssdk.",
 ".kwddddddddddLk.",
 ".kkkkkkkkkkkkkk.",
 "..kk........kk..",
 "................",
 "................",
]
def box_points(w, h, m):
    return (m, m, w - m, h - m)

def draw_16():
    w, h = 48, 42
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((3, 4, 44, 35), fill=(20, 15, 30, 255))
    d.rectangle((4, 5, 43, 34), fill=(120, 132, 150, 255))
    d.rectangle((4, 5, 43, 6), fill=(196, 208, 224, 255)); d.rectangle((4, 5, 5, 34), fill=(196, 208, 224, 255))
    d.rectangle((4, 33, 43, 34), fill=(70, 78, 92, 255)); d.rectangle((42, 5, 43, 34), fill=(70, 78, 92, 255))
    d.rectangle((8, 9, 39, 27), fill=(52, 60, 74, 255))
    q = [(20,12),(21,12),(22,12),(23,12),(24,12),(25,12),(19,13),(26,13),(26,14),(25,15),(24,16),(23,17),(22,18),(22,19),(22,22),(22,23)]
    for x, y in q: d.rectangle((x, y, x + 1, y), fill=(255, 215, 102, 255))
    for x in range(9, 38, 4): d.rectangle((x, 30, x + 1, 31), fill=(40, 46, 58, 255))
    d.rectangle((6, 36, 9, 38), fill=(20, 15, 30, 255)); d.rectangle((38, 36, 41, 38), fill=(20, 15, 30, 255))
    return im, (39, 31)

def draw_hi(w, h, real):
    S = 2; W, H = w * S, h * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = int(W*.08), int(H*.12), int(W*.92), int(H*.82)
    if real:  # sombra suave
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
        ds.ellipse((x0, y1 - H*.03, x1, y1 + H*.10), fill=(0, 0, 0, 120)); im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(W*.02))); d = ImageDraw.Draw(im)
    r = int(W*.05)
    ink = (22, 30, 28, 255)
    # cuerpo con degradado vertical
    body = Image.new('RGBA', (W, H), (0, 0, 0, 0)); db = ImageDraw.Draw(body)
    top, bot = ((200, 210, 222), (120, 130, 146)) if not real else ((226, 230, 236), (96, 104, 118))
    for i in range(y1 - y0):
        t = i / max(1, y1 - y0); c = tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3))
        db.line((x0, y0 + i, x1, y0 + i), fill=c + (255,))
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), r, fill=255)
    im.paste(body, (0, 0), mask); d = ImageDraw.Draw(im)
    d.rounded_rectangle((x0, y0, x1, y1), r, outline=ink, width=int(W*.012) if not real else int(W*.004))
    # panel frontal
    px0, py0, px1, py1 = int(W*.16), int(H*.22), int(W*.84), int(H*.64)
    d.rounded_rectangle((px0, py0, px1, py1), int(r*.6), fill=(40, 48, 60, 255), outline=ink, width=max(2, int(W*.006)))
    if real:  # reflejo especular
        gl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dg = ImageDraw.Draw(gl)
        dg.polygon([(px0, py0), (px0 + (px1-px0)*.45, py0), (px0 + (px1-px0)*.25, py1), (px0, py1)], fill=(255, 255, 255, 38))
        im = Image.alpha_composite(im, gl); d = ImageDraw.Draw(im)
    f = font(FONT, int(H*.36)); q = '?'
    bb = d.textbbox((0, 0), q, font=f); tx = (px0 + px1 - (bb[2]-bb[0])) / 2 - bb[0]; ty = (py0 + py1 - (bb[3]-bb[1])) / 2 - bb[1]
    d.text((tx, ty), q, font=f, fill=(255, 215, 102, 255))
    for i in range(7):  # rejilla de ventilación
        gx = int(W*.18 + i * W*.06); d.rounded_rectangle((gx, int(H*.70), gx + int(W*.035), int(H*.75)), 3, fill=(60, 66, 80, 255))
    led = (int(W*.80), int(H*.725))
    im = im.resize((w, h), Image.LANCZOS)
    return im, (led[0] / S, led[1] / S)

def code_overlay(base):
    w, h = base.size; im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(MONO, 18); chars = '01ITILCI<>/#=+'
    for x in range(0, w, 16):
        for y in range(0, h, 20):
            if random.random() < .55: d.text((x, y), random.choice(chars), font=f, fill=(80, 255, 140, random.randint(120, 255)))
    a = base.split()[3]; im.putalpha(Image.eval(Image.composite(im.split()[3], Image.new('L', (w, h), 0), a), lambda v: v))
    return im

def main():
    s = json.load(open(os.path.join(BASE, '8bit/sprites.json')))
    s['sprites']['generico'] = GRID
    json.dump(s, open(os.path.join(BASE, '8bit/sprites.json'), 'w'), ensure_ascii=False, indent=1)
    m = json.load(open(os.path.join(BASE, 'manifest.json')))
    tiers = {'good': {'bits': 8, 'url': '8bit/generico.png', 'width': 16, 'height': 16, 'led': [12, 11], 'grid': True}}
    im, led = draw_16(); im.save(os.path.join(BASE, '16bit/generico.png'))
    tiers['better'] = {'bits': 16, 'url': '16bit/generico.png', 'width': 48, 'height': 42, 'led': [led[0], led[1]]}
    im, led = draw_hi(346, 306, False); im.save(os.path.join(BASE, '32bit/generico.webp'), quality=88)
    tiers['best'] = {'bits': 32, 'url': '32bit/generico.webp', 'width': 346, 'height': 306, 'led': [round(led[0], 1), round(led[1], 1)]}
    im, led = draw_hi(676, 595, True); im.save(os.path.join(BASE, '64bit/generico.webp'), quality=88)
    code_overlay(im).save(os.path.join(BASE, '64bit/generico-code.webp'), quality=85)
    tiers['matrix'] = {'bits': 64, 'url': '64bit/generico.webp', 'code': '64bit/generico-code.webp', 'width': 676, 'height': 595, 'led': [round(led[0], 1), round(led[1], 1)]}
    m['items']['generico'] = {'nombre': 'Elemento ITIL sin dibujo propio (pendiente)', 'clase': 'Genérico · pendiente de dibujo', 'pendiente': True, 'tiers': tiers}
    json.dump(m, open(os.path.join(BASE, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print('ok generico')
main()
