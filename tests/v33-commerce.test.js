import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CREDIT_PACKAGES,assessmentCreditUnits,availableUnits,couponDiscountInr,priceQuote,unitsToCredits} from '../lib/commerce.js';

test('credit packages use the agreed 5/10/20/50/100 structure',()=>{
  assert.deepEqual(Object.values(CREDIT_PACKAGES).map(x=>x.credits),[5,10,20,50,100]);
  assert.equal(CREDIT_PACKAGES.starter.priceInr,1495);
  assert.equal(CREDIT_PACKAGES.business.priceInr,19900);
});

test('assessment tiers consume half-credit-safe integer units',()=>{
  assert.equal(assessmentCreditUnits({creditCost:1}),2);
  assert.equal(assessmentCreditUnits({creditCost:1.5}),3);
  assert.equal(assessmentCreditUnits({creditCost:2}),4);
  assert.equal(unitsToCredits(3),1.5);
  assert.equal(availableUnits({creditBalanceUnits:20,creditReservedUnits:7}),13);
});

test('coupon quote is server-derived and supports percent, fixed and tax',()=>{
  const pkg=CREDIT_PACKAGES.basic;
  assert.equal(couponDiscountInr({active:true,type:'percent',value:10,uses:0},pkg.priceInr,pkg),279);
  const q=priceQuote(pkg,{active:true,type:'fixed',value:500,uses:0},18);
  assert.equal(q.subtotalInr,2790);assert.equal(q.discountInr,500);assert.equal(q.taxInr,412);assert.equal(q.totalInr,2702);
});

test('commercial UI includes wallet, packages, coupons and Razorpay checkout',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(html,/Credit Wallet/);assert.match(html,/Coupon Management/);assert.match(html,/Package Pricing/);assert.match(html,/checkout\.razorpay\.com/);
  assert.match(app,/verify-payment/);assert.match(app,/Sync Recent Payments/);assert.match(app,/save-pricing/);
});

test('credit charging is linked to candidate start and reservation release',()=>{
  const candidate=readFileSync(new URL('../server/candidate.js',import.meta.url),'utf8');
  const invites=readFileSync(new URL('../server/invitations.js',import.meta.url),'utf8');
  assert.match(candidate,/consumeReservedCredits/);assert.match(invites,/reserveCredits/);assert.match(invites,/creditStatus='reserved'/);
});
