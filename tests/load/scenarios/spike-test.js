/**
 * k6 Spike Test: Sudden Traffic Surge
 *
 * This test simulates a sudden spike in traffic to ensure
 * the application can handle sudden load increases.
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "10s", target: 5 }, // Warm up
    { duration: "10s", target: 5 }, // Stay low
    { duration: "10s", target: 100 }, // Sudden spike to 100 users
    { duration: "1m", target: 100 }, // Maintain spike
    { duration: "10s", target: 5 }, // Drop back down
    { duration: "10s", target: 0 }, // Ramp down
  ],
  thresholds: {
    errors: ["rate<0.05"], // Allow up to 5% errors during spike
    http_req_duration: ["p(95)<1000"], // 95% under 1s during spike
  },
};

const BASE_URL = __ENV.API_URL || "http://localhost:3001";

export default function () {
  // Create room
  const createRes = http.post(`${BASE_URL}/api/rooms`);

  const success = check(createRes, {
    "room created": (r) => r.status === 200,
  });

  errorRate.add(!success);

  if (success) {
    const roomCode = JSON.parse(createRes.body).code;

    // Join room
    const joinRes = http.post(
      `${BASE_URL}/api/rooms/${roomCode}/join`,
      JSON.stringify({ name: `User${__VU}` }),
      { headers: { "Content-Type": "application/json" } },
    );

    check(joinRes, {
      "joined room": (r) => r.status === 200,
    });
  }

  sleep(1);
}
