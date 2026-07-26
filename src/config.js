/**
 * RestaurantOS - Runtime Configuration
 * Single source of truth for backend credentials. Fill these in with your
 * real Supabase project + Google OAuth Client ID to switch from local
 * demo mode to a real, generalized backend.
 *
 * Where to get these:
 *  - SUPABASE_URL / SUPABASE_ANON_KEY: Supabase Dashboard > Project Settings > API
 *  - GOOGLE_CLIENT_ID: Google Cloud Console > APIs & Services > Credentials
 *    (OAuth 2.0 Client ID, type "Web application"). Add your deployed URL
 *    under "Authorized JavaScript origins" and "Authorized redirect URIs",
 *    and also register it under Supabase Dashboard > Authentication >
 *    Providers > Google.
 *
 * Leave values as-is (unset) to keep running in local-only demo mode --
 * the app will not silently pretend to be connected; it will clearly
 * report "not configured" wherever auth/backend status is shown.
 */
window.SUPABASE_URL = '';        // e.g. 'https://your-project-ref.supabase.co'
window.SUPABASE_ANON_KEY = '';   // e.g. 'eyJhbGciOi...' (the public anon key, safe for browser use)
window.GOOGLE_CLIENT_ID = '';    // e.g. '1234567890-abc123.apps.googleusercontent.com'
