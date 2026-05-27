/**
 * Workflow runner — simulates the n8n execution graph defined in
 * workflows/nail-salon-automation.json using real HTTP calls to mock services.
 *
 * External API bases (override via env vars):
 *   RETELL_BASE    default http://localhost:4001
 *   TWILIO_BASE    default http://localhost:4002
 *   AIRTABLE_BASE  default http://localhost:4003
 *   SLACK_BASE     default http://localhost:4004
 */
const http = require("http");

const VARS = {
  AI_AGENT_ACTIVE: process.env.AI_AGENT_ACTIVE ?? "true",
  RETELL_API_KEY: "test_retell_key",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: "test_token",
  TWILIO_FROM_NUMBER: "+15315416041",
  AIRTABLE_BASE_ID: "appTest123",
  STYLIST_EMAIL: "stylist@nailsalon.com",
  DEFAULT_STYLIST: "Jane Doe",
  BOOKING_LINK: "https://calendly.com/nailsalon/book",
  GOOGLE_REVIEW_LINK: "https://g.page/r/nailsalon/review",
  LOYALTY_CODE: "WELCOME10",
};

const BASES = {
  retell: process.env.RETELL_BASE ?? "http://localhost:4001",
  twilio: process.env.TWILIO_BASE ?? "http://localhost:4002",
  airtable: process.env.AIRTABLE_BASE ?? "http://localhost:4003",
  slack: process.env.SLACK_BASE ?? "http://localhost:4004",
};

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function step(name) {
  console.log(`\n${"─".repeat(60)}\n▶  ${name}`);
}

function sms(to, name, message) {
  return post(`${BASES.twilio}/2010-04-01/Accounts/${VARS.TWILIO_ACCOUNT_SID}/Messages.json`, {
    From: VARS.TWILIO_FROM_NUMBER,
    To: to,
    Body: message.replace(/{{ \$json\.name }}/g, name),
  });
}

async function runWorkflow(payload) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  SmartDesk AI — Nail Salon Workflow Test Run             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nInput payload:", JSON.stringify(payload, null, 2));

  const { name, phone, email, source, message } = payload;

  // ── Node: Wait for Reply? ───────────────────────────────────────────
  step("⏳ Wait for Reply?");
  if (!message) {
    console.log("  → No message, sending webhook ACK and stopping.");
    return { status: "ack", message: "Thank you! We'll be in touch shortly." };
  }
  console.log(`  → Message present: "${message}"`);

  // ── Node: AI Agent Available? ───────────────────────────────────────
  step("🤖 AI Agent Available?");
  const aiActiveVal = process.env.AI_AGENT_ACTIVE ?? VARS.AI_AGENT_ACTIVE;
  const aiActive = aiActiveVal === "true";
  console.log(`  → AI_AGENT_ACTIVE = ${aiActiveVal}`);

  let crmRecordId;

  if (aiActive) {
    // ── Node: Retell AI call ──────────────────────────────────────────
    step("🎙️  AI Agent Calls & Books (Retell AI)");
    const retellRes = await post(
      `${BASES.retell}/v2/create-phone-call`,
      {
        agent_id: "agent_d4e806f2be5ef25d5ea61c17de",
        from_number: VARS.TWILIO_FROM_NUMBER,
        to_number: phone,
        metadata: JSON.stringify({ client_name: name, source }),
      },
      { Authorization: `Bearer ${VARS.RETELL_API_KEY}` }
    );
    console.log("  → Retell response:", retellRes.body);
  } else {
    // ── Node: Slack staff alert ───────────────────────────────────────
    step("📣 Alert Staff (Slack)");
    const slackRes = await post(`${BASES.slack}/api/chat.postMessage`, {
      channel: "#nail-salon-leads",
      text: `📌 *New Manual Reply Needed!*\n\nClient: ${name}\nPhone: ${phone}\nMessage: ${message}\nSource: ${source}\n\nAI Agent is unavailable — please reply manually.`,
    });
    console.log("  → Slack response:", slackRes.body);
  }

  // ── Node: Add to CRM (Airtable) ──────────────────────────────────────
  step("📋 Add to CRM (Airtable)");
  const airtableRes = await post(
    `${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients`,
    {
      fields: {
        Name: name,
        Phone: phone,
        Email: email,
        Source: source,
        Status: "Inquiry Received",
        "Created At": new Date().toISOString(),
        "Assigned Stylist": VARS.DEFAULT_STYLIST,
      },
    }
  );
  crmRecordId = airtableRes.body.id;
  console.log("  → CRM record id:", crmRecordId);

  // ── Node: Notify Stylist (Email) ──────────────────────────────────────
  step("📧 Notify Stylist (Email)");
  console.log(`  → [SIMULATED] Email sent to ${VARS.STYLIST_EMAIL}`);
  console.log(`     Subject: 🔔 New Appointment Request — ${name}`);
  console.log(`     Body: Name=${name}, Phone=${phone}, Email=${email}, Source=${source}`);

  // ── Node: Appointment Confirmed? ──────────────────────────────────────
  step("✅ Appointment Confirmed?");
  const apptConfirmed = payload.appointment_confirmed === "true";
  console.log(`  → appointment_confirmed = ${payload.appointment_confirmed}`);

  if (!apptConfirmed) {
    step("🔄 Reschedule / Cancel SMS (Twilio)");
    await sms(
      phone,
      name,
      `Hi ${name}, we noticed you couldn't make your appointment. No worries! Click here to reschedule: ${VARS.BOOKING_LINK} — Nail Salon Team`
    );
    step("📋 Update CRM — Rescheduled");
    await post(`${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients/${crmRecordId}`, {
      fields: { Status: "Rescheduled" },
    });
    console.log("\n✓ Workflow complete — path: reschedule");
    return;
  }

  // ── Node: Wait 24h + Reminder SMS ─────────────────────────────────────
  step("⏱️  Wait 24 Hours Before Appt  [SKIPPED — testing]");
  step("📱 24hr Reminder (Twilio SMS)");
  await sms(
    phone,
    name,
    `Hi ${name}! 💅 This is a reminder for your nail appointment tomorrow. Reply CONFIRM to confirm or CANCEL to reschedule. — Nail Salon Team`
  );

  // ── Node: Client Final Confirm? ───────────────────────────────────────
  step("📲 Client Final Confirm?");
  const finalConfirm = payload.final_confirm ?? "CONFIRM";
  console.log(`  → final_confirm = ${finalConfirm}`);

  if (finalConfirm !== "CONFIRM") {
    step("🔄 Reschedule / Cancel SMS (Twilio)");
    await sms(
      phone,
      name,
      `Hi ${name}, we noticed you couldn't make your appointment. No worries! Click here to reschedule: ${VARS.BOOKING_LINK} — Nail Salon Team`
    );
    step("📋 Update CRM — Rescheduled");
    await post(`${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients/${crmRecordId}`, {
      fields: { Status: "Rescheduled" },
    });
    console.log("\n✓ Workflow complete — path: client cancelled");
    return;
  }

  // ── Node: Service Provided — Update CRM ──────────────────────────────
  step("💅 Service Provided — Update CRM");
  await post(`${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients/${crmRecordId}`, {
    fields: { Status: "Service Completed", "Service Date": new Date().toISOString() },
  });

  // ── Node: Wait 2hr + Review Request ───────────────────────────────────
  step("⏱️  Wait 2hr Post-Service  [SKIPPED — testing]");
  step("⭐ Request Google Review (Twilio)");
  await sms(
    phone,
    name,
    `Hi ${name}! 💅 We hope you loved your nails! We'd be so grateful if you left us a quick Google review: ${VARS.GOOGLE_REVIEW_LINK} — Nail Salon Team 💛`
  );

  // ── Node: Review Received? ─────────────────────────────────────────────
  step("⭐ Review Received?");
  const reviewReceived = payload.review_received === "true";
  console.log(`  → review_received = ${payload.review_received}`);

  if (reviewReceived) {
    step("🎁 Thank You + Loyalty Offer (Twilio)");
    await sms(
      phone,
      name,
      `Thank you so much ${name}! 🙏 Your review means the world to us. Here's 10% off your next visit: ${VARS.LOYALTY_CODE} — See you soon! 💅`
    );
  } else {
    step("🔁 Follow-Up Review Request (Twilio)");
    await sms(
      phone,
      name,
      `Hi ${name}! 💕 We'd love to hear your feedback. Leave us a quick Google review here: ${VARS.GOOGLE_REVIEW_LINK} — It helps us so much! 🙏`
    );
  }

  console.log("\n✓ Workflow complete — path: full happy path");
}

module.exports = { runWorkflow };
