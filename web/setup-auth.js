const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAuth() {
  console.log('Signing up admin@gems.com...');
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@gems.com',
    password: 'password123',
  });
  
  if (error) {
    console.error('Signup error:', error);
  } else {
    console.log('User ID:', data.user.id);
  }
}

setupAuth();
