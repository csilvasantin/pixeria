const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
export function duration(seconds){seconds=Math.max(0,Math.floor(seconds));return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].slice(seconds>=3600?0:1).map(x=>String(x).padStart(2,'0')).join(':');}
export function musicTiming(job,now=Date.now(),language='es'){
 if(job?.kind!=='cancion'||job.state==='prepared')return null;
 const en=language==='en',t=(es,eng)=>en?eng:es,p=job.musicProgress||{},end=stamp(p.finished_at),asOf=end??now;
 const labels={en_cola:t('En cola · esperando al consejero','Queued · waiting for counselor'),recibido:t('Encargo recibido','Request received'),auditoria:t('Comprobando el intento anterior','Checking the previous attempt'),en_suno:t('En Suno','In Suno'),generando:t('Generando música','Generating music'),recuperando_audio:t('Recuperando el audio','Retrieving audio'),terminado:t('Finalizado','Finished'),bloqueado:t('En espera · requiere atención','Waiting · needs attention'),sin_confirmar:t('Estado sin confirmar','Status unconfirmed')};
 const submitted=stamp(p.submitted_at)??stamp(job.submittedAt),started=stamp(p.started_at),updated=stamp(p.updated_at),tracking=stamp(p.tracking_at);
 const elapsed=submitted!==null?t('Tiempo total: ','Total time: ')+duration((asOf-submitted)/1000):tracking!==null?t('En seguimiento: ','Tracking time: ')+duration((asOf-tracking)/1000):t('Inicio de generación sin confirmar','Generation start unconfirmed');
 let remaining=t('Tiempo restante aún no disponible','Remaining time not yet available');
 if(end!==null)remaining=t('Seguimiento finalizado','Tracking finished');
 else if(updated!==null&&now-updated>120000)remaining=t('Sin novedades recientes · esperando actualización','No recent update · waiting for news');
 else if(p.eta_basis&&Number.isFinite(p.remaining_min_seconds)&&Number.isFinite(p.remaining_max_seconds)&&p.remaining_min_seconds>=0&&p.remaining_max_seconds>=p.remaining_min_seconds&&updated!==null){const age=Math.max(0,(now-updated)/1000),max=p.remaining_max_seconds-age;if(max<=0)remaining=t('Estimación superada · esperando actualización','Estimate exceeded · waiting for update');else remaining=t('Restante estimado: ','Estimated remaining: ')+duration(Math.max(0,p.remaining_min_seconds-age))+'–'+duration(max);}
 const phase=(labels[p.phase]||t('Estado sin confirmar','Status unconfirmed'))+(p.encargo?' · #'+p.encargo:'');
 return {phase,elapsed:elapsed+(started!==null?t(' · Generación: ',' · Generation: ')+duration((asOf-started)/1000):''),remaining,updated:updated!==null?t('Última noticia hace ','Last update ')+duration(Math.max(0,(now-updated)/1000))+(en?' ago':''):t('Sin parte confirmado del consejero','No confirmed counselor update')};
}
