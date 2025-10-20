# Cast Management Scripts

## Overview

Two scripts for managing and repairing Farcaster casts:

1. **cast-check**: Verifies casts with hashes and repairs broken ones
2. **cast-nulls**: Casts flashes that were never cast (null hash) for a specific FID

---

# 1. Cast Check Script (`cast-check`)

## Overview

This script verifies that all Farcaster casts recorded in the database actually exist on-chain. If a cast hash is stored but the cast doesn't exist (e.g., due to temporary API failures during the initial cast), the script will automatically recast and update the database with the new cast hash.

## When to Use

Run this script when:
- You notice "cast not found" errors when visiting cast links
- After recovering from an outage or API downtime
- To audit the integrity of your cast records
- As periodic maintenance to ensure all casts are valid

## Usage

```bash
npm run cast-check
```

## What It Does

1. **Verification Phase**
   - Queries all `flashcastr_flashes` records that have a `cast_hash`
   - Checks each cast via Neynar API to see if it exists
   - Identifies broken casts (hash exists in DB but not on Farcaster)

2. **Repair Phase**
   - For each broken cast:
     - Only processes if `ipfs_cid` is populated (required for embed)
     - Recasts using the same logic as the cron jobs:
       - Message: `"I just flashed an Invader in {city}! 👾"`
       - Embed: `https://www.flashcastr.app/flash/{flash_id}`
       - Channel: `invaders`
     - Updates the database with the new valid cast hash

3. **Summary Report**
   - Shows total casts checked
   - Number of valid vs broken casts
   - Success/failure count for recasts

## Safety Features

- **Rate Limited**: Adds delays between API calls to avoid hitting rate limits
- **Conservative**: If cast verification fails for network reasons, assumes cast exists
- **Read-Only Check**: Only recasts if the cast is confirmed missing
- **IPFS Requirement**: Only recasts if image is uploaded to IPFS
- **Non-Destructive**: Updates database only after successful recast

## Example Output

```
🔍 Starting cast verification...

Found 150 casts to verify

Checking casts...
Progress: 150/150 checked...

============================================================
📊 Verification Summary:
============================================================
Total casts checked: 150
✅ Valid casts: 145
❌ Broken casts: 5
============================================================

🔧 Found 5 broken cast(s):

1. Flash 97577890 (@alice)
   Hash: 0x1234...
   City: Paris

2. Flash 97577891 (@bob)
   Hash: 0x5678...
   City: London

...

🔧 Starting recast process...

  ↻ Recasting flash 97577890 for @alice...
  ✅ Successfully recast! New hash: 0xabcd...

  ↻ Recasting flash 97577891 for @bob...
  ✅ Successfully recast! New hash: 0xefgh...

============================================================
📊 Recast Summary:
============================================================
✅ Successfully recast: 5
❌ Failed to recast: 0
============================================================

✨ Broken casts have been repaired!

✅ Cast check complete!
```

## Environment Variables Required

- `NEYNAR_API_KEY`: For checking casts and recasting
- `SIGNER_ENCRYPTION_KEY`: To decrypt user signer UUIDs
- `DATABASE_URL`: PostgreSQL connection string

## Notes

- This script should only be run **locally** or in a controlled environment
- Not intended to run as a cron job (use the retry mechanism in FlashSyncCron for automatic retries)
- Safe to run multiple times - will skip already-valid casts
- If a recast fails, the original broken cast hash remains in the database for future retry attempts

---

# 2. Cast Nulls Script (`cast-nulls`)

## Overview

This script finds and casts all flashes that have never been successfully cast (cast_hash IS NULL) for a specific user FID. This is useful when a user's flashes failed to cast initially and need to be batch-cast.

## When to Use

Run this script when:
- A specific user reports their flashes were never cast
- You notice a user has many flashes with null cast_hash
- After recovering from user-specific casting issues (e.g., invalid signer)
- When onboarding users who had historical flashes before enabling auto_cast

## Usage

```bash
npm run cast-nulls fid=<FID>
```

### Examples

```bash
# Cast all null flashes for FID 732
npm run cast-nulls fid=732

# Cast all null flashes for FID 12345
npm run cast-nulls fid=12345
```

## What It Does

1. **Query Phase**
   - Finds all `flashcastr_flashes` records for the specified FID
   - Filters for records with `cast_hash IS NULL`
   - Only includes flashes with populated `ipfs_cid` (required for embed)
   - Only processes if user has `auto_cast = true`

2. **Cast Phase**
   - For each null cast:
     - Casts using the same logic as cron jobs:
       - Message: `"I just flashed an Invader in {city}! 👾"`
       - Embed: `https://www.flashcastr.app/flash/{flash_id}`
       - Channel: `invaders`
     - Updates the database with the new cast hash

3. **Summary Report**
   - Shows total flashes to cast
   - Success/failure count for casts
   - Lists each flash as it's processed

## Safety Features

- **FID-Specific**: Only affects flashes for the specified user
- **IPFS Required**: Only casts if image is uploaded to IPFS
- **Auto-Cast Check**: Only processes if user has auto_cast enabled
- **Rate Limited**: Adds 2-second delays between casts
- **Non-Destructive**: Only updates null cast hashes (never overwrites existing hashes)

## Example Output

```bash
$ npm run cast-nulls fid=732

🔍 Finding null casts for FID 732...

============================================================
📊 Found 15 uncast flash(es) for @alice (FID 732)
============================================================

Flashes to cast:

1. Flash 97577890 in Paris
2. Flash 97577891 in London
3. Flash 97577892 in Berlin
...

🔧 Starting cast process...

  ↻ Casting flash 97577890 for @alice...
  ✅ Successfully cast! Hash: 0xabcd...

  ↻ Casting flash 97577891 for @alice...
  ✅ Successfully cast! Hash: 0xefgh...

...

============================================================
📊 Cast Summary:
============================================================
✅ Successfully cast: 15
❌ Failed to cast: 0
============================================================

✨ Null casts have been fixed!

✅ Null cast fix complete!
```

## Error Handling

If the script can't find the FID:
```bash
$ npm run cast-nulls

❌ Error: FID parameter is required

Usage: npm run cast-nulls fid=<FID>
Example: npm run cast-nulls fid=732
```

If no null casts are found:
```bash
✨ No null casts found for FID 732. All flashes have been cast!
```

## Environment Variables Required

- `NEYNAR_API_KEY`: For casting to Farcaster
- `SIGNER_ENCRYPTION_KEY`: To decrypt user signer UUIDs
- `DATABASE_URL`: PostgreSQL connection string

## Notes

- This script should only be run **locally** or in a controlled environment
- Safe to run multiple times - only casts flashes with null hash
- If a cast fails, the hash remains null for future retry attempts
- Not intended for automated use - designed for manual intervention
- The automatic retry mechanism in FlashSyncCron will eventually catch these, but this script allows for immediate manual fixes

---

## Common Workflows

### Workflow 1: User Reports Missing Casts
1. Check database for their FID
2. Run `npm run cast-nulls fid=<FID>` to cast all missing flashes
3. Verify casts appear on their Farcaster profile

### Workflow 2: Audit After Outage
1. Run `npm run cast-check` to find broken casts (bad hashes)
2. For specific users with many failures, run `npm run cast-nulls fid=<FID>`
3. Monitor retry mechanism to catch stragglers automatically

### Workflow 3: New User Onboarding
1. User enables auto_cast for the first time
2. Historical flashes have null cast_hash
3. Run `npm run cast-nulls fid=<FID>` to backfill their history
