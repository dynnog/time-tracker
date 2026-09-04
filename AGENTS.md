# AGENTS.md --- Local Desktop Time Tracker

## 1. Objective

Build a lightweight desktop application that tracks work time by
customer/project.

The app supports two primary workflows:

1.  **Manual time tracking**
    -   User selects a customer/project.
    -   User selects or enters an activity.
    -   User starts a timer.
    -   User stops the timer when finished.
    -   The completed entry is stored locally.
2.  **Automatic meeting time tracking**
    -   App detects when the user joins a supported meeting/call.
    -   Timer starts automatically.
    -   Timer stops automatically when the call ends.
    -   App prompts the user to identify the customer/project associated
        with the call.
    -   User optionally enters notes.
    -   Entry is stored locally.

At the end of the week, the user can review all tracked time, edit
entries, see totals, and export the data to CSV or Excel.

**There is no SuiteProjects Pro API integration and no SPP import
requirement.**

The exported report is only intended to help the user manually enter
weekly time into SuiteProjects Pro.

------------------------------------------------------------------------

## 2. Product Principles

Keep the application:

-   Local-first
-   Fast
-   Simple
-   Reliable
-   Minimal-click
-   Offline-capable
-   Easy to review before exporting
-   Easy to extend later

Do not build:

-   Authentication
-   Multi-user support
-   Cloud synchronization
-   SuiteProjects Pro integration
-   Billing
-   Invoicing
-   Team management
-   Web hosting
-   Complex permissions
-   AI features in the MVP

------------------------------------------------------------------------

## 3. Recommended Technology Stack

Use:

-   Tauri for desktop application shell
-   React
-   TypeScript
-   Vite
-   SQLite
-   Tailwind CSS or another lightweight styling option
-   Rust only where Tauri/native OS access requires it

Preferred architecture:

``` text
React / TypeScript UI
        |
        v
Tauri commands / services
        |
        v
SQLite local database
```

The database should remain entirely local to the user's machine.

------------------------------------------------------------------------

## 4. Platforms

Primary supported platforms:

-   macOS
-   Windows

macOS and Windows are first-class supported platforms. Windows support is not a future enhancement. All core architecture and implementation decisions must account for both platforms from the start.

Platform-specific behavior must be isolated behind small native/service abstractions and must not leak into the React UI or core timer/database logic. Avoid hardcoded macOS paths, AppleScript as a core dependency, Unix-only shell/process assumptions, or filesystem logic that assumes `/` path separators. Prefer Tauri and standard cross-platform APIs for paths, dialogs, filesystem access, notifications, and application lifecycle behavior.

Build and packaging must be validated on each target operating system. macOS release artifacts should be built/tested on macOS and Windows release artifacts should be built/tested on Windows.

Meeting detection should initially target the meeting software the user
actually uses most frequently, while preserving separate platform-specific implementations where required.

Likely candidates:

-   Microsoft Teams
-   Zoom

Design the meeting detection layer so additional applications can be
added later.

------------------------------------------------------------------------

## 5. MVP Scope

The first usable version should focus entirely on manual timer tracking.

Do not start by implementing automatic meeting detection.

MVP features:

-   Customer management
-   Activity management
-   Start timer
-   Stop timer
-   Running timer display
-   Prevent overlapping timers
-   Time entry persistence
-   Daily/weekly history
-   Edit time entry
-   Delete time entry
-   Weekly totals
-   Customer totals
-   CSV export
-   Excel export

Meeting detection should be implemented only after the basic timer
workflow is stable.

------------------------------------------------------------------------

## 6. Application Navigation

Use a small desktop application with approximately four primary
sections:

-   Timer
-   Timesheet
-   Customers
-   Settings

### Timer

Main screen.

Idle state:

``` text
Customer
[ Select Customer ]

Activity
[ Configuration ]

Notes
[ Optional notes ]

        Start Timer
```

Running state:

``` text
ARUI

Configuration

01:42:17

Started: 9:12 AM

        Stop Timer
```

The timer should continue accurately even if:

-   user navigates to another page
-   application window is minimized
-   UI rerenders
-   application temporarily loses focus

Do not calculate elapsed duration purely from a frontend counter.

Always use:

``` text
current timestamp - stored start timestamp
```

------------------------------------------------------------------------

## 7. Customers Screen

Allow the user to create customers/projects.

Fields:

-   Customer Name
-   Active
-   Optional Notes

Example customers:

-   ARUI
-   InsVista
-   Internal
-   Training
-   Administrative

Features:

-   Add customer
-   Edit customer
-   Archive customer
-   Search customers

Avoid permanently deleting customers that already have time entries. Use
an `active` flag instead.

------------------------------------------------------------------------

## 8. Activities

Provide default activities.

Initial values:

-   Customer Meeting
-   Configuration
-   Development
-   Testing
-   Troubleshooting
-   Documentation
-   Research
-   Internal Meeting
-   Administrative
-   Other

Allow custom activities later.

Activities may initially be stored in a database table or application
configuration.

------------------------------------------------------------------------

## 9. Time Entry Model

Each time entry should contain at minimum:

``` text
id
customer_id
activity_id or activity_name
start_time
end_time
duration_seconds
notes
source
created_at
updated_at
```

Source values:

``` text
manual
meeting
```

Possible future values:

``` text
teams
zoom
calendar
imported
```

Store timestamps in a consistent machine-safe format.

Recommended:

``` text
UTC ISO timestamp
```

Convert to local timezone only when displaying to the user.

------------------------------------------------------------------------

## 10. Suggested Database Schema

### customers

``` sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### activities

``` sql
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1
);
```

### time_entries

``` sql
CREATE TABLE time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    activity_id INTEGER,
    activity_name TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds INTEGER,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (activity_id) REFERENCES activities(id)
);
```

Only one entry may have:

``` text
end_time = NULL
```

at any given time. That represents the currently running timer.

------------------------------------------------------------------------

## 11. Timer Behavior

### Start Timer

User must select:

-   Customer
-   Activity

Notes are optional.

When Start is clicked:

1.  Check whether another timer is currently running.
2.  If yes, do not start another timer.
3.  Insert a new time entry with:
    -   `start_time = current timestamp`
    -   `end_time = null`
    -   `duration_seconds = null`
4.  Show running timer state.

### Stop Timer

When Stop is clicked:

1.  Retrieve currently running entry.
2.  Set:
    -   `end_time`
    -   `duration_seconds`
3.  Save changes.
4.  Show success state.
5.  Return UI to idle timer screen.

Calculate duration using timestamps:

``` text
duration_seconds = end_time - start_time
```

Do not calculate the final duration from the displayed timer counter.

------------------------------------------------------------------------

## 12. Overlapping Timer Protection

Only one timer may run at a time.

If another timer attempts to start:

``` text
A timer is already running.

ARUI
Configuration
Started 9:42 AM

[Stop Current Timer]
[Cancel]
```

Do not silently create overlapping entries.

------------------------------------------------------------------------

## 13. Weekly Review Screen

Create a weekly timesheet view.

Default to the current Monday-Sunday week.

Navigation:

``` text
< Previous Week

September 1 – September 7

Next Week >
```

Show entries grouped by day.

Example:

``` text
MONDAY — SEPTEMBER 1

ARUI
Customer Meeting
9:00 AM – 10:02 AM
1h 02m

ARUI
Configuration
10:15 AM – 12:20 PM
2h 05m
```

Each entry should support:

-   Edit
-   Delete

------------------------------------------------------------------------

## 14. Edit Time Entry

Allow editing:

-   Customer
-   Activity
-   Date
-   Start time
-   End time
-   Notes

When start or end time changes, recalculate `duration_seconds`.

Validate:

``` text
end_time > start_time
```

------------------------------------------------------------------------

## 15. Weekly Summary

Display total tracked time for the selected week.

Example:

``` text
Weekly Total
38h 25m
```

Display totals by customer:

``` text
ARUI             17h 15m
InsVista          8h 45m
Internal           6h 10m
Other              6h 15m
```

Also provide daily totals:

``` text
Monday       8h 02m
Tuesday      7h 45m
Wednesday    8h 22m
Thursday     7h 51m
Friday       6h 25m
```

------------------------------------------------------------------------

## 16. Detailed CSV Export

Provide an **Export Detailed CSV** action.

Columns:

``` text
Date
Customer
Activity
Start Time
End Time
Duration
Duration Hours
Notes
Source
```

Example:

``` csv
Date,Customer,Activity,Start Time,End Time,Duration,Duration Hours,Notes,Source
09/01/2026,ARUI,Customer Meeting,09:00 AM,10:02 AM,01:02,1.03,Weekly implementation meeting,Meeting
09/01/2026,ARUI,Configuration,10:15 AM,12:20 PM,02:05,2.08,Rating configuration,Manual
```

------------------------------------------------------------------------

## 17. Summary CSV Export

Also provide an **Export Summary CSV** action.

Aggregate by:

``` text
Date + Customer
```

Example:

``` csv
Date,Customer,Total Hours
09/01/2026,ARUI,3.11
09/01/2026,InsVista,2.25
09/02/2026,ARUI,4.50
```

This is intended to make manual timesheet entry easier.

Do not remove the detailed export. Provide both.

------------------------------------------------------------------------

## 18. Excel Export

Provide an **Export Excel** action.

Create an `.xlsx` workbook containing two sheets.

### Detailed Entries

Columns:

-   Date
-   Customer
-   Activity
-   Start
-   End
-   Duration
-   Hours
-   Notes
-   Source

### Weekly Summary

Columns:

-   Date
-   Customer
-   Total Hours

Optionally include a customer totals section below or in another sheet.

Do not over-format the Excel file. Simple readable formatting is
sufficient.

------------------------------------------------------------------------

## 19. Meeting Detection --- Phase 2

Once the manual timer is stable, add automatic meeting tracking.

Do not couple meeting detection directly to the timer UI.

Create a separate service abstraction.

Example:

``` ts
interface MeetingDetector {
    start(): Promise<void>;
    stop(): Promise<void>;
    onMeetingStarted(callback: MeetingStartedHandler): void;
    onMeetingEnded(callback: MeetingEndedHandler): void;
}
```

This allows different implementations for:

-   Teams
-   Zoom
-   Google Meet
-   Other applications

It must also allow platform-specific detector implementations without changing the timer system, for example:

``` text
MeetingDetector
├── MacMeetingDetector
└── WindowsMeetingDetector
```

The React UI and timer service must consume the common detector interface and must not contain macOS- or Windows-specific meeting detection logic.

------------------------------------------------------------------------

## 20. Automatic Meeting Workflow

When a meeting is detected:

``` text
No meeting
     |
     v
Meeting detected
     |
     v
Start meeting timer
```

When the meeting ends:

``` text
Meeting ended
     |
     v
Stop meeting timer
     |
     v
Prompt user
```

Prompt:

``` text
Meeting Completed

Duration
52 minutes

Customer
[ Select Customer ]

Activity
Customer Meeting

Notes
[ Optional ]

[Save]
```

The user must confirm the customer before the final entry is saved.

------------------------------------------------------------------------

## 21. Handling a Running Manual Timer When a Meeting Starts

If a manual timer is running and the user joins a meeting, do not allow
two timers to silently overlap.

Show:

``` text
A meeting has started.

Current timer:

ARUI
Configuration
1h 14m

What would you like to do?

[Stop current timer and track meeting]
[Ignore meeting]
```

Potential future enhancement:

``` text
Pause current timer
```

Do not implement pause/resume in the initial version unless necessary.
Stopping and restarting is simpler and produces clearer records.

------------------------------------------------------------------------

## 22. Meeting Detection Strategy

Start with the simplest reliable operating-system-level detection.

Do not immediately build Microsoft Graph or Zoom API integrations.

Possible approaches include:

-   process detection
-   active window detection
-   microphone usage
-   application state
-   OS-level media/call indicators

Build a proof of concept first.

The detector should emit only two meaningful events:

``` text
meeting_started
meeting_ended
```

The timer system should not care how those events were detected.

------------------------------------------------------------------------

## 23. Calendar Integration --- Future Phase

Later, optionally integrate the user's calendar.

Purpose: infer customer based on meeting information.

Example:

``` text
Calendar Event:
ARUI Weekly Implementation Meeting

Suggested customer:
ARUI
```

Do not automatically save based solely on the prediction.

Always allow the user to confirm or change the customer.

------------------------------------------------------------------------

## 24. Customer Matching Rules --- Future Phase

Allow keyword mapping.

Example:

``` text
Keyword             Customer

ARUI                 ARUI
Farm Program         ARUI
InsVista             InsVista
Clarion Door         Clarion Door
```

If a meeting title contains a known keyword, preselect the matching
customer.

The user must still be able to change the selection before saving.

------------------------------------------------------------------------

## 25. Idle Detection --- Future Phase

Optionally detect inactivity.

Example:

``` text
You were inactive for 24 minutes.

12:07 PM – 12:31 PM

Would you like to:

[Keep Time]
[Remove Idle Time]
[Edit Entry]
```

Do not implement idle detection until core tracking is reliable.

------------------------------------------------------------------------

## 26. System Tray / Menu Bar --- Phase 2 or 3

Eventually support a macOS menu bar experience.

Example:

``` text
Time Tracker

ARUI — Configuration
01:22:18

Stop Timer
----------------
Start New Timer
Weekly Timesheet
Open App
Quit
```

The app should remain useful even when the primary window is closed or
minimized.

------------------------------------------------------------------------

## 27. Notifications

Use native desktop notifications sparingly.

Useful notifications:

-   Timer started
-   Timer stopped
-   Meeting detected
-   Meeting ended --- select customer

Avoid continuous notifications.

------------------------------------------------------------------------

## 28. Crash / Restart Recovery

Timer data must survive application restarts.

If the application closes while a timer is active, do not lose the
timer.

On restart:

``` text
A timer is still running.

ARUI
Configuration

Started:
9:34 AM

Current duration:
2h 14m

[Continue]
[Stop Now]
[Edit]
```

Because start time is persisted in SQLite, elapsed time can be
reconstructed.

------------------------------------------------------------------------

## 29. Application Startup Behavior

On startup:

1.  Initialize database.
2.  Apply migrations.
3.  Load current running timer if one exists.
4.  Load active customers.
5.  Load activities.
6.  Start meeting detection service if enabled.

Meeting detection is not required during the initial MVP phases.

------------------------------------------------------------------------

## 30. Settings Screen

Initial settings:

``` text
Start week on:
Monday

Time format:
12-hour

Meeting detection:
Enabled / Disabled

Meeting applications:
Teams
Zoom

Export directory:
Choose Folder
```

Future settings:

-   Idle detection
-   Calendar integration
-   Customer matching rules
-   Rounding behavior

------------------------------------------------------------------------

## 31. Time Precision

Internally store exact seconds.

Example:

``` text
3727 seconds
```

UI may display:

``` text
1h 02m
```

Export hours should use decimal hours:

``` text
3727 / 3600 = 1.0353
```

Export rounded to two decimal places:

``` text
1.04
```

Do not permanently round the underlying time entry.

------------------------------------------------------------------------

## 32. Suggested Project Structure

``` text
time-tracker/
│
├── src/
│   ├── components/
│   │   ├── Timer/
│   │   ├── Timesheet/
│   │   ├── Customers/
│   │   └── Common/
│   │
│   ├── pages/
│   │   ├── TimerPage.tsx
│   │   ├── TimesheetPage.tsx
│   │   ├── CustomersPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── services/
│   │   ├── timerService.ts
│   │   ├── exportService.ts
│   │   └── meetingService.ts
│   │
│   ├── db/
│   │   ├── customers.ts
│   │   ├── timeEntries.ts
│   │   └── activities.ts
│   │
│   ├── hooks/
│   ├── types/
│   └── utils/
│
├── src-tauri/
│   ├── src/
│   ├── migrations/
│   └── tauri.conf.json
│
├── package.json
└── README.md
```

Adjust this structure where Tauri conventions require.

------------------------------------------------------------------------

## 33. Development Phases

### Phase 1 --- Project Foundation

Build:

-   Tauri application
-   React/TypeScript frontend
-   SQLite database
-   Database migrations
-   Basic navigation
-   Basic styling

Acceptance criteria:

-   Application launches successfully on macOS.
-   Application launches successfully on Windows.
-   Database initializes automatically on both supported platforms.
-   Core application code contains no unnecessary OS-specific path or shell assumptions.

### Phase 2 --- Customers

Build:

-   Customer list
-   Add customer
-   Edit customer
-   Archive customer

Acceptance criteria:

-   Customer records persist after application restart.

### Phase 3 --- Manual Timer

Build:

-   Customer selector
-   Activity selector
-   Notes
-   Start timer
-   Stop timer
-   Running duration
-   Persistent active timer
-   Overlap protection

Acceptance criteria:

-   User can accurately track a work session from start to finish.
-   Timer remains accurate after navigating between pages.
-   Timer survives application restart.

### Phase 4 --- Time Entry History

Build:

-   Current week view
-   Previous/next week navigation
-   Group entries by date
-   Edit entry
-   Delete entry
-   Daily totals

Acceptance criteria:

-   User can review and correct an entire week's tracked time.

### Phase 5 --- Weekly Reporting

Build:

-   Weekly total
-   Customer totals
-   Daily totals

Acceptance criteria:

-   Calculated totals exactly match underlying time entries.

### Phase 6 --- CSV Export

Build:

-   Detailed CSV
-   Summary CSV
-   Save dialog

Acceptance criteria:

-   CSV files open correctly in Excel and Numbers.
-   Decimal hour totals match the weekly review screen.

### Phase 7 --- Excel Export

Build:

-   `.xlsx` output
-   Detailed Entries sheet
-   Weekly Summary sheet

Acceptance criteria:

-   Workbook opens successfully in Excel and Numbers.

### Phase 8 --- Meeting Detection Proof of Concept

Do not modify the timer system initially.

Create a diagnostic screen or service that only reports:

``` text
Meeting Started
Meeting Ended
```

Test with Microsoft Teams. Validate the detector architecture on both macOS and Windows; platform-specific native implementations may differ, but they must emit the same `meeting_started` and `meeting_ended` events.

Acceptance criteria:

-   Detector reliably identifies beginning and end of actual calls
    without creating false events during normal application use.

### Phase 9 --- Meeting Timer Integration

Connect meeting events to the timer system.

Build:

-   automatic start
-   automatic stop
-   customer prompt
-   meeting source
-   conflict handling when another timer is running

Acceptance criteria:

-   Joining and leaving a meeting produces a correct time entry after
    user confirmation.

### Phase 10 --- Quality of Life

Potential features:

-   menu bar
-   notifications
-   quick-start recent customer
-   favorite customers
-   keyboard shortcuts
-   duplicate entry
-   customer keyword matching
-   calendar integration
-   idle detection

Implement only after the core workflow proves useful.

------------------------------------------------------------------------

## 34. Testing Requirements

Add tests for time calculations.

Examples:

``` text
09:00 → 10:00 = 3600 seconds
09:15 → 11:45 = 9000 seconds
23:30 → 00:30 next day = 3600 seconds
```

Test:

-   daylight saving transitions
-   timers crossing midnight
-   application restart with active timer
-   archived customers referenced by old entries
-   weekly boundary calculations
-   decimal hour conversion
-   overlapping timer prevention

------------------------------------------------------------------------

## 35. Important Implementation Rules

Follow these rules throughout development:

1.  Never trust the frontend timer counter as the source of truth.
2.  Persist timer start timestamps immediately.
3.  Use the database as the authoritative source.
4.  Only allow one active timer.
5.  Never permanently round stored duration.
6.  Keep meeting detection isolated from time tracking.
7.  Prefer straightforward code over unnecessary abstractions.
8.  Avoid cloud dependencies.
9.  Avoid introducing accounts/authentication.
10. Keep the MVP small.
11. Do not build SPP integration.
12. Do not build CSV import.
13. Make exports human-readable.
14. Make all time entries editable.
15. Protect user data from accidental loss.
16. Do not move to later phases until the current phase works and its
    acceptance criteria are satisfied.
17. Keep the application functional at the end of each implementation
    phase.
18. Run relevant tests, TypeScript checks, and Rust compilation checks
    before considering a phase complete.
19. Treat macOS and Windows as first-class supported platforms.
20. Keep core timer, database, timesheet, and export logic platform-neutral.
21. Use Tauri or standard cross-platform APIs for filesystem paths, dialogs, notifications, and application lifecycle behavior.
22. Isolate unavoidable OS-specific code behind explicit native/service abstractions.
23. Do not introduce AppleScript, Unix-only commands, Windows-only APIs, or hardcoded platform paths into shared application logic.
24. Before a release is considered complete, validate packaging and core workflows on both macOS and Windows.

------------------------------------------------------------------------

## 36. Initial Codex Assignment

**Start by implementing only Phases 1 through 3. All implementation must support both macOS and Windows.**

Do not implement automatic meeting detection yet.

Tasks:

1.  Initialize Tauri + React + TypeScript project.
2.  Configure SQLite.
3.  Create migrations for:
    -   customers
    -   activities
    -   time_entries
4.  Seed default activities.
5.  Build customer CRUD.
6.  Build main timer screen.
7.  Implement start timer.
8.  Implement stop timer.
9.  Enforce only one active timer.
10. Restore an active timer after application restart.
11. Show current elapsed time.
12. Create clean basic navigation.

After completing these tasks:

-   run the application
-   run tests
-   run TypeScript checks
-   fix TypeScript errors
-   fix Rust compilation errors
-   confirm database persistence
-   verify the timer survives navigation/re-rendering
-   document how to launch the project locally

**Stop after Phases 1--3 are implemented and verified. Do not proceed
automatically to meeting detection or export.**

------------------------------------------------------------------------

## 37. Definition of a Successful First Version

The first version is successful if this daily workflow works reliably:

``` text
Open app

Select ARUI
Select Configuration

Start Timer

Work

Stop Timer

Select InsVista
Select Customer Meeting

Start Timer

Work

Stop Timer

Open Weekly Timesheet

Review entries

Correct anything necessary

Export weekly report

Use report while manually entering time into SuiteProjects Pro
```

Everything beyond this workflow should be treated as an enhancement
rather than a requirement for the first release.
