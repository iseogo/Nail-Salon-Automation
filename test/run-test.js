/**
 * Test runner — starts all mock services, runs four scenarios, asserts on results.
 *
 *   node test/run-test.js
 *
 * Scenarios:
 *   1. Happy path    — AI active, appt confirmed, client replies CONFIRM, loyalty sent
 *   2. AI offline    — Slack fallback, appt confirmed, client replies CONFIRM
 *   3. Not confirmed — AI active, appt NOT confirmed → immediate reschedule
 *   4. Client cancel — AI active, appt confirmed, client replies CANCEL → reschedule
 */
const { startRetell, startTwilio, startAirtable, startSlack, calls, reset } = require("./mock-services");
const { runInquiry, runSmsReply } = require("./workflow-runner");

let passed = 0;
let failed = 0;

function assert(label, condition, extra = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${extra ? " — " + extra : ""}`);
    failed++;
  }
}

function assertCount(label, arr, expected) {
  assert(`${label}: expected ${expected}, got ${arr.length}`, arr.length === expected, JSON.stringify(arr.map(x => x.op ?? x.Body ?? x.channel ?? "call")));
}

function assertSmsContains(label, arr, text) {
  const found = arr.some((s) => (s.Body ?? "").includes(text));
  assert(`SMS contains "${text}"`, found, `Actual bodies: ${arr.map(s => s.Body).join(" | ")}`);
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const servers = [startRetell(4001), startTwilio(4002), startAirtable(4003), startSlack(4004)];
  await sleep(100);

  console.log("Mock services up: Retell:4001 Twilio:4002 Airtable:4003 Slack:4004\n");

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 1: Full happy path — AI active, confirmed, CONFIRM reply
  // ────────────────────────────────────────────────────────────────────────
  reset();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 1 — Happy path (AI on, confirmed, CONFIRM reply)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "true";
  const crm1 = await runInquiry({
    name: "Sarah Kim", phone: "+14155552671", email: "sarah@example.com",
    source: "instagram", message: "I'd love to book a gel manicure for Saturday!",
    appointment_confirmed: "true",
  });
  await sleep(50);
  await runSmsReply("+14155552671", "CONFIRM");
  await sleep(50);

  console.log("\n── Assertions ──");
  assertCount("Retell calls",   calls.retell,   1);
  assertCount("Slack alerts",   calls.slack,    0);
  assertCount("Airtable ops",   calls.airtable, 3); // create + service_complete + (lookup is GET)
  assertCount("Twilio SMS",     calls.twilio,   3); // reminder + review request + loyalty
  assertSmsContains("Reminder SMS sent",       calls.twilio, "reminder for your nail appointment");
  assertSmsContains("Review request sent",     calls.twilio, "Google review");
  assertSmsContains("Loyalty offer sent",      calls.twilio, "10% off");
  assert("CRM create happened",    calls.airtable.some(a => a.op === "create"));
  assert("CRM status updated",     calls.airtable.some(a => a.op === "update" && a.fields?.Status === "Service Completed"),
    JSON.stringify(calls.airtable.filter(a => a.op === "update")));
  assert("crm_record_id used in update", calls.airtable.filter(a => a.op === "update").every(a => a.id && !a.id.includes("undefined")),
    JSON.stringify(calls.airtable.filter(a => a.op === "update").map(a => a.id)));

  await sleep(100);

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 2: AI offline — Slack alert, then happy path
  // ────────────────────────────────────────────────────────────────────────
  reset();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 2 — AI offline: Slack fallback, then CONFIRM reply");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "false";
  await runInquiry({
    name: "Mia Torres", phone: "+14155559988", email: "mia@example.com",
    source: "google", message: "Can I get a pedicure on Friday?",
    appointment_confirmed: "true",
  });
  await sleep(50);
  await runSmsReply("+14155559988", "CONFIRM");
  await sleep(50);

  console.log("\n── Assertions ──");
  assertCount("Retell calls",  calls.retell,  0);
  assertCount("Slack alerts",  calls.slack,   1);
  assert("Slack message targets correct channel", calls.slack[0]?.channel === "#nail-salon-leads");
  assertCount("Twilio SMS",    calls.twilio,  3);
  assert("CRM service update used PATCH",
    calls.airtable.some(a => a.op === "update" && a.fields?.Status === "Service Completed"));

  await sleep(100);

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 3: Appointment not confirmed by stylist — immediate reschedule
  // ────────────────────────────────────────────────────────────────────────
  reset();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 3 — Appt NOT confirmed by stylist → reschedule");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "true";
  await runInquiry({
    name: "Priya Patel", phone: "+14155551234", email: "priya@example.com",
    source: "facebook", message: "Need an appointment ASAP!",
    appointment_confirmed: "false",
  });
  await sleep(50);

  console.log("\n── Assertions ──");
  assertCount("Retell calls",   calls.retell,   1);
  assertCount("Twilio SMS",     calls.twilio,   1); // only reschedule SMS, no reminder
  assertSmsContains("Reschedule link in SMS", calls.twilio, "reschedule");
  assert("No reminder SMS sent",  !calls.twilio.some(s => s.Body?.includes("appointment tomorrow")));
  assert("CRM updated to Rescheduled",
    calls.airtable.some(a => a.op === "update" && a.fields?.Status === "Rescheduled"));
  assert("Rescheduled PATCH used correct id",
    calls.airtable.filter(a => a.op === "update").every(a => a.id && !a.id.includes("undefined")));

  await sleep(100);

  // ────────────────────────────────────────────────────────────────────────
  // Scenario 4: Client replies CANCEL to reminder
  // ────────────────────────────────────────────────────────────────────────
  reset();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 4 — Client replies CANCEL to reminder");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "true";
  await runInquiry({
    name: "Dana Lee", phone: "+14155558877", email: "dana@example.com",
    source: "messenger", message: "Hi, I want to book a nail appointment.",
    appointment_confirmed: "true",
  });
  await sleep(50);
  await runSmsReply("+14155558877", "cancel"); // lowercase to test .toUpperCase() normalisation
  await sleep(50);

  console.log("\n── Assertions ──");
  assertCount("Twilio SMS",        calls.twilio,   2); // reminder + reschedule
  assertSmsContains("Reminder sent",   calls.twilio, "appointment tomorrow");
  assertSmsContains("Reschedule sent", calls.twilio, "reschedule");
  assert("No review request sent", !calls.twilio.some(s => s.Body?.includes("Google review")));
  assert("CRM updated to Rescheduled",
    calls.airtable.some(a => a.op === "update" && a.fields?.Status === "Rescheduled"));

  // ────────────────────────────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────────────────────────────
  console.log("\n\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Test Results                                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  servers.forEach((s) => s.close());
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
