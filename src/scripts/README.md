# Cast Check Script

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
