# Load Testing with k6

This directory contains comprehensive load testing scenarios for the Poker Planning application using [k6](https://k6.io/).

## 📋 Available Test Scenarios

### 1. Basic Workflow (`basic-workflow.js`)

**Purpose**: Baseline performance test with realistic user behavior
**Target**: 10-20 concurrent users
**Duration**: ~3.5 minutes
**Use case**: Continuous integration smoke test

```bash
pnpm test:load:basic
```

**What it tests**:

- Room creation
- Member joining
- Voting submission
- Vote revelation
- Room reset

**Thresholds**:

- Error rate < 1%
- P95 response time < 500ms
- Room creation < 300ms
- Vote submission < 200ms

---

### 2. Spike Test (`spike-test.js`)

**Purpose**: Test system resilience during sudden traffic surges
**Target**: 5 → 100 users in 10 seconds
**Duration**: ~2 minutes
**Use case**: Handle unexpected traffic spikes (e.g., viral link)

```bash
pnpm test:load:spike
```

**What it tests**:

- Rapid connection establishment
- Resource allocation under spike
- Recovery after spike

**Thresholds**:

- Error rate < 5% during spike
- P95 response time < 1000ms

---

### 3. Stress Test (`stress-test.js`) 🔥

**Purpose**: Find the breaking point of the system
**Target**: Gradual ramp to **1000 concurrent users**
**Duration**: ~17 minutes
**Use case**: Capacity planning and performance limits

```bash
pnpm test:load:stress
```

**Stages**:

1. 0 → 100 users (2 min)
2. 100 → 250 users (2 min)
3. 250 → 500 users (2 min)
4. 500 → 750 users (2 min)
5. 750 → 1000 users (2 min)
6. Maintain 1000 users (5 min)
7. Ramp down to 0 (2 min)

**Thresholds**:

- Error rate < 5%
- P95 < 2s, P99 < 5s
- Minimum 5000 successful requests

---

### 4. Realistic Sessions Test (`realistic-sessions-test.js`) 🎯 **NEW**

**Purpose**: Simulate real-world planning sessions
**Target**: 500 concurrent users across **50-100 rooms**
**Duration**: ~18 minutes
**Use case**: Production load simulation with realistic behavior

```bash
pnpm test:load:realistic
```

**Realistic behaviors**:

- Multiple rooms with 5-10 members each
- Sequential voting rounds (2-4 per session)
- Realistic vote distribution (favors mid-range values)
- Scrum master role (reveals/resets)
- Think time between actions

**Stages**:

1. 0 → 50 users (~5-10 rooms) (1 min)
2. 50 → 150 users (~15-30 rooms) (2 min)
3. 150 → 300 users (~30-50 rooms) (3 min)
4. 300 → 500 users (~50-100 rooms) (5 min)
5. Maintain 500 users (5 min)
6. Ramp down (2 min)

**Metrics tracked**:

- Active rooms count
- Members per room
- Voting rounds completed
- Consensus rate
- Session success rate

**Thresholds**:

- Error rate < 2%
- P95 < 1s, P99 < 2s
- Minimum 100 completed sessions
- Consensus rate > 30%

---

### 5. SSE Endurance Test (`sse-endurance-test.js`) ⚡ **NEW**

**Purpose**: Test long-lived Server-Sent Events connections
**Target**: **1000 concurrent SSE-like connections**
**Duration**: ~20 minutes
**Use case**: Test persistent connection handling and memory stability

```bash
pnpm test:load:sse
```

**What it simulates**:

- EventSource connections (via polling)
- Connection maintained for 30-120 seconds
- Periodic state polling (every 2-3 seconds)
- Occasional votes during connection
- Reconnection with exponential backoff

**Stages**:

1. 0 → 200 connections (2 min)
2. 200 → 500 connections (3 min)
3. 500 → 1000 connections (3 min)
4. Maintain 1000 connections (10 min) 🔥
5. Ramp down (2 min)

**Metrics tracked**:

- Active SSE connections
- Connection duration
- Events received (polls)
- Reconnection attempts
- Connection errors

**Thresholds**:

- Error rate < 5%
- Max 50 connection errors
- Maintain at least 800 active connections
- P95 response time < 1s

---

## 🚀 Running Tests

### Prerequisites

1. **Install k6**
2. **Start Redis**: `docker-compose up -d redis`
3. **Start server**: `REDIS_URL=redis://localhost:6379 pnpm run dev:server`

### Run Individual Tests

```bash
pnpm test:load:basic       # Basic workflow
pnpm test:load:spike       # Spike test
pnpm test:load:stress      # Stress test (1000 users)
pnpm test:load:realistic   # Realistic sessions (NEW)
pnpm test:load:sse         # SSE endurance (NEW)
pnpm test:load:all         # All standard tests
```

---

## 📊 Performance Targets

| Metric                  | Target     | Notes                  |
| ----------------------- | ---------- | ---------------------- |
| **Concurrent users**    | 500+       | Realistic load         |
| **Concurrent rooms**    | 50-100     | With 5-10 members each |
| **Peak load**           | 1000 users | Stress test limit      |
| **SSE connections**     | 1000+      | Long-lived connections |
| **Response time (P95)** | < 500ms    | Normal load            |
| **Error rate**          | < 1%       | Normal operations      |
