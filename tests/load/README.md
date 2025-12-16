# Load Testing

This directory contains load tests for the Poker Planning application using [k6](https://k6.io/).

## Overview

Load testing helps ensure the application can handle expected traffic and identify performance bottlenecks. We use k6, a modern load testing tool designed for developers.

## Test Scenarios

> **Note**: Functional validation (ensuring endpoints work correctly) is handled by Playwright e2e tests. Load tests focus on performance under various load conditions.

### 1. Basic Workflow (`basic-workflow.js`)

**Purpose**: Simulates realistic poker planning sessions with gradual load increase.

**Configuration**:

- Ramp up: 30s to 10 users, 30s to 20 users
- Steady state: 1 minute at each level
- Ramp down: 30s to 0

**Thresholds**:

- Error rate: < 1%
- 95% of requests: < 500ms
- Room creation: < 300ms
- Join/Vote: < 200ms

**Simulates**:

- Creating rooms
- Members joining
- Voting on tasks
- Revealing votes
- Resetting rounds

```bash
pnpm run test:load:basic
```

### 2. Spike Test (`spike-test.js`)

**Purpose**: Tests system behavior under sudden traffic surges.

**Configuration**:

- Warm up: 10s at 5 users
- Spike: 10s ramp to 100 users
- Maintain: 1 minute at 100 users
- Recovery: 10s ramp down

**Thresholds**:

- Error rate: < 5% (allows higher during spike)
- 95% of requests: < 1s

```bash
pnpm run test:load:spike
```

### 3. Stress Test (`stress-test.js`)

**Purpose**: Find the breaking point of the application.

**Configuration**:

- Gradual ramp: 50 → 100 → 150 → 200 users (2min each)
- Stress period: 5 minutes at 200 users
- Ramp down: 2 minutes

**Thresholds**:

- Error rate: < 10%
- 95% of requests: < 2s
- HTTP failures: < 10%

```bash
pnpm run test:load:stress
```

## Running Tests Locally

### Prerequisites

Install k6:

**macOS**:

```bash
brew install k6
```

**Linux (Debian/Ubuntu)**:

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows**:

```powershell
choco install k6
```

### Setup

1. Start Redis (or Valkey):

```bash
docker-compose up -d redis
```

2. Start the application server:

```bash
REDIS_URL=redis://localhost:6379 pnpm run dev:server
```

3. In another terminal, run the tests:

```bash
# Run basic load test
pnpm run test:load:basic

# Run spike test
pnpm run test:load:spike

# Run stress test (long duration)
pnpm run test:load:stress
```

## Custom Test Runs

You can customize test parameters using environment variables:

```bash
# Test against different URL
API_URL=https://poker.slashgear.dev pnpm run test:load:basic

# Run k6 with custom options
k6 run --vus 50 --duration 2m tests/load/scenarios/basic-workflow.js

# Output results to JSON
k6 run --out json=results.json tests/load/scenarios/basic-workflow.js
```

## CI/CD Integration

Load tests run automatically in GitHub Actions:

- **On Pull Requests**: Basic workflow test
- **On Main Branch**: Basic workflow + Spike test

The CI job:

1. Starts Redis service
2. Starts the application server
3. Runs basic load test
4. Runs spike test (main branch only)
5. Uploads results as artifacts

> **Note**: Functional validation is handled by Playwright e2e tests which run separately.

## Understanding Results

### Key Metrics

- **http_req_duration**: Time for requests (lower is better)
  - p(95): 95% of requests completed within this time
  - p(99): 99% of requests completed within this time

- **http_req_failed**: Percentage of failed requests
  - Should be < 1% for normal load
  - Can be higher during spike/stress tests

- **iterations**: Number of complete test cycles
- **vus**: Number of virtual users at any given time

### Example Output

```
✓ room created successfully
✓ member joined
✓ vote submitted
✓ votes revealed

checks.........................: 100.00% ✓ 1200      ✗ 0
data_received..................: 1.2 MB  40 kB/s
data_sent......................: 480 kB  16 kB/s
http_req_duration..............: avg=85ms  min=45ms med=78ms max=320ms p(95)=145ms p(99)=210ms
http_reqs......................: 1500    50/s
iterations.....................: 300     10/s
vus............................: 10      min=0       max=20
```

### Interpreting Results

**Good Performance**:

- p(95) < 500ms for normal operations
- Error rate < 1%
- All thresholds passing

**Warning Signs**:

- p(95) > 1s
- Error rate > 1%
- Increasing response times over test duration

**Performance Issues**:

- p(95) > 2s
- Error rate > 5%
- Timeouts or connection errors

## Troubleshooting

### Test Failures

**"API is not healthy"**:

- Ensure Redis is running
- Ensure application server is started
- Check `http://localhost:3001/api/health`

**High error rates**:

- Check server logs for errors
- Verify Redis connection
- Check resource limits (memory, CPU)

**Timeouts**:

- Increase timeout in test configuration
- Check network connectivity
- Verify server is not overloaded

### Performance Optimization

If tests reveal performance issues:

1. **Database bottleneck**: Check Redis performance, connection pool
2. **Memory leaks**: Monitor server memory during long tests
3. **CPU bound**: Profile code, optimize hot paths
4. **Network**: Check SSE connection handling, broadcast efficiency

## Best Practices

1. **Run e2e tests first** to validate functionality (use `pnpm test`)
2. **Run load tests in isolation** to avoid interference
3. **Monitor server resources** during tests (CPU, memory, connections)
4. **Baseline before changes** to measure impact
5. **Test realistic scenarios** that match production usage
6. **Document findings** and track performance over time

## Further Reading

- [k6 Documentation](https://k6.io/docs/)
- [k6 Test Types](https://k6.io/docs/test-types/introduction/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
