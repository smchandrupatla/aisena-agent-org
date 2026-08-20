/**
 * Workflow Starter for the HSFS Screening Workflow.
 *
 * This script starts a new workflow execution for a given transaction.
 * It can be called from the API gateway or any other service.
 */

import { Connection, WorkflowClient } from '@temporalio/client';
import { screeningWorkflow } from './workflow';
import type { ScreeningWorkflowInput } from './types';
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

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'hsfs-screening';

async function startWorkflow(input: ScreeningWorkflowInput): Promise<string> {
  const connection = await Connection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const client = new WorkflowClient({
    connection,
  });

  const workflowId = `screening-${input.transactionId}`;
  const run = await client.start(screeningWorkflow, {
    workflowId,
    taskQueue: TASK_QUEUE,
    args: [input],
    // Set a timeout for the entire workflow (30 minutes)
    workflowRunTimeout: '30 minutes',
  });

  logger.info('Workflow started', { workflowId, runId: run.firstExecutionRunId, transactionId: input.transactionId });

  return run.firstExecutionRunId;
}

// CLI entry point
if (require.main === module) {
  const sampleInput: ScreeningWorkflowInput = {
    transactionId: 'txn-sample-001',
    transaction: {
      amount: 15000,
      currency: 'USD',
      originAccount: 'ACC-001',
      beneficiaryAccount: 'ACC-002',
      beneficiaryName: 'John Doe',
      beneficiaryCountry: 'US',
      transactionType: 'WIRE_TRANSFER',
    },
    customer: {
      customerId: 'CUST-001',
      name: 'Jane Smith',
      country: 'US',
      riskRating: 'HIGH',
    },
  };

  startWorkflow(sampleInput)
    .then((runId) => {
      logger.info('Workflow started successfully', { runId });
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Failed to start workflow', { error: err });
      process.exit(1);
    });
}

export { startWorkflow };
