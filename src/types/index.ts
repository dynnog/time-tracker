export interface Customer {
  id: number;
  name: string;
  active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  name: string;
  active: number;
}

export interface RunningTimer {
  id: number;
  customer_id: number;
  customer_name: string;
  activity_id: number;
  activity_name: string;
  start_time: string;
  notes: string | null;
  source: string;
}

export interface TimerStartInput {
  customerId: number;
  activityId: number;
  notes?: string;
}

export interface TimeEntry {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_active: number;
  activity_id: number | null;
  activity_name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  notes: string | null;
  source: string;
}

export interface TimeEntryUpdate {
  customerId: number;
  activityId: number;
  startTime: string;
  endTime: string;
  notes: string;
}

export interface MeetingSession {
  id: number;
  application_id: "teams" | "zoom" | "google-meet";
  application_name: string;
  source: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
}

export interface MeetingEntryInput {
  customerId: number;
  activityId: number;
  notes: string;
}
