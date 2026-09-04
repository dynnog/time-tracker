use super::DetectedApplication;

#[cfg(target_os = "windows")]
use super::NativeMeetingDetector;

#[cfg(target_os = "windows")]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

#[cfg(target_os = "windows")]
pub struct WindowsMeetingDetector;
#[cfg(target_os = "windows")]
impl WindowsMeetingDetector {
    pub fn new() -> Self { Self }
    fn active_microphone_clients() -> Vec<String> {
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let Ok(consent) = root.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone") else { return Vec::new(); };
        let mut active = Vec::new();
        collect_active_keys(&consent, "", &mut active, 0);
        active
    }
}

#[cfg(target_os = "windows")]
fn collect_active_keys(key: &RegKey, path: &str, active: &mut Vec<String>, depth: usize) {
    let started = key.get_value::<u64, _>("LastUsedTimeStart").unwrap_or(0);
    let stopped = key.get_value::<u64, _>("LastUsedTimeStop").unwrap_or(0);
    if started > 0 && (stopped == 0 || started > stopped) { active.push(path.to_string()); }
    if depth >= 2 { return; }
    for child in key.enum_keys().flatten() {
        if let Ok(child_key) = key.open_subkey(&child) {
            let child_path = if path.is_empty() { child } else { format!("{path}\\{child}") };
            collect_active_keys(&child_key, &child_path, active, depth + 1);
        }
    }
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn classify_client(path: &str) -> Option<DetectedApplication> {
    let normalized = path.to_ascii_lowercase();
    if normalized.contains("msteams") || normalized.contains("ms-teams.exe") || normalized.contains("teams.exe") {
        Some(DetectedApplication { id: "teams", name: "Microsoft Teams", confidence: "high", signal: "Windows reports Teams is actively using the microphone" })
    } else if normalized.contains("zoom.exe") {
        Some(DetectedApplication { id: "zoom", name: "Zoom", confidence: "high", signal: "Windows reports Zoom is actively using the microphone" })
    } else if ["chrome.exe", "msedge.exe", "firefox.exe"].iter().any(|name| normalized.contains(name)) {
        Some(DetectedApplication { id: "google-meet", name: "Google Meet", confidence: "low", signal: "Windows reports a browser is using the microphone; Meet tab is not confirmed" })
    } else { None }
}

#[cfg(target_os = "windows")]
impl NativeMeetingDetector for WindowsMeetingDetector {
    fn platform(&self) -> &'static str { "Windows" }
    fn scan(&mut self) -> Vec<DetectedApplication> {
        let mut applications = Vec::new();
        for client in Self::active_microphone_clients() {
            if let Some(application) = classify_client(&client) {
                if !applications.iter().any(|existing: &DetectedApplication| existing.id == application.id) { applications.push(application); }
            }
        }
        applications
    }
}

#[cfg(test)]
mod tests {
    use super::classify_client;
    #[test]
    fn classifies_supported_windows_clients() {
        assert_eq!(classify_client("MSTeams_8wekyb3d8bbwe").unwrap().id, "teams");
        assert_eq!(classify_client("C:#Program Files#Zoom#bin#Zoom.exe").unwrap().id, "zoom");
        assert_eq!(classify_client("C:#Program Files#Google#Chrome#chrome.exe").unwrap().id, "google-meet");
        assert!(classify_client("Spotify.exe").is_none());
    }
}
