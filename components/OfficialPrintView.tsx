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
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1); // Fixed 31 columns

  const getShiftCode = (staffId: string, day: number) => {
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
    // Iterate only through valid days of the month
    for(let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
        const dateStr = formatDateToISO(dateObj);
        const shift = assignments.find(a => a.staffId === staffId && a.date === dateStr);
        
        if (shift) {
            // Logic: Morning = 750, Afternoon-Night = 750 (so 375 each)
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
    // Check specific holidays or weekends
    return d === 0 || d === 6 || holidays.some(h => h === dateStr || dateStr.endsWith(h.substring(5)));
  };

  const PageLayout = ({ pageNumber }: { pageNumber: number }) => (
    <div className="print-page w-[297mm] h-[210mm] bg-white p-10 font-sans box-border relative text-black mb-10" style={{ color: '#000000' }}>
      
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-bold text-2xl mb-3 text-gray-900">หลักฐานการขออนุมัติปฏิบัติงานนอกเวลาราชการ</h1>
        <p className="text-sm font-medium mt-1 text-gray-700">
          เวรเช้า 08.00 – 16.00 น. เวรบ่าย 16.00 – 24.00 น. เวรดึก 24.00-08.00 น.
        </p>
        <p className="text-base font-bold mt-2 text-gray-900">
          ส่วนราชการ โรงพยาบาลสมเด็จพระเจ้าตากสินมหาราช ประจำเดือน {monthName} พ.ศ. {buddhistYear} งานศูนย์คอมพิวเตอร์
        </p>
      </div>

      {/* Table */}
      <table className="print-table print-text-sm">
          <thead>
            <tr className="h-14">
              <th style={{width: '45px'}}>ลำดับ<br/>ที่</th>
              <th style={{width: '180px'}}>ชื่อ – สกุล</th>
              <th colSpan={31} style={{padding: '6px'}}>วันที่ปฏิบัติงาน</th>
              <th style={{width: '130px'}}>{pageNumber === 2 ? "จำนวนเงิน" : "ลายเซ็น"}</th>
            </tr>
            <tr className="h-8">
              <th style={{backgroundColor: '#e5e7eb'}}></th>
              <th style={{backgroundColor: '#e5e7eb'}}></th>
              {daysArray.map(day => (
                <th key={day} style={{
                    width: '23px', 
                    backgroundColor: isWeekendOrHoliday(day) ? '#d1d5db' : '#f3f4f6', 
                    color: '#000000',
                    fontWeight: 'bold'
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
                <td style={{textAlign: 'left', paddingLeft: '16px', fontWeight: '600', fontSize: '13px'}}>{staff.name}</td>
                {daysArray.map(day => (
                  <td key={day} style={{
                      fontWeight: 'bold', 
                      backgroundColor: isWeekendOrHoliday(day) ? '#e5e7eb' : 'transparent',
                      color: '#000000',
                      fontSize: '13px'
                  }}>
                    {getShiftCode(staff.id, day)}
                  </td>
                ))}
                <td style={{fontWeight: 'bold', fontSize: '13px'}}>
                    {pageNumber === 2 ? calculateAmount(staff.id) : ""}
                </td>
              </tr>
            ))}
          </tbody>
      </table>

      {/* Footer */}
      <div className="mt-6 text-xs font-bold text-gray-700">
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
          border: 1px solid #525252; /* Neutral-600 */
          color: #000000;
        }
        .print-table th, .print-table td {
          border: 1px solid #737373; /* Neutral-500 */
          padding: 8px 4px; 
          text-align: center;
          vertical-align: middle;
          height: 34px; 
        }
        .print-table th {
          background-color: #f3f4f6;
          font-weight: bold;
          padding: 10px 4px;
        }
        .print-text-sm {
           font-size: 12px;
        }
      `}</style>
      
      <PageLayout pageNumber={1} />
      <PageLayout pageNumber={2} />
    </div>
  );
};