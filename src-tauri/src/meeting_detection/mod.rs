#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

use serde::Serialize;
use std::sync::Mutex;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedApplication {
    pub id: &'static str,
    pub name: &'static str,
    pub confidence: &'static str,
    pub signal: &'static str,
}

pub trait NativeMeetingDetector: Send {
    fn platform(&self) -> &'static str;
    fn scan(&mut self) -> Vec<DetectedApplication>;
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionStatus {
    pub running: bool,
    pub detected: bool,
    pub platform: &'static str,
    pub applications: Vec<DetectedApplication>,
    pub event: Option<&'static str>,
}

pub struct MeetingDetectionService {
    detector: Box<dyn NativeMeetingDetector>,
    running: bool,
    detected: bool,
    applications: Vec<DetectedApplication>,
}

impl MeetingDetectionService {
    fn new(detector: Box<dyn NativeMeetingDetector>) -> Self {
        Self {
            detector,
            running: false,
            detected: false,
            applications: Vec::new(),
        }
    }

    fn status(&self, event: Option<&'static str>) -> DetectionStatus {
        DetectionStatus {
            running: self.running,
            detected: self.detected,
            platform: self.detector.platform(),
            applications: self.applications.clone(),
            event,
        }
    }

    fn start(&mut self) -> DetectionStatus {
        self.running = true;
        self.detected = false;
        self.applications.clear();
        self.status(None)
    }

    fn stop(&mut self) -> DetectionStatus {
        self.running = false;
        self.detected = false;
        self.applications.clear();
        self.status(None)
    }

    fn poll(&mut self) -> DetectionStatus {
        if !self.running {
            return self.status(None);
        }
        self.applications = self.detector.scan();
        let next = self
            .applications
            .iter()
            .any(|application| application.confidence == "high");
        let event = match (self.detected, next) {
            (false, true) => Some("meeting_started"),
            (true, false) => Some("meeting_ended"),
            _ => None,
        };
        self.detected = next;
        self.status(event)
    }
}

#[cfg(target_os = "macos")]
fn platform_detector() -> Box<dyn NativeMeetingDetector> {
    Box::new(macos::MacMeetingDetector::new())
}
#[cfg(target_os = "windows")]
fn platform_detector() -> Box<dyn NativeMeetingDetector> {
    Box::new(windows::WindowsMeetingDetector::new())
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_detector() -> Box<dyn NativeMeetingDetector> {
    Box::new(UnsupportedMeetingDetector)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
struct UnsupportedMeetingDetector;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
impl NativeMeetingDetector for UnsupportedMeetingDetector {
    fn platform(&self) -> &'static str {
        "unsupported"
    }
    fn scan(&mut self) -> Vec<DetectedApplication> {
        Vec::new()
    }
}

pub fn managed_service() -> Mutex<MeetingDetectionService> {
    Mutex::new(MeetingDetectionService::new(platform_detector()))
}

fn with_service(
    state: tauri::State<'_, Mutex<MeetingDetectionService>>,
    action: impl FnOnce(&mut MeetingDetectionService) -> DetectionStatus,
) -> Result<DetectionStatus, String> {
    let mut service = state
        .lock()
        .map_err(|_| "Meeting detector state is unavailable.".to_string())?;
    Ok(action(&mut service))
}

#[tauri::command]
pub fn meeting_detector_start(
    state: tauri::State<'_, Mutex<MeetingDetectionService>>,
) -> Result<DetectionStatus, String> {
    with_service(state, MeetingDetectionService::start)
}
#[tauri::command]
pub fn meeting_detector_stop(
    state: tauri::State<'_, Mutex<MeetingDetectionService>>,
) -> Result<DetectionStatus, String> {
    with_service(state, MeetingDetectionService::stop)
}
#[tauri::command]
pub fn meeting_detector_poll(
    state: tauri::State<'_, Mutex<MeetingDetectionService>>,
) -> Result<DetectionStatus, String> {
    with_service(state, MeetingDetectionService::poll)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    struct FakeDetector {
        values: VecDeque<Vec<DetectedApplication>>,
    }
    impl NativeMeetingDetector for FakeDetector {
        fn platform(&self) -> &'static str {
            "test"
        }
        fn scan(&mut self) -> Vec<DetectedApplication> {
            self.values.pop_front().unwrap_or_default()
        }
    }
    fn teams() -> DetectedApplication {
        DetectedApplication {
            id: "teams",
            name: "Microsoft Teams",
            confidence: "high",
            signal: "active microphone",
        }
    }

    #[test]
    fn emits_only_overall_state_transitions() {
        let detector = FakeDetector {
            values: VecDeque::from([vec![], vec![teams()], vec![teams()], vec![], vec![]]),
        };
        let mut service = MeetingDetectionService::new(Box::new(detector));
        service.start();
        assert_eq!(service.poll().event, None);
        assert_eq!(service.poll().event, Some("meeting_started"));
        assert_eq!(service.poll().event, None);
        assert_eq!(service.poll().event, Some("meeting_ended"));
        assert_eq!(service.poll().event, None);
    }
}
