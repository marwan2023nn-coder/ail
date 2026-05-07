## 2025-05-14 - Parallelizing Server Info Fetching
**Learning:** Sequential network requests in Electron main process can delay application readiness, especially when dealing with multiple independent API endpoints. Parallelizing these with `Promise.all` significantly reduces the critical path duration.
**Action:** Always check for sequential `await` calls that don't depend on each other's results, especially in initialization or refresh paths.
