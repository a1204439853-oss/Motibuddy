import {useState} from 'react';
import {useLocale} from '@/i18n/react';
import Anniversaries from '@/components/Anniversaries';
import Notebook from './Notebook';
export default function NotebookModule(){const [tab,setTab]=useState<'journal'|'anniversary'>('journal'),{locale}=useLocale();return <section className="notebook-module"><nav className="notebook-tabs"><button aria-pressed={tab==='journal'} onClick={()=>setTab('journal')}>{locale==='zh-CN'?'手账本':'Journal'}</button><button aria-pressed={tab==='anniversary'} onClick={()=>setTab('anniversary')}>{locale==='zh-CN'?'纪念日':'Anniversaries'}</button></nav><div className="notebook-content"><div style={{display:tab==='journal'?'block':'none',height:'100%'}}><Notebook/></div><div style={{display:tab==='anniversary'?'block':'none',height:'100%'}}><Anniversaries/></div></div></section>;}
