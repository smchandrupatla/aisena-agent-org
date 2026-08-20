/**
 * Temporal Worker for the HSFS Screening Workflow.
 *
 * The worker hosts the workflow and activity implementations.
 * It connects to the Temporal server and polls for tasks.
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
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

async function run(): Promise<void> {
  logger.info('Starting Temporal Worker', { address: TEMPORAL_ADDRESS, taskQueue: TASK_QUEUE });

  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve('./workflow'),
    activities,
    taskQueue: TASK_QUEUE,
  });

  logger.info('Worker started, polling for tasks', { taskQueue: TASK_QUEUE });

  await worker.run();
}

run().catch((err) => {
  logger.error('Worker failed', { error: err });
  process.exit(1);
});
