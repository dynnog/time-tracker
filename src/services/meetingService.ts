import { invoke } from "@tauri-apps/api/core";

export type MeetingEvent = "meeting_started" | "meeting_ended";

export interface DetectedMeetingApplication {
  id: "teams" | "zoom";
  name: string;
  confidence: "high";
  signal: string;
}

export interface MeetingDetectionStatus {
  running: boolean;
  detected: boolean;
  platform: string;
  applications: DetectedMeetingApplication[];
  event: MeetingEvent | null;
}

export interface MeetingEventContext {
  event: MeetingEvent;
  applications: DetectedMeetingApplication[];
}

export type MeetingEventHandler = (context: MeetingEventContext) => void;

export interface MeetingDetector {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): MeetingDetectionStatus | null;
  onMeetingStarted(callback: MeetingEventHandler): () => void;
  onMeetingEnded(callback: MeetingEventHandler): () => void;
  onStatusChanged(callback: (status: MeetingDetectionStatus) => void): () => void;
}

class NativeMeetingDetector implements MeetingDetector {
  private timer: number | null = null;
  private polling = false;
  private status: MeetingDetectionStatus | null = null;
  private startedHandlers = new Set<MeetingEventHandler>();
  private endedHandlers = new Set<MeetingEventHandler>();
  private statusHandlers = new Set<(status: MeetingDetectionStatus) => void>();

  async start(): Promise<void> {
    if (this.timer !== null) return;
    this.publish(await invoke<MeetingDetectionStatus>("meeting_detector_start"));
    await this.poll();
    if (this.timer === null) this.timer = window.setInterval(() => void this.poll(), 2000);
  }

  async stop(): Promise<void> {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.publish(await invoke<MeetingDetectionStatus>("meeting_detector_stop"));
  }

  getStatus(): MeetingDetectionStatus | null { return this.status; }

  onMeetingStarted(callback: MeetingEventHandler): () => void {
    this.startedHandlers.add(callback);
    return () => this.startedHandlers.delete(callback);
  }

  onMeetingEnded(callback: MeetingEventHandler): () => void {
    this.endedHandlers.add(callback);
    return () => this.endedHandlers.delete(callback);
  }

  onStatusChanged(callback: (status: MeetingDetectionStatus) => void): () => void {
    this.statusHandlers.add(callback);
    return () => this.statusHandlers.delete(callback);
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      this.publish(await invoke<MeetingDetectionStatus>("meeting_detector_poll"));
    } finally {
      this.polling = false;
    }
  }

  private publish(status: MeetingDetectionStatus) {
    const previousApplications = this.status?.applications ?? [];
    this.status = status;
    for (const handler of this.statusHandlers) handler(status);
    if (status.event === "meeting_started") {
      const context = { event: status.event, applications: status.applications };
      for (const handler of this.startedHandlers) handler(context);
    } else if (status.event === "meeting_ended") {
      const context = { event: status.event, applications: previousApplications };
      for (const handler of this.endedHandlers) handler(context);
    }
  }
}

export const meetingDetector: MeetingDetector = new NativeMeetingDetector();

const MEETING_DETECTION_KEY = "meeting-detection-enabled";

export function isMeetingDetectionEnabled(): boolean {
  return localStorage.getItem(MEETING_DETECTION_KEY) !== "false";
}

export function setMeetingDetectionEnabled(enabled: boolean): void {
  localStorage.setItem(MEETING_DETECTION_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("meeting-detection-preference", { detail: enabled }));
}
