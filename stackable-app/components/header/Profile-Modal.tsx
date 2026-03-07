'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';


interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

const ProfileModal = ({ open, onClose }: ProfileModalProps) => {
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop 
      <div
        className={`fixed inset-0 z-[90] bg-black/1 transition-opacity duration-300
        ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />*/}

      {/* Modal */}
      

        {/* Modal content goes here */}
        <div
        ref={modalRef}
          className={`fixed left-[76rem] top-[40px] 
          w-75 h-85 bg-white rounded-[25px] shadow-xl z-[100] overflow-hidden flex flex-col transform transition-all duration-300 ease-out ${
          open
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-6 pointer-events-none'
        }`}>
            {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-3 text-[10px] w-5 h-5 rounded-full z-110 cursor-pointer bg-white
          flex items-center justify-center shadow-2xl
          hover:bg-yellow-100 hover:text-gray-500 hover:scale-[1.07] hover:rotate-90 transition-all duration-200"
          aria-label="Close modal">
          ✕
        </button>
          {/* HEADER / COVER */}
          <header className="relative h-1/4 w-full">
            <Image
              src="/images/653.jpg"
              alt="Profile cover"
              className="w-full h-full object-cover  hover:scale-[1.1]
              transition-all duration-4000"
              width={500}
              height={500}/>
        
            {/* Avatar */}
            <div
              className="absolute bottom-[-40px] left-1/2 -translate-x-1/2
              bg-white p-1 rounded-full w-20 h-20
              flex items-center justify-center
              cursor-pointer hover:scale-[1.03]
              transition-all duration-300"
            >
              <Image src='/images/5739662.jpg'
                alt="User avatar"
                className="rounded-full w-18 h-18 object-cover hover:grayscale-70"
                width={500}
                height={500}
              />
            </div>
          </header>
        
          {/* CONTENT AREA — 3/4 HEIGHT */}
          <main className="flex-1 pt-12 px-6 flex flex-col justify-between">
            <section className="space-y-3 text-center">
              <h1 className="text-[22px] font-bold font-body text-black">
                Jefferson Kimotho
              </h1>
        
              <p className="text-[15px] text-gray-500 mt-[-12px]">
                Super Admin
              </p>
        <p className="text-[14px] text-gray-600 mt-[-5px]"><strong>Kyfaru Academy</strong>
              </p>
        
        <div className='col-span-1 gap-4 flex'>
              <address className="not-italic text-[14px] text-gray-600">
                contact@kyfaru.ac.ke
              </address>
              <p className="text-[14px] text-gray-600">ID: <strong>KYFU23296</strong>
              </p>
        </div>
              <hr className="my-3" />
        
              {/* Attendance Report */}
              
            </section>
        
            {/* CTA */}
            <footer className="pb-4 flex gap-4">
              <button
                className="w-full py-1 text-[14px] rounded-full bg-black text-white outline-2 focus:text-[#ffffff] focus:outline-1 focus:outline-[#F19F24] focus:bg-[#F19F24]
                hover:bg-transparent hover:text-black hover:scale-[1.01] cursor-pointer hover:outline-2 hover:outline-black hover:shadow-2xl transition-all duration-300">
                View More
              </button>
              <button
        className="p-16-semibold flex size-full text-[14px] gap-2 p-2 items-center justify-center group font-semibold rounded-full bg-cover hover:bg-gray-50 hover:outline-1 hover:outline-red-600 hover:shadow-inner focus:bg-gradient-to-r from-red-400 to-red-600
         focus:text-white text-red-700 hover:scale-[1.01] transition-all ease-linear ">
        <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-logout group-focus:text-amber-300"><path fill="none" stroke="none" d="M0 0h24v24H0z" /><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg>
        Logout
      </button>

            </footer>
          </main>
        </div>

    </>
  );
};

export default ProfileModal;
