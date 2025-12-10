# SCHEMA_README.md - Database Schema Documentation

## 🎯 CRITICAL RULES

**BEFORE querying or modifying the database:**
1. ✅ Verify column names exist in this document
2. ✅ Check data types match (JSONB vs JSON, numeric vs integer)
3. ✅ Confirm foreign key relationships
4. ✅ Review constraints and validation rules

**AFTER modifying the schema:**
1. ✅ Update this document with changes
2. ✅ Update TypeScript types in /lib/types/database.ts
3. ✅ Add migration script notes
4. ✅ Update CHANGELOG.md

---

## 📊 TABLE OF CONTENTS

1. [csv_data](#csv_data) - Core residual/payout events
2. [deals](#deals) - Merchant participant assignments
3. [payouts](#payouts) - Calculated partner payments
4. [action_history](#action_history) - Audit trail and undo system
5. [debug_logs](#debug_logs) - Error tracking and debugging
6. [Relationships](#relationships)
7. [Indexes](#indexes)
8. [TypeScript Types](#typescript-types)

---

## 📋 TABLE: csv_data

**Purpose**: Stores individual residual line items from CSV uploads. Each row represents one merchant's processing data for one month. This is the source of truth for all residual/payout events.

**Table Info**:
- Schema: `public`
- Primary Key: `id` (UUID)
- Row Count: ~10,000+ (grows monthly)

### Columns

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `batch_id` | uuid | YES | NULL | Groups rows from same CSV upload |
| `merchant_name` | text | YES | NULL | DBA/business name |
| `mid` | text | YES | NULL | Merchant ID from processor |
| `volume` | numeric(12,2) | YES | 0 | Total processing volume |
| `fees` | numeric(12,2) | YES | 0 | Residual/payout amount |
| `date` | date | YES | NULL | Transaction date |
| `payout_month` | text | YES | NULL | **CRITICAL**: "YYYY-MM" format (e.g., "2025-11") |
| `assigned_agent_id` | text | YES | NULL | Airtable record ID of assigned partner |
| `assigned_agent_name` | text | YES | NULL | Partner display name |
| `deal_id` | uuid | YES | NULL | Foreign key to deals.id |
| `status` | text | YES | NULL | Legacy status field |
| `assignment_status` | text | NO | 'unassigned' | unassigned \| pending \| confirmed |
| `created_at` | timestamptz | NO | now() | Record creation time |
| `updated_at` | timestamptz | NO | now() | Last update time |
| `row_hash` | text | YES | NULL | MD5 hash for duplicate detection |
| `adjustments` | numeric(12,2) | YES | 0 | Manual adjustments |
| `chargebacks` | numeric(12,2) | YES | 0 | Chargeback amounts |
| `raw_data` | jsonb | YES | NULL | Original CSV row data |
| `is_held` | boolean | NO | false | Payment hold flag |
| `hold_reason` | text | YES | NULL | Reason for hold |
| `airtable_synced` | boolean | NO | false | Sync status to Airtable |
| `payout_type` | text | NO | 'residual' | **PRIMARY**: residual \| upfront \| trueup \| bonus \| clawback \| adjustment |
| `adjustment_type` | text | YES | NULL | clawback \| additional |
| `adjusts_payout_id` | uuid | YES | NULL | References another csv_data.id |
| `paid_at` | timestamptz | YES | NULL | When marked as paid |
| `paid_by` | uuid | YES | NULL | User UUID who marked paid |
| `paid_status` | text | NO | 'unpaid' | unpaid \| pending \| paid |

### Constraints

\`\`\`sql
-- Primary Key
CONSTRAINT csv_data_pkey PRIMARY KEY (id)

-- Unique Constraints
CONSTRAINT csv_data_row_hash_key UNIQUE (row_hash)

-- No explicit foreign keys in provided schema
-- Note: deal_id references deals.id but not enforced at DB level
-- Note: adjusts_payout_id self-references but not enforced
\`\`\`

### Indexes

\`\`\`sql
CREATE INDEX idx_csv_data_mid ON csv_data USING btree (mid);
CREATE INDEX idx_csv_data_status ON csv_data USING btree (assignment_status);
CREATE INDEX idx_csv_data_month ON csv_data USING btree (payout_month);
\`\`\`

### Common Queries

\`\`\`sql
-- Get unassigned events
SELECT * FROM csv_data 
WHERE assignment_status = 'unassigned'
ORDER BY date DESC;

-- Get events by processing month
SELECT * FROM csv_data
WHERE payout_month = '2025-11'
  AND assignment_status = 'confirmed';

-- Get events for a specific agent
SELECT * FROM csv_data
WHERE assigned_agent_id = 'recABC123'
  AND assignment_status = 'confirmed';

-- Find duplicates by hash
SELECT row_hash, COUNT(*) 
FROM csv_data 
WHERE row_hash IS NOT NULL
GROUP BY row_hash 
HAVING COUNT(*) > 1;
\`\`\`

### Important Notes

⚠️ **CRITICAL FIELDS**:
- `payout_month` is **REQUIRED** - CSV must include this field
- `payout_type` defaults to 'residual' but can be overridden
- `assignment_status` controls workflow (unassigned → pending → confirmed)
- `row_hash` prevents duplicate imports (UNIQUE constraint)

⚠️ **WORKFLOW**:
1. CSV uploaded → rows created with `assignment_status = 'unassigned'`
2. Deal assigned → status changes to `pending`
3. User confirms → status changes to `confirmed`, payouts generated
4. Payment processed → `paid_status` updated, `paid_at` timestamp set

---

## 📋 TABLE: deals

**Purpose**: Stores participant assignment configurations for each merchant account (MID). One deal can have multiple participants with different split percentages stored in JSONB.

**Table Info**:
- Schema: `public`
- Primary Key: `id` (UUID)
- Row Count: ~500-1000

### Columns

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `deal_id` | text | YES | NULL | Human-readable ID: "deal_{uuid}" |
| `mid` | text | YES | NULL | Merchant ID from processor |
| `effective_date` | date | YES | NULL | When deal became active |
| `payout_type` | text | YES | 'residual' | residual \| upfront \| trueup \| bonus \| clawback |
| `participants_json` | jsonb | NO | '[]' | **CRITICAL**: Array of participant configs |
| `assigned_agent_name` | text | YES | NULL | Primary agent display name |
| `assigned_at` | timestamptz | YES | NULL | When participants assigned |
| `partner_id` | text | YES | NULL | Legacy single partner ID (deprecated) |
| `created_by` | uuid | YES | NULL | User ID who created deal |
| `created_at` | timestamptz | NO | now() | Record creation time |
| `updated_at` | timestamptz | NO | now() | Last update time |
| `available_to_purchase` | boolean | NO | false | For future investment feature |
| `is_legacy_import` | boolean | NO | false | Flag for imported legacy data |

### Constraints

\`\`\`sql
-- Primary Key
CONSTRAINT deals_pkey PRIMARY KEY (id)

-- Unique Constraints
CONSTRAINT deals_mid_idx UNIQUE (mid)

-- No explicit foreign keys in provided schema
\`\`\`

### Indexes

\`\`\`sql
CREATE INDEX idx_deals_is_legacy_import ON deals USING btree (is_legacy_import);
CREATE INDEX idx_deals_mid ON deals USING btree (mid);
\`\`\`

### participants_json Structure

**CRITICAL**: This JSONB column stores the participant configuration array.

\`\`\`typescript
type Participant = {
  partner_airtable_id: string;  // Airtable record ID (e.g., "recABC123")
  partner_name: string;          // Display name
  partner_email: string;         // Contact email (can be empty string)
  partner_role: 'ISO' | 'Agent' | 'Sub-Agent' | 'Investor' | 'Partner' | 'Company' | 'Fund I';
  split_pct: number;             // Percentage: 0-100 (stored as decimal)
  amount?: number;               // Calculated payout (optional, computed)
}

// Example value from actual data (note: actual storage order in database):
[
  {
    "split_pct": 80.00,
    "partner_name": "Jurany Mercado",
    "partner_role": "ISO",
    "partner_email": "",
    "partner_airtable_id": "recPlMNwT6pwvkeWT"
  },
  {
    "split_pct": 20.00,
    "partner_name": "Lumino (Company)",
    "partner_role": "Company",
    "partner_email": "",
    "partner_airtable_id": "lumino-company"
  }
]
\`\`\`

### Common Queries

\`\`\`sql
-- Get deal by MID (for participant memory)
SELECT * FROM deals
WHERE mid = '912201125640'
ORDER BY created_at DESC
LIMIT 1;

-- Extract participants from JSONB
SELECT 
  deal_id,
  mid,
  jsonb_array_elements(participants_json) as participant
FROM deals
WHERE mid = '912201125640';

-- Query specific participant by Airtable ID
SELECT * FROM deals
WHERE participants_json @> '[{"partner_airtable_id": "recABC123"}]'::jsonb;

-- Count deals per participant
SELECT 
  participant->>'partner_name' as partner_name,
  COUNT(*) as deal_count
FROM deals,
  jsonb_array_elements(participants_json) as participant
GROUP BY participant->>'partner_name'
ORDER BY deal_count DESC;

-- Validate split percentages sum to 100
SELECT 
  deal_id,
  mid,
  SUM((participant->>'split_pct')::numeric) as total_split
FROM deals,
  jsonb_array_elements(participants_json) as participant
GROUP BY deal_id, mid
HAVING SUM((participant->>'split_pct')::numeric) != 100;
\`\`\`

### Important Notes

⚠️ **CRITICAL**:
- `participants_json` is the **ONLY** source of participant data
- Must be valid JSONB array format
- Each participant needs `partner_id`, `name`, `role`, `split_pct` minimum
- Split percentages should sum to 100 for proper payout calculation
- `mid` has UNIQUE constraint - only one active deal per MID

⚠️ **DEPRECATED FIELDS**:
- `partner_id` - Use `participants_json` instead (legacy single-partner field)

---

## 📋 TABLE: payouts

**Purpose**: Stores calculated per-partner payout amounts. One row per participant per event. Generated when csv_data is confirmed (assignment_status = 'confirmed').

**Table Info**:
- Schema: `public`
- Primary Key: `id` (UUID)
- Row Count: ~20,000+ (grows monthly)

### Columns

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `csv_data_id` | uuid | YES | NULL | Foreign key to csv_data.id |
| `deal_id` | text | YES | NULL | Reference to deals.deal_id (text) |
| `merchant_id` | uuid | YES | NULL | **ARTIFACT FIELD** - Not actively used, no merchants table exists |
| `payout_month` | text | YES | NULL | "YYYY-MM" format (e.g., "2025-11") |
| `payout_date` | date | YES | NULL | Expected payment date |
| `mid` | text | YES | NULL | Merchant ID |
| `merchant_name` | text | YES | NULL | Merchant display name |
| `payout_type` | text | YES | NULL | residual \| upfront \| etc |
| `volume` | numeric(12,2) | YES | 0 | Processing volume |
| `fees` | numeric(12,2) | YES | 0 | Total fees |
| `adjustments` | numeric(12,2) | YES | 0 | Manual adjustments |
| `chargebacks` | numeric(12,2) | YES | 0 | Chargeback amounts |
| `net_residual` | numeric(12,2) | YES | 0 | **Calculated**: fees - adjustments - chargebacks |
| `partner_airtable_id` | text | YES | NULL | Airtable record ID of partner |
| `partner_role` | text | YES | NULL | Partner's role |
| `partner_split_pct` | numeric(5,2) | YES | NULL | Partner's percentage |
| `partner_payout_amount` | numeric(12,2) | YES | NULL | **Calculated**: net_residual * (split_pct / 100) |
| `assignment_status` | text | YES | 'confirmed' | Always 'confirmed' (only confirmed create payouts) |
| `paid_status` | text | YES | 'unpaid' | unpaid \| pending \| paid |
| `paid_at` | timestamptz | YES | NULL | Timestamp when paid |
| `batch_id` | uuid | YES | NULL | Payment batch ID |
| `created_at` | timestamptz | YES | now() | Record creation time |
| `updated_at` | timestamptz | YES | now() | Last update time |
| `is_legacy_import` | boolean | NO | false | Flag for imported legacy data |
| `partner_name` | text | YES | NULL | Partner display name |

### Constraints

\`\`\`sql
-- Primary Key
CONSTRAINT payouts_pkey PRIMARY KEY (id)

-- Unique Constraint (one payout per partner per event)
CONSTRAINT payouts_unique_partner_payout UNIQUE (csv_data_id, partner_airtable_id)

-- Foreign Keys
CONSTRAINT payouts_csv_data_id_fkey FOREIGN KEY (csv_data_id) 
  REFERENCES csv_data(id) ON DELETE CASCADE
\`\`\`

### Indexes

\`\`\`sql
CREATE INDEX idx_payouts_partner_airtable_id ON payouts USING btree (partner_airtable_id);
CREATE INDEX idx_payouts_payout_month ON payouts USING btree (payout_month);
CREATE INDEX idx_payouts_is_legacy_import ON payouts USING btree (is_legacy_import);
CREATE INDEX idx_payouts_csv_data_id ON payouts USING btree (csv_data_id);
\`\`\`

### Payout Calculation Logic

\`\`\`sql
-- Net residual calculation
net_residual = fees - adjustments - chargebacks

-- Partner payout calculation
partner_payout_amount = net_residual * (partner_split_pct / 100)

-- Example:
-- fees = $10,000
-- adjustments = $500
-- chargebacks = $300
-- net_residual = $10,000 - $500 - $300 = $9,200
-- 
-- If partner_split_pct = 40:
-- partner_payout_amount = $9,200 * 0.40 = $3,680
\`\`\`

### Common Queries

\`\`\`sql
-- Get unpaid payouts for agent
SELECT * FROM payouts
WHERE partner_airtable_id = 'recABC123'
  AND paid_status = 'unpaid'
ORDER BY payout_month DESC;

-- Monthly summary by agent
SELECT 
  partner_airtable_id,
  partner_name,
  payout_month,
  COUNT(DISTINCT mid) as merchant_count,
  SUM(partner_payout_amount) as total_payout,
  COUNT(*) as event_count
FROM payouts
WHERE payout_month = '2025-11'
GROUP BY partner_airtable_id, partner_name, payout_month;

-- Agent totals across all months
SELECT 
  partner_airtable_id,
  partner_name,
  COUNT(DISTINCT mid) as unique_merchants,
  SUM(partner_payout_amount) as total_earned,
  COUNT(CASE WHEN paid_status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN paid_status = 'unpaid' THEN 1 END) as unpaid_count
FROM payouts
GROUP BY partner_airtable_id, partner_name
ORDER BY total_earned DESC;

-- Payouts with source event details
SELECT 
  p.*,
  cd.date as transaction_date,
  cd.batch_id,
  cd.is_held
FROM payouts p
JOIN csv_data cd ON p.csv_data_id = cd.id
WHERE p.partner_airtable_id = 'recABC123'
ORDER BY cd.date DESC;
\`\`\`

### Important Notes

⚠️ **CRITICAL**:
- Payouts are **automatically generated** when csv_data.assignment_status = 'confirmed'
- One payout row per participant per csv_data event
- UNIQUE constraint on (csv_data_id, partner_airtable_id) prevents duplicates
- CASCADE DELETE: If csv_data is deleted, all related payouts are deleted

⚠️ **CALCULATION NOTES**:
- `net_residual` = fees - adjustments - chargebacks (NOT volume-based)
- `partner_payout_amount` = net_residual * (split_pct / 100)
- Verify split percentages sum to 100 in deals.participants_json

---

## 📋 TABLE: action_history

**Purpose**: Tracks all user actions for audit trail and undo functionality. Stores before/after snapshots enabling full undo capability.

**Table Info**:
- Schema: `public`
- Primary Key: `id` (UUID)
- Row Count: Grows with usage

### Columns

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `action_type` | text | NO | - | create \| update \| delete \| bulk_update \| import \| sync \| undo |
| `entity_type` | text | NO | - | deal \| participant \| payout \| assignment \| event \| merchant \| settings |
| `entity_id` | text | YES | NULL | ID of affected record |
| `entity_name` | text | YES | NULL | Human-readable name (merchant, participant name) |
| `previous_data` | jsonb | YES | NULL | Snapshot before change (for undo) |
| `new_data` | jsonb | YES | NULL | Snapshot after change |
| `description` | text | YES | NULL | Human-readable description of action |
| `user_id` | uuid | YES | NULL | User who performed action |
| `batch_id` | uuid | YES | NULL | Groups related actions together |
| `request_id` | text | YES | NULL | Correlates with debug_logs for error tracing |
| `is_undone` | boolean | NO | false | Whether action was undone |
| `undone_at` | timestamptz | YES | NULL | When action was undone |
| `undo_action_id` | uuid | YES | NULL | Reference to the undo action |
| `created_at` | timestamptz | NO | now() | When action occurred |

### Indexes

\`\`\`sql
CREATE INDEX idx_action_history_entity ON action_history(entity_type, entity_id);
CREATE INDEX idx_action_history_user ON action_history(user_id);
CREATE INDEX idx_action_history_created ON action_history(created_at DESC);
CREATE INDEX idx_action_history_batch ON action_history(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_action_history_undoable ON action_history(entity_type, entity_id, is_undone) WHERE is_undone = false;
CREATE INDEX idx_action_history_request_id ON action_history(request_id) WHERE request_id IS NOT NULL;
\`\`\`

### Common Queries

\`\`\`sql
-- Get recent actions
SELECT * FROM action_history 
ORDER BY created_at DESC 
LIMIT 50;

-- Get actions for specific entity
SELECT * FROM action_history 
WHERE entity_type = 'deal' AND entity_id = 'deal_abc123'
ORDER BY created_at DESC;

-- Get undoable actions
SELECT * FROM action_history 
WHERE is_undone = false AND previous_data IS NOT NULL
ORDER BY created_at DESC;

-- Correlate actions with errors (using request_id)
SELECT ah.*, dl.message as error_message, dl.level
FROM action_history ah
JOIN debug_logs dl ON ah.request_id = dl.request_id
WHERE dl.level = 'error'
ORDER BY ah.created_at DESC;
\`\`\`

---

## 📋 TABLE: debug_logs

**Purpose**: Stores debug entries, errors, and system events for troubleshooting. Includes request correlation for tracing issues.

**Table Info**:
- Schema: `public`
- Primary Key: `id` (UUID)
- Row Count: Grows with usage, can be pruned

### Columns

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `id` | uuid | NO | gen_random_uuid() | Primary key |
| `level` | text | NO | 'info' | debug \| info \| warn \| error \| fatal |
| `source` | text | YES | NULL | api \| sync \| import \| client \| cron \| webhook |
| `message` | text | NO | - | Log message |
| `metadata` | jsonb | YES | NULL | Additional context (stack trace, request data) |
| `request_id` | text | YES | NULL | Correlates logs from same request |
| `user_id` | uuid | YES | NULL | User associated with log |
| `created_at` | timestamptz | NO | now() | When logged |

### Indexes

\`\`\`sql
CREATE INDEX idx_debug_logs_level ON debug_logs(level);
CREATE INDEX idx_debug_logs_source ON debug_logs(source);
CREATE INDEX idx_debug_logs_created ON debug_logs(created_at DESC);
CREATE INDEX idx_debug_logs_request ON debug_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_debug_logs_errors ON debug_logs(created_at DESC) WHERE level IN ('error', 'fatal');
\`\`\`

### Cleanup Function

\`\`\`sql
-- Delete old non-error logs (keeps error/fatal forever)
SELECT cleanup_old_debug_logs(30); -- Delete logs older than 30 days
\`\`\`

### Common Queries

\`\`\`sql
-- Get recent errors
SELECT * FROM debug_logs 
WHERE level IN ('error', 'fatal')
ORDER BY created_at DESC 
LIMIT 50;

-- Get all logs for a request (for debugging)
SELECT * FROM debug_logs 
WHERE request_id = 'req_abc123'
ORDER BY created_at ASC;

-- Get logs with related actions
SELECT dl.*, ah.action_type, ah.entity_type, ah.description
FROM debug_logs dl
LEFT JOIN action_history ah ON dl.request_id = ah.request_id
WHERE dl.level = 'error'
ORDER BY dl.created_at DESC;
\`\`\`

---

## 🔗 RELATIONSHIPS

### Entity Relationship Diagram

\`\`\`
┌─────────────┐
│  csv_data   │ (source events)
└──────┬──────┘
       │
       │ deal_id (not enforced FK)
       │
       ▼
┌─────────────┐
│   deals     │ (participant assignments)
└──────┬──────┘
       │
       │ mid UNIQUE
       │
       ▼
┌─────────────┐
│   payouts   │ (calculated payments)
└─────────────┘
       │
       │ csv_data_id FK CASCADE
       │
       ▼
┌─────────────┐
│  csv_data   │
└─────────────┘
\`\`\`

### Relationship Details

**csv_data ←→ deals** (Logical Many-to-One)
- Each csv_data event references one deal
- One deal can have many events (monthly processing)
- Linked via: `csv_data.deal_id → deals.id` (NOT enforced as FK)
- Also linked via: `csv_data.mid → deals.mid` (UNIQUE constraint on deals.mid)

**csv_data ←→ payouts** (One-to-Many with CASCADE)
- One csv_data event creates multiple payouts (one per participant)
- One payout belongs to exactly one csv_data event
- **Enforced FK**: `payouts.csv_data_id → csv_data.id ON DELETE CASCADE`
- UNIQUE constraint: (csv_data_id, partner_airtable_id)

**deals ←→ External Partners** (via JSONB)
- deals.participants_json contains Airtable partner IDs
- No database-level relationship (external system)
- Linked via: `deals.participants_json[].partner_airtable_id → Airtable recXXX`
- Linked via: `payouts.partner_airtable_id → Airtable recXXX`

**Important Note on merchant_id**:
- The `payouts.merchant_id` field exists but is NOT used
- No merchants table exists in the database
- This is an artifact/legacy field from early development
- Use `mid` (text) for all merchant identification

### Data Flow

\`\`\`
1. CSV Upload
   ↓
2. csv_data rows created (assignment_status = 'unassigned')
   ↓
3. Deal assigned (mid lookup in deals table)
   csv_data.deal_id = deals.id
   csv_data.assignment_status = 'pending'
   ↓
4. User confirms assignment
   csv_data.assignment_status = 'confirmed'
   ↓
5. Payouts generated (trigger or manual)
   For each participant in deals.participants_json:
   - Create payout row
   - Calculate partner_payout_amount
   - Link via csv_data_id
   ↓
6. Payment processing
   Update payouts.paid_status = 'paid'
   Set payouts.paid_at timestamp
\`\`\`

---

## 📇 INDEXES

### Performance-Critical Indexes

\`\`\`sql
-- csv_data table
CREATE INDEX idx_csv_data_mid ON csv_data(mid);
CREATE INDEX idx_csv_data_status ON csv_data(assignment_status);
CREATE INDEX idx_csv_data_month ON csv_data(payout_month);

-- deals table
CREATE INDEX idx_deals_mid ON deals(mid);
CREATE INDEX idx_deals_is_legacy_import ON deals(is_legacy_import);

-- payouts table
CREATE INDEX idx_payouts_partner_airtable_id ON payouts(partner_airtable_id);
CREATE INDEX idx_payouts_payout_month ON payouts(payout_month);
CREATE INDEX idx_payouts_is_legacy_import ON payouts(is_legacy_import);
CREATE INDEX idx_payouts_csv_data_id ON payouts(csv_data_id);
\`\`\`

### Suggested Additional Indexes

\`\`\`sql
-- For assignment workflow queries
CREATE INDEX idx_csv_data_assigned_agent ON csv_data(assigned_agent_id) 
  WHERE assignment_status = 'confirmed';

-- For sync monitoring
CREATE INDEX idx_csv_data_sync_status ON csv_data(airtable_synced)
  WHERE airtable_synced = false;

-- For payment tracking
CREATE INDEX idx_payouts_paid_status ON payouts(paid_status)
  WHERE paid_status = 'unpaid';

-- For batch processing
CREATE INDEX idx_csv_data_batch_id ON csv_data(batch_id)
  WHERE batch_id IS NOT NULL;

-- For date-based queries
CREATE INDEX idx_csv_data_date ON csv_data(date)
  WHERE date IS NOT NULL;

-- For hold management
CREATE INDEX idx_csv_data_held ON csv_data(is_held)
  WHERE is_held = true;
\`\`\`

---

## ⚠️ CRITICAL: JSONB HANDLING

### participants_json Parsing

**IMPORTANT**: The `deals.participants_json` field is stored as JSONB in the database but **returns as a JSON string** in query results.

\`\`\`typescript
// ❌ WRONG - Will fail at runtime
const deal = await supabase.from('deals').select('*').single();
const firstParticipant = deal.participants_json[0]; // ERROR: undefined

// ✅ CORRECT - Must parse first
const deal = await supabase.from('deals').select('*').single();
const participants = JSON.parse(deal.participants_json);
const firstParticipant = participants[0]; // Works!
\`\`\`

**Storage vs Query Behavior**:
- **Database**: Stored as `jsonb` type
- **Query Result**: Returns as JSON string (needs parsing)
- **Must Do**: Always `JSON.parse()` before accessing array elements

### raw_data Handling

The `csv_data.raw_data` field contains the original CSV row data with some quirks:

\`\`\`typescript
// Database stores as JSONB
raw_data: {
  "mid": "496173250887",
  "date": "",           // ⚠️ Empty string, not null
  "fees": "727.96",     // ⚠️ String, not number
  "volume": "",         // ⚠️ Empty string, not null
  "merchant_name": "Venezuelatogo"
}

// Query with JSONB operators
SELECT raw_data->>'merchant_name' as merchant_name
FROM csv_data
WHERE raw_data->>'mid' = '496173250887';
\`\`\`

**Key Points**:
- Empty CSV fields become empty strings (`""`), not NULL
- Numeric values stored as strings in raw_data
- Use `raw_data->>'field'` for text extraction
- Use `(raw_data->>'field')::numeric` for number conversion

### merchant_id Field Note

The `payouts.merchant_id` field exists in the schema but is **NOT actively used**:

**Current State**:
- Field exists as UUID type in payouts table
- NOT linked to any merchants table (no merchants table exists)
- Appears to be a legacy/artifact field from early development
- Can contain values but has no functional purpose

**What to Use Instead**:
- Use `payouts.mid` (text) for merchant identification
- Use `payouts.merchant_name` (text) for display purposes
- MID is the primary merchant identifier throughout the system

---

## 🔤 TYPESCRIPT TYPES

### Core Types

\`\`\`typescript
// /lib/types/database.ts

export type AssignmentStatus = 'unassigned' | 'pending' | 'confirmed';
export type PaidStatus = 'unpaid' | 'pending' | 'paid';
export type PayoutType = 'residual' | 'upfront' | 'trueup' | 'bonus' | 'clawback' | 'adjustment';
export type AdjustmentType = 'clawback' | 'additional';
export type PartnerRole = 'ISO' | 'Agent' | 'Sub-Agent' | 'Investor' | 'Partner' | 'Company' | 'Fund I';

// Participant structure in deals.participants_json
export interface DealParticipant {
  partner_airtable_id: string;  // Airtable record ID
  partner_name: string;
  partner_email: string;         // Can be empty string
  partner_role: PartnerRole;
  split_pct: number;             // 0-100 (stored as decimal)
  amount?: number;               // Calculated, optional
}

// csv_data table
export interface CsvData {
  id: string;
  batch_id: string | null;
  merchant_name: string | null;
  mid: string | null;
  volume: number | null;
  fees: number | null;
  date: string | null;       // ISO date string
  payout_month: string | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  deal_id: string | null;
  status: string | null;
  assignment_status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  row_hash: string | null;
  adjustments: number;
  chargebacks: number;
  raw_data: Record<string, any> | null;
  is_held: boolean;
  hold_reason: string | null;
  airtable_synced: boolean;
  payout_type: PayoutType;
  adjustment_type: AdjustmentType | null;
  adjusts_payout_id: string | null;
  paid_at: string | null;
  paid_by: string | null;
  paid_status: PaidStatus;
}

// deals table
export interface Deal {
  id: string;
  deal_id: string | null;
  mid: string | null;
  effective_date: string | null;
  payout_type: PayoutType | null;
  participants_json: string;  // ⚠️ Returns as JSON string from database - use parseDeal() helper
  assigned_agent_name: string | null;
  assigned_at: string | null;
  partner_id: string | null; // DEPRECATED
  created_by: string | null;
  created_at: string;
  updated_at: string;
  available_to_purchase: boolean;
  is_legacy_import: boolean;
}

// Parsed version for use in application code
export interface DealParsed extends Omit<Deal, 'participants_json'> {
  participants_json: DealParticipant[];  // Parsed array
}

// Helper function to safely parse deals
export function parseDeal(deal: Deal): DealParsed {
  return {
    ...deal,
    participants_json: typeof deal.participants_json === 'string' 
      ? JSON.parse(deal.participants_json)
      : deal.participants_json
  };
}

// Batch parse helper
export function parseDeals(deals: Deal[]): DealParsed[] {
  return deals.map(parseDeal);
}

// payouts table
export interface Payout {
  id: string;
  csv_data_id: string | null;
  deal_id: string | null;
  merchant_id: string | null;
  payout_month: string | null;
  payout_date: string | null;
  mid: string | null;
  merchant_name: string | null;
  payout_type: PayoutType | null;
  volume: number;
  fees: number;
  adjustments: number;
  chargebacks: number;
  net_residual: number;
  partner_airtable_id: string | null;
  partner_role: string | null;
  partner_split_pct: number | null;
  partner_payout_amount: number | null;
  assignment_status: AssignmentStatus | null;
  paid_status: PaidStatus;
  paid_at: string | null;
  batch_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_legacy_import: boolean;
  partner_name: string | null;
}

// Useful computed types
export interface CsvDataWithDeal extends CsvData {
  deal: Deal | null;
}

export interface PayoutWithSource extends Payout {
  csv_data: CsvData | null;
}

export interface PartnerSummary {
  partner_airtable_id: string;
  partner_name: string;
  merchant_count: number;
  total_payout: number;
  paid_count: number;
  unpaid_count: number;
  events: Payout[];
}

export interface MonthlySummary {
  month: string;
  total_volume: number;
  total_fees: number;
  total_payouts: number;
  merchant_count: number;
  event_count: number;
  by_partner: PartnerSummary[];
}
\`\`\`

### TypeScript Usage Examples

\`\`\`typescript
// Example 1: Fetching and parsing deals
async function getDealByMid(mid: string): Promise<DealParsed | null> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('mid', mid)
    .single();
  
  if (error || !data) return null;
  
  return parseDeal(data as Deal);
}

// Example 2: Working with participants
async function getPartnersForDeal(mid: string): Promise<DealParticipant[]> {
  const deal = await getDealByMid(mid);
  if (!deal) return [];
  
  return deal.participants_json; // Already parsed by helper
}

// Example 3: Calculating total split
function validateSplitPercentages(deal: DealParsed): boolean {
  const total = deal.participants_json.reduce(
    (sum, p) => sum + p.split_pct, 
    0
  );
  return Math.abs(total - 100) < 0.01; // Allow for floating point errors
}

// Example 4: Accessing raw_data safely
interface RawCsvData {
  mid?: string;
  date?: string;
  fees?: string;
  volume?: string;
  merchant_name?: string;
}

function parseRawData(csvData: CsvData): RawCsvData {
  if (typeof csvData.raw_data === 'string') {
    return JSON.parse(csvData.raw_data);
  }
  return csvData.raw_data as RawCsvData;
}

// Example 5: Type-safe payout calculations
function calculatePartnerPayout(
  netResidual: number,
  participant: DealParticipant
): number {
  return Number((netResidual * (participant.split_pct / 100)).toFixed(2));
}
\`\`\`

---

## 🔍 QUERY PATTERNS

### Common Join Patterns

\`\`\`sql
-- Events with Deal Info
SELECT 
  cd.*,
  d.deal_id,
  d.participants_json,
  d.payout_type as deal_payout_type
FROM csv_data cd
LEFT JOIN deals d ON cd.deal_id = d.id
WHERE cd.assignment_status = 'confirmed';

-- Payouts with Source Event
SELECT 
  p.*,
  cd.merchant_name,
  cd.date as transaction_date,
  cd.batch_id,
  cd.is_held
FROM payouts p
JOIN csv_data cd ON p.csv_data_id = cd.id
WHERE p.partner_airtable_id = 'recABC123';

-- Complete Payout Chain
SELECT 
  p.id as payout_id,
  p.partner_name,
  p.partner_payout_amount,
  p.paid_status,
  cd.merchant_name,
  cd.payout_month,
  cd.fees,
  d.participants_json
FROM payouts p
JOIN csv_data cd ON p.csv_data_id = cd.id
LEFT JOIN deals d ON cd.deal_id = d.id
WHERE p.partner_airtable_id = 'recABC123'
ORDER BY cd.payout_month DESC, cd.date DESC;
\`\`\`

### JSONB Query Patterns

\`\`\`sql
-- Find deals with specific participant
SELECT * FROM deals
WHERE participants_json @> '[{"partner_id": "recABC123"}]'::jsonb;

-- Extract all participant names from a deal
SELECT 
  deal_id,
  mid,
  jsonb_array_elements(participants_json)->>'partner_name' as participant_name,
  jsonb_array_elements(participants_json)->>'split_pct' as split_pct
FROM deals
WHERE mid = '912201125640';

-- Find all deals for a partner
SELECT 
  d.deal_id,
  d.mid,
  participant->>'partner_name' as partner_name,
  participant->>'split_pct' as split_pct,
  participant->>'partner_role' as role
FROM deals d,
  jsonb_array_elements(d.participants_json) as participant
WHERE participant->>'partner_airtable_id' = 'recABC123';

-- Validate split percentages
SELECT 
  deal_id,
  mid,
  SUM((participant->>'split_pct')::numeric) as total_split
FROM deals,
  jsonb_array_elements(participants_json) as participant
GROUP BY deal_id, mid
HAVING SUM((participant->>'split_pct')::numeric) != 100;
\`\`\`

### Aggregation Patterns

\`\`\`sql
-- Monthly summary by partner
SELECT 
  p.partner_airtable_id,
  p.partner_name,
  p.payout_month,
  COUNT(DISTINCT p.mid) as merchant_count,
  SUM(p.partner_payout_amount) as total_payout,
  SUM(p.volume) as total_volume,
  SUM(p.fees) as total_fees,
  COUNT(*) as event_count,
  COUNT(CASE WHEN p.paid_status = 'paid' THEN 1 END) as paid_count,
  COUNT(CASE WHEN p.paid_status = 'unpaid' THEN 1 END) as unpaid_count
FROM payouts p
WHERE p.payout_month = '2025-11'
GROUP BY p.partner_airtable_id, p.partner_name, p.payout_month
ORDER BY total_payout DESC;

-- Partner performance across all time
SELECT 
  p.partner_airtable_id,
  p.partner_name,
  COUNT(DISTINCT p.payout_month) as months_active,
  COUNT(DISTINCT p.mid) as unique_merchants,
  SUM(p.partner_payout_amount) as lifetime_earnings,
  AVG(p.partner_payout_amount) as avg_payout,
  MAX(p.partner_payout_amount) as max_payout,
  MIN(p.created_at) as first_payout_date,
  MAX(p.created_at) as last_payout_date
FROM payouts p
GROUP BY p.partner_airtable_id, p.partner_name
ORDER BY lifetime_earnings DESC;

-- Unassigned events summary
SELECT 
  cd.payout_month,
  COUNT(*) as unassigned_count,
  SUM(cd.fees) as total_fees,
  COUNT(DISTINCT cd.mid) as unique_merchants
FROM csv_data cd
WHERE cd.assignment_status = 'unassigned'
GROUP BY cd.payout_month
ORDER BY cd.payout_month DESC;
\`\`\`

---

## 🚨 SCHEMA VALIDATION

### Pre-Query Checklist

\`\`\`typescript
// Column validation functions
const VALID_CSV_DATA_COLUMNS = [
  'id', 'batch_id', 'merchant_name', 'mid', 'volume', 'fees',
  'date', 'payout_month', 'assigned_agent_id', 'assigned_agent_name',
  'deal_id', 'status', 'assignment_status', 'created_at', 'updated_at',
  'row_hash', 'adjustments', 'chargebacks', 'raw_data', 'is_held',
  'hold_reason', 'airtable_synced', 'payout_type', 'adjustment_type',
  'adjusts_payout_id', 'paid_at', 'paid_by', 'paid_status'
];

const VALID_DEALS_COLUMNS = [
  'id', 'deal_id', 'mid', 'effective_date', 'payout_type',
  'participants_json', 'assigned_agent_name', 'assigned_at',
  'partner_id', 'created_by', 'created_at', 'updated_at',
  'available_to_purchase', 'is_legacy_import'
];

const VALID_PAYOUTS_COLUMNS = [
  'id', 'csv_data_id', 'deal_id', 'merchant_id', 'payout_month',
  'payout_date', 'mid', 'merchant_name', 'payout_type', 'volume',
  'fees', 'adjustments', 'chargebacks', 'net_residual',
  'partner_airtable_id', 'partner_role', 'partner_split_pct',
  'partner_payout_amount', 'assignment_status', 'paid_status',
  'paid_at', 'batch_id', 'created_at', 'updated_at',
  'is_legacy_import', 'partner_name'
];

function validateColumn(table: string, column: string): boolean {
  const validColumns = {
    csv_data: VALID_CSV_DATA_COLUMNS,
    deals: VALID_DEALS_COLUMNS,
    payouts: VALID_PAYOUTS_COLUMNS
  };
  
  if (!validColumns[table]) {
    throw new Error(`Unknown table: ${table}`);
  }
  
  if (!validColumns[table].includes(column)) {
    throw new Error(`Invalid column: ${column} does not exist on ${table}`);
  }
  
  return true;
}
\`\`\`

### Common Schema Errors to Avoid

❌ **WRONG**:
\`\`\`sql
-- Assuming columns exist
SELECT agent_name FROM deals;           -- Column doesn't exist!
SELECT participants FROM deals;         -- Should be participants_json
SELECT plan FROM csv_data;              -- plan doesn't exist on csv_data
SELECT volume FROM payouts WHERE volume > 10000;  -- volume is numeric(12,2), not integer
\`\`\`

✅ **CORRECT**:
\`\`\`sql
-- Always check SCHEMA_README first
SELECT assigned_agent_name FROM deals;
SELECT participants_json FROM deals;
SELECT payout_type FROM csv_data;
SELECT * FROM payouts WHERE volume > 10000.00;  -- Use decimal notation
\`\`\`

---

## 📝 NOTES & BEST PRACTICES

### Data Integrity Rules

1. **Split Percentage Validation**: Ensure participants_json split_pct values sum to 100
2. **Unique Constraints**: 
   - csv_data.row_hash must be unique (prevents duplicate imports)
   - deals.mid must be unique (one deal per merchant)
   - payouts (csv_data_id, partner_airtable_id) must be unique
3. **Cascade Deletes**: Deleting csv_data will CASCADE delete all related payouts
4. **Assignment Workflow**: Always follow unassigned → pending → confirmed

### Performance Tips

1. Always filter by indexed columns (mid, payout_month, partner_airtable_id)
2. Use EXPLAIN ANALYZE to verify index usage
3. Consider adding composite indexes for frequently combined filters
4. Use JSONB operators (@>, ->, ->>) efficiently for participants_json queries

### Security Considerations

1. Always use parameterized queries to prevent SQL injection
2. Validate payout calculations before committing
3. Log all paid_status changes with paid_by user ID
4. Implement row-level security (RLS) if using Supabase auth

---

**Last Updated**: 2025-11-26  
**Schema Version**: 1.0  
**Database**: Supabase PostgreSQL  
**Maintained By**: Andrew Richard (Creative Systems Architect, Lumino Technologies)
