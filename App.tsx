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
  // NEW: Store the original schedule (snapshot) when published
  const [originalAssignments, setOriginalAssignments] = useState<ShiftAssignment[]>([]); 
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

  // Visibility Logic: 
  // If user is Admin/Kik -> Show everything
  // If Published -> Show everything
  // Else (Regular user + Draft mode) -> Show nothing
  const shouldShowContent = useMemo(() => {
      return isKikOrAdmin || isPublished;
  }, [isKikOrAdmin, isPublished]);

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

        // Calculate Date Range: Fetch Current Month +/- 1 Month
        // This supports cross-month shift calculations (incoming/outgoing) 
        // while preventing loading the entire database history.
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Start: 1st day of Previous Month
        const startObj = new Date(year, month - 1, 1);
        const startStr = formatDateToISO(startObj);

        // End: Last day of Next Month
        const endObj = new Date(year, month + 2, 0); 
        const endStr = formatDateToISO(endObj);

        // 1. Fetch Assignments (Live Data) - Scoped to relevant months
        const { data: shiftData, error: shiftError } = await supabase
          .from('Table-kik')
          .select('*')
          .gte('date', startStr)
          .lte('date', endStr);
          
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

        // 2. Fetch Publish Status AND Original Snapshot
        const { data: statusData, error: statusError } = await supabase
          .from('monthly_roster_status')
          .select('is_published, original_assignments')
          .eq('month_key', monthKey)
          .single();

        if (statusError && statusError.code !== 'PGRST116') {
            console.error('Error fetching status:', statusError);
        }
        
        const published = statusData?.is_published || false;
        setIsPublished(published);
        
        // Load the snapshot if it exists
        if (statusData?.original_assignments) {
            setOriginalAssignments(statusData.original_assignments as ShiftAssignment[]);
        } else {
            setOriginalAssignments([]);
        }

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
    const confirm = window.confirm(`คำเตือน! คุณต้องการ "ล้างข้อมูล" ทั้งหมดของเดือนนี้ใช่หรือไม่?\n\n1. ข้อมูลเวรทั้งหมดในเดือน ${currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} จะถูกลบถาวร\n2. สถานะจะถูกเปลี่ยนกลับเป็น "ฉบับร่าง" (Draft) เพื่อให้คุณเริ่มจัดใหม่\n3. ประวัติการแลกเวรทั้งหมดของเดือนนี้จะถูกลบ`);
    if (!confirm) return;

    try {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const searchPattern = `${year}-${month}-%`;
        const monthKey = getMonthKey(currentDate);

        // 1. Delete assignments
        const { error: deleteError } = await supabase
            .from('Table-kik')
            .delete()
            .like('date', searchPattern);

        if (deleteError) throw deleteError;

        // 2. Delete shift logs for this month
        const { error: deleteLogsError } = await supabase
            .from('shift_logs')
            .delete()
            .eq('month_key', monthKey);

        if (deleteLogsError) throw deleteLogsError;

        // 3. Unpublish (Set back to draft) AND Clear Snapshot
        // Try to update with original_assignments (assuming DB is updated)
        const statusPayload: any = { 
            month_key: monthKey, 
            is_published: false,
            published_by: currentUsername,
            original_assignments: null 
        };

        const { error: statusError } = await supabase
            .from('monthly_roster_status')
            .upsert(statusPayload);

        // Fallback: If DB schema is old (missing column), try updating without original_assignments
        if (statusError) {
             if (statusError.message.includes("Could not find the 'original_assignments' column")) {
                 console.warn("Schema mismatch: Falling back to legacy update (without original_assignments)");
                 const { error: retryError } = await supabase
                    .from('monthly_roster_status')
                    .upsert({ 
                        month_key: monthKey, 
                        is_published: false,
                        published_by: currentUsername
                    });
                 if (retryError) throw retryError;
             } else {
                 throw statusError;
             }
        }

        // Clear local state for this month & Set to Draft
        setAssignments(prev => prev.filter(a => !a.date.startsWith(`${year}-${month}-`)));
        setOriginalAssignments([]);
        setHistory([]); // Clear local history
        setIsPublished(false);
        
        alert("ล้างข้อมูลและยกเลิกการประกาศเรียบร้อยแล้ว");
    } catch (e: any) {
        console.error("Reset failed", e);
        alert("เกิดข้อผิดพลาดในการล้างข้อมูล: " + e.message);
    }
  };

  // Publish Action
  const handlePublish = async () => {
    if (!isKikOrAdmin) return;
    const confirm = window.confirm("คุณต้องการบันทึกและประกาศตารางเวรเดือนนี้ใช่หรือไม่?\n\nระบบจะทำการบันทึกตารางเวรปัจจุบันเป็น 'ต้นฉบับ' สำหรับการพิมพ์ PDF โดยจะไม่เปลี่ยนแปลงตามการแลกเวรในภายหลัง");
    if (!confirm) return;

    try {
        const monthKey = getMonthKey(currentDate);
        
        // Save current assignments (within the fetched 3-month window) as the "Original Snapshot"
        // This ensures the snapshot contains the relevant cross-month data for correct calculations
        const snapshot = [...assignments];

        const { error } = await supabase
            .from('monthly_roster_status')
            .upsert({ 
                month_key: monthKey, 
                is_published: true,
                published_by: currentUsername,
                original_assignments: snapshot // Save snapshot to DB
            });

        if (error) {
            // Check for schema error
            if (error.message.includes("Could not find the 'original_assignments' column")) {
                 alert("ไม่สามารถบันทึก Snapshot ได้เนื่องจากฐานข้อมูลยังไม่อัปเดต\n\nระบบจะทำการประกาศเวรโดยไม่บันทึก Snapshot (PDF อาจเปลี่ยนตามการแก้ไขล่าสุด)\n\nกรุณารันไฟล์ db_setup.sql ใน Supabase เพื่อแก้ไขถาวร");
                 
                 // Fallback publish without snapshot
                 const { error: retryError } = await supabase
                    .from('monthly_roster_status')
                    .upsert({ 
                        month_key: monthKey, 
                        is_published: true,
                        published_by: currentUsername
                    });
                 
                 if (retryError) throw retryError;
            } else {
                throw error;
            }
        }
        
        setIsPublished(true);
        setOriginalAssignments(snapshot); // Update local state
        alert("ประกาศตารางเวรเรียบร้อยแล้ว");
    } catch (e: any) {
        console.error("Publish failed", e);
        alert("เกิดข้อผิดพลาดในการประกาศตารางเวร: " + e.message);
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
  const updateAssignmentsWithRule = (
    currentAssignments: ShiftAssignment[], 
    staffId: string, 
    date: Date, 
    newType: ShiftType
  ): ShiftAssignment[] => {
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

    saveAssignmentToDB(newAssignment);
    
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

    assignmentsToRemove.forEach(s => deleteAssignmentFromDB(s.id));

    return [...assignmentsToKeep, newAssignment];
  };

  const performSwap = (source: CellCoordinate, target: CellCoordinate) => {
    // Logic: Smart Priority Selection Swap
    // 1. Identify "Units/Blocks" at Source and Target.
    // 2. Determine "User Intent" based on Source Priority (Morning > Combo).
    // 3. Find matching block in Target.
    // 4. If match found, swap those.
    // 5. If no match found, swap "User Intent" with "Target Priority" (Freedom Mode).

    const getShiftBlocks = (coord: CellCoordinate) => {
        const currentShifts = getShifts(coord.staffId, coord.day);
        const blocks: { type: 'M' | 'BD'; shifts: ShiftAssignment[] }[] = [];
        
        currentShifts.forEach(shift => {
            if (shift.shiftType === ShiftType.MORNING) {
                blocks.push({ type: 'M', shifts: [shift] });
            } else if (shift.shiftType === ShiftType.AFTERNOON) {
                // Afternoon + Next Night
                const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), coord.day + 1);
                const nextDateStr = formatDateToISO(nextDate);
                const nextNight = assignments.find(a => 
                    a.staffId === coord.staffId && 
                    a.date === nextDateStr && 
                    a.shiftType === ShiftType.NIGHT
                );
                blocks.push({ type: 'BD', shifts: nextNight ? [shift, nextNight] : [shift] });
            } else if (shift.shiftType === ShiftType.NIGHT) {
                // Night + Prev Afternoon
                const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), coord.day - 1);
                const prevDateStr = formatDateToISO(prevDate);
                const prevAfternoon = assignments.find(a => 
                    a.staffId === coord.staffId && 
                    a.date === prevDateStr && 
                    a.shiftType === ShiftType.AFTERNOON
                );
                blocks.push({ type: 'BD', shifts: prevAfternoon ? [prevAfternoon, shift] : [shift] });
            }
        });

        // Simple deduplication based on shift IDs to avoid double counting
        const uniqueBlocks: typeof blocks = [];
        const seenIds = new Set<string>();
        blocks.forEach(b => {
            const ids = b.shifts.map(s => s.id).join(',');
            if (!seenIds.has(ids)) {
                seenIds.add(ids);
                uniqueBlocks.push(b);
            }
        });
        return uniqueBlocks;
    };

    const sourceBlocks = getShiftBlocks(source);
    const targetBlocks = getShiftBlocks(target);

    // Priority Helper: Morning > Combo (BD)
    const getPriorityBlock = (blocks: typeof sourceBlocks) => {
        const mBlock = blocks.find(b => b.type === 'M');
        if (mBlock) return mBlock;
        const bdBlock = blocks.find(b => b.type === 'BD');
        if (bdBlock) return bdBlock;
        return null;
    };

    const sBlock = getPriorityBlock(sourceBlocks);
    
    let sShiftsToMove: ShiftAssignment[] = [];
    let tShiftsToMove: ShiftAssignment[] = [];

    if (sBlock) {
        // Source is not empty. Determine intent based on Source Priority.
        
        // Try to find matching type in Target (Smart Match)
        const matchingTBlock = targetBlocks.find(b => b.type === sBlock.type);
        
        if (matchingTBlock) {
            // Match Found: Swap Same Types
            sShiftsToMove = sBlock.shifts;
            tShiftsToMove = matchingTBlock.shifts;
        } else {
            // No Match: Freedom Swap (Swap Source Priority with Target Priority)
            // This fixes the "Swap Twice" issue by specifically targeting the Priority Block
            // instead of swapping *everything* (which might include unwanted leftover shifts).
            sShiftsToMove = sBlock.shifts;
            const tPriorityBlock = getPriorityBlock(targetBlocks);
            if (tPriorityBlock) {
                tShiftsToMove = tPriorityBlock.shifts;
            } else {
                // Target is empty
                tShiftsToMove = [];
            }
        }
    } else {
        // Source is empty.
        // We act based on Target Priority (effectively moving Target to Source)
        const tPriorityBlock = getPriorityBlock(targetBlocks);
        if (tPriorityBlock) {
            tShiftsToMove = tPriorityBlock.shifts;
            sShiftsToMove = [];
        } else {
            // Both empty. Do nothing.
            setIsSwapMode(false);
            setSwapSource(null);
            return;
        }
    }

    // Logging Logic
    const sName = getStaffName(source.staffId);
    const tName = getStaffName(target.staffId);
    const sourceDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), source.day);
    const targetDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), target.day);
    const formatDateShort = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    
    // Generate readable label for log
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
    if (sShiftsToMove.length > 0 || tShiftsToMove.length > 0) {
        addHistoryLog(formatDateToISO(sourceDateObj), msg, 'SWAP');
    }
    
    // Logic: Date Shifting for Same-Staff Swap vs Responsibility Swap for Diff-Staff
    const isSameStaff = source.staffId === target.staffId;
    
    // Helper to safely parse YYYY-MM-DD to Local Date
    const parseISODate = (str: string) => {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const sBaseDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), source.day);
    const tBaseDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), target.day);

    const getNewDate = (originalDateStr: string, destinationBase: Date, originBase: Date) => {
        if (!isSameStaff) return originalDateStr; // Cross-staff: Keep date (Swap Responsibility)
        
        // Same-staff: Shift date (Swap Time)
        const originalDate = parseISODate(originalDateStr);
        const diff = originalDate.getTime() - originBase.getTime();
        const newDate = new Date(destinationBase.getTime() + diff);
        return formatDateToISO(newDate);
    };

    setAssignments(prev => {
        let nextAssignments = [...prev];

        // 1. Remove Source Shifts from Source Staff
        sShiftsToMove.forEach(s => {
            nextAssignments = nextAssignments.filter(a => a.id !== s.id);
            deleteAssignmentFromDB(s.id);
        });

        // 2. Remove Target Shifts from Target Staff
        tShiftsToMove.forEach(s => {
            nextAssignments = nextAssignments.filter(a => a.id !== s.id);
            deleteAssignmentFromDB(s.id);
        });

        // 3. Add Target Shifts to Source
        tShiftsToMove.forEach(s => {
            const newStaffId = source.staffId;
            const newDate = getNewDate(s.date, sBaseDate, tBaseDate);
            
            const newId = `${newStaffId}-${newDate}-${s.shiftType}`;
            const newAssign = { ...s, id: newId, staffId: newStaffId, date: newDate };
            
            if (!nextAssignments.some(na => na.id === newId)) {
                nextAssignments.push(newAssign);
                saveAssignmentToDB(newAssign);
            }
        });

        // 4. Add Source Shifts to Target
        sShiftsToMove.forEach(s => {
             const newStaffId = target.staffId;
             const newDate = getNewDate(s.date, tBaseDate, sBaseDate);

             const newId = `${newStaffId}-${newDate}-${s.shiftType}`;
             const newAssign = { ...s, id: newId, staffId: newStaffId, date: newDate };
             
             if (!nextAssignments.some(na => na.id === newId)) {
                nextAssignments.push(newAssign);
                saveAssignmentToDB(newAssign);
             }
        });

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
    
    // Helper to remove specific shift type from a day
    const removeShiftType = (list: ShiftAssignment[], dStr: string, type: ShiftType) => {
        const toRemove = list.filter(a => a.date === dStr && a.staffId === staffId && a.shiftType === type);
        toRemove.forEach(a => deleteAssignmentFromDB(a.id));
        return list.filter(a => !(a.date === dStr && a.staffId === staffId && a.shiftType === type));
    };

    if (action === 'OFF') {
        const currentShifts = getShifts(staffId, day);
        setAssignments(prev => {
            // Remove everything on this day
            const toDelete = prev.filter(a => a.staffId === staffId && a.date === targetDateStr);
            toDelete.forEach(a => deleteAssignmentFromDB(a.id));
            let newAssignments = prev.filter(a => !(a.staffId === staffId && a.date === targetDateStr));

            // Logic to clean up Combo orphans
            currentShifts.forEach(shift => {
                 if (shift.shiftType === ShiftType.AFTERNOON) {
                    // If removing Afternoon, check for linked Night next day
                    newAssignments = removeShiftType(newAssignments, formatDateToISO(nextDate), ShiftType.NIGHT);
                 } else if (shift.shiftType === ShiftType.NIGHT) {
                    // If removing Night, check for linked Afternoon prev day
                    const prevDate = new Date(targetDate);
                    prevDate.setDate(targetDate.getDate() - 1);
                    newAssignments = removeShiftType(newAssignments, formatDateToISO(prevDate), ShiftType.AFTERNOON);
                 }
            });
            return newAssignments;
        });

    } else if (action === 'MORNING') {
        setAssignments(prev => {
            // Remove existing Morning on this day (to toggle/reset)
            let temp = removeShiftType(prev, targetDateStr, ShiftType.MORNING);
            
            // NOTE: We do NOT remove Night shifts here, allowing M and N to coexist.
            // But we DO remove Afternoon shifts (M and A usually conflict)
            temp = removeShiftType(temp, targetDateStr, ShiftType.AFTERNOON);
            
            // Clean up linked Night if we removed an Afternoon
            const hasAfternoon = prev.some(a => a.staffId === staffId && a.date === targetDateStr && a.shiftType === ShiftType.AFTERNOON);
            if (hasAfternoon) {
                 temp = removeShiftType(temp, formatDateToISO(nextDate), ShiftType.NIGHT);
            }

            return updateAssignmentsWithRule(temp, staffId, targetDate, ShiftType.MORNING);
        });
    } else if (action === 'BD_COMBO') {
        setAssignments(prev => {
            // Day 1: Afternoon
            // Remove Morning? Yes. Remove existing Afternoon? Yes. Remove Night? No (allow A+N? Unlikely but safe to clear A)
            // Sticking to standard: Clear Day 1 mostly.
            let temp = removeShiftType(prev, targetDateStr, ShiftType.MORNING);
            temp = removeShiftType(temp, targetDateStr, ShiftType.AFTERNOON);
            // temp = removeShiftType(temp, targetDateStr, ShiftType.NIGHT); // Allow Night to stay if it's from yesterday? Yes.

            // Day 2: Night
            const nextDateStr = formatDateToISO(nextDate);
            // Remove existing Night.
            temp = removeShiftType(temp, nextDateStr, ShiftType.NIGHT);
            // DO NOT remove Morning on Day 2 (Allow N+M Coexistence)

            // Add new shifts
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
          h-14 md:h-16 flex-1 min-w-[34px] md:min-w-[44px] border-r border-b border-slate-200 flex flex-col transition-all relative overflow-hidden
          ${shifts.length === 0 && isSpecial ? 'bg-rose-50/40' : ''}
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

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center font-sans overflow-hidden text-slate-700">
      <div className="w-full h-full max-w-[1920px] bg-white shadow-2xl flex flex-col relative overflow-hidden border-x border-slate-200">
        
        <header className="bg-white z-50 px-3 py-3 md:px-8 md:py-4 border-b border-slate-200 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3 md:gap-4">
               <div className="bg-cyan-700 p-2 md:p-3 rounded-2xl text-white shadow-sm shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
               </div>
               <div>
                  <h1 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight">ตารางเวรปฏิบัติงาน</h1>
                  <p className="text-xs md:text-base text-slate-500 block">โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช</p>
               </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 overflow-x-auto scrollbar-hide pb-1 md:pb-0">
               
               <div className="flex items-center gap-2">
                 {isLoggedIn ? (
                    <div className="flex items-center gap-2">
                         {isKikOrAdmin && (
                             <>
                                <button 
                                    onClick={handleResetMonth}
                                    className="flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-3 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl transition-all text-xs font-bold border border-red-200 whitespace-nowrap"
                                    title="ลบข้อมูลทั้งหมดและยกเลิกประกาศ"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                    <span className="hidden sm:inline">ล้างข้อมูล</span>
                                </button>

                                {!isPublished && (
                                    <button 
                                        onClick={handlePublish}
                                        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl transition-all text-xs font-bold border border-green-200 animate-pulse whitespace-nowrap"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                        บันทึกและประกาศ
                                    </button>
                                )}
                                
                                <button 
                                    onClick={() => setIsAdminManagerOpen(true)}
                                    className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all text-xs font-bold border border-indigo-200 whitespace-nowrap"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" x2="20" y1="8" y2="14"/><line x1="23" x2="17" y1="11" y2="11"/></svg>
                                    จัดการผู้ดูแล
                                </button>
                             </>
                         )}

                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1.5 md:px-3 rounded-xl">
                            <span className="flex h-2 w-2 relative">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPublished ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPublished ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                            </span>
                            <span className="text-xs md:text-sm font-bold truncate max-w-[60px] md:max-w-[80px]">{currentUser || 'User'}</span>
                            <div className="w-px h-4 bg-slate-200 mx-1"></div>
                            <button 
                                onClick={handleLogout}
                                className="text-xs font-semibold hover:text-red-700 underline decoration-slate-300 hover:decoration-red-300 transition-all whitespace-nowrap"
                            >
                                ออก
                            </button>
                        </div>
                    </div>
                 ) : (
                    <button 
                        onClick={() => setIsLoginModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all text-xs md:text-sm font-semibold whitespace-nowrap"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        เข้าสู่ระบบ
                    </button>
                 )}
               </div>

               <div className="h-8 md:h-10 w-px bg-slate-200 mx-1 md:mx-2 hidden md:block"></div>

               <div className="flex items-center gap-1 md:gap-2 bg-slate-50 border border-slate-200 p-1 md:p-1.5 rounded-xl md:rounded-2xl shrink-0">
                  <button 
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                      className="p-1.5 md:p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <span className="min-w-[100px] md:min-w-[140px] text-center font-bold text-sm md:text-lg text-slate-800">
                      {currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                      onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                      className="p-1.5 md:p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
               </div>
               
               {isKikOrAdmin && (
               <button 
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:shadow-sm border border-transparent hover:border-amber-200 rounded-xl transition-all font-semibold text-xs md:text-sm md:text-base shrink-0 disabled:opacity-50 whitespace-nowrap"
               >
                  {isExporting ? (
                      <svg className="animate-spin h-4 w-4 md:h-5 md:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-[18px] md:h-[18px]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  )}
                  <span className="hidden sm:inline">Export PDF</span>
               </button>
               )}

               <button 
                  onClick={() => setIsStatsOpen(true)}
                  className="flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:shadow-sm border border-transparent hover:border-indigo-200 rounded-xl transition-all font-semibold text-xs md:text-sm md:text-base shrink-0 whitespace-nowrap"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-[18px] md:h-[18px]"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                  <span className="hidden sm:inline">สรุปภาระงาน</span>
               </button>
            </div>
          </div>
        </header>

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
                  <button onClick={() => { setIsSwapMode(false); setSwapSource(null); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/20">ยกเลิก</button>
              </div>
          )}

          <div className="bg-white border-b border-slate-200 px-3 md:px-8 py-2 md:py-3 flex items-center gap-3 md:gap-6 overflow-x-auto shrink-0 z-40 custom-scrollbar scrollbar-hide">
             <div className="flex items-center mr-2 md:mr-4 gap-2">
                 <span className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide shrink-0">สถานะ:</span>
                 {isPublished ? (
                     <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 flex items-center gap-1">ประกาศแล้ว</span>
                 ) : (
                     <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">ฉบับร่าง {isKikOrAdmin ? '(Admin Mode)' : '(รอประกาศ)'}</span>
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
                          <div className="sticky left-0 top-0 z-50 w-28 min-w-[7rem] md:w-60 md:min-w-[15rem] px-2 py-3 md:px-4 md:py-4 text-left text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-r border-b border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.02)] flex items-center">
                              <span className="md:hidden">รายชื่อ</span>
                              <span className="hidden md:inline">รายชื่อเจ้าหน้าที่</span>
                          </div>
                          {daysArray.map(day => {
                              const isSpecial = isWeekendOrHoliday(day);
                              const isCurrentDay = isToday(day);

                              // Check if there are any working shifts (M, A, N) on this day across ALL staff
                              // This is for Admin/Kik to see if they missed scheduling a day
                              const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                              const dateStr = formatDateToISO(date);
                              const hasWorkingShifts = assignments.some(a => a.date === dateStr && a.shiftType !== ShiftType.OFF);
                              
                              // Show warning if user is Admin/Kik AND day has no working shifts
                              const showEmptyWarning = isKikOrAdmin && !hasWorkingShifts;

                              return (
                                  <div key={day} className={`relative flex-1 min-w-[34px] md:min-w-[44px] flex flex-col items-center justify-center border-r border-b border-slate-200 py-2 ${showEmptyWarning ? 'bg-red-50 ring-1 ring-inset ring-red-200' : (isSpecial ? 'bg-rose-50/50' : '')} ${isCurrentDay ? 'bg-emerald-50 shadow-inner' : ''}`}>
                                      <div className={`text-sm md:text-base font-bold 
                                        ${isCurrentDay ? 'bg-emerald-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm -mt-1 mb-1' : ''} 
                                        ${!isCurrentDay && showEmptyWarning ? 'text-red-600 scale-110 font-extrabold' : ''}
                                        ${!isCurrentDay && !showEmptyWarning && isSpecial ? 'text-rose-500' : ''} 
                                        ${!isCurrentDay && !showEmptyWarning && !isSpecial ? 'text-slate-700' : ''}`}>
                                        {day}
                                      </div>
                                      <span className={`text-[9px] md:text-[10px] uppercase 
                                        ${showEmptyWarning ? 'text-red-500 font-bold' : (isSpecial && !isCurrentDay ? 'text-rose-400' : 'text-slate-400')}`}>
                                        {getDayLabel(day)}
                                      </span>
                                      
                                      {showEmptyWarning && (
                                        <div className="absolute top-0 right-0 -mr-1 -mt-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping z-10" title="ยังไม่ได้จัดเวร"></div>
                                      )}
                                      {showEmptyWarning && (
                                        <div className="absolute top-0 right-0 -mr-1 -mt-1 w-2.5 h-2.5 bg-red-500 rounded-full z-10 ring-2 ring-white"></div>
                                      )}
                                  </div>
                              );
                          })}
                          <div className="w-14 min-w-[3.5rem] md:w-20 md:min-w-[5rem] px-1 md:px-2 py-2 md:py-4 text-center text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 flex items-center justify-center">รวม</div>
                      </div>

                      {STAFF_LIST.map((staff, index) => (
                          <div key={staff.id} className={`flex w-full border-b border-slate-100 hover:bg-slate-50 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                              <div className="sticky left-0 z-30 w-28 min-w-[7rem] md:w-60 md:min-w-[15rem] px-2 py-2 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 bg-white border-r border-slate-200 group-hover:bg-slate-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.02)]">
                                  <div className="relative shrink-0"><img src={staff.avatarUrl} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 object-cover ring-2 ring-white shadow-md" /></div>
                                  <div className="truncate min-w-0 flex-1">
                                      <div className="text-xs md:text-base font-bold text-slate-800 truncate">{staff.name}</div>
                                      <div className="hidden md:block text-xs text-slate-500 truncate">{staff.role}</div>
                                  </div>
                              </div>
                              {daysArray.map(day => renderCell(staff, day))}
                              <div className="w-14 min-w-[3.5rem] md:w-20 md:min-w-[5rem] px-1 md:px-2 py-2 flex items-center justify-center text-sm md:text-lg font-bold text-slate-500 group-hover:text-slate-700 bg-transparent">{getStaffTotal(staff.id)}</div>
                          </div>
                      ))}
                      
                      {isPublished && <ShiftLogList logs={history} />}
                      <div className="h-24 w-full shrink-0"></div>
              </div>
          </div>
        </main>
      </div>

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
            staffList={STAFF_LIST}
            // Use Original Snapshot if available and published, otherwise use current
            assignments={isPublished && originalAssignments.length > 0 ? originalAssignments : assignments}
            daysInMonth={daysInMonth}
            holidays={HOLIDAYS}
          />
        </div>
      </div>

      <ShiftStats isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} staffList={STAFF_LIST} assignments={assignments} currentDate={currentDate} />
      {isLoggedIn && (<ShiftEditorModal isOpen={!!selectedCell} onClose={() => setSelectedCell(null)} selectedStaff={selectedCell ? STAFF_LIST.find(s => s.id === selectedCell.staffId) || null : null} selectedDate={selectedCell ? new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedCell.day) : null} currentShiftType={selectedCell ? (getFirstShift(selectedCell.staffId, selectedCell.day)?.shiftType || ShiftType.OFF) : ShiftType.OFF} onSave={handleSaveRequest} onInitiateSwap={initiateSwapFromModal} isHoliday={selectedCell ? isWeekendOrHoliday(selectedCell.day) : false} historyLogs={history} canManageShifts={isKikOrAdmin} />)}
      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={handleConfirmSave} messages={conflictMessages} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLogin} />
      <AdminManagerModal isOpen={isAdminManagerOpen} onClose={() => setIsAdminManagerOpen(false)} />
    </div>
  );
};

export default App;