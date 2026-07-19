import { useEffect, useState } from 'react'
import { ClipboardCheck, Play, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'
import { listTestPackages, listTestPackageVersions, listTestSections } from '../../lib/test-packages'
import { createStandaloneAssignment, listStandaloneAssignments } from '../../lib/standalone-tests'

export function TeacherTestsPage() {
  const { roster } = useAppState(); const navigate = useNavigate()
  const learners = listActiveLearners(roster)
  const [learnerId,setLearnerId]=useState(''); const [versionId,setVersionId]=useState('')
  const [versions,setVersions]=useState<Array<{id:string;label:string}>>([]); const [message,setMessage]=useState('')
  const [assignments,setAssignments]=useState<Array<{id:string;learnerUserId:string;status:string}>>([])
  useEffect(()=>{ void (async()=>{ const packages=await listTestPackages(); if(!packages.ok)return; const next=[] as Array<{id:string;label:string}>; for(const pkg of packages.data){const result=await listTestPackageVersions(pkg.id); if(result.ok) for(const version of result.data.filter(v=>v.status==='published')) next.push({id:version.id,label:`${pkg.title} · ${version.versionLabel}`})} setVersions(next); setVersionId(next[0]?.id??'') })() },[])
  useEffect(()=>{ void listStandaloneAssignments().then(r=>{if(r.ok)setAssignments(r.data)}) },[])
  async function start(){ if(!learnerId||!versionId)return setMessage('Select one Learner and one published Package Version.'); const assignment=await createStandaloneAssignment(learnerId,versionId); if(!assignment.ok)return setMessage(assignment.error); const sections=await listTestSections(versionId); if(!sections.ok||!sections.data[0])return setMessage(sections.ok?'Package has no sessions.':sections.error); navigate(`/teacher/tests/${assignment.data}/sections/${sections.data[0].id}/setup`) }
  return <><PageHeader icon={ClipboardCheck} kicker="Teacher" title="Standalone Tests" subtitle="One Learner · no Class · package sessions remain separate from Live Session." />
    <Panel icon={Play} title="New one-to-one Test" description="Select exactly one active Learner and a published canonical package."><div className="form-grid"><label>Learner<select value={learnerId} onChange={e=>setLearnerId(e.target.value)}><option value="">Select Learner</option>{learners.map(l=><option key={l.id} value={l.id}>{l.displayName}</option>)}</select></label><label>Package<select value={versionId} onChange={e=>setVersionId(e.target.value)}><option value="">Select published package</option>{versions.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label></div>{message?<p className="meta">{message}</p>:null}<button className="primary" onClick={()=>void start()} disabled={!learnerId||!versionId}><Play className="h-4 w-4"/>Create assignment</button></Panel>
    <Panel icon={UserRound} title="Assignments" description="Standalone assignments never create Classes or Enrollments.">{assignments.length===0?<EmptyState icon={ClipboardCheck} title="No standalone assignments"/>:<div className="table-wrap"><table><thead><tr><th>Learner</th><th>Status</th></tr></thead><tbody>{assignments.map(a=><tr key={a.id}><td>{learners.find(l=>l.id===a.learnerUserId)?.displayName??a.learnerUserId}</td><td><span className="badge">{a.status}</span></td></tr>)}</tbody></table></div>}</Panel></>
}
