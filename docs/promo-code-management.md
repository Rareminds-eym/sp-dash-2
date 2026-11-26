# Promo code management

Open **Promo codes** in the dashboard navigation (`/promo-codes`). Only an active platform `super_admin` can read or change campaigns. API authorization verifies the signed SSO token and current SSO membership; writes also require the same request origin.

## Create and manage a campaign

1. Choose **Create code**, enter a unique code and campaign name.
2. Choose Learner, School admin or College admin, then select an available published plan. The selector excludes free, contact-sales, seat-priced and ambiguous multi-price offers. It currently supports INR plans with two decimal places, matching the promo checkout contract.
3. Choose a fixed plan price or an additional charge. Enter rupees, such as `1000` for ₹1,000. The preview includes the plan billing interval. Existing checkout tax configuration is unchanged.
4. Set start/expiry times in IST and the maximum number of users who may lock a price. Other audiences receive zero quota.
5. Create the code. Use Details to see usage and immutable saved-price snapshots. Use Pause/Enable to control new redemptions. Dates and limits still apply to enabled codes.

Use **Edit** to change the campaign name, price, dates, overall usage limit and individual audience quotas. The promo code and target plan remain fixed so existing links and saved offers keep their identities; create a different code for a different target plan. Zero audience quota stops new redemptions for that audience. Lower limits do not remove existing history or revoke saved prices. Compatible published plans and pricing caps are revalidated on save. Legacy redemptions without saved-price snapshots prevent pricing changes; name, dates and limits can still be edited.

Use **Delete** to permanently remove an unused code after confirmation. Codes with redemption history cannot be deleted; pause them instead. Database foreign keys also reject deletion if a redemption arrives concurrently. Edit, status and delete commands compare `updated_at` and reject stale versions. There is no cascade or force-delete option. Updates preserve the active/paused state unless the explicit status action is used.

Excel export is available in **Details → Redemption history**, separate from deletion. The delete confirmation contains no download option. Exporting does not change deletion eligibility: used codes remain protected, and only unused codes can be deleted.

Redemption history shows the current user's name, email, phone, organization and account ID alongside the immutable saved price. Missing profiles retain the history row with a clear unavailable label. Credentials and arbitrary user metadata are never selected.

Choose **Export Excel** to download all campaign redemptions, not just the visible page, up to 10,000 records. Larger campaigns return an explicit limit error; no truncated workbook is downloaded. The workbook has a Redemptions sheet and a Campaign sheet, with numeric prices, literal text contact values, billing periods, plan revisions, and timestamps labelled IST/UTC. It does not identify a redemption as a successful payment. Export uses the same live super-admin authorization as the history API.

## Storage and effects

- Campaigns are written server-side to the **SkillPassport application database** `promo_codes`; SSO is not a second promo store.
- Fixed rupee inputs are converted exactly into `fixed_price_minor` (paise); additive inputs become `price_adjustment` (rupees). Only one mode is set.
- `target_plan_code` is the canonical published plan code. `role_quotas`, `overall_max_uses`, dates and active status control new redemptions.
- `created_by` / `updated_by` use the authenticated actor. The admin must exist in SkillPassport `users`, as required by the existing foreign keys. No account is created automatically.
- Redemption totals are database counts, not truncated browser-loaded lists. `promo_redemptions` is read-only here. A use means a user locked a price; it does **not** mean a payment succeeded. Cancellation does not release that use.
- Status writes compare `updated_at`; concurrent changes require a refresh. They never modify redemption snapshots. Pausing or expiring a campaign preserves prices already locked.
- A failed/uncertain write is not automatically retried. Refresh the list before trying again.

## Configuration

Use the existing application database configuration (`SKILLPASSPORT_SUPABASE_URL` and `SKILLPASSPORT_SERVICE_ROLE_KEY`, or existing application aliases), plus the existing SSO service binding. Never expose the service-role key in a `NEXT_PUBLIC_*` setting.

`SKILLPASSPORT_API_URL` must be the explicit SkillPassport owner origin, with no path/trailing slash. Local development uses `http://127.0.0.1:8788`; start the existing SkillPassport and SSO workers, then run `npm run dev` for sp-dash. Restart sp-dash after changing local environment values. Deployed environments require their corresponding HTTPS owner origin.

This page uses the existing promo tables and needs no additional database migration. The previously supplied promo migrations must already be applied in the target SkillPassport and SSO databases.

## Verification

`npx.cmd vitest run lib/promos/__tests__ lib/subscriptions/__tests__/catalog-route.test.ts --maxWorkers=1`

The tests cover amount conversion, positive/negative/invalid amounts, pricing caps, all three audiences, published-plan eligibility, live admin authorization, origin protection, duplicate codes, account foreign-key prerequisites, status concurrency and paginated reads. Browser review uses synthetic campaign/session responses, not a live payment; local database reads are verified separately without modifying rows.
