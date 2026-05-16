import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aywuleghuutmsclcjzcf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5d3VsZWdodXV0bXNjbGNqemNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjgyMTgsImV4cCI6MjA5NDQ0NDIxOH0.qtF69VHCSlEgO71hWc2S0KZ8b-j1vquMpwiDzX5bfFw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Checking auth users (we can't do this directly with anon key usually, but let's try reading admins table)");
  
  const { data, error } = await supabase.from('admins').select('*');
  
  if (error) {
    console.error("Error fetching admins:", error);
  } else {
    console.log("Admins table rows:", data);
  }

  const { data: teachersData, error: teachersError } = await supabase.from('teachers').select('*');
  if (teachersError) {
      console.error("Error fetching teachers:", teachersError);
  } else {
      console.log("Teachers table rows:", teachersData);
  }
}

test();
