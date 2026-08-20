import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Kafka, logLevel, EachMessagePayload } from 'kafkajs';
import dotenv from 'dotenv';
import winston from 'winston';
import axios from 'axios';
import { Pool } from 'pg';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// --- Kafka ---
const kafka = new Kafka({
  clientId: 'audit-notification',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: 'audit-notification-group' });

// --- PostgreSQL ---
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'audit_log',
  user: process.env.PG_USER || 'aisena',
  password: process.env.PG_PASSWORD || 'aisena_pw',
});

// --- Audit Log Model ---
interface AuditEntry {
  id: string;
  eventType: string;
  transactionId?: string;
  caseId?: string;
  screeningId?: string;
  actor: string;
  action: string;
  outcome: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// In-memory store (for local dev without PostgreSQL)
const auditLog: AuditEntry[] = [];

// --- Initialize Database ---
async function initDb(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        transaction_id VARCHAR(255),
        case_id VARCHAR(255),
        screening_id UUID,
        actor VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        outcome VARCHAR(50) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
    client.release();
    logger.info('Database initialized');
  } catch (err) {
    logger.warn('Database not available, using in-memory store', { error: err });
  }
}

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'audit-notification', timestamp: new Date().toISOString() });
});

// --- Audit Log API ---
app.get('/api/audit', (_req: Request, res: Response) => {
  res.json({ entries: auditLog, count: auditLog.length });
});

app.post('/api/audit', (req: Request, res: Response) => {
  const { eventType, details = {}, timestamp } = req.body;
  if (!eventType) {
    return res.status(400).json({ error: 'Missing required field: eventType' });
  }

  const entry: AuditEntry = {
    id: randomUUID(),
    eventType,
    transactionId: details.transactionId,
    caseId: details.caseId,
    screeningId: details.screeningId,
    actor: details.actor || details.reviewer || 'temporal-workflow',
    action: eventType,
    outcome: details.status || details.decision || 'processed',
    details,
    timestamp: timestamp || new Date().toISOString(),
  };
  recordAuditEntry(entry);
  res.status(201).json(entry);
});

app.get('/api/audit/:id', (req: Request, res: Response) => {
  const entry = auditLog.find(e => e.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Audit entry not found' });
  }
  res.json(entry);
});

// --- Alerting ---
async function sendAlert(eventType: string, details: Record<string, unknown>): Promise<void> {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhook) {
    logger.info('No Slack webhook configured, skipping alert', { eventType });
    return;
  }

  try {
    await axios.post(slackWebhook, {
      text: `🚨 HSFS Alert: ${eventType}`,
      attachments: [
        {
          color: 'danger',
          fields: Object.entries(details).map(([key, value]) => ({
            title: key,
            value: JSON.stringify(value),
            short: false,
          })),
        },
      ],
    });
    logger.info('Alert sent to Slack', { eventType });
  } catch (err) {
    logger.error('Failed to send Slack alert', { eventType, error: err });
  }
}

// --- Kafka Consumer ---
// Consumes all event types and logs them to the audit log
const TOPICS = [
  'screening.requested',
  'screening.completed',
  'case.created',
  'case.escalated',
  'case.closed',
  'case.triage.completed',
  'enrichment.completed',
];

async function handleEvent(payload: EachMessagePayload): Promise<void> {
  const event = JSON.parse(payload.message.value!.toString());
  const eventType = payload.topic;

  const entry: AuditEntry = {
    id: randomUUID(),
    eventType,
    transactionId: event.transactionId,
    caseId: event.caseId,
    screeningId: event.screeningId,
    actor: event.occurredBy || event.reviewer || event.agentId || 'system',
    action: eventType,
    outcome: event.status || event.decision || event.assignedType || 'processed',
    details: event,
    timestamp: event.occurredAt || new Date().toISOString(),
  };

  recordAuditEntry(entry);

  logger.info('Audit entry recorded', { eventType, transactionId: event.transactionId, caseId: event.caseId });

  // Send alerts for high-risk events
  if (eventType === 'case.escalated' || (event.riskScore && event.riskScore >= 80)) {
    await sendAlert(eventType, event);
  }
}

function recordAuditEntry(entry: AuditEntry): void {
  auditLog.push(entry);
  pool.query(
    'INSERT INTO audit_log (id, event_type, transaction_id, case_id, screening_id, actor, action, outcome, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [entry.id, entry.eventType, entry.transactionId, entry.caseId, entry.screeningId, entry.actor, entry.action, entry.outcome, JSON.stringify(entry.details), entry.timestamp]
  ).catch(err => logger.warn('DB insert failed', { error: err }));
}

// --- Start Server ---
async function start(): Promise<void> {
  await initDb();
  await consumer.connect();

  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      await handleEvent(payload);
    },
  });

  logger.info('Kafka consumer connected and subscribed to all event topics', { topics: TOPICS });

  app.listen(PORT, () => {
    logger.info(`Audit & Notification Service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start Audit & Notification Service', { error: err });
  process.exit(1);
});

export { app };
