"use client";

import {useEffect,useId,useRef,useState} from "react";

type DropdownFieldProps={
  label:string;
  placeholder:string;
  options:string[];
  value:string[];
  multiple?:boolean;
  clearLabel?:string;
  onChange:(value:string[])=>void;
};

export default function DropdownField({label,placeholder,options,value,multiple=false,clearLabel,onChange}:DropdownFieldProps){
  const id=useId();
  const [open,setOpen]=useState(false);
  const fieldRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const optionRefs=useRef<(HTMLButtonElement|null)[]>([]);
  const choices=clearLabel?["",...options]:options;

  useEffect(()=>{
    if(!open)return;
    const selectedIndex=choices.findIndex(option=>value.includes(option));
    optionRefs.current[Math.max(0,selectedIndex)]?.focus();
    function closeOutside(event:PointerEvent){
      if(!fieldRef.current?.contains(event.target as Node))setOpen(false);
    }
    document.addEventListener("pointerdown",closeOutside);
    return()=>document.removeEventListener("pointerdown",closeOutside);
  },[open]);

  function close(){setOpen(false);triggerRef.current?.focus()}
  function select(option:string){
    onChange(option===""?[]:multiple?(value.includes(option)?value.filter(item=>item!==option):[...value,option]):[option]);
    if(!multiple)close();
  }

  return <div className={`field dropdown-field${open?" dropdown-field-open":""}`} ref={fieldRef}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false)}}
    onKeyDown={event=>{if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();close()}}}>
    <span id={`${id}-label`}>{label}</span>
    <button ref={triggerRef} type="button" className="dropdown-trigger" aria-labelledby={`${id}-label ${id}-value`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open?`${id}-menu`:undefined}
      onClick={()=>setOpen(current=>!current)}
      onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setOpen(true)}}}>
      <span id={`${id}-value`} className={`dropdown-trigger-text${value.length?"":" dropdown-placeholder"}`} title={value.join("、")}>{value.length?value.join("、"):placeholder}</span>
      <svg className="dropdown-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open&&<div id={`${id}-menu`} className="dropdown-menu" role="listbox" aria-labelledby={`${id}-label`} aria-multiselectable={multiple}>
      {choices.map((option,index)=>{
        const checked=value.includes(option)||(option===""&&value.length===0);
        return <button key={option} ref={element=>{optionRefs.current[index]=element}} type="button" role="option"
          tabIndex={-1} aria-selected={checked} className="dropdown-option" onClick={()=>select(option)}
          onKeyDown={event=>{
            let next=index;
            if(event.key==="ArrowDown")next=(index+1)%choices.length;
            else if(event.key==="ArrowUp")next=(index-1+choices.length)%choices.length;
            else if(event.key==="Home")next=0;
            else if(event.key==="End")next=choices.length-1;
            else return;
            event.preventDefault();optionRefs.current[next]?.focus();
          }}>
          <span className={`dropdown-check${checked?" dropdown-check-checked":""}`} aria-hidden="true">{checked?"✓":""}</span>
          <span>{option||clearLabel}</span>
        </button>;
      })}
    </div>}
  </div>;
}
