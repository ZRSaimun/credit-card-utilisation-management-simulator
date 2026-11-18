import { useMemo, useState } from "react";
import { amortisation, dailyInterest, effectiveAnnualRate, fixedPayment, payoffMonths } from "./financialMath";
import { formatGBP } from "./model";
import "./styles.css";

export default function FinancialMathLab() {
  const [principal, setPrincipal] = useState(1000);
  const [apr, setApr] = useState(24);
  const [term, setTerm] = useState(12);
  const [days, setDays] = useState(30);
  const schedule = useMemo(() => amortisation(principal, apr, term), [principal, apr, term]);
  const payment = fixedPayment(principal, apr, term);
  const months = payoffMonths(principal, apr, payment);
  const [bengali, setBengali] = useState(false);
  return <section className="panel math-lab">
    <div className="row"><div><span className="eyebrow">FINANCIAL MATHEMATICS</span><h2>Interest, payoff and amortisation lab</h2></div><span className="pill green">EDUCATIONAL MODEL</span></div>
    <div className="language-switch"><button className={bengali ? "" : "active"} onClick={()=>setBengali(false)}>English</button><button className={bengali ? "active" : ""} onClick={()=>setBengali(true)}>বাংলা</button></div>
    <p className="muted">{bengali ? "APR, EAR, দৈনিক সুদ এবং কিস্তির হিসাব এখানে স্বচ্ছভাবে দেখানো হয়। এটি শুধু শিক্ষামূলক সিমুলেশন; কোনও ব্যাংক বা পেমেন্ট সিস্টেমের সঙ্গে সংযুক্ত নয়।" : "Transparent formulas for APR, EAR, daily day-count interest and fixed-payment schedules. These calculations do not connect to a lender or create payments."}</p>
    <div className="controls">
      <label>Principal (£)<input aria-label="Principal in pounds" type="number" min="0" value={principal} onChange={e=>setPrincipal(+e.target.value)}/></label>
      <label>APR (%)<input aria-label="APR percentage" type="number" min="0" step="0.01" value={apr} onChange={e=>setApr(+e.target.value)}/></label>
      <label>Term (months)<input aria-label="Term in months" type="number" min="1" value={term} onChange={e=>setTerm(+e.target.value)}/></label>
      <label>Days in cycle<input aria-label="Days in cycle" type="number" min="1" value={days} onChange={e=>setDays(+e.target.value)}/></label>
    </div>
    <section className="grid metrics math-metrics">
      {[['Monthly rate',(apr/12).toFixed(3)+'%'],['Effective annual rate',effectiveAnnualRate(apr).toFixed(2)+'%'],['Fixed payment',formatGBP(payment)],['Interest for cycle',formatGBP(dailyInterest(principal,apr,days))],['Payoff duration',months+' months']].map(([k,v])=><div className="card metric" key={String(k)}><span>{k}</span><strong>{v}</strong></div>)}
    </section>
    <h3>Amortisation schedule</h3>
    <table><thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Principal</th><th>Closing balance</th></tr></thead><tbody>{schedule.map(r=><tr key={r.month}><td>{r.month}</td><td>{formatGBP(r.payment)}</td><td>{formatGBP(r.interest)}</td><td>{formatGBP(r.principal)}</td><td>{formatGBP(r.balance)}</td></tr>)}</tbody></table>
    <div className="callout"><b>Formula notes:</b> Monthly rate = APR ÷ 12. EAR = (1 + monthly rate)¹² − 1. Daily interest uses Actual/365 by default. The standard payment formula is a geometric-series annuity calculation.</div>
    <p className="muted"><b>Advanced methods:</b> stochastic calculus, PDEs, copulas and Monte Carlo methods are portfolio-risk techniques; they are not silently substituted into this card ledger.</p>
  </section>;
}
