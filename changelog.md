# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-02-27

### Added
- Created `server.ts` to serve as an Express backend.
- Added Knex.js for PostgreSQL database connection.
- Created API endpoints for staff, shifts, status, logs, and users.
- Separated frontend logic into custom hooks and services (in progress).

### Changed
- Refactored `App.tsx` into smaller components: `Header`, `CalendarGrid`, `StaffList`, and `Modals`.
- Moved all remaining UI components into the `/components` directory.
- Migrated backend from direct Supabase client calls to an Express.js server.
- Updated `package.json` to run the server using `tsx`.

### Fixed
- Resolved `Uncaught ReferenceError: Modals is not defined` by ensuring correct imports.
- Removed unused modal imports from `App.tsx` as they are now handled by `Modals` component.
- Resolved `Uncaught ReferenceError: OfficialPrintView is not defined` by ensuring correct imports.
- Restored `ShiftLogList` component to `App.tsx` to display shift history logs.
- Verified and corrected API calls in `useShifts` and `useAuth` hooks.
- Ensured all components are correctly imported and utilized in the main application.
