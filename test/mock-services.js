/**
 * Mock servers for Retell AI, Twilio, Airtable, and Slack.
 * Each records calls so the test runner can assert on them.
 */
const http = require("http");

const calls = { retell: [], twilio: [], airtable: [], slack: [] };

function reset() {
  calls.retell.length = 0;
  calls.twilio.length = 0;
  calls.airtable.length = 0;
  calls.slack.length = 0;
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
  });
}

function startRetell(port = 4001) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/v2/create-phone-call") {
      const payload = await body(req);
      calls.retell.push(payload);
      console.log("[Retell AI] Outbound call →", JSON.stringify(payload));
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
      console.log(`[Twilio]   SMS → To=${payload.To} Body="${payload.Body}"`);
      return json(res, 201, { sid: "SM_mock_001", status: "queued" });
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(port);
  return server;
}

function startAirtable(port = 4003) {
  const records = {};
  const server = http.createServer(async (req, res) => {
    const payload = await body(req);

    if (req.method === "GET" && req.url.includes("?")) {
      // List with filter — return a matching mock record
      const phone = decodeURIComponent(req.url).match(/Phone.*?'(\+\d+)'/)?.[1] ?? "+10000000000";
      const id = Object.keys(records).find((k) => records[k]?.fields?.Phone === phone) ?? `rec_${Date.now()}`;
      const rec = records[id] ?? { id, fields: { Name: "Unknown", Phone: phone } };
      calls.airtable.push({ op: "list", id: rec.id, phone });
      console.log(`[Airtable] List lookup → phone=${phone} id=${rec.id}`);
      return json(res, 200, { records: [rec] });
    }

    if (req.method === "POST") {
      const id = `rec_${Date.now()}`;
      records[id] = { id, fields: payload.fields ?? {} };
      calls.airtable.push({ op: "create", id, ...payload });
      console.log(`[Airtable] Create → id=${id} Status="${payload.fields?.Status}"`);
      return json(res, 200, { id, fields: payload.fields ?? {} });
    }

    if (req.method === "PATCH") {
      const id = req.url.split("/").pop();
      if (records[id]) Object.assign(records[id].fields, payload.fields ?? {});
      calls.airtable.push({ op: "update", id, ...payload });
      console.log(`[Airtable] Update → id=${id} Status="${payload.fields?.Status}"`);
      return json(res, 200, { id, fields: payload.fields ?? {} });
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
      console.log("[Slack]    Alert →", payload.channel);
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(port);
  return server;
}

module.exports = { startRetell, startTwilio, startAirtable, startSlack, calls, reset };
