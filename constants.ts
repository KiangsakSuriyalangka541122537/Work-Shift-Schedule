import { Staff, ShiftAssignment, ShiftType } from './types';

// Helper to generate consistent person-like avatars
const getAvatar = (name: string) => `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

export const STAFF_LIST: Staff[] = [
  { id: '1', name: 'พี่ต่อ', role: '081-234-5678', avatarUrl: getAvatar('พี่ต่อ') },
  { id: '2', name: 'พี่กิ๊ก', role: '089-876-5432', avatarUrl: getAvatar('พี่กิ๊ก') },
  { id: '3', name: 'พี่จิ๋ม', role: '090-112-2334', avatarUrl: getAvatar('พี่จิ๋ม') },
  { id: '4', name: 'น้องปาน', role: '086-555-4444', avatarUrl: getAvatar('น้องปาน') },
  { id: '5', name: 'พี่ท๊อป', role: '092-333-2222', avatarUrl: getAvatar('พี่ท๊อป') },
  { id: '6', name: 'พี่ทีม', role: '084-777-8888', avatarUrl: getAvatar('พี่ทีม') },
];

export const HOLIDAYS = [
  '2024-01-01', '2024-04-13', '2024-04-14', '2024-04-15',
  '2024-05-01', '2024-05-04', 
  '2024-06-03',
  '2024-07-20', '2024-07-28',
  '2024-08-12',
  '2024-10-13', '2024-10-23',
  '2024-12-05', '2024-12-10', '2024-12-31'
];