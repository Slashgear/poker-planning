/**
 * k6 Load Test: Basic Poker Planning Workflow
 *
 * This test simulates a realistic poker planning session:
 * 1. Create a room
 * 2. Join with multiple members
 * 3. Vote on tasks
 * 4. Reveal votes
 * 5. Reset and repeat
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const roomCreationTime = new Trend("room_creation_duration");
const joinTime = new Trend("join_duration");
const voteTime = new Trend("vote_duration");
const revealTime = new Trend("reveal_duration");
const apiErrors = new Counter("api_errors");

// Test configuration
export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 10 }, // Stay at 10 users
    { duration: "30s", target: 20 }, // Ramp up to 20 users
    { duration: "1m", target: 20 }, // Stay at 20 users
    { duration: "30s", target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    // HTTP errors should be less than 1%
    errors: ["rate<0.01"],
    // 95% of requests should be below 500ms
    http_req_duration: ["p(95)<500"],
    // Room creation should be fast
    room_creation_duration: ["p(95)<300"],
    // Joining should be fast
    join_duration: ["p(95)<200"],
    // Voting should be fast
    vote_duration: ["p(95)<200"],
    // Revealing should be fast
    reveal_duration: ["p(95)<300"],
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

// Fibonacci values for voting
const FIBONACCI = ["1", "2", "3", "5", "8", "13", "21", "?", "☕"];

/**
 * Generate a random member name
 */
function randomName() {
  const names = [
    "Alice",
    "Bob",
    "Charlie",
    "Diana",
    "Eve",
    "Frank",
    "Grace",
    "Henry",
    "Isabel",
    "Jack",
    "Karen",
    "Leo",
    "Maria",
    "Nathan",
    "Olivia",
    "Paul",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Get a random vote value
 */
function randomVote() {
  return FIBONACCI[Math.floor(Math.random() * FIBONACCI.length)];
}

/**
 * Main test scenario
 */
export default function () {
  // 1. Create a room
  let createRes = http.post(`${BASE_URL}/api/rooms`, null, {
    headers: { "Content-Type": "application/json" },
    tags: { name: "CreateRoom" },
  });

  const createSuccess = check(createRes, {
    "room created successfully": (r) => r.status === 200,
    "room has code": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.code && body.code.length === 6;
      } catch {
        return false;
      }
    },
  });

  if (!createSuccess) {
    errorRate.add(1);
    apiErrors.add(1);
    return;
  }

  errorRate.add(0);
  roomCreationTime.add(createRes.timings.duration);

  const roomData = JSON.parse(createRes.body);
  const roomCode = roomData.code;

  sleep(1);

  // 2. Join the room with a member
  const memberName = randomName();
  let joinRes = http.post(
    `${BASE_URL}/api/rooms/${roomCode}/join`,
    JSON.stringify({ name: memberName }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "JoinRoom" },
    },
  );

  const joinSuccess = check(joinRes, {
    "joined successfully": (r) => r.status === 200,
    "has member id": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.memberId;
      } catch {
        return false;
      }
    },
  });

  if (!joinSuccess) {
    errorRate.add(1);
    apiErrors.add(1);
    return;
  }

  errorRate.add(0);
  joinTime.add(joinRes.timings.duration);

  const sessionCookie = joinRes.cookies.session_id?.[0]?.value;

  sleep(1);

  // 3. Get room state
  let getRoomRes = http.get(`${BASE_URL}/api/rooms/${roomCode}`, {
    tags: { name: "GetRoom" },
  });

  check(getRoomRes, {
    "room state retrieved": (r) => r.status === 200,
  });

  sleep(1);

  // 4. Submit a vote
  const vote = randomVote();
  let voteRes = http.post(
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

  const voteSuccess = check(voteRes, {
    "vote submitted": (r) => r.status === 200,
  });

  if (voteSuccess) {
    voteTime.add(voteRes.timings.duration);
  } else {
    errorRate.add(1);
    apiErrors.add(1);
  }

  sleep(2);

  // 5. Reveal votes (only some users will do this)
  if (Math.random() < 0.3) {
    // 30% chance
    let revealRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/reveal`,
      null,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${sessionCookie}`,
        },
        tags: { name: "Reveal" },
      },
    );

    const revealSuccess = check(revealRes, {
      "votes revealed": (r) => r.status === 200,
    });

    if (revealSuccess) {
      revealTime.add(revealRes.timings.duration);
    } else {
      errorRate.add(1);
      apiErrors.add(1);
    }

    sleep(1);

    // 6. Reset the room (some users)
    if (Math.random() < 0.5) {
      // 50% chance after reveal
      let resetRes = http.post(
        `${BASE_URL}/api/rooms/${roomCode}/reset`,
        null,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `session=${sessionCookie}`,
          },
          tags: { name: "Reset" },
        },
      );

      check(resetRes, {
        "room reset": (r) => r.status === 200,
      });
    }
  }

  sleep(1);
}

/**
 * Setup function - runs once before the test
 */
export function setup() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);

  if (healthRes.status !== 200) {
    throw new Error(`API is not healthy. Status: ${healthRes.status}`);
  }

  console.log("✅ API health check passed");
  console.log(`📊 Starting load test against ${BASE_URL}`);

  return { startTime: new Date() };
}

/**
 * Teardown function - runs once after the test
 */
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;
  console.log(`✅ Load test completed in ${duration.toFixed(2)}s`);
}
