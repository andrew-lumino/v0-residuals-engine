# Database Schema Documentation

## IMPORTANT: Read this before EVERY prompt involving database operations

This document describes the ACTUAL database schema. Never assume or hallucinate table names or columns.

---

## Tables

### 1. csv_data
Raw uploaded CSV events that need to be assigned to deals.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| batch_id | uuid | Upload batch identifier |
| merchant_name | text | Merchant name from CSV |
| mid | text | Merchant ID |
| volume | numeric | Transaction volume |
| fees | numeric | Fees amount |
| date | date | Event date |
| payout_month | text | Format: "YYYY-MM" |
| assigned_agent_id | uuid | Assigned agent (nullable) |
| assigned_agent_name | text | Agent name (nullable) |
| deal_id | text | Linked deal ID (nullable) |
| status | text | Processing status |
| assignment_status | text | "unassigned", "pending", "confirmed" |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |
| row_hash | text | Deduplication hash |
| adjustments | numeric | Adjustment amount |
| chargebacks | numeric | Chargeback amount |
| raw_data | jsonb | Original CSV row data |
| is_held | boolean | Whether event is held |
| hold_reason | text | Reason for hold |
| airtable_synced | boolean | Sync status |
| payout_type | text | "residual", "clawback", etc. |
| adjustment_type | text | Type of adjustment |
| adjusts_payout_id | uuid | Links to adjusted payout |
| paid_at | timestamptz | Payment timestamp |
| paid_by | text | Who paid |
| paid_status | text | "unpaid", "paid" |

### 2. deals
Merchant deals with participant assignments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| deal_id | text | Unique deal identifier |
| mid | text | Merchant ID (unique) |
| effective_date | date | Deal effective date |
| payout_type | text | Default: "residual" |
| participants_json | jsonb | Array of participants (see below) |
| assigned_agent_name | text | Agent name |
| assigned_at | timestamptz | Assignment timestamp |
| partner_id | text | Partner ID |
| created_by | uuid | Creator user ID |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |
| available_to_purchase | boolean | Purchase availability |
| is_legacy_import | boolean | Legacy import flag |

**participants_json structure:**
\`\`\`json
[
  {
    "split_pct": 50,
    "partner_name": "Lumino (Company)",
    "partner_role": "Company",
    "partner_email": "",
    "partner_airtable_id": "lumino-company"
  },
  {
    "split_pct": 50,
    "partner_name": "John Doe",
    "partner_role": "Partner",
    "partner_email": "john@example.com",
    "partner_airtable_id": "recXXXXXXXXXXXXXX"
  }
]
\`\`\`

### 3. payouts
Individual payout records per partner per event.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| csv_data_id | uuid | Foreign key to csv_data |
| deal_id | text | Deal identifier |
| payout_month | text | Format: "YYYY-MM" |
| payout_date | date | Payout date |
| mid | text | Merchant ID |
| merchant_name | text | Merchant name |
| payout_type | text | "residual", "clawback", etc. |
| volume | numeric | Transaction volume |
| fees | numeric | Fees amount |
| adjustments | numeric | Adjustments |
| chargebacks | numeric | Chargebacks |
| net_residual | numeric | Net residual amount |
| partner_airtable_id | text | Airtable record ID |
| partner_role | text | "Company", "Partner" |
| partner_split_pct | numeric | Split percentage |
| partner_payout_amount | numeric | Calculated payout |
| partner_name | text | Partner name |
| assignment_status | text | "pending", "confirmed" |
| paid_status | text | "unpaid", "paid" |
| paid_at | timestamptz | Payment timestamp |
| batch_id | uuid | Batch identifier |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |
| is_legacy_import | boolean | Legacy import flag |

### 4. partner_sync
Cache of partner data from Airtable.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| airtable_record_id | text | Airtable record ID (unique) |
| name | text | Partner name |
| email | text | Partner email |
| role | text | Partner role |
| default_payout_type | text | Default: "residual" |
| default_split_pct | numeric(5,2) | Default split |
| last_synced_at | timestamptz | Last sync time |
| created_at | timestamptz | Created timestamp |
| updated_at | timestamptz | Updated timestamp |
| is_active | boolean | Active status |
| notes | text | Notes |

---

## Key Relationships

1. **csv_data** → events that need assignment
2. **deals** → merchant + participants configuration (one per MID)
3. **payouts** → created from csv_data when assigned, one per participant
4. **partner_sync** → cache of Airtable partner data

## Deletion Rules

- **Delete a DEAL** → Deletes all related payouts, resets csv_data to 'unassigned'
- **Individual payout deletion** → NOT ALLOWED (must delete the deal instead)

## Special Values

- **Company Airtable ID**: `lumino-company` (hardcoded, not from Airtable)
- **Company Name**: `Lumino (Company)`

## REMOVED Tables

- **merchants** - REMOVED. Use `mid` directly on deals and csv_data instead.

## NEVER

- Never assume tables exist that are not listed here
- Never use JOINs when simple queries work
- Never hallucinate column names
- Always check this file before database operations
