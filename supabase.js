const SUPABASE_URL = 'https://cmljobwhmdwjkpwvotsx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbGpvYndobWR3amtwd3ZvdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE0MzUsImV4cCI6MjA5NjMyNzQzNX0.i4ac31g2cA0M8NAZUR9FH3HuHYOiXrc-k1J1mcVurRY';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);