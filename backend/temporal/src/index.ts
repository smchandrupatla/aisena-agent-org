/**
 * Temporal Workflow Server
 *
 * This is a simple Express server that exposes endpoints to:
 * - Start a screening workflow
 * - Send a human review signal to a running workflow
 * - Query workflow status
 */

import express, { Request, Response } from 'express';
import { Connection, WorkflowClient } from '@temporalio/client';
import { screeningWorkflow } from './workflow';
import type { ScreeningWorkflowInput, HumanDecision } from './types';
import dotenv from 'dotenv';
import winston from 'winston';

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
const PORT = process.env.PORT || 4000;
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'hsfs-screening';

app.use(express.json());

let connection: Connection;
let client: WorkflowClient;

// --- Health Check ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'temporal-workflow-server', timestamp: new Date().toISOString() });
});

// --- Start Screening Workflow ---
app.post('/api/workflows/screening', async (req: Request, res: Response) => {
  const input: ScreeningWorkflowInput = req.body;

  if (!input.transactionId || !input.transaction || !input.customer) {
    return res.status(400).json({ error: 'Missing required fields: transactionId, transaction, customer' });
  }

  try {
    const workflowId = `screening-${input.transactionId}`;
    const run = await client.start(screeningWorkflow, {
      workflowId,
      taskQueue: TASK_QUEUE,
      args: [input],
      workflowRunTimeout: '30 minutes',
    });

    logger.info('Workflow started', { workflowId, runId: run.firstExecutionRunId, transactionId: input.transactionId });

    res.status(202).json({
      workflowId,
      runId: run.firstExecutionRunId,
      status: 'STARTED',
      message: 'Screening workflow started',
    });
  } catch (err) {
    logger.error('Failed to start workflow', { error: err });
    res.status(500).json({ error: 'Failed to start workflow' });
  }
});

// --- Send Human Review Signal ---
app.post('/api/workflows/:workflowId/signal/human-review', async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const decision: HumanDecision = req.body;

  if (!decision.decision || !decision.reviewer) {
    return res.status(400).json({ error: 'Missing required fields: decision, reviewer' });
  }

  try {
    const handle = client.getHandle(workflowId);
    await handle.signal('humanReview', decision);

    logger.info('Human review signal sent', { workflowId, decision: decision.decision });

    res.json({
      workflowId,
      status: 'SIGNAL_SENT',
      message: 'Human review signal sent to workflow',
    });
  } catch (err) {
    logger.error('Failed to send signal', { workflowId, error: err });
    res.status(404).json({ error: 'Workflow not found or signal failed' });
  }
});

// --- Query Workflow Status ---
app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
  const { workflowId } = req.params;

  try {
    const handle = client.getHandle(workflowId);
    const status = await handle.query('getWorkflowStatus');

    res.json({
      workflowId,
      status,
    });
  } catch (err) {
    logger.error('Failed to query workflow', { workflowId, error: err });
    res.status(404).json({ error: 'Workflow not found' });
  }
});

// --- Start Server ---
async function start(): Promise<void> {
  connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  client = new WorkflowClient({ connection });

  logger.info('Connected to Temporal server', { address: TEMPORAL_ADDRESS });

  app.listen(PORT, () => {
    logger.info(`Temporal Workflow Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start Temporal Workflow Server', { error: err });
  process.exit(1);
});

export { app };
