# Airtable Schema — Nail Salon Automation

## Base Name: `SmartDesk AI — [Salon Name]`

---

## Table 1: `Clients`

| Field Name | Type | Notes |
|---|---|---|
| `ClientName` | Single line text | Full name |
| `Phone` | Phone / Single line text | 10-digit normalized (no +1) |
| `PhoneRaw` | Single line text | Original format as received |
| `Email` | Email | Optional |
| `Channel` | Single select | `vonage`, `twilio`, `web`, `manual` |
| `Status` | Single select | `New Lead`, `Active`, `Inactive`, `VIP`, `Blocked` |
| `FirstContactAt` | Date/Time | Auto-set on creation |
| `LastMessageAt` | Date/Time | Updated on each message |
| `LastVisitDate` | Date | Updated after each completed appointment |
| `TotalVisits` | Number | Incremented on appointment completion |
| `MessageCount` | Number | Total messages exchanged |
| `PreferredService` | Single line text | Learned from history |
| `Notes` | Long text | Staff notes |
| `ReactivationOptOut` | Checkbox | Client asked to stop reactivation msgs |
| `LastReactivationAt` | Date/Time | Last reactivation SMS sent |
| `ReactivationTier` | Single select | `30-day`, `60-day`, `90-day` |
| `ReactivationCount` | Number | How many reactivation attempts |

---

## Table 2: `Appointments`

| Field Name | Type | Notes |
|---|---|---|
| `ClientName` | Single line text | Denormalized for easy reading |
| `Phone` | Single line text | Link to client |
| `Service` | Single select | `Manicure`, `Pedicure`, `Gel Nails`, `Acrylic Full Set`, `Nail Art`, `Waxing`, `Other` |
| `AppointmentDate` | Date | YYYY-MM-DD |
| `AppointmentTime` | Single line text | e.g. "2:00 PM" |
| `Status` | Single select | `Pending Confirmation`, `Confirmed`, `Completed`, `Cancelled`, `No-Show`, `No-Show — Followed Up` |
| `BookedVia` | Single select | `SMS/AI`, `Voice/Bella`, `Manual`, `Web Form` |
| `ReminderSent` | Checkbox | 24hr or 2hr reminder sent |
| `ReminderType` | Single select | `24hr`, `2hr` |
| `ReminderSentAt` | Date/Time | When reminder was sent |
| `ConfirmedByClient` | Checkbox | Client replied Y |
| `CompletedAt` | Date/Time | When service was completed (staff marks) |
| `ReviewRequestSent` | Checkbox | Post-visit review request sent |
| `ReviewRequestSentAt` | Date/Time | |
| `ReviewPlatform` | Single select | `Google`, `Yelp` |
| `NoShowFollowUpSent` | Checkbox | No-show follow-up sent |
| `NoShowFollowUpAt` | Date/Time | |
| `ReactivationEligible` | Checkbox | Marked for reactivation campaign |
| `CreatedAt` | Date/Time | Auto-set |
| `Notes` | Long text | |

---

## Table 3: `Messages`

| Field Name | Type | Notes |
|---|---|---|
| `Phone` | Single line text | Client phone number |
| `Message` | Long text | Full message content |
| `Direction` | Single select | `Inbound`, `Outbound` |
| `Intent` | Single select | `BOOKING`, `FAQ`, `CANCEL`, `RESCHEDULE`, `REVIEW`, `ESCALATE`, `GREETING` |
| `MessageId` | Single line text | Vonage/Twilio message ID |
| `Channel` | Single select | `vonage`, `twilio`, `whatsapp` |
| `ReceivedAt` | Date/Time | When message was received |
| `SentAt` | Date/Time | When outbound was sent |

---

## Setting Up Airtable

### Step 1 — Create the base
1. Go to [airtable.com](https://airtable.com)
2. Create new base: `SmartDesk AI — [Salon Name]`
3. Create the 3 tables above with the fields listed

### Step 2 — Get your API credentials
1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Create a Personal Access Token with scopes:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
3. Add your base to the token's access list
4. Copy the token → paste in `.env` as `AIRTABLE_API_KEY`

### Step 3 — Get your Base ID
1. Open your base in Airtable
2. Click **Help** → **API documentation**
3. Find the base ID (starts with `app...`)
4. Paste in `.env` as `AIRTABLE_BASE_ID`

### Step 4 — Configure Single Select options
For `Status` in Clients, add:
- `New Lead` (yellow)
- `Active` (green)
- `Inactive` (gray)
- `VIP` (purple)
- `Blocked` (red)

For `Status` in Appointments, add:
- `Pending Confirmation` (yellow)
- `Confirmed` (green)
- `Completed` (blue)
- `Cancelled` (orange)
- `No-Show` (red)
- `No-Show — Followed Up` (gray)

---

## Optional: Airtable Automations (native)

You can add native Airtable automations as a backup layer:

**Trigger:** When `Status` in Appointments changes to `Completed`  
**Action:** Update `LastVisitDate` and increment `TotalVisits` in Clients table

This gives you a safety net if n8n has downtime.
