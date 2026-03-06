import React from 'react';
import { LoginModal } from './LoginModal';
import { AdminManagerModal } from './AdminManagerModal';
import { ShiftEditorModal } from './ShiftEditorModal';
import { ConfirmationModal } from './ConfirmationModal';
import { ShiftStats } from './ShiftStats';
import { Staff, ShiftAssignment, ShiftHistory, ShiftType } from '../types';

interface ModalsProps {
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (isOpen: boolean) => void;
  handleLoginSubmit: (user: string, pass: string) => void;
  isAdminManagerOpen: boolean;
  setIsAdminManagerOpen: (isOpen: boolean) => void;
  selectedCell: { staffId: string; day: number } | null;
  setSelectedCell: (cell: { staffId: string; day: number } | null) => void;
  staffList: Staff[];
  currentDate: Date;
  getFirstShift: (staffId: string, day: number) => ShiftAssignment | undefined;
  handleSaveRequest: (action: string) => void;
  initiateSwapFromModal: () => void;
  isWeekendOrHoliday: (day: number) => boolean;
  history: ShiftHistory[];
  isKikOrAdmin: boolean;
  isConfirmOpen: boolean;
  setIsConfirmOpen: (isOpen: boolean) => void;
  handleConfirmSave: () => void;
  conflictMessages: string[];
  isStatsOpen: boolean;
  setIsStatsOpen: (isOpen: boolean) => void;
  assignments: ShiftAssignment[];
}

export const Modals: React.FC<ModalsProps> = ({ 
    isLoginModalOpen, 
    setIsLoginModalOpen, 
    handleLoginSubmit, 
    isAdminManagerOpen, 
    setIsAdminManagerOpen,
    selectedCell,
    setSelectedCell,
    staffList,
    currentDate,
    getFirstShift,
    handleSaveRequest,
    initiateSwapFromModal,
    isWeekendOrHoliday,
    history,
    isKikOrAdmin,
    isConfirmOpen,
    setIsConfirmOpen,
    handleConfirmSave,
    conflictMessages,
    isStatsOpen,
    setIsStatsOpen,
    assignments
}) => {
  return (
    <>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLoginSubmit} />
      <AdminManagerModal isOpen={isAdminManagerOpen} onClose={() => setIsAdminManagerOpen(false)} />
      {selectedCell && (
        <ShiftEditorModal 
          isOpen={!!selectedCell} 
          onClose={() => setSelectedCell(null)} 
          selectedStaff={staffList.find(s => s.id === selectedCell.staffId) || null} 
          selectedDate={new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedCell.day)} 
          currentShiftType={getFirstShift(selectedCell.staffId, selectedCell.day)?.shiftType || ShiftType.OFF} 
          onSave={handleSaveRequest} 
          onInitiateSwap={initiateSwapFromModal} 
          isHoliday={isWeekendOrHoliday(selectedCell.day)} 
          historyLogs={history} 
          canManageShifts={isKikOrAdmin} 
        />
      )}
      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleConfirmSave} messages={conflictMessages} />
      <ShiftStats isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} staffList={staffList} assignments={assignments} currentDate={currentDate} />
    </>
  );
};
