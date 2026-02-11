import { createClient } from '@supabase/supabase-js';

// การตั้งค่า Supabase จากข้อมูลที่ได้รับ
const SUPABASE_URL = 'https://jszyfpoahcnrzqmstiqo.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzenlmcG9haGNucnpxbXN0aXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjQ0ODYsImV4cCI6MjA4NjM0MDQ4Nn0.gHPgggsT-FydPas_2q1sYLkL2QYMaAHDdoOjFphXxvA';

// กำหนด Schema เป้าหมายเป็น 'Work-Shift-Schedule'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'Work-Shift-Schedule'
  }
});