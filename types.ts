export enum LogType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
  HOURLY_LEAVE_START = 'HOURLY_LEAVE_START',
  HOURLY_LEAVE_END = 'HOURLY_LEAVE_END'
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveType = 'DAILY_LEAVE' | 'HOURLY_PASS' | 'REMOTE_WORK';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  employees?: { name: string, national_id: string };
  type: LeaveType;
  amount: number; // For daily leave: days. For remote/hourly: stored as decimal hours or special format.
  remote_hours?: number;
  remote_minutes?: number;
  shamsi_date: string;
  description: string;
  status: RequestStatus;
  timestamp: number;
}

export interface AttendanceLog {
  id: string;
  employee_id: string;
  timestamp: number;
  type: LogType;
  shamsi_date: string;
  time: string;
  is_manual?: boolean;
}

export interface EmployeeData {
  id: string;
  name: string;
  nationalId: string;
  password: string;
  logs: AttendanceLog[];
  isAdmin?: boolean;
}

// Fixed: Exported CalculationResult interface to be used by utility functions
export interface CalculationResult {
  totalWorkMinutes: number;
  totalPassMinutes: number;
  totalRemoteMinutes: number;
  totalDailyLeaveDays: number;
  adjustedDutyMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  formattedTotalWork: string;
  formattedOvertime: string;
  formattedDeficit: string;
}
