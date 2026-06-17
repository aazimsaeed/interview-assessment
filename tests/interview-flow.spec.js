// tests/interview-flow.spec.js
import { test, expect } from '@playwright/test';

test.describe('Full AI Interview System Integration', () => {

  test('Recruiter creates interview and Candidate completes it', async ({ page, request }) => {
    
    // ---------------------------------------------------------
    // 1. API TESTING: Clean the database & Setup (Backend)
    // ---------------------------------------------------------
    // Hit your FastAPI endpoint directly to register a fake recruiter
    const registerRes = await request.post('http://localhost:8000/api/recruiters/register', {
      data: { username: 'test_recruiter', password: 'password123' }
    });
    expect(registerRes.ok()).toBeTruthy();

    // ---------------------------------------------------------
    // 2. UI TESTING: Recruiter Flow (Frontend)
    // ---------------------------------------------------------
    await page.goto('/#auth');
    await page.fill('input[name="username"]', 'test_recruiter');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');

    // Verify Dashboard loads and copy the Recruiter Key
    await expect(page.locator('text=Command Center')).toBeVisible();
    const recruiterKey = await page.locator('#recruiter-key-display').innerText();

    // ---------------------------------------------------------
    // 3. NETWORK INTERCEPTION: Mocking Gemini AI
    // ---------------------------------------------------------
    // Do not hit the real Gemini API during tests! Intercept the call.
    await page.route('**/api/evaluate', async route => {
      const json = { 
        score: 85, 
        feedback: "Great answer, very clear.", 
        idealAnswer: "The ideal answer is..." 
      };
      await route.fulfill({ json });
    });

    // ---------------------------------------------------------
    // 4. UI TESTING: Candidate Flow & Hardware (Frontend)
    // ---------------------------------------------------------
    // Switch to Candidate login
    await page.goto('/#auth');
    await page.fill('input[name="username"]', 'test_candidate');
    // ... complete login steps ...

    // Enter the Recruiter Key copied from Step 2
    await page.fill('input[placeholder="Enter 6-character key"]', recruiterKey);
    await page.click('button:has-text("Connect Account")');

    // Start the Interview
    await page.click('button:has-text("Join")');

    // Because of playwright.config.js, the webcam will automatically start 
    // with a fake video. MediaPipe will initialize successfully!
    await expect(page.locator('video')).toBeVisible();

    // Click Submit (which triggers our mocked Gemini API route)
    await page.click('button:has-text("Submit Answer")');

    // ---------------------------------------------------------
    // 5. ASSERTION: Final Report Verification
    // ---------------------------------------------------------
    // Ensure the mocked score of 85 appears on the final Dashboard
    await expect(page.locator('text=85')).toBeVisible();
    await expect(page.locator('text=Great answer, very clear.')).toBeVisible();
  });
});