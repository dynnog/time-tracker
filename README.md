# Local Desktop Time Tracker

A local-first macOS and Windows desktop time tracker built with Tauri, React, TypeScript, and SQLite.

## Current scope

This repository currently implements Phases 1–10 from `AGENTS.md` for the Teams and Zoom desktop applications.

Implemented:
- Tauri + React + TypeScript + Vite foundation
- SQLite migration and default activity seeding
- Customer add/edit/archive/search/restore
- Manual timer with customer, activity, and optional notes
- Database-enforced single active timer
- Stop timer with timestamp-derived duration
- Active timer restoration after app restart
- Timer display derived from persisted `start_time`, not a frontend counter
- Weekly timesheet with Monday–Sunday navigation
- Completed entry review, edit, and delete
- Daily totals grouped by local calendar date
- Weekly, daily, and customer reporting totals
- Detailed CSV export through a native save dialog
- Date-and-customer summary CSV export through a native save dialog
- Excel export with Detailed Entries and Weekly Summary sheets
- Isolated Teams and Zoom microphone-signal detector with macOS and Windows adapters
- Meeting Started/Meeting Ended diagnostic event screen
- Automatic persisted meeting sessions for high-confidence Teams and Zoom detections
- Manual-timer conflict handling and post-meeting customer/activity confirmation
- Persistent recent customer/activity choices for faster timer setup
- Cross-platform `Ctrl+Enter` keyboard shortcut to start or stop the manual timer
- Completed time-entry duplication from the weekly Timesheet
- Favorite customers with priority placement in customer selectors
- Optional native timer and meeting notifications
- Live `HH:MM:SS` menu-bar duration on macOS and duration tooltip on Windows, returning to `00:00:00` when idle, with state-aware Start New Timer and Stop actions; tray and sidebar Start actions open a compact customer/activity/notes window without expanding the full app
- Single-instance desktop lifecycle: subsequent launches focus the existing app, and Windows release builds do not open a console window

Not implemented yet:
- Calendar integration and idle detection

The meeting detector observes active microphone use by the Teams and Zoom desktop applications. Browser-based meetings, including Google Meet, are outside the current scope and are ignored.

## Prerequisites

On macOS install:
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 20+
- Rust via rustup: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

On Windows install Node.js 20+, Rust with the stable MSVC toolchain, Microsoft C++ Build Tools, and WebView2 as described in the Tauri prerequisites.

## Run locally

```bash
npm install
npm run tauri dev
```

The SQLite database is created automatically in Tauri's application data location when the app starts.

## Validation

```bash
npm run test
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```
