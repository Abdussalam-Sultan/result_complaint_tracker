import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './server/apiRouter';
import { getDb } from './server/db';
import { seedDatabase } from './server/seed';

const PORT = 3000;

async function startServer() {
  console.log('[Server] Connecting to PostgreSQL database...');
  const db = await getDb();

  const userCount = await db.queryOne('SELECT COUNT(*) as c FROM users');
  if (!userCount || Number(userCount.c) === 0) {
    console.log('[Server] PostgreSQL database is unseeded. Running seed script...');
    try {
      await seedDatabase(db);
      console.log('[Server] PostgreSQL database initialized and seeded successfully.');
    } catch (err) {
      console.error('[Server] Failed to seed database:', err);
    }
  } else {
    console.log(`[Server] PostgreSQL database ready (${userCount.c} users registered).`);
  }

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount API router
  app.use('/api', apiRouter);

  // Vite development integration
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  OAU Result Complaint Tracker (PostgreSQL SQL) running at:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Error starting server:', err);
});
