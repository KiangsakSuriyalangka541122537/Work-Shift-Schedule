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
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1); // Fixed 31 columns for table layout consistency

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
    return sum.toLocaleString();
  };

  const isWeekendOrHoliday = (day: number) => {
    if (day > daysInMonth) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDateToISO(date);
    const d = date.getDay();
    // Check specific holidays or weekends (Sunday=0, Saturday=6)
    return d === 0 || d === 6 || holidays.some(h => h === dateStr || dateStr.endsWith(h.substring(5)));
  };

  const PageLayout = ({ pageNumber }: { pageNumber: number }) => (
    <div className="print-page w-[297mm] h-[210mm] bg-white p-8 font-sans box-border relative text-black mb-10 overflow-hidden" style={{ color: '#000000' }}>
      
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="font-bold text-xl mb-1 text-gray-900">หลักฐานการขออนุมัติปฏิบัติงานนอกเวลาราชการ</h1>
        <p className="text-xs font-medium text-gray-700">
          เวรเช้า 08.00 – 16.00 น. เวรบ่าย 16.00 – 24.00 น. เวรดึก 24.00-08.00 น.
        </p>
        <p className="text-sm font-bold mt-1 text-gray-900">
          ส่วนราชการ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช ประจำเดือน {monthName} พ.ศ. {buddhistYear} งานศูนย์คอมพิวเตอร์
        </p>
      </div>

      {/* Table Container - to handle sizing */}
      <div className="w-full">
        <table className="print-table w-full">
            <thead>
                <tr className="h-10">
                    <th style={{width: '35px'}}>ลำดับ</th>
                    <th style={{width: '150px'}}>ชื่อ – สกุล</th>
                    <th colSpan={31} style={{padding: '2px'}}>วันที่ปฏิบัติงาน</th>
                    {/* Dynamic Last Column Header */}
                    <th style={{width: '100px'}}>{pageNumber === 2 ? "จำนวนเงิน" : "ลายเซ็น"}</th>
                </tr>
                <tr className="h-5">
                    <th style={{backgroundColor: '#e5e7eb'}}></th>
                    <th style={{backgroundColor: '#e5e7eb'}}></th>
                    {daysArray.map(day => (
                        <th key={day} style={{
                            width: '21px', // Adjusted to fit 31 days + other cols in A4
                            backgroundColor: isWeekendOrHoliday(day) ? '#d1d5db' : '#f3f4f6', 
                            color: '#000000',
                            fontWeight: 'bold',
                            fontSize: '10px'
                        }}>
                        {day}
                        </th>
                    ))}
                    <th style={{backgroundColor: '#e5e7eb'}}></th>
                </tr>
            </thead>
            <tbody>
                {staffList.map((staff, index) => (
                <tr key={staff.id}>
                    <td>{index + 1}</td>
                    <td style={{textAlign: 'left', paddingLeft: '5px', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden'}}>{staff.name}</td>
                    {daysArray.map(day => (
                    <td key={day} style={{
                        fontWeight: 'bold', 
                        backgroundColor: isWeekendOrHoliday(day) ? '#e5e7eb' : 'transparent',
                        color: '#000000',
                        fontSize: '11px'
                    }}>
                        {getShiftCode(staff.id, day)}
                    </td>
                    ))}
                    {/* Dynamic Last Column Content */}
                    <td style={{fontWeight: 'bold', fontSize: '11px'}}>
                        {pageNumber === 2 ? calculateAmount(staff.id) : ""}
                    </td>
                </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-2 text-[10px] font-bold text-gray-700">
        หมายเหตุ : เวรบ่ายและดึก รวมกัน 750 บาท
      </div>
    </div>
  );

  return (
    <div>
      <style>{`
        .print-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000000; /* Strict black border for printing */
          color: #000000;
          table-layout: fixed; /* Ensures columns respect widths */
        }
        .print-table th, .print-table td {
          border: 1px solid #000000;
          padding: 2px;
          text-align: center;
          vertical-align: middle;
          height: 24px; 
          line-height: 1;
        }
        .print-table th {
          background-color: #f3f4f6; /* Gray-100 */
          font-weight: bold;
          font-size: 11px;
        }
      `}</style>
      
      {/* Render Page 1 (Signatures) */}
      <PageLayout pageNumber={1} />
      
      {/* Render Page 2 (Amounts) */}
      <PageLayout pageNumber={2} />
    </div>
  );
};