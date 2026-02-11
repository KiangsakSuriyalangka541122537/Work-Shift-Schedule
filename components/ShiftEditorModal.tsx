import React from 'react';
import { ShiftType, SHIFT_CONFIG, Staff, ShiftHistory, formatDateToISO } from '../types';

interface ShiftEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStaff: Staff | null;
  selectedDate: Date | null;
  currentShiftType: ShiftType;
  onSave: (action: string) => void;
  onInitiateSwap: () => void;
  isHoliday: boolean;
  historyLogs: ShiftHistory[];
  canManageShifts: boolean;
}

export const ShiftEditorModal: React.FC<ShiftEditorModalProps> = ({
  isOpen,
  onClose,
  selectedStaff,
  selectedDate,
  currentShiftType,
  onSave,
  onInitiateSwap,
  isHoliday,
  historyLogs,
  canManageShifts
}) => {
  if (!isOpen || !selectedStaff || !selectedDate) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  
  // Use helper to ensure matching key format
  const dateStr = formatDateToISO(selectedDate);
  // Filter relevant history - effectively mostly swaps now
  const relevantHistory = historyLogs.filter(log => log.targetDate === dateStr);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex justify-between items-center text-white sticky top-0 z-10 shrink-0">
          <div>
            <h3 className="text-lg font-bold">จัดการเวร</h3>
            <p className="text-primary-100 text-sm flex items-center gap-2">
                {formatDate(selectedDate)}
                {isHoliday && <span className="bg-white/20 px-2 py-0.5 rounded text-xs">วันหยุด/เสาร์-อาทิตย์</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <img 
              src={selectedStaff.avatarUrl} 
              alt={selectedStaff.name} 
              onError={(e) => {
                e.currentTarget.src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(selectedStaff.name)}`;
              }}
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" 
            />
            <div>
              <p className="font-bold text-gray-800">{selectedStaff.name}</p>
              <p className="text-sm text-gray-500">{selectedStaff.role}</p>
            </div>
          </div>

          {canManageShifts ? (
            <>
              <p className="text-sm font-medium text-gray-500 mb-3">เลือกประเภทเวร</p>
              
              <div className="grid grid-cols-1 gap-3 mb-6">
                
                {/* Morning */}
                <button
                  onClick={() => onSave('MORNING')}
                  className={`flex items-center p-3 rounded-xl border-2 transition-all group ${
                    currentShiftType === ShiftType.MORNING
                      ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200'
                      : 'border-gray-100 hover:border-sky-200 hover:bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold mr-4 ${SHIFT_CONFIG[ShiftType.MORNING].colorBg} ${SHIFT_CONFIG[ShiftType.MORNING].colorText}`}>
                    {SHIFT_CONFIG[ShiftType.MORNING].code}
                  </div>
                  <div className="text-left flex-1">
                     <div className="font-bold text-gray-800">เวรเช้า</div>
                     <div className="text-xs text-gray-500">08.00 - 16.00 น.</div>
                  </div>
                </button>

                {/* Afternoon - Night Combo (Cross day) */}
                <button
                  onClick={() => onSave('BD_COMBO')}
                  className={`flex items-center p-3 rounded-xl border-2 transition-all group border-gray-100 hover:border-purple-200 hover:bg-white`}
                >
                   <div className="flex -space-x-2 mr-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold relative z-10 ring-2 ring-white ${SHIFT_CONFIG[ShiftType.AFTERNOON].colorBg} ${SHIFT_CONFIG[ShiftType.AFTERNOON].colorText}`}>
                        {SHIFT_CONFIG[ShiftType.AFTERNOON].code}
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold relative z-0 ${SHIFT_CONFIG[ShiftType.NIGHT].colorBg} ${SHIFT_CONFIG[ShiftType.NIGHT].colorText}`}>
                        {SHIFT_CONFIG[ShiftType.NIGHT].code}
                      </div>
                   </div>
                  <div className="text-left flex-1">
                     <div className="font-bold text-gray-800 group-hover:text-purple-700 transition-colors">บ่าย - ดึก (ต่อเนื่อง)</div>
                     <div className="text-xs text-gray-500">วันนี้ (บ) + พรุ่งนี้ (ด)</div>
                  </div>
                </button>

                {/* Clear */}
                <button
                  onClick={() => onSave('OFF')}
                  className={`flex items-center p-3 rounded-xl border-2 transition-all group ${
                    currentShiftType === ShiftType.OFF
                      ? 'border-gray-300 bg-gray-100'
                      : 'border-gray-100 hover:border-red-200 hover:bg-red-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold mr-4 bg-gray-200 text-gray-500 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </div>
                  <div className="text-left flex-1">
                     <div className="font-bold text-gray-800 group-hover:text-red-600 transition-colors">หยุด / ลบเวร</div>
                  </div>
                </button>

              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400">การจัดการอื่นๆ</span>
                </div>
              </div>
            </>
          ) : null}

          <div className="mb-6">
             <button 
                onClick={onInitiateSwap}
                className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                ขอแลกเวร / สลับเวร
             </button>
          </div>

          {/* History Section */}
          <div className="border-t border-gray-100 pt-4">
             <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               ประวัติการแลกเวร (วันนี้)
             </h4>
             
             <div className="space-y-3">
                {relevantHistory.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm bg-gray-50 rounded-lg">
                        ยังไม่มีประวัติการแลกเวร
                    </div>
                ) : (
                    relevantHistory.slice().reverse().map((log) => (
                        <div key={log.id} className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                             <div className="flex justify-between items-start mb-1">
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider
                                    ${log.actionType === 'ADD' ? 'bg-green-100 text-green-700' : 
                                      log.actionType === 'CHANGE' ? 'bg-blue-100 text-blue-700' :
                                      log.actionType === 'REMOVE' ? 'bg-red-100 text-red-700' :
                                      'bg-indigo-100 text-indigo-700'}
                                 `}>
                                     {log.actionType}
                                 </span>
                                 <span className="text-xs text-gray-400">
                                     {log.timestamp.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.
                                 </span>
                             </div>
                             <p className="text-gray-700 leading-relaxed">{log.message}</p>
                        </div>
                    ))
                )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};