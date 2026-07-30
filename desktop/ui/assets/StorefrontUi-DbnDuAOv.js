import{j as t}from"./query-vendor-B_z9eiNn.js";import{r as o}from"./react-vendor-BmJKYk98.js";import{O as m,aD as h,bf as u}from"./ui-vendor-DbBEut09.js";function e({w:s="100%",h:a="20px",r:i="8px",mb:n="0"}){return t.jsx("div",{style:{width:s,height:a,borderRadius:i,marginBottom:n,background:"linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",backgroundSize:"200% 100%",animation:"sf-shimmer 1.5s infinite"}})}function g(){return t.jsxs("div",{style:{background:"#fff",border:"1px solid #e5e7eb",borderRadius:"18px",overflow:"hidden"},children:[t.jsx(e,{w:"100%",h:"0",r:"0"}),t.jsx("div",{style:{aspectRatio:"1"},children:t.jsx(e,{w:"100%",h:"100%",r:"0"})}),t.jsxs("div",{style:{padding:"16px"},children:[t.jsx(e,{w:"80%",h:"14px",mb:"10px"}),t.jsx(e,{w:"50%",h:"16px",mb:"8px"}),t.jsx(e,{w:"40%",h:"18px"})]})]})}function y({count:s=8}){return t.jsx("div",{className:"sf-grid",children:Array.from({length:s}).map((a,i)=>t.jsx(g,{},i))})}function v(){return t.jsxs("div",{style:{maxWidth:"1200px",margin:"0 auto",padding:"24px 20px"},children:[t.jsx(e,{w:"120px",h:"14px",mb:"20px"}),t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"48px"},className:"store-pd-grid",children:[t.jsxs("div",{children:[t.jsx(e,{w:"100%",h:"400px",r:"20px",mb:"14px"}),t.jsxs("div",{style:{display:"flex",gap:"10px"},children:[t.jsx(e,{w:"68px",h:"68px",r:"12px"}),t.jsx(e,{w:"68px",h:"68px",r:"12px"}),t.jsx(e,{w:"68px",h:"68px",r:"12px"})]})]}),t.jsxs("div",{children:[t.jsx(e,{w:"60px",h:"12px",mb:"12px"}),t.jsx(e,{w:"80%",h:"30px",mb:"20px"}),t.jsx(e,{w:"120px",h:"28px",mb:"24px"}),t.jsx(e,{w:"100%",h:"60px",mb:"20px"}),t.jsx(e,{w:"100%",h:"48px",mb:"16px"}),t.jsx(e,{w:"100%",h:"48px",mb:"16px"}),t.jsx(e,{w:"100%",h:"120px"})]})]})]})}const p=o.createContext(null);function k(){const s=o.useContext(p);return s||{toast:()=>{}}}function S({children:s}){const[a,i]=o.useState([]),n=o.useRef(0),d=o.useCallback((r,c="success")=>{const x=++n.current;i(l=>[...l,{id:x,message:r,type:c}]),setTimeout(()=>i(l=>l.filter(f=>f.id!==x)),2800)},[]);return t.jsxs(p.Provider,{value:{toast:d},children:[s,t.jsx("div",{style:{position:"fixed",bottom:"80px",left:"50%",transform:"translateX(-50%)",zIndex:9999,display:"flex",flexDirection:"column",gap:"8px",alignItems:"center",pointerEvents:"none"},children:a.map(r=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px",padding:"12px 20px",borderRadius:"12px",background:r.type==="error"?"#dc2626":r.type==="wishlist"?"#ec4899":"#059669",color:"#fff",fontSize:"14px",fontWeight:600,boxShadow:"0 8px 24px rgba(0,0,0,0.15)",animation:"sf-toast-in 0.3s ease",whiteSpace:"nowrap"},children:[r.type==="error"?t.jsx(m,{size:18}):r.type==="wishlist"?t.jsx(h,{size:18,fill:"#fff"}):t.jsx(u,{size:18}),r.message]},r.id))})]})}function T(){const s=window.location.pathname;return o.useEffect(()=>{window.scrollTo({top:0,behavior:"smooth"})},[s]),null}function R(){return t.jsx("style",{children:`
      @keyframes sf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      @keyframes sf-toast-in { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes sf-bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
      .sf-cart-bounce { animation: sf-bounce 0.4s ease; }
      /* RTL: flip directional arrows */
      [dir="rtl"] .sf-rtl-flip { transform: scaleX(-1); }
      /* RTL: ensure text inputs align right */
      [dir="rtl"] input, [dir="rtl"] textarea, [dir="rtl"] select { text-align: right; }
      [dir="ltr"] input, [dir="ltr"] textarea, [dir="ltr"] select { text-align: left; }
      /* RTL: flip chevron arrows in pagination */
      [dir="rtl"] .sf-rtl-chevron { transform: scaleX(-1); }
      /* Load Arabic fonts when RTL */
      [dir="rtl"] { font-family: 'Tajawal', 'Cairo', 'Noto Sans Arabic', sans-serif; }
      [dir="rtl"] body { font-family: 'Tajawal', 'Cairo', 'Noto Sans Arabic', sans-serif; }
      @media (max-width: 768px) { .sf-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; } }
      @media (max-width: 480px) { .sf-footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; } }
      /* Touch-friendly tap targets — minimum 44px for mobile */
      @media (max-width: 768px) {
        .sf-tap-target { min-height: 44px; min-width: 44px; }
        button, a.sf-tap-link { min-height: 40px; }
        .sf-mobile-action-btn { min-height: 48px; min-width: 48px; padding: 12px; }
      }
      /* Prevent text selection on touch swipe elements */
      .sf-no-select { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      /* Smooth touch scrolling */
      .sf-touch-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
      /* Safe area padding for bottom nav */
      .sf-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
    `})}export{v as P,R as S,S as T,T as a,e as b,y as c,k as u};
