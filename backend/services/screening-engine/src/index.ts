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
const PORT = process.env.PORT || 3002;

app.use(express.json());

// --- Kafka ---
const kafka = new Kafka({
  clientId: 'screening-engine',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.WARN,
});

const consumer = kafka.consumer({ groupId: 'screening-engine-group' });
const producer = kafka.producer();

// --- Rule Engine ---
// Each rule returns { matched: boolean, reason: string, score: number }
interface ScreeningRule {
  id: string;
  name: string;
  description: string;
  evaluate: (transaction: any, customer: any) => { matched: boolean; reason: string; score: number };
}

const rules: ScreeningRule[] = [
  {
    id: 'RULE-001',
    name: 'High Amount Threshold',
    description: 'Flags transactions above $10,000',
    evaluate: (transaction) => {
      if (transaction.amount > 10000) {
        return { matched: true, reason: 'Amount exceeds $10,000 threshold', score: 30 };
      }
      return { matched: false, reason: '', score: 0 };
    },
  },
  {
    id: 'RULE-002',
    name: 'Sanctions List Match',
    description: 'Checks beneficiary against sanctions lists via enrichment service',
    evaluate: (transaction, customer) => {
      // In production, this would call the enrichment-service
      // For local dev, we simulate a match for specific names
      const sanctionedNames = ['John Doe', 'Jane Smith'];
      if (sanctionedNames.includes(transaction.beneficiaryName)) {
        return { matched: true, reason: 'Beneficiary name matches sanctions list', score: 50 };
      }
      return { matched: false, reason: '', score: 0 };
    },
  },
  {
    id: 'RULE-003',
    name: 'High Risk Country',
    description: 'Flags transactions to/from high-risk countries',
    evaluate: (transaction) => {
      const highRiskCountries = ['KP', 'IR', 'SY', 'CU'];
      if (highRiskCountries.includes(transaction.beneficiaryCountry)) {
        return { matched: true, reason: `Beneficiary country ${transaction.beneficiaryCountry} is high-risk`, score: 25 };
      }
      return { matched: false, reason: '', score: 0 };
    },
  },
  {
    id: 'RULE-004',
    name: 'High Risk Customer',
    description: 'Flags transactions from HIGH risk-rated customers',
    evaluate: (_transaction, customer) => {
      if (customer.riskRating === 'HIGH') {
        return { matched: true, reason: 'Customer has HIGH risk rating', score: 20 };
      }
      return { matched: false, reason: '', score: 0 };
    },
  },
];

// --- Screening Logic ---
interface ScreeningResult {
  screeningId: string;
  transactionId: string;
  status: 'PASS' | 'FLAG';
  rulesMatched: string[];
  riskScore: number;
  details: Record<string, unknown>;
}

function runScreening(transaction: any, customer: any): ScreeningResult {
  const screeningId = randomUUID();
  const rulesMatched: string[] = [];
  let totalScore = 0;
  const details: Record<string, unknown> = {};

  for (const rule of rules) {
    const result = rule.evaluate(transaction, customer);
    if (result.matched) {
      rulesMatched.push(rule.id);
      totalScore += result.score;
      details[rule.id] = {
        name: rule.name,
        reason: result.reason,
        score: result.score,
      };
    }
  }

  // Cap risk score at 100
  const riskScore = Math.min(totalScore, 100);
  const status: 'PASS' | 'FLAG' = riskScore >= 50 ? 'FLAG' : 'PASS';

  return {
    screeningId,
    transactionId: transaction.transactionId || transaction.id,
    status,
    rulesMatched,
    riskScore,
    details,
  };
}

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'screening-engine', timestamp: new Date().toISOString() });
});

// --- REST API: Screen a transaction ---
app.post('/api/screen', (req: Request, res: Response) => {
  const { transaction, customer } = req.body;

  if (!transaction || !customer) {
    return res.status(400).json({ error: 'Missing transaction or customer data' });
  }

  const result = runScreening(transaction, customer);

  logger.info('Screening completed', {
    transactionId: result.transactionId,
    status: result.status,
    riskScore: result.riskScore,
  });

  res.json(result);
});

// --- Kafka Consumer: screening.requested ---
async function handleScreeningRequested(payload: EachMessagePayload): Promise<void> {
  const event = JSON.parse(payload.message.value!.toString());
  logger.info('Received screening.requested event', { transactionId: event.transactionId });

  try {
    const result = runScreening(event.transaction, event.customer);

    const completedEvent = {
      eventId: randomUUID(),
      transactionId: event.transactionId,
      screeningId: result.screeningId,
      occurredAt: new Date().toISOString(),
      status: result.status,
      rulesMatched: result.rulesMatched,
      riskScore: result.riskScore,
      details: result.details,
    };

    await producer.send({
      topic: 'screening.completed',
      messages: [{ key: event.transactionId, value: JSON.stringify(completedEvent) }],
    });

    logger.info('Screening completed and published', {
      transactionId: event.transactionId,
      status: result.status,
    });
  } catch (err) {
    logger.error('Screening failed', { transactionId: event.transactionId, error: err });
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
    logger.info(`Screening Engine listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start Screening Engine', { error: err });
  process.exit(1);
});

export { app, runScreening };
