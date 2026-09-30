"use client";
import {useEffect,useRef,useState} from "react";
import {api,ApiError} from "../../lib/api";
import {useRouter} from "next/navigation";
import PageHeader from "../../components/PageHeader";

type Student={id:number;grade:string;display_name:string;subjects:string[]};
type PendingSubject={photo:Blob;embedding:string;studentId:number;displayName:string;subjects:string[];distance:number|null};

export default function CheckIn(){
  const video=useRef<HTMLVideoElement>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [stream,setStream]=useState<MediaStream>();
  const [cameraMode,setCameraMode]=useState<"environment"|"user">("environment");
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState("");
  const [manual,setManual]=useState("");
  const [manualSubject,setManualSubject]=useState("");
  const [sessionSubject,setSessionSubject]=useState("");
  const [pendingSubject,setPendingSubject]=useState<PendingSubject>();
  const sessionStudents=students.filter(student=>!sessionSubject||student.subjects.includes(sessionSubject));
  const sessionSubjects=Array.from(new Set(students.flatMap(student=>student.subjects))).sort();
  const router=useRouter();

  useEffect(()=>{
    let active=true;
    (async()=>{
      const studentsTask=api("/api/students",{},["uploader"])
        .then(list=>{if(active)setStudents(list)})
        .catch(e=>{if(active)setError((e as Error).message)});
      const modelsTask=(async()=>{
        const faceapi=await import("face-api.js");
        await Promise.race([
          Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
            faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
          ]),
          new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("模型加载超时，请检查网络后重试")),30000)),
        ]);
        if(active)setReady(true);
      })().catch(e=>{if(active)setError(`人脸识别尚未就绪：${(e as Error).message}`)});
      await Promise.all([studentsTask,modelsTask]);
    })();
    return()=>{active=false};
  },[]);
  useEffect(()=>{
    if(video.current&&stream)video.current.srcObject=stream;
    return()=>{stream?.getTracks().forEach(track=>track.stop())};
  },[stream]);

  async function startCamera(mode: "environment"|"user" = cameraMode){
    setError("");
    try{
      stream?.getTracks().forEach(track=>track.stop());
      const nextStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:mode}},audio:false});
      setStream(nextStream);
      setCameraMode(mode);
    }catch{setError("无法访问摄像头。请在浏览器中允许相机权限后重试，或检查设备是否支持该摄像头。")}
  }

  async function switchCamera(){
    await startCamera(cameraMode === "environment" ? "user" : "environment");
  }

  function capture():Promise<Blob>{
    return new Promise((resolve,reject)=>{
      const element=video.current;
      if(!element||!element.videoWidth)return reject(new Error("请先开启摄像头"));
      const canvas=document.createElement("canvas");
      const scale=Math.min(1,640/Math.max(element.videoWidth,element.videoHeight));
      canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);
      canvas.getContext("2d")!.drawImage(element,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("照片处理失败，请重拍")),"image/jpeg",.8);
    });
  }

  async function submit(studentId?:number, forcedSubject?:string, saved?:{photo:Blob;embedding:string}){
    setError("");setResult("");setBusy(true);
    let capturedPhoto=saved?.photo;
    let capturedEmbedding=saved?.embedding;
    try{
      if(!sessionSubject)throw new Error("请先选择本场签到科目。");
      if(!ready&&!studentId)throw new Error("人脸识别尚未就绪。你仍可选择学生后人工签到。 ");
      const photo=capturedPhoto??await capture();
      let descriptor:Float32Array|undefined;
      if(ready&&!capturedEmbedding){
        const faceapi=await import("face-api.js");
        const match=await faceapi.detectSingleFace(video.current!,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        descriptor=match?.descriptor;
      }
      if(!capturedEmbedding) capturedEmbedding=JSON.stringify(Array.from(descriptor||new Float32Array(128)));
      if(!descriptor&&!studentId&&!saved)throw new Error("画面里没有清晰的人脸，请调整位置后重拍，或手动选择学生。");
      const form=new FormData();
      form.append("photo",photo,"checkin.jpg");
      form.append("embedding",capturedEmbedding);
      if(studentId)form.append("student_id",String(studentId));
      form.append("subject",forcedSubject||sessionSubject);
      const data=await api("/api/checkins",{method:"POST",body:form},["uploader"]);
      setPendingSubject(undefined);
      setResult(`签到成功 · ${data.grade} ${data.name} · ${data.subject}`);
    }catch(e){
      if(e instanceof ApiError && e.status===409 && typeof e.detail === "object" && e.detail && (e.detail as {code?:string}).code === "SUBJECT_REQUIRED" && capturedPhoto && capturedEmbedding){
        const detail=e.detail as {student_id:number;display_name:string;subjects:string[];distance:number|null};
        setPendingSubject({photo:capturedPhoto,embedding:capturedEmbedding,studentId:detail.student_id,displayName:detail.display_name,subjects:detail.subjects,distance:detail.distance});
        setError("已识别到学生，请选择本次补课科目后提交。");
      }else if(e instanceof ApiError && e.status===409 && typeof e.detail === "object" && e.detail && (e.detail as {code?:string}).code === "STUDENT_AMBIGUOUS"){
        setError("照片对应多个相似的学生资料，请在右侧手动选择学生和科目后签到。");
      }else setError((e as Error).message)
    }finally{setBusy(false)}
  }

  return <>
    <PageHeader section="拍照签到" />
    <main className="page">
      <div className="page-heading">
          <div><p className="eyebrow">到课登记</p><div className="title-with-field"><h1>拍照签到</h1><select className="title-select" aria-label="本场签到科目" value={sessionSubject} onChange={e=>{setSessionSubject(e.target.value);setManual("");setManualSubject("");setPendingSubject(undefined);setError("")}}><option value="">选择签到科目</option>{sessionSubjects.map(subject=><option key={subject}>{subject}</option>)}</select></div><p className="heading-note">先选择本场科目，再让学生面向镜头完成签到。</p></div>
      </div>
      <div className="camera-layout">
        <section className="camera-column" aria-label="摄像头拍照">
          <div className={`viewfinder${stream?" viewfinder-live":""}`}>
            {stream&&<video className="camera" ref={video} autoPlay playsInline muted />}
            <span className="finder-corner finder-top-right" /><span className="finder-corner finder-bottom-left" />
            {!stream&&<p className="finder-message">镜头尚未开启</p>}
          </div>
          <div className="camera-actions">
            <button className="secondary-button" type="button" onClick={()=>startCamera()}>{stream?"重新连接摄像头":"开启摄像头"}</button>
            {stream&&<button className="secondary-button" type="button" onClick={switchCamera} disabled={busy}>切换{cameraMode === "environment" ? "前置" : "后置"}摄像头</button>}
            <button className="primary-button" type="button" disabled={!stream||!sessionSubject||busy} onClick={()=>submit()}>{busy?"正在识别…":result?"再拍一张":"拍照并识别"}</button>
          </div>
          <p className="camera-state"><span className={`state-dot${ready?" state-dot-ready":""}`} />{ready?"人脸识别已就绪":"正在准备人脸识别"}</p>
          {error&&<p className="form-error" role="alert">{error}</p>}
          {result&&<p className="form-success" role="status">{result}</p>}
          {pendingSubject&&<div className="subject-confirm">
            <p className="manual-note">识别到：{pendingSubject.displayName}</p>
            <label className="field">本次补课科目<select className="select-control" value={manualSubject} onChange={e=>setManualSubject(e.target.value)}><option value="">选择科目</option>{pendingSubject.subjects.map(subject=><option key={subject}>{subject}</option>)}</select></label>
            <button className="primary-button" type="button" disabled={!manualSubject||busy} onClick={()=>submit(pendingSubject.studentId,manualSubject,pendingSubject)}>确认签到</button>
          </div>}
        </section>
        <section className="manual-panel">
          <p className="eyebrow">备用方式</p>
          <h2 className="rule-title">手动选择学生</h2>
          <p className="heading-note">识别不到时，可用当前镜头画面完成签到。</p>
          <label className="field" htmlFor="student-choice">学生
            <select className="select-control" id="student-choice" value={manual} onChange={e=>{setManual(e.target.value);setManualSubject("")}}>
              <option value="">选择年级和姓名</option>
              {sessionStudents.map(student=><option key={student.id} value={student.id}>{student.grade} · {student.display_name}</option>)}
            </select>
          </label>
          <button className="secondary-button" type="button" disabled={!stream||!sessionSubject||!manual||busy} onClick={()=>submit(Number(manual),sessionSubject)}>按所选学生签到</button>
          <hr className="section-line" />
          <p className="manual-note">每次签到都会保存一张照片。学生每天可签到多次，记录保留最近十次。</p>
        </section>
      </div>
    </main>
  </>;
}
