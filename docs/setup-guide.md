# Setup Guide — Nail Salon Automation

## SmartDesk AI — Complete Onboarding Guide

**Time to deploy:** ~2-3 hours  
**Skill level:** Intermediate (basic n8n experience recommended)

---

## Prerequisites Checklist

Before you start, make sure you have:

- [ ] n8n instance running (self-hosted or n8n.cloud)
- [ ] Vonage account with a number (preferred for WhatsApp)
- [ ] OR Twilio account with an SMS-capable number
- [ ] Airtable account (free plan works for small salons)
- [ ] OpenAI API key (GPT-4o-mini)
- [ ] Retell AI account (for voice, optional for SMS-only)
- [ ] Salon's Google Review link
- [ ] Salon's basic info (name, phone, address, hours, prices)

---

## Step 1 — Environment Setup

```bash
git clone https://github.com/iseogo/Nail-Salon-Automation.git
cd Nail-Salon-Automation
cp .env.example .env
```

Open `.env` and fill in all values. Refer to each platform's dashboard:

- **Vonage:** [dashboard.nexmo.com](https://dashboard.nexmo.com)
- **Twilio:** [console.twilio.com](https://console.twilio.com)
- **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Airtable:** [airtable.com/create/tokens](https://airtable.com/create/tokens)
- **Retell AI:** [app.retellai.com](https://app.retellai.com)

---

## Step 2 — Airtable Setup

Follow the full schema in `/airtable/schema.md`.

Quick summary:
1. Create base: `SmartDesk AI — [Salon Name]`
2. Create 3 tables: `Clients`, `Appointments`, `Messages`
3. Add all fields as described in schema.md
4. Get your Base ID and API token → add to `.env`

---

## Step 3 — Import n8n Workflows

Import in this exact order:

1. Open n8n → **Workflows** → **Import from file**
2. Import `01-lead-capture.json`
3. Import `02-appointment-booking.json`
4. Import `03-sms-reminders.json`
5. Import `04-no-show-followup.json`
6. Import `05-review-generation.json`
7. Import `06-reactivation-campaign.json`

For each workflow:
- Open it
- Update any credentials (Airtable, HTTP Auth headers)
- Click **Save**
- Click **Activate** (toggle on)

---

## Step 4 — Configure Vonage Webhook

In your Vonage dashboard:
1. Go to **Numbers** → your number → **Edit**
2. Set **Inbound Webhook URL** to:
   ```
   https://YOUR-N8N-URL/webhook/nail-salon-inbound
   ```
3. Method: `POST`
4. Save

Test it by sending an SMS to your Vonage number.

---

## Step 5 — Set Up Bella (Optional — Voice)

Follow `/retell-ai/bella-agent-config.md` for full voice setup.

For SMS-only deployment, skip this step — Bella runs via n8n + GPT-4o-mini.

---

## Step 6 — Test Each Workflow

### Test 01 — Lead Capture
```
Send SMS: "Hi, I want to book an appointment"
Expected: New client created in Airtable, message logged, Bella replies
```

### Test 02 — Booking Flow
```
Continue conversation with booking details
Expected: Appointment created in Airtable with Pending status
```

### Test 03 — Reminders
- Create a test appointment with tomorrow's date and "Confirmed" status
- Manually trigger workflow 03
- Expected: Reminder SMS sent, `ReminderSent` = true in Airtable

### Test 04 — No-Show
- Set an appointment status to "No-Show" with today's date
- Manually trigger workflow 04
- Expected: Follow-up SMS sent, `NoShowFollowUpSent` = true

### Test 05 — Review Generation
- Set an appointment to "Completed" with `CompletedAt` = 3 hours ago
- Manually trigger workflow 05
- Expected: Review request SMS sent

### Test 06 — Reactivation
- Set a client's `LastVisitDate` to 31 days ago
- Manually trigger workflow 06
- Expected: Reactivation SMS sent

---

## Step 7 — Go Live

1. Confirm all 6 workflows are **Active** in n8n
2. Send a final test SMS from a real phone
3. Verify Airtable is receiving data
4. Notify salon owner that system is live

---

## Troubleshooting

### SMS not received by n8n
- Check Vonage webhook URL is correct and accessible
- Check n8n webhook is active (green dot)
- Check n8n execution logs for errors

### Bella not responding correctly
- Check OpenAI API key is valid and has credits
- Check the JSON parse step in workflow 02
- Review GPT system prompt for edge cases

### Airtable not updating
- Verify Base ID and table names match exactly
- Check API token has write permissions
- Look at n8n execution logs for Airtable error messages

### Reminders not sending
- Verify appointments have `Status = Confirmed`
- Check date format matches (YYYY-MM-DD)
- Verify Vonage credentials in workflow

---

## Support

Built and maintained by **SmartDesk AI**  
Website: [smartdeskai.cloud](https://smartdeskai.cloud)  
Contact: Issaka Seogo | issaka.seogo@summithealthcarelogistics.com
