import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "./styles.css";
import {
  Card,
  initialCards,
  summary,
  allocation,
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
  return <section className="panel math-lab">
    <div className="row"><div><span className="eyebrow">FINANCIAL MATHEMATICS</span><h2>Interest, payoff and amortisation lab</h2></div><span className="pill green">EDUCATIONAL MODEL</span></div>
    <p className="muted">Transparent formulas for APR, EAR, daily day-count interest and fixed-payment schedules. These calculations do not connect to a lender or create payments.</p>
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
  const [tab, setTab] = useState("Dashboard");
  const [edit, setEdit] = useState<Card | null>(null);
  const [external, setExternal] = useState(false);
  const [spend, setSpend] = useState(0);
  const [payment, setPayment] = useState(0);
  const [fee, setFee] = useState(0);
  const [months, setMonths] = useState(1);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const s = useMemo(() => summary(cards), [cards]);
  const a = useMemo(() => allocation(cards), [cards]);
  const opts = { external: external ? 1821 : 0, spend, payment, fee, months };
  const status = useMemo(
    () => feasibility(cards, opts),
    [cards, external, spend, payment, fee, months],
  );
  const events = useMemo(
    () =>
      simulateCycle(cards, {
        start,
        months,
        spend,
        payment,
        external: external ? 1821 : 0,
        fee,
      }),
    [cards, start, months, spend, payment, external, fee],
  );
  const save = (c: Card) => {
    if (!c.name || c.limit <= 0 || c.balance < 0) return;
    if (edit?.name) {
      setCards((cs) => cs.map((x) => (x === edit ? c : x)));
    } else setCards((cs) => [...cs, c]);
    setEdit(null);
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
    <div className="app">
      <header>
        <div>
          <span className="eyebrow">JOB ASSIGNMENT TOOL</span>
          <h1>Credit Card Utilisation Management Simulator</h1>
          <p className="subtitle">
            Educational model · every event is simulated
          </p>
        </div>
        <span className="badge">SIMULATION ONLY</span>
      </header>
      <nav>
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
      </nav>
      {tab === "Dashboard" && (
        <>
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
          <section className="panel">
            <h2>Validation</h2>
            <p>
              Supplied totals: <b>{formatGBP(s.limit)}</b> limit,{" "}
              <b>{formatGBP(s.balance)}</b> balance, <b>{s.util}%</b>{" "}
              utilisation, <b>{formatGBP(s.diff)}</b> to reach 50% overall.
            </p>
            <p className="warning">
              Missing: Barclays Rewards statement/DD dates; Santander A
              statement date; Santander B statement date. APRs remain optional.
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
                    <button onClick={() => setEdit(c)}>Edit</button>
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
      <footer>
        Prototype v0.3 · Simulation Only · No banking integrations
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

