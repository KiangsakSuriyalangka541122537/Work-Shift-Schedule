import React from 'react';
import { Staff, ShiftAssignment, ShiftType, formatDateToISO } from '../types';

interface OfficialPrintViewProps {
  currentDate: Date;
  staffList: Staff[];
  assignments: ShiftAssignment[];
  daysInMonth: number;
  holidays: string[];
}

export const OfficialPrintView: React.FC<OfficialPrintViewProps> = ({
  currentDate,
  staffList,
  assignments,
  daysInMonth,
  holidays
}) => {
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const monthName = thaiMonths[currentDate.getMonth()];
  const buddhistYear = currentDate.getFullYear() + 543;
  
  // Dynamic days array based on daysInMonth (instead of fixed 31)
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getShiftCode = (staffId: string, day: number) => {
    // Hide data if day exceeds actual month length (e.g. Feb 30)
    if (day > daysInMonth) return ""; 
    
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(dateObj);
    
    const shift = assignments.find(a => a.staffId === staffId && a.date === dateStr);
    
    if (!shift) return "";
    switch (shift.shiftType) {
        case ShiftType.MORNING: return "ช";
        case ShiftType.AFTERNOON: return "บ";
        case ShiftType.NIGHT: return "ด";
        default: return "";
    }
  };

  // Helper to check for Outgoing Cross-Month Combo (Afternoon on Last Day + Night on Next Month 1st Day)
  const isOutgoingCrossMonthCombo = (staffId: string) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Last day of CURRENT month
    const lastDayObj = new Date(year, month + 1, 0); 
    const lastDayStr = formatDateToISO(lastDayObj);

    // First day of NEXT month
    const nextMonthFirstObj = new Date(year, month + 1, 1);
    const nextMonthFirstStr = formatDateToISO(nextMonthFirstObj);

    const hasAfternoonLastDay = assignments.some(a =>
        a.staffId === staffId &&
        a.date === lastDayStr &&
        a.shiftType === ShiftType.AFTERNOON
    );

    const hasNightNextDay = assignments.some(a =>
        a.staffId === staffId &&
        a.date === nextMonthFirstStr &&
        a.shiftType === ShiftType.NIGHT
    );

    return hasAfternoonLastDay && hasNightNextDay;
  };

  // Helper to check for Incoming Cross-Month Combo (Night on 1st Day + Afternoon on Prev Month Last Day)
  const isIncomingCrossMonthCombo = (staffId: string) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Last day of PREV month
    const prevMonthLastDayObj = new Date(year, month, 0); 
    const prevMonthLastDayStr = formatDateToISO(prevMonthLastDayObj);

    // First day of CURRENT month
    const currentMonthFirstObj = new Date(year, month, 1);
    const currentMonthFirstStr = formatDateToISO(currentMonthFirstObj);

    const hasAfternoonPrevLastDay = assignments.some(a =>
        a.staffId === staffId &&
        a.date === prevMonthLastDayStr &&
        a.shiftType === ShiftType.AFTERNOON
    );

    const hasNightFirstDay = assignments.some(a =>
        a.staffId === staffId &&
        a.date === currentMonthFirstStr &&
        a.shiftType === ShiftType.NIGHT
    );

    return hasAfternoonPrevLastDay && hasNightFirstDay;
  };

  const calculateAmount = (staffId: string) => {
    let sum = 0;
    // Iterate only through valid days of the month to calculate sum
    for(let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
        const dateStr = formatDateToISO(dateObj);
        const shift = assignments.find(a => a.staffId === staffId && a.date === dateStr);
        
        if (shift) {
            // Logic: 
            // Morning = 750
            // Afternoon = 375
            // Night = 375
            // (So Afternoon + Night = 750)
            if (shift.shiftType === ShiftType.MORNING) sum += 750;
            else if (shift.shiftType === ShiftType.AFTERNOON) sum += 375;
            else if (shift.shiftType === ShiftType.NIGHT) sum += 375;
        }
    }

    // Outgoing Combo: Add 375 (Night money) to THIS month
    if (isOutgoingCrossMonthCombo(staffId)) {
        sum += 375;
    }

    // Incoming Combo: Subtract 375 (Night money) from THIS month (counts as 0)
    if (isIncomingCrossMonthCombo(staffId)) {
        sum -= 375;
    }

    return sum.toLocaleString();
  };

  const calculateShiftCount = (staffId: string) => {
    let count = 0;
    for(let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
        const dateStr = formatDateToISO(dateObj);
        const shift = assignments.find(a => a.staffId === staffId && a.date === dateStr);
        
        if (shift) {
            // Logic:
            // Morning = 1 shift
            // Afternoon + Night = 1 shift (So 0.5 each)
            if (shift.shiftType === ShiftType.MORNING) count += 1;
            else if (shift.shiftType === ShiftType.AFTERNOON) count += 0.5;
            else if (shift.shiftType === ShiftType.NIGHT) count += 0.5;
        }
    }

    // Outgoing Combo: Add 0.5 (Night shift of next month) to THIS month
    if (isOutgoingCrossMonthCombo(staffId)) {
        count += 0.5;
    }

    // Incoming Combo: Subtract 0.5 (Night shift of this month) because it counts as 0
    if (isIncomingCrossMonthCombo(staffId)) {
        count -= 0.5;
    }

    // Format: remove decimals if whole number
    return count % 1 === 0 ? count.toString() : count.toFixed(1);
  };

  const isWeekendOrHoliday = (day: number) => {
    if (day > daysInMonth) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(date);
    const d = date.getDay();
    // Check specific holidays or weekends (Sunday=0, Saturday=6)
    // Fix: Strictly match dates to avoid cross-year holiday bugs
    return d === 0 || d === 6 || holidays.includes(dateStr);
  };

  const numberToThaiText = (number: number): string => {
    if (number === 0) return "ศูนย์บาทถ้วน";
    const numbers = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    
    let numStr = Math.floor(number).toString();
    let text = "";
    
    for (let i = 0; i < numStr.length; i++) {
        let digit = parseInt(numStr.charAt(i));
        let pos = numStr.length - 1 - i;
        
        if (digit !== 0) {
            if (pos === 1 && digit === 1) {
                // 10 -> สิบ
            } else if (pos === 1 && digit === 2) {
                text += "ยี่";
            } else if (pos === 0 && digit === 1 && numStr.length > 1 && parseInt(numStr.charAt(numStr.length - 2)) !== 0) {
                text += "เอ็ด";
            } else {
                text += numbers[digit];
            }
            text += positions[pos];
        }
    }
    
    return text + "บาทถ้วน";
  };

  const PageLayout = ({ pageNumber }: { pageNumber: number }) => (
    <div className="print-page w-[297mm] h-[210mm] bg-white px-8 pt-16 pb-8 font-sans box-border relative text-slate-800">
      
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl mb-2 text-slate-900 leading-tight">หลักฐานการขออนุมัติปฏิบัติงานนอกเวลาราชการ</h1>
        <p className="text-sm font-medium text-slate-600 mb-2">
          เวรเช้า 08.00 – 16.00 น. &nbsp;|&nbsp; เวรบ่าย 16.00 – 24.00 น. &nbsp;|&nbsp; เวรดึก 24.00 – 08.00 น.
        </p>
        <p className="text-base font-bold text-slate-800">
          ส่วนราชการ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช ประจำเดือน <span className="text-indigo-900">{monthName}</span> พ.ศ. {buddhistYear} กลุ่มงานเทคโนโลยีสารสนเทศ และ กลุ่มงานสุขภาพดิจิทัล
        </p>
      </div>

      {/* Table Container */}
      <div className="w-full">
        <table className="print-table w-full">
            <thead>
                <tr className="h-10">
                    <th style={{width: '35px'}}>ลำดับ</th>
                    <th style={{width: '150px'}}>ชื่อ – สกุล</th>
                    <th colSpan={daysInMonth} style={{padding: '2px'}}>วันที่ปฏิบัติงาน</th>
                    <th style={{width: '60px'}}>จำนวนเวร</th>
                    {/* Dynamic Last Column Header */}
                    <th style={{width: '90px'}}>{pageNumber === 3 ? "จำนวนเงิน" : "ลายเซ็น"}</th>
                </tr>
                <tr className="h-6">
                    <th className="bg-slate-50 border-t-0"></th>
                    <th className="bg-slate-50 border-t-0"></th>
                    {daysArray.map(day => (
                        <th key={day} style={{
                            width: '23px', 
                            backgroundColor: isWeekendOrHoliday(day) ? '#CBD5E1' : '#ffffff', // Slate 300 for holiday header
                            color: isWeekendOrHoliday(day) ? '#374151' : '#334155',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            borderBottom: '1px solid #cbd5e1'
                        }}>
                        {day}
                        </th>
                    ))}
                    <th className="bg-slate-50 border-t-0"></th>
                    <th className="bg-slate-50 border-t-0"></th>
                </tr>
            </thead>
            <tbody>
                {staffList.map((staff, index) => (
                <tr key={staff.id}>
                    <td className="text-slate-600 font-medium">{index + 1}</td>
                    <td style={{textAlign: 'left', paddingLeft: '8px', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden'}} className="text-slate-800">
                        {staff.name}
                    </td>
                    {daysArray.map(day => (
                    <td key={day} style={{
                        fontWeight: 'bold', 
                        backgroundColor: isWeekendOrHoliday(day) ? '#E2E8F0' : 'transparent', // Slate 200 for holiday cells
                        color: '#1e293b',
                        fontSize: '12px'
                    }}>
                        {getShiftCode(staff.id, day)}
                    </td>
                    ))}
                    {/* Shift Count Column */}
                    <td style={{fontWeight: 'bold', fontSize: '12px', color: '#1e293b'}}>
                        {calculateShiftCount(staff.id)}
                    </td>
                    {/* Dynamic Last Column Content */}
                    <td style={{fontWeight: 'bold', fontSize: '12px', color: '#1e293b'}}>
                        {pageNumber === 3 ? calculateAmount(staff.id) : ""}
                    </td>
                </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-end items-end text-slate-500 text-xs">
         <div className="mt-1">หน้า {pageNumber} / 3</div>
      </div>
    </div>
  );

  const SummaryPageLayout = () => {
    const totalAmount = staffList.reduce((sum, staff) => {
      return sum + parseInt(calculateAmount(staff.id).replace(/,/g, ''));
    }, 0);

    return (
    <div className="print-page w-[297mm] h-[210mm] bg-white px-8 pt-10 pb-8 font-sans box-border relative text-slate-800">
      
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="font-bold text-2xl mb-2 text-slate-900 leading-tight">หลักฐานการขออนุมัติปฏิบัติงานนอกเวลาราชการ</h1>
        <p className="text-sm font-medium text-slate-600 mb-2">
          เวรเช้า 08.00 – 16.00 น. &nbsp;|&nbsp; เวรบ่าย 16.00 – 24.00 น. &nbsp;|&nbsp; เวรดึก 24.00 – 08.00 น.
        </p>
        <p className="text-base font-bold text-slate-800">
          ส่วนราชการ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช ประจำเดือน <span className="text-indigo-900">{monthName}</span> พ.ศ. {buddhistYear} กลุ่มงานเทคโนโลยีสารสนเทศ และ กลุ่มงานสุขภาพดิจิทัล
        </p>
      </div>

      {/* Table Container */}
      <div className="w-full">
        <table className="print-table w-full">
            <thead>
                <tr className="h-10">
                    <th rowSpan={2} style={{width: '30px'}}>ลำดับ<br/>ที่</th>
                    <th rowSpan={2} style={{width: '120px'}}>ชื่อ – สกุล</th>
                    <th rowSpan={2} style={{width: '100px'}}>ตำแหน่ง</th>
                    <th rowSpan={2} style={{width: '50px'}}>อัตราเงิน<br/>ตอบแทน</th>
                    <th colSpan={daysInMonth} style={{padding: '2px'}}>วันที่ขึ้นปฏิบัติงาน</th>
                    <th rowSpan={2} style={{width: '40px'}}>จำนวน<br/>เวร</th>
                    <th rowSpan={2} style={{width: '60px'}}>จำนวนเงิน</th>
                </tr>
                <tr className="h-6">
                    {daysArray.map(day => (
                        <th key={day} style={{
                            width: '18px', 
                            backgroundColor: isWeekendOrHoliday(day) ? '#CBD5E1' : '#ffffff',
                            color: isWeekendOrHoliday(day) ? '#374151' : '#334155',
                            fontWeight: 'bold',
                            fontSize: '10px',
                            borderBottom: '1px solid #cbd5e1'
                        }}>
                        {day}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {staffList.map((staff, index) => (
                <tr key={staff.id}>
                    <td className="text-slate-600 font-medium">{index + 1}</td>
                    <td style={{textAlign: 'left', paddingLeft: '4px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden'}} className="text-slate-800">
                        {staff.name}
                    </td>
                    <td style={{textAlign: 'left', paddingLeft: '4px', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden'}} className="text-slate-800">
                        {staff.role}
                    </td>
                    <td style={{fontSize: '11px'}} className="text-slate-800">
                        750
                    </td>
                    {daysArray.map(day => (
                    <td key={day} style={{
                        fontWeight: 'bold', 
                        backgroundColor: isWeekendOrHoliday(day) ? '#E2E8F0' : 'transparent',
                        color: '#1e293b',
                        fontSize: '10px'
                    }}>
                        {getShiftCode(staff.id, day)}
                    </td>
                    ))}
                    <td style={{fontWeight: 'bold', fontSize: '11px', color: '#1e293b'}}>
                        {calculateShiftCount(staff.id)}
                    </td>
                    <td style={{fontWeight: 'bold', fontSize: '11px', color: '#1e293b'}}>
                        {calculateAmount(staff.id)}
                    </td>
                </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 flex justify-between items-end text-slate-800 text-sm font-bold">
         <div>หมายเหตุ : เวรบ่ายและดึก รวมกัน 750 บาท</div>
         <div className="flex gap-4">
            <span>รวมการจ่ายเงินทั้งสิ้น (ตัวอักษร)</span>
            <span>( {numberToThaiText(totalAmount)} )</span>
         </div>
      </div>

      {/* Signatures */}
      <div className="mt-8 flex justify-between px-10">
        <div className="text-center text-sm">
            <p className="mb-8">เรียนผู้อำนวยการโรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช</p>
            <p className="mb-2">ลงชื่อ.......................................................</p>
            <p>(นายกิตติพงษ์ ชัยศรี)</p>
            <p>นักวิชาการคอมพิวเตอร์ชำนาญการ</p>
        </div>
        <div className="text-center text-sm">
            <p className="mb-8">เรียนผู้อำนวยการโรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช</p>
            <p className="mb-2">ลงชื่อ.......................................................</p>
            <p>(นายสมิทธ์ เกิดสินธุ์)</p>
            <p>นายแพทย์เชี่ยวชาญ</p>
            <p>หัวหน้ากลุ่มภารกิจสุขภาพดิจิทัล</p>
        </div>
        <div className="text-center text-sm">
            <p className="mb-8">คำสั่งผู้อำนวยการ</p>
            <p className="mb-2">ลงชื่อ.......................................................</p>
            <p>(นายสมิทธ์ เกิดสินธุ์)</p>
            <p>นายแพทย์เชี่ยวชาญ</p>
        </div>
      </div>

      <div className="absolute bottom-4 right-8 text-slate-500 text-xs">
         หน้า 1 / 3
      </div>
    </div>
  )};

  return (
    <div>
      <style>{`
        .print-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #94a3b8; /* Outer frame slightly darker (Slate 400) */
          color: #1e293b;
          table-layout: fixed;
        }
        .print-table th, .print-table td {
          border: 1px solid #cbd5e1; /* Slate 300 - Thinner/Lighter inner grid */
          padding: 3px 1px;
          text-align: center;
          vertical-align: middle;
          height: 32px;
          line-height: 1.2;
        }
        .print-table th {
          background-color: #f8fafc; /* Very light slate header */
          font-weight: bold;
          font-size: 12px;
          color: #334155;
        }
        .print-table tr {
           page-break-inside: avoid;
        }
      `}</style>
      
      {/* Render Page 1 (Summary) */}
      <SummaryPageLayout />
      
      <div className="h-4 bg-gray-200 w-full print:hidden"></div>

      {/* Render Page 2 (Signatures) */}
      <PageLayout pageNumber={2} />
      
      {/* Spacer for on-screen view separation, hidden in print usually if processed page by page */}
      <div className="h-4 bg-gray-200 w-full print:hidden"></div>

      {/* Render Page 3 (Amounts) */}
      <PageLayout pageNumber={3} />
    </div>
  );
};