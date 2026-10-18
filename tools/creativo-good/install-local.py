#!/usr/bin/env python3
"""Register the already installed GOOD runtime for this macOS login only.
Usage: python install-local.py /absolute/path/to/good-local
Models and Python dependencies must already be installed from official sources.
"""
import sys,os,plistlib,shutil,subprocess,json
from pathlib import Path
root=Path(sys.argv[1]).resolve();app=root/'app';app.mkdir(exist_ok=True)
for name in ['server.py','workflow.py']:shutil.copy2(Path(__file__).parent/name,app/name)
python=root/'venv/bin/python';comfy=root/'ComfyUI/main.py'
if not python.exists() or not comfy.exists():raise SystemExit('GOOD runtime not installed')
base=Path.home()/'Library/LaunchAgents';base.mkdir(exist_ok=True)
services={
 'com.admira.creativo-good.engine':{'ProgramArguments':[str(python),str(comfy),'--base-directory',str(root),'--listen','127.0.0.1','--port','8189','--offline','--disable-all-custom-nodes','--force-fp16','--use-pytorch-cross-attention','--cache-none','--reserve-vram','8','--preview-method','none'],'EnvironmentVariables':{'PYTORCH_ENABLE_MPS_FALLBACK':'1','OMP_NUM_THREADS':'4'}},
 'com.admira.creativo-good.bridge':{'ProgramArguments':[str(python),str(app/'server.py')],'EnvironmentVariables':{'CREATIVO_GOOD_HOME':str(root)}}}
for label,config in services.items():
 path=base/(label+'.plist');config.update(Label=label,RunAtLoad=True,KeepAlive=True,WorkingDirectory=str(root),Nice=10,StandardOutPath=str(root/(label+'.log')),StandardErrorPath=str(root/(label+'.log')))
 path.write_bytes(plistlib.dumps(config));subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(path)],check=True)
print('GOOD local registrado para el usuario actual; solo escucha en 127.0.0.1.')
