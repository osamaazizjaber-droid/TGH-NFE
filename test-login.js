import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aywuleghuutmsclcjzcf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5d3VsZWdodXV0bXNjbGNqemNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjgyMTgsImV4cCI6MjA5NDQ0NDIxOH0.qtF69VHCSlEgO71hWc2S0KZ8b-j1vquMpwiDzX5bfFw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log("Attempting login...");
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@tgh.org',
    password: 'a15'
  });
  
  if (authError) {
    console.error("Login failed:", authError);
    return;
  }
  
  console.log("Logged in! User ID:", authData.user.id);
  
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('*')
    .eq('id', authData.user.id)
    .single();
    
  if (adminError) {
    console.error("Admin check failed:", adminError);
  } else {
    console.log("Admin check passed!", adminData);
  }
}

testLogin();
