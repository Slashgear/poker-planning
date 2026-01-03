/**
 * k6 SSE Endurance Test: Long-lived EventSource Connections
 *
 * This test focuses on Server-Sent Events (SSE) connection handling:
 * - Simulate 1000+ concurrent SSE connections
 * - Maintain connections for extended periods (10+ minutes)
 * - Test server's ability to handle persistent connections
 * - Monitor memory and file descriptor usage
 *
 * Note: k6 doesn't natively support EventSource, so we simulate
 * the behavior with long-lived HTTP connections and polling.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter, Gauge, Trend } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const activeConnections = new Gauge("active_sse_connections");
const connectionDuration = new Trend("connection_duration_seconds");
const eventsReceived = new Counter("sse_events_received");
const reconnections = new Counter("reconnection_attempts");
const connectionErrors = new Counter("connection_errors");

export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up to 1000 concurrent SSE connections
    sse_connections: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 200 }, // Ramp to 200 connections
        { duration: "3m", target: 500 }, // Ramp to 500 connections
        { duration: "3m", target: 1000 }, // Ramp to 1000 connections
        { duration: "10m", target: 1000 }, // Maintain 1000 for 10 minutes
        { duration: "2m", target: 0 }, // Gradual shutdown
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    errors: ["rate<0.05"], // Less than 5% errors
    http_req_duration: ["p(95)<1000"], // Fast connection establishment
    connection_errors: ["count<50"], // Max 50 connection errors total
    active_sse_connections: ["value>800"], // Maintain at least 800 active
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";
const SSE_POLL_INTERVAL = 2; // Poll every 2 seconds to simulate SSE behavior

/**
 * Simulate an SSE connection by maintaining a room session
 * and periodically polling for updates
 */
function simulateSSEConnection(roomCode, sessionCookie, duration) {
  const startTime = new Date().getTime();
  const endTime = startTime + duration * 1000;
  let pollCount = 0;
  let consecutiveErrors = 0;

  activeConnections.add(1);

  // Simulate long-lived connection with periodic polling
  while (new Date().getTime() < endTime && consecutiveErrors < 3) {
    // Poll room state (simulates SSE message)
    const getRoomRes = http.get(`${BASE_URL}/api/rooms/${roomCode}`, {
      headers: {
        Cookie: `session_id=${sessionCookie}`,
      },
      tags: { name: "PollRoomState" },
      timeout: "10s",
    });

    if (check(getRoomRes, { "room state retrieved": (r) => r.status === 200 })) {
      eventsReceived.add(1);
      errorRate.add(0);
      consecutiveErrors = 0;
    } else {
      errorRate.add(1);
      connectionErrors.add(1);
      consecutiveErrors++;

      // Attempt reconnection after error
      if (consecutiveErrors >= 2) {
        reconnections.add(1);
        sleep(Math.min(consecutiveErrors * 2, 10)); // Exponential backoff
      }
    }

    pollCount++;

    // Random actions during the connection (simulate real user behavior)
    if (pollCount % 5 === 0 && Math.random() < 0.3) {
      // Occasionally submit a vote (30% chance every 5 polls)
      const vote = [1, 2, 3, 5, 8, 13][Math.floor(Math.random() * 6)];
      http.post(`${BASE_URL}/api/rooms/${roomCode}/vote`, JSON.stringify({ value: vote }), {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
        tags: { name: "Vote" },
      });
    }

    // Sleep to simulate SSE polling interval
    sleep(SSE_POLL_INTERVAL + Math.random()); // 2-3 seconds
  }

  activeConnections.add(-1);

  const actualDuration = (new Date().getTime() - startTime) / 1000;
  connectionDuration.add(actualDuration);

  return {
    duration: actualDuration,
    pollCount: pollCount,
    errors: consecutiveErrors,
  };
}

/**
 * Main test scenario
 */
export default function () {
  // Create or join a room
  let roomCode;
  let sessionCookie;

  // 20% create new room, 80% join existing room (reuse)
  if (Math.random() < 0.2 || __ITER === 0) {
    // Create a new room
    const createRes = http.post(`${BASE_URL}/api/rooms`, null, {
      headers: { "Content-Type": "application/json" },
      tags: { name: "CreateRoom" },
    });

    if (!check(createRes, { "room created": (r) => r.status === 200 })) {
      errorRate.add(1);
      connectionErrors.add(1);
      return;
    }

    roomCode = JSON.parse(createRes.body).code;
  } else {
    // Use a predictable room code based on VU (simulates room sharing)
    const roomIndex = (__VU % 50) + 1; // Distribute across 50 rooms
    roomCode = `ROOM${String(roomIndex).padStart(6, "0")}`;
  }

  // Join the room
  const memberName = `SSEUser${__VU}_${__ITER}`;
  const joinRes = http.post(
    `${BASE_URL}/api/rooms/${roomCode}/join`,
    JSON.stringify({ name: memberName }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "JoinRoom" },
    },
  );

  if (!check(joinRes, { "joined room": (r) => r.status === 200 })) {
    errorRate.add(1);
    connectionErrors.add(1);
    return;
  }

  sessionCookie = joinRes.cookies.session_id?.[0]?.value;

  if (!sessionCookie) {
    connectionErrors.add(1);
    return;
  }

  // Maintain SSE-like connection for 30-120 seconds (random)
  const connectionDurationSeconds = Math.floor(Math.random() * 90) + 30;

  void simulateSSEConnection(roomCode, sessionCookie, connectionDurationSeconds);

  // Brief cooldown between iterations
  sleep(1);
}

/**
 * Setup function
 */
export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`);

  if (healthRes.status !== 200) {
    throw new Error(`API is not healthy. Status: ${healthRes.status}`);
  }

  console.log("✅ API health check passed");
  console.log(`📊 Starting SSE endurance test against ${BASE_URL}`);
  console.log("🎯 Target: 1000 concurrent SSE-like connections for 10 minutes");
  console.log(`⚡ Poll interval: ${SSE_POLL_INTERVAL}s (simulates EventSource message frequency)`);

  return { startTime: new Date() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;
  console.log(`✅ SSE endurance test completed in ${duration.toFixed(2)}s`);
}

/**
 * Custom summary
 */
export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs?.values.count || 0;
  const failedRequests = data.metrics.http_req_failed?.values.passes || 0;
  const eventsReceivedCount = data.metrics.sse_events_received?.values.count || 0;
  const reconnectionsCount = data.metrics.reconnection_attempts?.values.count || 0;
  const connectionErrorsCount = data.metrics.connection_errors?.values.count || 0;

  const errorPercentage = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

  console.log("\n📊 SSE Endurance Test Summary:");
  console.log(`   Total HTTP Requests: ${totalRequests}`);
  console.log(`   Failed Requests: ${failedRequests} (${errorPercentage.toFixed(2)}%)`);
  console.log(`   SSE Events Received (polls): ${eventsReceivedCount}`);
  console.log(`   Reconnection Attempts: ${reconnectionsCount}`);
  console.log(`   Connection Errors: ${connectionErrorsCount}`);

  if (data.metrics.connection_duration_seconds) {
    const avgDuration = data.metrics.connection_duration_seconds.values.avg;
    const maxDuration = data.metrics.connection_duration_seconds.values.max;
    console.log(`   Avg Connection Duration: ${avgDuration.toFixed(2)}s`);
    console.log(`   Max Connection Duration: ${maxDuration.toFixed(2)}s`);
  }

  if (data.metrics.http_req_duration) {
    console.log(
      `   P95 Response Time: ${data.metrics.http_req_duration.values["p(95)"].toFixed(2)}ms`,
    );
  }

  // Warnings
  if (connectionErrorsCount > 100) {
    console.log("\n⚠️  Warning: High number of connection errors detected!");
    console.log("   Consider checking server logs and resource limits.");
  }

  if (reconnectionsCount > 50) {
    console.log("\n⚠️  Warning: High number of reconnections!");
    console.log("   This may indicate connection stability issues.");
  }

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
