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

  // Function to highlight specific keywords
  const renderHighlightedMessage = (text: string) => {
    // Regex matches: "เวร บ่าย-ดึก", "เวรเช้า", "เวรบ่าย", "เวรดึก", "วันหยุด" (with optional spacing)
    const parts = text.split(/(เวร\s?บ่าย-ดึก|เวร\s?เช้า|เวร\s?บ่าย|เวร\s?ดึก|วันหยุด)/g);
    
    return parts.map((part, i) => {
        if (part.includes('บ่าย-ดึก') || part.includes('เวรเช้า') || part.includes('เวรบ่าย') || part.includes('เวรดึก') || part.includes('วันหยุด')) {
            let colorClass = "text-indigo-600"; // Fallback
            
            if(part.includes('เช้า')) colorClass = "text-sky-600";
            if(part.includes('บ่าย') && !part.includes('ดึก')) colorClass = "text-orange-600";
            if(part.includes('ดึก') && !part.includes('บ่าย')) colorClass = "text-purple-600";
            if(part.includes('บ่าย-ดึก')) colorClass = "text-pink-600"; // Special Combo Color
            if(part.includes('วันหยุด')) colorClass = "text-slate-500";

            return <span key={i} className={`font-bold ${colorClass} bg-slate-100 px-1 rounded mx-0.5`}>{part}</span>;
        }
        return <span key={i}>{part}</span>;
    });
  };

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
        
        {/* Changed from divide-y stack to 2-column grid */}
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-4 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedLogs.map((log) => {
                    const dateObj = new Date(log.timestamp);
                    const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
                    const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                    
                    let icon = <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>;
                    let bgColor = 'bg-indigo-50';
                    let textColor = 'text-indigo-700';

                    return (
                        <div key={log.id} className="p-3 flex items-start gap-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all hover:border-indigo-200">
                            <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgColor} ${textColor}`}>
                                {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium text-slate-800 leading-relaxed">
                                        {renderHighlightedMessage(log.message)}
                                    </p>
                                    <div className="flex items-center justify-end mt-1">
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            {dateStr} {timeStr} น.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};