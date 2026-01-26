'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dates = [15, 16, 17, 18, 19, 20, 21];

export default function CalendarSummary() {
  const [selectedDate, setSelectedDate] = useState<number>(19);

  return (
    <div className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">January 2026</h3>
        <div className="flex gap-2">
          <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200">
            <ChevronLeft size={16} />
          </button>
          <button className="p-2 rounded-full bg-amber-400 text-white hover:bg-amber-500">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 text-center text-sm text-gray-500 mb-2">
        {days.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-7 text-center mb-4">
        {dates.map((date) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium
              ${
                selectedDate === date
                  ? 'bg-gray-200 text-black'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
          >
            {date}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">Today</p>
          <div className="flex items-center gap-3">
            <span className="h-10 w-1 rounded-full bg-teal-500" />
            <div className="flex-1 h-10 bg-gray-200 rounded-full relative">
              <span className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-2">Sat, Jan 20</p>
          <div className="flex items-center gap-3">
            <span className="h-10 w-1 rounded-full bg-blue-400" />
            <div className="flex-1 h-10 bg-gray-200 rounded-full relative">
              <span className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
