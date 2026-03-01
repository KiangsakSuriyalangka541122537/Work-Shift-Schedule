import { createClient } from '@supabase/supabase-js';

// การตั้งค่า Supabase โปรเจกต์ใหม่
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''; 
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ใช้ Schema 'public' (ค่าเริ่มต้น) เพื่อแก้ปัญหา Invalid schema: Work-Shift-Schedule
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);