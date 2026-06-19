/* ==========================================================================
   config.js — public Supabase connection (SHARED project: also runs
   www.fradley.org.uk + meridiandesk.co.uk). The Dutty Brush data is namespaced
   with tdb_ table prefixes. Anon key is publishable; RLS enforces access.
   ========================================================================== */
export const SUPABASE_URL = 'https://ylisewcuaxlajvxquccw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaXNld2N1YXhsYWp2eHF1Y2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0Nzg0NTYsImV4cCI6MjA5NzA1NDQ1Nn0.IHsIl_w4tKFVDI3u188mF6x5Bu18HTYuVYoPwjJwvwQ';
export const STORAGE_BUCKET = 'tdb-project-images';
export const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
