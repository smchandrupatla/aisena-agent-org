import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Kafka, logLevel, EachMessagePayload } from 'kafkajs';
import dotenv from 'dotenv';
import winston from 'winston';
import axios from 'axios';

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
const PORT = process.env.PORT || 3001;

app.use(express.json());

// --- Kafka ---
const kafka = new Kafka({
  clientId: 'agent-runtime',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: 'agent-runtime-group' });
const producer = kafka.producer();

// --- Agent Config Store ---
// In production, this would load from a database or config service.
// For local dev, we use a simple in-memory store.
interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  config: Record<string, unknown>;
}

const agentConfigs: Map<string, AgentConfig> = new Map();

// Seed with a default AI triage agent
agentConfigs.set('ai-triage-001', {
  id: 'ai-triage-001',
  name: 'AI Triage Agent',
  role: 'triage',
  description: 'Performs initial AI-based triage of flagged cases',
  capabilities: ['sanctions-screening', 'fraud-detection', 'risk-scoring'],
  config: {
    model: 'gpt-4o-mini',
    confidenceThreshold: 0.85,
  },
});

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'agent-runtime', timestamp: new Date().toISOString() });
});

// --- Agent Management Endpoints ---
app.get('/api/agents', (_req: Request, res: Response) => {
  const agents = Array.from(agentConfigs.values());
  res.json({ agents, count: agents.length });
});

app.get('/api/agents/:agentId', (req: Request, res: Response) => {
  const agent = agentConfigs.get(req.params.agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

app.post('/api/agents', (req: Request, res: Response) => {
  const body = req.body as Omit<AgentConfig, 'id'>;
  const id = randomUUID();
  const agent: AgentConfig = { id, ...body };
  agentConfigs.set(id, agent);
  logger.info('Agent registered', { agentId: id, name: agent.name });
  res.status(201).json(agent);
});

app.post('/api/triage', async (req: Request, res: Response) => {
  const { caseId, transactionId } = req.body;
  if (!caseId || !transactionId) {
    return res.status(400).json({ error: 'Missing required fields: caseId, transactionId' });
  }

  const result = await performAiTriage(caseId, transactionId);
  res.json(result);
});

// --- AI Triage Logic ---
// This is a stub that simulates AI triage of a flagged case.
// In production, this would call an LLM or ML model.
async function performAiTriage(caseId: string, transactionId: string): Promise<{
  decision: 'APPROVE' | 'REJECT' | 'ESCALATE';
  confidence: number;
  reasoning: string;
}> {
  logger.info('Performing AI triage', { caseId, transactionId });

  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Stub logic: randomly decide based on a simple heuristic
  // In production, this would call an actual AI model
  const confidence = Math.random() * 0.4 + 0.5; // 0.5 - 0.9
  const decision = confidence > 0.7 ? 'APPROVE' : confidence > 0.6 ? 'ESCALATE' : 'REJECT';

  return {
    decision,
    confidence: Math.round(confidence * 100) / 100,
    reasoning: `AI triage completed for case ${caseId}. Risk factors analyzed.`,
  };
}

// --- Kafka Consumer: case.created ---
async function handleCaseCreated(payload: EachMessagePayload): Promise<void> {
  const event = JSON.parse(payload.message.value!.toString());
  logger.info('Received case.created event', { caseId: event.caseId });

  // Only process cases assigned to AI
  if (event.assignedType !== 'AI') {
    logger.info('Case not assigned to AI, skipping', { caseId: event.caseId });
    return;
  }

  try {
    const triageResult = await performAiTriage(event.caseId, event.transactionId);

    // Publish triage result back to Kafka
    const triageEvent = {
      eventId: randomUUID(),
      caseId: event.caseId,
      transactionId: event.transactionId,
      occurredAt: new Date().toISOString(),
      agentId: 'ai-triage-001',
      decision: triageResult.decision,
      confidence: triageResult.confidence,
      reasoning: triageResult.reasoning,
    };

    await producer.send({
      topic: 'case.triage.completed',
      messages: [{ key: event.caseId, value: JSON.stringify(triageEvent) }],
    });

    logger.info('AI triage completed', { caseId: event.caseId, decision: triageResult.decision });
  } catch (err) {
    logger.error('AI triage failed', { caseId: event.caseId, error: err });
  }
}

// --- Start Server ---
async function start(): Promise<void> {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'case.created', fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      if (payload.topic === 'case.created') {
        await handleCaseCreated(payload);
      }
    },
  });

  logger.info('Kafka consumer connected and subscribed to case.created');

  app.listen(PORT, () => {
    logger.info(`Agent Runtime listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start Agent Runtime', { error: err });
  process.exit(1);
});

export { app };
