// Runs once, after Playwright confirms the local webServer is up and before any test navigates.
// `next start`'s HTTP listener can report ready slightly before the server has finished warming up
// internally, so the very first requests — many, in parallel, the instant workers start — can race
// a cold path and return a stale/incomplete response (observed on the first-ordered screens in
// visual-local.spec.ts). A few sequential warm-up requests absorb that race cheaply; a couple of
// retries cover a server that's still mid-startup.
export default async function globalSetup() {
  const url = 'http://localhost:3000/';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        await res.text(); // fully drain the response
        return;
      }
    } catch {
      // server may still be finishing startup — retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
