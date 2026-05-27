/**
 * Test runner — starts all mock services, runs three scenario paths, then exits.
 *
 *   node test/run-test.js
 *
 * Scenarios:
 *   1. Happy path  — AI active, appointment confirmed, review left
 *   2. No-AI path  — AI offline → Slack alert, then reschedule
 *   3. Cancel path — AI active, appointment confirmed, client cancels reminder reply
 */
const { startRetell, startTwilio, startAirtable, startSlack, calls } = require("./mock-services");
const { runWorkflow } = require("./workflow-runner");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Start mock servers
  const servers = [startRetell(4001), startTwilio(4002), startAirtable(4003), startSlack(4004)];
  await sleep(100); // let ports bind

  console.log("Mock services listening:");
  console.log("  Retell AI  → http://localhost:4001");
  console.log("  Twilio     → http://localhost:4002");
  console.log("  Airtable   → http://localhost:4003");
  console.log("  Slack      → http://localhost:4004");

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 1: Happy path
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 1 — Happy path (AI active, confirmed, review left)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "true";
  await runWorkflow({
    name: "Sarah Kim",
    phone: "+14155552671",
    email: "sarah@example.com",
    source: "instagram",
    message: "Hi! I'd love to book a gel manicure for next Saturday.",
    appointment_confirmed: "true",
    final_confirm: "CONFIRM",
    review_received: "true",
  });

  await sleep(200);

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 2: AI offline → Slack + reschedule
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 2 — AI offline: Slack alert, appt not confirmed");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "false";
  await runWorkflow({
    name: "Mia Torres",
    phone: "+14155559988",
    email: "mia@example.com",
    source: "google",
    message: "Can I get a pedicure on Friday?",
    appointment_confirmed: "false",
  });

  await sleep(200);

  // ──────────────────────────────────────────────────────────────────────
  // Scenario 3: Client cancels on reminder reply
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SCENARIO 3 — AI active, confirmed, but client replies CANCEL");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.env.AI_AGENT_ACTIVE = "true";
  await runWorkflow({
    name: "Priya Patel",
    phone: "+14155551234",
    email: "priya@example.com",
    source: "facebook",
    message: "Hey, I need an appointment ASAP!",
    appointment_confirmed: "true",
    final_confirm: "CANCEL",
  });

  // ──────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────
  console.log("\n\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Test Summary                                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Retell AI calls  : ${calls.retell.length}`);
  console.log(`  Twilio SMS       : ${calls.twilio.length}`);
  console.log(`  Airtable ops     : ${calls.airtable.length}`);
  console.log(`  Slack alerts     : ${calls.slack.length}`);

  servers.forEach((s) => s.close());
  process.exit(0);
}

main().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
