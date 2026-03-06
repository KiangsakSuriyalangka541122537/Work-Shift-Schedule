import React, { useState, useMemo, useRef } from 'react';
import { Staff, ShiftAssignment, ShiftType, SHIFT_CONFIG, CellCoordinate, ShiftHistory, formatDateToISO } from './types';
import { HOLIDAYS } from './constants';
import { Modals } from './components/Modals';
import { CalendarGrid } from './components/CalendarGrid';
import { StaffList } from './components/StaffList';
import { ShiftLogList } from './components/ShiftLogList';
import { OfficialPrintView } from './components/OfficialPrintView';
import html2canvas from 'html2canvas';
import { Header } from './components/Header';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useAuth } from './hooks/useAuth';
import { useShifts } from './hooks/useShifts';

const App: React.FC = () => {
  // Auth State
  const { isLoggedIn, currentUser, currentUsername, handleLogin, handleLogout } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminManagerOpen, setIsAdminManagerOpen] = useState(false);

  // State
  const [currentDate, setCurrentDate] = useState(new Date()); // Tracks the month viewing
  
  const {
    staffList,
    assignments,
    setAssignments,
    originalAssignments,
    history,
    isPublished,
    addHistoryLog,
    deleteAssignmentFromDB,
    insertAssignmentToDB,
    handleResetMonth: resetMonthData,
    handlePublish: publishRoster,
    getMonthKey
  } = useShifts(currentDate);
  
  // Interaction State
  const [selectedCell, setSelectedCell] = useState<CellCoordinate | null>(null);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<CellCoordinate | null>(null);
  // NEW: Store IDs of shifts being swapped for visual highlighting
  const [swapSourceIds, setSwapSourceIds] = useState<string[]>([]);
  
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
    if (isPublished) {
        return true;
    } else {
        return isKikOrAdmin;
    }
  }, [isLoggedIn, isKikOrAdmin, isPublished]);

  const shouldShowContent = useMemo(() => {
      return isKikOrAdmin || isPublished;
  }, [isKikOrAdmin, isPublished]);

  const handleResetMonth = async () => {
    if (!isKikOrAdmin) return;
    await resetMonthData();
  };

  const handlePublish = async () => {
    if (!isKikOrAdmin) return;
    await publishRoster(currentUsername);
  };

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
    // Fix: Strictly match dates to avoid cross-year holiday bugs
    const isHoliday = HOLIDAYS.includes(dateStr); 
    return isWeekend || isHoliday;
  };

  const isDateWeekendOrHoliday = (date: Date) => {
    const dateStr = formatDateToISO(date);
    const d = date.getDay();
    const isWeekend = d === 0 || d === 6;
    // Fix: Strictly match dates to avoid cross-year holiday bugs
    const isHoliday = HOLIDAYS.includes(dateStr);
    return isWeekend || isHoliday;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

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

  const getStaffName = (id: string) => staffList.find(s => s.id === id)?.name || 'Unknown';

  const handleLoginSubmit = async (user: string, pass: string) => {
    const success = await handleLogin(user, pass);
    if (success) {
      setIsLoginModalOpen(false);
    }
  };

  const handleLogoutSubmit = () => {
    handleLogout();
    setIsSwapMode(false);
    setSwapSource(null);
    setSwapSourceIds([]);
    setSelectedCell(null);
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);

    // Wait for the render cycle to reflect the new styles (moving print view to top)
    // This delay is crucial for html2canvas to "see" the element in the correct position
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const pages = Array.from(printRef.current.querySelectorAll('.print-page'));

      if (pages.length === 0) {
        throw new Error("ไม่พบหน้าเอกสารที่จะพิมพ์ (No pages found)");
      }

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1920,
          windowHeight: 1080,
          // Explicitly set x/y to 0 to capture from the top-left of the element
          x: 0,
          y: 0
        });

        const imgData = canvas.toDataURL('image/png');
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const monthStr = currentDate.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
      // Add suffix if printing original schedule
      const fileName = isPublished && originalAssignments.length > 0 
        ? `duty_roster_${monthStr}_original.pdf` 
        : `duty_roster_${monthStr}.pdf`;
      
      pdf.save(fileName);
    } catch (error: any) {
      console.error("Export failed:", error);
      alert(`เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: ${error.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // EXCEL Export
  const handleExportExcel = () => {
    // 1. Setup Data & Variables
    const thaiMonths = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const monthName = thaiMonths[currentDate.getMonth()];
    const buddhistYear = currentDate.getFullYear() + 543;
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const daysHeader = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    
    // Determine source assignments (Snapshot vs Current)
    const sourceAssignments = isPublished && originalAssignments.length > 0 ? originalAssignments : assignments;

    // 2. Define Helper Functions (Logic from OfficialPrintView)
    const getShiftCode = (staffId: string, day: number) => {
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = formatDateToISO(dateObj);
        const shift = sourceAssignments.find(a => a.staffId === staffId && a.date === dateStr);
        if (!shift) return "";
        switch (shift.shiftType) {
            case ShiftType.MORNING: return "ช";
            case ShiftType.AFTERNOON: return "บ";
            case ShiftType.NIGHT: return "ด";
            default: return "";
        }
    };

    const isOutgoingCrossMonthCombo = (staffId: string) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const lastDayObj = new Date(year, month + 1, 0); 
        const lastDayStr = formatDateToISO(lastDayObj);
        const nextMonthFirstObj = new Date(year, month + 1, 1);
        const nextMonthFirstStr = formatDateToISO(nextMonthFirstObj);
        
        const hasAfternoonLastDay = sourceAssignments.some(a => a.staffId === staffId && a.date === lastDayStr && a.shiftType === ShiftType.AFTERNOON);
        const hasNightNextDay = sourceAssignments.some(a => a.staffId === staffId && a.date === nextMonthFirstStr && a.shiftType === ShiftType.NIGHT);
        return hasAfternoonLastDay && hasNightNextDay;
    };

    const isIncomingCrossMonthCombo = (staffId: string) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const prevMonthLastDayObj = new Date(year, month, 0); 
        const prevMonthLastDayStr = formatDateToISO(prevMonthLastDayObj);
        const currentMonthFirstObj = new Date(year, month, 1);
        const currentMonthFirstStr = formatDateToISO(currentMonthFirstObj);

        const hasAfternoonPrevLastDay = sourceAssignments.some(a => a.staffId === staffId && a.date === prevMonthLastDayStr && a.shiftType === ShiftType.AFTERNOON);
        const hasNightFirstDay = sourceAssignments.some(a => a.staffId === staffId && a.date === currentMonthFirstStr && a.shiftType === ShiftType.NIGHT);
        return hasAfternoonPrevLastDay && hasNightFirstDay;
    };

    const calculateShiftCount = (staffId: string) => {
        let count = 0;
        for(let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            const dateStr = formatDateToISO(dateObj);
            const shift = sourceAssignments.find(a => a.staffId === staffId && a.date === dateStr);
            if (shift) {
                if (shift.shiftType === ShiftType.MORNING) count += 1;
                else if (shift.shiftType === ShiftType.AFTERNOON) count += 0.5;
                else if (shift.shiftType === ShiftType.NIGHT) count += 0.5;
            }
        }
        if (isOutgoingCrossMonthCombo(staffId)) count += 0.5;
        if (isIncomingCrossMonthCombo(staffId)) count -= 0.5;
        return count % 1 === 0 ? count : Number(count.toFixed(1));
    };

    const calculateAmount = (staffId: string) => {
        let sum = 0;
        for(let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            const dateStr = formatDateToISO(dateObj);
            const shift = sourceAssignments.find(a => a.staffId === staffId && a.date === dateStr);
            if (shift) {
                if (shift.shiftType === ShiftType.MORNING) sum += 750;
                else if (shift.shiftType === ShiftType.AFTERNOON) sum += 375;
                else if (shift.shiftType === ShiftType.NIGHT) sum += 375;
            }
        }
        if (isOutgoingCrossMonthCombo(staffId)) sum += 375;
        if (isIncomingCrossMonthCombo(staffId)) sum -= 375;
        return sum;
    };

    // 3. Construct Excel Rows
    // Row 1: Main Title
    const titleRow = ["หลักฐานการขออนุมัติปฏิบัติงานนอกเวลาราชการ"];
    // Row 2: Sub Title
    const subTitleRow = [`ส่วนราชการ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช ประจำเดือน ${monthName} พ.ศ. ${buddhistYear} งานศูนย์คอมพิวเตอร์`];
    // Row 3: Empty
    const emptyRow = [];
    // Row 4: Header
    const headerRow = ['ลำดับ', 'ชื่อ-สกุล', ...daysHeader, 'จำนวนเวร', 'จำนวนเงิน'];

    // Data Rows
    const dataRows = staffList.map((staff, index) => {
        const shiftCells = Array.from({ length: daysInMonth }, (_, i) => getShiftCode(staff.id, i + 1));
        return [
            index + 1,
            staff.name,
            ...shiftCells,
            calculateShiftCount(staff.id),
            calculateAmount(staff.id)
        ];
    });

    // 4. Create Workbook
    const wb = XLSX.utils.book_new();
    const wsData = [titleRow, subTitleRow, emptyRow, headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 5. Merge Cells for Titles
    // Merge title across all columns (2 + daysInMonth + 2) = 4 + daysInMonth
    const totalCols = 2 + daysInMonth + 2; 
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // Row 0 (Title)
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }, // Row 1 (Sub Title)
    ];

    // Optional: Set column widths for better readability
    const wscols = [
        { wch: 6 },  // No
        { wch: 20 }, // Name
        ...Array(daysInMonth).fill({ wch: 3 }), // Days
        { wch: 10 }, // Count
        { wch: 12 }  // Amount
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Roster");
    
    // 6. Save File
    const monthStrEn = currentDate.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
    const fileName = isPublished && originalAssignments.length > 0 
        ? `duty_roster_${monthStrEn}_original.xlsx` 
        : `duty_roster_${monthStrEn}.xlsx`;
        
    XLSX.writeFile(wb, fileName);
  };

  // Logic: Absolute Freedom Swap (Cross-Type Swap) with Relative Date Logic
  // 1. Identify "Dominant Package" at Source and Target (Morning, or Afternoon+Night, or Night+PrevAfternoon).
  // 2. Perform unconditional swap by calculating RELATIVE OFFSETS from the clicked date.
  const getDominantBlock = (coord: CellCoordinate) => {
      const currentShifts = getShifts(coord.staffId, coord.day);
      
      // Priority 1: Morning
      const morning = currentShifts.find(s => s.shiftType === ShiftType.MORNING);
      if (morning) return [morning];

      // Priority 2: Afternoon (Start of Combo)
      const afternoon = currentShifts.find(s => s.shiftType === ShiftType.AFTERNOON);
      if (afternoon) {
            // Find next day Night
            const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), coord.day + 1);
            const nextDateStr = formatDateToISO(nextDate);
            const nextNight = assignments.find(a => 
              a.staffId === coord.staffId && 
              a.date === nextDateStr && 
              a.shiftType === ShiftType.NIGHT
            );
            return nextNight ? [afternoon, nextNight] : [afternoon];
      }

      // Priority 3: Night (End of Combo - clicked on the Night part)
      const night = currentShifts.find(s => s.shiftType === ShiftType.NIGHT);
      if (night) {
            // Find prev day Afternoon
            const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), coord.day - 1);
            const prevDateStr = formatDateToISO(prevDate);
            const prevAfternoon = assignments.find(a => 
              a.staffId === coord.staffId && 
              a.date === prevDateStr && 
              a.shiftType === ShiftType.AFTERNOON
            );
            return prevAfternoon ? [prevAfternoon, night] : [night];
      }

      // Priority 4: Empty (Off)
      return [];
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

  // Improved to allow coexistence of Morning and Night, Afternoon and Night, etc.
  const updateAssignmentsWithRule = async (
    currentAssignments: ShiftAssignment[], 
    staffId: string, 
    date: Date, 
    newType: ShiftType
  ): Promise<ShiftAssignment[]> => {
    const dateStr = formatDateToISO(date);
    
    // Check if the exact shift type already exists
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

    await insertAssignmentToDB(newAssignment);
    
    // Logic to keep compatible shifts:
    // We want to be permissive.
    // - NIGHT (00-08) is compatible with MORNING (08-16) and AFTERNOON (16-24).
    // - MORNING conflicts with AFTERNOON (usually, unless double shift).
    // - But essentially, we NEVER delete NIGHT unless explicitly removed (via OFF).
    
    let assignmentsToKeep = currentAssignments.filter(a => {
         if (a.staffId !== staffId || a.date !== dateStr) return true;
         // On the same day logic:
         if (newType === ShiftType.MORNING) {
             // Keep Night. Remove Afternoon (Assuming M replaces A).
             return a.shiftType === ShiftType.NIGHT;
         } else if (newType === ShiftType.AFTERNOON) {
             // Keep Night. Remove Morning (Assuming A replaces M).
             return a.shiftType === ShiftType.NIGHT;
         } else if (newType === ShiftType.NIGHT) {
             // Keep Everything (Night doesn't overlap M or A).
             return true; 
         }
         return false; // Default (e.g. OFF handles its own deletion logic before calling this, or falls here)
    });
        
    // Identify what to remove for DB sync
    const assignmentsToRemove = currentAssignments.filter(a => {
        if (a.staffId !== staffId || a.date !== dateStr) return false;
        // If it's in assignmentsToKeep, don't remove.
        const keeping = assignmentsToKeep.some(k => k.id === a.id);
        return !keeping;
    });

    for (const s of assignmentsToRemove) {
        await deleteAssignmentFromDB(s.id);
    }

    return [...assignmentsToKeep, newAssignment];
  };

  const performSwap = async (source: CellCoordinate, target: CellCoordinate) => {
    const sShiftsToMove = getDominantBlock(source);
    const tShiftsToMove = getDominantBlock(target);

    // Logging Logic
    const sName = getStaffName(source.staffId);
    const tName = getStaffName(target.staffId);
    const sourceDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), source.day);
    const targetDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), target.day);
    const formatDateShort = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    
    const getLabel = (shifts: ShiftAssignment[]) => {
        if (shifts.length === 0) return 'วันหยุด';
        const types = shifts.map(s => s.shiftType);
        if (types.includes(ShiftType.MORNING)) return 'เวรเช้า';
        if (types.includes(ShiftType.AFTERNOON) || types.includes(ShiftType.NIGHT)) return 'บ่าย-ดึก';
        return 'เวร';
    };
    const sLabel = getLabel(sShiftsToMove);
    const tLabel = getLabel(tShiftsToMove);

    const msg = `เวร ${sLabel} ${sName} วันที่ ${formatDateShort(sourceDateObj)} แลกกับ เวร ${tLabel} ${tName} วันที่ ${formatDateShort(targetDateObj)}`;
    
    // Only log if something actually happened (not swapping Off with Off)
    if (sShiftsToMove.length > 0 || tShiftsToMove.length > 0) {
        await addHistoryLog(formatDateToISO(sourceDateObj), msg, 'SWAP');
    }
    
    // Helper: Parse Date
    const parseISODate = (str: string) => {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    // Bases
    const sBaseDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), source.day);
    const tBaseDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), target.day);

    // Precise Date Calculation using Offsets
    const calculateNewDate = (shiftDateStr: string, originalAnchorDate: Date, newAnchorDate: Date) => {
        const shiftDate = parseISODate(shiftDateStr);
        const diff = shiftDate.getTime() - originalAnchorDate.getTime();
        const newDate = new Date(newAnchorDate.getTime() + diff);
        return formatDateToISO(newDate);
    };

    let nextAssignments = [...assignments];

    // 1. CLEANUP: Remove Source Shifts from DB & State
    for (const s of sShiftsToMove) {
        nextAssignments = nextAssignments.filter(a => a.id !== s.id);
        await deleteAssignmentFromDB(s.id);
    }

    // 2. CLEANUP: Remove Target Shifts from DB & State
    for (const s of tShiftsToMove) {
        nextAssignments = nextAssignments.filter(a => a.id !== s.id);
        await deleteAssignmentFromDB(s.id);
    }

    // 3. MOVE TARGET -> SOURCE
    for (const s of tShiftsToMove) {
        const newStaffId = source.staffId;
        const newDate = calculateNewDate(s.date, tBaseDate, sBaseDate);
        const newId = `${newStaffId}-${newDate}-${s.shiftType}`;
        const newAssign = { ...s, id: newId, staffId: newStaffId, date: newDate };
        
        if (!nextAssignments.some(na => na.id === newId)) {
            nextAssignments.push(newAssign);
            await insertAssignmentToDB(newAssign);
        }
    }

    // 4. MOVE SOURCE -> TARGET
    for (const s of sShiftsToMove) {
         const newStaffId = target.staffId;
         const newDate = calculateNewDate(s.date, sBaseDate, tBaseDate);
         const newId = `${newStaffId}-${newDate}-${s.shiftType}`;
         const newAssign = { ...s, id: newId, staffId: newStaffId, date: newDate };
         
         if (!nextAssignments.some(na => na.id === newId)) {
            nextAssignments.push(newAssign);
            await insertAssignmentToDB(newAssign);
         }
    }

    setAssignments(nextAssignments);
    setIsSwapMode(false);
    setSwapSource(null);
    setSwapSourceIds([]);
  };

  const executeSave = async (action: string, staffId: string, day: number) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const targetDateStr = formatDateToISO(targetDate);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);
    const nextDateStr = formatDateToISO(nextDate);
    
    // Helper to remove specific shift type from a day for specific staff
    const removeShiftType = async (list: ShiftAssignment[], dStr: string, type: ShiftType) => {
        const toRemove = list.filter(a => a.date === dStr && a.staffId === staffId && a.shiftType === type);
        for (const a of toRemove) {
            await deleteAssignmentFromDB(a.id);
        }
        return list.filter(a => !(a.date === dStr && a.staffId === staffId && a.shiftType === type));
    };

    if (action === 'OFF') {
        const currentShifts = getShifts(staffId, day);
        let newAssignments = [...assignments];

        // Remove everything on this day
        const toDelete = newAssignments.filter(a => a.staffId === staffId && a.date === targetDateStr);
        for (const a of toDelete) {
            await deleteAssignmentFromDB(a.id);
        }
        newAssignments = newAssignments.filter(a => !(a.staffId === staffId && a.date === targetDateStr));

        // Logic to clean up Combo orphans
        for (const shift of currentShifts) {
             if (shift.shiftType === ShiftType.AFTERNOON) {
                // If removing Afternoon, check for linked Night next day
                newAssignments = await removeShiftType(newAssignments, formatDateToISO(nextDate), ShiftType.NIGHT);
             } else if (shift.shiftType === ShiftType.NIGHT) {
                // If removing Night, check for linked Afternoon prev day
                const prevDate = new Date(targetDate);
                prevDate.setDate(targetDate.getDate() - 1);
                newAssignments = await removeShiftType(newAssignments, formatDateToISO(prevDate), ShiftType.AFTERNOON);
             }
        }
        setAssignments(newAssignments);

    } else if (action === 'MORNING') {
        let temp = [...assignments];

        // 1. GLOBAL RULE: Only 1 Morning allowed per day across ALL staff.
        const existingMorning = temp.filter(a => a.date === targetDateStr && a.shiftType === ShiftType.MORNING);
        for (const ex of existingMorning) {
             temp = temp.filter(a => a.id !== ex.id);
             await deleteAssignmentFromDB(ex.id);
        }

        // 2. SELF CLEANUP: Remove conflicting types for THIS staff
        temp = await removeShiftType(temp, targetDateStr, ShiftType.AFTERNOON);
        
        // Clean up linked Night if we removed an Afternoon
        const hasAfternoon = assignments.some(a => a.staffId === staffId && a.date === targetDateStr && a.shiftType === ShiftType.AFTERNOON);
        if (hasAfternoon) {
             temp = await removeShiftType(temp, formatDateToISO(nextDate), ShiftType.NIGHT);
        }

        const finalAssignments = await updateAssignmentsWithRule(temp, staffId, targetDate, ShiftType.MORNING);
        setAssignments(finalAssignments);

    } else if (action === 'BD_COMBO') {
        let temp = [...assignments];
        
        // 1. GLOBAL RULE: Only 1 Afternoon (Day 1) allowed across ALL staff.
        const existingAfternoon = temp.find(a => a.date === targetDateStr && a.shiftType === ShiftType.AFTERNOON);
        if (existingAfternoon) {
            temp = temp.filter(a => a.id !== existingAfternoon.id);
            await deleteAssignmentFromDB(existingAfternoon.id);

            const linkedNight = temp.find(a => a.staffId === existingAfternoon.staffId && a.date === nextDateStr && a.shiftType === ShiftType.NIGHT);
            if (linkedNight) {
                temp = temp.filter(a => a.id !== linkedNight.id);
                await deleteAssignmentFromDB(linkedNight.id);
            }
        }

        // 2. GLOBAL RULE: Only 1 Night (Day 2) allowed across ALL staff.
        const existingNight = temp.find(a => a.date === nextDateStr && a.shiftType === ShiftType.NIGHT);
        if (existingNight) {
             temp = temp.filter(a => a.id !== existingNight.id);
             await deleteAssignmentFromDB(existingNight.id);
        }

        // 3. SELF CLEANUP
        temp = await removeShiftType(temp, targetDateStr, ShiftType.MORNING);
        temp = await removeShiftType(temp, targetDateStr, ShiftType.AFTERNOON);
        temp = await removeShiftType(temp, nextDateStr, ShiftType.NIGHT);

        // Add new shifts
        temp = await updateAssignmentsWithRule(temp, staffId, targetDate, ShiftType.AFTERNOON);
        const finalAssignments = await updateAssignmentsWithRule(temp, staffId, nextDate, ShiftType.NIGHT);
        setAssignments(finalAssignments);
    }
  };

  const handleSaveRequest = async (action: string) => {
    if (!selectedCell) return;
    const { staffId, day } = selectedCell;
    await executeSave(action, staffId, day);
    setSelectedCell(null);
  };

  const handleConfirmSave = async () => {
    if (pendingSave) {
        await executeSave(pendingSave.action, pendingSave.staffId, pendingSave.day);
        setPendingSave(null);
        setIsConfirmOpen(false);
    }
  };

  const initiateSwapFromModal = () => {
    // Identify blocks to highlight visually immediately
    if (selectedCell) {
        const block = getDominantBlock(selectedCell);
        setSwapSourceIds(block.map(s => s.id));
    }
    setSwapSource(selectedCell);
    setIsSwapMode(true);
    setSelectedCell(null);
  };

  const renderCell = (staff: Staff, day: number) => {
    const shifts = getShifts(staff.id, day);
    
    // Improved Swap Logic Visuals: Check if ANY shift in this cell is part of the Swap Source Block
    const isSourceCell = isSwapMode && shifts.some(s => swapSourceIds.includes(s.id));
    
    // If empty cell selected as source (swapping "OFF")
    const isSourceEmpty = isSwapMode && swapSource && swapSource.staffId === staff.id && swapSource.day === day && shifts.length === 0;

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
    
    // Enhanced Highlight: Pulse ANY cell that is part of the source block (Morning, Afternoon, OR Night)
    const swapClass = (isSourceCell || isSourceEmpty) ? 'ring-2 ring-primary ring-inset z-10 animate-pulse bg-primary/5' : '';
    
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
          h-14 md:h-16 flex-1 min-w-[34px] md:min-w-[44px] border-r border-b border-slate-200 flex flex-col transition-all relative overflow-hidden
          ${isSpecial ? 'bg-slate-300' : ''}
          ${cursorClass}
          ${swapClass}
          ${todayClass}
          ${todayShiftHighlight}
        `}
      >
        {isCurrentDay && shifts.length > 0 && (
            <div className={`absolute top-0.5 right-0.5 w-2 h-2 md:w-2.5 md:h-2.5 ${todayDotColor} ${todayDotAnimate} rounded-full shadow-sm z-30 ring-2 ring-white`}></div>
        )}
        {content}
      </div>
    );
  };

  // Helper to filter assignments for the current month
  const currentMonthAssignments = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}-`;
    return assignments.filter(a => a.date.startsWith(prefix));
  }, [assignments, currentDate]);

  const getStaffTotal = (staffId: string) => {
    if (!shouldShowContent) return 0;
    
    // 1. Calculate base sum within current view
    let sum = 0;
    // currentMonthAssignments is already filtered by date prefix in useMemo
    currentMonthAssignments.filter(a => a.staffId === staffId).forEach(s => {
            if (s.shiftType === ShiftType.MORNING) sum += 1;
            else if (s.shiftType === ShiftType.AFTERNOON) sum += 0.5;
            else if (s.shiftType === ShiftType.NIGHT) sum += 0.5;
    });

    // 2. Cross-Month Logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed
    
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
        a.staffId === staffId && a.date === lastDayStr && a.shiftType === ShiftType.AFTERNOON
    );
    const hasNightNextDay = assignments.some(a => 
        a.staffId === staffId && a.date === nextMonthFirstStr && a.shiftType === ShiftType.NIGHT
    );
    if (hasAfternoonLastDay && hasNightNextDay) {
        sum += 0.5;
    }

    // Incoming: Afternoon (End of Prev) -> Night (Start of This) => -0.5 from this month (Night counts as 0)
    const hasAfternoonPrevMonth = assignments.some(a => 
        a.staffId === staffId && a.date === prevMonthLastDayStr && a.shiftType === ShiftType.AFTERNOON
    );
    const hasNightFirstDay = assignments.some(a => 
        a.staffId === staffId && a.date === currentMonthFirstStr && a.shiftType === ShiftType.NIGHT
    );
    if (hasAfternoonPrevMonth && hasNightFirstDay) {
        sum -= 0.5;
    }

    // Return integer if possible, else 1 decimal
    return sum % 1 === 0 ? sum : sum.toFixed(1);
  };

  const getStaffAmount = (staffId: string) => {
    if (!shouldShowContent) return 0;
    
    let sum = 0;
    
    // 1. Base Sum from current month assignments
    currentMonthAssignments.filter(a => a.staffId === staffId).forEach(s => {
       if (s.shiftType === ShiftType.MORNING) sum += 750;
       else if (s.shiftType === ShiftType.AFTERNOON) sum += 375;
       else if (s.shiftType === ShiftType.NIGHT) sum += 375;
    });

    // 2. Cross-Month Logic (Same as OfficialPrintView)
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); 
    
    const lastDayObj = new Date(year, month + 1, 0);
    const lastDayStr = formatDateToISO(lastDayObj);
    const nextMonthFirstObj = new Date(year, month + 1, 1);
    const nextMonthFirstStr = formatDateToISO(nextMonthFirstObj);
    
    const prevMonthLastDayObj = new Date(year, month, 0);
    const prevMonthLastDayStr = formatDateToISO(prevMonthLastDayObj);
    const currentMonthFirstObj = new Date(year, month, 1);
    const currentMonthFirstStr = formatDateToISO(currentMonthFirstObj);

    // Outgoing Combo: Afternoon (End of Month) -> Night (Start of Next) => +375
    const hasAfternoonLastDay = assignments.some(a => 
        a.staffId === staffId && a.date === lastDayStr && a.shiftType === ShiftType.AFTERNOON
    );
    const hasNightNextDay = assignments.some(a => 
        a.staffId === staffId && a.date === nextMonthFirstStr && a.shiftType === ShiftType.NIGHT
    );
    if (hasAfternoonLastDay && hasNightNextDay) {
        sum += 375;
    }

    // Incoming Combo: Afternoon (End of Prev) -> Night (Start of This) => -375
    const hasAfternoonPrevMonth = assignments.some(a => 
        a.staffId === staffId && a.date === prevMonthLastDayStr && a.shiftType === ShiftType.AFTERNOON
    );
    const hasNightFirstDay = assignments.some(a => 
        a.staffId === staffId && a.date === currentMonthFirstStr && a.shiftType === ShiftType.NIGHT
    );
    if (hasAfternoonPrevMonth && hasNightFirstDay) {
        sum -= 375;
    }

    return sum.toLocaleString();
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans antialiased"> 
      <Header 
        currentDate={currentDate}
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        isKikOrAdmin={isKikOrAdmin}
        isPublished={isPublished}
        shouldShowContent={shouldShowContent}
        onPrevMonth={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
        onNextMonth={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
        onSetCurrentMonth={() => setCurrentDate(new Date())}
        onLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogoutSubmit}
        onPublish={handlePublish}
        onReset={handleResetMonth}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onOpenStats={() => setIsStatsOpen(true)}
        onOpenAdminManager={() => setIsAdminManagerOpen(true)}
      />

        <main className="flex-1 flex flex-col min-h-0 relative">
          {!shouldShowContent && (
             <div className="absolute inset-0 z-10 bg-slate-50/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                 <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-200 max-w-md mx-4">
                     <h3 className="text-xl font-bold text-slate-800 mb-2">ตารางเวรเดือนนี้อยู่ระหว่างการจัดทำ</h3>
                     <p className="text-slate-500">ผู้ดูแลระบบกำลังจัดตารางเวร (Draft Mode)</p>
                 </div>
             </div>
          )}

          {isSwapMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-lg bg-indigo-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-sm flex items-center justify-between animate-in slide-in-from-top-4 border border-indigo-500/50">
                  <div className="flex items-center gap-4">
                      <p className="font-bold text-base">โหมดสลับเวร</p>
                  </div>
                  <button onClick={() => { setIsSwapMode(false); setSwapSource(null); setSwapSourceIds([]); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/20">ยกเลิก</button>
              </div>
          )}

          <StaffList staffList={staffList} />

          <CalendarGrid 
            daysInMonth={daysInMonth}
            staffList={staffList}
            assignments={assignments}
            renderCell={renderCell}
            getStaffTotal={getStaffTotal}
            getStaffAmount={getStaffAmount}
            isKikOrAdmin={isKikOrAdmin}
          />

          <ShiftLogList logs={history} />
        </main>

      {/* Loading Overlay to hide the flashing print area from user view */}
      {isExporting && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
           <svg className="animate-spin h-10 w-10 mb-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
           <div className="text-xl font-bold">กำลังสร้างไฟล์ PDF...</div>
           <div className="text-sm text-gray-300 mt-2">กรุณารอสักครู่ ระบบกำลังจัดเตรียมเอกสาร 2 หน้า</div>
        </div>
      )}

      {/* 
         HIDDEN PRINT AREA - STRATEGY:
         1. Default: Position off-screen (bottom) so it is rendered but invisible to user.
         2. Exporting: Position top-left (0,0) with high Z-Index but BELOW the loading overlay.
            This ensures html2canvas can "see" it within the viewport without error.
         
         LOGIC UPDATE:
         If published and originalAssignments (snapshot) exists, use that.
         Otherwise, use current assignments.
      */}
      <div style={{ 
          position: 'fixed', 
          top: isExporting ? 0 : '100vh', // Move off-screen when not using
          left: 0, 
          zIndex: isExporting ? 5000 : -50, // High Z when exporting
          width: '297mm',
          visibility: 'visible', // Must be visible for html2canvas
          pointerEvents: 'none'
      }}>
        <div ref={printRef} style={{ width: '100%', backgroundColor: '#ffffff' }}>
          <OfficialPrintView 
            currentDate={currentDate}
            staffList={staffList}
            // Use Original Snapshot if available and published, otherwise use current
            assignments={isPublished && originalAssignments.length > 0 ? originalAssignments : assignments}
            daysInMonth={daysInMonth}
            holidays={HOLIDAYS}
          />
        </div>
      </div>

      <Modals 
        isLoginModalOpen={isLoginModalOpen}
        setIsLoginModalOpen={setIsLoginModalOpen}
        handleLoginSubmit={handleLoginSubmit}
        isAdminManagerOpen={isAdminManagerOpen}
        setIsAdminManagerOpen={setIsAdminManagerOpen}
        selectedCell={selectedCell}
        setSelectedCell={setSelectedCell}
        staffList={staffList}
        currentDate={currentDate}
        getFirstShift={getFirstShift}
        handleSaveRequest={handleSaveRequest}
        initiateSwapFromModal={initiateSwapFromModal}
        isWeekendOrHoliday={isWeekendOrHoliday}
        history={history}
        isKikOrAdmin={isKikOrAdmin}
        isConfirmOpen={isConfirmOpen}
        setIsConfirmOpen={setIsConfirmOpen}
        handleConfirmSave={handleConfirmSave}
        conflictMessages={conflictMessages}
        isStatsOpen={isStatsOpen}
        setIsStatsOpen={setIsStatsOpen}
        assignments={assignments}
      />
    </div>
  );
};

export default App;