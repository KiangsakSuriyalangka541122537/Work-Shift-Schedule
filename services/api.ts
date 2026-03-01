import { ShiftAssignment, ShiftHistory, Staff } from '../types';

const API_BASE = '/api';


  // --- Staff ---
export const getStaff = async (): Promise<Staff[]> => {
  const res = await fetch(`${API_BASE}/staff`);
  if (!res.ok) throw new Error('Failed to fetch staff');
  return res.json();
};

  // --- Shifts ---
export const getShifts = async (startStr: string, endStr: string): Promise<ShiftAssignment[]> => {
  const res = await fetch(`${API_BASE}/shifts?startStr=${startStr}&endStr=${endStr}`);
  if (!res.ok) throw new Error('Failed to fetch shifts');
  const data = await res.json();
  return data.map((item: any) => ({
    id: item.id,
    staffId: item.staff_id,
    date: item.date,
    shiftType: item.shift_type
  }));
};
export const insertShift = async (shift: any) => {
  const res = await fetch(`${API_BASE}/shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: shift.id,
      staff_id: shift.staffId,
      date: shift.date,
      shift_type: shift.shiftType
    })
  });
  if (!res.ok) throw new Error('Failed to insert shift');
  return res.json();
};
export const deleteShift = async (id: string) => {
  const res = await fetch(`${API_BASE}/shifts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete shift');
  return res.json();
};

  // --- Status ---
export const getStatus = async (monthKey: string) => {
  const res = await fetch(`${API_BASE}/status/${monthKey}`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
};
export const updateStatus = async (data: any) => {
  const res = await fetch(`${API_BASE}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
};
export const deleteStatus = async (monthKey: string) => {
  const res = await fetch(`${API_BASE}/status/${monthKey}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete status');
  return res.json();
};

  // --- Logs ---
export const getLogs = async (monthKey: string): Promise<ShiftHistory[]> => {
  const res = await fetch(`${API_BASE}/logs/${monthKey}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  const data = await res.json();
  return data.map((item: any) => ({
    id: String(item.id),
    timestamp: new Date(item.created_at),
    targetDate: item.target_date,
    message: item.message,
    actionType: item.action_type
  }));
};
export const insertLog = async (data: any) => {
  const res = await fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to insert log');
  return res.json();
};
export const deleteLogs = async (monthKey: string) => {
  const res = await fetch(`${API_BASE}/logs/${monthKey}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete logs');
  return res.json();
};

  // --- Users ---
export const getUsers = async () => {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
};
export const addUser = async (data: any) => {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create user');
  }
  return res.json();
};
export const updateUser = async (id: number, data: any) => {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
};
export const deleteUser = async (id: number) => {
  const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
};
