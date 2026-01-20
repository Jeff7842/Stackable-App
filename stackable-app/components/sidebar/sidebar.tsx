'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-white border-r fixed left-0 top-0">
      <div className='flex  justify-between items-center align-middle gap-3 mt-0'>
        <div className="p-4 font-bold text-xl flex items-center justify-center">
          <Image src='/logos/Symbol Light.webp' alt='school-logo' className='w-[45px]' width={500} height={500}/>
        </div>
        
        <div className='rounded-full w-10 h-10 border-1 border-gray-200 hover:border-black bg-[#f9f7f7] shadow-lg p-2 mr-4 mt-0 cursor-pointer  justify-center flex items-center hover:scale-[1.05] text-black hover:bg-black hover:text-white hover:text-[20px] hover:translate-y-[-2px] transition-[300ms]'>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-left justify-center align-middle flex items-center transition"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg>

      </div>
      
</div>
<div className="grow border-t border-gray-300 mb-3.25 w-[93%] flex ml-[7px]"></div>
      <nav className="flex flex-col gap-2 px-4">
        <ul>
        <li><Link href="/dashboard" className='flex w-fit gap-[5px] font-body font-300 text-[14px] text-center align-middle items-center justify-center'>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-cog-icon lucide-user-cog flex items-center"><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m14.305 16.53.923-.382"/><path d="m15.228 13.852-.923-.383"/><path d="m16.852 12.228-.383-.923"/><path d="m16.852 17.772-.383.924"/><path d="m19.148 12.228.383-.923"/><path d="m19.53 18.696-.382-.924"/><path d="m20.772 13.852.924-.383"/><path d="m20.772 16.148.924.383"/><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/></svg>My Settings</Link></li>
        </ul>
      </nav>
<div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
<nav className="flex flex-col gap-2 px-4">
    <ul>
        <li><Link href="/dashboard" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'><svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.05} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-smart-home flex items-center align-middle justify-center translate-y-[-2px]"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" /><path d="M16 15c-2.21 1.333 -5.792 1.333 -8 0" /></svg>Home</Link></li>
        <li><Link href="/dashboard/students"  className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Notifications</Link></li>
        <li><Link href="/dashboard/teachers"className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Live Activity</Link></li>
        <li><Link href="/dashboard/payments"className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Payments</Link></li>
        </ul>
      </nav>
<div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
<nav className="flex flex-col gap-2 px-4">
    <ul>
        <li><Link href="/dashboard" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Home</Link></li>
        <li><Link href="/dashboard/students" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Students</Link></li>
        <li><Link href="/dashboard/teachers" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Teachers</Link></li>
        <li><Link href="/dashboard/payments" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Payments</Link></li>
        </ul>
      </nav>
      <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
<nav className="flex flex-col gap-2 px-4">
    <ul>
        <li><Link href="/dashboard" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Home</Link></li>
        <li><Link href="/dashboard/students" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Students</Link></li>
        <li><Link href="/dashboard/teachers" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Teachers</Link></li>
        <li><Link href="/dashboard/payments" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Payments</Link></li>
        </ul>
      </nav>
      <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
<nav className="flex flex-col gap-2 px-4">
    <ul>
        <li><Link href="/dashboard" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Home</Link></li>
        <li><Link href="/dashboard/students" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Students</Link></li>
        <li><Link href="/dashboard/teachers" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Teachers</Link></li>
        <li><Link href="/dashboard/payments" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Payments</Link></li>
        </ul>
      </nav>
      <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
<nav className="flex flex-col gap-2 px-4">
    <ul>
        <li><Link href="/dashboard" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Home</Link></li>
        <li><Link href="/dashboard/students" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Students</Link></li>
        <li><Link href="/dashboard/teachers" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Teachers</Link></li>
        <li><Link href="/dashboard/payments" className='flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center'>Payments</Link></li>
        </ul>
      </nav>


    </aside>
  );
}
