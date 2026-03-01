import React from 'react';

interface HeaderProps {
  currentDate: Date;
  isLoggedIn: boolean;
  currentUser: string;
  isKikOrAdmin: boolean;
  isPublished: boolean;
  shouldShowContent: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetCurrentMonth: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onPublish: () => void;
  onReset: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onOpenStats: () => void;
  onOpenAdminManager: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDate,
  isLoggedIn,
  currentUser,
  isKikOrAdmin,
  isPublished,
  shouldShowContent,
  onPrevMonth,
  onNextMonth,
  onSetCurrentMonth,
  onLogin,
  onLogout,
  onPublish,
  onReset,
  onExportPDF,
  onExportExcel,
  onOpenStats,
  onOpenAdminManager
}) => {
  return (
    <header className="bg-white shadow-md p-4 print:hidden">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 whitespace-nowrap">
            ตารางเวร <span className="hidden sm:inline">- พี่กิ๊ก</span>
          </h1>
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={onPrevMonth} className="px-3 py-1 rounded-md hover:bg-slate-200 transition-colors">
              &lt;
            </button>
            <button onClick={onSetCurrentMonth} className="px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap">
              {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
            </button>
            <button onClick={onNextMonth} className="px-3 py-1 rounded-md hover:bg-slate-200 transition-colors">
              &gt;
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 hidden md:inline">สวัสดี, {currentUser}</span>
              <button onClick={onLogout} className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors">
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <button onClick={onLogin} className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </div>

      {isLoggedIn && (
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 mt-4 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            {isKikOrAdmin && (
              <button 
                onClick={onPublish}
                disabled={isPublished}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${isPublished ? 'bg-green-100 text-green-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                {isPublished ? '✔ ประกาศแล้ว' : 'ประกาศ'}
              </button>
            )}
            {isKikOrAdmin && (
              <button onClick={onReset} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                ล้างข้อมูลเดือนนี้
              </button>
            )}
          </div>
          
          {shouldShowContent && (
            <div className="flex items-center gap-2">
              <button onClick={onExportPDF} className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700">
                PDF
              </button>
              <button onClick={onExportExcel} className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700">
                Excel
              </button>
              <button onClick={onOpenStats} className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600">
                สถิติ
              </button>
              {isKikOrAdmin && (
                <button onClick={onOpenAdminManager} className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600">
                  จัดการ User
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
