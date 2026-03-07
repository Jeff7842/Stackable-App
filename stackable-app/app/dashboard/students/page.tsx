"use client";

import BreadCrumb from '@/components/breadcrumb/bread';
import Image from 'next/image';
import { useState } from 'react';
import SearchInputPage from '@/components/search-input/page';
import styled from 'styled-components';
import Dropdown from '@/components/Dropdown';

export default function StudentsPage() {

    const StyledWrapper = styled.div`
    /*@apply bg-white text-blue-400 rounded-full;*/
  .active {background: white; border-radius: 9999px; color: #F19F24;}`;

    return (
        <>
        <div className='bg-[#F6F6F6] px-2'>
        <BreadCrumb/>
        
              <h1 className='font-bold font-image text-[22px] mt-[10px] ml-2'>All Students</h1>
                <div className="mt-5 w-full flex flex-col gap-3 px-2">

  {/* TOP ROW */}
  <div className="flex w-full items-center justify-between gap-3 flex-wrap">

    {/* LEFT SIDE — SEARCH + FILTERS */}
    <div className="flex flex-wrap items-center gap-2">

      {/* Search */}
      <SearchInputPage />

      {/* NAME FILTER */}
      <Dropdown
        label="Name A–Z"
        items={[
          { label: "First Name A–Z", value: "first_name" },
          { label: "Last Name A–Z", value: "last_name" },
        ]}
      />

      {/* CLASS FILTER */}
      <Dropdown
        label="Class"
        items={[
          "PP1","PP2","Grade 1","Grade 2","Grade 3",
          "Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"
        ]}
      />

      {/* TEACHER FILTER */}
      <Dropdown
        label="Teacher"
        items={['teachersFromDB']}   // array from backend
      />

      {/* SUBJECT FILTER */}
      <Dropdown
        label="Subject"
        items={['subjectsFromDB']}   // array from backend
      />

      {/* GRADE RANGE */}
      <Dropdown
        label="Grade Range"
        items={[
          "0-15","16-30","31-45","46-60","61-75","Custom"
        ]}
      />

    </div>

    {/* RIGHT SIDE — VIEW, EXPORT, ADD */}
    <div className="inline-flex items-center gap-4 ml-5">

      {/* Grid/List Toggle */}
      <StyledWrapper>
      <div className="bg-gray-50 text-sm text-gray-500 leading-none border border-gray-200 rounded-[10px] inline-flex">
    <button  className="inline-flex items-center transition-colors duration-300 ease-in focus:outline-none hover:text-yellow-400 focus:text-[#F19F24] rounded-l-full px-4 py-2 active" id="grid">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="fill-current w-4 h-4 mr-2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      <span>Grid</span>
    </button>
    <button className="inline-flex items-center transition-colors duration-300 ease-in focus:outline-none hover:text-yellow-400 focus:text-[#F19F24] rounded-r-full px-4 py-2" id="list">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="fill-current w-4 h-4 mr-2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
      <span>List</span>
    </button>

</div>
</StyledWrapper>
      {/* Export */}
      <button className="bg-white outline outline-gray-300 hover:bg-yellow-400 hover:outline-yellow-400 hover:text-white text-black cursor-pointer font-medium px-3 py-2 rounded-[10px] hover:shadow-md transition-all duration-200">
        <div className='flex items-center space-x-2'><svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/>
</svg><span className='text-[12px]'>
Export</span></div>
      </button>

      {/* Add Student */}
      <button className='bg-white outline outline-gray-300 hover:bg-yellow-400 hover:outline-yellow-400 hover:text-white text-black cursor-pointer font-medium px-3 py-2 rounded-[10px] hover:shadow-md transition-all duration-200'> <div className='flex items-center space-x-2'> <svg xmlns="http://www.w3.org/2000/svg" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"> <path stroke="none" d="M0 0h24v24H0z" fill="none"/> <path d="M12 5v14m-7 -7h14"/> </svg> <span className='text-[12px]'>Add Student</span> </div> </button>

    </div>

  </div>

</div>

        </div>
        </>
    );
}
