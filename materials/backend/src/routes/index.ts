/**
 * Routes Index
 * Central route configuration
 *
 * No PaaS changes - identical to IaaS
 */

import { Router } from 'express';
import healthRoutes from './health.routes';
import postsRoutes from './posts.routes';
import usersRoutes from './users.routes';
import commentsRoutes from './comments.routes';

const router = Router();

// Health check routes (no /api prefix - for direct App Service access)
router.use('/', healthRoutes);

// Health check also at /api/health for SWA Linked Backend routing
// SWA proxies /api/* to the backend, so /api/health is needed
router.use('/api', healthRoutes);

// API routes
router.use('/api/posts', postsRoutes);
router.use('/api/users', usersRoutes);
router.use('/api', commentsRoutes); // Comments have mixed paths

export default router;
