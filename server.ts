import express from 'express';
import { createServer as createViteServer } from 'vite';
import knex from 'knex';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Knex connection
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
      }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      },
  pool: { min: 2, max: 10 }
});

// Test database connection
db.raw('SELECT 1').then(() => {
  console.log('Database connection successful');
}).catch((err) => {
  console.error('Database connection failed:', err.message);
  if (err.message.includes('ECONNREFUSED') && err.message.includes('127.0.0.1')) {
    console.error('HINT: It seems the application is trying to connect to a local PostgreSQL instance which is not running. Please ensure DATABASE_URL is set in your environment variables for Supabase.');
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // 1. Staff
  app.get('/api/staff', async (req, res) => {
    try {
      const staff = await db('staff').select('*').orderBy('id', 'asc');
      res.json(staff);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  // 2. Shifts (Table-kik)
  app.get('/api/shifts', async (req, res) => {
    try {
      const { startStr, endStr } = req.query;
      let query = db('Table-kik').select('*');
      if (startStr && endStr) {
        query = query.where('date', '>=', startStr as string).andWhere('date', '<=', endStr as string);
      }
      const shifts = await query;
      res.json(shifts);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch shifts' });
    }
  });

  app.post('/api/shifts', async (req, res) => {
    try {
      const { id, staff_id, date, shift_type } = req.body;
      await db('Table-kik').insert({ id, staff_id, date, shift_type });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to insert shift' });
    }
  });

  app.delete('/api/shifts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db('Table-kik').where({ id }).del();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete shift' });
    }
  });

  // 3. Status (monthly_roster_status)
  app.get('/api/status/:monthKey', async (req, res) => {
    try {
      const { monthKey } = req.params;
      const status = await db('monthly_roster_status').where({ month_key: monthKey }).first();
      res.json(status || null);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  });

  app.post('/api/status', async (req, res) => {
    try {
      const { month_key, is_published, published_by, original_assignments } = req.body;
      const existing = await db('monthly_roster_status').where({ month_key }).first();
      
      if (existing) {
        await db('monthly_roster_status').where({ month_key }).update({
          is_published,
          published_by,
          original_assignments: JSON.stringify(original_assignments),
          updated_at: db.fn.now()
        });
      } else {
        await db('monthly_roster_status').insert({
          month_key,
          is_published,
          published_by,
          original_assignments: JSON.stringify(original_assignments)
        });
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  app.delete('/api/status/:monthKey', async (req, res) => {
    try {
      const { monthKey } = req.params;
      await db('monthly_roster_status').where({ month_key: monthKey }).del();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete status' });
    }
  });

  // 4. Logs (shift_logs)
  app.get('/api/logs/:monthKey', async (req, res) => {
    try {
      const { monthKey } = req.params;
      const logs = await db('shift_logs').where({ month_key: monthKey }).orderBy('created_at', 'desc');
      res.json(logs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  app.post('/api/logs', async (req, res) => {
    try {
      const { month_key, target_date, message, action_type } = req.body;
      await db('shift_logs').insert({ month_key, target_date, message, action_type });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to insert log' });
    }
  });

  app.delete('/api/logs/:monthKey', async (req, res) => {
    try {
      const { monthKey } = req.params;
      await db('shift_logs').where({ month_key: monthKey }).del();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete logs' });
    }
  });

  // 5. Users (users-table-kik)
  app.get('/api/users', async (req, res) => {
    try {
      const users = await db('users-table-kik').select('*').orderBy('id', 'asc');
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { username, password, name } = req.body;
      await db('users-table-kik').insert({ username, password, name });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.code === '23505' ? 'Username already exists' : 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, name } = req.body;
      await db('users-table-kik').where({ id }).update({ username, password, name });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db('users-table-kik').where({ id }).del();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
