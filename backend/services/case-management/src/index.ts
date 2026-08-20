import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Kafka, logLevel, EachMessagePayload } from 'kafkajs';
import dotenv from 'dotenv';
import winston from 'winston';
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
const PORT = process.env.PORT || 3003;

app.use(express.json());

// --- Kafka ---
const kafka = new Kafka({
  clientId: 'case-management',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: 'case-management-group' });
const producer = kafka.producer();

// --- PostgreSQL ---
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'case_management',
  user: process.env.PG_USER || 'aisena',
  password: process.env.PG_PASSWORD || 'aisena_pw',
});

// --- Case Model ---
type CaseStatus = 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'CLOSED';
type AssignedType = 'AI' | 'HUMAN';

interface Case {
  caseId: string;
  transactionId: string;
  screeningId: string;
  status: CaseStatus;
  assignedTo: string;
  assignedType: AssignedType;
  reason: string;
  riskScore: number;
  createdAt: string;
  updatedAt: string;
  reviewer?: string;
  notes?: string;
}

// In-memory store (for local dev without PostgreSQL)
const cases: Map<string, Case> = new Map();

// --- Initialize Database ---
async function initDb(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS cases (
        case_id UUID PRIMARY KEY,
        transaction_id VARCHAR(255) NOT NULL,
        screening_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL,
        assigned_to VARCHAR(255) NOT NULL,
        assigned_type VARCHAR(10) NOT NULL,
        reason TEXT,
        risk_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        reviewer VARCHAR(255),
        notes TEXT
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
  res.json({ status: 'ok', service: 'case-management', timestamp: new Date().toISOString() });
});

// --- Case Management API ---

// Create a case (called by Temporal workflow or directly)
app.post('/api/cases', (req: Request, res: Response) => {
  const { transactionId, screeningId, reason, riskScore, assignedTo, assignedType } = req.body;

  if (!transactionId || !screeningId || !reason || riskScore === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const caseId = randomUUID();
  const now = new Date().toISOString();

  const newCase: Case = {
    caseId,
    transactionId,
    screeningId,
    status: 'OPEN',
    assignedTo: assignedTo || 'ai-triage-001',
    assignedType: assignedType || 'AI',
    reason,
    riskScore,
    createdAt: now,
    updatedAt: now,
  };

  cases.set(caseId, newCase);

  // Persist to DB if available
  pool.query(
    'INSERT INTO cases (case_id, transaction_id, screening_id, status, assigned_to, assigned_type, reason, risk_score, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [caseId, transactionId, screeningId, 'OPEN', newCase.assignedTo, newCase.assignedType, reason, riskScore, now, now]
  ).catch(err => logger.warn('DB insert failed', { error: err }));

  // Publish case.created event
  const event = {
    eventId: randomUUID(),
    caseId,
    transactionId,
    screeningId,
    occurredAt: now,
    status: 'OPEN',
    assignedTo: newCase.assignedTo,
    assignedType: newCase.assignedType,
    reason,
    riskScore,
  };

  producer.send({
    topic: 'case.created',
    messages: [{ key: caseId, value: JSON.stringify(event) }],
  }).catch(err => logger.error('Failed to publish case.created', { error: err }));

  logger.info('Case created', { caseId, transactionId });

  res.status(201).json(newCase);
});

// Get a case by ID
app.get('/api/cases/:caseId', (req: Request, res: Response) => {
  const c = cases.get(req.params.caseId);
  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json(c);
});

// Update case status
app.patch('/api/cases/:caseId/status', (req: Request, res: Response) => {
  const { status, decision, reviewer, notes } = req.body;
  const c = cases.get(req.params.caseId);
  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const oldStatus = c.status;
  c.status = status;
  c.updatedAt = new Date().toISOString();
  if (reviewer) c.reviewer = reviewer;
  if (notes) c.notes = notes;

  // Publish appropriate event based on status transition
  if (status === 'ESCALATED') {
    const event = {
      eventId: randomUUID(),
      caseId: c.caseId,
      transactionId: c.transactionId,
      occurredAt: c.updatedAt,
      reason: c.reason,
      escalatedTo: reviewer || 'compliance-team',
      notes: notes || '',
    };
    producer.send({
      topic: 'case.escalated',
      messages: [{ key: c.caseId, value: JSON.stringify(event) }],
    }).catch(err => logger.error('Failed to publish case.escalated', { error: err }));
  }

  if (status === 'CLOSED') {
    const event = {
      eventId: randomUUID(),
      caseId: c.caseId,
      transactionId: c.transactionId,
      occurredAt: c.updatedAt,
      decision: decision || 'APPROVED',
      reviewer: reviewer || 'system',
      notes: notes || '',
    };
    producer.send({
      topic: 'case.closed',
      messages: [{ key: c.caseId, value: JSON.stringify(event) }],
    }).catch(err => logger.error('Failed to publish case.closed', { error: err }));
  }

  logger.info('Case status updated', { caseId: c.caseId, oldStatus, newStatus: status });

  res.json(c);
});

// List cases
app.get('/api/cases', (_req: Request, res: Response) => {
  const allCases = Array.from(cases.values());
  res.json({ cases: allCases, count: allCases.length });
});

// --- Kafka Consumer: screening.completed ---
async function handleScreeningCompleted(payload: EachMessagePayload): Promise<void> {
  const event = JSON.parse(payload.message.value!.toString());
  logger.info('Received screening.completed event', { transactionId: event.transactionId });

  if (event.status === 'FLAG') {
    // Auto-create a case for flagged transactions
    const caseId = randomUUID();
    const now = new Date().toISOString();

    const newCase: Case = {
      caseId,
      transactionId: event.transactionId,
      screeningId: event.screeningId,
      status: 'OPEN',
      assignedTo: 'ai-triage-001',
      assignedType: 'AI',
      reason: `Flagged by rules: ${event.rulesMatched.join(', ')}`,
      riskScore: event.riskScore,
      createdAt: now,
      updatedAt: now,
    };

    cases.set(caseId, newCase);

    await pool.query(
      'INSERT INTO cases (case_id, transaction_id, screening_id, status, assigned_to, assigned_type, reason, risk_score, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [caseId, event.transactionId, event.screeningId, 'OPEN', 'ai-triage-001', 'AI', newCase.reason, event.riskScore, now, now]
    );

    const eventPayload = {
      eventId: randomUUID(),
      caseId,
      transactionId: event.transactionId,
      screeningId: event.screeningId,
      occurredAt: now,
      status: 'OPEN',
      assignedTo: 'ai-triage-001',
      assignedType: 'AI',
      reason: newCase.reason,
      riskScore: event.riskScore,
    };

    await producer.send({
      topic: 'case.created',
      messages: [{ key: caseId, value: JSON.stringify(eventPayload) }],
    });

    logger.info('Case auto-created from screening flag', { caseId, transactionId: event.transactionId });
  } else {
    logger.info('Screening passed, no case created', { transactionId: event.transactionId });
  }
}

// --- Start Server ---
async function start(): Promise<void> {
  await initDb();
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'screening.completed', fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      if (payload.topic === 'screening.completed') {
        await handleScreeningCompleted(payload);
      }
    },
  });

  logger.info('Kafka consumer connected and subscribed to screening.completed');

  app.listen(PORT, () => {
    logger.info(`Case Management listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start Case Management', { error: err });
  process.exit(1);
});

export { app };
