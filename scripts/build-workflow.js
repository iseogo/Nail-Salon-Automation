const fs = require('fs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AIRTABLE_CRED = { airtableTokenApi: { id: 'Q1ybIQd7JiDWiCUt', name: 'Airtable Personal Access Token account 2' } };
const BASE_ID = 'appfny2KmS3mvwB1d';
const airtableBase = (tableId) => ({
  base: { __rl: true, value: BASE_ID, mode: 'id' },
  table: { __rl: true, value: tableId, mode: 'id' }
});

// SignalWire SMS node parameters (reused across sections)
function swSmsParams(toExpr, bodyExpr) {
  return {
    method: 'POST',
    url: "={{ `https://${$env.SIGNALWIRE_SPACE}.signalwire.com/api/laml/2010-04-01/Accounts/${$env.SIGNALWIRE_ACCOUNT_SID}/Messages.json` }}",
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Authorization', value: "={{ 'Basic ' + Buffer.from($env.SIGNALWIRE_ACCOUNT_SID + ':' + $env.SIGNALWIRE_AUTH_TOKEN).toString('base64') }}" }] },
    sendBody: true,
    contentType: 'form',
    bodyParameters: { parameters: [
      { name: 'From', value: '={{ $env.SIGNALWIRE_FROM_NUMBER }}' },
      { name: 'To', value: toExpr },
      { name: 'Body', value: bodyExpr }
    ] },
    options: {}
  };
}

function ifNotEmpty(field) {
  return {
    conditions: {
      options: { caseSensitive: false, typeValidation: 'strict', version: 1 },
      conditions: [{ leftValue: field, operator: { type: 'string', operation: 'notEmpty' } }],
      combinator: 'and'
    },
    options: {}
  };
}

// Airtable schema helpers
function strField(id, defaultMatch = false) {
  return { id, displayName: id, required: false, defaultMatch, canBeUsedToMatch: true, display: true, type: 'string', readOnly: false, removed: false };
}
function boolField(id) {
  return { id, displayName: id, required: false, defaultMatch: false, canBeUsedToMatch: true, display: true, type: 'boolean', readOnly: false, removed: false };
}
function idField() {
  return { id: 'id', displayName: 'id', required: false, defaultMatch: true, display: true, type: 'string', readOnly: true, removed: false };
}

// ─── NODES ────────────────────────────────────────────────────────────────────

const nodes = [

  // ── SECTION 1: INBOUND SMS / LEAD CAPTURE ─────────────────────────────────

  {
    parameters: { httpMethod: 'POST', path: 'nail-salon-inbound', responseMode: 'responseNode', options: {} },
    id: 'node-01', name: 'Inbound SMS',
    type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [-200, 400],
    webhookId: 'cf7abe9f-0b5c-4142-b926-f5a5c36513ee'
  },

  {
    parameters: {
      jsCode: [
        '// Normalize inbound message from SignalWire (Twilio-compatible)',
        'const body = $input.first().json;',
        "const from = body.From || body.from || body.msisdn || '';",
        "const text = body.Body || body.body || body.text || body.message || '';",
        "const messageId = body.MessageSid || body.messageId || Date.now().toString();",
        "const channel = body.channel || (body.AccountSid || body.From ? 'signalwire' : 'unknown');",
        'return [{ json: {',
        "  from: from.replace(/\\D/g, '').replace(/^1/, ''),",
        '  fromRaw: from,',
        '  text: text.trim(),',
        '  messageId, channel,',
        '  receivedAt: new Date().toISOString()',
        '} }];'
      ].join('\n')
    },
    id: 'node-02', name: 'Normalize Message',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [20, 400]
  },

  {
    parameters: {
      operation: 'search',
      ...airtableBase('tblce4qtIroD8fzq9'),
      filterByFormula: "={{ \"{Phone}='\" + $json.from + \"'\" }}",
      options: {}
    },
    alwaysOutputData: true,
    id: 'node-03', name: 'Check Client in CRM',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [240, 400],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: ifNotEmpty('={{ $json.id }}'),
    id: 'node-04', name: 'Client Exists?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [460, 400]
  },

  {
    parameters: {
      operation: 'create',
      ...airtableBase('tblce4qtIroD8fzq9'),
      columns: {
        mappingMode: 'defineBelow',
        value: {
          Phone: "={{ $('Normalize Message').item.json.from }}",
          Status: 'New Lead',
          Channel: "={{ $('Normalize Message').item.json.channel }}",
          FirstContactAt: "={{ $('Normalize Message').item.json.receivedAt }}",
          LastMessageAt: "={{ $('Normalize Message').item.json.receivedAt }}"
        },
        matchingColumns: [],
        schema: ['Phone','Status','Channel','FirstContactAt','LastMessageAt'].map(id => strField(id)),
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-05', name: 'Create New Client',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [680, 260],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: {
      operation: 'update',
      ...airtableBase('tblce4qtIroD8fzq9'),
      columns: {
        mappingMode: 'defineBelow',
        value: {
          Phone: "={{ $('Normalize Message').item.json.from }}",
          LastMessageAt: "={{ $('Normalize Message').item.json.receivedAt }}"
        },
        matchingColumns: ['Phone'],
        schema: [{ ...strField('Phone'), defaultMatch: true }, strField('LastMessageAt')],
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-06', name: 'Update Existing Client',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [680, 540],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: { mode: 'manual', duplicateItem: false, assignments: { assignments: [{ id: 'f1', name: 'isNewClient', value: true, type: 'boolean' }] }, includeOtherFields: true, options: {} },
    id: 'node-07', name: 'Set New Client Flag',
    type: 'n8n-nodes-base.set', typeVersion: 3, position: [900, 260]
  },

  {
    parameters: { mode: 'manual', duplicateItem: false, assignments: { assignments: [{ id: 'f2', name: 'isNewClient', value: false, type: 'boolean' }] }, includeOtherFields: true, options: {} },
    id: 'node-08', name: 'Set Existing Client Flag',
    type: 'n8n-nodes-base.set', typeVersion: 3, position: [900, 540]
  },

  {
    parameters: { mode: 'append', options: {} },
    id: 'node-09', name: 'Merge Paths',
    type: 'n8n-nodes-base.merge', typeVersion: 2.1, position: [1120, 400]
  },

  {
    parameters: {
      operation: 'create',
      ...airtableBase('tblELvjqtmsFWpvMb'),
      columns: {
        mappingMode: 'defineBelow',
        value: {
          Phone: "={{ $('Normalize Message').item.json.from }}",
          Message: "={{ $('Normalize Message').item.json.text }}",
          Direction: 'Inbound',
          ReceivedAt: "={{ $('Normalize Message').item.json.receivedAt }}"
        },
        matchingColumns: [],
        schema: ['Phone','Message','Direction','ReceivedAt'].map(id => strField(id)),
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-10', name: 'Log Message to CRM',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [1340, 400],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: {
      method: 'POST',
      url: '={{ $env.N8N_WEBHOOK_URL }}/webhook/nail-salon-ai-brain',
      sendBody: true,
      bodyParameters: { parameters: [
        { name: 'phone', value: "={{ $('Normalize Message').item.json.from }}" },
        { name: 'message', value: "={{ $('Normalize Message').item.json.text }}" },
        { name: 'isNewClient', value: "={{ $('Merge Paths').item.json.isNewClient }}" },
        { name: 'channel', value: "={{ $('Normalize Message').item.json.channel }}" }
      ] },
      options: {}
    },
    id: 'node-11', name: 'Route to AI Brain',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [1560, 400]
  },

  {
    parameters: { respondWith: 'json', responseBody: '{ "status": "received" }', options: {} },
    id: 'node-12', name: 'Respond 200 OK',
    type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [1780, 400]
  },

  // ── SECTION 2: AI BRAIN (BELLA) ────────────────────────────────────────────

  {
    parameters: { httpMethod: 'POST', path: 'nail-salon-ai-brain', responseMode: 'responseNode', options: {} },
    id: 'node-13', name: 'AI Brain Trigger',
    type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [-200, 1200]
  },

  {
    parameters: {
      operation: 'search',
      ...airtableBase('tblELvjqtmsFWpvMb'),
      filterByFormula: "={{ \"AND({Phone}='\" + $json.phone + \"', {Direction}='Inbound')\" }}",
      options: { sort: [{ field: 'ReceivedAt', direction: 'desc' }], maxRecords: 10 }
    },
    alwaysOutputData: true,
    id: 'node-14', name: 'Get Conversation History',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [20, 1200],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: {
      jsCode: [
        'const allItems = $input.all();',
        "const trigger = $('AI Brain Trigger').first().json;",
        '',
        "const systemPrompt = `You are Bella, the friendly AI receptionist for a nail salon. You help clients book appointments, answer questions, and handle cancellations.\\n\\nSERVICES: Manicure ($25), Pedicure ($35), Gel Nails ($45), Acrylic Full Set ($55), Nail Art (+$10-20), Waxing ($15-30).\\nHOURS: Mon-Sat 9AM-7PM, Sun 10AM-5PM.\\nFor booking: collect name, service, preferred date/time. Always confirm before finalizing.\\n\\nRESPOND in JSON only:\\n{\\\"intent\\\":\\\"BOOKING|FAQ|CANCEL|RESCHEDULE|REVIEW|ESCALATE|GREETING\\\",\\\"reply\\\":\\\"SMS reply max 160 chars\\\",\\\"extractedData\\\":{\\\"name\\\":null,\\\"service\\\":null,\\\"preferredDate\\\":null,\\\"preferredTime\\\":null},\\\"readyToBook\\\":false}`;",
        '',
        'const history = allItems',
        '  .filter(item => item.json && item.json.Message)',
        '  .reverse()',
        "  .map(item => ({ role: item.json.Direction === 'Inbound' ? 'user' : 'assistant', content: item.json.Message }));",
        '',
        "history.push({ role: 'user', content: trigger.message });",
        '',
        'return [{ json: {',
        "  messages: [{ role: 'system', content: systemPrompt }, ...history],",
        '  phone: trigger.phone,',
        '  isNewClient: trigger.isNewClient',
        '} }];'
      ].join('\n')
    },
    id: 'node-15', name: 'Build Context',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [240, 1200]
  },

  {
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: 'Authorization', value: "={{ 'Bearer ' + $env.OPENAI_API_KEY }}" },
        { name: 'Content-Type', value: 'application/json' }
      ] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ model: 'gpt-4o-mini', messages: $json.messages, max_tokens: 300, temperature: 0.3 }) }}",
      options: {}
    },
    id: 'node-16', name: 'Bella (GPT-4o-mini)',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [460, 1200]
  },

  {
    parameters: {
      jsCode: [
        'const raw = $input.first().json.choices[0].message.content;',
        'let parsed;',
        'try {',
        "  const cleaned = raw.replace(/```json\\n?/g, '').replace(/```/g, '').trim();",
        '  parsed = JSON.parse(cleaned);',
        '} catch(e) {',
        "  parsed = { intent: 'ESCALATE', reply: 'Hi! Let me connect you with our team. One moment!', extractedData: {}, readyToBook: false };",
        '}',
        "return [{ json: { ...parsed, phone: $('AI Brain Trigger').first().json.phone } }];"
      ].join('\n')
    },
    id: 'node-17', name: 'Parse Bella Response',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [680, 1200]
  },

  {
    parameters: {
      conditions: {
        options: { caseSensitive: false, typeValidation: 'strict', version: 1 },
        conditions: [{ leftValue: '={{ $json.intent }}', rightValue: 'BOOKING', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'node-18', name: 'Is Booking?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [900, 1200]
  },

  {
    parameters: {
      conditions: {
        options: { caseSensitive: false, typeValidation: 'strict', version: 1 },
        conditions: [{ leftValue: '={{ $json.readyToBook }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'node-19', name: 'Ready to Confirm?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [1120, 1060]
  },

  {
    parameters: {
      operation: 'create',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          Phone: "={{ $('Parse Bella Response').item.json.phone }}",
          ClientName: "={{ $('Parse Bella Response').item.json.extractedData.name || 'Unknown' }}",
          Service: "={{ $('Parse Bella Response').item.json.extractedData.service }}",
          PreferredDate: "={{ $('Parse Bella Response').item.json.extractedData.preferredDate }}",
          PreferredTime: "={{ $('Parse Bella Response').item.json.extractedData.preferredTime }}",
          Status: 'Pending Confirmation',
          BookedVia: 'SMS/AI',
          CreatedAt: '={{ new Date().toISOString() }}'
        },
        matchingColumns: [],
        schema: ['Phone','ClientName','Service','PreferredDate','PreferredTime','Status','BookedVia','CreatedAt'].map(id => strField(id)),
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-20', name: 'Create Appointment',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [1340, 920],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: {
      conditions: {
        options: { caseSensitive: false, typeValidation: 'strict', version: 1 },
        conditions: [{ leftValue: '={{ $json.intent }}', rightValue: 'ESCALATE', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    },
    id: 'node-21', name: 'Needs Escalation?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [1120, 1340]
  },

  {
    parameters: swSmsParams(
      '={{ $env.SALON_PHONE }}',
      "={{ '🚨 Staff Alert: Client ' + $('AI Brain Trigger').first().json.phone + ' needs help. Message: ' + $('AI Brain Trigger').first().json.message }}"
    ),
    id: 'node-22', name: 'Notify Staff',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [1340, 1400]
  },

  {
    parameters: swSmsParams(
      "={{ $('Parse Bella Response').item.json.phone }}",
      "={{ $('Parse Bella Response').item.json.reply }}"
    ),
    id: 'node-23', name: 'Send Reply SMS',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [1560, 1200]
  },

  {
    parameters: {
      operation: 'create',
      ...airtableBase('tblELvjqtmsFWpvMb'),
      columns: {
        mappingMode: 'defineBelow',
        value: {
          Phone: "={{ $('AI Brain Trigger').first().json.phone }}",
          Message: "={{ $('Parse Bella Response').item.json.reply }}",
          Direction: 'Outbound',
          Intent: "={{ $('Parse Bella Response').item.json.intent }}",
          ReceivedAt: '={{ new Date().toISOString() }}'
        },
        matchingColumns: [],
        schema: ['Phone','Message','Direction','Intent','ReceivedAt'].map(id => strField(id)),
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-24', name: 'Log Outbound Reply',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [1780, 1200],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: { respondWith: 'json', responseBody: '{ "status": "processed" }', options: {} },
    id: 'node-25', name: 'Done',
    type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [2000, 1200]
  },

  // ── SECTION 3: SMS APPOINTMENT REMINDERS (Daily 8AM) ───────────────────────

  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * *' }] } },
    id: 'node-26', name: 'Daily 8AM Trigger',
    type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1, position: [-200, 2000]
  },

  {
    parameters: {
      jsCode: [
        'const now = new Date();',
        'const tomorrow = new Date(now);',
        'tomorrow.setDate(tomorrow.getDate() + 1);',
        "return [{ json: { tomorrowStr: tomorrow.toISOString().split('T')[0], todayStr: now.toISOString().split('T')[0] } }];"
      ].join('\n')
    },
    id: 'node-27', name: 'Calculate Target Dates',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [20, 2000]
  },

  {
    parameters: {
      operation: 'search',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      filterByFormula: "={{ \"AND({Status}='Confirmed', OR({AppointmentDate}='\" + $json.tomorrowStr + \"', {AppointmentDate}='\" + $json.todayStr + \"'), {ReminderSent}!=TRUE())\" }}",
      options: {}
    },
    alwaysOutputData: true,
    id: 'node-28', name: 'Get Upcoming Appointments',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [240, 2000],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: ifNotEmpty('={{ $json.id }}'),
    id: 'node-29', name: 'Appointments Found?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [460, 2000]
  },

  {
    parameters: {
      jsCode: [
        'const appt = $json;',
        "const today = new Date().toISOString().split('T')[0];",
        'const is24hr = appt.AppointmentDate !== today;',
        "const clientName = appt.ClientName || 'there';",
        "const service = appt.Service || 'your appointment';",
        "const time = appt.AppointmentTime || 'your scheduled time';",
        "const salonName = $env.SALON_NAME || 'your salon';",
        "const salonPhone = $env.SALON_PHONE || '';",
        'const message = is24hr',
        '  ? `Hi ${clientName}! Reminder: your ${service} at ${salonName} is TOMORROW at ${time}. Reply Y to confirm or N to cancel. ${salonPhone}`.trim()',
        '  : `Hi ${clientName}! See you TODAY at ${time} for your ${service} at ${salonName}! Reply Y to confirm or call ${salonPhone} to reschedule.`.trim();',
        "return [{ json: { phone: appt.Phone, message, appointmentId: $json.id, reminderType: is24hr ? '24hr' : '2hr' } }];"
      ].join('\n')
    },
    id: 'node-30', name: 'Build Reminder Message',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [680, 1860]
  },

  {
    parameters: swSmsParams('={{ $json.phone }}', '={{ $json.message }}'),
    id: 'node-31', name: 'Send Reminder SMS',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [900, 1860]
  },

  {
    parameters: {
      operation: 'update',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: "={{ $('Build Reminder Message').item.json.appointmentId }}",
          ReminderSent: true,
          ReminderType: "={{ $('Build Reminder Message').item.json.reminderType }}",
          ReminderSentAt: '={{ new Date().toISOString() }}'
        },
        matchingColumns: ['id'],
        schema: [idField(), boolField('ReminderSent'), strField('ReminderType'), strField('ReminderSentAt')],
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-32', name: 'Mark Reminder Sent',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [1120, 1860],
    credentials: AIRTABLE_CRED
  },

  // ── SECTION 4: NO-SHOW FOLLOW-UP (Daily 7PM) ───────────────────────────────

  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 19 * * *' }] } },
    id: 'node-33', name: 'Evening 7PM Trigger',
    type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1, position: [-200, 2700]
  },

  {
    parameters: {
      operation: 'search',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      filterByFormula: "AND({Status}='No-Show', {NoShowFollowUpSent}!=TRUE(), IS_SAME({AppointmentDate}, TODAY(), 'day'))",
      options: {}
    },
    alwaysOutputData: true,
    id: 'node-34', name: "Get Today's No-Shows",
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [20, 2700],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: ifNotEmpty('={{ $json.id }}'),
    id: 'node-35', name: 'No-Shows Found?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [240, 2700]
  },

  {
    parameters: {
      jsCode: [
        'const appt = $json;',
        "const clientName = appt.ClientName || 'there';",
        "const service = appt.Service || 'your appointment';",
        "const salonName = $env.SALON_NAME || 'your salon';",
        "const salonPhone = $env.SALON_PHONE || '';",
        'const message = `Hi ${clientName}, we missed you today for your ${service} at ${salonName}! We hope everything is okay. Reply REBOOK to schedule a new time, or call ${salonPhone}. We would love to see you!`.trim();',
        "return [{ json: { phone: appt.Phone, message, appointmentId: $json.id } }];"
      ].join('\n')
    },
    id: 'node-36', name: 'Build No-Show Message',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 2560]
  },

  {
    parameters: swSmsParams('={{ $json.phone }}', '={{ $json.message }}'),
    id: 'node-37', name: 'Send No-Show SMS',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [680, 2560]
  },

  {
    parameters: {
      operation: 'update',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: "={{ $('Build No-Show Message').item.json.appointmentId }}",
          NoShowFollowUpSent: true,
          NoShowFollowUpAt: '={{ new Date().toISOString() }}',
          Status: 'No-Show — Followed Up',
          ReactivationEligible: true
        },
        matchingColumns: ['id'],
        schema: [idField(), boolField('NoShowFollowUpSent'), strField('NoShowFollowUpAt'), strField('Status'), boolField('ReactivationEligible')],
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-38', name: 'Update No-Show Record',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [900, 2560],
    credentials: AIRTABLE_CRED
  },

  // ── SECTION 5: REVIEW GENERATION (Every 2 Hours) ───────────────────────────

  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 */2 * * *' }] } },
    id: 'node-39', name: 'Every 2 Hours Trigger',
    type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1, position: [-200, 3400]
  },

  {
    parameters: {
      operation: 'search',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      filterByFormula: "AND({Status}='Completed', {ReviewRequestSent}!=TRUE(), DATETIME_DIFF(NOW(), {CompletedAt}, 'hours') >= 2, DATETIME_DIFF(NOW(), {CompletedAt}, 'hours') < 24)",
      options: {}
    },
    alwaysOutputData: true,
    id: 'node-40', name: 'Get Completed Appointments',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [20, 3400],
    credentials: AIRTABLE_CRED
  },

  {
    parameters: ifNotEmpty('={{ $json.id }}'),
    id: 'node-41', name: 'Completed Found?',
    type: 'n8n-nodes-base.if', typeVersion: 2, position: [240, 3400]
  },

  {
    parameters: {
      jsCode: [
        'const appt = $json;',
        "const clientName = appt.ClientName || 'there';",
        "const service = appt.Service || 'your visit';",
        "const salonName = $env.SALON_NAME || 'our salon';",
        "const googleUrl = $env.SALON_GOOGLE_REVIEW_URL || '';",
        "const yelpUrl = $env.SALON_YELP_URL || '';",
        'const reviewUrl = googleUrl || yelpUrl;',
        "const platform = googleUrl ? 'Google' : 'Yelp';",
        'const message = `Hi ${clientName}! Thanks for visiting ${salonName} for your ${service}! Mind leaving us a quick ${platform} review? It helps us a lot: ${reviewUrl} Thank you!`.trim();',
        "return [{ json: { phone: appt.Phone, message, appointmentId: $json.id, platform } }];"
      ].join('\n')
    },
    id: 'node-42', name: 'Build Review Request',
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 3260]
  },

  {
    parameters: swSmsParams('={{ $json.phone }}', '={{ $json.message }}'),
    id: 'node-43', name: 'Send Review Request SMS',
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: [680, 3260]
  },

  {
    parameters: {
      operation: 'update',
      base: { __rl: true, value: BASE_ID, mode: 'id' },
      table: { __rl: true, value: '={{ $env.AIRTABLE_APPOINTMENTS_TABLE }}', mode: 'id' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          id: "={{ $('Build Review Request').item.json.appointmentId }}",
          ReviewRequestSent: true,
          ReviewRequestSentAt: '={{ new Date().toISOString() }}',
          ReviewPlatform: "={{ $('Build Review Request').item.json.platform }}"
        },
        matchingColumns: ['id'],
        schema: [idField(), boolField('ReviewRequestSent'), strField('ReviewRequestSentAt'), strField('ReviewPlatform')],
        attemptToConvertTypes: false, convertFieldsToString: false
      },
      options: {}
    },
    id: 'node-44', name: 'Mark Review Sent',
    type: 'n8n-nodes-base.airtable', typeVersion: 2, position: [900, 3260],
    credentials: AIRTABLE_CRED
  }

];

// ─── CONNECTIONS ──────────────────────────────────────────────────────────────

const connections = {
  // Section 1
  'Inbound SMS':              { main: [[{ node: 'Normalize Message',          type: 'main', index: 0 }]] },
  'Normalize Message':        { main: [[{ node: 'Check Client in CRM',        type: 'main', index: 0 }]] },
  'Check Client in CRM':      { main: [[{ node: 'Client Exists?',             type: 'main', index: 0 }]] },
  'Client Exists?':           { main: [
    [{ node: 'Update Existing Client',  type: 'main', index: 0 }],
    [{ node: 'Create New Client',       type: 'main', index: 0 }]
  ] },
  'Create New Client':        { main: [[{ node: 'Set New Client Flag',        type: 'main', index: 0 }]] },
  'Update Existing Client':   { main: [[{ node: 'Set Existing Client Flag',   type: 'main', index: 0 }]] },
  'Set New Client Flag':      { main: [[{ node: 'Merge Paths',                type: 'main', index: 0 }]] },
  'Set Existing Client Flag': { main: [[{ node: 'Merge Paths',                type: 'main', index: 1 }]] },
  'Merge Paths':              { main: [[{ node: 'Log Message to CRM',         type: 'main', index: 0 }]] },
  'Log Message to CRM':       { main: [[{ node: 'Route to AI Brain',          type: 'main', index: 0 }]] },
  'Route to AI Brain':        { main: [[{ node: 'Respond 200 OK',             type: 'main', index: 0 }]] },

  // Section 2
  'AI Brain Trigger':         { main: [[{ node: 'Get Conversation History',   type: 'main', index: 0 }]] },
  'Get Conversation History': { main: [[{ node: 'Build Context',              type: 'main', index: 0 }]] },
  'Build Context':            { main: [[{ node: 'Bella (GPT-4o-mini)',        type: 'main', index: 0 }]] },
  'Bella (GPT-4o-mini)':      { main: [[{ node: 'Parse Bella Response',       type: 'main', index: 0 }]] },
  'Parse Bella Response':     { main: [[{ node: 'Is Booking?',                type: 'main', index: 0 }]] },
  'Is Booking?':              { main: [
    [{ node: 'Ready to Confirm?',   type: 'main', index: 0 }],
    [{ node: 'Needs Escalation?',   type: 'main', index: 0 }]
  ] },
  'Ready to Confirm?':        { main: [
    [{ node: 'Create Appointment',  type: 'main', index: 0 }],
    [{ node: 'Send Reply SMS',      type: 'main', index: 0 }]
  ] },
  'Create Appointment':       { main: [[{ node: 'Send Reply SMS',             type: 'main', index: 0 }]] },
  'Needs Escalation?':        { main: [
    [{ node: 'Notify Staff',        type: 'main', index: 0 }],
    [{ node: 'Send Reply SMS',      type: 'main', index: 0 }]
  ] },
  'Notify Staff':             { main: [[{ node: 'Send Reply SMS',             type: 'main', index: 0 }]] },
  'Send Reply SMS':           { main: [[{ node: 'Log Outbound Reply',         type: 'main', index: 0 }]] },
  'Log Outbound Reply':       { main: [[{ node: 'Done',                       type: 'main', index: 0 }]] },

  // Section 3
  'Daily 8AM Trigger':          { main: [[{ node: 'Calculate Target Dates',     type: 'main', index: 0 }]] },
  'Calculate Target Dates':     { main: [[{ node: 'Get Upcoming Appointments',  type: 'main', index: 0 }]] },
  'Get Upcoming Appointments':  { main: [[{ node: 'Appointments Found?',        type: 'main', index: 0 }]] },
  'Appointments Found?':        { main: [[{ node: 'Build Reminder Message',     type: 'main', index: 0 }], []] },
  'Build Reminder Message':     { main: [[{ node: 'Send Reminder SMS',          type: 'main', index: 0 }]] },
  'Send Reminder SMS':          { main: [[{ node: 'Mark Reminder Sent',         type: 'main', index: 0 }]] },

  // Section 4
  'Evening 7PM Trigger':        { main: [[{ node: "Get Today's No-Shows",       type: 'main', index: 0 }]] },
  "Get Today's No-Shows":       { main: [[{ node: 'No-Shows Found?',            type: 'main', index: 0 }]] },
  'No-Shows Found?':            { main: [[{ node: 'Build No-Show Message',      type: 'main', index: 0 }], []] },
  'Build No-Show Message':      { main: [[{ node: 'Send No-Show SMS',           type: 'main', index: 0 }]] },
  'Send No-Show SMS':           { main: [[{ node: 'Update No-Show Record',      type: 'main', index: 0 }]] },

  // Section 5
  'Every 2 Hours Trigger':      { main: [[{ node: 'Get Completed Appointments', type: 'main', index: 0 }]] },
  'Get Completed Appointments': { main: [[{ node: 'Completed Found?',           type: 'main', index: 0 }]] },
  'Completed Found?':           { main: [[{ node: 'Build Review Request',       type: 'main', index: 0 }], []] },
  'Build Review Request':       { main: [[{ node: 'Send Review Request SMS',    type: 'main', index: 0 }]] },
  'Send Review Request SMS':    { main: [[{ node: 'Mark Review Sent',           type: 'main', index: 0 }]] }
};

// ─── OUTPUT ───────────────────────────────────────────────────────────────────

const workflow = {
  name: 'Nail Salon - Complete Automation',
  nodes,
  connections,
  active: false,
  settings: { executionOrder: 'v1' },
  meta: { instanceId: 'b2bdc955a1ecabf3d65a5bbc2329c71ab02610d843ad59a29b66e1e7e4e62ed5' },
  tags: ['nail-salon', 'signalwire', 'complete', 'ai', 'bella']
};

const json = JSON.stringify(workflow, null, 2);

// Validate before writing
try {
  JSON.parse(json);
  fs.writeFileSync('workflows/NailSalon-complete.json', json);
  console.log('SUCCESS');
  console.log('Nodes:', workflow.nodes.length);
  console.log('Connections:', Object.keys(workflow.connections).length);
} catch(e) {
  console.error('INVALID JSON:', e.message);
  process.exit(1);
}
