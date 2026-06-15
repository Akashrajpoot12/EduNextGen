const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDemo() {
  console.log('Creating school...');
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert([{ name: 'GEMS Academy Demo', subdomain: 'gems' }])
    .select()
    .single();
    
  if (schoolErr) {
    if (schoolErr.code === '23505') {
       console.log('School already exists. Fetching it...');
       const { data } = await supabase.from('schools').select().eq('subdomain', 'gems').single();
       var schoolData = data;
    } else {
       console.error('Error creating school:', schoolErr);
       return;
    }
  } else {
    var schoolData = school;
  }
  
  console.log('Creating auth user admin@gems.com...');
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: 'admin@gems.com',
    password: 'password123',
  });
  
  if (authErr) {
    console.error('Auth error:', authErr);
  }
  
  const userId = authData?.user?.id;
  if (!userId) {
     console.log('User might already exist in auth or failed.');
     return;
  }
  
  console.log('Creating public user profile...');
  await supabase.from('users').insert([
    { id: userId, email: 'admin@gems.com', full_name: 'Super Admin', role: 'admin', school_id: schoolData.id }
  ]);
  
  console.log('Creating class for Homework testing...');
  await supabase.from('classes').insert([
    { school_id: schoolData.id, name: '10th Grade Math' },
    { school_id: schoolData.id, name: '12th Grade Science' }
  ]);
  
  console.log('Demo setup complete!');
}

setupDemo();
