# Local Desktop Time Tracker

A local-first macOS desktop time tracker built with Tauri, React, TypeScript, and SQLite.

## Current scope

This repository currently implements Phases 1–4 from `AGENTS.md`.

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

Not implemented yet:
- Weekly reporting totals by customer
- CSV/Excel export
- Meeting detection
- Calendar/idle/menu-bar features

## Prerequisites

On macOS install:
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 20+
- Rust via rustup: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

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
