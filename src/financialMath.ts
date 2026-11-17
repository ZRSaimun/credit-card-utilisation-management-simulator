export type AmortisationRow={month:number;payment:number;interest:number;principal:number;balance:number};

/** Financial-mathematics helpers. These are educational calculations only. */
export function monthlyRateFromAPR(apr:number){return apr/100/12}
export function effectiveAnnualRate(apr:number){return (Math.pow(1+monthlyRateFromAPR(apr),12)-1)*100}
export function dailyInterest(balance:number,apr:number,days:number,convention:'actual365'|'30/360'='actual365'){return balance*(apr/100)*(days/(convention==='30/360'?360:365))}
export function fixedPayment(principal:number,apr:number,months:number){const r=monthlyRateFromAPR(apr);return r===0?principal/months:principal*r/(1-Math.pow(1+r,-months))}
export function payoffMonths(balance:number,apr:number,payment:number){const r=monthlyRateFromAPR(apr);if(payment<=balance*r)return Infinity;if(r===0)return Math.ceil(balance/payment);return Math.ceil(-Math.log(1-balance*r/payment)/Math.log(1+r))}
export function amortisation(principal:number,apr:number,months:number):AmortisationRow[]{const payment=fixedPayment(principal,apr,months),r=monthlyRateFromAPR(apr);let balance=principal;return Array.from({length:months},(_,i)=>{const interest=balance*r;const principalPaid=Math.min(balance,payment-interest);balance=Math.max(0,balance-principalPaid);return{month:i+1,payment:principalPaid+interest,interest,principal:principalPaid,balance}})}

