# Local Desktop Time Tracker

A local-first macOS and Windows desktop time tracker built with Tauri, React, TypeScript, and SQLite.

## Current scope

This repository currently implements Phases 1–9 from `AGENTS.md`, with Google Meet limited to diagnostic detection pending browser-tab confirmation.

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
- Isolated Teams, Zoom, and Google Meet microphone-signal detector with macOS and Windows adapters
- Meeting Started/Meeting Ended diagnostic event screen
- Automatic persisted meeting sessions for high-confidence Teams and Zoom detections
- Manual-timer conflict handling and post-meeting customer/activity confirmation

Not implemented yet:
- Calendar/idle/menu-bar features

The meeting detector observes active microphone use by Teams, Zoom, and supported browsers. High-confidence Teams and Zoom signals can create meeting entries. Browser microphone use is reported as a low-confidence Google Meet candidate because the desktop process alone cannot identify the active browser tab, so it remains disconnected from automatic tracking.

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
