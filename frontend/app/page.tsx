"use client";
import { useState } from "react";
import { login } from "../lib/api";
import { useRouter } from "next/navigation";
import PageHeader from "../components/PageHeader";

type Role = "viewer" | "uploader" | "admin";
const roles: {id:Role;label:string;destination:string;action:string}[] = [
  {id:"viewer",label:"看记录",destination:"/records",action:"查看签到记录"},
  {id:"uploader",label:"去签到",destination:"/check-in",action:"开始拍照签到"},
  {id:"admin",label:"管学生",destination:"/admin",action:"进入学生管理"},
];

export default function Home(){
  const [role,setRole]=useState<Role>("uploader");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");setBusy(true);
    try{await login(role,password);router.push(roles.find(item=>item.id===role)!.destination)}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <>
    <PageHeader />
    <main className="page page-narrow">
      <div className="page-heading">
        <div><p className="eyebrow">补习班 · 到课登记</p><h1>进入签到簿</h1><p className="heading-note">选择入口，输入对应密码。</p></div>
      </div>
      <form className="login-form" onSubmit={submit}>
        <div className="role-switch" role="group" aria-label="选择使用入口">
          {roles.map(item=><button key={item.id} type="button" className="role-option" aria-pressed={role===item.id} onClick={()=>{setRole(item.id);setError("")}}>{item.label}</button>)}
        </div>
        <label className="field" htmlFor="access-password">{role==="viewer"?"查看密码":role==="uploader"?"签到密码":"管理员密码"}
          <input id="access-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="输入密码" required />
        </label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" type="submit" disabled={busy}>{busy?"正在验证…":roles.find(item=>item.id===role)!.action}</button>
      </form>
    </main>
  </>;
}
