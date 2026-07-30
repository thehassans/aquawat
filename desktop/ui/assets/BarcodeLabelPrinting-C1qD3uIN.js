import{b as J,j as e}from"./query-vendor-B_z9eiNn.js";import{r as l}from"./react-vendor-BmJKYk98.js";import{b as K}from"./redux-vendor-CnbZID3Y.js";import{B as U}from"./react-barcode-B8MTHmOc.js";import{z as C}from"./toast-vendor-DP8vs6BM.js";import{c as V}from"./index-Cqk0fjUp.js";import{ar as Y,s as Z,$ as X,t as ee,cg as te,bf as ae,aj as T,ap as se,aA as re,b as ie,K as le,aI as de}from"./ui-vendor-DbBEut09.js";import"./chart-vendor-MGI3x13p.js";import"./axios-vendor-B9ygI19o.js";const u=[{id:"30x20",label:"30×20mm",width:30,height:20,nameSize:8,priceSize:8,barcodeHeight:15,barcodeWidth:1,fontSize:7},{id:"38x25",label:"38×25mm",width:38,height:25,nameSize:9,priceSize:9,barcodeHeight:20,barcodeWidth:1.2,fontSize:8},{id:"50x30",label:"50×30mm",width:50,height:30,nameSize:11,priceSize:10,barcodeHeight:25,barcodeWidth:1.5,fontSize:9},{id:"60x40",label:"60×40mm",width:60,height:40,nameSize:13,priceSize:12,barcodeHeight:30,barcodeWidth:1.8,fontSize:10}],L=[{id:"individual",label:"Individual (one per page)",cols:1},{id:"grid-3",label:"Grid 3 cols (sheet)",cols:3},{id:"grid-4",label:"Grid 4 cols (sheet)",cols:4}];function ne({item:d,size:o,showName:k,showPrice:r,showArabic:m,showBarcodeText:x}){var v,p,j;const n=u.find(y=>y.id===o)||u[1],c=2.5;return e.jsxs("div",{style:{width:`${n.width*c}mm`,height:`${n.height*c}mm`,fontSize:`${n.nameSize*c}px`},className:"flex flex-col items-center justify-center bg-white border border-gray-300 rounded overflow-hidden px-1",children:[k&&e.jsx("div",{className:"font-bold text-center leading-tight truncate w-full",style:{fontSize:`${n.nameSize*c}px`},children:d.name}),m&&d.nameAr&&e.jsx("div",{className:"text-center leading-tight truncate w-full",style:{fontSize:`${(n.nameSize-1)*c}px`},dir:"rtl",children:d.nameAr}),r&&e.jsxs("div",{className:"font-bold",style:{fontSize:`${n.priceSize*c}px`},children:["SAR ",(v=d.retailPrice)==null?void 0:v.toFixed(2)]}),e.jsx("div",{className:"flex justify-center w-full",children:e.jsx(U,{value:d.primaryBarcode||"000000",format:((p=d.primaryBarcode)==null?void 0:p.length)===13?"EAN13":((j=d.primaryBarcode)==null?void 0:j.length)===8?"EAN8":"CODE128",width:n.barcodeWidth,height:n.barcodeHeight*c*.5,fontSize:x?n.fontSize:0,margin:0,displayValue:x})})]})}function be(){var Q;const{language:d}=K(t=>t.ui),[o,k]=l.useState(""),[r,m]=l.useState([]),[x,n]=l.useState("38x25"),[c,v]=l.useState("grid-3"),[p,j]=l.useState(!0),[y,H]=l.useState(!0),[S,F]=l.useState(!1),[z,R]=l.useState(!0),[h,W]=l.useState(""),B=l.useRef(null),{data:b=[],isLoading:M}=J({queryKey:["bakala-products-all"],queryFn:()=>V.get("/bakala-products",{params:{limit:500}}).then(t=>t.data)}),q=l.useMemo(()=>{const t=new Set;return b.forEach(a=>{a.category&&t.add(a.category)}),Array.from(t).sort()},[b]),A=l.useMemo(()=>{let t=b;if(h&&(t=t.filter(a=>a.category===h)),o){const a=o.toLowerCase();t=t.filter(s=>{var g,w,f;return((g=s.name)==null?void 0:g.toLowerCase().includes(a))||((w=s.primaryBarcode)==null?void 0:w.includes(a))||((f=s.nameAr)==null?void 0:f.includes(o))})}return t.slice(0,100)},[b,o,h]),E=t=>{const a=r.find(s=>s._id===t._id);m(a?r.map(s=>s._id===t._id?{...s,printQty:s.printQty+1}:s):[...r,{...t,printQty:1}])},G=()=>{if(!h)return C.error("Select a category first");const t=b.filter(a=>a.category===h);t.forEach(a=>E(a)),C.success(`Added ${t.length} products from ${h}`)},$=(t,a)=>{a<=0?m(r.filter(s=>s._id!==t)):m(r.map(s=>s._id===t?{...s,printQty:a}:s))},O=()=>m([]),N=r.reduce((t,a)=>t+a.printQty,0),D=()=>{if(r.length===0)return C.error("Add items to print queue first");if(!B.current)return;const t=u.find(i=>i.id===x)||u[1],s=(L.find(i=>i.id===c)||L[1]).cols,g=[];r.forEach(i=>{for(let I=0;I<i.printQty;I++)g.push(i)});const w=g.map(i=>`
      <div class="label-cell" style="width: ${t.width}mm; height: ${t.height}mm;">
        ${p?`<div class="name">${P(i.name||"")}</div>`:""}
        ${S&&i.nameAr?`<div class="name-ar" dir="rtl">${P(i.nameAr)}</div>`:""}
        ${y?`<div class="price">SAR ${(i.retailPrice||0).toFixed(2)}</div>`:""}
        <div class="barcode-wrapper">
          <svg class="barcode-svg" data-value="${P(i.primaryBarcode||"000000")}"
            data-format="${(i.primaryBarcode||"").length===13?"EAN13":(i.primaryBarcode||"").length===8?"EAN8":"CODE128"}"
            data-width="${t.barcodeWidth}" data-height="${t.barcodeHeight}"
            data-font="${t.fontSize}" data-display="${z}">
          </svg>
        </div>
      </div>
    `).join(""),f=window.open("","_blank");f.document.write(`
      <html>
        <head>
          <title>Print Labels - ${N} labels</title>
          <style>
            @page { size: auto; margin: 5mm; }
            body { font-family: 'Inter', 'Arial', sans-serif; margin: 0; padding: 0; color: #000; }
            .labels-grid {
              display: grid;
              grid-template-columns: repeat(${s}, ${t.width}mm);
              gap: 2mm;
              justify-content: start;
            }
            .label-cell {
              width: ${t.width}mm;
              height: ${t.height}mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              overflow: hidden;
              border: 0.5px solid #ddd;
              border-radius: 1mm;
              padding: 0.5mm;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .name { font-weight: 900; font-size: ${t.nameSize}px; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; }
            .name-ar { font-size: ${t.nameSize-1}px; line-height: 1.1; max-width: 100%; overflow: hidden; }
            .price { font-size: ${t.priceSize}px; font-weight: bold; margin: 0.5mm 0; }
            .barcode-wrapper { display: flex; justify-content: center; align-items: center; }
            .barcode-wrapper svg { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <div class="labels-grid">${w}</div>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
          <script>
            document.querySelectorAll('.barcode-svg').forEach(function(svg) {
              var value = svg.getAttribute('data-value');
              var format = svg.getAttribute('data-format');
              var width = parseFloat(svg.getAttribute('data-width'));
              var height = parseInt(svg.getAttribute('data-height'));
              var fontSize = parseInt(svg.getAttribute('data-font'));
              var display = svg.getAttribute('data-display') === 'true';
              try {
                JsBarcode(svg, value, {
                  format: format,
                  width: width,
                  height: height,
                  fontSize: fontSize,
                  margin: 0,
                  displayValue: display,
                });
              } catch(e) {
                svg.textContent = 'Invalid barcode';
              }
            });
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 500);
            };
          <\/script>
        </body>
      </html>
    `),f.document.close()};function P(t){const a=document.createElement("div");return a.textContent=t,a.innerHTML}const _=r[0]||A[0];return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl font-bold text-gray-900 dark:text-white",children:d==="ar"?"طباعة الباركود والملصقات":"Barcode & Label Printing"}),e.jsx("p",{className:"text-gray-500 dark:text-gray-400 mt-1",children:d==="ar"?"طباعة ملصقات المنتجات بالباركود":"Generate and print product barcode labels"})]}),e.jsxs("button",{onClick:D,disabled:!r.length,className:"btn btn-action-dark flex items-center gap-1.5 disabled:opacity-50",children:[e.jsx(Y,{className:"w-4 h-4"}),d==="ar"?"طباعة":"Print"," (",N,")"]})]}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[e.jsxs("div",{className:"lg:col-span-2 space-y-4",children:[e.jsx("div",{className:"card p-4 space-y-3",children:e.jsxs("div",{className:"flex gap-2",children:[e.jsxs("div",{className:"relative flex-1",children:[e.jsx(Z,{className:"absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"}),e.jsx("input",{type:"text",placeholder:"Search by name or barcode...",value:o,onChange:t=>k(t.target.value),className:"input pl-9"})]}),e.jsxs("select",{value:h,onChange:t=>W(t.target.value),className:"select w-auto",children:[e.jsx("option",{value:"",children:"All categories"}),q.map(t=>e.jsx("option",{value:t,children:t},t))]}),e.jsxs("button",{onClick:G,className:"btn btn-secondary flex items-center gap-1 whitespace-nowrap",children:[e.jsx(X,{className:"w-4 h-4"})," Add Category"]})]})}),e.jsx("div",{className:"card overflow-hidden",children:M?e.jsx("div",{className:"flex justify-center p-8",children:e.jsx(ee,{className:"w-5 h-5 animate-spin text-primary-500"})}):A.length===0?e.jsxs("div",{className:"p-8 text-center text-gray-400",children:[e.jsx(te,{className:"w-8 h-8 mx-auto mb-2 opacity-40"}),e.jsx("p",{className:"text-sm",children:"No products found"})]}):e.jsx("div",{className:"overflow-x-auto max-h-[400px] overflow-y-auto",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:"bg-gray-50 dark:bg-dark-800 sticky top-0",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase",children:"Product"}),e.jsx("th",{className:"px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase",children:"Barcode"}),e.jsx("th",{className:"px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase",children:"Price"}),e.jsx("th",{className:"px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase",children:"Action"})]})}),e.jsx("tbody",{className:"divide-y divide-gray-200 dark:divide-dark-700",children:A.map(t=>{var s;const a=r.find(g=>g._id===t._id);return e.jsxs("tr",{className:"hover:bg-gray-50 dark:hover:bg-dark-800",children:[e.jsxs("td",{className:"px-4 py-2",children:[e.jsx("p",{className:"text-sm font-medium text-gray-900 dark:text-white",children:t.name}),t.nameAr&&e.jsx("p",{className:"text-xs text-gray-400",dir:"rtl",children:t.nameAr})]}),e.jsx("td",{className:"px-4 py-2 text-sm text-gray-500 font-mono",children:t.primaryBarcode}),e.jsx("td",{className:"px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300",children:(s=t.retailPrice)==null?void 0:s.toFixed(2)}),e.jsx("td",{className:"px-4 py-2 text-center",children:e.jsx("button",{onClick:()=>E(t),className:`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${a?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400":"bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"}`,children:a?e.jsx(ae,{className:"w-3 h-3 inline"}):e.jsx(T,{className:"w-3 h-3 inline"})})})]},t._id)})})]})})}),r.length>0&&e.jsxs("div",{className:"card overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700",children:[e.jsxs("h3",{className:"text-sm font-semibold text-gray-700 dark:text-gray-300",children:["Print Queue (",r.length," items, ",N," labels)"]}),e.jsxs("button",{onClick:O,className:"text-xs text-red-500 hover:underline flex items-center gap-1",children:[e.jsx(se,{className:"w-3 h-3"})," Clear All"]})]}),e.jsx("div",{className:"divide-y divide-gray-200 dark:divide-dark-700 max-h-[300px] overflow-y-auto",children:r.map(t=>{var a;return e.jsxs("div",{className:"flex items-center justify-between px-4 py-2.5",children:[e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-sm font-medium text-gray-900 dark:text-white truncate",children:t.name}),e.jsxs("p",{className:"text-xs text-gray-400 font-mono",children:[t.primaryBarcode," · SAR ",(a=t.retailPrice)==null?void 0:a.toFixed(2)]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("button",{onClick:()=>$(t._id,t.printQty-1),className:"p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700",children:e.jsx(re,{className:"w-3.5 h-3.5"})}),e.jsx("input",{type:"number",min:"0",value:t.printQty,onChange:s=>$(t._id,parseInt(s.target.value)||0),className:"w-14 px-2 py-1 border border-gray-300 dark:border-dark-600 rounded text-sm text-center bg-white dark:bg-dark-800"}),e.jsx("button",{onClick:()=>$(t._id,t.printQty+1),className:"p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700",children:e.jsx(T,{className:"w-3.5 h-3.5"})})]})]},t._id)})})]})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"card p-4 space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(ie,{className:"w-4 h-4 text-primary-500"}),e.jsx("h3",{className:"text-sm font-semibold text-gray-700 dark:text-gray-300",children:"Label Settings"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"label",children:"Label Size"}),e.jsx("div",{className:"grid grid-cols-2 gap-2",children:u.map(t=>e.jsx("button",{onClick:()=>n(t.id),className:`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${x===t.id?"bg-primary-500 text-white":"bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"}`,children:t.label},t.id))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"label",children:"Print Layout"}),e.jsx("select",{value:c,onChange:t=>v(t.target.value),className:"select",children:L.map(t=>e.jsx("option",{value:t.id,children:t.label},t.id))})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx("label",{className:"label",children:"Content"}),[{key:"name",label:"Product Name",val:p,set:j},{key:"arabic",label:"Arabic Name",val:S,set:F},{key:"price",label:"Price",val:y,set:H},{key:"barcodeText",label:"Barcode Text",val:z,set:R}].map(t=>e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:t.val,onChange:a=>t.set(a.target.checked),className:"w-4 h-4 rounded"}),e.jsx("span",{className:"text-sm text-gray-600 dark:text-gray-300",children:t.label})]},t.key))]})]}),e.jsxs("div",{className:"card p-4",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx(le,{className:"w-4 h-4 text-primary-500"}),e.jsx("h3",{className:"text-sm font-semibold text-gray-700 dark:text-gray-300",children:"Live Preview"})]}),_?e.jsxs("div",{className:"flex flex-col items-center gap-2",children:[e.jsx("div",{className:"bg-gray-50 dark:bg-dark-900/50 rounded-xl p-4 flex items-center justify-center",children:e.jsx(ne,{item:_,size:x,showName:p,showPrice:y,showArabic:S,showBarcodeText:z})}),e.jsxs("p",{className:"text-xs text-gray-400 text-center",children:[(Q=u.find(t=>t.id===x))==null?void 0:Q.label," · ",N," labels to print"]})]}):e.jsxs("div",{className:"flex flex-col items-center justify-center py-8 text-gray-400",children:[e.jsx(de,{className:"w-8 h-8 mb-2 opacity-40"}),e.jsx("p",{className:"text-xs",children:"Select a product to preview"})]})]})]})]}),e.jsx("div",{className:"hidden",ref:B})]})}export{be as default};
