'use client'

import React from "react"

type StatCardProps = {
  icon: React.ReactNode
  value: string
  label: string
  delta: string
  iconBg?: string
  iconColor?: string
  deltaStatus?: "positive" | "negative" | "neutral"
}

export default function StatCard({
  icon,
  value,
  label,
  delta,
  iconBg = "bg-gray-200/60",
  iconColor = "text-gray-700",
  deltaStatus = "neutral",
}: StatCardProps)

{
const deltaStyles= {
    positive: "bg-green-100 text-green-700 outline outline-1 outline-green-500",
  negative: "bg-red-100 text-red-600 outline outline-1 outline-red-500",
  neutral: "bg-blue-100 text-blue-500 outline outline-1 outline-blue-300",
}
  return (
    <div className="bg-white w-full rounded-[28px]  p-5 flex flex-col gap-5 shadow-sm hover:shadow-md transition aspect-[4/2]" >

      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>

        <span
          className={`text-[12px] font-medium px-4 py-1 rounded-full mr-left  ${deltaStyles[deltaStatus]}`}>
          {delta}
        </span>
      </div>

      {/* Metric */}
      <div className="mt-4">
        <p className="text-sm text-gray-500 mt-1">
          {label}
        </p>
        <h2 className="text-3xl font-semibold tracking-tight mt-1.25">
          {value}
        </h2>
      </div>

    </div>
  )
}
