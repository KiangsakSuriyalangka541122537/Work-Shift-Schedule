import { createClient } from '@supabase/supabase-js';

// หมายเหตุ: ในการใช้งานจริง ควรเก็บค่าเหล่านี้ไว้ใน .env file
// กรุณาใส่ URL และ Key ของ Supabase ของคุณที่นี่
// เราใส่ค่า Default เป็น URL ที่ถูกต้องตามรูปแบบเพื่อป้องกันแอพ Error หากยังไม่ได้ตั้งค่า
const SUPABASE_URL = 'https://your-project.supabase.co'; 
const SUPABASE_ANON_KEY = 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);