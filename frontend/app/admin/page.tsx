"use client";
import {useEffect,useState} from "react";
import {api} from "../../lib/api";
import {useRouter} from "next/navigation";
import PageHeader from "../../components/PageHeader";

type Student={id:number;grade:string;name:string;subject:string;display_name:string;is_deleted:boolean};

export default function Admin(){
  const [list,setList]=useState<Student[]>([]);
  const [form,setForm]=useState({grade:"",name:"",subject:""});
  const [image,setImage]=useState<File>();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<Student>();
  const [draft,setDraft]=useState({grade:"",name:"",subject:""});
  const router=useRouter();

  async function refresh(){
    try{setList(await api("/api/students?include_deleted=true",{},["admin"]))}
    catch(e){setError((e as Error).message)}
  }
  useEffect(()=>{refresh()},[]);

  async function faceData(file:File){
    const faceapi=await import("face-api.js");
    await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri("/models"),faceapi.nets.faceLandmark68Net.loadFromUri("/models"),faceapi.nets.faceRecognitionNet.loadFromUri("/models")]);
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext("2d")!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("照片压缩失败")),"image/jpeg",.8));
    const detected=await faceapi.detectSingleFace(canvas,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
    if(!detected)throw new Error("照片中没有检测到人脸，请换一张清晰正脸照片");
    return{blob,embedding:JSON.stringify(Array.from(detected.descriptor))};
  }

  async function add(event:React.FormEvent){
    event.preventDefault();setError("");setBusy(true);
    try{
      if(!image)throw new Error("请选择人脸照片");
      const face=await faceData(image);const data=new FormData();
      data.append("grade",form.grade);data.append("name",form.name);data.append("subject",form.subject);
      data.append("embedding",face.embedding);data.append("face_image",face.blob,"student.jpg");
      await api("/api/students",{method:"POST",body:data},["admin"]);
      setForm({grade:"",name:"",subject:""});setImage(undefined);await refresh();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  function edit(student:Student){
    setEditing(student);setDraft({grade:student.grade,name:student.name,subject:student.subject});setError("");
  }
  async function saveEdit(event:React.FormEvent){
    event.preventDefault();if(!editing)return;setError("");setBusy(true);
    try{await api(`/api/students/${editing.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)},["admin"]);setEditing(undefined);await refresh()}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function replaceFace(id:number,file?:File){
    if(!file)return;setError("");setBusy(true);
    try{const face=await faceData(file);const data=new FormData();data.append("embedding",face.embedding);data.append("face_image",face.blob,"student.jpg");await api(`/api/students/${id}/face`,{method:"POST",body:data},["admin"])}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function remove(id:number){
    if(!confirm("确定删除该学生吗？"))return;
    try{await api(`/api/students/${id}`,{method:"DELETE"},["admin"]);await refresh()}
    catch(e){setError((e as Error).message)}
  }

  return <>
    <PageHeader section="学生管理" />
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">资料维护</p><h1>学生名册</h1><p className="heading-note">录入姓名、年级、科目和一张清晰正脸照片。</p></div>
      </div>
      <form className="admin-form" onSubmit={add}>
        <h2>新增学生</h2>
        <div className="admin-form-grid">
          <label className="field">年级<input value={form.grade} onChange={event=>setForm({...form,grade:event.target.value})} placeholder="例如：五年级" required /></label>
          <label className="field">姓名<input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="学生姓名" required /></label>
          <label className="field">补课科目<input value={form.subject} onChange={event=>setForm({...form,subject:event.target.value})} placeholder="例如：数学" required /></label>
          <label className="field">人脸照片<input className="file-input" type="file" accept="image/*" capture="user" onChange={event=>setImage(event.target.files?.[0])} required /></label>
          <button className="primary-button admin-submit" disabled={busy}>{busy?"正在处理…":"保存学生"}</button>
        </div>
        {image&&<p className="camera-state">已选择：{image.name}</p>}
        {error&&<p className="form-error" role="alert">{error}</p>}
      </form>
      <div className="section-heading"><h2>学生列表</h2><span className="list-meta">{list.filter(student=>!student.is_deleted).length} 位在读学生</span></div>
      <section className="student-list" aria-label="学生列表">
        {list.map(student=><article className="student-row" key={student.id}>
          <div className="student-info"><strong className="student-title">{student.grade} · {student.display_name}</strong><span className="student-subtitle">{student.subject}{student.is_deleted&&<span className="deleted-label"> · 已删除</span>}</span></div>
          {!student.is_deleted&&<div className="student-actions">
            <button className="secondary-button" type="button" onClick={()=>edit(student)}>编辑资料</button>
            <label className="secondary-button upload-button">重录照片<input type="file" accept="image/*" capture="user" disabled={busy} aria-label={`重新录入${student.display_name}的人脸照片`} onChange={event=>replaceFace(student.id,event.target.files?.[0])} /></label>
            <button className="danger-button" type="button" onClick={()=>remove(student.id)}>删除</button>
          </div>}
        </article>)}
        {list.length===0&&<div className="empty-state"><span className="empty-mark">册</span><p className="empty-title">名册还是空的</p><p className="empty-copy">添加第一位学生后，可在此修改资料和人脸照片。</p></div>}
      </section>
    </main>
    {editing&&<div className="dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setEditing(undefined)}}>
      <form className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={saveEdit}>
        <p className="eyebrow">学生资料</p><h2 id="edit-title">编辑 {editing.display_name}</h2>
        <label className="field">年级<input value={draft.grade} onChange={event=>setDraft({...draft,grade:event.target.value})} required /></label>
        <label className="field">姓名<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} required /></label>
        <label className="field">补课科目<input value={draft.subject} onChange={event=>setDraft({...draft,subject:event.target.value})} required /></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="student-actions"><button className="secondary-button" type="button" onClick={()=>setEditing(undefined)}>取消</button><button className="primary-button" disabled={busy}>{busy?"正在保存…":"保存修改"}</button></div>
      </form>
    </div>}
  </>;
}
