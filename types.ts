
export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
  HOURLY_LEAVE_START = 'HOURLY_LEAVE_START',
  HOURLY_LEAVE_END = 'HOURLY_LEAVE_END'
}

export interface AttendanceLog {
  id: string;
  timestamp: number;
  type: LogType;
  shamsiDate: string;
  time: string;
}

export interface EmployeeData {
  // Added id property to match database records and fix errors in Dashboard.tsx
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