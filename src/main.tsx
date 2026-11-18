import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import "./styles.css";
import { AuthButton } from "./components/AuthButton";
import { ClerkSessionBridge } from "./components/ClerkSessionBridge";
import { UpgradeButton } from "./components/UpgradeButton";
import { track } from "./lib/posthog";
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
const FinancialMathLab = lazy(() => import("./FinancialMathLab"));
const UtilisationChart = lazy(() => import("./UtilisationChart"));
const ScenarioChart = lazy(() => import("./ScenarioChart"));
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
import { CloudScenarioRow, CloudScenarioVersionRow, CloudSession, deleteCloudScenario, getCloudSession, listCloudScenarioVersions, listCloudScenarios, saveCloudScenario, signInCloudUser, signOutCloudUser, signUpCloudUser, subscribeCloudAuth } from "./supabase";
type ScenarioSettings = {
  external: boolean;
  spend: number;
  spendByCard: Record<string, number>;
  payment: number;
  cashBudget?: number;
  startingCash?: number;
  paydayDay?: number;
  fee: number;
  months: number;
  start: string;
  selectedCycleMonth: number;
};
type SavedScenario = {
  id: string;
  name: string;
  savedAt: string;
  cards: Card[];
  settings: ScenarioSettings;
};
const SCENARIO_STORAGE_KEY = "credit-card-utilisation-simulator-scenarios-v1";
function isSavedScenario(value: any): value is SavedScenario {
  return !!value && typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.savedAt === "string" && Array.isArray(value.cards) &&
    value.cards.every((card: any) => card && typeof card.name === "string" &&
      typeof card.provider === "string" && Number.isFinite(card.limit) &&
      Number.isFinite(card.balance)) &&
    value.settings && typeof value.settings === "object" &&
    typeof value.settings.external === "boolean" && Number.isFinite(value.settings.spend) &&
    value.settings.spendByCard && typeof value.settings.spendByCard === "object" &&
    Number.isFinite(value.settings.payment) && (value.settings.cashBudget === undefined || Number.isFinite(value.settings.cashBudget)) && (value.settings.startingCash === undefined || Number.isFinite(value.settings.startingCash)) && (value.settings.paydayDay === undefined || Number.isFinite(value.settings.paydayDay)) && Number.isFinite(value.settings.fee) &&
    Number.isFinite(value.settings.months) && Number.isFinite(value.settings.selectedCycleMonth) &&
    typeof value.settings.start === "string";
}
function readSavedScenarios(): SavedScenario[] {
  try {
    const saved = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isSavedScenario) : [];
  } catch {
    return [];
  }
}
const empty: Card = { name: "", provider: "", limit: 0, balance: 0 };
class AppErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : "Unexpected application error" };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Simulator render error", error, info);
  }
  render() {
    if (this.state.hasError) {
      return <main className="app-error" role="alert">
        <span className="eyebrow">SIMULATOR RECOVERY</span>
        <h1>The simulator hit an unexpected error.</h1>
        <p>Nothing was sent to a bank or payment provider. Reload the page to restart the educational model.</p>
        <button onClick={() => window.location.reload()}>Reload simulator</button>
        <details><summary>Technical detail</summary><code>{this.state.message}</code></details>
      </main>;
    }
    return this.props.children;
  }
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
  const [editMessage, setEditMessage] = useState("");
  const [external, setExternal] = useState(false);
  const [spend, setSpend] = useState(0);
  const [spendByCard, setSpendByCard] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState(0);
  const [cashBudget, setCashBudget] = useState(0);
  const [startingCash, setStartingCash] = useState(0);
  const [paydayDay, setPaydayDay] = useState(1);
  const [fee, setFee] = useState(0);
  const [months, setMonths] = useState(1);
  const [selectedCycleMonth, setSelectedCycleMonth] = useState(1);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [scenarioName, setScenarioName] = useState("Assignment scenario");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(readSavedScenarios);
  const [scenarioMessage, setScenarioMessage] = useState("");
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudRows, setCloudRows] = useState<CloudScenarioRow[]>([]);
  const [cloudVersions, setCloudVersions] = useState<Record<string, CloudScenarioVersionRow[]>>({});
  const [expandedCloudScenario, setExpandedCloudScenario] = useState<string | null>(null);
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(() => window.localStorage.getItem("credit-card-simulator-guide-dismissed") !== "1");

  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.getElementById("boot-status")?.remove();
  }, []);

  const reloadCloudScenarios = async (session: CloudSession) => {
    const result = await listCloudScenarios(session);
    setCloudSession(result.session);
    setCloudRows(result.rows);
    return result.rows;
  };
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const stored = await getCloudSession();
        if (!stored) return;
        const result = await listCloudScenarios(stored);
        if (!cancelled) {
          setCloudSession(result.session);
          setCloudRows(result.rows);
          setCloudMessage("Secure cloud storage connected.");
        }
      } catch (error) {
        if (!cancelled) {
          setCloudSession(null);
          setCloudRows([]);
          setCloudMessage("Could not restore cloud session: " + String((error as Error).message || error));
        }
      }
    };
    void restore();
    const unsubscribe = subscribeCloudAuth(session => {
      if (!cancelled && session) setCloudSession(session);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  const s = useMemo(() => summary(cards), [cards]);
  const a = useMemo(() => allocation(cards), [cards]);
  const transferPlan = useMemo(() => planTransfersToFiftyPercent(cards), [cards]);
  const chartData = useMemo(() => cards.map((c) => ({ name: c.name.replace("Capital One ", "CO "), utilisation: +(c.balance / c.limit * 100).toFixed(1) })), [cards]);
  const scenarioData = useMemo(() => [{ name: "Current", balance: s.balance }, { name: "50% target", balance: s.target }, { name: "Every card ≤50%", balance: a.reduce((sum,item)=>sum+item.result,0) }, { name: "30% target", balance: s.limit*.3 }, { name: "25% target", balance: s.limit*.25 }, { name: "After 50% gap payment", balance: s.target }], [s,a]);
  const cardDateEvents = useMemo(() => [
    ...cards.flatMap(c => [{ day:c.statement, type:"Statement", card:c.name }, { day:c.dd, type:"Direct Debit", card:c.name }].filter(x=>x.day).map(x=>({ ...x, date:"Day " + x.day }))),
    ...(cashBudget > 0 ? [{ day:paydayDay, type:"Cash inflow", card:"Simulated payment account", date:"Day " + paydayDay }] : []),
  ].sort((x,y)=>(x.day as number)-(y.day as number)), [cards, cashBudget, paydayDay]);
  const transferPreview = useMemo(() => { const source=cards.find(c=>c.name===transferSource), destination=cards.find(c=>c.name===transferDestination); const amount=Math.max(0,Math.min(transferAmount,source?.balance||0,(destination?.limit||0)-(destination?.balance||0))); const feeAmount=amount*transferFee/100; return {source,destination,amount,feeAmount,totalDebtChange:feeAmount}; }, [cards,transferSource,transferDestination,transferAmount,transferFee]);
  const cardSpendTotal = useMemo(() => Object.values(spendByCard).reduce((sum, value) => sum + (value || 0), 0), [spendByCard]);
  const events = useMemo(
    () => simulateCycle(cards, {
      start,
      months,
      spend: cardSpendTotal || spend,
      payment,
      external: external ? s.diff : 0,
      fee,
      startingCash,
      monthlyCashInflow: cashBudget,
      incomeDay: paydayDay,
    }),
    [cards, start, months, spend, cardSpendTotal, payment, cashBudget, startingCash, paydayDay, external, fee, s.diff],
  );
  const actualRepaymentTotal = useMemo(() => events.filter(event => event.type === "Direct Debit").reduce((sum, event) => sum + event.amount, 0), [events]);
  const actualOneTimePayment = useMemo(() => events.filter(event => event.type === "Accounting adjustment").reduce((sum, event) => sum + event.amount, 0), [events]);
  const opts = { external: actualOneTimePayment, spend: cardSpendTotal || spend, payment: months > 0 ? actualRepaymentTotal / months : 0, fee, months };
  const status = useMemo(() => feasibility(cards, opts), [cards, actualOneTimePayment, actualRepaymentTotal, cardSpendTotal, spend, fee, months]);
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
  const selectedMonthCashBalance = selectedMonthEvents.filter(event => event.type === "Cash balance").at(-1)?.amount ?? (selectedCycleMonth === 1 ? startingCash : 0);
  const auditChecks = useMemo(() => {
    const missingDates = cards.filter(card => !card.statement || !card.dd);
    const overLimit = cards.filter(card => card.balance > card.limit);
    const highUtilisation = cards.filter(card => card.limit > 0 && card.balance / card.limit >= 0.8);
    const fundingShortfall = Math.max(0, payment * months - actualRepaymentTotal);
    const lowestCash = events.reduce((lowest, event: any) => Math.min(lowest, typeof event.cashAfter === "number" ? event.cashAfter : lowest), startingCash);
    const actions: string[] = [];
    if (s.diff > 0) actions.push(`Repay ${formatGBP(s.diff)} in the model to reach 50% overall utilisation.`);
    if (missingDates.length) actions.push(`Add statement and Direct Debit dates for ${missingDates.length} card${missingDates.length === 1 ? "" : "s"}.`);
    if (fundingShortfall > 0) actions.push(`Increase modeled cash funding by ${formatGBP(fundingShortfall)} across the selected cycle.`);
    if (overLimit.length) actions.push(`Review ${overLimit.length} over-limit card${overLimit.length === 1 ? "" : "s"} before running another cycle.`);
    if (!actions.length) actions.push("No priority exceptions found under the current assumptions.");
    return { missingDates, overLimit, highUtilisation, fundingShortfall, lowestCash, actions };
  }, [cards, events, months, payment, actualRepaymentTotal, startingCash, s.diff]);
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
  const storeSavedScenarios = (next: SavedScenario[]) => {
    try {
      window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(next));
      setSavedScenarios(next);
      return true;
    } catch {
      setScenarioMessage("Could not save in this browser. Check available site storage and try again.");
      return false;
    }
  };
  const saveScenario = () => {
    const name = scenarioName.trim();
    if (!name) {
      setScenarioMessage("Enter a name for this scenario first.");
      return;
    }
    const snapshot: SavedScenario = {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      name,
      savedAt: new Date().toISOString(),
      cards: cards.map(card => ({ ...card })),
      settings: { external, spend, spendByCard: { ...spendByCard }, payment, cashBudget, startingCash, paydayDay, fee, months, start, selectedCycleMonth },
    };
    if (storeSavedScenarios([snapshot, ...savedScenarios])) {
      track("simulation_saved", { storage: "browser", card_count: cards.length });
      setScenarioMessage("Saved “" + name + "” in this browser.");
    }
  };
  const loadScenario = (snapshot: SavedScenario) => {
    setCards(snapshot.cards.map(card => ({ ...card })));
    setExternal(snapshot.settings.external);
    setSpend(snapshot.settings.spend);
    setSpendByCard({ ...snapshot.settings.spendByCard });
    setPayment(snapshot.settings.payment);
    setCashBudget(snapshot.settings.cashBudget ?? 0);
    setStartingCash(snapshot.settings.startingCash ?? 0);
    setPaydayDay(snapshot.settings.paydayDay ?? 1);
    setFee(snapshot.settings.fee);
    setMonths(snapshot.settings.months);
    setStart(snapshot.settings.start);
    setSelectedCycleMonth(Math.max(1, Math.min(snapshot.settings.months, snapshot.settings.selectedCycleMonth || 1)));
    setScenarioMessage("Loaded “" + snapshot.name + "”.");
    setTab("Monthly Cycle");
  };
  const renameScenario = (snapshot: SavedScenario) => {
    const name = window.prompt("Enter a new scenario name", snapshot.name)?.trim();
    if (!name || name === snapshot.name) return;
    const next = savedScenarios.map(item => item.id === snapshot.id ? { ...item, name } : item);
    if (storeSavedScenarios(next)) setScenarioMessage("Renamed scenario to “" + name + "”.");
  };
  const deleteScenario = (snapshot: SavedScenario) => {
    if (!window.confirm("Delete saved scenario “" + snapshot.name + "”?")) return;
    const next = savedScenarios.filter(item => item.id !== snapshot.id);
    if (storeSavedScenarios(next)) setScenarioMessage("Deleted “" + snapshot.name + "”.");
  };
  const exportScenarioBackup = () => {
    downloadBlob(JSON.stringify({ format: "cc-utilisation-scenarios-v1", exportedAt: new Date().toISOString(), scenarios: savedScenarios }, null, 2), "credit-card-scenarios-backup.json", "application/json");
    setScenarioMessage("Scenario backup downloaded.");
  };
  const importScenarioBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const candidates = Array.isArray(parsed) ? parsed : parsed?.scenarios;
      const imported = Array.isArray(candidates) ? candidates.filter(isSavedScenario) : [];
      if (!imported.length) {
        setScenarioMessage("No valid scenarios were found in that backup.");
        return;
      }
      const merged = new Map(savedScenarios.map(item => [item.id, item]));
      imported.forEach(item => merged.set(item.id, item));
      const next = [...merged.values()];
      if (storeSavedScenarios(next)) setScenarioMessage("Imported " + imported.length + " scenario(s).");
    } catch {
      setScenarioMessage("Could not read that backup file. Choose a valid simulator JSON backup.");
    }
  };
  const currentScenarioSettings = (): ScenarioSettings => ({
    external, spend, spendByCard: { ...spendByCard }, payment, cashBudget, startingCash, paydayDay, fee, months, start, selectedCycleMonth,
  });
  const handleCloudSignUp = async () => {
    if (!cloudEmail.trim() || cloudPassword.length < 8) {
      setCloudMessage("Enter your email and a password with at least 8 characters.");
      return;
    }
    setCloudBusy(true);
    try {
      const session = await signUpCloudUser(cloudEmail.trim(), cloudPassword, window.location.origin + window.location.pathname);
      setCloudPassword("");
      if (session) {
        setCloudSession(session);
        await reloadCloudScenarios(session);
        setCloudMessage("Account created and signed in.");
      } else {
        setCloudMessage("Check your email to confirm the account, then sign in here.");
      }
    } catch (error) {
      setCloudMessage("Sign-up failed: " + String((error as Error).message || error));
    } finally { setCloudBusy(false); }
  };
  const handleCloudSignIn = async () => {
    setCloudBusy(true);
    try {
      const session = await signInCloudUser(cloudEmail.trim(), cloudPassword);
      setCloudSession(session);
      setCloudPassword("");
      await reloadCloudScenarios(session);
      setCloudMessage("Signed in. Your private cloud scenarios are loaded.");
    } catch (error) {
      setCloudMessage("Sign-in failed: " + String((error as Error).message || error));
    } finally { setCloudBusy(false); }
  };
  const handleCloudSignOut = async () => {
    if (!cloudSession) return;
    setCloudBusy(true);
    try { await signOutCloudUser(cloudSession); }
    catch { /* Local session is cleared even if the network sign-out fails. */ }
    setCloudSession(null);
    setCloudRows([]);
    setCloudVersions({});
    setExpandedCloudScenario(null);
    setCloudMessage("Signed out. Cloud scenario data remains in your account.");
    setCloudBusy(false);
  };
  const saveCurrentToCloud = async () => {
    if (!cloudSession) return;
    const name = scenarioName.trim() || "Cloud scenario";
    const snapshot: SavedScenario = {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      name,
      savedAt: new Date().toISOString(),
      cards: cards.map(card => ({ ...card })),
      settings: currentScenarioSettings(),
    };
    setCloudBusy(true);
    try {
      const next = await saveCloudScenario(cloudSession, {
        scenario_id: snapshot.id,
        name: snapshot.name,
        saved_at: snapshot.savedAt,
        payload: { cards: snapshot.cards, settings: snapshot.settings },
      });
      setCloudSession(next);
      await reloadCloudScenarios(next);
      setCloudMessage("Saved “" + name + "” to your private Supabase account.");
    } catch (error) {
      setCloudMessage("Could not save to cloud: " + String((error as Error).message || error));
    } finally { setCloudBusy(false); }
  };
  const loadCloudScenario = (row: CloudScenarioRow) => {
    const snapshot = {
      id: row.scenario_id,
      name: row.name,
      savedAt: row.saved_at,
      cards: row.payload.cards as Card[],
      settings: row.payload.settings as ScenarioSettings,
    };
    if (!isSavedScenario(snapshot)) {
      setCloudMessage("This cloud record is incomplete and cannot be loaded.");
      return;
    }
    loadScenario(snapshot);
    setCloudMessage("Loaded “" + snapshot.name + "” from your cloud account.");
  };
  const removeCloudScenario = async (row: CloudScenarioRow) => {
    if (!cloudSession || !window.confirm("Delete cloud scenario “" + row.name + "”?")) return;
    setCloudBusy(true);
    try {
      const next = await deleteCloudScenario(cloudSession, row.scenario_id);
      setCloudSession(next);
      await reloadCloudScenarios(next);
      setCloudMessage("Deleted “" + row.name + "” from your cloud account.");
    } catch (error) {
      setCloudMessage("Could not delete cloud scenario: " + String((error as Error).message || error));
    } finally { setCloudBusy(false); }
  };
  const toggleCloudHistory = async (row: CloudScenarioRow) => {
    if (!cloudSession) return;
    if (expandedCloudScenario === row.scenario_id) {
      setExpandedCloudScenario(null);
      return;
    }
    setCloudBusy(true);
    try {
      const result = await listCloudScenarioVersions(cloudSession, row.scenario_id);
      setCloudSession(result.session);
      setCloudVersions(current => ({ ...current, [row.scenario_id]: result.rows }));
      setExpandedCloudScenario(row.scenario_id);
    } catch (error) {
      setCloudMessage("Could not load history: " + String((error as Error).message || error));
    } finally { setCloudBusy(false); }
  };
  const save = (c: Card) => {
    const name = c.name.trim();
    const provider = c.provider.trim();
    if (!name || !provider) { setEditMessage("Card name and provider are required."); return; }
    if (!Number.isFinite(c.limit) || c.limit <= 0) { setEditMessage("Credit limit must be greater than £0."); return; }
    if (!Number.isFinite(c.balance) || c.balance < 0) { setEditMessage("Opening balance cannot be negative."); return; }
    const dayFields = [["Statement day", c.statement], ["Direct Debit day", c.dd]] as const;
    for (const [label, day] of dayFields) {
      if (day !== undefined && day !== null && day !== 0 && (!Number.isInteger(day) || day < 1 || day > 31)) {
        setEditMessage(`${label} must be a whole day from 1 to 31, or left blank.`);
        return;
      }
    }
    setEditMessage("");
    const normalized = { ...c, name, provider };
    if (edit?.name) {
      setCards((cs) => cs.map((x) => (x === edit ? normalized : x)));
    } else { setCards((cs) => [...cs, normalized]); track("card_added", { provider: normalized.provider }); }
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
  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
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
      ["Requested repayment / month", formatGBP(payment)],
      ["Starting cash balance", formatGBP(startingCash)],
      ["Monthly cash inflow", formatGBP(cashBudget)],
      ["Cash arrival day", `Day ${paydayDay}`],
      ["Cash-funded simulated repayments", formatGBP(actualRepaymentTotal)],
      ["External cycle payment", "£0"],
      ["One-time adjustment", external ? s.diff : 0],
      [
        "Accounting formula",
        "Opening + spending + fees - repayments - external - adjustments = closing",
      ],
    ]);
    XLSX.writeFile(wb, "credit-card-simulator.xlsx");
  };
  return (
    <div className={darkMode ? "app dark-mode" : "app"} role="application">
      <header>
        <div>
          <span className="eyebrow">JOB ASSIGNMENT TOOL</span>
          <h1>Credit Card Utilisation Management Simulator</h1>
          <p className="subtitle">
            Educational model · every event is simulated
          </p>
        </div>
        <div className="header-actions"><button className="theme-toggle" onClick={()=>setDarkMode(v=>!v)} aria-label="Toggle colour theme">{darkMode ? "☀ Light" : "◐ Dark"}</button><button className="theme-toggle" onClick={()=>{setPresentationMode(v=>!v);track("simulation_started", {mode: "presentation"});}}>{presentationMode ? "Exit presentation" : "Presentation mode"}</button>{clerkPublishableKey && <><AuthButton /><UpgradeButton /></>}<span className="badge">SIMULATION ONLY</span></div>
      </header>
      {!presentationMode && <nav aria-label="Simulator sections">
        {[
          "Dashboard",
          "Cards",
          "Allocation",
          "Monthly Cycle",
          "Calendar",
          "Scenarios",
          "Financial Math Lab",
          "Reports",
          "Cloud Sync",
        ].map((x) => (
          <button
            key={x}
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
                <button className="hero-primary" onClick={() => { setTab("Monthly Cycle"); track("simulation_started", {source: "dashboard"}); }}>Open monthly cycle</button>
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
          {showGuide && <section className="onboarding" aria-label="Quick start guide">
            <div><span className="eyebrow">QUICK START</span><h2>Use the simulator in three steps</h2><p className="muted">Start with the supplied card ledger, model one monthly cycle, then inspect the audit and reconciliation results.</p></div>
            <ol><li><b>Cards:</b> confirm limits, balances and dates.</li><li><b>Monthly Cycle:</b> enter spending, cash and repayment assumptions.</li><li><b>Reports:</b> export the auditable scenario for your assignment.</li></ol>
            <button onClick={() => { setShowGuide(false); window.localStorage.setItem("credit-card-simulator-guide-dismissed", "1"); }}>Dismiss guide</button>
          </section>}
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
          <section className="panel debt-conservation">
            <div className="row">
              <div><span className="eyebrow">BALANCE RECONCILIATION</span><h2>Where the debt can—and cannot—go</h2></div>
              <span className="pill green">SIMULATION MATH</span>
            </div>
            <p className="muted">Moving a balance between cards changes which card owes it. It does not reduce total debt. Only a repayment funded from outside the card balances reduces the total.</p>
            <div className="conservation-stats">
              <div><span>Total card limits</span><b>{formatGBP(s.limit)}</b></div>
              <div><span>50% total-balance ceiling</span><b>{formatGBP(s.target)}</b></div>
              <div><span>Current total balances</span><b>{formatGBP(s.balance)}</b></div>
              <div className={s.diff > 0 ? "needs-payment" : "meets-target"}><span>Cash reduction needed for 50% overall</span><b>{formatGBP(s.diff)}</b></div>
            </div>
            <div className="conservation-transfer">
              <div><span>Simulated balance that can be reallocated</span><b>{formatGBP(transferPlan.transferTotal)}</b></div>
              <div><span>Repayment still needed after reallocation</span><b>{formatGBP(transferPlan.repaymentTotal)}</b></div>
            </div>
            <h3>Current monthly-cycle assumptions</h3>
            <p className="equation-formula">Opening debt + spending + fees − repayments − external adjustment = closing debt</p>
            <div className="conservation-equation" aria-label="Projected debt equation">
              <div><span>Opening balances</span><b>{formatGBP(s.balance)}</b></div>
              <i>+</i><div><span>New spending</span><b>{formatGBP((cardSpendTotal || spend) * months)}</b></div>
              <i>+</i><div><span>Modeled fees</span><b>{formatGBP(status.fees)}</b></div>
              <i>−</i><div><span>Simulated bank-funded repayments</span><b>{formatGBP(actualRepaymentTotal)}</b></div>
              <i>−</i><div><span>One-time external adjustment</span><b>{formatGBP(actualOneTimePayment)}</b></div>
              <i>=</i><div className="equation-total"><span>Projected closing debt</span><b>{formatGBP(status.closing)}</b></div>
            </div>
            <p className="conservation-note"><b>How to read this:</b> the transfer amount above only redistributes balances. If the repayment budget or external adjustment is £0, transfers alone cannot close the {formatGBP(s.diff)} gap shown by the current card balances.</p>
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
                  Monthly simulated cash inflow: <b>{formatGBP(cashBudget)}</b> on day {paydayDay}
                </li>
                <li>
                  One-time payment funded: <b>{formatGBP(actualOneTimePayment)}</b>{" "}
                  {external ? "included" : "not included"}
                </li>
                <li>Target: every card ≤ 50%</li>
              </ul>
            </div>
          </section>
          <section className="panel chart-panel">
            <div className="row"><div><h2>Card utilisation map</h2><p className="muted">Each bar is compared with the 50% target.</p></div><span className="pill green">LIVE MODEL</span></div>
            <Suspense fallback={<div className="chart-loading" role="status">Loading utilisation chart…</div>}><UtilisationChart data={chartData} /></Suspense>
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
          <section className="panel audit-panel">
            <div className="row"><div><span className="eyebrow">DECISION SUPPORT</span><h2>Audit checks and priority actions</h2></div><span className={auditChecks.actions.length === 1 && auditChecks.actions[0].startsWith("No priority") ? "pill green" : "pill red"}>{auditChecks.actions.length === 1 && auditChecks.actions[0].startsWith("No priority") ? "CLEAR" : "REVIEW"}</span></div>
            <p className="muted">These checks are derived from the card inputs and the current cycle assumptions. They are warnings for the simulation, not bank instructions.</p>
            <div className="audit-grid">
              <div className={auditChecks.overLimit.length ? "audit-stat audit-danger" : "audit-stat"}><span>Over-limit cards</span><b>{auditChecks.overLimit.length}</b></div>
              <div className={auditChecks.highUtilisation.length ? "audit-stat audit-warning" : "audit-stat"}><span>At least 80% used</span><b>{auditChecks.highUtilisation.length}</b></div>
              <div className={auditChecks.missingDates.length ? "audit-stat audit-warning" : "audit-stat"}><span>Missing dates</span><b>{auditChecks.missingDates.length}</b></div>
              <div className={auditChecks.fundingShortfall ? "audit-stat audit-danger" : "audit-stat audit-safe"}><span>Funding shortfall</span><b>{formatGBP(auditChecks.fundingShortfall)}</b></div>
              <div className={auditChecks.lowestCash < 0.005 ? "audit-stat audit-warning" : "audit-stat audit-safe"}><span>Lowest modeled cash</span><b>{formatGBP(auditChecks.lowestCash)}</b></div>
            </div>
            <div className="audit-actions"><h3>Recommended next actions</h3><ol>{auditChecks.actions.map(action => <li key={action}>{action}</li>)}</ol></div>
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
            <button onClick={() => { setEdit(empty); setEditMessage(""); }}>Add simulated card</button>
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
                    aria-label={label}
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
                {editMessage && <p className={editMessage.startsWith("Saved with") ? "form-warning" : "form-error"} role={editMessage.startsWith("Saved with") ? "status" : "alert"}>{editMessage}</p>}
                <button onClick={() => save(edit)}>Save card</button>
                <button onClick={() => { setEdit(null); setEditMessage(""); }}>Cancel</button>
              </div>
            </div>
          )}
          {!cards.length ? <div className="empty-state"><h3>No simulated cards yet</h3><p className="muted">Add a card to begin comparing utilisation against the 50% target.</p><button onClick={() => { setEdit(empty); setEditMessage(""); }}>Add your first card</button></div> : <table>
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
          </table>}
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
            <div className="transfer-flow-wrap"><h3>Visual route map</h3><p className="muted">Each arrow shows a simulated balance movement. The exact amounts are listed below.</p><div className="transfer-flow-visual" aria-hidden="true">{transferPlan.transfers.map((route,index)=><div className="transfer-flow-row" key={"flow-"+route.source+route.destination+index}><div className="flow-node"><small>FROM</small><b>{route.source}</b></div><div className="flow-connector"><span>{formatGBP(route.amount)}</span><i>→</i></div><div className="flow-node flow-destination"><small>TO</small><b>{route.destination}</b></div></div>)}</div></div>{transferPlan.transfers.length > 0 ? <table><thead><tr><th>Take from</th><th>Put into</th><th>Amount</th></tr></thead><tbody>{transferPlan.transfers.map((route,index)=><tr key={route.source+route.destination+index}><td>{route.source}</td><td>{route.destination}</td><td><b>{formatGBP(route.amount)}</b></td></tr>)}</tbody></table> : <p className="ok">No card-to-card reallocation is needed.</p>}
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
            At least {formatGBP(s.diff)} must be repaid to bring total balances to the overall 50% target. Transfers only move debt between cards.
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
              Requested repayment / month
              <input
                type="number"
                min="0"
                value={payment}
                onChange={(e) => setPayment(Math.max(0, +e.target.value))}
              />
            </label>
            <label>
              Monthly cash inflow into payment account
              <input
                type="number"
                min="0"
                value={cashBudget}
                onChange={(e) => setCashBudget(Math.max(0, +e.target.value))}
              />
            </label>
            <label>
              Starting cash balance
              <input type="number" min="0" value={startingCash} onChange={e => setStartingCash(Math.max(0, +e.target.value))} />
            </label>
            <label>
              Cash inflow day (1–28)
              <input type="number" min="1" max="28" value={paydayDay} onChange={e => setPaydayDay(Math.min(28, Math.max(1, +e.target.value)))} />
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
          {actualRepaymentTotal < payment * months && <p className="result danger"><b>Funding shortfall:</b> the plan requested {formatGBP(payment * months)} in Direct Debit repayments, but only {formatGBP(actualRepaymentTotal)} was funded on the simulated payment dates. Unfunded amounts remain debt.</p>}
          <p className="muted cash-budget-note">Starting cash and monthly cash inflows are tracked by date. Unused cash rolls forward. A cash inflow on the same day as a Direct Debit is applied after that debit; weekends and bank holidays are not adjusted.</p>
          <div className="monthly-planner-toolbar"><div><b>Monthly planner view</b><p className="muted">Inspect one simulated month at a time.</p></div><label>View month<select value={selectedCycleMonth} onChange={e=>setSelectedCycleMonth(Math.max(1,Math.min(months,+e.target.value)))}>{Array.from({length:Math.max(1,months)},(_,i)=><option key={i+1} value={i+1}>Month {i+1}</option>)}</select></label><div className="planner-stat"><span>Events</span><b>{selectedMonthEvents.length}</b></div><div className="planner-stat"><span>Closing cash</span><b>{formatGBP(selectedMonthCashBalance)}</b></div><div className="planner-stat"><span>Amount moved</span><b>{formatGBP(selectedMonthEvents.reduce((sum,e)=>sum+e.amount,0))}</b></div><button className="planner-export" onClick={exportSelectedMonth}>Export month CSV</button></div>
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
            Include one-time {formatGBP(s.diff)} payment to reach 50% overall
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
          <table><thead><tr><th>Day</th><th>Event</th><th>Card</th><th>Funding note</th></tr></thead><tbody>{cardDateEvents.map(e=><tr><td>{e.date}</td><td>{e.type}</td><td>{e.card}</td><td className={e.type === "Direct Debit" && e.day === 1 ? "warning" : ""}>{e.type === "Direct Debit" && e.day === 1 ? "Needs funding before the 1st" : e.type === "Direct Debit" ? "Funding required before this date" : e.type === "Cash inflow" ? "Added to simulated account" : "Statement generated"}</td></tr>)}</tbody></table>
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
          <Suspense fallback={<div className="chart-loading" role="status">Loading scenario chart…</div>}><ScenarioChart data={scenarioData} /></Suspense>
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
                  s.diff ? formatGBP(s.diff) + " repayment required" : "£0",
                  "Requires repayment",
                ],
                [
                  "Every card ≤50% without transfers",
                  a.reduce((sum, item) => sum + item.result, 0),
                  a.reduce((sum, item) => sum + item.reduce, 0),
                  "Repay each over-target card",
                ],
                ["30% overall", s.limit * 0.3, "Variable", "Lower debt"],
                ["25% overall", s.limit * 0.25, "Variable", "Lower debt"],
                [
                  "No external payment",
                  s.balance,
                  0,
                  "Transfers conserve debt",
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
      {tab === "Cloud Sync" && (
        <section className="panel cloud-sync">
          <div className="row"><div><span className="eyebrow">SUPABASE CLOUD STORAGE</span><h2>Private scenario backup</h2></div><span className={cloudSession ? "pill green" : "pill"}>{cloudSession ? "CONNECTED" : "SIGN IN REQUIRED"}</span></div>
          <p className="muted">Sign in to save assignment scenarios to your Supabase account and open them on another device. Each account can access only its own scenarios. Do not enter real card numbers or security codes.</p>
          {cloudSession ? <>
            <div className="cloud-account"><span>Signed in as</span><b>{cloudSession.user.email || cloudSession.user.id}</b><button onClick={handleCloudSignOut} disabled={cloudBusy}>Sign out</button></div>
            <div className="cloud-save-row"><button onClick={saveCurrentToCloud} disabled={cloudBusy}>Save current scenario to cloud</button><button onClick={()=>void reloadCloudScenarios(cloudSession).then(()=>setCloudMessage("Cloud scenarios refreshed.")).catch(error=>setCloudMessage("Refresh failed: "+String(error.message||error)))} disabled={cloudBusy}>Refresh list</button></div>
            {cloudRows.length ? <div className="saved-scenario-list">{cloudRows.map(row=><article className="saved-scenario cloud-scenario" key={row.scenario_id}><div><b>{row.name}</b><small>Saved {new Date(row.saved_at).toLocaleString()} · {(row.payload.cards || []).length} cards</small></div><div className="saved-scenario-actions"><button onClick={()=>loadCloudScenario(row)}>Load</button><button onClick={()=>void toggleCloudHistory(row)} disabled={cloudBusy}>{expandedCloudScenario === row.scenario_id ? "Hide history" : "History"}</button><button onClick={()=>void removeCloudScenario(row)} disabled={cloudBusy}>Delete</button></div>{expandedCloudScenario === row.scenario_id && <div className="cloud-history">{(cloudVersions[row.scenario_id] || []).length ? cloudVersions[row.scenario_id].map(version=><div className="cloud-history-row" key={version.id}><span>Version saved {new Date(version.created_at).toLocaleString()}</span><button onClick={()=>loadCloudScenario(version)}>Restore</button></div>) : <small>No earlier versions yet.</small>}</div>}</article>)}</div> : <p className="muted">No cloud scenarios yet. Save the current setup to get started.</p>}
          </> : <>
            <div className="controls cloud-auth"><label>Email<input type="email" autoComplete="email" value={cloudEmail} onChange={e=>setCloudEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" autoComplete="current-password" value={cloudPassword} onChange={e=>setCloudPassword(e.target.value)} placeholder="At least 8 characters"/></label></div>
            <div className="actions"><button onClick={()=>void handleCloudSignIn()} disabled={cloudBusy}>Sign in</button><button onClick={()=>void handleCloudSignUp()} disabled={cloudBusy}>Create account</button></div>
            <p className="muted">Supabase may email a confirmation link before the first sign-in. Use the same email account you registered with in Supabase Auth.</p>
          </>}
          {cloudMessage && <p className="scenario-message" role="status">{cloudMessage}</p>}
          <p className="cloud-privacy-note">Cloud access uses a public publishable key protected by database row-level security. Passwords are handled by Supabase Auth and are not saved by this simulator.</p>
        </section>
      )}
      {tab === "Financial Math Lab" && (
        <Suspense fallback={<section className="panel boot-panel" role="status">Loading the financial mathematics lab…</section>}><FinancialMathLab /></Suspense>
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
                  buildReport(cards, status, events, external ? s.diff : 0),
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
              onClick={async () => {
                const { jsPDF } = await import("jspdf");
                const doc = new jsPDF();
                doc.setFontSize(16);
                doc.text(
                  "Credit Card Utilisation Management Simulator",
                  14,
                  18,
                );
                doc.setFontSize(9);
                doc.text(
                  doc.splitTextToSize(buildReport(cards, status, events, external ? s.diff : 0), 180),
                  14,
                  28,
                );
                doc.save("simulation-report.pdf");
              }}
            >
              Download PDF
            </button>
            <button onClick={() => window.print()}>Print</button>
          </div>
          <section className="scenario-manager">
            <div className="row"><div><h3>Saved scenarios</h3><p className="muted">Stored only in this browser. They do not sync across devices.</p></div><span className="pill green">{savedScenarios.length} SAVED</span></div>
            <div className="scenario-save-row"><label>Scenario name<input value={scenarioName} onChange={e=>setScenarioName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveScenario();}} placeholder="e.g. Assignment baseline"/></label><button onClick={saveScenario}>Save current scenario</button></div>
            <div className="actions"><button onClick={exportScenarioBackup} disabled={!savedScenarios.length}>Export backup JSON</button><button onClick={()=>importInputRef.current?.click()}>Import backup JSON</button><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";void importScenarioBackup(file);}}/></div>
            {scenarioMessage && <p className="scenario-message" role="status">{scenarioMessage}</p>}
            {savedScenarios.length ? <div className="saved-scenario-list">{savedScenarios.map(snapshot=><article className="saved-scenario" key={snapshot.id}><div><b>{snapshot.name}</b><small>Saved {new Date(snapshot.savedAt).toLocaleString()} · {snapshot.cards.length} cards · {snapshot.settings.months} month(s)</small></div><div className="saved-scenario-actions"><button onClick={()=>loadScenario(snapshot)}>Load</button><button onClick={()=>renameScenario(snapshot)}>Rename</button><button onClick={()=>deleteScenario(snapshot)}>Delete</button></div></article>)}</div> : <p className="muted">No saved scenarios yet. Enter a name and save the current setup.</p>}
          </section>
          <pre>{buildReport(cards, status, events, external ? s.diff : 0)}</pre>
        </section>
      )}
      {selectedCard && <div className="drawer-backdrop" onClick={()=>setSelectedCard(null)}><aside className="detail-drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={()=>setSelectedCard(null)} aria-label="Close card details">×</button><span className="eyebrow">CARD DETAIL</span><h2>{selectedCard.name}</h2><p className="muted">{selectedCard.provider}</p><div className="drawer-grid"><div><span>Balance</span><b>{formatGBP(selectedCard.balance)}</b></div><div><span>Credit limit</span><b>{formatGBP(selectedCard.limit)}</b></div><div><span>Utilisation</span><b>{(selectedCard.balance/selectedCard.limit*100).toFixed(1)}%</b></div><div><span>Available</span><b>{formatGBP(selectedCard.limit-selectedCard.balance)}</b></div><div><span>Statement</span><b>{selectedCard.statement ?? "Missing"}</b></div><div><span>Direct Debit</span><b>{selectedCard.dd ?? "Missing"}</b></div></div><div className="callout">50% target balance: <b>{formatGBP(selectedCard.limit*.5)}</b><br/>Amount above target: <b>{formatGBP(Math.max(0,selectedCard.balance-selectedCard.limit*.5))}</b></div></aside></div>}
      <footer>
        Prototype v0.3 · Simulation Only · No banking integrations
      </footer>
    </div>
  );
}
const app = <AppErrorBoundary><App /></AppErrorBoundary>;
createRoot(document.getElementById("root")!).render(clerkPublishableKey ? <ClerkProvider publishableKey={clerkPublishableKey}><ClerkSessionBridge />{app}</ClerkProvider> : app);

