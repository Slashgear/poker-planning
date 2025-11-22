/**
 * k6 Smoke Test: Quick Validation
 *
 * This is a minimal load test to verify the system works
 * with minimal load. Run this before other load tests.
 */

import http from "k6/http";
import { check, group, sleep } from "k6";

export const options = {
  vus: 1, // 1 virtual user
  duration: "1m", // Run for 1 minute
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% errors
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

export default function () {
  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      "health check passed": (r) => r.status === 200,
    });
  });

  group("Complete Poker Planning Workflow", () => {
    // 1. Create room
    const createRes = http.post(`${BASE_URL}/api/rooms`);
    check(createRes, {
      "room created": (r) => r.status === 200,
      "has room code": (r) => JSON.parse(r.body).code.length === 6,
    });

    const roomCode = JSON.parse(createRes.body).code;
    sleep(1);

    // 2. Join room
    const joinRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/join`,
      JSON.stringify({ name: "SmokeTestUser" }),
      { headers: { "Content-Type": "application/json" } },
    );

    check(joinRes, {
      "member joined": (r) => r.status === 200,
      "has member id": (r) => {
        const body = JSON.parse(r.body);
        return body.success && body.memberId;
      },
    });

    const sessionCookie = joinRes.cookies.session_id?.[0]?.value;
    sleep(1);

    // 3. Get room state
    const getRoomRes = http.get(`${BASE_URL}/api/rooms/${roomCode}`);
    check(getRoomRes, {
      "room state retrieved": (r) => r.status === 200,
      "has members": (r) => {
        const room = JSON.parse(r.body);
        return room.memberCount > 0;
      },
    });

    sleep(1);

    // 4. Vote
    const voteRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/vote`,
      JSON.stringify({ value: "5" }),
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
      },
    );

    check(voteRes, {
      "vote submitted": (r) => r.status === 200,
    });

    sleep(1);

    // 5. Reveal
    const revealRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/reveal`,
      null,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
      },
    );

    check(revealRes, {
      "votes revealed": (r) => r.status === 200,
      "reveal success": (r) => JSON.parse(r.body).success === true,
    });

    sleep(1);

    // 6. Reset
    const resetRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/reset`,
      null,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
      },
    );

    check(resetRes, {
      "room reset": (r) => r.status === 200,
      "reset success": (r) => JSON.parse(r.body).success === true,
    });

    sleep(1);

    // 7. Remove member
    const memberId = JSON.parse(joinRes.body).memberId;
    const removeRes = http.del(
      `${BASE_URL}/api/rooms/${roomCode}/members/${memberId}`,
      null,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
      },
    );

    check(removeRes, {
      "member removed": (r) => r.status === 200,
    });
  });

  sleep(2);
}

export function handleSummary(data) {
  const passed = data.metrics.checks.values.passes;
  const failed = data.metrics.checks.values.fails;
  const total = passed + failed;
  const passRate = ((passed / total) * 100).toFixed(2);

  console.log("\n🔍 Smoke Test Results:");
  console.log(`   ✅ Passed: ${passed}/${total} (${passRate}%)`);
  console.log(`   ❌ Failed: ${failed}/${total}`);

  if (failed > 0) {
    console.log(
      "\n⚠️  Smoke test detected issues. Do not proceed with load testing.",
    );
  } else {
    console.log("\n✅ Smoke test passed. System is ready for load testing.");
  }

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
