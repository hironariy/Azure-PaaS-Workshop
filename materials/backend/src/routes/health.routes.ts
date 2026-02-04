/**
 * Health Check Routes
 * Provides endpoints for App Service health probes
 * Reference: /design/BackendApplicationDesign.md
 *
 * PaaS Notes:
 * - /health is used by App Service health probe
 * - Same code as IaaS, works with Azure Load Balancer
 */

import { Router, Request, Response } from 'express';
import { isDatabaseConnected, getDatabaseState } from '../config/database';

const router = Router();

/**
 * GET /health
 * Simple health check for App Service health probes
 * Returns 200 if healthy, 503 if unhealthy
 */
router.get('/health', (_req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();

  if (dbConnected) {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      reason: 'Database not connected',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/detailed
 * Detailed health check with component statuses
 * For monitoring and debugging (not for health probes)
 */
router.get('/health/detailed', (_req: Request, res: Response) => {
  const dbState = getDatabaseState();
  const dbHealthy = dbState === 'connected';

  const healthStatus = {
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components: {
      database: {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        state: dbState,
      },
      api: {
        status: 'healthy',
      },
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  res.status(dbHealthy ? 200 : 503).json(healthStatus);
});

/**
 * GET /ready
 * Readiness check for App Service
 */
router.get('/ready', (_req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();

  if (dbConnected) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not ready' });
  }
});

/**
 * GET /live
 * Liveness check - always returns 200 if the process is running
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ live: true });
});

export default router;
