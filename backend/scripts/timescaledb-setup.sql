-- TimescaleDB Setup for InfraWatch
-- 
-- This script configures TimescaleDB extension and converts metrics table
-- to a hypertable for optimized time-series storage.
--
-- Usage:
--   psql -U infrawatch -d infrawatch -f scripts/timescaledb-setup.sql

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert metrics table to hypertable
-- Time dimension: checked_at column (most important for time-series queries)
SELECT create_hypertable('metrics', 'checked_at', if_not_exists => TRUE);

-- Configure automatic compression (compress chunks older than 7 days)
SELECT add_compression_policy('metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Configure automatic data retention (keep 90 days of metrics)
SELECT add_retention_policy('metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_device_time 
  ON metrics(device_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_status 
  ON metrics(status) 
  WHERE status = 'down';

CREATE INDEX IF NOT EXISTS idx_sla_violations_device_date 
  ON sla_violations(device_id, created_at DESC);

-- Configure chunk interval (1 day chunks - optimal for InfraWatch scale)
SELECT set_chunk_time_interval('metrics', INTERVAL '1 day');

-- Display hypertable information
SELECT * FROM timescaledb_information.hypertables;

-- Display compression policy
SELECT * FROM timescaledb_information.compression_settings 
WHERE hypertable_name = 'metrics';

-- Display retention policy
SELECT * FROM timescaledb_information.data_retention_settings 
WHERE hypertable_name = 'metrics';

-- Create continuous aggregate for 1-hour rollup (optional, for faster dashboards)
-- This automatically aggregates metrics into hourly buckets
CREATE MATERIALIZED VIEW metrics_1h_rollup WITH (timescaledb.continuous) AS
SELECT
  device_id,
  time_bucket('1 hour', checked_at) as hour,
  status,
  COUNT(*) as check_count,
  COUNT(CASE WHEN status = 'up' THEN 1 END) as up_count,
  ROUND(
    (COUNT(CASE WHEN status = 'up' THEN 1 END)::float / COUNT(*)) * 100,
    2
  ) as uptime_percent,
  ROUND(AVG(response_time)::numeric, 2) as avg_response_time
FROM metrics
GROUP BY device_id, hour, status;

-- Add refresh policy for continuous aggregate (refresh every 30 minutes)
SELECT add_continuous_aggregate_policy('metrics_1h_rollup', 
  start_offset => INTERVAL '1 hour', 
  end_offset => INTERVAL '10 minutes', 
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists => TRUE);

-- All done!
\echo 'TimescaleDB setup complete!'
\echo 'Run: SELECT * FROM timescaledb_information.hypertables; to verify'
