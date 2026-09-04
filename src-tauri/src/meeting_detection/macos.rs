use super::{DetectedApplication, NativeMeetingDetector};
use std::mem::size_of;
use sysinfo::{ProcessesToUpdate, System};

type AudioObjectId = u32;
type OsStatus = i32;

#[repr(C)]
struct AudioObjectPropertyAddress {
    selector: u32,
    scope: u32,
    element: u32,
}

const SYSTEM_OBJECT: AudioObjectId = 1;
const GLOBAL_SCOPE: u32 = u32::from_be_bytes(*b"glob");
const MAIN_ELEMENT: u32 = 0;
const PROCESS_LIST: u32 = u32::from_be_bytes(*b"prs#");
const PROCESS_PID: u32 = u32::from_be_bytes(*b"ppid");
const PROCESS_RUNNING_INPUT: u32 = u32::from_be_bytes(*b"piri");

#[link(name = "CoreAudio", kind = "framework")]
unsafe extern "C" {
    fn AudioObjectGetPropertyDataSize(
        object_id: AudioObjectId,
        address: *const AudioObjectPropertyAddress,
        qualifier_size: u32,
        qualifier_data: *const std::ffi::c_void,
        data_size: *mut u32,
    ) -> OsStatus;
    fn AudioObjectGetPropertyData(
        object_id: AudioObjectId,
        address: *const AudioObjectPropertyAddress,
        qualifier_size: u32,
        qualifier_data: *const std::ffi::c_void,
        data_size: *mut u32,
        data: *mut std::ffi::c_void,
    ) -> OsStatus;
}

pub struct MacMeetingDetector {
    system: System,
}

impl MacMeetingDetector {
    pub fn new() -> Self {
        Self {
            system: System::new(),
        }
    }

    fn active_input_pids() -> Vec<u32> {
        let address = AudioObjectPropertyAddress {
            selector: PROCESS_LIST,
            scope: GLOBAL_SCOPE,
            element: MAIN_ELEMENT,
        };
        let mut byte_count = 0u32;
        let status = unsafe {
            AudioObjectGetPropertyDataSize(
                SYSTEM_OBJECT,
                &address,
                0,
                std::ptr::null(),
                &mut byte_count,
            )
        };
        if status != 0 || byte_count == 0 {
            return Vec::new();
        }
        let mut objects = vec![0u32; byte_count as usize / size_of::<AudioObjectId>()];
        let status = unsafe {
            AudioObjectGetPropertyData(
                SYSTEM_OBJECT,
                &address,
                0,
                std::ptr::null(),
                &mut byte_count,
                objects.as_mut_ptr().cast(),
            )
        };
        if status != 0 {
            return Vec::new();
        }
        objects
            .into_iter()
            .filter_map(|object_id| {
                let running: u32 = get_property(object_id, PROCESS_RUNNING_INPUT)?;
                if running == 0 {
                    return None;
                }
                get_property::<i32>(object_id, PROCESS_PID).and_then(|pid| u32::try_from(pid).ok())
            })
            .collect()
    }

    fn process_family_name(&self, pid: u32) -> Option<String> {
        let mut current = sysinfo::Pid::from_u32(pid);
        for _ in 0..8 {
            let process = self.system.process(current)?;
            let name = process.name().to_string_lossy().into_owned();
            if classify_process(&name).is_some() {
                return Some(name);
            }
            current = process.parent()?;
        }
        None
    }
}

fn get_property<T: Copy + Default>(object_id: AudioObjectId, selector: u32) -> Option<T> {
    let address = AudioObjectPropertyAddress {
        selector,
        scope: GLOBAL_SCOPE,
        element: MAIN_ELEMENT,
    };
    let mut value = T::default();
    let mut size = size_of::<T>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object_id,
            &address,
            0,
            std::ptr::null(),
            &mut size,
            (&mut value as *mut T).cast(),
        )
    };
    (status == 0).then_some(value)
}

fn classify_process(name: &str) -> Option<DetectedApplication> {
    let normalized = name.to_ascii_lowercase();
    if matches!(normalized.as_str(), "msteams" | "microsoft teams" | "teams") {
        Some(DetectedApplication {
            id: "teams",
            name: "Microsoft Teams",
            confidence: "high",
            signal: "Teams process has an active microphone stream",
        })
    } else if matches!(normalized.as_str(), "zoom.us" | "zoom") {
        Some(DetectedApplication {
            id: "zoom",
            name: "Zoom",
            confidence: "high",
            signal: "Zoom process has an active microphone stream",
        })
    } else {
        None
    }
}

impl NativeMeetingDetector for MacMeetingDetector {
    fn platform(&self) -> &'static str {
        "macOS"
    }
    fn scan(&mut self) -> Vec<DetectedApplication> {
        self.system.refresh_processes(ProcessesToUpdate::All, true);
        let mut applications = Vec::new();
        for pid in Self::active_input_pids() {
            if let Some(name) = self.process_family_name(pid) {
                if let Some(application) = classify_process(&name) {
                    if !applications
                        .iter()
                        .any(|existing: &DetectedApplication| existing.id == application.id)
                    {
                        applications.push(application);
                    }
                }
            }
        }
        applications
    }
}

#[cfg(test)]
mod tests {
    use super::classify_process;
    #[test]
    fn classifies_supported_macos_apps() {
        assert_eq!(classify_process("MSTeams").unwrap().id, "teams");
        assert_eq!(classify_process("zoom.us").unwrap().id, "zoom");
        assert!(classify_process("Google Chrome").is_none());
        assert!(classify_process("Music").is_none());
    }
}
