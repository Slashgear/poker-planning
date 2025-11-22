/**
 * k6 Stress Test: Push System to Limits
 *
 * This test gradually increases load to find the breaking point
 * of the application.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const successfulRequests = new Counter("successful_requests");

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // Ramp up to 50 users
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "2m", target: 150 }, // Ramp up to 150 users
    { duration: "2m", target: 200 }, // Ramp up to 200 users
    { duration: "5m", target: 200 }, // Stay at 200 for 5 minutes
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    errors: ["rate<0.1"], // Allow up to 10% errors during stress
    http_req_duration: ["p(95)<2000"], // 95% under 2s during stress
    http_req_failed: ["rate<0.1"], // Less than 10% failed requests
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

export default function () {
  // Workflow: create, join, vote
  const createRes = http.post(`${BASE_URL}/api/rooms`);

  if (check(createRes, { created: (r) => r.status === 200 })) {
    successfulRequests.add(1);
    errorRate.add(0);

    const roomCode = JSON.parse(createRes.body).code;

    // Join
    const joinRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/join`,
      JSON.stringify({ name: `StressUser${__VU}` }),
      { headers: { "Content-Type": "application/json" } },
    );

    if (check(joinRes, { joined: (r) => r.status === 200 })) {
      const sessionCookie = joinRes.cookies.session_id?.[0]?.value;

      // Vote
      http.post(
        `${BASE_URL}/api/rooms/${roomCode}/vote`,
        JSON.stringify({ value: "5" }),
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${sessionCookie}`,
          },
        },
      );
    }
  } else {
    errorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs.values.count;
  const failedRequests = data.metrics.http_req_failed.values.passes;
  const errorPercentage = (failedRequests / totalRequests) * 100;

  console.log("\n📊 Stress Test Summary:");
  console.log(`   Total Requests: ${totalRequests}`);
  console.log(`   Failed Requests: ${failedRequests}`);
  console.log(`   Error Rate: ${errorPercentage.toFixed(2)}%`);

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
