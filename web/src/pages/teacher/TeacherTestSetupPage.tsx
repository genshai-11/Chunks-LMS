import { useState } from 'react'
import { Gauge, Play, Volume2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Panel } from '../../components/ui'
import { prepareStandaloneRun, startStandaloneRun } from '../../lib/standalone-tests'
import type { PromptLanguage } from '../../modules/standalone-tests/types'

export function TeacherTestSetupPage(){
 const {assignmentId,sectionId}=useParams(); const navigate=useNavigate(); const [language,setLanguage]=useState<PromptLanguage>('vi'); const [voice,setVoice]=useState('alloy'); const [preview,setPreview]=useState<Awaited<ReturnType<typeof prepareStandaloneRun>> extends {ok:true;data:infer T}?T:any>(null); const [message,setMessage]=useState('')
 async function check(){if(!assignmentId||!sectionId)return; const r=await prepareStandaloneRun(assignmentId,sectionId,language,voice); if(!r.ok){setMessage(r.error);return} setPreview(r.data);setMessage(r.data.canStart?'Audio ready.':'Start blocked: approve intro and all ten item narrations.')}
 async function start(){if(!preview?.canStart)return; const r=await startStandaloneRun(preview.runId,preview.readinessToken); if(!r.ok)return setMessage(r.error); navigate(`/teacher/test-runs/${preview.runId}`)}
 return <><PageHeader icon={Gauge} kicker="Standalone Test" title="Session setup" subtitle="Choose Complete Vietnamese or Complete English and an approved voice before start."/><Panel icon={Volume2} title="Prompt and audio" description="The introduction reads Session number, CVR, CCI Ampe, and CCI Name."><div className="form-grid"><label>Complete language<select value={language} onChange={e=>{setLanguage(e.target.value as PromptLanguage);setPreview(null)}}><option value="vi">Vietnamese — Complete Sentence</option><option value="en">English — Complete Sentence</option></select></label><label>Voice ID<input value={voice} onChange={e=>{setVoice(e.target.value);setPreview(null)}}/></label></div><div className="btn-row"><button onClick={()=>void check()}>Check readiness</button><button className="primary" disabled={!preview?.canStart} onClick={()=>void start()}><Play className="h-4 w-4"/>Start</button></div>{preview?<div className="stat-grid compact"><div className="stat-card"><strong>Session {preview.sessionNumber}</strong><span>CVR {preview.targetCvrOhm}</span></div><div className="stat-card"><strong>CCI {preview.cciValue}</strong><span>{preview.cciName}</span></div><div className="stat-card"><strong>CPD {preview.itemCpd}</strong><span>Approved audio {preview.approvedItemAudioCount}/10</span></div></div>:null}{message?<p className="meta">{message}</p>:null}</Panel></>
}
