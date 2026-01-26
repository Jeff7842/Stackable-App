import React from 'react';
import Sidebar from '@/components/sidebar/sidebar';
import Navbar from '@/components/header/dashboard-navbar';


const dashbaordlayout = ({children}:{children: React.ReactNode}) => {
  return (
    
    <div className="flex text-black bg-[#F6F6F6]">
      <Sidebar />
      <div className="ml-68 overflow-x-hidden overflow-y-auto">
        <Navbar />
        <div className='mt-28 flex flex-col pb-10'>
        {children}
        </div>
      </div>
    </div>
  )
}

export default dashbaordlayout