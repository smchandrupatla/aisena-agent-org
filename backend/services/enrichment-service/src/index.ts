import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Kafka, logLevel, EachMessagePayload } from 'kafkajs';
import dotenv from 'dotenv';
import winston from 'winston';
import axios from 'axios';
import Redis from 'ioredis';

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
const PORT = process.env.PORT || 3004;

app.use(express.json());

// --- Kafka ---
const kafka = new Kafka({
  clientId: 'enrichment-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: 'enrichment-service-group' });
const producer = kafka.producer();

// --- Redis Cache ---
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 3600;

// --- Mock Sanctions Lists ---
// In production, these would be fetched from external sources (OFAC, UN, EU, etc.)
const mockSanctionsList = [
  { name: 'John Doe', entityType: 'individual', listSource: 'OFAC-SDGT' },
  { name: 'Jane Smith', entityType: 'individual', listSource: 'UN-1263' },
  { name: 'Acme Corp', entityType: 'entity', listSource: 'EU-2024' },
];

// --- Enrichment Logic ---
interface EnrichmentResult {
  name: string;
  isSanctioned: boolean;
  matches: Array<{ listSource: string; entityType: string }>;
  kycVerified: boolean;
  kycScore: number;
  cached: boolean;
}

async function enrichBeneficiary(name: string): Promise<EnrichmentResult> {
  const cacheKey = `enrichment:${name.toLowerCase()}`;

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info('Cache hit for enrichment', { name });
      const result = JSON.parse(cached) as EnrichmentResult;
      return { ...result, cached: true };
    }
  } catch (err) {
    logger.warn('Redis cache read failed', { error: err });
  }

  // Simulate external API call
  await new Promise(resolve => setTimeout(resolve, 200));

  const matches = mockSanctionsList.filter(
    entry => entry.name.toLowerCase() === name.toLowerCase()
  );

  const result: EnrichmentResult = {
    name,
    isSanctioned: matches.length > 0,
    matches: matches.map(m => ({ listSource: m.listSource, entityType: m.entityType })),
    kycVerified: Math.random() > 0.3, // 70% chance of KYC verification
    kycScore: Math.floor(Math.random() * 100),
    cached: false,
  };

  // Cache the result
  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  } catch (err) {
    logger.warn('Redis cache write failed', { error: err });
  }

  return result;
}

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'enrichment-service', timestamp: new Date().toISOString() });
});

// --- REST API ---
app.post('/api/enrich', async (req: Request, res: Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  try {
    const result = await enrichBeneficiary(name);
    res.json(result);
  } catch (err) {
    logger.error('Enrichment failed', { name, error: err });
    res.status(500).json({ error: 'Enrichment failed' });
  }
});

// --- Kafka Consumer: screening.requested ---
// Enriches beneficiary data and publishes enrichment.completed events
async function handleScreeningRequested(payload: EachMessagePayload): Promise<void> {
  const event = JSON.parse(payload.message.value!.toString());
  logger.info('Received screening.requested for enrichment', { transactionId: event.transactionId });

  try {
    const enrichment = await enrichBeneficiary(event.transaction.beneficiaryName);

    const enrichmentEvent = {
      eventId: randomUUID(),
      transactionId: event.transactionId,
      occurredAt: new Date().toISOString(),
      beneficiaryName: event.transaction.beneficiaryName,
      enrichment,
    };

    await producer.send({
      topic: 'enrichment.completed',
      messages: [{ key: event.transactionId, value: JSON.stringify(enrichmentEvent) }],
    });

    logger.info('Enrichment completed', { transactionId: event.transactionId, isSanctioned: enrichment.isSanctioned });
  } catch (err) {
    logger.error('Enrichment failed', { transactionId: event.transactionId, error: err });
  }
}

// --- Start Server ---
async function start(): Promise<void> {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'screening.requested', fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      if (payload.topic === 'screening.requested') {
        await handleScreeningRequested(payload);
      }
    },
  });

  logger.info('Kafka consumer connected and subscribed to screening.requested');

  app.listen(PORT, () => {
    logger.info(`Enrichment Service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start Enrichment Service', { error: err });
  process.exit(1);
});

export { app, enrichBeneficiary };
