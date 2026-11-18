import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";
import {
  Card,
  initialCards,
  summary,
  allocation,
  planTransfersToFiftyPercent,
  feasibility,
  formatGBP,
  exportCSV,
  buildReport,
  simulateCycle,
  downloadBlob,
} from "./model";
import { amortisation, dailyInterest, effectiveAnnualRate, fixedPayment, payoffMonths } from "./financialMath";
const empty: Card = { name: "", provider: "", limit: 0, balance: 0 };
function FinancialMathLab() {
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
      <label>Principal (£)<input type="number" min="0" value={principal} onChange={e=>setPrincipal(+e.target.value)}/></label>
      <label>APR (%)<input type="number" min="0" step="0.01" value={apr} onChange={e=>setApr(+e.target.value)}/></label>
      <label>Term (months)<input type="number" min="1" value={term} onChange={e=>setTerm(+e.target.value)}/></label>
      <label>Days in cycle<input type="number" min="1" value={days} onChange={e=>setDays(+e.target.value)}/></label>
    </div>
    <section className="grid metrics math-metrics">
      {[['Monthly rate',(apr/12).toFixed(3)+'%'],['Effective annual rate',effectiveAnnualRate(apr).toFixed(2)+'%'],['Fixed payment',formatGBP(payment)],['Interest for cycle',formatGBP(dailyInterest(principal,apr,days))],['Payoff duration',months+' months']].map(([k,v])=><div className="card metric"><span>{k}</span><strong>{v}</strong></div>)}
    </section>
    <h3>Amortisation schedule</h3>
    <table><thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Principal</th><th>Closing balance</th></tr></thead><tbody>{schedule.map(r=><tr><td>{r.month}</td><td>{formatGBP(r.payment)}</td><td>{formatGBP(r.interest)}</td><td>{formatGBP(r.principal)}</td><td>{formatGBP(r.balance)}</td></tr>)}</tbody></table>
    <div className="callout"><b>Formula notes:</b> Monthly rate = APR ÷ 12. EAR = (1 + monthly rate)¹² − 1. Daily interest uses Actual/365 by default. The standard payment formula is a geometric-series annuity calculation.</div>
    <p className="muted"><b>Advanced methods:</b> stochastic calculus, PDEs, copulas and Monte Carlo methods are portfolio-risk techniques; they are not silently substituted into this card ledger.</p>
  </section>;
}
function App() {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [darkMode, setDarkMode] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [transferSource, setTransferSource] = useState("");
  const [transferDestination, setTransferDestination] = useState("");
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferFee, setTransferFee] = useState(0);
  const [tab, setTab] = useState("Dashboard");
  const [edit, setEdit] = useState<Card | null>(null);
  const [external, setExternal] = useState(false);
  const [spend, setSpend] = useState(0);
  const [spendByCard, setSpendByCard] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState(0);
  const [fee, setFee] = useState(0);
  const [months, setMonths] = useState(1);
  const [selectedCycleMonth, setSelectedCycleMonth] = useState(1);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const s = useMemo(() => summary(cards), [cards]);
  const a = useMemo(() => allocation(cards), [cards]);
  const transferPlan = useMemo(() => planTransfersToFiftyPercent(cards), [cards]);
  const chartData = useMemo(() => cards.map((c) => ({ name: c.name.replace("Capital One ", "CO "), utilisation: +(c.balance / c.limit * 100).toFixed(1) })), [cards]);
  const scenarioData = useMemo(() => [{ name: "Current", balance: s.balance }, { name: "50% target", balance: s.target }, { name: "Every card ≤50%", balance: a.reduce((x,y)=>x+y.reduce,0) }, { name: "30% target", balance: s.limit*.3 }, { name: "25% target", balance: s.limit*.25 }, { name: "−£1,821", balance: s.balance-1821 }], [s,a]);
  const cardDateEvents = useMemo(() => cards.flatMap(c => [{ day:c.statement, type:"Statement", card:c.name }, { day:c.dd, type:"Direct Debit", card:c.name }].filter(x=>x.day).map(x=>({ ...x, date:`Day ${x.day}` }))).sort((x,y)=>(x.day as number)-(y.day as number)), [cards]);
  const transferPreview = useMemo(() => { const source=cards.find(c=>c.name===transferSource), destination=cards.find(c=>c.name===transferDestination); const amount=Math.max(0,Math.min(transferAmount,source?.balance||0,(destination?.limit||0)-(destination?.balance||0))); const feeAmount=amount*transferFee/100; return {source,destination,amount,feeAmount,totalDebtChange:feeAmount}; }, [cards,transferSource,transferDestination,transferAmount,transferFee]);
  const cardSpendTotal = useMemo(() => Object.values(spendByCard).reduce((sum, value) => sum + (value || 0), 0), [spendByCard]);
  const opts = { external: external ? 1821 : 0, spend: cardSpendTotal || spend, payment, fee, months };
  const status = useMemo(
    () => feasibility(cards, opts),
    [cards, external, spend, payment, fee, months],
  );
  const events = useMemo(
    () =>
      simulateCycle(cards, {
        start,
        months,
        spend: cardSpendTotal || spend,
        payment,
        external: external ? 1821 : 0,
        fee,
      }),
    [cards, start, months, spend, payment, external, fee],
  );
  const selectedMonthEvents = useMemo(() => {
    const base = new Date(start + "T00:00:00Z");
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + selectedCycleMonth - 1);
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    return events.filter((event: any) => {
      const date = new Date(event.date + "T00:00:00Z");
      return date.getUTCFullYear() === year && date.getUTCMonth() === month;
    });
  }, [events, start, selectedCycleMonth]);
  const selectedMonthSummary = useMemo(() => {
    const monthStart = new Date(start + "T00:00:00Z");
    monthStart.setUTCDate(1);
    monthStart.setUTCMonth(monthStart.getUTCMonth() + selectedCycleMonth - 1);
    const monthStartDate = monthStart.toISOString().slice(0, 10);
    const priorEvents: any[] = events.filter((event: any) => event.date < monthStartDate);
    return cards.map(card => {
      let opening = card.balance;
      priorEvents.forEach((event: any) => {
        if ((event.destination === card.name || event.source === card.name) && typeof event.cardAfter === "number") opening = event.cardAfter;
      });
      const cardEvents: any[] = selectedMonthEvents.filter((event: any) => event.destination === card.name || event.source === card.name);
      const spending = cardEvents.filter((event: any) => event.type === "New spending" && event.destination === card.name).reduce((sum: number, event: any) => sum + event.amount, 0);
      const repayments = cardEvents.filter((event: any) => event.type === "Direct Debit" && event.destination === card.name).reduce((sum: number, event: any) => sum + event.amount, 0);
      const last = [...cardEvents].reverse().find((event: any) => typeof event.cardAfter === "number" && (event.destination === card.name || event.source === card.name));
      const closing = last?.cardAfter ?? opening;
      return { ...card, opening, spending, repayments, closing, utilisation: card.limit ? closing / card.limit * 100 : 0 };
    });
  }, [cards, events, start, selectedCycleMonth, selectedMonthEvents]);
  const save = (c: Card) => {
    if (!c.name || c.limit <= 0 || c.balance < 0) return;
    if (edit?.name) {
      setCards((cs) => cs.map((x) => (x === edit ? c : x)));
    } else setCards((cs) => [...cs, c]);
    setEdit(null);
  };
  const exportSelectedMonth = () => {
    const rows = [["Month", "Card", "Opening", "Repayment", "Spending", "Closing", "Utilisation", "Status"]];
    selectedMonthSummary.forEach(card => rows.push(["Month " + selectedCycleMonth, card.name, card.opening.toFixed(2), card.repayments.toFixed(2), card.spending.toFixed(2), card.closing.toFixed(2), (card.utilisation / 100).toFixed(4), card.utilisation > 50 ? "Above 50%" : "Within target"]));
    rows.push([]);
    rows.push(["Date", "Event", "Source", "Destination", "Amount", "Reason"]);
    selectedMonthEvents.forEach((event: any) => rows.push([event.date, event.type, event.source, event.destination, event.amount.toFixed(2), event.reason]));
    downloadBlob(rows.map(row => row.map(value => '"' + String(value ?? "").replaceAll('"', '""') + '"').join(",")).join("\n"), "monthly-plan-" + selectedCycleMonth + ".csv", "text/csv");
  };
  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const add = (n, data) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), n);
    add("Summary", [
      ["Metric", "Value"],
      ["Total limit", s.limit],
      ["Total balance", s.balance],
      ["Utilisation", s.util / 100],
      ["50% target", s.target],
      ["Difference", s.diff],
    ]);
    add("Card Inputs", [
      [
        "Card",
        "Provider",
        "Limit",
        "Balance",
        "Statement day",
        "DD day",
        "APR",
        "Utilisation",
      ],
      ...cards.map((c) => [
        c.name,
        c.provider,
        c.limit,
        c.balance,
        c.statement ?? "",
        c.dd ?? "",
        c.apr ?? "",
        c.balance / c.limit,
      ]),
    ]);
    add("Initial Allocation", [
      ["Card", "Current", "Target", "Reduce", "Result", "Utilisation"],
      ...a.map((x) => [
        x.name,
        x.current,
        x.target,
        x.reduce,
        x.result,
        x.util / 100,
      ]),
    ]);
    add("Transactions", [
      [
        "Date",
        "Type",
        "Source",
        "Destination",
        "Amount",
        "Reason",
        "Before",
        "After",
        "Util before",
        "Util after",
      ],
      ...events.map((e) => [
        e.date,
        e.type,
        e.source,
        e.destination,
        e.amount,
        e.reason,
        e.before,
        e.after,
        e.utilBefore / 100,
        e.utilAfter / 100,
      ]),
    ]);
    add("Assumptions", [
      ["Item", "Value"],
      ["Mode", "Simulation only"],
      ["Transfer fee default", "0%"],
      ["External cycle payment", "£0"],
      ["One-time adjustment", "£1,821"],
      [
        "Accounting formula",
        "Opening + spending + fees - repayments - external - adjustments = closing",
      ],
    ]);
    XLSX.writeFile(wb, "credit-card-simulator.xlsx");
  };
  return (
    <div className={darkMode ? "app dark-mode" : "app"}>
      <header>
        <div>
          <span className="eyebrow">JOB ASSIGNMENT TOOL</span>
          <h1>Credit Card Utilisation Management Simulator</h1>
          <p className="subtitle">
            Educational model · every event is simulated
          </p>
        </div>
        <div className="header-actions"><button className="theme-toggle" onClick={()=>setDarkMode(v=>!v)} aria-label="Toggle colour theme">{darkMode ? "☀ Light" : "◐ Dark"}</button><button className="theme-toggle" onClick={()=>setPresentationMode(v=>!v)}>{presentationMode ? "Exit presentation" : "Presentation mode"}</button><span className="badge">SIMULATION ONLY</span></div>
      </header>
      {!presentationMode && <nav>
        {[
          "Dashboard",
          "Cards",
          "Allocation",
          "Monthly Cycle",
          "Calendar",
          "Scenarios",
          "Financial Math Lab",
          "Reports",
        ].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </nav>}
      {tab === "Dashboard" && (
        <>
          <section className="dashboard-hero">
            <div className="hero-copy">
              <span className="eyebrow">EXECUTIVE CONTROL ROOM</span>
              <h2>Know the position before the next cycle starts.</h2>
              <p>Track utilisation, repayment pressure and the five-month simulated ledger from one clear view.</p>
              <div className="hero-actions">
                <button className="hero-primary" onClick={() => setTab("Monthly Cycle")}>Open monthly cycle</button>
                <button className="hero-secondary" onClick={() => setPresentationMode(true)}>Start presentation</button>
              </div>
            </div>
            <div className="hero-gauge-wrap">
              <div className="hero-gauge" style={{background: "conic-gradient(#73edb9 0deg, #73edb9 " + Math.min(s.util,100)*3.6 + "deg, #ffffff18 " + Math.min(s.util,100)*3.6 + "deg 360deg)"}}>
                <div className="hero-gauge-inner"><strong>{s.util}%</strong><span>used</span></div>
              </div>
              <div className="hero-gauge-meta"><b>50% target</b><span>{formatGBP(s.diff)} above target</span></div>
            </div>
          </section>
          <section className="cycle-strip" aria-label="Simulation status">
            <div><span className="strip-dot green-dot"></span><b>Simulation only</b><small>No bank connection</small></div>
            <div><span className="strip-dot amber-dot"></span><b>{s.above} cards need attention</b><small>Above 50% utilisation</small></div>
            <div><span className="strip-dot blue-dot"></span><b>0% transfer fee</b><small>Current assignment assumption</small></div>
            <div><span className="strip-dot red-dot"></span><b>{status.label}</b><small>Based on current inputs</small></div>
          </section>
          <section className="notice">
            <b>Simulation only.</b> No banks, payment systems, Direct Debits, or
            real money are connected. Transfers redistribute debt; they do not
            remove it.
          </section>
          <section className="grid metrics">
            {[
              ["Total credit limit", s.limit],
              ["Total balance", s.balance],
              ["Overall utilisation", s.util + "%"],
              ["Available credit", s.available],
              ["Target at 50%", s.target],
              ["Difference from target", s.diff],
            ].map(([k, v]) => (
              <div className="card metric">
                <span>{k}</span>
                <strong>{typeof v === "number" ? formatGBP(v) : v}</strong>
              </div>
            ))}
          </section>
          <section className="grid two">
            <div className="panel">
              <h2>Utilisation health</h2>
              <div className="bar">
                <i style={{ width: `${Math.min(s.util, 100)}%` }} />
              </div>
              <p>
                {s.above} cards above 50% · {s.below} at or below 50%
              </p>
              <p className={status.ok ? "ok" : "danger"}>{status.label}</p>
            </div>
            <div className="panel">
              <h2>Assignment assumptions</h2>
              <ul>
                <li>
                  Transfer fee: <b>{fee}%</b>
                </li>
                <li>
                  Recurring external payment: <b>£0</b>
                </li>
                <li>
                  One-time adjustment: <b>£1,821</b>{" "}
                  {external ? "included" : "not included"}
                </li>
                <li>Target: every card ≤ 50%</li>
              </ul>
            </div>
          </section>
          <section className="panel chart-panel">
            <div className="row"><div><h2>Card utilisation map</h2><p className="muted">Each bar is compared with the 50% target.</p></div><span className="pill green">LIVE MODEL</span></div>
            <ResponsiveContainer width="100%" height={300}><BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 42 }}><CartesianGrid strokeDasharray="3 3" stroke="#e6edef" vertical={false}/><XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={65} tick={{fontSize:11}}/><YAxis unit="%" tick={{fontSize:11}}/><Tooltip formatter={(value)=>[`${value}%`, "Utilisation"]}/><Bar dataKey="utilisation" fill="#20a879" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
          </section>
          <section className="panel health-panel">
            <div className="row"><div><h2>Card health monitor</h2><p className="muted">Every card compared with its individual 50% threshold.</p></div><span className="pill green">CARD LEVEL</span></div>
            <div className="health-grid">
              {cards.map((card) => {
                const utilisation = (card.balance / card.limit) * 100;
                const target = card.limit * 0.5;
                const over = Math.max(0, card.balance - target);
                const state = utilisation > 50 ? "Above target" : utilisation > 35 ? "Watch" : "Within target";
                return <article className={"health-card " + (utilisation > 50 ? "health-danger" : utilisation > 35 ? "health-watch" : "health-safe")} key={card.name}>
                  <div className="health-card-top"><div><b>{card.name}</b><small>{card.provider}</small></div><span className="health-status">{state}</span></div>
                  <div className="health-values"><strong>{utilisation.toFixed(1)}%</strong><span>{formatGBP(card.balance)} / {formatGBP(card.limit)}</span></div>
                  <div className="health-track"><i style={{width: Math.min(utilisation,100) + "%"}}></i><em style={{left:"50%"}}></em></div>
                  <div className="health-foot"><span>50% target: {formatGBP(target)}</span><span>{over > 0 ? formatGBP(over) + " over" : formatGBP(card.limit-card.balance) + " available"}</span></div>
                </article>;
              })}
            </div>
          </section>
          <section className="panel">
            <h2>Validation</h2>
            <p>
              Supplied totals: <b>{formatGBP(s.limit)}</b> limit,{" "}
              <b>{formatGBP(s.balance)}</b> balance, <b>{s.util}%</b>{" "}
              utilisation, <b>{formatGBP(s.diff)}</b> to reach 50% overall.
            </p>
            <p className="warning">
              Missing: Santander A statement date and Santander B statement date.
              Barclays Rewards is configured for statement day 5 and Direct Debit day 30. APRs remain optional.
            </p>
          </section>
        </>
      )}
      {tab === "Cards" && (
        <section className="panel">
          <div className="row">
            <h2>Card management</h2>
            <button onClick={() => setEdit(empty)}>Add simulated card</button>
          </div>
          {edit && (
            <div className="editor">
              {[
                ["name", "Card name"],
                ["provider", "Provider"],
                ["limit", "Credit limit"],
                ["balance", "Opening balance"],
                ["statement", "Statement day"],
                ["dd", "Direct Debit day"],
                ["apr", "APR %"],
                ["fee", "Transfer fee %"],
              ].map(([key, label]) => (
                <label>
                  {label}
                  <input
                    type={
                      key === "name" || key === "provider" ? "text" : "number"
                    }
                    value={(edit as any)[key] ?? ""}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        [key]:
                          key === "name" || key === "provider"
                            ? e.target.value
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <div>
                <button onClick={() => save(edit)}>Save card</button>
                <button onClick={() => setEdit(null)}>Cancel</button>
              </div>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>Card</th>
                <th>Limit</th>
                <th>Balance</th>
                <th>Statement</th>
                <th>DD</th>
                <th>Utilisation</th>
                <th>Audit flag</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr>
                  <td>
                    <b>{c.name}</b>
                    <small>{c.provider}</small>
                  </td>
                  <td>{formatGBP(c.limit)}</td>
                  <td>{formatGBP(c.balance)}</td>
                  <td>{c.statement ?? "Missing"}</td>
                  <td>{c.dd ?? "Missing"}</td>
                  <td>
                    <span
                      className={
                        c.balance / c.limit > 0.5 ? "pill red" : "pill green"
                      }
                    >
                      {((c.balance / c.limit) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    {c.balance < 0 ? <span className="pill red">Negative balance</span> : c.balance > c.limit ? <span className="pill red">Over limit</span> : <span className="pill green">Within limit</span>}
                  </td>
                  <td>
                    <button onClick={() => setEdit(c)}>Edit</button><button onClick={() => setSelectedCard(c)}>View</button>
                    <button
                      onClick={() =>
                        setCards((cs) => cs.filter((x) => x !== c))
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "Allocation" && (
        <section className="panel">
          <h2>Initial 50% allocation</h2>
          <p className="muted">
            Reallocation cannot reduce total debt without repayment or external
            money.
          </p>
          <div className="transfer-builder"><div className="row"><div><h3>Transfer builder</h3><p className="muted">Preview a simulated card-to-card transfer. No real transfer is created.</p></div><span className="pill green">LEDGER PREVIEW</span></div><div className="controls"><label>Source card<select value={transferSource} onChange={e=>setTransferSource(e.target.value)}><option value="">Choose source</option>{cards.map(c=><option value={c.name}>{c.name}</option>)}</select></label><label>Destination card<select value={transferDestination} onChange={e=>setTransferDestination(e.target.value)}><option value="">Choose destination</option>{cards.map(c=><option value={c.name}>{c.name}</option>)}</select></label><label>Transfer amount<input type="number" min="0" value={transferAmount} onChange={e=>setTransferAmount(+e.target.value)}/></label><label>Fee %<input type="number" min="0" value={transferFee} onChange={e=>setTransferFee(+e.target.value)}/></label></div>{transferPreview.source&&transferPreview.destination&&transferPreview.source!==transferPreview.destination&&<div className="transfer-preview"><p><b>{formatGBP(transferPreview.amount)}</b> moves from {transferPreview.source.name} to {transferPreview.destination.name}.</p><p>Source after: <b>{formatGBP(transferPreview.source.balance-transferPreview.amount)}</b> · Destination after: <b>{formatGBP(transferPreview.destination.balance+transferPreview.amount)}</b></p><p className="warning">Total debt change: <b>+{formatGBP(transferPreview.totalDebtChange)}</b> from fees. The transfer itself creates no debt reduction.</p></div>}</div>
          <section className="suggested-transfer-plan">
            <div className="row"><div><h3>Suggested simulated transfer plan</h3><p className="muted">Routes move existing balances into cards with room below 50%.</p></div><span className="pill green">0% FEE ASSUMPTION</span></div>
            <div className="plan-totals"><div><span>Can be reallocated</span><b>{formatGBP(transferPlan.transferTotal)}</b></div><div><span>Repayment still required</span><b>{formatGBP(transferPlan.repaymentTotal)}</b></div></div>
            {transferPlan.transfers.length > 0 ? <table><thead><tr><th>Take from</th><th>Put into</th><th>Amount</th></tr></thead><tbody>{transferPlan.transfers.map((route,index)=><tr key={route.source+route.destination+index}><td>{route.source}</td><td>{route.destination}</td><td><b>{formatGBP(route.amount)}</b></td></tr>)}</tbody></table> : <p className="ok">No card-to-card reallocation is needed.</p>}
            {transferPlan.repayments.length > 0 && <><h3>Amount to repay to reach 50%</h3><table><thead><tr><th>Card to pay down</th><th>Repayment needed</th></tr></thead><tbody>{transferPlan.repayments.map(item=><tr key={item.card}><td>{item.card}</td><td><b>{formatGBP(item.amount)}</b></td></tr>)}</tbody></table></>}
            <p className="callout">Transfer routes alone cannot lower total debt. These are simulated only. If a route or fee differs in the real product, do not use it as a payment instruction.</p>
          </section>
          <table>
            <thead>
              <tr>
                <th>Card</th>
                <th>Current</th>
                <th>Target</th>
                <th>Reduce</th>
                <th>Result</th>
                <th>Result util.</th>
              </tr>
            </thead>
            <tbody>
              {a.map((x) => (
                <tr>
                  <td>{x.name}</td>
                  <td>{formatGBP(x.current)}</td>
                  <td>{formatGBP(x.target)}</td>
                  <td>{formatGBP(x.reduce)}</td>
                  <td>{formatGBP(x.result)}</td>
                  <td>{x.util.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="callout">
            £1,821 is a separate external-payment/accounting-adjustment
            requirement, not money created by cycling.
          </div>
        </section>
      )}
      {tab === "Monthly Cycle" && (
        <section className="panel">
          <h2>Monthly cycle simulator</h2>
          <div className="controls">
            <label>
              Start date
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Months
              <input
                type="number"
                min="1"
                value={months}
                onChange={(e) => setMonths(+e.target.value)}
              />
            </label>
            <label>
              New spending / month
              <input
                type="number"
                min="0"
                value={spend}
                onChange={(e) => setSpend(+e.target.value)}
              />
            </label>
            <label>
              Repayment / month
              <input
                type="number"
                min="0"
                value={payment}
                onChange={(e) => setPayment(+e.target.value)}
              />
            </label>
            <label>
              Transfer fee %
              <input
                type="number"
                min="0"
                value={fee}
                onChange={(e) => setFee(+e.target.value)}
              />
            </label>
          </div>
          <div className="monthly-planner-toolbar"><div><b>Monthly planner view</b><p className="muted">Inspect one simulated month at a time.</p></div><label>View month<select value={selectedCycleMonth} onChange={e=>setSelectedCycleMonth(Math.max(1,Math.min(months,+e.target.value)))}>{Array.from({length:Math.max(1,months)},(_,i)=><option key={i+1} value={i+1}>Month {i+1}</option>)}</select></label><div className="planner-stat"><span>Events</span><b>{selectedMonthEvents.length}</b></div><div className="planner-stat"><span>Amount moved</span><b>{formatGBP(selectedMonthEvents.reduce((sum,e)=>sum+e.amount,0))}</b></div><button className="planner-export" onClick={exportSelectedMonth}>Export month CSV</button></div>
          <div className="card-spend-grid">
            <h3>New spending by card / month</h3>
            <div className="controls">{cards.map(c=><label key={c.name}>{c.name}<input type="number" min="0" value={spendByCard[c.name] ?? 0} onChange={e=>setSpendByCard({...spendByCard,[c.name]:Math.max(0,+e.target.value)})}/></label>)}</div>
            <p className="muted">Total card-level spending: <b>{formatGBP(cardSpendTotal)}</b>. If all values are zero, the general spending input above is used.</p>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={external}
              onChange={(e) => setExternal(e.target.checked)}
            />{" "}
            Include one-time £1,821 accounting adjustment
          </label>
          <div className={status.ok ? "result ok" : "result danger"}>
            <b>{status.label}</b>
            <p>{status.detail}</p>
            <p>Closing debt: {formatGBP(status.closing)}</p>
          </div>
          <section className="event-timeline-panel">
            <div className="row"><div><h3>Cycle timeline</h3><p className="muted">Events are ordered by simulated date.</p></div><span className="pill green">{events.length} EVENTS</span></div>
            <div className="event-timeline">
              {selectedMonthEvents.slice(0, 16).map((event, index) => <div className="timeline-item" key={event.date + event.type + event.destination + index}>
                <div className="timeline-marker"></div>
                <div className="timeline-content"><div className="timeline-top"><b>{event.type}</b><time>{event.date}</time></div><p>{event.source} → {event.destination}</p><small>{event.reason} · {formatGBP(event.amount)}</small></div>
              </div>)}
            </div>
            {selectedMonthEvents.length > 16 && <p className="muted timeline-more">Showing first 16 events for this month. Full details remain in the ledger below.</p>}
          </section>
          <h3>Monthly card snapshot</h3>
          <table className="monthly-snapshot"><thead><tr><th>Card</th><th>Opening</th><th>Repayment</th><th>Spending</th><th>Closing</th><th>Utilisation</th><th>Status</th></tr></thead><tbody>{selectedMonthSummary.map(card => <tr key={card.name}><td><b>{card.name}</b><small>{card.provider}</small></td><td>{formatGBP(card.opening)}</td><td>{formatGBP(card.repayments)}</td><td>{formatGBP(card.spending)}</td><td>{formatGBP(card.closing)}</td><td>{card.utilisation.toFixed(1)}%</td><td><span className={card.utilisation > 50 ? "pill red" : "pill green"}>{card.utilisation > 50 ? "Above 50%" : "Within target"}</span></td></tr>)}</tbody></table>
          <h3>Chronological ledger</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Source → destination</th>
                <th>Amount</th>
                <th>Balance after</th>
                <th>Utilisation after</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr>
                  <td>{e.date}</td>
                  <td>
                    {e.type}
                    <small>{e.reason}</small>
                  </td>
                  <td>
                    {e.source} → {e.destination}
                  </td>
                  <td>{formatGBP(e.amount)}</td>
                  <td>{formatGBP(e.after)}</td>
                  <td>{e.utilAfter.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "Calendar" && (
        <section className="panel">
          <h2>Calendar and funding checks</h2>
          <p className="warning">
            A Direct Debit on day 1 needs funding before the 1st. Later payments
            cannot fund that same event unless a starting cash balance is
            modelled.
          </p>
          <h3>Card dates</h3>
          <table>
            <thead>
              <tr>
                <th>Card</th>
                <th>Statement day</th>
                <th>DD day</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr>
                  <td>{c.name}</td>
                  <td>{c.statement ?? "Missing"}</td>
                  <td>{c.dd ?? "Missing"}</td>
                  <td>{c.statement && c.dd ? "Ready" : "Needs date input"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Chronological monthly date map</h3>
          <table><thead><tr><th>Day</th><th>Event</th><th>Card</th><th>Funding note</th></tr></thead><tbody>{cardDateEvents.map(e=><tr><td>{e.date}</td><td>{e.type}</td><td>{e.card}</td><td className={e.type === "Direct Debit" && e.day === 1 ? "warning" : ""}>{e.type === "Direct Debit" && e.day === 1 ? "Needs funding before the 1st" : e.type === "Direct Debit" ? "Funding required before this date" : "Statement generated"}</td></tr>)}</tbody></table>
          <h3>Simulated event calendar</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Funding / source</th>
                <th>Amount</th>
                <th>Balance after</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr>
                  <td>{e.date}</td>
                  <td>{e.type}</td>
                  <td>{e.source}</td>
                  <td>{formatGBP(e.amount)}</td>
                  <td>{formatGBP(e.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "Scenarios" && (
        <section className="panel">
          <h2>Scenario comparison</h2>
          <ResponsiveContainer width="100%" height={280}><BarChart data={scenarioData} margin={{top:8,right:12,left:0,bottom:45}}><CartesianGrid strokeDasharray="3 3" stroke="#e6edef" vertical={false}/><XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={60} tick={{fontSize:11}}/><YAxis tickFormatter={(v)=>`£${Math.round(v/1000)}k`} tick={{fontSize:11}}/><Tooltip formatter={(value)=>[formatGBP(Number(value)),"Balance"]}/><Bar dataKey="balance" fill="#183e49" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Target balance</th>
                <th>Adjustment</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Current balances", s.balance, 0, "Baseline"],
                [
                  "Exactly 50% overall",
                  s.target,
                  s.diff ? "£1,821 required" : "£0",
                  "Requires repayment",
                ],
                [
                  "Every card ≤50%",
                  a.reduce((x, y) => x + y.reduce, 0),
                  a.reduce((x, y) => x + y.reduce, 0),
                  "Card-level constraint",
                ],
                ["30% overall", s.limit * 0.3, "Variable", "Lower debt"],
                ["25% overall", s.limit * 0.25, "Variable", "Lower debt"],
                [
                  "No external payment",
                  s.balance,
                  0,
                  "Transfers conserve debt",
                ],
                [
                  "One-time £1,821 adjustment",
                  s.balance - 1821,
                  1821,
                  "Separate adjustment",
                ],
              ].map((r) => (
                <tr>
                  {r.map((x) => (
                    <td>{typeof x === "number" ? formatGBP(x) : x}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "Financial Math Lab" && (
        <FinancialMathLab />
      )}
      {tab === "Reports" && (
        <section className="panel">
          <h2>Reports and exports</h2>
          <p>
            Auditable report with assumptions, card calculations, chronological
            events, feasibility and reconciliation.
          </p>
          <div className="actions">
            <button
              onClick={() =>
                downloadBlob(
                  buildReport(cards, status, events),
                  "simulation-report.txt",
                  "text/plain",
                )
              }
            >
              Download report
            </button>
            <button onClick={() => exportCSV(cards)}>Export CSV</button>
            <button onClick={exportXlsx}>Export Excel workbook</button>
            <button
              onClick={() => {
                const doc = new jsPDF();
                doc.setFontSize(16);
                doc.text(
                  "Credit Card Utilisation Management Simulator",
                  14,
                  18,
                );
                doc.setFontSize(9);
                doc.text(
                  doc.splitTextToSize(buildReport(cards, status, events), 180),
                  14,
                  28,
                );
                doc.save("simulation-report.pdf");
              }}
            >
              Download PDF
            </button>
            <button
              onClick={() =>
                fetch("/api/scenarios", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: "Assignment scenario",
                    payload: { cards, options: opts, events },
                  }),
                }).then(() =>
                  alert(
                    "Scenario saved to the local SQLite simulation database.",
                  ),
                )
              }
            >
              Save scenario
            </button>
            <button onClick={() => window.print()}>Print</button>
          </div>
          <pre>{buildReport(cards, status, events)}</pre>
        </section>
      )}
      {selectedCard && <div className="drawer-backdrop" onClick={()=>setSelectedCard(null)}><aside className="detail-drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={()=>setSelectedCard(null)} aria-label="Close card details">×</button><span className="eyebrow">CARD DETAIL</span><h2>{selectedCard.name}</h2><p className="muted">{selectedCard.provider}</p><div className="drawer-grid"><div><span>Balance</span><b>{formatGBP(selectedCard.balance)}</b></div><div><span>Credit limit</span><b>{formatGBP(selectedCard.limit)}</b></div><div><span>Utilisation</span><b>{(selectedCard.balance/selectedCard.limit*100).toFixed(1)}%</b></div><div><span>Available</span><b>{formatGBP(selectedCard.limit-selectedCard.balance)}</b></div><div><span>Statement</span><b>{selectedCard.statement ?? "Missing"}</b></div><div><span>Direct Debit</span><b>{selectedCard.dd ?? "Missing"}</b></div></div><div className="callout">50% target balance: <b>{formatGBP(selectedCard.limit*.5)}</b><br/>Amount above target: <b>{formatGBP(Math.max(0,selectedCard.balance-selectedCard.limit*.5))}</b></div></aside></div>}
      <footer>
        Prototype v0.3 · Simulation Only · No banking integrations
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

