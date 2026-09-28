"use client";
import {useRouter} from "next/navigation";
import {logout} from "../lib/api";

export default function PageHeader({section}:{section?:string}){
  const router=useRouter();
  function exit(){logout();router.push("/")}
  return <header className="site-header">
    <a className="brand" href="/" aria-label="到课登记首页">
      <span className="brand-mark">到</span>
      <span className="brand-name">到课<span className="brand-note">CLASS ROLL</span></span>
    </a>
    {section&&<div className="header-tools"><span className="header-label">{section}</span><button className="header-action" onClick={exit}>退出</button></div>}
  </header>
}
