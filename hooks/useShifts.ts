import { useState, useEffect, useCallback } from 'react';
import { ShiftAssignment, ShiftHistory, Staff, ShiftType, formatDateToISO } from '../types';
import { getShifts, getStatus, getLogs, getStaff, insertLog, deleteShift, insertShift, deleteStatus, deleteLogs, updateStatus } from '../services/api';
import { STAFF_LIST } from '../constants';

export const useShifts = (currentDate: Date) => {
  const [staffList, setStaffList] = useState<Staff[]>(STAFF_LIST);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [originalAssignments, setOriginalAssignments] = useState<ShiftAssignment[]>([]);
  const [history, setHistory] = useState<ShiftHistory[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const monthKey = getMonthKey(currentDate);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const startObj = new Date(year, month - 1, 1);
      const startStr = formatDateToISO(startObj);
      const endObj = new Date(year, month + 2, 0);
      const endStr = formatDateToISO(endObj);

      // Fetch assignments
      const shiftData = await getShifts(startStr, endStr);
      setAssignments(shiftData);

      // Fetch status
      const statusData = await getStatus(monthKey);
      setIsPublished(statusData?.is_published || false);
      setOriginalAssignments(statusData?.original_assignments ? JSON.parse(statusData.original_assignments) : []);

      // Fetch logs
      const logData = await getLogs(monthKey);
      setHistory(logData);

      // Fetch staff
      const staffData = await getStaff();
      if (staffData && staffData.length > 0) {
        setStaffList(staffData.map((item: any) => ({
          id: item.id,
          name: item.name,
          role: item.phone || item.role,
          avatarUrl: item.avatar_url || item.avatarUrl
        })));
      }
    } catch (err) {
      console.error('Connection error:', err);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addHistoryLog = async (targetDate: string, message: string, actionType: ShiftHistory['actionType']) => {
    if (!isPublished) return;
    const monthKey = getMonthKey(currentDate);
    try {
      await insertLog({
        month_key: monthKey,
        target_date: targetDate,
        message,
        action_type: actionType
      });
      const logData = await getLogs(monthKey);
      setHistory(logData);
    } catch (error) {
      console.error('Error adding log:', error);
    }
  };

  const deleteAssignmentFromDB = async (id: string) => {
    try {
      await deleteShift(id);
    } catch (error) {
      console.error('Error deleting shift:', error);
    }
  };

  const insertAssignmentToDB = async (assignment: ShiftAssignment) => {
    try {
      await insertShift(assignment);
    } catch (error) {
      console.error('Error inserting shift:', error);
    }
  };

  const handleResetMonth = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลตารางเวรทั้งหมดของเดือนนี้? (การกระทำนี้ไม่สามารถย้อนกลับได้)')) return;
    try {
      const monthKey = getMonthKey(currentDate);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${month}-`;

      const shiftsToDelete = assignments.filter(a => a.date.startsWith(prefix));
      for (const shift of shiftsToDelete) {
        await deleteShift(shift.id);
      }

      await deleteStatus(monthKey);
      await deleteLogs(monthKey);

      setAssignments(prev => prev.filter(a => !a.date.startsWith(prefix)));
      setIsPublished(false);
      setOriginalAssignments([]);
      setHistory([]);
      alert('ลบข้อมูลและยกเลิกประกาศเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error resetting month:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const handlePublish = async (currentUsername: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะประกาศตารางเวรนี้? เมื่อประกาศแล้วทุกคนจะสามารถเห็นตารางเวรได้')) return;
    try {
      const monthKey = getMonthKey(currentDate);
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${month}-`;
      const currentMonthAssignments = assignments.filter(a => a.date.startsWith(prefix));

      await updateStatus({
        month_key: monthKey,
        is_published: true,
        published_by: currentUsername,
        original_assignments: currentMonthAssignments
      });

      setIsPublished(true);
      setOriginalAssignments(currentMonthAssignments);
      alert('ประกาศตารางเวรเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error publishing roster:', error);
      alert('เกิดข้อผิดพลาดในการประกาศตารางเวร');
    }
  };

  return {
    staffList,
    assignments,
    setAssignments,
    originalAssignments,
    setOriginalAssignments,
    history,
    setHistory,
    isPublished,
    setIsPublished,
    fetchData,
    addHistoryLog,
    deleteAssignmentFromDB,
    insertAssignmentToDB,
    handleResetMonth,
    handlePublish,
    getMonthKey
  };
};
