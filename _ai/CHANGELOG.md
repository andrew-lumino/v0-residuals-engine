# CHANGELOG.md - Residuals Engine Change Log

## ⚠️ INSTRUCTIONS FOR AI ASSISTANTS

**AFTER every code change:**
1. Add entry to this file with current date/time
2. Place newest entries at the TOP
3. Use format: Date → Component → Brief description
4. Only document meaningful changes (not tiny tweaks)
5. Include "why" for bug fixes

**Entry Format:**
\`\`\`markdown
## YYYY-MM-DD HH:MM

### [Added/Changed/Fixed/Removed]: Component/File Name
- What changed
- Why it changed (for fixes: root cause)
- Impact on other components (if any)
\`\`\`

---

## 2025-12-03 14:30

### Added: Comprehensive Action Logging to All High-Priority API Routes
- `app/api/assign-event/route.ts` - Logs event assignments with participant details
- `app/api/confirm-assignment/route.ts` - Logs bulk assignment confirmations
- `app/api/residuals/events/delete/route.ts` - Logs event deletions with full data for restore
- `app/api/hold-assignment/route.ts` - Logs hold actions with reason
- `app/api/deals/[id]/route.ts` - Logs deal updates (PATCH) and deletions (DELETE)
- All routes now generate `request_id` for correlation between actions and debug logs

## 2025-12-03 14:00

### Fixed: Payout Month Display Across All Pages
- Changed all pages to display `payout_month` (e.g., "October 2025") instead of `date`
- Created shared `formatPayoutMonth()` utility in `lib/utils/formatters.ts`
- Updated: UnassignedQueue, by-merchant, by-participant, Dashboard, PayoutsDetailedView
- Renamed table column header from "Date" to "Payout Month"

### Added: Bulk Edit Payout Month Feature
- Created `app/api/residuals/events/bulk-update/route.ts` for mass payout month updates
- Added "Bulk Edit" button to UnassignedQueue when events are selected
- Dialog allows selecting new payout month and applying to all selected events
- Action logged to history for undo capability

### Fixed: CSV Upload Not Using Selected Payout Month
- Root cause: Upload API ignored the `month` parameter from form
- Solution: Now passes user-selected month to `parseCsvFile()` as override
- All uploaded rows now use the selected payout month regardless of CSV contents
- Added upload logging to action_history

## 2025-11-26 16:30

### Added: Tools Section with Calculator and Adjustments Pages
- Created `/tools/calculator` - Standalone residuals calculator with:
  - Deal info inputs (gross revenue, processor costs, adjustments, chargebacks)
  - Dynamic participant management with roles and split percentages
  - Real-time payout breakdown with visual progress bars
  - Export functionality for saving scenarios as JSON
- Created `/tools/adjustments` - Post-payout adjustment management:
  - Stats cards (total adjustments, clawbacks, additional payouts)
  - Create Adjustment tab with deal search and adjustment dialog
  - Adjustment History tab showing all past adjustments
  - Adjustments logged to action_history table for tracking/undo

### Changed: components/layout/Sidebar.tsx
- Added "Tools" collapsible section in navigation
- Tools section contains: History & Logs, Calculator, Adjustments, Airtable Sync
- Moved Airtable Sync under Tools section

## 2025-11-26 15:00

### Added: Action History & Debug Logs System
- Created `action_history` table for tracking all user actions with undo support
- Created `debug_logs` table for error tracking and debugging
- Added `lib/utils/history.ts` with `logAction()`, `logBatchActions()`, `undoAction()`, `logDebug()` utilities
- Added API routes: `/api/history`, `/api/history/undo`, `/api/debug-logs`
- Scripts: `009-create-action-history-table.sql`, `010-create-debug-logs-table.sql`

### Added: scripts/011-add-request-id-to-action-history.sql
- Adds `request_id` column to `action_history` table
- Enables correlation between action_history and debug_logs for error tracing
- Now you can trace: error → request_id → all actions attempted in that request

### Added: Participant Comparison Feature
- Added `/compare name1, name2` command to By Participant page
- Toggle compare mode with Compare button
- Side-by-side performance comparison panel with rankings

### Fixed: Participant Compare Filter Not Working
- Root cause: `/compare` search string was being sent to API, returning 0 results
- Solution: Skip sending `/compare` commands to API, filter client-side instead

## 2025-11-24 21:45

### Fixed: Pending Confirmation Tab Not Showing Assigned Events
- Root cause: Database stored `assignment_status = 'pending_confirmation'` but query looked for `pending`
- Changed query to check for BOTH 'pending' and 'pending_confirmation' for backwards compatibility
- New assignments now store `pending` consistently

### Fixed: File Upload Failing
- Root cause: UploadForm sent FormData key `files` (plural) but API expected `file` (singular)
- Fixed file mode to send each file with key `file` and process one at a time

### Fixed: Removed All Deprecated `plan` References
- Replaced `plan` with `payout_type` in ConfirmedDealViewer.tsx interface and usage
- Replaced `plan` with `payout_type` in EditPendingDealModal.tsx interface and usage
- `plan` field was deprecated per SCHEMA_README.md

### Fixed: Payouts Insert Schema Mismatch  
- Removed `partner_name` and `partner_email` from payout inserts (not in payouts table schema)
- Removed `is_legacy_import` from deals insert (field doesn't exist in deals table)

### Added: scripts/003_fix_pending_confirmation_status.sql
- Migration script to fix existing records with 'pending_confirmation' status
- Updates them to use 'pending' for consistency

## 2025-11-24 20:45

### Fixed: Complete Assignment Flow Rewrite
- Assignment was not working - partners not loading, payouts not being created
- Root cause: `/api/airtable-partners` was fetching from empty `partner_sync` table instead of Airtable API

### Changed: app/api/airtable-partners/route.ts
- Now fetches partners directly from Airtable API (live data)
- Returns partner with: id (Airtable record ID), name, email, role, default_split_pct
- No longer depends on partner_sync table

### Changed: app/api/assign-event/route.ts
- Complete rewrite to properly handle assignment flow
- Creates deal in deals table with participants_json
- Updates csv_data with deal_id, assignment_status, assigned_agent_id/name
- Creates payout records for each participant with calculated amounts
- Uses upsert with unique constraint (csv_data_id, partner_airtable_id)

### Added: app/api/deals/route.ts
- New endpoint for fetching existing deals
- Used by AssignmentModal for suggested deal matching

### Changed: components/residuals/payouts/AssignmentModal.tsx
- Complete rewrite with proper partner selection
- Uses Command/Popover for searchable partner dropdown
- Stores both partner Airtable ID AND name for reliable matching
- Shows calculated payout amounts per participant
- Proper split validation (must equal 100%)

## 2025-11-24 19:30

### Fixed: app/api/unassigned-events/route.ts
- Unassigned events not showing in queue
- Root cause: API response format didn't match what component expected
- Now returns: `{ success: true, events: [...], stats: {...} }`
- Added stats calculation for all three tabs

## 2025-11-24 15:30

### Fixed: app/api/residuals/upload/route.ts
- Manual entry table upload was failing silently
- Root cause: date field was being sent as full ISO timestamp but csv_data.date column expects YYYY-MM-DD format
- Changed `row.date.toISOString()` to `row.date.toISOString().split("T")[0]`
- Added debug logging to help troubleshoot future issues

### Changed: components/residuals/upload/UploadModal.tsx
- Made modal significantly wider (1200px) with inline styles to override dialog defaults
- Added tab switcher for "Upload File" vs "Manual Entry" modes

### Added: components/residuals/upload/UploadForm.tsx - Manual Entry Table
- Added editable HTML table with pre-filled headers for manual data entry
- Headers: Merchant ID, Merchant Name, Volume, Fees, Date, Payout Month
- Add/remove row functionality
- Converts table data to CSV format for upload API

### Changed: lib/utils/csvParser.ts
- Made parser more lenient - only Merchant ID required
- Added "payout month" to header mapping
- Provides sensible defaults for optional fields

## 2025-11-24 14:00

### Fixed: Dashboard Stats Count
- Payouts page showing "1000 records" instead of actual count
- Root cause: Supabase has default 1000 row limit
- Solution: Use separate count queries with `count: "exact"` and `head: true`
- Now displays accurate total count from database

### Added: Payouts Detailed View
- Created /residuals/payouts/detailed with infinite scroll table
- Tabs: Detailed View, By Agent, Monthly Summary, Quarterly Summary
- Filters: Search, Month, Status, Type
- Export buttons: Summary and Detailed (Airtable-ready format)

### Added: app/api/payouts/unique-months/route.ts
- Fetches all unique payout_month values from database
- Used to populate month filter dropdown with all available months

## 2025-11-24 12:00

### Added: Legacy Payouts Import System
- Created /residuals/payouts/import page for bulk CSV import
- API: POST /api/payouts/import handles legacy payout records
- Marks imported records with is_legacy_import flag
- Handles null csv_data_id for legacy records

### Added: Deal Reconstruction
- Created /residuals/admin/reconstruct-deals page
- API: POST /api/admin/reconstruct-deals
- Reconstructs deals table from imported payouts data
- Groups by MID, aggregates participants from payout records

### Changed: Database Schema
- Made csv_data_id nullable in payouts table for legacy imports
- Removed deprecated "plan" column references
- Added is_legacy_import flag to payouts table

## 2025-11-21 17:45

### Added: Unassigned Events Page
- Created `app/residuals/unassigned/page.tsx` as dedicated page for the Unassigned Events workflow
- Includes integrated CSV upload button in the header
- Houses the full `UnassignedQueue` component with all 3 tabs (Unassigned, Pending, Confirmed)

### Changed: Sidebar Navigation
- Added "Unassigned Events" link to `components/layout/Sidebar.tsx`
- Navigation now matches user requirements: Dashboard → Unassigned Events → Payouts → Airtable Sync

## 2025-11-21 16:30

### Added: Database Migration
- Created `scripts/001_create_schema.sql` to initialize all 5 core tables (merchants, partner_sync, deals, csv_data, payouts)
- Fixed 404 Table Not Found error by defining the missing `csv_data` table

## 2025-11-21 16:15

### Added: Payouts Module
- Created `app/api/residuals/payouts/route.ts` to fetch aggregated payout summaries by partner
- Created `app/api/residuals/payouts/mark-paid/route.ts` to bulk update payment status
- Created `components/residuals/payouts/PayoutsTable.tsx` with summary cards and status actions
- Created `app/residuals/payouts/page.tsx` main wrapper
- Implemented client-side aggregation logic for unique merchant counts using Set

## 2025-11-21 16:00

### Added: AssignmentModal
- Created `components/residuals/events/AssignmentModal.tsx` for managing participant splits
- Features: Existing deal lookup (MID memory), multi-participant support, split validation (80-105%), real-time payout calculation
- Integrated into `EventsTable.tsx` to allow assignment of unassigned/pending events

## 2025-11-21 15:45

### Added: Deal & Participant APIs
- Created `app/api/residuals/participants/route.ts` to fetch partner_sync records
- Created `app/api/residuals/deals/route.ts` (POST/GET) for deal creation/updates
- Created `app/api/residuals/events/[id]/confirm/route.ts` to confirm events and generate payouts
- Implemented validation: split totals, participant requirements, MID memory pattern

## 2025-11-21 15:30

### Added: UI Components
- Created `components/residuals/shared` for reusable UI (StatusBadge, MoneyDisplay)
- Created `components/residuals/upload/UploadForm.tsx` with progress tracking and validation
- Created `components/residuals/events/EventsTable.tsx` with server-side filtering and pagination
- Created Pages: `app/residuals/upload/page.tsx` and `app/residuals/events/page.tsx`

## 2025-11-21 15:15

### Added: CSV Upload & Events API
- Added `papaparse` dependency for CSV handling
- Created `lib/utils/csvParser.ts` with duplicate detection (MD5 hashing)
- Created `app/api/residuals/upload/route.ts` handling validation and duplicate checks
- Created `app/api/residuals/events/route.ts` with filtering and pagination
- Implemented batch processing to handle large files without hitting limits

## 2025-11-21 15:00

### Added: Phase 1 Foundation
- Created `lib/types/database.ts` with full TypeScript definitions from SCHEMA_README
- Created `lib/types/api.ts` for standard API responses
- Configured Supabase clients in `lib/db/client.ts` (browser) and `lib/db/server.ts` (server)
- Added `lib/utils/formatters.ts` and `lib/utils/validators.ts`
- Imported documentation to `_ai/` directory for permanent reference

### Changed: Project Structure
- Established `_ai/` as the source of truth directory for documentation
