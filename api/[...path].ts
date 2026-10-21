import express from 'express';
import { apiRouter } from '../server/apiRouter';
import { getDb } from '../server/db';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (_req, res, next) => {
  try {
    await getDb();
    next();
  } catch (error) {
    console.error('[Vercel API] Database initialization failed:', error);
    res.status(503).json({ detail: 'Database is unavailable. Check the deployment database configuration.' });
  }
});

app.use((req, _res, next) => {
  if (!req.path.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }
  next();
});

app.use('/api', apiRouter);

export default app;