import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Kafka, logLevel } from 'kafkajs';
import dotenv from 'dotenv';
import winston from 'winston'; import path from 'path';

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
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: 'Rate limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// --- Kafka Producer ---
app.use('/config-ui', express.static(path.resolve(__dirname, '../../..', 'webportal', 'tasks')));
const kafka = new Kafka({
  clientId: 'api-gateway',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.WARN,
});

const producer = kafka.producer();

// --- Mock JWT Auth ---
// In production, replace with a real identity provider.
// This middleware validates a Bearer token and attaches the user to req.user.
interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function mockJwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    // Mock: in production, use jwt.verify(token, process.env.JWT_SECRET)
    // For local dev, accept any token that starts with "mock-"
    if (token.startsWith('mock-')) {
      req.user = {
        sub: 'mock-user-001',
        role: 'compliance-analyst',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      next();
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
    return;
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
}

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// --- Transaction Submission Endpoint ---
interface TransactionRequest {
  amount: number;
  currency: string;
  originAccount: string;
  beneficiaryAccount: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  transactionType: string;
  customerId: string;
  customerName: string;
  customerCountry: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
}

app.post('/api/transactions', mockJwtAuth, async (req: Request, res: Response) => {
  const body = req.body as TransactionRequest;

  // Basic validation
  const required: (keyof TransactionRequest)[] = ['amount', 'currency', 'originAccount', 'beneficiaryAccount',
    'beneficiaryName', 'beneficiaryCountry', 'transactionType',
    'customerId', 'customerName', 'customerCountry', 'riskRating'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }

  const transactionId = randomUUID();
  const eventId = randomUUID();
  const occurredAt = new Date().toISOString();

  const event = {
    eventId,
    transactionId,
    occurredAt,
    transaction: {
      amount: body.amount,
      currency: body.currency,
      originAccount: body.originAccount,
      beneficiaryAccount: body.beneficiaryAccount,
      beneficiaryName: body.beneficiaryName,
      beneficiaryCountry: body.beneficiaryCountry,
      transactionType: body.transactionType,
    },
    customer: {
      customerId: body.customerId,
      name: body.customerName,
      country: body.customerCountry,
      riskRating: body.riskRating,
    },
  };

  try {
    await producer.send({
      topic: 'screening.requested',
      messages: [{ key: transactionId, value: JSON.stringify(event) }],
    });

    logger.info('Transaction submitted for screening', { transactionId, eventId });

    res.status(202).json({
      transactionId,
      eventId,
      status: 'submitted',
      message: 'Transaction submitted for screening',
    });
  } catch (err) {
    logger.error('Failed to publish screening.requested event', { error: err });
    res.status(500).json({ error: 'Failed to submit transaction for screening' });
  }
});

// --- Case Lookup Endpoint ---
app.get('/api/cases/:caseId', mockJwtAuth, async (_req: Request, res: Response) => {
  // In a full implementation, this would proxy to case-management service
  res.json({
    caseId: _req.params.caseId,
    status: 'IN_REVIEW',
    message: 'Case lookup proxied to case-management service',
  });
});

// --- Start Server ---
async function start(): Promise<void> {
  await producer.connect();
  logger.info('Kafka producer connected');

  app.listen(PORT, () => {
    logger.info(`API Gateway listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start API Gateway', { error: err });
  process.exit(1);
});

export { app };
