/* ==========================================================================
   config.js — public Supabase connection values.

   SAFE TO COMMIT. The anon key is a *publishable* key: it is meant to live in
   the browser. All access is enforced server-side by Postgres row-level
   security (see supabase/schema.sql). The secret/service key is NEVER here.
   ========================================================================== */
export const SUPABASE_URL = 'https://pnbkyfqchtarlzdmyywl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuYmt5ZnFjaHRhcmx6ZG15eXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTk3NDAsImV4cCI6MjA5NzQzNTc0MH0.UURpPIZ6irwRcKiIp1pTNWySgtTxS2Q6HxLM9vX4Pco';

/** Storage bucket that holds uploaded mini photos. */
export const STORAGE_BUCKET = 'project-images';

/** Convenience flag — true once the values above are populated. */
export const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
