// ============================================================
// BUP BCC — Supabase project config
// Find these two values in your Supabase project: Settings -> API.
//   - Project URL              -> SUPABASE_URL
//   - anon / public key        -> SUPABASE_ANON_KEY
//     (newer Supabase dashboards may label this "publishable key" — same
//     thing, it's the safe-to-expose client-side key, NOT the service role
//     / secret key. Never put the service role key in a browser file.)
// ============================================================
const SUPABASE_URL = 'https://nkzhwxwdiicdrsnrdrtt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Qla0mGGv062Ytw9ENmr38Q_BQUsNabb';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
