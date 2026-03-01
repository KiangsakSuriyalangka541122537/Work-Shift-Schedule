import React from 'react';
import { Staff } from '../types';

interface StaffListProps {
  staffList: Staff[];
}

export const StaffList: React.FC<StaffListProps> = ({ staffList }) => {
  return (
    <div className="bg-white border-b border-slate-200 px-3 md:px-8 py-2 md:py-3 flex items-center gap-3 md:gap-6 overflow-x-auto shrink-0 z-40 custom-scrollbar scrollbar-hide">
      {staffList.map((staff) => (
        <div key={staff.id} className="flex items-center gap-2 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm">
          <img src={staff.avatarUrl} alt={staff.name} className="w-8 h-8 rounded-full object-cover" />
          <div>
            <div className="text-sm font-bold text-slate-700">{staff.name}</div>
            <div className="text-xs text-slate-500">{staff.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
