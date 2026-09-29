"use client";
import {useEffect,useState} from "react";
import {api,download} from "../../lib/api";
import {useRouter} from "next/navigation";
import PageHeader from "../../components/PageHeader";
import DropdownField from "../../components/DropdownField";

type Student={id:number;grade:string;name:string;subjects:string[];display_name:string;is_deleted:boolean};
const grades=["一年级","二年级","三年级","四年级","五年级","六年级","初一","初二","初三","高一","高二","高三"];
const subjects=["语文","数学","英语","政治","历史","地理","物理","化学","生物"];
const emptyFilters={id:"",grade:"",name:"",subject:""};

export default function Admin(){
  const [list,setList]=useState<Student[]>([]);
  const [form,setForm]=useState({grade:"",name:"",subject:""});
  const [image,setImage]=useState<File>();
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [importFile,setImportFile]=useState<File>();
  const [importMessage,setImportMessage]=useState("");
  const [editing,setEditing]=useState<Student>();
  const [view,setView]=useState<"active"|"graduates">("active");
  const [filters,setFilters]=useState(emptyFilters);
  const [selected,setSelected]=useState<number[]>([]);
  const [page,setPage]=useState(1);
  const pageSize=20;
  const [draft,setDraft]=useState({grade:"",name:"",subject:""});
  const router=useRouter();

  async function refresh(){
    try{setList(await api("/api/students?include_deleted=true",{},["admin"]))}
    catch(e){setError((e as Error).message)}
  }
  useEffect(()=>{refresh()},[]);
  const viewStudents=list.filter(student=>view==="active"?!student.is_deleted:student.is_deleted);
  const hasFilters=Object.values(filters).some(value=>value.trim()!=="");
  const visible=viewStudents.filter(student=>
    (!filters.id.trim()||String(student.id)===filters.id.trim())&&
    (!filters.grade||student.grade===filters.grade)&&
    (!filters.name.trim()||student.name.toLocaleLowerCase().includes(filters.name.trim().toLocaleLowerCase()))&&
    (!filters.subject||student.subjects.includes(filters.subject))
  );
  const filterGrades=Array.from(new Set([...grades,...list.map(student=>student.grade)])).filter(Boolean);
  const filterSubjects=Array.from(new Set([...subjects,...list.flatMap(student=>student.subjects)])).filter(Boolean);
  const pageCount=Math.max(1,Math.ceil(visible.length/pageSize));
  const currentPage=Math.min(page,pageCount);
  const pageItems=visible.slice((currentPage-1)*pageSize,currentPage*pageSize);
  useEffect(()=>{setPage(current=>Math.min(current,pageCount))},[pageCount]);
  const selectedVisible=selected.filter(id=>visible.some(student=>student.id===id));
  function updateFilters(next:typeof emptyFilters){setFilters(next);setPage(1);setSelected([])}
  const selectedSubjects=form.subject?form.subject.split(/[,，]/).map(item=>item.trim()).filter(Boolean):[];
  const allSelected=visible.length>0&&visible.every(student=>selected.includes(student.id));
  function toggleAll(){setSelected(allSelected?selected.filter(id=>!visible.some(student=>student.id===id)):Array.from(new Set([...selected,...visible.map(student=>student.id)])))}
  function toggle(id:number){setSelected(selected.includes(id)?selected.filter(value=>value!==id):[...selected,id])}
  async function exportStudents(){
    if(!selectedVisible.length)return;
    const params=new URLSearchParams({include_deleted:String(view==="graduates")});
    params.set("ids",selectedVisible.join(","));
    try{await download(`/api/students/export?${params.toString()}`,view==="graduates"?"毕业生名单.xlsx":"在读学生名单.xlsx",["admin"])}catch(e){setError((e as Error).message)}
  }

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
      if(!form.grade)throw new Error("请选择年级");
      if(!image)throw new Error("请选择人脸照片");
      if(!form.subject)throw new Error("请选择补课科目");
      const face=await faceData(image);const data=new FormData();
      data.append("grade",form.grade);data.append("name",form.name);data.append("subjects",form.subject);
      data.append("embedding",face.embedding);data.append("face_image",face.blob,"student.jpg");
      await api("/api/students",{method:"POST",body:data},["admin"]);
      setForm({grade:"",name:"",subject:""});setImage(undefined);await refresh();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  async function importStudents(event:React.FormEvent){
    event.preventDefault();setError("");setImportMessage("");setBusy(true);
    try{
      if(!importFile)throw new Error("请选择 .xlsx 文件");
      const data=new FormData();data.append("file",importFile);
      const result=await api("/api/students/import",{method:"POST",body:data},["admin"]);
      setImportFile(undefined);await refresh();
      setImportMessage(`已导入 ${result.created} 位学生${result.errors.length?`，${result.errors.length} 行未导入`:""}。导入的学生还需要录入人脸照片。`);
      if(result.errors.length)setError(result.errors.join("；"));
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  function edit(student:Student){
    setEditing(student);setDraft({grade:student.grade,name:student.name,subject:student.subjects.join(", ")});setError("");
  }
  async function saveEdit(event:React.FormEvent){
    event.preventDefault();if(!editing)return;setError("");setBusy(true);
    try{await api(`/api/students/${editing.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,subjects:draft.subject.split(/[,，]/).map(item=>item.trim()).filter(Boolean)})},["admin"]);setEditing(undefined);await refresh()}
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
          <DropdownField label="年级" placeholder="选择年级" options={grades} value={form.grade?[form.grade]:[]} onChange={value=>setForm(current=>({...current,grade:value[0]??""}))} />
          <label className="field">姓名<input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="学生姓名" required /></label>
          <DropdownField label="补课科目" placeholder="选择科目" options={subjects} value={selectedSubjects} multiple onChange={value=>setForm(current=>({...current,subject:value.join(",")}))} />
          <label className="field">人脸照片<input className="file-input" type="file" accept="image/*" capture="user" onChange={event=>setImage(event.target.files?.[0])} required /></label>
          <button className="primary-button admin-submit" disabled={busy}>{busy?"正在处理…":"保存学生"}</button>
        </div>
        {image&&<p className="camera-state">已选择：{image.name}</p>}
        {error&&<p className="form-error" role="alert">{error}</p>}
      </form>
      <form className="import-form" onSubmit={importStudents}>
        <div><p className="eyebrow">批量录入</p><h2>从 Excel 导入</h2><p className="heading-note">第一行必须包含：年级、姓名、补课科目。导入后再为学生录入人脸照片。</p></div>
        <div className="import-actions"><input className="file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event=>setImportFile(event.target.files?.[0])} /><button className="secondary-button" disabled={busy||!importFile}>{busy?"正在导入…":"导入 Excel"}</button></div>
        {importFile&&<p className="camera-state">已选择：{importFile.name}</p>}
        {importMessage&&<p className="form-success" role="status">{importMessage}</p>}
      </form>
      <div className="section-heading"><div className="list-tabs" role="tablist" aria-label="学生列表视图"><button type="button" className={`list-tab${view==="active"?" list-tab-active":""}`} onClick={()=>{setView("active");setSelected([]);setPage(1)}}>在读学生</button><button type="button" className={`list-tab${view==="graduates"?" list-tab-active":""}`} onClick={()=>{setView("graduates");setSelected([]);setPage(1)}}>毕业生</button></div><span className="list-meta" role="status">{hasFilters?`${visible.length} / ${viewStudents.length} 人`: `${visible.length} 人`}</span></div>
      <section className="student-filters" aria-label="学生筛选">
        <label className="field">学号<input type="search" inputMode="numeric" value={filters.id} onChange={event=>updateFilters({...filters,id:event.target.value})} placeholder="输入完整学号" /></label>
        <DropdownField label="年级" placeholder="全部年级" clearLabel="全部年级" options={filterGrades} value={filters.grade?[filters.grade]:[]} onChange={value=>updateFilters({...filters,grade:value[0]??""})} />
        <label className="field">姓名<input type="search" value={filters.name} onChange={event=>updateFilters({...filters,name:event.target.value})} placeholder="输入姓名关键词" /></label>
        <DropdownField label="科目" placeholder="全部科目" clearLabel="全部科目" options={filterSubjects} value={filters.subject?[filters.subject]:[]} onChange={value=>updateFilters({...filters,subject:value[0]??""})} />
        <button type="button" className="secondary-button filter-reset" disabled={!hasFilters} onClick={()=>updateFilters(emptyFilters)}>清空筛选</button>
      </section>
      <div className="export-toolbar"><label className="check-all"><input type="checkbox" checked={allSelected} onChange={toggleAll} /> 全选<span className="selection-count">{selectedVisible.length} 已选</span></label><div className="export-actions"><button type="button" className="secondary-button" disabled={!selectedVisible.length} onClick={exportStudents}>导出 Excel</button></div></div>
      <section className="student-list" aria-label={view==="active"?"在读学生列表":"毕业生列表"}>
        {pageItems.map(student=><article className="student-row" key={student.id}>
          <label className="row-check"><input type="checkbox" checked={selected.includes(student.id)} onChange={()=>toggle(student.id)} aria-label={`选择${student.display_name}`} /></label><div className="student-info"><strong className="student-title">{student.id} · {student.grade} · {student.display_name}</strong><span className="student-subtitle">{student.subjects.join("、")}{student.is_deleted&&<span className="deleted-label"> · 已删除</span>}</span></div>
          {!student.is_deleted&&<div className="student-actions">
            <button className="secondary-button" type="button" onClick={()=>edit(student)}>编辑资料</button>
            <label className="secondary-button upload-button">重录照片<input type="file" accept="image/*" capture="user" disabled={busy} aria-label={`重新录入${student.display_name}的人脸照片`} onChange={event=>replaceFace(student.id,event.target.files?.[0])} /></label>
            <button className="danger-button" type="button" onClick={()=>remove(student.id)}>删除</button>
          </div>}
        </article>)}
        {visible.length===0&&<div className="empty-state"><span className="empty-mark">册</span><p className="empty-title">{hasFilters?"没有符合筛选条件的学生":view==="active"?"名册还是空的":"还没有毕业生记录"}</p><p className="empty-copy">{hasFilters?"请调整筛选条件，或清空筛选查看全部学生。":view==="active"?"添加第一位学生后，可在此修改资料和人脸照片。":"被软删除的学生会显示在这里，历史签到记录仍会保留。"}</p></div>}
      </section>
      {visible.length>0&&<nav className="pagination" aria-label="学生列表分页"><button type="button" className="secondary-button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</button><span>第 {currentPage} / {pageCount} 页</span><button type="button" className="secondary-button" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>下一页</button></nav>}
    </main>
    {editing&&<div className="dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setEditing(undefined)}}>
      <form className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={saveEdit}>
        <p className="eyebrow">学生资料</p><h2 id="edit-title">编辑 {editing.display_name}</h2>
        <label className="field">年级<select className="select-control" value={draft.grade} onChange={event=>setDraft({...draft,grade:event.target.value})} required>{grades.map(grade=><option key={grade}>{grade}</option>)}</select></label>
        <label className="field">姓名<input value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} required /></label>
        <label className="field">补课科目<input value={draft.subject} onChange={event=>setDraft({...draft,subject:event.target.value})} placeholder="多个科目用逗号分隔，如：数学，英语" required /></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="student-actions"><button className="secondary-button" type="button" onClick={()=>setEditing(undefined)}>取消</button><button className="primary-button" disabled={busy}>{busy?"正在保存…":"保存修改"}</button></div>
      </form>
    </div>}
  </>;
}
