export const CREDIT_UNIT_SCALE = 2; // 2 units = 1 credit; avoids floating-point balances.

export const CREDIT_PACKAGES = Object.freeze({
  starter: Object.freeze({id:'starter',name:'Starter',credits:5,units:10,priceInr:1495}),
  basic: Object.freeze({id:'basic',name:'Basic',credits:10,units:20,priceInr:2790}),
  standard: Object.freeze({id:'standard',name:'Standard',credits:20,units:40,priceInr:4980}),
  growth: Object.freeze({id:'growth',name:'Growth',credits:50,units:100,priceInr:10950}),
  business: Object.freeze({id:'business',name:'Business',credits:100,units:200,priceInr:19900})
});

export function creditsToUnits(credits){
  const value=Number(credits);
  if(!Number.isFinite(value)||value<0)throw new Error('Invalid credit value');
  return Math.round(value*CREDIT_UNIT_SCALE);
}
export function unitsToCredits(units){return Math.max(0,Number(units)||0)/CREDIT_UNIT_SCALE;}
export function packageById(id){return CREDIT_PACKAGES[String(id||'').toLowerCase()]||null;}
export function assessmentCreditUnits(assessment){
  const explicit=Number(assessment?.creditCost);
  if(Number.isFinite(explicit)&&explicit>0)return creditsToUnits(explicit);
  const count=Number(assessment?.targetCount);
  if(count===20)return 2;if(count===30)return 3;if(count===40)return 4;
  throw new Error('Assessment credit cost is unavailable');
}
export function availableUnits(org={}){
  return Math.max(0,(Number(org.creditBalanceUnits)||0)-(Number(org.creditReservedUnits)||0));
}
export function normalizeCouponCode(value){return String(value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);}
export function couponDiscountInr(coupon,subtotalInr,packageInfo,now=Date.now()){
  if(!coupon||coupon.active!==true)return 0;
  if(coupon.expiresAt&&Number(coupon.expiresAt)<=now)return 0;
  if(Number.isFinite(coupon.maxUses)&&coupon.maxUses>0&&(Number(coupon.uses)||0)>=coupon.maxUses)return 0;
  if(Number(coupon.minCredits)>0&&packageInfo.credits<Number(coupon.minCredits))return 0;
  const subtotal=Math.max(0,Math.round(Number(subtotalInr)||0));
  let discount=0;
  if(coupon.type==='percent')discount=Math.round(subtotal*Math.min(100,Math.max(0,Number(coupon.value)||0))/100);
  if(coupon.type==='fixed')discount=Math.round(Math.max(0,Number(coupon.value)||0));
  return Math.max(0,Math.min(subtotal,discount));
}
export function priceQuote(packageInfo,coupon=null,taxPercent=0,now=Date.now()){
  if(!packageInfo)throw new Error('Invalid package');
  const subtotalInr=packageInfo.priceInr;
  const discountInr=couponDiscountInr(coupon,subtotalInr,packageInfo,now);
  const discountedInr=Math.max(0,subtotalInr-discountInr);
  const taxRate=Math.max(0,Math.min(100,Number(taxPercent)||0));
  const taxInr=Math.round(discountedInr*taxRate/100);
  const totalInr=discountedInr+taxInr;
  return {subtotalInr,discountInr,taxPercent:taxRate,taxInr,totalInr,totalPaise:totalInr*100};
}
