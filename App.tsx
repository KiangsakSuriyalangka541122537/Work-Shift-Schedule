import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Staff, ShiftAssignment, ShiftType, SHIFT_CONFIG, CellCoordinate, ShiftHistory, formatDateToISO } from './types';
import { STAFF_LIST, HOLIDAYS } from './constants';
import { ShiftStats } from './components/ShiftStats';
import { ShiftEditorModal } from './components/ShiftEditorModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { LoginModal } from './components/LoginModal';
import { AdminManagerModal } from './components/AdminManagerModal';
import { OfficialPrintView } from './components/OfficialPrintView';
import { ShiftLogList } from './components/ShiftLogList';
import { supabase } from './supabaseClient';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>(''); // Track username for permissions
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminManagerOpen, setIsAdminManagerOpen] = useState(false);

  // State
  const [currentDate, setCurrentDate] = useState(new Date()); // Tracks the month viewing
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [history, setHistory] = useState<ShiftHistory[]>([]);
  const [isPublished, setIsPublished] = useState(false); // Track if current month is published
  
  // Interaction State
  const [selectedCell, setSelectedCell] = useState<CellCoordinate | null>(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<CellCoordinate | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // Confirmation State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [conflictMessages, setConflictMessages] = useState<string[]>([]);
  const [pendingSave, setPendingSave] = useState<{ action: string, staffId: string, day: number } | null>(null);
  
  // Printing
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- Helpers ---
  const isKikOrAdmin = useMemo(() => {
    return currentUsername === 'kik' || currentUsername === 'admin';
  }, [currentUsername]);

  const canEdit = useMemo(() => {
    if (!isLoggedIn) return false;

    // เงื่อนไข: 
    // 1. ถ้าประกาศแล้ว (isPublished = true) -> ทุกคนที่ล็อกอินแก้ไขได้ (เพื่อแลกเวร)
    // 2. ถ้ายังไม่ประกาศ (Draft) -> เฉพาะ kik หรือ admin เท่านั้นที่แก้ได้
    if (isPublished) {
        return true;
    } else {
        return isKikOrAdmin;
    }
  }, [isLoggedIn, isKikOrAdmin, isPublished]);

  // Generate Month Key for DB (e.g., "2024-02")
  const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  // --- Supabase Integration ---

  // Fetch Assignments, Status, and Logs on Load or Date Change
  useEffect(() => {
    const fetchData = async () => {
      try {
        const monthKey = getMonthKey(currentDate);

        // 1. Fetch Assignments
        const { data: shiftData, error: shiftError } = await supabase
          .from('Table-kik')
          .select('*');
          
        if (shiftError) console.error('Error fetching assignments:', shiftError);

        if (shiftData) {
          const formattedData: ShiftAssignment[] = shiftData.map((item: any) => ({
            id: item.id,
            staffId: item.staff_id,
            date: item.date,
            shiftType: item.shift_type as ShiftType
          }));
          setAssignments(formattedData);
        }

        // 2. Fetch Publish Status
        const { data: statusData, error: statusError } = await supabase
          .from('monthly_roster_status')
          .select('is_published')
          .eq('month_key', monthKey)
          .single();

        if (statusError && statusError.code !== 'PGRST116') {
            console.error('Error fetching status:', statusError);
        }
        
        const published = statusData?.is_published || false;
        setIsPublished(published);

        // 3. Fetch History/Logs for this month
        const { data: logData, error: logError } = await supabase
            .from('shift_logs')
            .select('*')
            .eq('month_key', monthKey)
            .order('created_at', { ascending: false });

        if (logError) console.error('Error fetching logs:', logError);

        if (logData) {
            const formattedLogs: ShiftHistory[] = logData.map((item: any) => ({
                id: String(item.id),
                timestamp: new Date(item.created_at),
                targetDate: item.target_date,
                message: item.message,
                actionType: item.action_type
            }));
            setHistory(formattedLogs);
        } else {
            setHistory([]);
        }

      } catch (err) {
        console.error('Connection error:', err);
      }
    };

    fetchData();
  }, [currentDate]); 

  // Reset Month Action
  const handleResetMonth = async () => {
    if (!isKikOrAdmin) return;
    const confirm = window.confirm(`คำเตือน! คุณต้องการ "ล้างข้อมูล" ทั้งหมดของเดือนนี้ใช่หรือไม่?\n\nข้อมูลเวรทั้งหมดในเดือน ${currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} จะถูกลบถาวร`);
    if (!confirm) return;

    try {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const searchPattern = `${year}-${month}-%`;

        // Delete from DB
        const { error } = await supabase
            .from('Table-kik')
            .delete()
            .like('date', searchPattern);

        if (error) throw error;

        // Clear local state for this month
        setAssignments(prev => prev.filter(a => !a.date.startsWith(`${year}-${month}-`)));
        
        alert("ล้างข้อมูลเรียบร้อยแล้ว");
    } catch (e: any) {
        console.error("Reset failed", e);
        alert("เกิดข้อผิดพลาดในการล้างข้อมูล: " + e.message);
    }
  };

  // Publish Action
  const handlePublish = async () => {
    if (!isKikOrAdmin) return;
    const confirm = window.confirm("คุณต้องการบันทึกและประกาศตารางเวรเดือนนี้ใช่หรือไม่?\nหลังจากประกาศแล้ว เจ้าหน้าที่ท่านอื่นจะสามารถเข้ามาแก้ไขหรือแลกเปลี่ยนเวรได้");
    if (!confirm) return;

    try {
        const monthKey = getMonthKey(currentDate);
        const { error } = await supabase
            .from('monthly_roster_status')
            .upsert({ 
                month_key: monthKey, 
                is_published: true,
                published_by: currentUsername
            });

        if (error) throw error;
        setIsPublished(true);
        alert("ประกาศตารางเวรเรียบร้อยแล้ว");
    } catch (e) {
        console.error("Publish failed", e);
        alert("เกิดข้อผิดพลาดในการประกาศตารางเวร");
    }
  };

  // Helper to sync changes to DB
  const saveAssignmentToDB = async (assignment: ShiftAssignment) => {
    try {
      const { error } = await supabase.from('Table-kik').upsert({
        id: assignment.id,
        staff_id: assignment.staffId,
        date: assignment.date,
        shift_type: assignment.shiftType
      });
      
      if (error) {
        console.error('Error saving to DB:', error);
        alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.message}`);
      }
    } catch (error) {
      console.error('Unexpected error saving to DB:', error);
    }
  };

  const deleteAssignmentFromDB = async (id: string) => {
    try {
      const { error } = await supabase.from('Table-kik').delete().eq('id', id);
      
      if (error) {
        console.error('Error deleting from DB:', error);
        alert(`เกิดข้อผิดพลาดในการลบข้อมูล: ${error.message}`);
      }
    } catch (error) {
      console.error('Unexpected error deleting from DB:', error);
    }
  };

  // --- End Supabase Integration ---

  // Calendar Helpers
  const daysInMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }, [currentDate]);

  const daysArray = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  const getDayLabel = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.toLocaleDateString('th-TH', { weekday: 'short' });
  };
  
  const isWeekendOrHoliday = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(date);
    const d = date.getDay();
    const isWeekend = d === 0 || d === 6;
    const isHoliday = HOLIDAYS.some(h => h === dateStr || dateStr.endsWith(h.substring(5)));
    return isWeekend || isHoliday;
  };

  const isDateWeekendOrHoliday = (date: Date) => {
    const dateStr = formatDateToISO(date);
    const d = date.getDay();
    const isWeekend = d === 0 || d === 6;
    const isHoliday = HOLIDAYS.some(h => h === dateStr || dateStr.endsWith(h.substring(5)));
    return isWeekend || isHoliday;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  // Visibility Logic: 
  // If user is Admin/Kik -> Show everything
  // If Published -> Show everything
  // Else (Regular user + Draft mode) -> Show nothing
  const shouldShowContent = useMemo(() => {
      return isKikOrAdmin || isPublished;
  }, [isKikOrAdmin, isPublished]);

  const getShifts = (staffId: string, day: number): ShiftAssignment[] => {
    if (!shouldShowContent) return []; // Hide if not visible

    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(date);
    return assignments.filter(a => a.staffId === staffId && a.date === dateStr);
  };

  const getFirstShift = (staffId: string, day: number): ShiftAssignment | undefined => {
    const shifts = getShifts(staffId, day);
    return shifts.length > 0 ? shifts[0] : undefined;
  };

  const hasShiftsOnDay = (day: number) => {
    if (!shouldShowContent) return false; // Hide if not visible

    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(date);
    return assignments.some(a => a.date === dateStr && a.shiftType !== ShiftType.OFF);
  };

  const getStaffName = (id: string) => STAFF_LIST.find(s => s.id === id)?.name || 'Unknown';

  const addHistoryLog = async (targetDate: string, message: string, actionType: ShiftHistory['actionType']) => {
    // เงื่อนไขสำคัญ: จะเก็บ Log ก็ต่อเมื่อ admin: kik ทำการ "บันทึก/ประกาศ" แล้วเท่านั้น
    // ถ้ายังเป็น Draft อยู่ ไม่ต้องเก็บ Log การเปลี่ยนแปลง
    if (!isPublished) return;

    const newLog: ShiftHistory = {
        id: Date.now().toString() + Math.random().toString(),
        timestamp: new Date(),
        targetDate,
        message,
        actionType
    };
    
    // Optimistic Update
    setHistory(prev => [newLog, ...prev]);

    try {
        const monthKey = getMonthKey(currentDate);
        const { error } = await supabase.from('shift_logs').insert({
            month_key: monthKey,
            target_date: targetDate,
            message: message,
            action_type: actionType
        });
        if (error) console.error("Error saving log", error);
    } catch (e) {
        console.error("Failed to save log", e);
    }
  };

  // Auth Actions
  const handleLogin = async (username: string, password: string) => {
    try {
        const { data, error } = await supabase
            .from('users-table-kik') 
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (!error && data) {
            setIsLoggedIn(true);
            setCurrentUser(data.name || username);
            setCurrentUsername(data.username);
            return { success: true };
        }
    } catch (e) {
        console.log("Database connection failed, using fallback.");
    }

    const demoUsers: Record<string, string> = {
        'tor': 'พี่ต่อ',
        'kik': 'พี่กิ๊ก',
        'jhim': 'พี่จิ๋ม',
        'pan': 'น้องปาน',
        'top': 'พี่ท๊อป',
        'team': 'พี่ทีม',
        'admin': 'Admin'
    };

    if (demoUsers[username]) {
         if (password === username || (username === 'admin' && password === '1234')) {
             setIsLoggedIn(true);
             setCurrentUser(demoUsers[username]);
             setCurrentUsername(username);
             return { success: true };
         }
    }

    return { success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' };
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser('');
    setCurrentUsername('');
    setIsSwapMode(false);
    setSwapSource(null);
    setSelectedCell(null);
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const monthStr = currentDate.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
      pdf.save(`duty_roster_${monthStr}.pdf`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF");
    } finally {
      setIsExporting(false);
    }
  };

  // Actions
  const handleCellClick = (staffId: string, day: number) => {
    if (!isLoggedIn) return; 

    // Permission Check
    if (!canEdit) {
        if (!isPublished) {
            alert("ขออภัย: ตารางเวรเดือนนี้ยังไม่ถูกประกาศ (Draft Mode) \nคุณยังไม่สามารถเห็นหรือแก้ไขข้อมูลได้จนกว่า Admin จะกดประกาศ");
        } else {
            alert("คุณไม่มีสิทธิ์แก้ไขข้อมูลในขณะนี้");
        }
        return;
    }

    const clickedCoord: CellCoordinate = { staffId, day };

    if (isSwapMode && swapSource) {
        performSwap(swapSource, clickedCoord);
        return;
    }
    setSelectedCell(clickedCoord);
  };

  const updateAssignmentsWithRule = (
    currentAssignments: ShiftAssignment[], 
    staffId: string, 
    date: Date, 
    newType: ShiftType
  ): ShiftAssignment[] => {
    const dateStr = formatDateToISO(date);
    const isSpecialDay = isDateWeekendOrHoliday(date);
    
    const existingShifts = currentAssignments.filter(a => a.staffId === staffId && a.date === dateStr);
    const hasThisType = existingShifts.some(a => a.shiftType === newType);
    if (hasThisType) {
        return currentAssignments; 
    }

    const newAssignment = {
        id: `${staffId}-${dateStr}-${newType}`,
        staffId,
        date: dateStr,
        shiftType: newType
    };

    saveAssignmentToDB(newAssignment);
    const otherAssignments = currentAssignments.filter(a => !(a.staffId === staffId && a.date === dateStr));

    if (!isSpecialDay) {
        existingShifts.forEach(s => deleteAssignmentFromDB(s.id));
        return [...otherAssignments, newAssignment];
    } else {
        if (existingShifts.length < 2) {
            return [...otherAssignments, ...existingShifts, newAssignment];
        } else {
            existingShifts.forEach(s => deleteAssignmentFromDB(s.id));
            return [...otherAssignments, newAssignment];
        }
    }
  };

  const performSwap = (source: CellCoordinate, target: CellCoordinate) => {
    const sourceShifts = getShifts(source.staffId, source.day);
    const sourceAfternoon = sourceShifts.find(s => s.shiftType === ShiftType.AFTERNOON);
    const sourceShiftToSwap = sourceAfternoon || sourceShifts[0];
    const sourceType = sourceShiftToSwap ? sourceShiftToSwap.shiftType : ShiftType.OFF;

    const targetShifts = getShifts(target.staffId, target.day);
    const targetAfternoon = targetShifts.find(s => s.shiftType === ShiftType.AFTERNOON);
    const targetShiftToSwap = targetAfternoon || targetShifts[0];
    const targetType = targetShiftToSwap ? targetShiftToSwap.shiftType : ShiftType.OFF;

    const sourceDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), source.day);
    const targetDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), target.day);
    const sourceDateStr = formatDateToISO(sourceDateObj);
    const targetDateStr = formatDateToISO(targetDateObj);

    const getNextDate = (d: Date) => {
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        return next;
    };
    const sourceNextDate = getNextDate(sourceDateObj);
    const targetNextDate = getNextDate(targetDateObj);
    const sourceNextDateStr = formatDateToISO(sourceNextDate);
    const targetNextDateStr = formatDateToISO(targetNextDate);

    const sourceNextShifts = assignments.filter(a => a.staffId === source.staffId && a.date === sourceNextDateStr);
    const sourceHasNextNight = sourceNextShifts.some(s => s.shiftType === ShiftType.NIGHT);

    const targetNextShifts = assignments.filter(a => a.staffId === target.staffId && a.date === targetNextDateStr);
    const targetHasNextNight = targetNextShifts.some(s => s.shiftType === ShiftType.NIGHT);

    let swapNight = false;
    if (sourceType === ShiftType.AFTERNOON && sourceHasNextNight) swapNight = true;
    if (targetType === ShiftType.AFTERNOON && targetHasNextNight) swapNight = true;

    const sName = getStaffName(source.staffId);
    const tName = getStaffName(target.staffId);
    
    if (sourceType !== ShiftType.OFF || targetType !== ShiftType.OFF) {
        addHistoryLog(sourceDateStr, `สลับเวรระหว่าง ${sName} (${SHIFT_CONFIG[sourceType].label}) กับ ${tName} (${SHIFT_CONFIG[targetType].label})`, 'SWAP');
    }
    
    if (swapNight) {
        addHistoryLog(sourceNextDateStr, `สลับเวรดึก (ต่อเนื่องจากเวรบ่าย) ระหว่าง ${sName} กับ ${tName}`, 'SWAP');
    }

    setAssignments(prev => {
        let nextAssignments = [...prev];
        if (sourceType !== ShiftType.OFF) {
            const id = `${source.staffId}-${sourceDateStr}-${sourceType}`;
            nextAssignments = nextAssignments.filter(a => a.id !== id);
            deleteAssignmentFromDB(id);
        }
        if (targetType !== ShiftType.OFF) {
            const id = `${target.staffId}-${targetDateStr}-${targetType}`;
            nextAssignments = nextAssignments.filter(a => a.id !== id);
            deleteAssignmentFromDB(id);
        }

        if (targetType !== ShiftType.OFF) {
            const newAssign = { id: `${source.staffId}-${sourceDateStr}-${targetType}`, staffId: source.staffId, date: sourceDateStr, shiftType: targetType };
            nextAssignments.push(newAssign);
            saveAssignmentToDB(newAssign);
        }
        if (sourceType !== ShiftType.OFF) {
             const newAssign = { id: `${target.staffId}-${targetDateStr}-${sourceType}`, staffId: target.staffId, date: targetDateStr, shiftType: sourceType };
            nextAssignments.push(newAssign);
            saveAssignmentToDB(newAssign);
        }

        if (swapNight) {
            const sNextNightType = sourceHasNextNight ? ShiftType.NIGHT : ShiftType.OFF;
            const tNextNightType = targetHasNextNight ? ShiftType.NIGHT : ShiftType.OFF;

            if (sNextNightType === ShiftType.NIGHT) {
                 const id = `${source.staffId}-${sourceNextDateStr}-${ShiftType.NIGHT}`;
                 nextAssignments = nextAssignments.filter(a => a.id !== id);
                 deleteAssignmentFromDB(id);
            }
            if (tNextNightType === ShiftType.NIGHT) {
                 const id = `${target.staffId}-${targetNextDateStr}-${ShiftType.NIGHT}`;
                 nextAssignments = nextAssignments.filter(a => a.id !== id);
                 deleteAssignmentFromDB(id);
            }

            if (tNextNightType === ShiftType.NIGHT) {
                const newAssign = { id: `${source.staffId}-${sourceNextDateStr}-${ShiftType.NIGHT}`, staffId: source.staffId, date: sourceNextDateStr, shiftType: ShiftType.NIGHT };
                nextAssignments.push(newAssign);
                saveAssignmentToDB(newAssign);
            }
            if (sNextNightType === ShiftType.NIGHT) {
                const newAssign = { id: `${target.staffId}-${targetNextDateStr}-${ShiftType.NIGHT}`, staffId: target.staffId, date: targetNextDateStr, shiftType: ShiftType.NIGHT };
                nextAssignments.push(newAssign);
                saveAssignmentToDB(newAssign);
            }
        }
        return nextAssignments;
    });

    setIsSwapMode(false);
    setSwapSource(null);
  };

  const executeSave = (action: string, staffId: string, day: number) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const targetDateStr = formatDateToISO(targetDate);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);
    const nextDateStr = formatDateToISO(nextDate);
    
    const staffName = getStaffName(staffId);

    const removeGlobalShift = (list: ShiftAssignment[], dStr: string, type: ShiftType) => {
        const toRemove = list.filter(a => a.date === dStr && a.shiftType === type);
        toRemove.forEach(a => deleteAssignmentFromDB(a.id));
        return list.filter(a => !(a.date === dStr && a.shiftType === type));
    };

    if (action === 'OFF') {
        const currentShifts = getShifts(staffId, day);
        if (currentShifts.length > 0) {
            const shiftNames = currentShifts.map(s => SHIFT_CONFIG[s.shiftType].label).join('+');
            addHistoryLog(targetDateStr, `ลบ ${shiftNames} ของ ${staffName} ออก`, 'REMOVE');
        }

        setAssignments(prev => {
            const toDelete = prev.filter(a => a.staffId === staffId && a.date === targetDateStr);
            toDelete.forEach(a => deleteAssignmentFromDB(a.id));
            let newAssignments = prev.filter(a => !(a.staffId === staffId && a.date === targetDateStr));

            currentShifts.forEach(shift => {
                 if (shift.shiftType === ShiftType.AFTERNOON) {
                    const linkedNight = newAssignments.find(a => a.staffId === staffId && a.date === nextDateStr && a.shiftType === ShiftType.NIGHT);
                    if (linkedNight) {
                        deleteAssignmentFromDB(linkedNight.id);
                        newAssignments = newAssignments.filter(a => a.id !== linkedNight.id);
                    }
                 } else if (shift.shiftType === ShiftType.NIGHT) {
                    const prevDate = new Date(targetDate);
                    prevDate.setDate(targetDate.getDate() - 1);
                    const prevDateStr = formatDateToISO(prevDate);
                    const linkedAfternoon = newAssignments.find(a => a.staffId === staffId && a.date === prevDateStr && a.shiftType === ShiftType.AFTERNOON);
                    if (linkedAfternoon) {
                        deleteAssignmentFromDB(linkedAfternoon.id);
                        newAssignments = newAssignments.filter(a => a.id !== linkedAfternoon.id);
                    }
                 }
            });
            return newAssignments;
        });

    } else if (action === 'MORNING') {
        const existingMorningOwner = assignments.find(a => a.date === targetDateStr && a.shiftType === ShiftType.MORNING);
        if (existingMorningOwner && existingMorningOwner.staffId !== staffId) {
             const prevOwnerName = getStaffName(existingMorningOwner.staffId);
             addHistoryLog(targetDateStr, `เวรเช้า: เปลี่ยนจาก ${prevOwnerName} เป็น ${staffName}`, 'CHANGE');
        } else if (!existingMorningOwner) {
             addHistoryLog(targetDateStr, `เวรเช้า: เพิ่ม ${staffName} ลงเวร`, 'ADD');
        }

        setAssignments(prev => {
            let temp = removeGlobalShift(prev, targetDateStr, ShiftType.MORNING);
            return updateAssignmentsWithRule(temp, staffId, targetDate, ShiftType.MORNING);
        });
    } else if (action === 'BD_COMBO') {
        const existingAfternoonOwner = assignments.find(a => a.date === targetDateStr && a.shiftType === ShiftType.AFTERNOON);
        
        let logMsg = `บ่าย-ดึก: `;
        if (existingAfternoonOwner && existingAfternoonOwner.staffId !== staffId) {
            logMsg += `เปลี่ยน ${getStaffName(existingAfternoonOwner.staffId)} เป็น ${staffName}`;
        } else {
            logMsg += `เพิ่ม ${staffName}`;
        }
        addHistoryLog(targetDateStr, logMsg, 'CHANGE');

        setAssignments(prev => {
            let temp = removeGlobalShift(prev, targetDateStr, ShiftType.AFTERNOON);
            temp = removeGlobalShift(temp, nextDateStr, ShiftType.NIGHT);
            
            temp = updateAssignmentsWithRule(temp, staffId, targetDate, ShiftType.AFTERNOON);
            temp = updateAssignmentsWithRule(temp, staffId, nextDate, ShiftType.NIGHT);
            return temp;
        });
    }
  };

  const handleSaveRequest = (action: string) => {
    if (!selectedCell) return;
    const { staffId, day } = selectedCell;
    executeSave(action, staffId, day);
    setSelectedCell(null);
  };

  const handleConfirmSave = () => {
    if (pendingSave) {
        executeSave(pendingSave.action, pendingSave.staffId, pendingSave.day);
        setPendingSave(null);
        setIsConfirmOpen(false);
    }
  };

  const initiateSwapFromModal = () => {
    setSwapSource(selectedCell);
    setIsSwapMode(true);
    setSelectedCell(null);
  };

  const renderCell = (staff: Staff, day: number) => {
    const shifts = getShifts(staff.id, day);
    const isSource = isSwapMode && swapSource?.staffId === staff.id && swapSource?.day === day;
    const isSpecial = isWeekendOrHoliday(day);
    const isCurrentDay = isToday(day);
    
    // Check permission for cursor
    const userCanInteract = isLoggedIn && canEdit;

    const order = { [ShiftType.MORNING]: 1, [ShiftType.AFTERNOON]: 2, [ShiftType.NIGHT]: 3, [ShiftType.OFF]: 4 };
    shifts.sort((a, b) => order[a.shiftType] - order[b.shiftType]);

    let content;
    if (shifts.length === 0) {
        content = null;
    } else if (shifts.length === 1) {
        const config = SHIFT_CONFIG[shifts[0].shiftType];
        content = (
            <div className={`w-full h-full flex items-center justify-center ${config.colorBg}`}>
                <span className={`font-bold text-base md:text-lg ${config.colorText}`}>{config.code}</span>
            </div>
        );
    } else {
        content = (
            <div className="w-full h-full flex flex-col">
                {shifts.map((shift, idx) => {
                    const config = SHIFT_CONFIG[shift.shiftType];
                    return (
                        <div key={idx} className={`flex-1 flex items-center justify-center ${config.colorBg} ${idx === 0 ? 'border-b border-white/50' : ''}`}>
                             <span className={`font-bold text-xs ${config.colorText}`}>{config.code}</span>
                        </div>
                    )
                })}
            </div>
        );
    }

    const cursorClass = userCanInteract ? 'cursor-pointer hover:brightness-95' : 'cursor-default opacity-90';
    const swapClass = isSource ? 'ring-2 ring-primary ring-inset z-10 animate-pulse' : '';
    
    let todayClass = isCurrentDay ? 'bg-emerald-50/40' : '';
    let todayShiftHighlight = '';
    let todayDotColor = 'bg-emerald-500';
    let todayDotAnimate = '';

    if (isCurrentDay && shifts.length > 0) {
         const type = shifts[0].shiftType;
         todayDotAnimate = 'animate-pulse';
         if (type === ShiftType.MORNING) {
             todayClass = 'bg-sky-50'; 
             todayShiftHighlight = 'ring-4 ring-sky-400 ring-inset z-20 shadow-[inset_0_0_15px_rgba(56,189,248,0.3)]';
             todayDotColor = 'bg-sky-500';
         } else if (type === ShiftType.AFTERNOON) {
             todayClass = 'bg-orange-50';
             todayShiftHighlight = 'ring-4 ring-orange-400 ring-inset z-20 shadow-[inset_0_0_15px_rgba(251,146,60,0.3)]';
             todayDotColor = 'bg-orange-500';
         } else if (type === ShiftType.NIGHT) {
             todayClass = 'bg-indigo-50';
             todayShiftHighlight = 'ring-4 ring-indigo-400 ring-inset z-20 shadow-[inset_0_0_15px_rgba(129,140,248,0.3)]';
             todayDotColor = 'bg-indigo-500';
         }
    }

    return (
      <div 
        key={`${staff.id}-${day}`}
        onClick={() => handleCellClick(staff.id, day)}
        className={`
          h-16 flex-1 min-w-[28px] border-r border-b border-slate-200 flex flex-col transition-all relative overflow-hidden
          ${shifts.length === 0 && isSpecial ? 'bg-rose-50/40' : ''}
          ${cursorClass}
          ${swapClass}
          ${todayClass}
          ${todayShiftHighlight}
        `}
      >
        {isCurrentDay && shifts.length > 0 && (
            <div className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 ${todayDotColor} ${todayDotAnimate} rounded-full shadow-sm z-30 ring-2 ring-white`}></div>
        )}
        {content}
      </div>
    );
  };

  const getStaffTotal = (staffId: string) => {
    if (!shouldShowContent) return 0;
    return assignments.filter(a => a.staffId === staffId && a.shiftType !== ShiftType.OFF).length;
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center font-sans overflow-hidden text-slate-700">
      <div className="w-full h-full max-w-[1920px] bg-white shadow-2xl flex flex-col relative overflow-hidden border-x border-slate-200">
        
        <header className="bg-white z-50 px-4 md:px-8 py-4 border-b border-slate-200 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-4">
               <div className="bg-cyan-700 p-2 md:p-3 rounded-2xl text-white shadow-sm shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
               </div>
               <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">ตารางเวรปฏิบัติงาน</h1>
                  <p className="text-sm md:text-base text-slate-500 hidden sm:block">โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช</p>
               </div>
            </div>

            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
               
               {/* Login / Admin Section */}
               <div className="flex items-center gap-2">
                 {isLoggedIn ? (
                    <div className="flex items-center gap-2">
                         {/* Manager Actions - Only Kik/Admin sees this */}
                         {isKikOrAdmin && (
                             <>
                                {!isPublished && (
                                    <>
                                        <button 
                                            onClick={handleResetMonth}
                                            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl transition-all text-xs font-bold border border-red-200"
                                            title="ลบข้อมูลทั้งหมดในเดือนนี้"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                            ล้างข้อมูล
                                        </button>

                                        <button 
                                            onClick={handlePublish}
                                            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all text-xs font-bold border border-green-200 animate-pulse"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                            บันทึกและประกาศ
                                        </button>
                                    </>
                                )}
                                
                                <button 
                                    onClick={() => setIsAdminManagerOpen(true)}
                                    className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all text-xs font-bold border border-indigo-200"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" x2="20" y1="8" y2="14"/><line x1="23" x2="17" y1="11" y2="11"/></svg>
                                    จัดการผู้ดูแล
                                </button>
                             </>
                         )}

                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl">
                            <span className="flex h-2 w-2 relative">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPublished ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPublished ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                            </span>
                            <span className="text-sm font-bold truncate max-w-[80px]">{currentUser || 'User'}</span>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <button 
                                onClick={handleLogout}
                                className="text-xs font-semibold hover:text-red-700 underline decoration-slate-300 hover:decoration-red-300 transition-all"
                            >
                                ออก
                            </button>
                        </div>
                    </div>
                 ) : (
                    <button 
                        onClick={() => setIsLoginModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all text-sm font-semibold"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        เข้าสู่ระบบ
                    </button>
                 )}
               </div>

               <div className="h-10 w-px bg-slate-200 mx-2 hidden md:block"></div>

               <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl shrink-0">
                  <button 
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <span className="min-w-[140px] text-center font-bold text-lg text-slate-800">
                      {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
               </div>
               
               <button 
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-3 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-sm border border-transparent hover:border-amber-200 rounded-xl transition-all font-semibold text-sm md:text-base shrink-0 disabled:opacity-50"
               >
                  {isExporting ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  )}
                  <span className="hidden sm:inline">Export PDF</span>
               </button>

               <button 
                  onClick={() => setIsStatsOpen(true)}
                  className="flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:shadow-sm border border-transparent hover:border-indigo-200 rounded-xl transition-all font-semibold text-sm md:text-base shrink-0"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                  <span className="hidden sm:inline">สรุปภาระงาน</span>
               </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 relative">
          
          {/* Draft Mode Notification for Non-Admins */}
          {!shouldShowContent && (
             <div className="absolute inset-0 z-10 bg-slate-50/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                 <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-200 max-w-md">
                     <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-amber-50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M12 18l-3-3"/><path d="M12 18l3-3"/></svg>
                     </div>
                     <h3 className="text-xl font-bold text-slate-800 mb-2">ตารางเวรเดือนนี้อยู่ระหว่างการจัดทำ</h3>
                     <p className="text-slate-500">ผู้ดูแลระบบกำลังจัดตารางเวร (Draft Mode) <br/>ข้อมูลจะแสดงเมื่อมีการประกาศอย่างเป็นทางการแล้วเท่านั้น</p>
                 </div>
             </div>
          )}

          {isSwapMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-lg bg-indigo-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-sm flex items-center justify-between animate-in slide-in-from-top-4 border border-indigo-500/50">
                  <div className="flex items-center gap-4">
                      <div className="bg-indigo-500/30 p-3 rounded-full animate-pulse">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                      </div>
                      <div>
                          <p className="font-bold text-base">โหมดสลับเวร</p>
                          <p className="text-sm text-indigo-200">เลือกช่องปลายทางที่จะสลับ</p>
                      </div>
                  </div>
                  <button 
                      onClick={() => { setIsSwapMode(false); setSwapSource(null); }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/20"
                  >
                      ยกเลิก
                  </button>
              </div>
          )}

          <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex items-center gap-4 md:gap-6 overflow-x-auto shrink-0 z-40 custom-scrollbar scrollbar-hide">
             <div className="flex items-center mr-4 gap-2">
                 <span className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide shrink-0">สถานะ:</span>
                 {isPublished ? (
                     <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 flex items-center gap-1">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                         ประกาศแล้ว
                     </span>
                 ) : (
                     <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                         ฉบับร่าง {isKikOrAdmin ? '(Admin Mode)' : '(รอประกาศ)'}
                     </span>
                 )}
             </div>
             {Object.values(SHIFT_CONFIG).filter(c => c.code).map((config) => (
               <div key={config.code} className="flex items-center gap-2 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm">
                  <span className={`w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded ${config.colorBg} ${config.colorText} text-xs md:text-sm font-bold`}>{config.code}</span>
                  <span className="text-sm text-slate-700">{config.label}</span>
               </div>
             ))}
          </div>

          <div className="flex-1 overflow-auto bg-white relative scroll-smooth scrollbar-hide">
              <div className="flex flex-col min-w-full">
                  
                      <div className="flex w-full sticky top-0 z-40 shadow-sm bg-slate-50">
                          <div className="sticky left-0 top-0 z-50 w-60 min-w-[15rem] px-4 py-4 text-left text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-r border-b border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.02)] flex items-center">
                              รายชื่อเจ้าหน้าที่
                          </div>
                          
                          {daysArray.map(day => {
                              const isSpecial = isWeekendOrHoliday(day);
                              const hasWork = hasShiftsOnDay(day);
                              const isCurrentDay = isToday(day);

                              return (
                                  <div key={day} className={`relative flex-1 min-w-[28px] flex flex-col items-center justify-center border-r border-b border-slate-200 py-2 ${isSpecial ? 'bg-rose-50/50' : ''} ${isCurrentDay ? 'bg-emerald-50 shadow-inner' : ''}`}>
                                      <div className={`
                                        text-sm md:text-base font-bold
                                        ${isCurrentDay ? 'bg-emerald-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm -mt-1 mb-1' : ''}
                                        ${!isCurrentDay && isSpecial ? 'text-rose-500' : ''}
                                        ${!isCurrentDay && !isSpecial ? 'text-slate-700' : ''}
                                      `}>
                                        {day}
                                      </div>
                                      <span className={`text-[10px] uppercase ${isSpecial && !isCurrentDay ? 'text-rose-400' : 'text-slate-400'}`}>{getDayLabel(day)}</span>
                                      
                                      {isCurrentDay && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 rounded-full mb-0.5">วันนี้</span>}

                                      {!hasWork && !isCurrentDay && shouldShowContent && (
                                        <div className="absolute top-1 right-1" title="ยังไม่มีการจัดเวรในวันนี้">
                                            <span className="flex h-1.5 w-1.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-300"></span>
                                            </span>
                                        </div>
                                      )}
                                  </div>
                              );
                          })}
                          
                          <div className="w-20 min-w-[5rem] px-2 py-4 text-center text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 flex items-center justify-center">
                              รวม
                          </div>
                      </div>

                      {STAFF_LIST.map((staff, index) => (
                          <div key={staff.id} className={`flex w-full border-b border-slate-100 hover:bg-slate-50 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                              
                              <div className="sticky left-0 z-30 w-60 min-w-[15rem] px-4 py-3 flex items-center gap-3 bg-white border-r border-slate-200 group-hover:bg-slate-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.02)]">
                                  <div className="relative shrink-0">
                                    <img 
                                      src={staff.avatarUrl} 
                                      alt="" 
                                      onError={(e) => {
                                        e.currentTarget.src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(staff.name)}`;
                                      }}
                                      className="w-10 h-10 rounded-full bg-slate-200 object-cover ring-2 ring-white shadow-md" 
                                    />
                                  </div>
                                  <div className="truncate min-w-0 flex-1">
                                      <div className="text-sm md:text-base font-bold text-slate-800 truncate">{staff.name}</div>
                                      <div className="text-xs text-slate-500 truncate">{staff.role}</div>
                                  </div>
                              </div>

                              {daysArray.map(day => renderCell(staff, day))}

                              <div className="w-20 min-w-[5rem] px-2 py-2 flex items-center justify-center text-lg font-bold text-slate-500 group-hover:text-slate-700 bg-transparent">
                                  {getStaffTotal(staff.id)}
                              </div>
                          </div>
                      ))}
                      
                      {/* Logs Section - Only visible if published */}
                      {isPublished && (
                        <div className="p-4 md:p-8 bg-slate-50/50">
                            <ShiftLogList logs={history} />
                        </div>
                      )}

                      <div className="h-24 w-full shrink-0"></div>
              </div>
          </div>

        </main>
      
      </div>

      {/* Hidden Print Area */}
      {/* Positioned fixed top-left but behind everything and transparent to events, ensuring html2canvas can 'see' it */}
      <div className="fixed top-0 left-[-10000px] z-[-50] w-[297mm]">
        <div ref={printRef} className="bg-white">
          <OfficialPrintView 
            currentDate={currentDate}
            staffList={STAFF_LIST}
            assignments={assignments}
            daysInMonth={daysInMonth}
            holidays={HOLIDAYS}
          />
        </div>
      </div>

      <ShiftStats 
        isOpen={isStatsOpen} 
        onClose={() => setIsStatsOpen(false)}
        staffList={STAFF_LIST}
        assignments={assignments}
      />

      {/* Editor Modal is only accessible if logged in (controlled by handleCellClick, but safe to guard here too) */}
      {isLoggedIn && (
          <ShiftEditorModal 
            isOpen={!!selectedCell}
            onClose={() => setSelectedCell(null)}
            selectedStaff={selectedCell ? STAFF_LIST.find(s => s.id === selectedCell.staffId) || null : null}
            selectedDate={selectedCell ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedCell.day) : null}
            currentShiftType={selectedCell ? (getFirstShift(selectedCell.staffId, selectedCell.day)?.shiftType || ShiftType.OFF) : ShiftType.OFF}
            onSave={handleSaveRequest}
            onInitiateSwap={initiateSwapFromModal}
            isHoliday={selectedCell ? isWeekendOrHoliday(selectedCell.day) : false}
            historyLogs={history}
          />
      )}

      <ConfirmationModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        messages={conflictMessages}
      />

      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
      />

      <AdminManagerModal 
        isOpen={isAdminManagerOpen}
        onClose={() => setIsAdminManagerOpen(false)}
      />

    </div>
  );
};

export default App;