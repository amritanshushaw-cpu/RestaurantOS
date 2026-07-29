/**
 * RestaurantOS - Runtime Environment Configuration
 * Reads environment configuration dynamically from window.__ENV__ or process.env.
 * No secret string literals are hardcoded in source files.
 */
const env = (typeof window !== 'undefined' && window.__ENV__) || (typeof process !== 'undefined' && process.env) || {};

window.SUPABASE_URL      = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
window.SUPABASE_ANON_KEY = (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
window.GOOGLE_CLIENT_ID  = (env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '').trim();
window.API_BASE_URL      = (env.API_BASE_URL || env.VITE_API_BASE_URL || '/api').trim();
