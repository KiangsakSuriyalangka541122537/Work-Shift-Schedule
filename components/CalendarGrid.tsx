import React from 'react';
import { ShiftAssignment, Staff } from '../types';

interface CalendarGridProps {
  daysInMonth: number;
  staffList: Staff[];
  assignments: ShiftAssignment[];
  renderCell: (staff: Staff, day: number) => React.ReactNode;
  getStaffTotal: (staffId: string) => number;
  getStaffAmount: (staffId: string) => string;
  isKikOrAdmin: boolean;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ 
  daysInMonth, 
  staffList, 
  assignments, 
  renderCell, 
  getStaffTotal, 
  getStaffAmount, 
  isKikOrAdmin 
}) => {
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="flex-1 overflow-auto bg-white relative scroll-smooth scrollbar-hide">
      <div className="flex flex-col min-w-full">
        <div className="flex w-full sticky top-0 z-40 shadow-sm bg-slate-50">
          <div className="sticky left-0 top-0 z-50 w-28 min-w-[7rem] md:w-60 md:min-w-[15rem] px-2 py-3 md:px-4 md:py-4 text-left text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-r border-b border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.02)] flex items-center">
            <span className="md:hidden">รายชื่อ</span>
            <span className="hidden md:inline">รายชื่อเจ้าหน้าที่</span>
          </div>
          {daysArray.map(day => {
            // ... (omitting day header logic for brevity, assuming it's passed in or handled separately)
            return (
              <div key={day} className="relative flex-1 min-w-[34px] md:min-w-[44px] flex flex-col items-center justify-center border-r border-b border-slate-200 py-2">
                <div className="text-sm md:text-base font-bold text-slate-700">{day}</div>
              </div>
            );
          })}
          <div className="w-14 min-w-[3.5rem] md:w-20 md:min-w-[5rem] px-1 md:px-2 py-2 md:py-4 text-center text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 flex items-center justify-center">รวม</div>
          {isKikOrAdmin && (
            <div className="w-16 min-w-[4rem] md:w-24 md:min-w-[6rem] px-1 md:px-2 py-2 md:py-4 text-center text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 flex items-center justify-center border-l border-slate-200">เงิน</div>
          )}
        </div>

        {staffList.map((staff, index) => (
          <div key={staff.id} className={`flex w-full border-b border-slate-100 hover:bg-slate-50 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
            <div className="sticky left-0 z-30 w-28 min-w-[7rem] md:w-60 md:min-w-[15rem] px-2 py-2 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 bg-white border-r border-slate-200 group-hover:bg-slate-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.02)]">
              <div className="relative shrink-0"><img src={staff.avatarUrl} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 object-cover ring-2 ring-white shadow-md" /></div>
              <div className="truncate min-w-0 flex-1">
                <div className="text-xs md:text-base font-bold text-slate-800 truncate">{staff.name}</div>
                <div className="hidden md:block text-xs text-slate-500 truncate">{staff.role}</div>
              </div>
            </div>
            {daysArray.map(day => renderCell(staff, day))}
            <div className="w-14 min-w-[3.5rem] md:w-20 md:min-w-[5rem] px-1 md:px-2 py-2 flex items-center justify-center text-sm md:text-lg font-bold text-slate-500 group-hover:text-slate-700 bg-transparent">{getStaffTotal(staff.id)}</div>
            {isKikOrAdmin && (
              <div className="w-16 min-w-[4rem] md:w-24 md:min-w-[6rem] px-1 md:px-2 py-2 flex items-center justify-center text-xs md:text-base font-bold text-emerald-600 bg-transparent border-l border-slate-100">{getStaffAmount(staff.id)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
