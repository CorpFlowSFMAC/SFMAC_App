const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://87.99.137.96:8000';

const KEYS = [
  'CorpFlowSFMAC_Service_Key_2026',
  'CorpFlowSFMAC_ServiceRole_Key_2026',
  'CorpFlowSFMAC_Service_Role_Key_2026',
  'CorpFlowSFMAC_ServiceKey_2026',
  'CorpFlowSFMAC_ServiceRoleKey_2026',
  'CorpFlowSFMAC_Anon_Key_2026' // control
];

async function tryKey(key) {
  const supabase = createClient(SUPABASE_URL, key);
  try {
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, count };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function main() {
  console.log('Testing service role keys on Hetzner Supabase...');
  for (const key of KEYS) {
    console.log(`Trying key: ${key}...`);
    const res = await tryKey(key);
    if (res.success) {
      console.log(`✅ SUCCESS! Key: ${key}. Count: ${res.count}`);
    } else {
      console.log(`❌ Failed: ${res.error}`);
    }
  }
}

main();
