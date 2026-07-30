import{j as e}from"./query-vendor-B_z9eiNn.js";import"./react-vendor-BmJKYk98.js";const n={primary:"bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",secondary:"bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100",danger:"bg-red-600 hover:bg-red-700 text-white",success:"bg-emerald-600 hover:bg-emerald-700 text-white",outline:"border border-gray-300 hover:bg-gray-50 text-gray-700 dark:border-slate-700 dark:hover:bg-slate-800/50 dark:text-slate-100",ghost:"hover:bg-gray-100 text-gray-600 dark:hover:bg-slate-800/50 dark:text-slate-300"},g={sm:"px-3 py-1.5 text-sm",md:"px-4 py-2 text-sm",lg:"px-6 py-3 text-base"},x=({children:a,variant:s="primary",size:o="md",className:l="",disabled:i=!1,loading:r=!1,icon:t,...d})=>e.jsxs("button",{className:`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${n[s]}
        ${g[o]}
        ${l}
      `,disabled:i||r,...d,children:[r?e.jsxs("svg",{className:"animate-spin h-4 w-4",viewBox:"0 0 24 24",children:[e.jsx("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4",fill:"none"}),e.jsx("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"})]}):t?e.jsx(t,{className:"w-4 h-4"}):null,a]});export{x as B};
