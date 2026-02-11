import React from 'react';
import { ShiftHistory } from '../types';

interface ShiftLogListProps {
  logs: ShiftHistory[];
}

export const ShiftLogList: React.FC<ShiftLogListProps> = ({ logs }) => {
  // Sort logs by newest first and filter ONLY SWAP actions
  const sortedLogs = [...logs]
    .filter(l => l.actionType === 'SWAP')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (sortedLogs.length === 0) {
    return (
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mt-6">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-700">ยังไม่มีประวัติการแลกเวร</h3>
            <p className="text-slate-500 text-sm mt-1">รายการแลกเปลี่ยนเวรจะปรากฏที่นี่หลังจากมีการทำรายการ</p>
        </div>
    );
  }

  return (
    <div className="w-full mt-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">ประวัติการแลกเวร</h3>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
            {sortedLogs.map((log) => {
                const dateObj = new Date(log.timestamp);
                const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                
                // Only SWAP style is needed now, but keeping switch just in case
                let icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>;
                let bgColor = 'bg-indigo-50';
                let textColor = 'text-indigo-700';

                return (
                    <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                        <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgColor} ${textColor}`}>
                            {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                                <p className="text-sm font-bold text-slate-800 leading-relaxed">
                                    {log.message}
                                </p>
                                <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{dateStr} {timeStr} น.</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};