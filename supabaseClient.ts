import { createClient } from '@supabase/supabase-js';

// การตั้งค่า Supabase โปรเจกต์ใหม่
const SUPABASE_URL = 'https://okeyxsiqxuzimyfwojlu.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZXl4c2lxeHV6aW15Zndvamx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDE4OTQsImV4cCI6MjA4NTMxNzg5NH0.NVpRclwEWDkYLo_WwgYSGcTHrIAyh1JCCreIiMT5z6Y';

// กำหนด Schema เป้าหมายเป็น 'Work-Shift-Schedule'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'Work-Shift-Schedule'
  }
});