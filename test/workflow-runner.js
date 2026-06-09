/**
 * Workflow runner — simulates the n8n execution graph defined in
 * workflows/nail-salon-automation.json using real HTTP calls to mock services.
 *
 * Two entry points mirror the two webhook triggers in the workflow:
 *   runInquiry(payload)       — the initial client inquiry
 *   runSmsReply(from, reply)  — the client's CONFIRM/CANCEL response to the reminder
 */
const http = require("http");

const VARS = {
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
  retell:   process.env.RETELL_BASE   ?? "http://localhost:4001",
  twilio:   process.env.TWILIO_BASE   ?? "http://localhost:4002",
  airtable: process.env.AIRTABLE_BASE ?? "http://localhost:4003",
  slack:    process.env.SLACK_BASE    ?? "http://localhost:4004",
};

function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const post  = (url, body, headers) => request("POST",  url, body, headers);
const patch = (url, body, headers) => request("PATCH", url, body, headers);

function step(name) {
  console.log(`\n${"─".repeat(60)}\n▶  ${name}`);
}

function sms(to, name, message) {
  const body = typeof message === "string" ? message : message(name);
  return post(
    `${BASES.twilio}/2010-04-01/Accounts/${VARS.TWILIO_ACCOUNT_SID}/Messages.json`,
    { From: VARS.TWILIO_FROM_NUMBER, To: to, Body: body }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point 1: Client inquiry (📥 Client Inquiry webhook)
// ─────────────────────────────────────────────────────────────────────────────
async function runInquiry(payload) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Inquiry Flow                                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("Input:", JSON.stringify(payload, null, 2));

  const { name, phone, email, source, message } = payload;

  // Node: ⏳ Wait for Reply?
  step("⏳ Wait for Reply?");
  if (!message) {
    console.log("  → No message — webhook ACK only, flow stops.");
    return null;
  }

  // Node: 🤖 AI Agent Available?
  step("🤖 AI Agent Available?");
  const aiActive = (process.env.AI_AGENT_ACTIVE ?? "true") === "true";
  console.log(`  → AI_AGENT_ACTIVE = ${aiActive}`);

  if (aiActive) {
    // Node: 🎙️ Retell AI call
    step("🎙️  AI Agent Calls & Books (Retell AI)");
    const r = await post(
      `${BASES.retell}/v2/create-phone-call`,
      { agent_id: "agent_d4e806f2be5ef25d5ea61c17de", from_number: VARS.TWILIO_FROM_NUMBER, to_number: phone, metadata: JSON.stringify({ client_name: name, source }) },
      { Authorization: `Bearer ${VARS.RETELL_API_KEY}` }
    );
    console.log("  → Retell:", r.body);
  } else {
    // Node: 📣 Alert Staff (Slack)
    step("📣 Alert Staff (Slack)");
    const r = await post(`${BASES.slack}/api/chat.postMessage`, {
      channel: "#nail-salon-leads",
      text: `📌 *New Manual Reply Needed!*\n\nClient: ${name}\nPhone: ${phone}\nMessage: ${message}\nSource: ${source}\n\nAI Agent is unavailable — please reply manually.`,
    });
    console.log("  → Slack:", r.body);
  }

  // Node: 📋 Add to CRM (Airtable) — uses webhook node reference, not $json
  step("📋 Add to CRM (Airtable)");
  const airtableRes = await post(
    `${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients`,
    { fields: { Name: name, Phone: phone, Email: email, Source: source, Status: "Inquiry Received", "Created At": new Date().toISOString(), "Assigned Stylist": VARS.DEFAULT_STYLIST } }
  );
  // Node: 🗃️ Capture CRM ID + Restore Client Data (Set node)
  const crm = {
    crm_record_id:        airtableRes.body.id,
    name, phone, email, source,
    appointment_confirmed: payload.appointment_confirmed,
  };
  console.log(`  → CRM id: ${crm.crm_record_id}`);

  // Node: 📧 Notify Stylist (Email)
  step("📧 Notify Stylist (Email)");
  console.log(`  → [SIMULATED] Email → ${VARS.STYLIST_EMAIL} | Subject: New Appointment Request — ${name}`);

  // Node: ✅ Appointment Confirmed?
  step("✅ Appointment Confirmed?");
  const apptConfirmed = crm.appointment_confirmed === "true";
  console.log(`  → appointment_confirmed = ${crm.appointment_confirmed}`);

  if (!apptConfirmed) {
    step("🔄 Reschedule / Cancel SMS (Twilio)");
    await sms(crm.phone, crm.name, `Hi ${crm.name}, we noticed you couldn't make your appointment. No worries! Click here to reschedule: ${VARS.BOOKING_LINK} — Nail Salon Team`);
    step("📋 Update CRM — Rescheduled");
    await patch(`${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients/${crm.crm_record_id}`, { fields: { Status: "Rescheduled" } });
    console.log("\n✓ Inquiry flow complete — path: not confirmed → reschedule");
    return crm;
  }

  // Node: ⏱️ Wait 24 Hours Before Appt [skipped in test]
  step("⏱️  Wait 24 Hours Before Appt  [SKIPPED — testing]");

  // Node: 📱 24hr Reminder (Twilio SMS)
  step("📱 24hr Reminder (Twilio SMS)");
  await sms(crm.phone, crm.name, `Hi ${crm.name}! 💅 This is a reminder for your nail appointment tomorrow. Reply CONFIRM to confirm or CANCEL to reschedule. — Nail Salon Team`);

  console.log("\n✓ Inquiry flow complete — waiting for client SMS reply.");
  return crm;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point 2: Inbound SMS reply (📲 Inbound SMS Reply webhook)
// ─────────────────────────────────────────────────────────────────────────────
async function runSmsReply(from, reply) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Inbound SMS Reply Flow                                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`Input: From=${from} Body="${reply}"`);

  // Node: 🔍 Lookup Client by Phone (Airtable list with filter)
  step("🔍 Lookup Client by Phone (Airtable)");
  const lookupRes = await request(
    "GET",
    `${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients?filterByFormula=${encodeURIComponent(`{Phone}='${from}'`)}`,
    {}
  );
  const record = lookupRes.body.records?.[0];
  if (!record) { console.log("  → No client found for", from); return; }

  // Node: 🗃️ Merge SMS Reply + Client Data (Set node)
  const ctx = {
    crm_record_id: record.id,
    name:  record.fields?.Name  ?? "Client",
    phone: record.fields?.Phone ?? from,
    reply: reply.trim().toUpperCase(),
  };
  console.log(`  → Client: ${ctx.name} | Reply: ${ctx.reply} | CRM id: ${ctx.crm_record_id}`);

  // Node: 📲 Client Replied CONFIRM?
  step("📲 Client Replied CONFIRM?");
  const confirmed = ctx.reply === "CONFIRM";
  console.log(`  → ${confirmed ? "CONFIRMED ✓" : "CANCELLED ✗"}`);

  if (!confirmed) {
    step("🔄 Reschedule / Cancel SMS (Twilio)");
    await sms(ctx.phone, ctx.name, `Hi ${ctx.name}, we noticed you couldn't make your appointment. No worries! Click here to reschedule: ${VARS.BOOKING_LINK} — Nail Salon Team`);
    step("📋 Update CRM — Rescheduled");
    await patch(`${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients/${ctx.crm_record_id}`, { fields: { Status: "Rescheduled" } });
    console.log("\n✓ SMS reply flow complete — path: cancel → reschedule");
    return;
  }

  // Node: 💅 Service Provided — Update CRM
  step("💅 Service Provided — Update CRM");
  await patch(`${BASES.airtable}/v0/${VARS.AIRTABLE_BASE_ID}/NailSalonClients/${ctx.crm_record_id}`, {
    fields: { Status: "Service Completed", "Service Date": new Date().toISOString() },
  });

  // Node: ⏱️ Wait 2hr Post-Service [skipped]
  step("⏱️  Wait 2hr Post-Service  [SKIPPED — testing]");

  // Node: ⭐ Request Google Review
  step("⭐ Request Google Review (Twilio)");
  await sms(ctx.phone, ctx.name, `Hi ${ctx.name}! 💅 We hope you loved your nails! We'd be so grateful if you left us a quick Google review: ${VARS.GOOGLE_REVIEW_LINK} — Nail Salon Team 💛`);

  // Node: ⏱️ Wait 3 Days (Review Window) [skipped]
  step("⏱️  Wait 3 Days (Review Window)  [SKIPPED — testing]");

  // Node: 🎁 Loyalty Offer
  step("🎁 Loyalty Offer (Twilio)");
  await sms(ctx.phone, ctx.name, `Thank you so much ${ctx.name}! 🙏 We hope you loved your nails. As a thank-you, here's 10% off your next visit: ${VARS.LOYALTY_CODE} — See you soon! 💅`);

  console.log("\n✓ SMS reply flow complete — full happy path.");
}

module.exports = { runInquiry, runSmsReply };
