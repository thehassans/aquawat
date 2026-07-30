import{j as e}from"./query-vendor-B_z9eiNn.js";import"./react-vendor-BmJKYk98.js";const i=({label:r,error:a,className:t="",...s})=>e.jsxs("div",{className:"space-y-1",children:[r&&e.jsx("label",{className:"block text-sm font-medium text-gray-700 dark:text-slate-200",children:r}),e.jsx("input",{className:`
          w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg
          text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-all duration-200
          disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400
          ${a?"border-red-500 focus:ring-red-500":""}
          ${t}
        `,...s}),a&&e.jsx("p",{className:"text-sm text-red-600",children:a})]}),c=({label:r,error:a,options:t=[],className:s="",...l})=>e.jsxs("div",{className:"space-y-1",children:[r&&e.jsx("label",{className:"block text-sm font-medium text-gray-700 dark:text-slate-200",children:r}),e.jsx("select",{className:`
          w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg
          text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-all duration-200
          disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400
          ${a?"border-red-500 focus:ring-red-500":""}
          ${s}
        `,...l,children:t.map(d=>e.jsx("option",{value:d.value,children:d.label},d.value))}),a&&e.jsx("p",{className:"text-sm text-red-600",children:a})]}),x=({label:r,error:a,className:t="",...s})=>e.jsxs("div",{className:"space-y-1",children:[r&&e.jsx("label",{className:"block text-sm font-medium text-gray-700 dark:text-slate-200",children:r}),e.jsx("textarea",{className:`
          w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg
          text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-all duration-200 resize-none
          ${a?"border-red-500 focus:ring-red-500":""}
          ${t}
        `,rows:4,...s}),a&&e.jsx("p",{className:"text-sm text-red-600",children:a})]});export{i as I,c as S,x as T};
