# ตารางเวรปฏิบัติงานพี่กิ๊ก (Work Shift Schedule)

ระบบจัดการตารางเวรปฏิบัติงานสำหรับศูนย์คอมพิวเตอร์ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช 
พัฒนาด้วย React, TypeScript, Vite, Tailwind CSS และ Supabase

## คุณสมบัติเด่น (Features)
- จัดการตารางเวร (เช้า, บ่าย, ดึก)
- ระบบล็อกอินและสิทธิ์การใช้งาน (Admin, User)
- บันทึกและดึงข้อมูลแบบ Real-time ด้วย Supabase
- ระบบประกาศตารางเวร (Publish) และเก็บประวัติการแลกเวร (Shift Logs)
- พิมพ์ตารางเวรเป็น PDF และ Export เป็น Excel (XLSX)
- รองรับการทำงานผ่านมือถือ (Responsive Design)

## การติดตั้งและใช้งาน (Installation & Setup)

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **ติดตั้ง Dependencies**
   ```bash
   npm install
   ```

3. **ตั้งค่า Environment Variables**
   - คัดลอกไฟล์ `.env.example` เป็น `.env`
   ```bash
   cp .env.example .env
   ```
   - แก้ไขไฟล์ `.env` โดยใส่ค่า Supabase URL และ Anon Key ของคุณ
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **ตั้งค่าฐานข้อมูล (Database Setup)**
   - นำโค้ดในไฟล์ `db_setup.sql` ไปรันใน SQL Editor ของ Supabase เพื่อสร้างตารางและข้อมูลเริ่มต้น

5. **รันโปรเจกต์ (Development)**
   ```bash
   npm run dev
   ```

6. **Build สำหรับ Production**
   ```bash
   npm run build
   ```

## โครงสร้างฐานข้อมูล (Database Structure)
- `Table-kik`: เก็บข้อมูลการเข้าเวรของแต่ละคนในแต่ละวัน
- `monthly_roster_status`: เก็บสถานะการประกาศตารางเวรของแต่ละเดือน
- `users-table-kik`: เก็บข้อมูลผู้ใช้งานและรหัสผ่าน
- `shift_logs`: เก็บประวัติการแก้ไข/แลกเวร
- `staff`: เก็บข้อมูลพนักงาน (ชื่อ, เบอร์โทรศัพท์, รูปโปรไฟล์)

## เทคโนโลยีที่ใช้ (Tech Stack)
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Backend / Database**: Supabase (PostgreSQL)
- **Export**: jsPDF, html2canvas, xlsx
