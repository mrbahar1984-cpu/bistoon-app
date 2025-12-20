
export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
  HOURLY_LEAVE_START = 'HOURLY_LEAVE_START',
  HOURLY_LEAVE_END = 'HOURLY_LEAVE_END'
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveType = 'DAILY_LEAVE' | 'HOURLY_PASS';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  type: LeaveType;
  amount: number; // ساعت یا روز
  shamsi_date: string;
  description: string;
  status: RequestStatus;
  timestamp: number;
}

export interface AttendanceLog {
  id: string;
  employee_id?: string;
  employee_name?: string;
  timestamp: number;
  type: LogType;
  shamsiDate: string;
  time: string;
}

export interface EmployeeData {
  id?: string;
  name: string;
  nationalId: string;
  password: string;
  logs: AttendanceLog[];
  isAdmin?: boolean;
}

export interface CalculationResult {
  totalMinutes: number;
  overtimeMinutes: number;
  holidayMinutes: number;
  leaveMinutes: number;
  formattedTotal: string;
  formattedOvertime: string;
  formattedHoliday: string;
}
