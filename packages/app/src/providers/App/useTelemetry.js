/**
 * Telemetry is disabled in Hey API.
 *
 * Hey API is fully local-first. No application analytics, usage tracking,
 * crash reporting, or anonymous counters are sent to any remote service.
 * Normal user API traffic (requests the user deliberately sends) is not
 * affected by this — that traffic goes directly to the user's chosen endpoints.
 */

const useTelemetry = () => {
  // intentionally empty — telemetry removed
};

export default useTelemetry;
