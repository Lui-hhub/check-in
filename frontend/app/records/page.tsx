"use client";
import {useEffect,useState} from "react";
import {api} from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import MediaImage from "../../components/MediaImage";

type RecordItem={id:number;student_id:number;photo_url:string;grade:string;name:string;subject:string;created_at:string};
const grades=["一年级","二年级","三年级","四年级","五年级","六年级","初一","初二","初三","高一","高二","高三"];
const emptyFilters={id:"",grade:"",name:"",subject:""};

export default function Records(){
  const [items,setItems]=useState<RecordItem[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [filters,setFilters]=useState(emptyFilters);
  useEffect(()=>{api("/api/checkins",{},["viewer","admin"]).then(setItems).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false))},[]);
  const hasFilters=Object.values(filters).some(value=>value.trim()!=="");
  const filterGrades=Array.from(new Set([...grades,...items.map(item=>item.grade)])).filter(Boolean);
  const filterSubjects=Array.from(new Set(items.map(item=>item.subject))).filter(Boolean);
  const visible=items.filter(item=>
    (!filters.id.trim()||String(item.student_id)===filters.id.trim())&&
    (!filters.grade||item.grade===filters.grade)&&
    (!filters.name.trim()||item.name.toLocaleLowerCase().includes(filters.name.trim().toLocaleLowerCase()))&&
    (!filters.subject||item.subject===filters.subject)
  );
  function updateFilters(next:typeof emptyFilters){setFilters(next)}
  return <>
    <PageHeader section="签到记录" />
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">全班考勤</p><h1>签到记录</h1><p className="heading-note">按签到时间从近到远排列。</p></div>
        <span className="list-meta">{loading?"正在读取…":hasFilters?`${visible.length} / ${items.length} 条记录`:`${items.length} 条记录`}</span>
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <section className="student-filters record-filters" aria-label="签到记录筛选">
        <label className="field">学号<input type="search" inputMode="numeric" value={filters.id} onChange={event=>updateFilters({...filters,id:event.target.value})} placeholder="输入完整学号" /></label>
        <label className="field">年级<select className="select-control" value={filters.grade} onChange={event=>updateFilters({...filters,grade:event.target.value})}><option value="">全部年级</option>{filterGrades.map(grade=><option key={grade}>{grade}</option>)}</select></label>
        <label className="field">姓名<input type="search" value={filters.name} onChange={event=>updateFilters({...filters,name:event.target.value})} placeholder="输入姓名关键词" /></label>
        <label className="field">科目<select className="select-control" value={filters.subject} onChange={event=>updateFilters({...filters,subject:event.target.value})}><option value="">全部科目</option>{filterSubjects.map(subject=><option key={subject}>{subject}</option>)}</select></label>
        <button type="button" className="secondary-button filter-reset" disabled={!hasFilters} onClick={()=>updateFilters(emptyFilters)}>清空筛选</button>
      </section>
      <section className="records-list" aria-label="全部签到记录">
        {!loading&&!error&&visible.length===0&&<div className="empty-state"><span className="empty-mark">到</span><p className="empty-title">{hasFilters?"没有符合筛选条件的记录":"还没有签到记录"}</p><p className="empty-copy">{hasFilters?"请调整筛选条件，或清空筛选查看全部记录。":"完成第一次拍照签到后，记录会显示在这里。"}</p></div>}
        {visible.map(item=><article className="record" key={item.id}>
          <MediaImage path={item.photo_url} alt={`${item.name}的签到照片`} />
          <div className="record-info"><strong className="record-name">{item.grade} · {item.name}</strong><span className="record-subject">{item.subject}</span><time className="record-time" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>
          <span className="record-mark">已签到</span>
        </article>)}
      </section>
    </main>
  </>;
}
