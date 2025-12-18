
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
