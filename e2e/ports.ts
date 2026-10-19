// The browser tests start their own servers on these ports, away from the
// usual dev ports (5173 and 3001), so a running `npm run dev` never gets in the way.
export const TEST_CLIENT_PORT = 5273
export const TEST_API_PORT = 3101
export const BASE_URL = `http://localhost:${TEST_CLIENT_PORT}`
