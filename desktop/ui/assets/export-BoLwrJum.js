const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./jspdf.es.min-XV_RVJ2i.js","./index-B6nsJarP.js","./query-vendor-BlUG7zU5.js","./react-vendor-Dav3622T.js","./redux-vendor-k0XloWhu.js","./toast-vendor-rXpoKmw8.js","./axios-vendor-B9ygI19o.js","./index-BbD-n_yz.css","./typeof-QjJsDpFa.js","./jspdf.plugin.autotable-BVPu26cH.js"])))=>i.map(i=>d[i]);
import{_ as y}from"./index-B6nsJarP.js";const h=t=>String(t||"export").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim(),w=t=>{if(t==null)return"";const n=String(t),l=/[",\n\r]/.test(n),s=n.replace(/"/g,'""');return l?`"${s}"`:s},x=()=>{const t=new Date,n=l=>String(l).padStart(2,"0");return`${t.getFullYear()}-${n(t.getMonth()+1)}-${n(t.getDate())}_${n(t.getHours())}${n(t.getMinutes())}`},b=({rows:t,columns:n})=>{const l=Array.isArray(t)?t:[],s=Array.isArray(n)?n:[],p=s.map(o=>o.label??o.header??o.key??""),d=l.map(o=>s.map(a=>{const e=a.value||a.getValue,r=typeof e=="function"?e(o):o==null?void 0:o[a.key],i=a.format,c=typeof i=="function"?i(r,o):r;return c??""}));return{headers:p,values:d}},v=({fileName:t,rows:n,columns:l,delimiter:s=","})=>{const p=h(t||"export"),{headers:d,values:o}=b({rows:n,columns:l}),a=[d.map(w).join(s)];for(const g of o)a.push(g.map(w).join(s));const e=`\uFEFF${a.join(`
`)}`,r=new Blob([e],{type:"text/csv;charset=utf-8;"}),i=window.URL.createObjectURL(r),c=document.createElement("a");c.href=i,c.setAttribute("download",`${p}.csv`),document.body.appendChild(c),c.click(),c.remove(),window.URL.revokeObjectURL(i)},S=async({fileName:t,rows:n,columns:l,sheetName:s="Export"})=>{const p=h(t||"export"),{headers:d,values:o}=b({rows:n,columns:l}),a=await y(()=>import("./xlsx-D_0l8YDs.js"),[],import.meta.url),e=(a==null?void 0:a.default)||a,r=[d,...o],i=e.utils.aoa_to_sheet(r),c=e.utils.book_new();e.utils.book_append_sheet(c,i,s),e.writeFile(c,`${p}.xlsx`)},E=async({fileName:t,title:n,rows:l,columns:s,orientation:p})=>{const d=h(t||"export"),{headers:o,values:a}=b({rows:l,columns:s}),e=await y(()=>import("./jspdf.es.min-XV_RVJ2i.js").then(f=>f.j),__vite__mapDeps([0,1,2,3,4,5,6,7,8]),import.meta.url),r=(e==null?void 0:e.jsPDF)||(e==null?void 0:e.default)||e,i=await y(()=>import("./jspdf.plugin.autotable-BVPu26cH.js").then(f=>f.j),__vite__mapDeps([9,3,0,1,2,4,5,6,7,8]),import.meta.url),c=(i==null?void 0:i.default)||i,g=p||(o.length>6?"landscape":"portrait"),u=new r({orientation:g,unit:"pt",format:"a4"}),m=String(n);m&&(u.setFontSize(14),u.text(m,40,40)),u.setFontSize(9),u.text(`Generated: ${new Date().toLocaleString()}`,40,m?60:40),c(u,{startY:m?80:60,head:[o],body:a.map(f=>f.map(_=>_==null?"":String(_))),styles:{fontSize:8,cellPadding:4},headStyles:{fillColor:[37,99,235]}}),u.save(`${d}.pdf`)},j=({title:t,rows:n,columns:l})=>{const{headers:s,values:p}=b({rows:n,columns:l}),d=r=>String(r).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"),o=`<tr>${s.map(r=>`<th>${d(r)}</th>`).join("")}</tr>`,a=p.map(r=>`<tr>${r.map(i=>`<td>${d(i)}</td>`).join("")}</tr>`).join(""),e=window.open("","_blank");e&&(e.document.open(),e.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${d(t)}</title>
<style>
  body{font-family:Arial, sans-serif; padding:24px;}
  h1{font-size:18px; margin:0 0 12px;}
  table{width:100%; border-collapse:collapse; font-size:12px;}
  th,td{border:1px solid #ddd; padding:8px; text-align:left; vertical-align:top;}
  th{background:#f5f5f5;}
</style>
</head>
<body>
<h1>${d(t)}</h1>
<table>
<thead>${o}</thead>
<tbody>${a}</tbody>
</table>
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`),e.document.close())},k=t=>h(`${t}_${x()}`);export{S as a,k as b,E as c,v as e,j as p};
