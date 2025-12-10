# AI_README.md - Residuals Engine System Documentation

## 🎯 CRITICAL INSTRUCTIONS FOR AI ASSISTANTS

**BEFORE MAKING ANY CODE CHANGES:**
1. ✅ Read this AI_README.md completely
2. ✅ Check SCHEMA_README.md for exact table/column names
3. ✅ Review recent CHANGELOG.md entries for context
4. ✅ Verify you're using correct database client (Supabase)

**AFTER MAKING ANY CODE CHANGES:**
1. ✅ Update CHANGELOG.md with date, component, and brief description (newest on top)
2. ✅ Update SCHEMA_README.md if database structure changed
3. ✅ Update this AI_README.md if architecture/flow changed

**NEVER:**
- ❌ Assume column names exist - always check SCHEMA_README.md first
- ❌ Create files longer than 300 lines - break into smaller components
- ❌ Return 200 OK status for failed operations
- ❌ Update one table without updating related tables
- ❌ Guess at database structure - verify first

---

## 📖 SYSTEM OVERVIEW

### Purpose
The Residuals Engine processes monthly merchant payment data, assigns payouts to partners (ISOs, Agents, Investors), calculates splits, and generates payment reports. It bridges CSV data uploads with Airtable partner management.

### Core Workflow
\`\`\`
1. CSV Upload → Parse & Validate
2. Create Events → Store in csv_data table
3. Assign Participants → Create deals with participants_json
4. Confirm Assignment → Generate payout rows
5. Process Payments → Mark as paid, sync to Airtable
6. Generate Reports → Export summaries by agent/month
\`\`\`

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **UI**: shadcn/ui components, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **External**: Airtable API (for partner sync)

---

## 🏗️ SYSTEM ARCHITECTURE

### Data Flow Architecture

\`\`\`
┌─────────────────┐
│   CSV Upload    │
│  (Processing    │
│     Month)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   csv_data      │◄──────┐
│   (Events)      │       │
│  - volume       │       │
│  - fees         │       │
│  - payout_month │       │
│  - payout_type  │       │
│  - status       │       │
└────────┬────────┘       │
         │                │
         │ (assignment)   │
         ▼                │
┌─────────────────┐       │
│     deals       │       │
│  - deal_id      │       │
│  - mid          │       │
│  - participants │       │
│    _json        │       │
└────────┬────────┘       │
         │                │
         │ (confirmation) │
         ▼                │
┌─────────────────┐       │
│    payouts      │       │
│  - per partner  │       │
│  - split calcs  │       │
│  - paid_status  │───────┘
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   Airtable      │
│   Sync          │
└─────────────────┘
\`\`\`

### Component Architecture

\`\`\`
/app
  /api
    /residuals
      /upload - CSV processing
      /events - Event management
      /deals - Deal creation/updates
      /participants - Partner queries
      /payouts - Payout calculations
      /sync - Airtable sync

/components
  /residuals
    /upload
      - UploadForm.tsx (< 200 lines)
      - FileAnalyzer.tsx (< 150 lines)
    /events
      - EventsTable.tsx (< 250 lines)
      - EventFilters.tsx (< 100 lines)
      - EventTabs.tsx (< 150 lines)
      - AssignmentModal.tsx (< 300 lines)
    /participants
      - ParticipantsTable.tsx (< 250 lines)
      - ParticipantDetails.tsx (< 200 lines)
      - ExportButton.tsx (< 100 lines)
    /payouts
      - PayoutsSummary.tsx (< 150 lines)
      - PayoutsTable.tsx (< 300 lines)
      - PayoutActions.tsx (< 150 lines)
      - ExportPayouts.tsx (< 200 lines)
    /shared
      - DataTable.tsx (< 200 lines)
      - StatusBadge.tsx (< 50 lines)
      - MoneyDisplay.tsx (< 50 lines)
      - DateRangePicker.tsx (< 100 lines)

/lib
  /db
    - client.ts (database connection)
    - queries.ts (reusable queries)
  /utils
    - formatters.ts (money, date formatting)
    - validators.ts (CSV validation)
  /types
    - database.ts (TypeScript types from schema)
\`\`\`

---

## 🔄 DETAILED DATA FLOW

### 1. CSV Upload Flow

**Input**: CSV file with columns
- Merchant ID (MID)
- Merchant Name
- Volume (processing volume)
- Payouts (fees/residuals)
- Date (transaction date)
- Processing Month (e.g., "September 2025")

**Process**:
1. Parse CSV rows
2. Validate required fields
3. Calculate row hash (for duplicate detection)
4. Create batch_id (UUID for this upload)
5. Insert into `csv_data` table with status='unassigned'

**Output**: Unassigned events ready for participant assignment

### 2. Assignment Flow

**Trigger**: User selects event(s) and assigns participants

**Process**:
1. Check if MID exists in `deals` table
   - If exists: Load previous participants as suggestion
   - If new: Require manual participant selection

2. User configures participants:
   - Select partner from `partner_sync` table
   - Assign role (ISO, Agent, Sub-Agent, Investor)
   - Set split percentage
   - Set payout type (residual, upfront, trueup, bonus, clawback)

3. Create or update `deals` record:
   \`\`\`typescript
   {
     deal_id: 'deal_' + uuid,
     mid: '912201125640',
     merchant_id: uuid,
     participants_json: [
       {
         partner_id: 'airtable_rec123',
         name: 'Kevin Scoggin',
         email: 'kevinjscoggin@gmail.com',
         role: 'Partner',
         split_pct: 40,
         amount: 3599.39
       },
       // ... more participants
     ],
     payout_type: 'residual',
     assigned_agent_name: 'Kevin Scoggin',
     partner_id: uuid
   }
   \`\`\`

4. Update `csv_data` record:
   - assignment_status: 'pending'
   - deal_id: reference to deals.id
   - assigned_agent_id: partner's airtable_record_id
   - assigned_agent_name: partner's name

**Output**: Event moves to "Pending Confirmation" tab

### 3. Confirmation Flow

**Trigger**: User reviews and confirms assignment

**Process**:
1. Update `csv_data`:
   - assignment_status: 'confirmed'

2. For each participant in deal.participants_json:
   - Calculate net_residual: volume - fees - adjustments - chargebacks
   - Calculate partner_payout_amount: net_residual * (split_pct / 100)
   - Insert into `payouts` table

**Output**: Individual payout rows per partner

### 4. Payment Processing

**Trigger**: User marks payouts as paid

**Process**:
1. Update `payouts` records:
   - paid_status: 'paid'
   - paid_at: current timestamp

2. Sync to Airtable:
   - Update partner's monthly earnings
   - Link to Airtable Payouts table

**Output**: Completed payments tracked in both systems

---

## 🗄️ DATABASE RELATIONSHIPS

### Primary Tables

\`\`\`
csv_data (events/line items)
  ├── batch_id → groups uploads
  ├── deal_id → deals.id
  └── assigned_agent_id → partner_sync.airtable_record_id

deals (participant assignments)
  ├── merchant_id → merchants.id
  ├── partner_id → partners.id (deprecated, use participants_json)
  └── participants_json → array of partner configs

merchants (merchant profiles)
  ├── merchant_id (unique identifier)
  └── mid → payment processor MID

partner_sync (Airtable bridge)
  ├── airtable_record_id (unique, from Airtable)
  └── name, email (fallback matching)

payouts (calculated per-partner payments)
  ├── csv_data_id → csv_data.id
  ├── partner_airtable_id → partner_sync.airtable_record_id
  └── deal_id → deals.deal_id (text reference)
\`\`\`

### Critical Relationships

**One-to-Many:**
- 1 CSV upload → many csv_data rows
- 1 deal → many csv_data rows (same MID over time)
- 1 csv_data → many payouts (one per participant)

**Many-to-Many:**
- Merchants ←→ Partners (via deals.participants_json)

---

## 🔍 KEY DESIGN PATTERNS

### 1. Multi-Key Partner Identification

**Problem**: Airtable Record IDs break when partners are re-created

**Solution**: Three-tier matching
\`\`\`typescript
function findPartner(partnerData) {
  // Try 1: Airtable Record ID
  let partner = await findByAirtableId(partnerData.airtable_record_id);
  
  // Try 2: Email match
  if (!partner && partnerData.email) {
    partner = await findByEmail(partnerData.email);
  }
  
  // Try 3: Name match
  if (!partner && partnerData.name) {
    partner = await findByName(partnerData.name);
  }
  
  return partner;
}
\`\`\`

### 2. Event Status Progression

Events follow strict status flow:
\`\`\`
unassigned → pending → confirmed
     ↓           ↓         ↓
  (editable) (editable) (read-only, create adjustments)
\`\`\`

**Rules**:
- Unassigned: Can edit all fields, assign participants
- Pending: Can edit participants, splits, payout_month
- Confirmed: Cannot edit directly, must create adjustment record

### 3. Participant JSON Structure

Each deal stores participants as JSONB array:
\`\`\`typescript
type Participant = {
  partner_id: string;        // Airtable record ID
  name: string;              // Display name
  email: string;             // Contact email
  role: 'ISO' | 'Agent' | 'Sub-Agent' | 'Investor' | 'Partner';
  split_pct: number;         // Percentage (0-100)
  amount?: number;           // Calculated payout amount
}

// Example
participants_json = [
  {
    partner_id: 'recABC123',
    name: 'Kevin Scoggin',
    email: 'kevin@example.com',
    role: 'Partner',
    split_pct: 40,
    amount: 3599.39
  },
  {
    partner_id: 'recXYZ789',
    name: 'Eugenio Riccio',
    email: 'eugenio@example.com',
    role: 'Partner',
    split_pct: 40,
    amount: 3599.39
  }
]
\`\`\`

### 4. Payout Calculation

\`\`\`typescript
// Base calculation
gross_residual = volume * fee_percentage
net_residual = gross_residual - adjustments - chargebacks

// Per participant
partner_payout = net_residual * (participant.split_pct / 100)

// Example with 2 partners at 40% each
// volume: $107,666.93
// fees: $221.52 (net_residual)
// Partner 1: $221.52 * 0.40 = $88.61
// Partner 2: $221.52 * 0.40 = $88.61
// Lumino: $221.52 * 0.20 = $44.30
\`\`\`

### 5. MID Memory Pattern

When assigning participants to a MID:
1. Check if `deals` table has existing deal for this MID
2. If exists: Pre-populate assignment modal with previous participants
3. If new: Empty form, user selects participants
4. This "remembers" who was last assigned to each merchant

---

## 🚨 CRITICAL BUSINESS RULES

### Data Integrity

1. **Payout Month Required**: Every csv_data row MUST have payout_month
2. **Split Total**: Participant split percentages typically sum to 80-100%
3. **Unique Constraint**: (csv_data_id + partner_airtable_id) must be unique in payouts table
4. **No Orphans**: Never delete csv_data if payouts exist
5. **Immutable Confirmed**: Once confirmed, edit via adjustments only

### Partner Sync

1. **Airtable as Source**: Partners table in Airtable is master
2. **Sync Direction**: Airtable → Supabase (not reverse)
3. **Payout Updates**: Supabase → Airtable (monthly totals)
4. **Nightly Reconciliation**: Background job syncs partner changes

### Payment Rules

1. **Pay by Agent**: Group all MIDs for an agent, pay once
2. **Merchant Count**: Count unique MIDs, not line items
3. **Monthly Batches**: Payouts grouped by processing month
4. **Status Tracking**: unpaid → pending → paid (no backwards movement)

---

## 🎨 UI/UX PATTERNS

### Component Standards

**Every table component must include:**
- Loading skeleton
- Empty state with helpful message
- Error state with retry button
- Pagination or virtual scrolling
- Sort by column headers
- Filter dropdowns

**Every form must include:**
- Field validation with error messages
- Loading state on submit button
- Success toast notification
- Error toast with details
- Keyboard shortcuts (Enter to submit, Esc to cancel)

### Color Coding

\`\`\`typescript
// Status badges
status === 'unassigned' → gray
status === 'pending' → yellow
status === 'confirmed' → green

// Paid status
paid_status === 'unpaid' → red
paid_status === 'pending' → yellow
paid_status === 'paid' → green

// Payout types
payout_type === 'residual' → blue
payout_type === 'upfront' → purple
payout_type === 'bonus' → green
payout_type === 'clawback' → red
payout_type === 'trueup' → orange
\`\`\`

### Modal Patterns

**Assignment Modal Structure:**
\`\`\`tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>Assign Participants</DialogTitle>
  </DialogHeader>
  
  <DialogContent>
    {/* Merchant Info Card */}
    <Card>
      <Merchant name, MID, volume, processing month />
    </Card>
    
    {/* Participants List */}
    <ParticipantsList>
      {participants.map(p => (
        <ParticipantRow
          key={p.id}
          onRemove={handleRemove}
          onEdit={handleEdit}
        />
      ))}
    </ParticipantsList>
    
    {/* Add Participant */}
    <AddParticipantForm onAdd={handleAdd} />
    
    {/* Split Summary */}
    <SplitSummary total={calculateTotal()} />
  </DialogContent>
  
  <DialogFooter>
    <Button variant="outline" onClick={onCancel}>
      Cancel
    </Button>
    <Button onClick={onSave}>
      Save Assignment
    </Button>
  </DialogFooter>
</Dialog>
\`\`\`

---

## 🔧 COMMON OPERATIONS

### Creating a New Deal

\`\`\`typescript
// API: POST /api/residuals/deals
async function createDeal(eventId: string, participants: Participant[]) {
  // 1. Get event data
  const event = await supabase
    .from('csv_data')
    .select('*')
    .eq('id', eventId)
    .single();
  
  // 2. Create deal
  const { data: deal } = await supabase
    .from('deals')
    .insert({
      deal_id: `deal_${crypto.randomUUID()}`,
      mid: event.mid,
      merchant_id: event.merchant_id,
      participants_json: participants,
      payout_type: event.payout_type,
      assigned_agent_name: participants[0].name,
      partner_id: null // deprecated
    })
    .select()
    .single();
  
  // 3. Update event
  await supabase
    .from('csv_data')
    .update({
      assignment_status: 'pending',
      deal_id: deal.id,
      assigned_agent_id: participants[0].partner_id,
      assigned_agent_name: participants[0].name
    })
    .eq('id', eventId);
  
  return deal;
}
\`\`\`

### Confirming and Creating Payouts

\`\`\`typescript
// API: POST /api/residuals/events/{id}/confirm
async function confirmEvent(eventId: string) {
  // 1. Get event with deal
  const event = await getEventWithDeal(eventId);
  
  // 2. Calculate net residual
  const netResidual = 
    event.volume - event.fees - event.adjustments - event.chargebacks;
  
  // 3. Create payout for each participant
  const payouts = event.deal.participants_json.map(participant => ({
    csv_data_id: event.id,
    deal_id: event.deal.deal_id,
    merchant_id: event.merchant_id,
    payout_month: event.payout_month,
    payout_date: event.date,
    mid: event.mid,
    merchant_name: event.merchant_name,
    payout_type: event.payout_type,
    volume: event.volume,
    fees: event.fees,
    adjustments: event.adjustments,
    chargebacks: event.chargebacks,
    net_residual: netResidual,
    partner_airtable_id: participant.partner_id,
    partner_role: participant.role,
    partner_split_pct: participant.split_pct,
    partner_payout_amount: netResidual * (participant.split_pct / 100),
    assignment_status: 'confirmed',
    paid_status: 'unpaid'
  }));
  
  // 4. Insert payouts
  await supabase.from('payouts').insert(payouts);
  
  // 5. Update event status
  await supabase
    .from('csv_data')
    .update({ assignment_status: 'confirmed' })
    .eq('id', eventId);
  
  return payouts;
}
\`\`\`

### Bulk Mark as Paid

\`\`\`typescript
// API: POST /api/residuals/payouts/mark-paid
async function markPayoutsPaid(payoutIds: string[], userId: string) {
  const now = new Date().toISOString();
  
  await supabase
    .from('payouts')
    .update({
      paid_status: 'paid',
      paid_at: now,
      paid_by: userId
    })
    .in('id', payoutIds);
  
  // Trigger Airtable sync
  await syncPayoutsToAirtable(payoutIds);
}
\`\`\`

---

## 📊 REPORTING & EXPORTS

### Monthly Summary Structure

\`\`\`typescript
type MonthlySummary = {
  month: string;              // "September 2025"
  totalVolume: number;
  totalPayouts: number;
  merchantCount: number;      // Unique MIDs
  eventCount: number;         // Total line items
  byAgent: {
    agentName: string;
    merchantCount: number;    // Their unique MIDs
    totalPayout: number;
    paidCount: number;
    unpaidCount: number;
  }[];
}
\`\`\`

### CSV Export Format

\`\`\`csv
Payout Month,Agent Name,Merchant Count,Total Volume,Total Payout,Paid Status
September 2025,Kevin Scoggin,15,$1250000.00,$45000.00,paid
September 2025,Eugenio Riccio,12,$980000.00,$35000.00,unpaid
\`\`\`

### PDF Export Layout

\`\`\`
RESIDUALS SUMMARY - [Month Year]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERVIEW
├─ Total Processing Volume: $X,XXX,XXX.XX
├─ Total Payouts: $XXX,XXX.XX
├─ Unique Merchants: XXX
└─ Total Events: XXX

BY AGENT
┌─────────────────────────────────────┐
│ Kevin Scoggin                       │
├─────────────────────────────────────┤
│ Merchants: 15                       │
│ Volume: $1,250,000.00              │
│ Payout: $45,000.00                 │
│ Status: ● Paid                      │
└─────────────────────────────────────┘
\`\`\`

---

## 🐛 DEBUGGING CHECKLIST

When something breaks, check in this order:

### 1. Schema Verification
- [ ] Column names match SCHEMA_README.md exactly
- [ ] Data types are correct (JSONB not JSON, numeric not integer)
- [ ] Foreign key relationships exist
- [ ] Indexes are in place

### 2. Data Flow
- [ ] csv_data.assignment_status updated correctly
- [ ] deals.participants_json has valid structure
- [ ] payouts rows created for ALL participants
- [ ] csv_data.payout_month is set (not null)

### 3. UI State Management
- [ ] Components refetch after mutations
- [ ] Optimistic updates rolled back on error
- [ ] Loading states shown during API calls
- [ ] Error states don't crash entire page

### 4. API Responses
- [ ] Errors return appropriate status codes (400, 404, 500)
- [ ] Success returns 200 with data
- [ ] Consistent error structure: { error: string, details?: any }
- [ ] All database errors caught and logged

### 5. Airtable Sync
- [ ] partner_sync table has up-to-date records
- [ ] Multi-key matching used (ID, email, name)
- [ ] Sync errors logged but don't block operations
- [ ] Retry logic in place for failed syncs

---

## 📝 CHANGELOG STANDARDS

Every entry must include:

\`\`\`markdown
## YYYY-MM-DD HH:MM

### Changed: [Component/File Name]
- Brief description of what changed
- Why it changed (bug fix, feature add, refactor)
- Impact on other components (if any)

### Added: [Component/File Name]
- What was added
- Purpose/use case

### Fixed: [Component/File Name]
- What was broken
- Root cause
- How it was fixed

### Removed: [Component/File Name]
- What was removed
- Why it's no longer needed
\`\`\`

**Example**:
\`\`\`markdown
## 2025-11-21 14:30

### Fixed: AssignmentModal.tsx
- Participants not saving when deal was in pending status
- Root cause: API was updating non-existent participants_json column in csv_data
- Removed invalid update, now only updates deals.participants_json

### Changed: PayoutsTable.tsx
- Added "Merchant Count" column to show unique MIDs instead of line item count
- Needed for accurate agent payment tracking
- Updated query to use COUNT(DISTINCT mid) instead of COUNT(*)
\`\`\`

---

## 🎓 LEARNING RESOURCES

### Key Files to Reference

1. **SCHEMA_README.md** - Database structure, always check first
2. **CHANGELOG.md** - Recent changes, debugging clues
3. **/_ai/01_RESIDUALS_FUNCTIONAL_WALKTHROUGH.md** - Original requirements
4. **/_ai/02_RESIDUALS_SCHEMA.yml** - Schema definitions
5. **/_ai/03_RESIDUALS_FLOW_DIAGRAM.md** - Visual flow diagrams

### Common Pitfalls

1. **Assuming columns exist** → Always verify with SCHEMA_README.md
2. **Long files** → Break into smaller components at 250-300 lines
3. **Wrong database client** → Use configured Supabase client
4. **Silent failures** → Always return proper error codes
5. **Stale data** → Refetch after mutations, don't rely on cached data
6. **Missing defensive code** → Every component needs loading/error states
7. **Forgetting updates** → Update CHANGELOG and SCHEMA_README after changes

---

## 🔐 SECURITY NOTES

- Never expose Supabase anon key in client code (use env vars)
- Validate all CSV uploads (file size, column count, data types)
- Sanitize user inputs before database queries
- Use Row Level Security (RLS) policies on Supabase tables
- Implement rate limiting on API routes
- Log all payment status changes for audit trail

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying changes:

- [ ] All tests pass
- [ ] CHANGELOG.md updated
- [ ] SCHEMA_README.md updated (if schema changed)
- [ ] No console.log statements in production code
- [ ] Error boundaries in place
- [ ] Database migrations tested
- [ ] Airtable sync tested with test data
- [ ] CSV upload tested with sample files
- [ ] Export functions tested (CSV, PDF)
- [ ] Mobile responsive design verified

---

**Last Updated**: 2025-11-21  
**Maintained By**: Andrew Richard, Creative Systems Architect  
**Version**: 2.0 (Rebuild)
