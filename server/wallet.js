import {createHmac,timingSafeEqual} from 'node:crypto';
import {requireRecruiter,reject} from './_auth.js';
import {CREDIT_PACKAGES,availableUnits,normalizeCouponCode,packageById,priceQuote,unitsToCredits} from '../lib/commerce.js';

const jsonTime=value=>value?.toDate?.()?.toISOString?.()||value||null;
const adminEmails=()=>String(process.env.PLATFORM_ADMIN_EMAILS||process.env.PLATFORM_ADMIN_EMAIL||'')
  .split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const isPlatformAdmin=email=>adminEmails().includes(String(email||'').toLowerCase());
const taxPercent=()=>Math.max(0,Math.min(100,Number(process.env.RECRUITER_TAX_PERCENT)||0));
const paymentsConfigured=()=>Boolean(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET);
const razorHeaders=()=>({Authorization:`Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,'Content-Type':'application/json'});
async function razor(path,options={}){
  if(!paymentsConfigured())throw Object.assign(new Error('Razorpay is not configured yet'),{status:503});
  const response=await fetch(`https://api.razorpay.com/v1${path}`,{...options,headers:{...razorHeaders(),...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){console.error('Razorpay API error',response.status,data?.error?.description||data?.error||data);throw Object.assign(new Error('Payment service is temporarily unavailable'),{status:502});}
  return data;
}
function safeCompareHex(a,b){
  try{const aa=Buffer.from(String(a||''),'hex'),bb=Buffer.from(String(b||''),'hex');return aa.length===bb.length&&aa.length>0&&timingSafeEqual(aa,bb);}catch{return false;}
}
async function getCoupon(db,code){
  const normalized=normalizeCouponCode(code);if(!normalized)return null;
  const snap=await db.collection('recruiter_coupons').doc(normalized).get();
  return snap.exists?{id:snap.id,...snap.data()}:null;
}
function couponPublic(c){return c?{code:c.id,type:c.type,value:c.value,active:c.active===true,expiresAt:c.expiresAt||null,maxUses:c.maxUses||null,uses:c.uses||0,minCredits:c.minCredits||null}:null;}
function configuredPackages(prices={}){return Object.values(CREDIT_PACKAGES).map(p=>{const configured=Number(prices[p.id]);const priceInr=Number.isFinite(configured)&&configured>=100?Math.round(configured):p.priceInr;return {...p,priceInr,pricePerCreditInr:Math.round(priceInr/p.credits)};});}
async function loadPricing(db){const snap=await db.collection('recruiter_settings').doc('commerce').get();return snap.exists?(snap.data().packagePrices||{}):{};}
async function listTransactions(db,orgId){
  const snap=await db.collection('recruiter_organizations').doc(orgId).collection('credit_transactions').limit(100).get();
  const rows=snap.docs.map(d=>({id:d.id,...d.data(),createdAt:jsonTime(d.data().createdAt)}));
  return rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,30);
}
function walletView(org){const balance=Number(org.creditBalanceUnits)||0,reserved=Number(org.creditReservedUnits)||0;
  return {balanceCredits:unitsToCredits(balance),reservedCredits:unitsToCredits(reserved),availableCredits:unitsToCredits(availableUnits(org))};}
async function quoteFor(db,packageId,couponCode){
  const base=packageById(packageId);if(!base)throw Object.assign(new Error('Choose a valid credit package'),{status:400});
  const prices=await loadPricing(db),configured=Number(prices[base.id]),pkg={...base,priceInr:Number.isFinite(configured)&&configured>=100?Math.round(configured):base.priceInr};
  const coupon=await getCoupon(db,couponCode);const normalized=normalizeCouponCode(couponCode);
  if(normalized&&!coupon)throw Object.assign(new Error('Coupon code not found'),{status:400});
  if(coupon&&coupon.active!==true)throw Object.assign(new Error('This coupon is not active'),{status:400});
  if(coupon?.expiresAt&&Number(coupon.expiresAt)<=Date.now())throw Object.assign(new Error('This coupon has expired'),{status:400});
  if(coupon?.maxUses&&Number(coupon.uses||0)>=Number(coupon.maxUses))throw Object.assign(new Error('This coupon has reached its usage limit'),{status:400});
  if(coupon?.minCredits&&pkg.credits<Number(coupon.minCredits))throw Object.assign(new Error(`This coupon requires a package of at least ${coupon.minCredits} credits`),{status:400});
  const quote=priceQuote(pkg,coupon,taxPercent());
  if(quote.totalPaise<100)throw Object.assign(new Error('Checkout total must be at least ₹1'),{status:400});
  return {pkg,coupon,quote};
}
async function finalizePayment(db,orgId,purchaseId,payment){
  const orgRef=db.collection('recruiter_organizations').doc(orgId),orderRef=orgRef.collection('payment_orders').doc(purchaseId),ledgerRef=orgRef.collection('credit_transactions').doc();
  await db.runTransaction(async tx=>{
    const [orgSnap,orderSnap]=await Promise.all([tx.get(orgRef),tx.get(orderRef)]);
    if(!orgSnap.exists)throw Object.assign(new Error('Organisation not found'),{status:404});
    if(!orderSnap.exists)throw Object.assign(new Error('Payment order not found'),{status:404});
    const order=orderSnap.data();if(order.status==='paid')return;
    if(payment.order_id!==order.razorpayOrderId||Number(payment.amount)!==Number(order.totalPaise)||payment.status!=='captured')
      throw Object.assign(new Error('Payment is not captured or does not match the order'),{status:409});
    let couponRef=null,couponSnap=null;
    if(order.couponCode){couponRef=db.collection('recruiter_coupons').doc(order.couponCode);couponSnap=await tx.get(couponRef);}
    const next=(Number(orgSnap.data().creditBalanceUnits)||0)+Number(order.units||0);
    tx.update(orgRef,{creditBalanceUnits:next,updatedAt:new Date()});
    tx.update(orderRef,{status:'paid',razorpayPaymentId:payment.id,paidAt:new Date(),updatedAt:new Date()});
    tx.set(ledgerRef,{type:'purchase',units:Number(order.units||0),credits:Number(order.credits||0),packageId:order.packageId,packageName:order.packageName,
      amountInr:Number(order.totalInr||0),subtotalInr:Number(order.subtotalInr||0),discountInr:Number(order.discountInr||0),taxInr:Number(order.taxInr||0),
      couponCode:order.couponCode||null,purchaseId,razorpayOrderId:order.razorpayOrderId,razorpayPaymentId:payment.id,createdAt:new Date()});
    if(couponRef&&couponSnap?.exists)tx.update(couponRef,{uses:(Number(couponSnap.data().uses)||0)+1,updatedAt:new Date()});
  });
}
async function syncPending(db,orgId){
  if(!paymentsConfigured())return 0;
  const ref=db.collection('recruiter_organizations').doc(orgId).collection('payment_orders');
  const snap=await ref.where('status','==','pending').limit(8).get();let credited=0;
  for(const doc of snap.docs){const order=doc.data();if(!order.razorpayOrderId)continue;
    try{const payments=await razor(`/orders/${encodeURIComponent(order.razorpayOrderId)}/payments`);const captured=(payments.items||[]).find(p=>p.status==='captured'&&Number(p.amount)===Number(order.totalPaise));
      if(captured){await finalizePayment(db,orgId,doc.id,captured);credited++;}}
    catch(error){console.error('Payment sync failed',doc.id,error.message);}
  }return credited;
}
function cleanCouponInput(body){
  const code=normalizeCouponCode(body.code);if(code.length<3)throw Object.assign(new Error('Coupon code must be at least 3 characters'),{status:400});
  const type=body.type==='fixed'?'fixed':'percent',value=Number(body.value);
  if(!Number.isFinite(value)||value<=0)throw Object.assign(new Error('Enter a valid coupon value'),{status:400});
  if(type==='percent'&&value>90)throw Object.assign(new Error('Percentage discounts are limited to 90%'),{status:400});
  const maxUses=body.maxUses?Math.max(1,Math.min(100000,Math.round(Number(body.maxUses)))):null;
  const minCredits=body.minCredits?Math.max(5,Math.round(Number(body.minCredits))):null;
  const expiresAt=body.expiresAt?new Date(`${body.expiresAt}T23:59:59Z`).getTime():null;
  if(expiresAt&&(!Number.isFinite(expiresAt)||expiresAt<Date.now()))throw Object.assign(new Error('Choose a future expiry date'),{status:400});
  return {code,type,value:Math.round(value*100)/100,maxUses,minCredits,expiresAt,active:body.active!==false};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  const user=await requireRecruiter(req);if(user.error)return reject(res,user);
  try{
    const orgRef=user.db.collection('recruiter_organizations').doc(user.orgId),orgSnap=await orgRef.get();
    if(!orgSnap.exists)return res.status(404).json({error:'Organisation not found'});
    if(req.method==='GET'){const prices=await loadPricing(user.db);return res.status(200).json({wallet:walletView(orgSnap.data()),packages:configuredPackages(prices),transactions:await listTransactions(user.db,user.orgId),
      paymentsConfigured:paymentsConfigured(),pilotMode:process.env.RECRUITER_PILOT_MODE==='true',taxPercent:taxPercent(),isPlatformAdmin:isPlatformAdmin(user.email)});}
    const action=req.body?.action;
    if(action==='quote'){
      const {pkg,coupon,quote}=await quoteFor(user.db,req.body?.packageId,req.body?.couponCode);
      return res.status(200).json({package:{...pkg},coupon:couponPublic(coupon),quote});
    }
    if(action==='create-order'){
      if(process.env.RECRUITER_PILOT_MODE==='true')return res.status(409).json({error:'Payments are disabled while recruiter pilot mode is enabled'});
      const {pkg,coupon,quote}=await quoteFor(user.db,req.body?.packageId,req.body?.couponCode);
      const orderRef=orgRef.collection('payment_orders').doc(),receipt=`rc_${orderRef.id.slice(0,24)}`;
      const item={status:'creating',packageId:pkg.id,packageName:pkg.name,credits:pkg.credits,units:pkg.units,subtotalInr:quote.subtotalInr,discountInr:quote.discountInr,
        taxInr:quote.taxInr,taxPercent:quote.taxPercent,totalInr:quote.totalInr,totalPaise:quote.totalPaise,couponCode:coupon?.id||null,createdByUid:user.uid,createdAt:new Date(),updatedAt:new Date()};
      await orderRef.set(item);
      try{const order=await razor('/orders',{method:'POST',body:JSON.stringify({amount:quote.totalPaise,currency:'INR',receipt,notes:{purchase_id:orderRef.id,org_id:user.orgId,package_id:pkg.id}})});
        await orderRef.update({status:'pending',razorpayOrderId:order.id,updatedAt:new Date()});
        return res.status(201).json({purchaseId:orderRef.id,keyId:process.env.RAZORPAY_KEY_ID,orderId:order.id,amount:order.amount,currency:order.currency,
          package:{...pkg},coupon:couponPublic(coupon),quote,organizationName:orgSnap.data().name||'Recruiter Team',email:user.email});
      }catch(error){await orderRef.update({status:'failed',failureReason:error.message,updatedAt:new Date()});throw error;}
    }
    if(action==='verify-payment'){
      const purchaseId=String(req.body?.purchaseId||''),orderId=String(req.body?.razorpay_order_id||''),paymentId=String(req.body?.razorpay_payment_id||''),signature=String(req.body?.razorpay_signature||'');
      if(!/^[A-Za-z0-9_-]{10,80}$/.test(purchaseId))return res.status(400).json({error:'Invalid payment reference'});
      const orderRef=orgRef.collection('payment_orders').doc(purchaseId),orderSnap=await orderRef.get();if(!orderSnap.exists)return res.status(404).json({error:'Payment order not found'});
      const order=orderSnap.data();if(order.status==='paid')return res.status(200).json({ok:true,alreadyProcessed:true});
      if(order.razorpayOrderId!==orderId)return res.status(400).json({error:'Payment order mismatch'});
      const expected=createHmac('sha256',process.env.RAZORPAY_KEY_SECRET||'').update(`${orderId}|${paymentId}`).digest('hex');
      if(!safeCompareHex(expected,signature))return res.status(400).json({error:'Payment signature verification failed'});
      const payment=await razor(`/payments/${encodeURIComponent(paymentId)}`);await finalizePayment(user.db,user.orgId,purchaseId,payment);
      const fresh=await orgRef.get();return res.status(200).json({ok:true,wallet:walletView(fresh.data())});
    }
    if(action==='sync'){
      const credited=await syncPending(user.db,user.orgId),fresh=await orgRef.get();return res.status(200).json({ok:true,credited,wallet:walletView(fresh.data())});
    }
    if(action==='save-pricing'){
      if(!isPlatformAdmin(user.email))return res.status(403).json({error:'Platform administrator access is required'});
      const packagePrices={};for(const id of Object.keys(CREDIT_PACKAGES)){const value=Math.round(Number(req.body?.packagePrices?.[id]));if(!Number.isFinite(value)||value<100||value>1000000)return res.status(400).json({error:`Enter a valid price for ${CREDIT_PACKAGES[id].name}`});packagePrices[id]=value;}
      await user.db.collection('recruiter_settings').doc('commerce').set({packagePrices,updatedAt:new Date(),updatedBy:user.email},{merge:true});
      return res.status(200).json({packages:configuredPackages(packagePrices)});
    }
    if(action==='list-coupons'){
      if(!isPlatformAdmin(user.email))return res.status(403).json({error:'Platform administrator access is required'});
      const snap=await user.db.collection('recruiter_coupons').limit(100).get();const coupons=snap.docs.map(d=>couponPublic({id:d.id,...d.data()})).sort((a,b)=>a.code.localeCompare(b.code));
      return res.status(200).json({coupons});
    }
    if(action==='save-coupon'){
      if(!isPlatformAdmin(user.email))return res.status(403).json({error:'Platform administrator access is required'});
      const coupon=cleanCouponInput(req.body||{}),ref=user.db.collection('recruiter_coupons').doc(coupon.code),existing=await ref.get();
      await ref.set({...coupon,uses:existing.exists?(Number(existing.data().uses)||0):0,updatedAt:new Date(),...(existing.exists?{}:{createdAt:new Date(),createdBy:user.email})},{merge:true});
      return res.status(200).json({coupon:couponPublic({id:coupon.code,...coupon,uses:existing.exists?(Number(existing.data().uses)||0):0})});
    }
    if(action==='toggle-coupon'){
      if(!isPlatformAdmin(user.email))return res.status(403).json({error:'Platform administrator access is required'});
      const code=normalizeCouponCode(req.body?.code),ref=user.db.collection('recruiter_coupons').doc(code),snap=await ref.get();if(!snap.exists)return res.status(404).json({error:'Coupon not found'});
      await ref.update({active:req.body?.active===true,updatedAt:new Date()});return res.status(200).json({ok:true});
    }
    return res.status(400).json({error:'Unknown wallet action'});
  }catch(error){console.error('Wallet error',error?.message||error);return res.status(error.status||500).json({error:error.status?error.message:'Payment request could not be completed'});}
}
