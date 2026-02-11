import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messages: string[];
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, messages }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 transform transition-all scale-100 border border-gray-100">
        <div className="flex items-center justify-center w-14 h-14 mx-auto bg-amber-50 rounded-full mb-5 ring-4 ring-amber-50/50">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">ยืนยันการเปลี่ยนแปลง</h3>
        <div className="text-sm text-gray-500 text-center mb-6">
           <p className="mb-3">พบข้อมูลตารางเวรเดิมในวันที่เลือก:</p>
           <div className="space-y-2 mb-4">
               {messages.map((msg, idx) => (
                   <div key={idx} className="font-medium text-amber-800 bg-amber-50 px-3 py-2 rounded-lg text-left border border-amber-100 flex items-start gap-2">
                       <span className="mt-0.5">•</span>
                       <span>{msg}</span>
                   </div>
               ))}
           </div>
           <p>คุณต้องการเปลี่ยนทับข้อมูลเดิมหรือไม่?</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-colors">
            ยกเลิก
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-bold transition-colors shadow-sm shadow-amber-200">
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};