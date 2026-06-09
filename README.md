# 💅 Nail Salon Automation — SmartDesk AI

> **AI-powered automation system for nail salons** — voice booking, CRM, reminders, reviews & reactivation. Built with n8n, Retell AI, Twilio/Vonage, and Airtable.

[![SmartDesk AI](https://img.shields.io/badge/Powered%20by-SmartDesk%20AI-blue?style=for-the-badge)](https://smartdeskai.cloud)
[![n8n](https://img.shields.io/badge/Workflow-n8n-orange?style=for-the-badge)](https://n8n.io)
[![Retell AI](https://img.shields.io/badge/Voice-Retell%20AI-purple?style=for-the-badge)](https://retellai.com)
[![Airtable](https://img.shields.io/badge/CRM-Airtable-teal?style=for-the-badge)](https://airtable.com)

---

## 🎯 What This Does

This system turns a nail salon into a 24/7 automated business. A client texts or calls — **Bella** (your AI receptionist) handles everything from booking to follow-up, without any manual work from your staff.

**Result:** More bookings. Fewer no-shows. More 5-star reviews. More returning clients.

---

## ✅ Feature Overview

| Feature | Description |
|---|---|
| 📲 **Lead Capture** | Captures inquiries from Google, Facebook, Instagram, WhatsApp |
| 🤖 **AI Receptionist (Bella)** | Answers questions, books appointments 24/7 |
| 📅 **Appointment Booking** | Confirms slots, sends calendar invites |
| ⏰ **SMS Reminders** | 24hr + 2hr automated reminders via Twilio/Vonage |
| 🚫 **No-Show Prevention** | Confirmation requests + waitlist management |
| ⭐ **Review Generation** | Post-visit review requests on Google/Yelp |
| 🔁 **Reactivation Campaign** | Re-engages clients who haven't visited in 30/60/90 days |
| 📊 **CRM (Airtable)** | Full client history, visit tracking, preferences |

---

## 🏗️ Architecture

```
Client (SMS/WhatsApp/Web)
        │
        ▼
  Vonage / Twilio
  (Inbound Message)
        │
        ▼
    n8n Webhook
        │
        ├──► AI Brain (Bella / GPT-4o-mini)
        │         │
        │         ├── Intent: BOOKING → Calendly / Manual Slot
        │         ├── Intent: FAQ    → Pre-built Answers
        │         ├── Intent: CANCEL → Update Airtable
        │         └── Intent: OTHER  → Escalate to Staff
        │
        ├──► Airtable CRM (Read/Write)
        │
        ├──► Confirmation SMS (Vonage/Twilio)
        │
        └──► Staff Notification (SMS/Email)
```

---

## 🔄 Workflow Breakdown

### 1. Lead Capture (`01-lead-capture.json`)
- Triggers on inbound SMS, WhatsApp, or web form
- Checks if client exists in Airtable
- Creates new contact or updates existing record
- Routes to AI Brain (Bella) or Staff queue

### 2. Appointment Booking (`02-appointment-booking.json`)
- Bella handles booking conversation
- Checks available slots
- Confirms appointment and writes to Airtable
- Sends confirmation SMS to client

### 3. SMS Reminders (`03-sms-reminders.json`)
- Scheduled trigger: runs daily at 8AM
- Queries upcoming appointments from Airtable
- Sends 24-hour reminder
- Sends 2-hour reminder day-of
- Requests confirmation reply (Y/N)

### 4. No-Show Follow-Up (`04-no-show-followup.json`)
- Triggers when appointment status = "no-show"
- Sends empathetic follow-up SMS
- Offers easy rebooking
- Marks lead for reactivation campaign if no response

### 5. Review Generation (`05-review-generation.json`)
- Triggers 2 hours after appointment end
- Sends personalized thank-you SMS
- Includes Google Review / Yelp link
- Logs review request in Airtable

### 6. Reactivation Campaign (`06-reactivation-campaign.json`)
- Scheduled trigger: runs weekly
- Finds clients inactive 30 / 60 / 90 days
- Sends personalized win-back message
- Offers special promotion or priority booking

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| **n8n** (self-hosted) | Workflow automation engine |
| **Retell AI** | Voice AI agent (Bella) |
| **Vonage / Twilio** | SMS & WhatsApp messaging |
| **Airtable** | CRM database |
| **OpenAI GPT-4o-mini** | AI Brain for intent detection & replies |
| **Calendly** | Appointment slot management (optional) |

---

## 🚀 Quick Start

### Prerequisites
- n8n instance (self-hosted or cloud)
- Vonage or Twilio account with a number
- Airtable account + API key
- OpenAI API key
- Retell AI account (for voice)

### 1. Clone the repo
```bash
git clone https://github.com/iseogo/Nail-Salon-Automation.git
cd Nail-Salon-Automation
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your credentials in .env
```

### 3. Import n8n workflows
- Open your n8n instance
- Go to **Workflows** → **Import from file**
- Import each JSON file from `/n8n-workflows/` in order (01 → 06)

### 4. Set up Airtable
- Follow the schema in `/airtable/schema.md`
- Create the required tables and fields

### 5. Configure Vonage/Twilio webhook
- Set your inbound SMS webhook URL to:
  `https://your-n8n-instance.com/webhook/nail-salon-inbound`

### 6. Test the system
```bash
# Send a test SMS to your Vonage/Twilio number
"Hi, I'd like to book a manicure for tomorrow"
```

---

## 📁 Project Structure

```
Nail-Salon-Automation/
├── README.md
├── .env.example
├── .gitignore
├── n8n-workflows/
│   ├── 01-lead-capture.json
│   ├── 02-appointment-booking.json
│   ├── 03-sms-reminders.json
│   ├── 04-no-show-followup.json
│   ├── 05-review-generation.json
│   └── 06-reactivation-campaign.json
├── docs/
│   ├── architecture.md
│   ├── setup-guide.md
│   └── workflow-descriptions.md
├── airtable/
│   └── schema.md
├── retell-ai/
│   └── bella-agent-config.md
└── scripts/
    └── test-webhook.sh
```

---

## 🔐 Environment Variables

See `.env.example` for the full list. Key variables:

```env
VONAGE_API_KEY=
VONAGE_API_SECRET=
VONAGE_FROM_NUMBER=
OPENAI_API_KEY=
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
RETELL_API_KEY=
N8N_WEBHOOK_URL=
```

---

## 💰 Pricing Model

This system is offered as a **done-for-you service** under **SmartDesk AI**:

- **Setup Fee:** One-time onboarding
- **Monthly Retainer:** $799/month
- **Includes:** All 6 workflows, Bella AI agent, CRM setup, ongoing support

📩 Contact: [smartdeskai.cloud](https://smartdeskai.cloud)

---

## 🤖 Meet Bella

Bella is the AI receptionist powered by GPT-4o-mini + Retell AI. She:
- Responds in under 3 seconds
- Handles booking, FAQs, cancellations
- Escalates to staff when needed
- Speaks the salon's brand voice
- Works 24/7 — nights, weekends, holidays

---

## 📖 Documentation

- [Full Setup Guide](docs/setup-guide.md)
- [Architecture Deep Dive](docs/architecture.md)
- [Workflow Descriptions](docs/workflow-descriptions.md)
- [Airtable Schema](airtable/schema.md)
- [Bella Agent Config](retell-ai/bella-agent-config.md)

---

## 📄 License

MIT License — Free to use, modify, and deploy for your own salon or clients.

---

## 🙌 Built by SmartDesk AI

> Automating local businesses so owners can focus on what matters — their craft.

[![Website](https://img.shields.io/badge/Website-smartdeskai.cloud-blue)](https://smartdeskai.cloud)
