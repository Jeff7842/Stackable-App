'use client'


export default function BreadCrumb() {
    return (
        
<>
<nav className="flex" aria-label="Breadcrumb">
  <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse ">
    <li className="inline-flex items-center justify-center">
      <a href="/dashboard" className="inline-flex items-center hover:text-[#F19F24] text-sm text-[#000000] font-bold text-body hover:text-fg-brandtransition-all duration-300">
        <svg className="w-5 h-5 me-1.5 mt-[-5px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m4 12 8-8 8 8M6 10.5V19a1 1 0 0 0 1 1h3v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h3a1 1 0 0 0 1-1v-8.5"/></svg>
        Home
      </a>
    </li>
    <li>
      <div className="flex items-center space-x-1.5">
        <svg className="w-3.5 h-3.5 rtl:rotate-180 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5 7 7-7 7"/></svg>
        <a href="#" className="inline-flex hover:text-[#F19F24] items-center text-sm font-medium text-body hover:text-fg-brand transition-all duration-300">Projects</a>
      </div>
    </li>
    <li aria-current="page">
      <div className="flex items-center space-x-1.5">
        <svg className="w-3.5 h-3.5 rtl:rotate-180 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5 7 7-7 7"/></svg>
        <span className="inline-flex text-[#007146] items-center text-sm font-medium text-body-subtl transition-all duration-300">Flowbite</span>
      </div>
    </li>
  </ol>
</nav>
</>
    );
}