/**
 * k6 Stress Test: Push System to Limits
 *
 * This test gradually increases load to find the breaking point
 * of the application. Updated to test up to 1000 concurrent users.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const successfulRequests = new Counter("successful_requests");

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "2m", target: 250 }, // Ramp up to 250 users
    { duration: "2m", target: 500 }, // Ramp up to 500 users
    { duration: "2m", target: 750 }, // Ramp up to 750 users
    { duration: "2m", target: 1000 }, // Ramp up to 1000 users
    { duration: "5m", target: 1000 }, // Stay at 1000 for 5 minutes
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    errors: ["rate<0.05"], // Allow up to 5% errors during stress (stricter)
    http_req_duration: ["p(95)<2000", "p(99)<5000"], // 95% under 2s, 99% under 5s
    http_req_failed: ["rate<0.05"], // Less than 5% failed requests
    successful_requests: ["count>5000"], // At least 5000 successful requests
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
      http.post(`${BASE_URL}/api/rooms/${roomCode}/vote`, JSON.stringify({ value: "5" }), {
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${sessionCookie}`,
        },
      });
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
