import React from 'react';
import Sidebar from '@/components/sidebar/sidebar';
import Navbar from '@/components/header/dashboard-navbar';
import Script from 'next/script';

const dashbaordlayout = ({children}:{children: React.ReactNode}) => {
  return (
    <html>
      <head>
        {/* Tabler Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
        {/*Development version*/}
<Script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></Script>

{/*/Production version*/}
<Script src="https://unpkg.com/lucide@latest"></Script>
      </head>
    <div className="flex text-black">
      <Sidebar />
      <div className="ml-68">
        <Navbar />
        <div className='mt-20'>
        {children}
        </div>
      </div>
    </div>
    </html>
  )
}

export default dashbaordlayout