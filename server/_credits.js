import {availableUnits,assessmentCreditUnits,unitsToCredits} from '../lib/commerce.js';
import {requestFailure} from './_candidate.js';

export function reservationForAssessment(assessment){const units=assessmentCreditUnits(assessment);return {units,credits:unitsToCredits(units)};}

export async function releaseReservation(db,inviteRef,reason='released'){
  await db.runTransaction(async tx=>{
    const inviteSnap=await tx.get(inviteRef);if(!inviteSnap.exists)return;
    const invite=inviteSnap.data(),units=Number(invite.creditReservationUnits)||0;
    if(!units||invite.creditStatus!=='reserved')return;
    const orgRef=db.collection('recruiter_organizations').doc(invite.orgId),orgSnap=await tx.get(orgRef);if(!orgSnap.exists)return;
    tx.update(orgRef,{creditReservedUnits:Math.max(0,(Number(orgSnap.data().creditReservedUnits)||0)-units),updatedAt:new Date()});
    tx.update(inviteRef,{creditStatus:'released',creditReleaseReason:reason,creditReleasedAt:new Date(),...(reason==='invitation_expired'?{status:'expired'}:{}),updatedAt:new Date()});
  });
}

export async function reserveCredits(tx,db,orgId,assessment,orgSnap){
  const {units,credits}=reservationForAssessment(assessment),org=orgSnap.data();
  if(availableUnits(org)<units)throw requestFailure(`Not enough available credits. This assessment requires ${credits} credit${credits===1?'':'s'} per candidate.`,402);
  tx.update(db.collection('recruiter_organizations').doc(orgId),{creditReservedUnits:(Number(org.creditReservedUnits)||0)+units,updatedAt:new Date()});
  return {units,credits};
}

export async function consumeReservedCredits(tx,db,inviteRef,invite,orgSnap){
  const units=Number(invite.creditReservationUnits)||0;if(!units||invite.creditStatus!=='reserved')return null;
  const org=orgSnap.data(),balance=Number(org.creditBalanceUnits)||0,reserved=Number(org.creditReservedUnits)||0;
  if(balance<units||reserved<units)throw requestFailure('Reserved assessment credits are unavailable. Contact the recruiter.',402);
  const orgRef=db.collection('recruiter_organizations').doc(invite.orgId),ledgerRef=orgRef.collection('credit_transactions').doc();
  tx.update(orgRef,{creditBalanceUnits:balance-units,creditReservedUnits:Math.max(0,reserved-units),updatedAt:new Date()});
  tx.set(ledgerRef,{type:'assessment_use',units:-units,credits:-unitsToCredits(units),jobId:invite.jobId,candidateName:invite.name,candidateEmail:invite.email,invitationId:inviteRef.id,createdAt:new Date()});
  return {units,creditStatus:'consumed',creditsConsumedAt:new Date()};
}
