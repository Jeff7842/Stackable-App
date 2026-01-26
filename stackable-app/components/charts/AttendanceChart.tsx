'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import Script from 'next/script';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

type RangeKey = '7' | '30' | '90';

const attendanceData: Record<RangeKey, number[]> = {
  '7':  [1200, 1250, 1180, 1300, 1400, 1380, 1420],
  '30': Array.from({ length: 30 }, (_, i) => 1100 + i * 8),
  '90': Array.from({ length: 90 }, (_, i) => 900 + i * 6),
};

export default function AttendanceChartCard() {
  const [range, setRange] = useState<RangeKey>('7');

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    colors: ['#14b8a6'],
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
    },
    xaxis: {
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#6b7280' },
      },
    },
    tooltip: {
      theme: 'light',
    },
  };

  const chartSeries = [
    {
      name: 'Attendance',
      data: attendanceData[range],
    },
  ];

  return (
    <>
    <div className="max-w-full w-full bg-[#ffffff] border border-default rounded-base rounded-3xl shadow-xs p-4 md:p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h5 className="text-2xl font-bold text-heading">
            {attendanceData[range].slice(-1)[0]}
          </h5>
          <p className="text-body">Attendance trend</p>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-0.5 text-sm font-medium text-fg-success">
          <TrendingUp className="w-4 h-4" />
          4.2%
        </div>
      </div>

      {/* Chart */}
      <div className="py-4 md:py-6">
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="line"
          height={180}
        />
      </div>

      {/* Footer */}
      <div className="border-t border-light pt-4 flex justify-between items-center">
        <div className="flex gap-2">
          {(['7', '30', '90'] as RangeKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`text-sm font-medium px-2 py-1 rounded
                ${
                  range === key
                    ? 'text-heading bg-neutral-secondary-medium'
                    : 'text-body hover:text-heading'
                }`}
            >
              Last {key} days
            </button>
          ))}
        </div>

        <a
          href="#"
          className="inline-flex items-center text-fg-brand text-sm font-medium hover:underline"
        >
          Progress report →
        </a>
      </div>
    </div>

    </>
  );
}
