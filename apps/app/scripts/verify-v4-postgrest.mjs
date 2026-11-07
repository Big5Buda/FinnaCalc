import { randomUUID } from 'node:crypto';
const origin = 'https://kesloqtidckaanjtrzmb.supabase.co';
const results = {};
function must(ok, name) {
  results[name] = Boolean(ok);
  if (!ok) throw new Error('probe_check_failed');
}
async function main() {
  must(process.env.VERCEL_ENV === 'preview', 'preview_context');
  must(process.env.VERCEL_PROJECT_ID === 'prj_qXX5BvdZnIrBD9hLoQsBggflCg5D', 'app_project');
  must(process.env.VERCEL_GIT_COMMIT_REF === 'verify/v4-postgrest-noinsert', 'probe_branch');
  must(process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') === origin, 'expected_database');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  must(typeof key === 'string' && key.length > 0, 'credential_present');
  const headers = {
    apikey: key, Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  async function rpc(name, body) {
    const r = await fetch(`${origin}/rest/v1/rpc/${name}`, {
      method: 'POST', headers, body: JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    // Never emit response bodies, error objects, headers, URL or UUIDs.
    const data = await r.json();
    return { status: r.status, data };
  }
  async function count(table, filter = '') {
    const r = await fetch(`${origin}/rest/v1/${table}?select=owner_id${filter}`, {
      method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    must(r.status === 200, 'count_http');
    const total = r.headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
    must(total !== undefined, 'count_available');
    return Number(total);
  }
  const version = await rpc('snaptrade_order_review_storage_version', {});
  must(version.status === 200 && version.data === 4, 'storage_v4');
  const owner = randomUUID();
  const before = [await count('snaptrade_order_reviews'), await count('snaptrade_order_review_owners')];
  must(before.every(n => n === 0), 'empty_preflight_still_current');
  must(await count('snaptrade_order_review_owners', `&owner_id=eq.${owner}`) === 0, 'missing_owner');
  const base = {
    p_id: randomUUID(), p_owner: owner,
    p_client: 'dispatch-probe', p_vendor_user: 'dispatch-probe', p_generation: -1,
    p_terms: {
      accountId: 'dispatch-probe', symbol: 'AAPL', action: 'BUY',
      amountMode: 'dollars', notionalValue: '25.00', units: null,
      orderType: 'Market', timeInForce: 'Day', price: null, stop: null,
    },
    p_impact_facts: null, p_symbol: 'dispatch-probe', p_trade: 'dispatch-probe',
    p_expires: new Date(Date.now() + 60000).toISOString(),
  };
  const extra = {
    p_amount_mode: 'dollars', p_notional: '25.00',
    p_estimate_units: null, p_amount_verification: 'request_bound',
  };
  const valid = await rpc('create_snaptrade_order_review', { ...base, ...extra });
  must(valid.status === 200 && valid.data === null, 'fourteen_arg_string_scale_accept');
  const scale = await rpc('create_snaptrade_order_review', { ...base, ...extra, p_notional: '25' });
  must(scale.status === 400 && scale.data?.code === '22023', 'fourteen_arg_bad_scale_reject');
  const legacy = await rpc('create_snaptrade_order_review', base);
  must(legacy.status === 400 && legacy.data?.code === '22023', 'ten_arg_dollars_reject');
  const after = [await count('snaptrade_order_reviews'), await count('snaptrade_order_review_owners')];
  must(after.every((n, i) => n === before[i]), 'census_unchanged');
  results.complete = true;
}
try { await main(); }
catch { results.complete = false; }
console.log('V4_POSTGREST_PROBE ' + JSON.stringify(results));
// Expected FAILED deployment, even on PASS: never produce/serve an app artifact.
process.exitCode = 78;
