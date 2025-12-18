
export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
  LEAVE_START = 'LEAVE_START',
  LEAVE_END = 'LEAVE_END',
  HOURLY_PASS_START = 'HOURLY_PASS_START',
  HOURLY_PASS_END = 'HOURLY_PASS_END'
}

export interface AttendanceLog {
  id: string;
  timestamp: number; // Unix timestamp
  type: LogType;
  shamsiDate: string; // e.g., "1403/02/15"
  time: string; // e.g., "08:30"
}

export interface EmployeeData {
  name: string;
  employeeId: string;
  logs: AttendanceLog[];
}

export interface MonthlySummary {
  totalHours: number;
  overtimeHours: number;
  holidayHours: number;
  leaveHours: number;
  requiredHours: number;
}
