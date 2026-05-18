How to deploy the updated `generate_installment_coupons` function and test it

What I changed
- Made `generate_installment_coupons` idempotent by deleting existing coupons for the contract before generating new ones.
- Added `ON CONFLICT DO NOTHING` to the INSERT to avoid unique-violation races.
- Added a NOTICE in the exception handler to improve server-side logging.

Deploy (options)
1) If you use the supabase CLI or migration runner already used by the project:
   - Ensure your `supabase` CLI is authenticated with the target project.
   - Run the project's migrations (or apply the single migration file containing the function change):

   supabase db push
   # or the project's migration runner

2) Manual (SQL UI)
   - Open your Supabase project SQL editor and paste the `CREATE OR REPLACE FUNCTION` block from `supabase/migrations/20251223165825_edcbe885-d339-460b-b114-a94d90fada77.sql` and run it.

How to test from command line (curl)
- Quick anonymous test (may be blocked by RLS if RPC requires auth):

  curl -X POST "https://<YOUR-PROJECT>.supabase.co/rest/v1/rpc/generate_installment_coupons" \
    -H "apikey: <anon_or_service_role_key>" \
    -H "Content-Type: application/json" \
    -d '{ "p_contract_id": "<contract-uuid>", "p_start_date": "2026-05-20", "p_tenor_days": 30, "p_daily_amount": 10000 }'

- If RLS blocks anon, use a service role key (server-side only). Replace the `apikey` header with service role key and add `Authorization: Bearer <service_role_key>`.

How to test from the frontend
- In the UI open the Contracts form and create a contract with valid fields. The app calls the RPC via `supabase.rpc('generate_installment_coupons', {...})`.
- If generation fails, open the browser devtools Network tab and inspect the POST to `/rest/v1/rpc/generate_installment_coupons` for response body (Supabase returns JSON with error details).

If you see errors
- Unique constraint violation: The function is now idempotent; if still seen, check whether another process is inserting concurrently.
- Permission denied: Ensure the caller has permission; since function is SECURITY DEFINER, it should run with function owner's rights, but check RLS and Postgres role.
- Other exceptions: Check Supabase project logs (Database > Logs) and look for RAISE NOTICE messages with 'generate_installment_coupons failed'.

Rollback
- If you want the old behaviour, revert the migration changes or re-run the previous function body via SQL.

Questions? I can:
- Deploy the migration to a running Supabase project if you provide access details (not recommended to share secrets here). Instead, I can provide step-by-step commands you can run.
- Add a minimal server-side Edge Function wrapper that calls the RPC using service-role key and returns detailed errors to the admin UI (recommended for secure server-side operations).
