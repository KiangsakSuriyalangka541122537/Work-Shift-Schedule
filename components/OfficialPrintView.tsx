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
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);

  // Helper to get Thai Shift Code
  const getShiftCode = (staffId: string, day: number) => {
    if (day > daysInMonth) return ""; // Over month length
    
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

  // Helper: Calculate Money for Page 2
  const calculateAmount = (staffId: string) => {
    let sum = 0;
    for(let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
        const dateStr = formatDateToISO(dateObj);
        const shift = assignments.find(a => a.staffId === staffId && a.date === dateStr);
        
        if (shift) {
            // Logic: Morning=750, Afternoon=375, Night=375
            if (shift.shiftType === ShiftType.MORNING) sum += 750;
            else if (shift.shiftType === ShiftType.AFTERNOON) sum += 375;
            else if (shift.shiftType === ShiftType.NIGHT) sum += 375;
        }
    }
    // Return empty string if 0 to keep table clean, or "0" if preferred
    return sum === 0 ? "" : sum.toLocaleString();
  };

  const isWeekendOrHoliday = (day: number) => {
    if (day > daysInMonth) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(date);
    const d = date.getDay();
    // Sunday=0, Saturday=6
    return d === 0 || d === 6 || holidays.some(h => h === dateStr || dateStr.endsWith(h.substring(5)));
  };

  // Sub-component for a single page to ensure consistency
  const PageSheet = ({ pageType }: { pageType: 'signature' | 'money' }) => (
    <div className="print-page w-[297mm] h-[210mm] bg-white px-8 py-6 font-sans box-border relative text-black mb-8 overflow-hidden flex flex-col items-center">
      
      {/* Header */}
      <div className="text-center w-full mb-4">
        <h1 className="font-bold text-xl text-black">หลักฐานการขออนุมัติปฏิบัติงานนอกเวลาราชการ</h1>
        <p className="text-xs font-medium text-black mt-1">
          เวรเช้า 08.00 – 16.00 น. เวรบ่าย 16.00 – 24.00 น. เวรดึก 24.00-08.00 น.
        </p>
        <p className="text-sm font-bold mt-2 text-black">
          ส่วนราชการ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช ประจำเดือน {monthName} พ.ศ. {buddhistYear} งานศูนย์คอมพิวเตอร์
        </p>
      </div>

      {/* Table */}
      <div className="w-full flex-1">
        <table className="print-table w-full border-collapse border border-black text-[10px] table-fixed">
            <thead>
                <tr className="h-10 bg-gray-100">
                    <th className="border border-black w-8">ลำดับ<br/>ที่</th>
                    <th className="border border-black w-40">ชื่อ – สกุล</th>
                    <th colSpan={31} className="border border-black p-0">
                        <div className="w-full h-full flex items-center justify-center border-b border-black">วันที่ปฏิบัติงาน</div>
                        <div className="flex w-full h-full">
                           {daysArray.map(day => (
                               <div key={day} className={`flex-1 border-r border-black last:border-r-0 h-5 flex items-center justify-center ${isWeekendOrHoliday(day) ? 'bg-gray-300' : ''}`}>
                                   {day}
                               </div>
                           ))}
                        </div>
                    </th>
                    <th className="border border-black w-24">
                        {pageType === 'signature' ? "ลายเซ็น" : "จำนวนเงิน"}
                    </th>
                </tr>
            </thead>
            <tbody>
                {staffList.map((staff, index) => (
                <tr key={staff.id} className="h-7">
                    <td className="border border-black text-center">{index + 1}</td>
                    <td className="border border-black px-2 text-left font-bold whitespace-nowrap overflow-hidden">{staff.name}</td>
                    
                    {/* Date Columns */}
                    {daysArray.map(day => (
                        <td key={day} className={`border border-black text-center p-0 font-bold ${isWeekendOrHoliday(day) ? 'bg-gray-200' : ''}`}>
                             <div className="w-full h-full flex items-center justify-center">
                                {getShiftCode(staff.id, day)}
                             </div>
                        </td>
                    ))}

                    {/* Last Column */}
                    <td className="border border-black text-center font-bold">
                         {pageType === 'money' ? calculateAmount(staff.id) : ""}
                    </td>
                </tr>
                ))}
                
                {/* Empty rows filler if list is short (Optional for aesthetics) */}
                {Array.from({ length: Math.max(0, 15 - staffList.length) }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="h-7">
                        <td className="border border-black"></td>
                        <td className="border border-black"></td>
                        {daysArray.map(d => <td key={d} className={`border border-black ${isWeekendOrHoliday(d) ? 'bg-gray-200' : ''}`}></td>)}
                        <td className="border border-black"></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="w-full mt-2 text-left">
        <p className="text-[10px] font-bold text-black">
          หมายเหตุ : เวรบ่ายและดึก รวมกัน 750 บาท
        </p>
      </div>

    </div>
  );

  return (
    <div style={{ color: 'black', fontFamily: 'Sarabun, sans-serif' }}>
       {/* Page 1: Signatures */}
       <PageSheet pageType="signature" />
       
       {/* Page 2: Money */}
       <PageSheet pageType="money" />
    </div>
  );
};