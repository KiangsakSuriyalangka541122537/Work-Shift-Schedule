import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Staff, ShiftAssignment, ShiftType, formatDateToISO } from '../types';

interface ShiftStatsProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: Staff[];
  assignments: ShiftAssignment[]; // Full list
  currentDate: Date;
}

export const ShiftStats: React.FC<ShiftStatsProps> = ({ isOpen, onClose, staffList, assignments, currentDate }) => {
  if (!isOpen) return null;

  const data = staffList.map(staff => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    
    // Filter shifts for the display columns (breakdown)
    const staffShiftsThisMonth = assignments.filter(a => a.staffId === staff.id && a.date.startsWith(monthPrefix));
    
    // Calculate Weighted Total: M=1, A=0.5, N=0.5
    let weightedTotal = 0;
    staffShiftsThisMonth.forEach(s => {
        if (s.shiftType === ShiftType.MORNING) weightedTotal += 1;
        else if (s.shiftType === ShiftType.AFTERNOON) weightedTotal += 0.5;
        else if (s.shiftType === ShiftType.NIGHT) weightedTotal += 0.5;
    });

    // Cross-Month Logic:
    const lastDayObj = new Date(year, month + 1, 0);
    const lastDayStr = formatDateToISO(lastDayObj);
    const nextMonthFirstObj = new Date(year, month + 1, 1);
    const nextMonthFirstStr = formatDateToISO(nextMonthFirstObj);
    
    const prevMonthLastDayObj = new Date(year, month, 0);
    const prevMonthLastDayStr = formatDateToISO(prevMonthLastDayObj);
    const currentMonthFirstObj = new Date(year, month, 1);
    const currentMonthFirstStr = formatDateToISO(currentMonthFirstObj);

    // Outgoing: Afternoon (End of Month) -> Night (Start of Next) => +0.5 to this month
    const hasAfternoonLastDay = assignments.some(a => 
        a.staffId === staff.id && a.date === lastDayStr && a.shiftType === ShiftType.AFTERNOON
    );
    const hasNightNextDay = assignments.some(a => 
        a.staffId === staff.id && a.date === nextMonthFirstStr && a.shiftType === ShiftType.NIGHT
    );
    if (hasAfternoonLastDay && hasNightNextDay) {
        weightedTotal += 0.5;
    }

    // Incoming: Afternoon (End of Prev) -> Night (Start of This) => -0.5 from this month (Night counts as 0)
    const hasAfternoonPrevMonth = assignments.some(a => 
        a.staffId === staff.id && a.date === prevMonthLastDayStr && a.shiftType === ShiftType.AFTERNOON
    );
    const hasNightFirstDay = assignments.some(a => 
        a.staffId === staff.id && a.date === currentMonthFirstStr && a.shiftType === ShiftType.NIGHT
    );
    if (hasAfternoonPrevMonth && hasNightFirstDay) {
        weightedTotal -= 0.5;
    }

    return {
      name: staff.name,
      เช้า: staffShiftsThisMonth.filter(s => s.shiftType === ShiftType.MORNING).length,
      บ่าย: staffShiftsThisMonth.filter(s => s.shiftType === ShiftType.AFTERNOON).length,
      ดึก: staffShiftsThisMonth.filter(s => s.shiftType === ShiftType.NIGHT).length,
      total: weightedTotal // Use weighted total instead of raw count
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                สรุปภาระงานประจำเดือน
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis allowDecimals={false} tick={{fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{fill: '#f1f5f9'}}
                />
                <Legend />
                <Bar dataKey="เช้า" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} />
                <Bar dataKey="บ่าย" stackId="a" fill="#fb923c" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ดึก" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
               {data.map((item) => (
                   <div key={item.name} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                       <div className="text-sm font-bold text-slate-700 truncate">{item.name}</div>
                       <div className="text-2xl font-bold text-indigo-600 my-1">{item.total}</div>
                       <div className="text-xs text-slate-400">เวรทั้งหมด</div>
                   </div>
               ))}
          </div>
        </div>
      </div>
    </div>
  );
};