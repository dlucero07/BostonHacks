import 'dotenv/config';
import pg from 'pg';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL.includes('YOUR_'))throw new Error('Set DATABASE_URL in .env before running the migration.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
try{await pool.query(`CREATE TABLE IF NOT EXISTS interaction_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 place_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('select','details','add_stop')),
 session_id UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(session_id,place_id,event_type)
); CREATE INDEX IF NOT EXISTS interaction_recent ON interaction_events(created_at,place_id);`);console.log('Interaction schema ready.');}finally{await pool.end();}
