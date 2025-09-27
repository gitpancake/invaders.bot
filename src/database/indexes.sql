-- Performance optimization indexes for the invaders database
-- Run these indexes to improve query performance across the application

-- Flashes table indexes
-- Primary lookup patterns: timestamp range queries, player lookups, flash_id lookups

-- Index for timestamp range queries (used in getSince and getSinceByPlayers)
CREATE INDEX IF NOT EXISTS idx_flashes_timestamp ON flashes (timestamp DESC);

-- Index for player lookups with timestamp (used in getSinceByPlayers)
CREATE INDEX IF NOT EXISTS idx_flashes_player_timestamp ON flashes (LOWER(player), timestamp DESC);

-- Index for city + timestamp queries (if we need city-specific lookups)
CREATE INDEX IF NOT EXISTS idx_flashes_city_timestamp ON flashes (city, timestamp DESC);

-- Composite index for player + city + timestamp (covers multiple query patterns)
CREATE INDEX IF NOT EXISTS idx_flashes_player_city_timestamp ON flashes (LOWER(player), city, timestamp DESC);

-- Flashcastr users table indexes
-- Primary lookup patterns: username lookups, farcaster_id lookups

-- Index for username lookups (used frequently in filtering)
CREATE INDEX IF NOT EXISTS idx_flashcastr_users_username ON flashcastr_users (LOWER(username));

-- Index for fid lookups (fid is the farcaster_id equivalent)
CREATE INDEX IF NOT EXISTS idx_flashcastr_users_fid ON flashcastr_users (fid);

-- Flashcastr flashes table indexes
-- Primary lookup pattern: flash_id array lookups (already exists)

-- Index for user_fid lookups (if we need to query by user)
CREATE INDEX IF NOT EXISTS idx_flashcastr_flashes_user_fid ON flashcastr_flashes (user_fid);

-- Text search indexes (if we need to search by flash text content)
-- CREATE INDEX IF NOT EXISTS idx_flashes_text_gin ON flashes USING gin(to_tsvector('english', text));

ANALYZE flashes;
ANALYZE flashcastr_users;
ANALYZE flashcastr_flashes;