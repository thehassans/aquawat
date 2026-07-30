import{u as Y,b as Z,c as q,j as e}from"./query-vendor-B_z9eiNn.js";import{r as l}from"./react-vendor-BmJKYk98.js";import{b as O}from"./redux-vendor-CnbZID3Y.js";import{z as j}from"./toast-vendor-DP8vs6BM.js";import{x as tt,c as A}from"./index-DDyi7NsM.js";import{u as et}from"./translations-CfmRQZF2.js";import{M as at}from"./Money-Czl3sdxf.js";import{g as K,e as H}from"./thermalPrinter-D3D0GQw4.js";import{ar as st,af as nt,ag as C,p as it,a2 as U,a3 as rt}from"./ui-vendor-DbBEut09.js";import{m as dt}from"./motion-vendor-DTL3CJUj.js";import"./axios-vendor-B9ygI19o.js";import"./currency-CcPBzC3g.js";import"./invoiceBranding-c8o-cvxh.js";import"./SarIcon-BNiyVm7d.js";function E(o){if(!o)return"-";try{return new Date(o).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}catch{return"-"}}function z(o){var f;const s=document.createElement("iframe");s.style.position="fixed",s.style.right="0",s.style.bottom="0",s.style.width="0",s.style.height="0",s.style.border="0",document.body.appendChild(s);const r=(f=s.contentWindow)==null?void 0:f.document;if(!r)return;r.open(),r.write(o),r.close();const u=s.contentWindow;u&&(u.focus(),u.print(),setTimeout(()=>{document.body.removeChild(s)},500))}function jt(){const o=Y(),{language:s}=O(t=>t.ui),{tenant:r}=O(t=>t.auth),{t:u}=et(s),f=s==="ar",[N,W]=l.useState(["new","preparing","ready"]),[x,B]=l.useState(()=>localStorage.getItem("kitchenAutoPrint")==="true"),[I,$]=l.useState(new Set),R=l.useRef(!1),k=l.useRef(new Set),{data:S,isLoading:T,refetch:G,isFetching:L}=Z({queryKey:["restaurant-kitchen",N],queryFn:()=>A.get("/restaurant/orders/kitchen",{params:{statuses:N.join(",")}}).then(t=>t.data),refetchInterval:5e3,refetchIntervalInBackground:!0}),m=(S==null?void 0:S.orders)||[],h=q({mutationFn:({id:t,kitchenStatus:a})=>A.put(`/restaurant/orders/${t}/kitchen-status`,{kitchenStatus:a}).then(n=>n.data),onSuccess:()=>{o.invalidateQueries(["restaurant-kitchen"]),o.invalidateQueries(["restaurant-orders"])},onError:t=>{var a,n;return j.error(((n=(a=t.response)==null?void 0:a.data)==null?void 0:n.error)||"Error")}}),F=q({mutationFn:t=>A.post(`/restaurant/orders/${t}/kitchen-ticket/printed`).then(a=>a.data),onSuccess:()=>{o.invalidateQueries(["restaurant-kitchen"])},onError:t=>{var a,n;return j.error(((n=(a=t.response)==null?void 0:a.data)==null?void 0:n.error)||"Error")}});l.useEffect(()=>{localStorage.setItem("kitchenAutoPrint",x)},[x]),l.useEffect(()=>{!T&&!R.current&&(R.current=!0,m.forEach(t=>k.current.add(t._id)))},[T,m]),l.useEffect(()=>{if(!x)return;const t=m.filter(a=>a.kitchenStatus==="new"&&!a.kitchenPrintedAt&&!I.has(a._id)&&!k.current.has(a._id));t.length>0&&t.forEach(a=>{k.current.add(a._id),$(n=>new Set([...n,a._id]));try{z(D(a)),F.mutate(a._id,{onSettled:()=>{$(n=>{const d=new Set(n);return d.delete(a._id),d})}})}catch(n){console.error("Auto print error",n),$(d=>{const p=new Set(d);return p.delete(a._id),p})}})},[m,x,I]);const J=l.useMemo(()=>[{key:"new",labelEn:"New",labelAr:"جديد"},{key:"preparing",labelEn:"Preparing",labelAr:"قيد التحضير"},{key:"ready",labelEn:"Ready",labelAr:"جاهز"},{key:"served",labelEn:"Served",labelAr:"تم التقديم"}],[]),D=t=>{var Q;const a=s==="ar",n=((t==null?void 0:t.lineItems)||[]).map(c=>{const X=a&&(c==null?void 0:c.nameAr)||(c==null?void 0:c.name);return`<tr><td style="padding:6px 0;">${String(X||"")}</td><td style="padding:6px 0;text-align:end;">${Number((c==null?void 0:c.quantity)||0)}</td></tr>`}).join(""),d=a?"تذكرة المطبخ":"Kitchen Ticket",p=a?"الطاولة":"Table",P=a?"الطلب":"Order",g=a?"الوقت":"Time",v=a?"النوع":"Type",i=a?"العميل":"Customer",_={dine_in:a?"محلي":"Dine In",takeaway:a?"سفري":"Takeaway",delivery:a?"توصيل":"Delivery"}[t==null?void 0:t.orderType]||(t==null?void 0:t.orderType),b=tt(((Q=r==null?void 0:r.branding)==null?void 0:Q.logoUrl)||""),w=K(r),y=H(w);return`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${d}</title>
<style>
@media print {
  @page { margin: 0; size: ${y} auto; }
  body { width: ${y}; margin: 0 auto; padding: 10px; }
}
body{font-family:Arial, sans-serif; margin:0; padding:14px; max-width:${y}; margin: 0 auto;}
.header{text-align:center; margin-bottom:12px;}
.logo{max-width:80px; max-height:80px; margin-bottom:8px; filter:grayscale(100%);}
.order-block{border:2px solid #000; padding:8px; text-align:center; margin-bottom:12px; border-radius:4px;}
.order-num{font-size:24px; font-weight:900; margin:4px 0;}
.order-label{font-size:12px; font-weight:bold; text-transform:uppercase;}
.k{font-size:18px; font-weight:900; text-align:center; margin-bottom:8px;}
.meta{font-size:12px; color:#111; margin-bottom:12px;}
.meta-grid{display:grid; grid-template-columns:1fr 1fr; gap:6px;}
table{width:100%; border-collapse:collapse; margin-top:8px;}
th{font-size:14px; text-align:start; border-bottom:1px dashed #000; padding-bottom:6px; font-weight:bold;}
td{font-size:14px; padding:8px 0; font-weight:bold; border-bottom:1px dashed #ddd;}
</style>
</head>
<body dir="${a?"rtl":"ltr"}">
  <div class="header">
    ${b?`<img src="${b}" class="logo" />`:""}
    <div class="k">${d}</div>
  </div>
  
  <div class="order-block">
    <div class="order-label">${P}</div>
    <div class="order-num">${(t==null?void 0:t.orderNumber)||""}</div>
  </div>

  <div class="meta">
    <div class="meta-grid">
      <div><strong>${v}:</strong> ${_}</div>
      ${(t==null?void 0:t.orderType)==="dine_in"?`<div><strong>${p}:</strong> ${(t==null?void 0:t.tableNumber)||"-"}</div>`:""}
    </div>
    <div style="margin-top:6px;"><strong>${g}:</strong> ${E(t==null?void 0:t.createdAt)}</div>
    ${t!=null&&t.customerName?`<div style="margin-top:6px;"><strong>${i}:</strong> ${t==null?void 0:t.customerName} ${t!=null&&t.customerPhone?"("+(t==null?void 0:t.customerPhone)+")":""}</div>`:""}
  </div>

  <table>
    <thead>
      <tr>
        <th>${a?"الصنف":"Item"}</th>
        <th style="text-align:end;">${a?"الكمية":"Qty"}</th>
      </tr>
    </thead>
    <tbody>
      ${n}
    </tbody>
  </table>

  <script>window.onafterprint = () => window.close && window.close();<\/script>
</body>
</html>`},V=t=>{var v;const a=s==="ar",n=((t==null?void 0:t.lineItems)||[]).map(i=>{const _=a&&(i==null?void 0:i.nameAr)||(i==null?void 0:i.name),b=Number((i==null?void 0:i.quantity)||0),w=Number((i==null?void 0:i.unitPrice)||0),y=b*w;return`<tr><td style="padding:6px 0;">${String(_||"")}</td><td style="padding:6px 0;text-align:end;">${b}</td><td style="padding:6px 0;text-align:end;">${w.toFixed(2)}</td><td style="padding:6px 0;text-align:end;">${y.toFixed(2)}</td></tr>`}).join(""),d=a?"إيصال":"Receipt",p=((v=r==null?void 0:r.branding)==null?void 0:v.logoUrl)||"",P=K(r),g=H(P);return`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${d}</title>
<style>
@media print {
  @page { margin: 0; size: ${g} auto; }
  body { width: ${g}; margin: 0 auto; padding: 10px; }
}
body{font-family:Arial, sans-serif; margin:0; padding:14px; max-width:${g}; margin: 0 auto;}
.header{text-align:center; margin-bottom:12px;}
.logo{max-width:80px; max-height:80px; margin-bottom:8px; filter:grayscale(100%);}
.k{font-size:18px; font-weight:700;}
.meta{font-size:12px; color:#111;}
table{width:100%; border-collapse:collapse; margin-top:12px;}
th{font-size:12px; text-align:start; border-bottom:1px solid #ddd; padding-bottom:6px;}
.tot{margin-top:10px; display:flex; justify-content:flex-end;}
.tot div{width:220px; font-size:12px;}
.row{display:flex; justify-content:space-between; padding:4px 0;}
.bold{font-weight:700;}
</style>
</head>
<body dir="${a?"rtl":"ltr"}">
  <div class="header">
    ${p?`<img src="${p}" class="logo" />`:""}
    <div class="k">${d}</div>
  </div>
  <div class="meta">
    <div>${a?"الطلب":"Order"}: <strong>${(t==null?void 0:t.orderNumber)||""}</strong></div>
    ${(t==null?void 0:t.orderType)==="dine_in"?`<div>${a?"الطاولة":"Table"}: <strong>${(t==null?void 0:t.tableNumber)||"-"}</strong></div>`:""}
    <div>${a?"الوقت":"Time"}: ${E(t==null?void 0:t.createdAt)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>${a?"الصنف":"Item"}</th>
        <th style="text-align:end;">${a?"الكمية":"Qty"}</th>
        <th style="text-align:end;">${a?"السعر":"Price"}</th>
        <th style="text-align:end;">${a?"الإجمالي":"Total"}</th>
      </tr>
    </thead>
    <tbody>
      ${n}
    </tbody>
  </table>

  <div class="tot">
    <div>
      <div class="row"><span>${a?"المجموع":"Subtotal"}</span><span>${Number((t==null?void 0:t.subtotal)||0).toFixed(2)}</span></div>
      <div class="row"><span>${a?"الضريبة":"Tax"}</span><span>${Number((t==null?void 0:t.totalTax)||0).toFixed(2)}</span></div>
      <div class="row bold"><span>${a?"الإجمالي":"Total"}</span><span>${Number((t==null?void 0:t.grandTotal)||0).toFixed(2)}</span></div>
    </div>
  </div>

  <script>window.onafterprint = () => window.close && window.close();<\/script>
</body>
</html>`},M=t=>{const a=J.find(n=>n.key===t);return a?s==="ar"?a.labelAr:a.labelEn:t||"-"};return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold text-gray-900 dark:text-white",children:s==="ar"?"شاشة المطبخ":"Kitchen Screen"}),e.jsx("p",{className:"text-gray-500 dark:text-gray-400 mt-1",children:s==="ar"?"إدارة تجهيز الطلبات":"Manage order preparation"})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{type:"button",onClick:()=>B(!x),className:`btn ${x?"btn-primary":"btn-secondary"} hidden sm:flex`,children:[e.jsx(st,{className:"w-4 h-4"}),f?"طباعة تلقائية":"Auto Print"]}),e.jsxs("button",{type:"button",onClick:()=>G(),disabled:L,className:"btn btn-secondary",children:[e.jsx(nt,{className:`w-4 h-4 ${L?"animate-spin":""}`}),s==="ar"?"تحديث":"Refresh"]})]})]}),e.jsx("div",{className:"card p-4",children:e.jsxs("div",{className:"flex flex-col sm:flex-row gap-3",children:[e.jsxs("div",{className:"flex-1",children:[e.jsx("div",{className:"text-sm text-gray-500 mb-2",children:s==="ar"?"الحالات":"Statuses"}),e.jsx("div",{className:"flex flex-wrap gap-2",children:["new","preparing","ready"].map(t=>{const a=N.includes(t);return e.jsx("button",{type:"button",onClick:()=>{W(n=>n.includes(t)?n.filter(d=>d!==t):n.concat(t))},className:`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${a?"bg-primary-600 border-primary-600 text-white shadow-sm":"bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700"}`,children:M(t)},t)})})]}),e.jsxs("div",{className:"sm:w-64",children:[e.jsx("div",{className:"text-sm text-gray-500 mb-2",children:s==="ar"?"عدد الطلبات":"Orders"}),e.jsx("div",{className:"text-2xl font-bold",children:m.length})]})]})}),e.jsx(dt.div,{initial:{opacity:0},animate:{opacity:1},className:"card",children:T?e.jsx("div",{className:"p-8 text-center",children:e.jsx("div",{className:"inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"})}):e.jsx("div",{className:"table-container",children:e.jsxs("table",{className:"table",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:s==="ar"?"الطلب":"Order"}),e.jsx("th",{children:s==="ar"?"النوع/العميل":"Type/Customer"}),e.jsx("th",{children:s==="ar"?"الطاولة":"Table"}),e.jsx("th",{children:s==="ar"?"الوقت":"Time"}),e.jsx("th",{children:s==="ar"?"الحالة":"Status"}),e.jsx("th",{children:s==="ar"?"المجموع":"Total"}),e.jsx("th",{children:u("actions")})]})}),e.jsxs("tbody",{children:[m.map(t=>e.jsxs("tr",{children:[e.jsx("td",{className:"font-mono text-sm",children:t.orderNumber}),e.jsxs("td",{children:[e.jsx("div",{className:"font-semibold capitalize text-sm",children:t.orderType==="dine_in"?s==="ar"?"محلي":"Dine In":t.orderType==="takeaway"?s==="ar"?"سفري":"Takeaway":s==="ar"?"توصيل":"Delivery"}),t.customerName&&e.jsx("div",{className:"text-xs text-gray-500 mt-1",children:t.customerName}),t.customerPhone&&e.jsx("div",{className:"text-xs text-gray-500",children:t.customerPhone})]}),e.jsx("td",{children:t.orderType==="dine_in"&&t.tableNumber||"-"}),e.jsx("td",{className:"text-gray-500",children:E(t.createdAt)}),e.jsx("td",{children:e.jsxs("span",{className:"badge badge-neutral capitalize inline-flex items-center gap-1",children:[t.kitchenStatus==="ready"?e.jsx(C,{className:"w-3 h-3"}):e.jsx(it,{className:"w-3 h-3"}),M(t.kitchenStatus)]})}),e.jsx("td",{className:"font-semibold",children:e.jsx(at,{value:t.grandTotal||0})}),e.jsx("td",{children:e.jsxs("div",{className:"flex flex-wrap gap-2",children:[e.jsxs("button",{type:"button",className:"btn btn-secondary",onClick:()=>{try{z(D(t)),F.mutate(t._id)}catch{j.error(s==="ar"?"فشل الطباعة":"Print failed")}},children:[e.jsx(U,{className:"w-4 h-4"}),s==="ar"?"تذكرة":"Ticket"]}),e.jsxs("button",{type:"button",className:"btn btn-secondary",onClick:()=>{try{z(V(t))}catch{j.error(s==="ar"?"فشل الطباعة":"Print failed")}},children:[e.jsx(U,{className:"w-4 h-4"}),s==="ar"?"إيصال":"Receipt"]}),t.kitchenStatus!=="preparing"&&e.jsxs("button",{type:"button",className:"btn btn-primary",onClick:()=>h.mutate({id:t._id,kitchenStatus:"preparing"}),disabled:h.isPending,children:[e.jsx(rt,{className:"w-4 h-4"}),s==="ar"?"تحضير":"Preparing"]}),t.kitchenStatus!=="ready"&&e.jsxs("button",{type:"button",className:"btn btn-primary",onClick:()=>h.mutate({id:t._id,kitchenStatus:"ready"}),disabled:h.isPending,children:[e.jsx(C,{className:"w-4 h-4"}),s==="ar"?"جاهز":"Ready"]}),t.kitchenStatus!=="served"&&e.jsxs("button",{type:"button",className:"btn btn-secondary",onClick:()=>h.mutate({id:t._id,kitchenStatus:"served"}),disabled:h.isPending,children:[e.jsx(C,{className:"w-4 h-4"}),s==="ar"?"تم":"Served"]})]})})]},t._id)),m.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:6,className:"p-8 text-center text-gray-500",children:s==="ar"?"لا توجد طلبات في المطبخ":"No kitchen orders"})})]})]})})})]})}export{jt as default};
