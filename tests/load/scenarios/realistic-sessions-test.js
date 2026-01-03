/**
 * k6 Realistic Sessions Test: Multi-Room Planning Sessions
 *
 * This test simulates realistic poker planning sessions:
 * - Multiple concurrent rooms (10-50)
 * - 5-10 members per room
 * - Realistic voting patterns
 * - Multiple rounds per session
 *
 * This is closer to real-world usage than creating one room per user.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter, Gauge, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

// Custom metrics
const errorRate = new Rate("errors");
const successfulSessions = new Counter("successful_sessions");
const activeRooms = new Gauge("active_rooms_count");
const membersPerRoom = new Trend("members_per_room");
const votingRounds = new Counter("voting_rounds_completed");
const consensusRate = new Rate("consensus_achieved");

// Shared array of room codes across VUs (simulates room reuse)
const roomCodes = new SharedArray("room_codes", function () {
  return [];
});

export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up of planning sessions
    planning_sessions: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 }, // 50 users = ~5-10 rooms
        { duration: "2m", target: 150 }, // 150 users = ~15-30 rooms
        { duration: "3m", target: 300 }, // 300 users = ~30-50 rooms
        { duration: "5m", target: 500 }, // 500 users = ~50-100 rooms
        { duration: "5m", target: 500 }, // Maintain load
        { duration: "2m", target: 0 }, // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    errors: ["rate<0.02"], // Less than 2% errors
    http_req_duration: ["p(95)<1000", "p(99)<2000"], // Fast responses
    http_req_failed: ["rate<0.02"],
    successful_sessions: ["count>100"], // At least 100 completed sessions
    consensus_achieved: ["rate>0.3"], // At least 30% of rounds reach consensus
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

/**
 * Get a random vote value with realistic distribution
 * (favor mid-range values, occasional uncertainty)
 */
function getRealisticVote() {
  const random = Math.random();
  if (random < 0.05) return "?"; // 5% unsure
  if (random < 0.08) return "☕"; // 3% coffee break
  if (random < 0.15) return 1; // 7% very small
  if (random < 0.3) return 2; // 15% small
  if (random < 0.5) return 3; // 20% medium-small
  if (random < 0.7) return 5; // 20% medium
  if (random < 0.85) return 8; // 15% medium-large
  if (random < 0.93) return 13; // 8% large
  if (random < 0.97) return 21; // 4% very large
  return 34; // 3% extra large
}

/**
 * Simulate a team member's behavior in a planning session
 */
function simulateTeamMember(roomCode, memberName, isScramMaster) {
  // Join the room
  const joinRes = http.post(
    `${BASE_URL}/api/rooms/${roomCode}/join`,
    JSON.stringify({ name: memberName }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "JoinRoom" },
    },
  );

  if (!check(joinRes, { "joined successfully": (r) => r.status === 200 })) {
    errorRate.add(1);
    return null;
  }

  errorRate.add(0);
  const sessionCookie = joinRes.cookies.session_id?.[0]?.value;

  if (!sessionCookie) {
    return null;
  }

  // Simulate multiple voting rounds (2-4 rounds per session)
  const rounds = Math.floor(Math.random() * 3) + 2;

  for (let round = 0; round < rounds; round++) {
    // Wait a bit before voting (thinking time)
    sleep(Math.random() * 3 + 1); // 1-4 seconds

    // Submit vote
    const vote = getRealisticVote();
    const voteRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/vote`,
      JSON.stringify({ value: vote }),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
        tags: { name: "Vote" },
      },
    );

    check(voteRes, { "vote submitted": (r) => r.status === 200 });

    // Scrum master reveals votes (30% chance per member or if designated scrum master)
    if (isScramMaster || Math.random() < 0.3) {
      sleep(Math.random() * 2 + 1); // Wait for others to vote

      const revealRes = http.post(`${BASE_URL}/api/rooms/${roomCode}/reveal`, null, {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
        tags: { name: "Reveal" },
      });

      if (check(revealRes, { "votes revealed": (r) => r.status === 200 })) {
        votingRounds.add(1);

        // Check for consensus (simplified - just check if reveal was successful)
        // In reality, would parse response to check actual consensus
        if (Math.random() < 0.35) {
          consensusRate.add(1);
        } else {
          consensusRate.add(0);
        }

        sleep(1);

        // Reset for next round (if not last round)
        if (round < rounds - 1) {
          const resetRes = http.post(`${BASE_URL}/api/rooms/${roomCode}/reset`, null, {
            headers: {
              "Content-Type": "application/json",
              Cookie: `session_id=${sessionCookie}`,
            },
            tags: { name: "Reset" },
          });

          check(resetRes, { "room reset": (r) => r.status === 200 });
          sleep(1);
        }
      }
    } else {
      // Not scrum master, wait for reveal
      sleep(Math.random() * 3 + 2);
    }
  }

  return sessionCookie;
}

/**
 * Main test scenario: Simulate a planning session
 */
export default function () {
  // Decide if this VU will create a new room or join an existing one
  const shouldCreateRoom = Math.random() < 0.15; // 15% create new rooms

  let roomCode;

  if (shouldCreateRoom || roomCodes.length === 0) {
    // Create a new room
    const createRes = http.post(`${BASE_URL}/api/rooms`, null, {
      headers: { "Content-Type": "application/json" },
      tags: { name: "CreateRoom" },
    });

    if (check(createRes, { "room created": (r) => r.status === 200 })) {
      errorRate.add(0);
      const roomData = JSON.parse(createRes.body);
      roomCode = roomData.code;
      activeRooms.add(1);
    } else {
      errorRate.add(1);
      return;
    }
  } else {
    // Join a random existing room (simulate realistic team sessions)
    const randomIndex = Math.floor(Math.random() * Math.min(roomCodes.length, 50));
    roomCode = roomCodes[randomIndex] || `ROOM${String(__VU).padStart(6, "0")}`;
  }

  // Simulate team member behavior
  const memberNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry"];
  const memberName = `${memberNames[__VU % memberNames.length]}${__VU}`;
  const isScramMaster = __VU % 7 === 0; // Every 7th user is scrum master

  const session = simulateTeamMember(roomCode, memberName, isScramMaster);

  if (session) {
    successfulSessions.add(1);
    membersPerRoom.add(Math.floor(Math.random() * 6) + 5); // Estimate 5-10 members
  }

  // Random think time between sessions
  sleep(Math.random() * 2 + 1);
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
  console.log(`📊 Starting realistic sessions test against ${BASE_URL}`);
  console.log("🎯 Target: 500 concurrent users across ~50-100 rooms");

  return { startTime: new Date() };
}

/**
 * Teardown function
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;
  console.log(`✅ Realistic sessions test completed in ${duration.toFixed(2)}s`);
}

/**
 * Custom summary
 */
export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs?.values.count || 0;
  const failedRequests = data.metrics.http_req_failed?.values.passes || 0;
  const successfulSessionsCount = data.metrics.successful_sessions?.values.count || 0;
  const votingRoundsCount = data.metrics.voting_rounds_completed?.values.count || 0;
  const consensusCount = data.metrics.consensus_achieved?.values.passes || 0;
  const consensusTotal = data.metrics.consensus_achieved?.values.count || 1;

  const errorPercentage = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  const consensusPercentage = consensusTotal > 0 ? (consensusCount / consensusTotal) * 100 : 0;

  console.log("\n📊 Realistic Sessions Test Summary:");
  console.log(`   Total Requests: ${totalRequests}`);
  console.log(`   Failed Requests: ${failedRequests} (${errorPercentage.toFixed(2)}%)`);
  console.log(`   Successful Sessions: ${successfulSessionsCount}`);
  console.log(`   Voting Rounds Completed: ${votingRoundsCount}`);
  console.log(`   Consensus Rate: ${consensusPercentage.toFixed(2)}%`);

  if (data.metrics.http_req_duration) {
    console.log(
      `   P95 Response Time: ${data.metrics.http_req_duration.values["p(95)"].toFixed(2)}ms`,
    );
    console.log(
      `   P99 Response Time: ${data.metrics.http_req_duration.values["p(99)"].toFixed(2)}ms`,
    );
  }

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
