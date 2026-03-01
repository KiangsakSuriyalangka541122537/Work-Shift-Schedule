export enum ShiftType {
  MORNING = 'M', // เช้า (ช)
  AFTERNOON = 'A', // บ่าย (บ)
  NIGHT = 'N', // ดึก (ด)
  OFF = 'O' // หยุด
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
}

export interface ShiftAssignment {
  id: string;
  staffId: string;
  date: string; // ISO Date String YYYY-MM-DD
  shiftType: ShiftType;
}

export interface CellCoordinate {
  staffId: string;
  day: number; // 1-31
}

export interface ShiftHistory {
  id: string;
  timestamp: Date;
  targetDate: string; // ISO Date related to the change
  message: string;
  actionType: 'ADD' | 'CHANGE' | 'REMOVE' | 'SWAP';
}

export const SHIFT_CONFIG = {
  [ShiftType.MORNING]: {
    code: 'ช',
    label: 'เวรเช้า',
    time: '08.00 - 16.00 น.',
    colorBg: 'bg-sky-100', // Soft Sky Blue
    colorText: 'text-sky-700', // Deep Sky Blue
    borderColor: 'border-sky-200'
  },
  [ShiftType.AFTERNOON]: {
    code: 'บ',
    label: 'เวรบ่าย',
    time: '16.00 - 24.00 น.',
    colorBg: 'bg-orange-100', // Soft Apricot
    colorText: 'text-orange-700', // Deep Orange
    borderColor: 'border-orange-200'
  },
  [ShiftType.NIGHT]: {
    code: 'ด',
    label: 'เวรดึก',
    time: '24.00 - 08.00 น.',
    colorBg: 'bg-indigo-100', // Soft Lavender/Indigo
    colorText: 'text-indigo-700', // Deep Indigo
    borderColor: 'border-indigo-200'
  },
  [ShiftType.OFF]: {
    code: '',
    label: 'หยุด',
    time: '-',
    colorBg: 'bg-white',
    colorText: 'text-slate-300',
    borderColor: 'border-slate-100'
  }
};

// Helper to ensure consistent Local Date String (YYYY-MM-DD) without Timezone shifts
export const formatDateToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};