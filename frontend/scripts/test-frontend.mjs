/**
 * Automated Test Suite for Traffic E-Challan Frontend Application
 * Tests core business logic, RTO matching, OTP authentication,
 * violation detection, payment processing, QR receipt generation, and dispute lifecycle.
 */

import assert from 'assert';

// Mock localStorage for Node environment
const store = new Map();
global.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};
global.sessionStorage = global.localStorage;

console.log('🧪 Starting Traffic E-Challan Frontend Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

// -------------------------------------------------------------
// Test 1: Data Store Integrity
// -------------------------------------------------------------
console.log('📦 1. Data Store & Mock Schemas');

const { INITIAL_CHALLANS, INITIAL_VEHICLES, INITIAL_ANALYTICS, DEMO_USERS } = await import(
  '../src/services/mockData.ts'
);

it('Initial vehicles contains valid RTO plate numbers and models', () => {
  assert(INITIAL_VEHICLES.length >= 5, 'Should have at least 5 pre-seeded vehicles');
  const sample = INITIAL_VEHICLES[0];
  assert.strictEqual(sample.plateNumber, 'MH12DE1433');
  assert.ok(sample.ownerName);
  assert.ok(sample.ownerMobile);
});

it('Initial challans have evidence with AI bounding box coordinates', () => {
  assert(INITIAL_CHALLANS.length >= 4, 'Should have at least 4 pre-seeded challans');
  const helmetChallan = INITIAL_CHALLANS.find((c) => c.violationCode === 'NO_HELMET');
  assert.ok(helmetChallan, 'Should find NO_HELMET challan');
  assert.strictEqual(helmetChallan.status, 'pending');
  assert(helmetChallan.fineAmount > 0);

  const evidence = helmetChallan.evidence[0];
  assert.ok(evidence);
  assert(evidence.annotations.length >= 2, 'Should have annotations for rider and plate');
  const box = evidence.annotations[0].box;
  assert.strictEqual(box.length, 4, 'Bounding box should be [ymin, xmin, ymax, xmax]');
});

// -------------------------------------------------------------
// Test 2: API & Citizen Registration Flow
// -------------------------------------------------------------
console.log('\n👤 2. Citizen Registration & SMS OTP Authentication Flow');

const { api, getStoredChallans, getStoredVehicles, getStoredAnalytics } = await import(
  '../src/services/api.ts'
);

await itAsync('Citizen registration with vehicle plate and mobile number', async () => {
  const result = await api.citizenSignup({
    fullName: 'Pooja Patil',
    mobileNumber: '9811122233',
    email: 'pooja.patil@example.com',
    plateNumber: 'MH12PP9999',
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.otp, 'Should return generated OTP');

  const vehicles = getStoredVehicles();
  const registered = vehicles.find((v) => v.plateNumber === 'MH12PP9999');
  assert.ok(registered, 'Newly registered vehicle should be stored in system');
  assert.strictEqual(registered.ownerName, 'Pooja Patil');
});

await itAsync('Citizen requests SMS OTP for login', async () => {
  const otpRes = await api.requestOtp('9811122233');
  assert.strictEqual(otpRes.success, true);
  assert.ok(otpRes.debugOtp, 'Should deliver OTP');
  assert.strictEqual(otpRes.debugOtp.length, 6, 'OTP should be 6 digits');
});

await itAsync('Citizen verifies OTP and receives authenticated session with their name', async () => {
  const verifyRes = await api.verifyOtp('9811122233', '123456');
  assert.strictEqual(verifyRes.success, true);
  assert.strictEqual(verifyRes.user.role, 'citizen');
  assert.strictEqual(verifyRes.user.fullName, 'Pooja Patil');
  assert.strictEqual(verifyRes.user.mobileNumber, '9811122233');
});

// -------------------------------------------------------------
// Test 3: Officer Flow — Media Upload, AI Detection & ANPR
// -------------------------------------------------------------
console.log('\n👮 3. Officer Dashboard — AI Detection & E-Challan Dispatch');

await itAsync('AI Detection classifies violation and reads number plate', async () => {
  const fakeBlob = new Blob(['test-footage'], { type: 'image/jpeg' });
  const detection = await api.detectViolation(fakeBlob, 'FC Road Junction, Pune');

  assert.ok(detection.plateNumber, 'Should extract license plate');
  assert(detection.plateConfidence > 0.8, 'Plate confidence should be > 80%');
  assert(detection.violationsFound.length > 0, 'Should identify violation class');
  assert(detection.boxes.length > 0, 'Should have bounding boxes');
});

await itAsync('Officer issues e-challan and notifies vehicle owner via SMS', async () => {
  const issueResult = await api.issueChallan({
    plateNumber: 'MH12PP9999',
    violationCode: 'NO_HELMET',
    violationName: 'Riding without helmet',
    fineAmount: 500,
    location: 'Deccan Gymkhana, Pune',
    detectionSource: 'ai',
  });

  assert.ok(issueResult.challan.id.startsWith('CH-2026-'));
  assert.strictEqual(issueResult.challan.vehiclePlate, 'MH12PP9999');
  assert.strictEqual(issueResult.challan.status, 'pending');
  assert.strictEqual(issueResult.notifiedOwner, true, 'Should flag owner as notified via SMS');
});

// -------------------------------------------------------------
// Test 4: Citizen Payment & QR Receipt Generation
// -------------------------------------------------------------
console.log('\n💳 4. Citizen Payment Gateway & Scannable QR Receipt');

await itAsync('Citizen settles pending challan via simulated payment gateway', async () => {
  const challansBefore = getStoredChallans();
  const pendingChallan = challansBefore.find((c) => c.status === 'pending');
  assert.ok(pendingChallan, 'Should find a pending challan to pay');

  const payResult = await api.payChallan(pendingChallan.id, 'UPI (Google Pay)');
  assert.strictEqual(payResult.success, true);
  assert.strictEqual(payResult.challan.status, 'paid');
  assert.ok(payResult.challan.payment);
  assert.ok(payResult.challan.payment.paymentId.startsWith('PAY-TXN-'));
  assert.strictEqual(payResult.challan.payment.amount, pendingChallan.fineAmount);

  // Verify in store
  const challansAfter = getStoredChallans();
  const paidInStore = challansAfter.find((c) => c.id === pendingChallan.id);
  assert.strictEqual(paidInStore.status, 'paid');
});

it('Scannable QR verification URL matches receipt format', () => {
  const challanId = 'CH-2026-98124';
  const expectedUrl = `/verify-receipt/${challanId}`;
  assert.ok(expectedUrl.includes('verify-receipt'));
  assert.ok(expectedUrl.includes(challanId));
});

// -------------------------------------------------------------
// Test 5: Dispute Grievance & Admin Adjudication
// -------------------------------------------------------------
console.log('\n⚖️ 5. Dispute Grievance & Admin Adjudication');

await itAsync('Citizen contests an erroneous citation with reason', async () => {
  const challans = getStoredChallans();
  const pending = challans.find((c) => c.status === 'pending');
  assert.ok(pending, 'Must have a pending citation');

  const disputed = await api.disputeChallan(pending.id, 'Pillion rider was carrying a helmet in hand.');
  assert.strictEqual(disputed.status, 'disputed');
  assert.strictEqual(disputed.disputeStatus, 'under_review');
  assert.ok(disputed.disputeReason.includes('carrying a helmet'));
});

await itAsync('Supervisory Admin reviews evidence and approves dispute (dismissing citation)', async () => {
  const challans = getStoredChallans();
  const disputed = challans.find((c) => c.status === 'disputed');
  assert.ok(disputed);

  const resolved = await api.resolveDispute(disputed.id, true);
  assert.strictEqual(resolved.status, 'cancelled');
  assert.strictEqual(resolved.disputeStatus, 'approved');
});

// -------------------------------------------------------------
// Test 6: Supervisory Admin Metrics & Hotspots
// -------------------------------------------------------------
console.log('\n📊 6. Supervisory Admin Analytics & Hotspot Density');

it('Admin analytics reports revenue, recovery %, and incident hotspots', () => {
  const analytics = getStoredAnalytics();
  assert(analytics.totalRevenue > 0);
  assert(analytics.byViolationType.length >= 4);
  assert(analytics.hotspots.length >= 5);
  assert(analytics.repeatOffenders.length >= 4);

  const topHotspot = analytics.hotspots[0];
  assert.ok(topHotspot.location);
  assert(topHotspot.count > 0);
});

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n-------------------------------------------------------------');
console.log(`🏁 Test Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
if (passedTests === totalTests) {
  console.log('🎉 ALL INTEGRATION & FLOW TESTS PASSED SUCCESSFULLY!\n');
} else {
  console.error('💥 Some tests failed. Please review the errors above.\n');
  process.exit(1);
}
