"""Native ComfyUI Wan VACE masked video outpainting, no image generation fallback."""
MODEL='wan2.1_vace_1.3B_fp16.safetensors'
ENCODER='umt5_xxl_fp16.safetensors'
VAE='wan_2.1_vae.safetensors'
VERSION='wan-vace-1.3b-temporal-v1'
FRAMES=49
FPS=16

def workflow(filename, width, height, left, top, right, bottom, prefix, seed=314159):
 def node(kind,**inputs):return {'class_type':kind,'inputs':inputs}
 return {
 '1':node('UNETLoader',unet_name=MODEL,weight_dtype='default'),
 '2':node('CLIPLoader',clip_name=ENCODER,type='wan',device='cpu'),
 '3':node('VAELoader',vae_name=VAE),
 '4':node('CLIPTextEncode',clip=['2',0],text='A continuous live action music video shot. Extend the existing scene naturally beyond the frame boundaries. Consistent camera motion, lighting, perspective and moving surroundings. The entire scene moves coherently with the original video. Preserve the central original content. Photorealistic.'),
 '5':node('CLIPTextEncode',clip=['2',0],text='static picture, frozen background, blurred padding, mirror, duplicate person, duplicate face, text, subtitles, watermark, unrelated scene, flickering, seams, distortion'),
 '6':node('LoadVideo',file=filename),
 '7':node('GetVideoComponents',video=['6',0]),
 '8':node('ImagePadForOutpaint',image=['7',0],left=left,top=top,right=right,bottom=bottom,feathering=16),
 '9':node('MaskToImage',mask=['8',1]),
 '10':node('RepeatImageBatch',image=['9',0],amount=FRAMES),
 '11':node('ImageToMask',image=['10',0],channel='red'),
 '12':node('WanVaceToVideo',positive=['4',0],negative=['5',0],vae=['3',0],width=width,height=height,length=FRAMES,batch_size=1,strength=1.0,control_video=['8',0],control_masks=['11',0]),
 '13':node('ModelSamplingSD3',model=['1',0],shift=8.0),
 '14':node('KSampler',model=['13',0],positive=['12',0],negative=['12',1],latent_image=['12',2],seed=seed,steps=20,cfg=5.0,sampler_name='uni_pc',scheduler='simple',denoise=1.0),
 '15':node('VAEDecode',samples=['14',0],vae=['3',0]),
 '16':node('CreateVideo',images=['15',0],fps=FPS),
 '17':node('SaveVideo',video=['16',0],filename_prefix=prefix,format='mp4',codec={'codec':'h264'}),
 }
