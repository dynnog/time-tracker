import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const NOTIFICATIONS_KEY = "time-tracker-native-notifications";

export function areNativeNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATIONS_KEY) === "true";
}

export async function setNativeNotificationsEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    localStorage.setItem(NOTIFICATIONS_KEY, "false");
    return false;
  }
  try {
    const granted = await isPermissionGranted() || await requestPermission() === "granted";
    localStorage.setItem(NOTIFICATIONS_KEY, String(granted));
    return granted;
  } catch {
    localStorage.setItem(NOTIFICATIONS_KEY, "false");
    return false;
  }
}

export async function notify(title: string, body: string): Promise<void> {
  if (!areNativeNotificationsEnabled()) return;
  try {
    if (await isPermissionGranted()) sendNotification({ title, body });
  } catch {
    // Notifications are a convenience; timer persistence must never depend on them.
  }
}
