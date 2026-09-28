"use client";
import {useEffect,useRef,useState} from "react";
import {api} from "../../lib/api";
import {useRouter} from "next/navigation";
import PageHeader from "../../components/PageHeader";

type Student={id:number;grade:string;display_name:string;subject:string};

export default function CheckIn(){
  const video=useRef<HTMLVideoElement>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [stream,setStream]=useState<MediaStream>();
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState("");
  const [manual,setManual]=useState("");
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

  async function startCamera(){
    setError("");
    try{
      const nextStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
      setStream(nextStream);
    }catch{setError("无法访问摄像头。请在浏览器中允许相机权限后重试。")}
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

  async function submit(studentId?:number){
    setError("");setResult("");setBusy(true);
    try{
      if(!ready&&!studentId)throw new Error("人脸识别尚未就绪。你仍可选择学生后人工签到。 ");
      const photo=await capture();
      let descriptor:Float32Array|undefined;
      if(ready){
        const faceapi=await import("face-api.js");
        const match=await faceapi.detectSingleFace(video.current!,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        descriptor=match?.descriptor;
      }
      if(!descriptor&&!studentId)throw new Error("画面里没有清晰的人脸，请调整位置后重拍，或手动选择学生。");
      const form=new FormData();
      form.append("photo",photo,"checkin.jpg");
      form.append("embedding",JSON.stringify(Array.from(descriptor||new Float32Array(128))));
      if(studentId)form.append("student_id",String(studentId));
      const data=await api("/api/checkins",{method:"POST",body:form},["uploader"]);
      setResult(`签到成功 · ${data.grade} ${data.name} · ${data.subject}`);
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  return <>
    <PageHeader section="拍照签到" />
    <main className="page">
      <div className="page-heading">
        <div><p className="eyebrow">到课登记</p><h1>拍照签到</h1><p className="heading-note">让学生面向镜头，保持脸部清晰。</p></div>
      </div>
      <div className="camera-layout">
        <section className="camera-column" aria-label="摄像头拍照">
          <div className={`viewfinder${stream?" viewfinder-live":""}`}>
            {stream&&<video className="camera" ref={video} autoPlay playsInline muted />}
            <span className="finder-corner finder-top-right" /><span className="finder-corner finder-bottom-left" />
            {!stream&&<p className="finder-message">镜头尚未开启</p>}
          </div>
          <div className="camera-actions">
            <button className="secondary-button" type="button" onClick={startCamera}>{stream?"重新连接摄像头":"开启摄像头"}</button>
            <button className="primary-button" type="button" disabled={!stream||busy} onClick={()=>submit()}>{busy?"正在识别…":result?"再拍一张":"拍照并识别"}</button>
          </div>
          <p className="camera-state"><span className={`state-dot${ready?" state-dot-ready":""}`} />{ready?"人脸识别已就绪":"正在准备人脸识别"}</p>
          {error&&<p className="form-error" role="alert">{error}</p>}
          {result&&<p className="form-success" role="status">{result}</p>}
        </section>
        <section className="manual-panel">
          <p className="eyebrow">备用方式</p>
          <h2 className="rule-title">手动选择学生</h2>
          <p className="heading-note">识别不到时，可用当前镜头画面完成签到。</p>
          <label className="field" htmlFor="student-choice">学生
            <select className="select-control" id="student-choice" value={manual} onChange={e=>setManual(e.target.value)}>
              <option value="">选择年级、姓名和科目</option>
              {students.map(student=><option key={student.id} value={student.id}>{student.grade} · {student.display_name} · {student.subject}</option>)}
            </select>
          </label>
          <button className="secondary-button" type="button" disabled={!stream||!manual||busy} onClick={()=>submit(Number(manual))}>按所选学生签到</button>
          <hr className="section-line" />
          <p className="manual-note">每次签到都会保存一张照片。学生每天可签到多次，记录保留最近十次。</p>
        </section>
      </div>
    </main>
  </>;
}
