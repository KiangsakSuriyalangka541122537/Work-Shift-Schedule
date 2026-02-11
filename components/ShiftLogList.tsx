import React from 'react';
import { ShiftHistory } from '../types';

interface ShiftLogListProps {
  logs: ShiftHistory[];
}

export const ShiftLogList: React.FC<ShiftLogListProps> = ({ logs }) => {
  // Sort logs by newest first
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (sortedLogs.length === 0) {
    return (
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center mt-6">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-700">ยังไม่มีประวัติการแลกเปลี่ยนเวร</h3>
            <p className="text-slate-500 text-sm mt-1">รายการแลกเปลี่ยนเวรจะปรากฏที่นี่หลังจากมีการแก้ไข</p>
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
            <h3 className="text-lg font-bold text-slate-800">ประวัติการแลกเปลี่ยนเวร (Activity Logs)</h3>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
            {sortedLogs.map((log) => {
                const dateObj = new Date(log.timestamp);
                const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                
                let icon;
                let bgColor;
                let textColor;

                switch(log.actionType) {
                    case 'SWAP':
                        icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>;
                        bgColor = 'bg-indigo-50';
                        textColor = 'text-indigo-700';
                        break;
                    case 'CHANGE':
                        icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
                        bgColor = 'bg-amber-50';
                        textColor = 'text-amber-700';
                        break;
                    case 'ADD':
                        icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>;
                        bgColor = 'bg-emerald-50';
                        textColor = 'text-emerald-700';
                        break;
                    case 'REMOVE':
                        icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
                        bgColor = 'bg-red-50';
                        textColor = 'text-red-700';
                        break;
                    default:
                        icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>;
                        bgColor = 'bg-slate-50';
                        textColor = 'text-slate-700';
                }

                // Format Target Date nicely
                const targetDate = new Date(log.targetDate);
                const targetDateText = targetDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

                return (
                    <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                        <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgColor} ${textColor}`}>
                            {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                                <p className="text-sm font-bold text-slate-800">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono mr-2">{targetDateText}</span>
                                    {log.message}
                                </p>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{dateStr} {timeStr} น.</span>
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
