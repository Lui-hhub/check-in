"use client";
import {useEffect,useState} from "react";
import {api} from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import MediaImage from "../../components/MediaImage";

type RecordItem={id:number;photo_url:string;grade:string;name:string;subject:string;created_at:string};

export default function Records(){
  const [items,setItems]=useState<RecordItem[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{api("/api/checkins",{},["viewer","admin"]).then(setItems).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false))},[]);
  return <>
    <PageHeader section="签到记录" />
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">全班考勤</p><h1>签到记录</h1><p className="heading-note">按签到时间从近到远排列。</p></div>
        <span className="list-meta">{loading?"正在读取…":`${items.length} 条记录`}</span>
      </div>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <section className="records-list" aria-label="全部签到记录">
        {!loading&&!error&&items.length===0&&<div className="empty-state"><span className="empty-mark">到</span><p className="empty-title">还没有签到记录</p><p className="empty-copy">完成第一次拍照签到后，记录会显示在这里。</p></div>}
        {items.map(item=><article className="record" key={item.id}>
          <MediaImage path={item.photo_url} alt={`${item.name}的签到照片`} />
          <div className="record-info"><strong className="record-name">{item.grade} · {item.name}</strong><span className="record-subject">{item.subject}</span><time className="record-time" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>
          <span className="record-mark">已签到</span>
        </article>)}
      </section>
    </main>
  </>;
}
