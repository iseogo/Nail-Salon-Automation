/**
 * Mock servers for Retell AI, Twilio, Airtable, and Slack.
 * Each records calls so the test runner can assert on them.
 */
const http = require("http");

const calls = { retell: [], twilio: [], airtable: [], slack: [] };

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

function startRetell(port = 4001) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/v2/create-phone-call") {
      const payload = await body(req);
      calls.retell.push(payload);
      console.log("[Retell AI] Outbound call triggered →", JSON.stringify(payload));
      return json(res, 200, { call_id: "call_mock_001", status: "registered" });
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(port);
  return server;
}

function startTwilio(port = 4002) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      const payload = await body(req);
      calls.twilio.push({ url: req.url, ...payload });
      const label = req.url.includes("Messages") ? "SMS" : "call";
      console.log(`[Twilio]   ${label} →`, JSON.stringify(payload));
      return json(res, 201, { sid: "SM_mock_001", status: "queued" });
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(port);
  return server;
}

function startAirtable(port = 4003) {
  const records = [];
  const server = http.createServer(async (req, res) => {
    const payload = await body(req);
    if (req.method === "POST") {
      const id = `rec_${Date.now()}`;
      records.push({ id, ...payload });
      calls.airtable.push({ op: "create", id, ...payload });
      console.log("[Airtable] Record created →", JSON.stringify(payload));
      return json(res, 200, { id, fields: payload.fields ?? {} });
    }
    if (req.method === "PATCH") {
      calls.airtable.push({ op: "update", ...payload });
      console.log("[Airtable] Record updated →", JSON.stringify(payload));
      return json(res, 200, { id: payload.id, fields: payload.fields ?? {} });
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(port);
  return server;
}

function startSlack(port = 4004) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      const payload = await body(req);
      calls.slack.push(payload);
      console.log("[Slack]    Message →", JSON.stringify(payload));
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(port);
  return server;
}

module.exports = { startRetell, startTwilio, startAirtable, startSlack, calls };
