import React from 'react';
import Sidebar from '@/components/sidebar/sidebar';
import Navbar from '@/components/header/dashboard-navbar';
import BreadCrumb from '@/components/breadcrumb/bread';


const dashbaordlayout = ({children}:{children: React.ReactNode}) => {
  return (
    
    <div className="w-full max-w-screen text-black bg-[#F6F6F6]">
      <Sidebar />
      <div className="ml-68 overflow-x-hidden overflow-y-auto">
        <Navbar />
        <div className='mt-28 flex flex-col pb-10'>
          <div className='pl-5'>
          <BreadCrumb />
          </div>
        {children}
        </div>
      </div>
    </div>
  )
}

export default dashbaordlayout