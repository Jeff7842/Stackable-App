import React from 'react';
import Card from '@/components/cards/card';
import { School, Wallet, Users, BarChart2 } from "lucide-react";
import Script from 'next/script';
import CalendarSummary from '@/components/Calender/widget';
import AttendanceChartCard from '@/components/charts/AttendanceChart';



export default function DashboardPage(){
  return (
    <>
    <div className='bg-[#F6F6F6] px-2'>

      <h1 className='font-bold font-image text-[22px] mt-[10px]'>Dashboard Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-[repeat(2,minmax(305px,_1fr))] xl:grid-cols-[repeat(4,minmax(295px,_1fr))] 3xl:grid-cols-[repeat(4,minmax(420px,_1fr))] gap-5 mb-5 items-center px-1.5 py-4 justify-center" >

  <Card
    icon={<School className="w-5 h-5" />}
    value="1,578"
    label="Active Students"
    delta="No Change"
    iconBg="bg-yellow-200/60"
    iconColor="text-yellow-700"
  />

  <Card
    icon={<Wallet className="w-5 h-5" />}
    value="KES 2,005,472"
    label="Fees Collected"
    delta="+2.1%"
    iconBg="bg-cyan-200/60"
    deltaStatus="positive"
    iconColor="text-cyan-700"
  />

  <Card
    icon={<Users className="w-5 h-5" />}
    value="1,400"
    label="Attendance Today"
    delta="-2.3%"
    iconBg="bg-purple-200/60"
    deltaStatus="negative"
    iconColor="text-purple-700"
  />

  <Card
    icon={<BarChart2 className="w-5 h-5" />}
    value="64.6"
    label="Mean Grade"
    delta="-0.8%"
    deltaStatus="negative"
    iconBg="bg-blue-200/60"
    iconColor="text-blue-700"
  />

</div>
<section className='grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5 mt-5 px-2.5 mb-10'>
  {/* Chart Card */}
  <AttendanceChartCard />

{/*Calender*/}
<CalendarSummary />
</section>
    </div>
    </>
  )
}
