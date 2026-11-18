export type Card = {
  name: string;
  provider: string;
  limit: number;
  balance: number;
  statement?: number;
  dd?: number;
  apr?: number;
  fee?: number;
  notes?: string;
};
export type Event = {
  date: string;
  type: string;
  source: string;
  destination: string;
  amount: number;
  reason: string;
  before: number;
  after: number;
  utilBefore: number;
  utilAfter: number;
};
export const initialCards: Card[] = [
  ["Capital One A", "Capital One", 2250, 1100, 28, 20],
  ["Capital One B", "Capital One", 1000, 645, 22, 15],
  ["Barclays Rewards", "Barclays", 300, 35, 5, 30],
  ["Santander A", "Santander", 3300, 2006, undefined, 1],
  ["Santander B", "Santander", 6800, 4900, undefined, 23],
  ["Aqua A", "Aqua", 3450, 0, 7, 25],
  ["M&S Bank", "M&S", 5400, 4415, 14, 10],
  ["NatWest", "NatWest", 4200, 3220, 3, 28],
  ["Aqua B", "Aqua", 2700, 2100, 4, 23],
  ["Amex Gold", "Amex", 6400, 2400, 6, 30],
].map((x) => ({
  name: x[0] as string,
  provider: x[1] as string,
  limit: x[2] as number,
  balance: x[3] as number,
  statement: x[4] as number | undefined,
  dd: x[5] as number | undefined,
}));
export const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
export function summary(cards: Card[]) {
  const limit = cards.reduce((a, c) => a + c.limit, 0),
    balance = cards.reduce((a, c) => a + c.balance, 0),
    target = limit * 0.5;
  return {
    limit,
    balance,
    target,
    available: limit - balance,
    util: +((balance / limit) * 100).toFixed(2),
    diff: Math.max(0, balance - target),
    above: cards.filter((c) => c.balance > c.limit * 0.5).length,
    below: cards.filter((c) => c.balance <= c.limit * 0.5).length,
  };
}
export function allocation(cards: Card[]) {
  return cards.map((c) => {
    const target = c.limit * 0.5,
      reduce = Math.max(0, c.balance - target);
    return {
      name: c.name,
      current: c.balance,
      target,
      reduce,
      result: c.balance - reduce,
      util: ((c.balance - reduce) / c.limit) * 100,
    };
  });
}
export function planTransfersToFiftyPercent(cards: Card[]) {
  const targets = cards.map(card => ({
    name: card.name,
    balance: card.balance,
    target: card.limit * 0.5,
    excess: Math.max(0, card.balance - card.limit * 0.5),
    room: Math.max(0, card.limit * 0.5 - card.balance),
  }));
  const donors = targets.filter(card => card.excess > 0).map(card => ({ ...card }));
  const receivers = targets.filter(card => card.room > 0).map(card => ({ ...card }));
  const transfers: Array<{ source: string; destination: string; amount: number }> = [];
  let i = 0, j = 0;
  while (i < donors.length && j < receivers.length) {
    const amount = Math.min(donors[i].excess, receivers[j].room);
    if (amount > 0) {
      transfers.push({ source: donors[i].name, destination: receivers[j].name, amount });
      donors[i].excess -= amount;
      receivers[j].room -= amount;
    }
    if (donors[i].excess <= 0.005) i++;
    if (receivers[j].room <= 0.005) j++;
  }
  const repayments = donors.filter(card => card.excess > 0.005).map(card => ({ card: card.name, amount: card.excess }));
  const transferTotal = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  const repaymentTotal = repayments.reduce((sum, repayment) => sum + repayment.amount, 0);
  return {
    transfers,
    repayments,
    transferTotal,
    repaymentTotal,
    totalExcess: targets.reduce((sum, card) => sum + card.excess, 0),
    availableRoom: targets.reduce((sum, card) => sum + card.room, 0),
  };
}
export function totalFees(spend: number, fee: number, months: number) {
  return (spend * months * fee) / 100;
}
export function feasibility(
  cards: Card[],
  o: {
    external: number;
    spend: number;
    payment: number;
    fee: number;
    months: number;
  },
) {
  const open = summary(cards).balance,
    fees = totalFees(o.spend, o.fee, o.months),
    closing =
      open + o.spend * o.months + fees - o.payment * o.months - o.external;
  let label = "FEASIBLE",
    ok = true;
  if (closing > open && o.payment === 0) {
    label = "REQUIRES LOWER SPENDING";
    ok = false;
  } else if (closing > summary(cards).target && o.external === 0) {
    label = "FEASIBLE ONLY WITH EXTERNAL PAYMENT";
    ok = false;
  } else if (closing > summary(cards).target) {
    label = "IMPOSSIBLE UNDER CURRENT ASSUMPTIONS";
    ok = false;
  }
  return {
    label,
    ok,
    closing,
    fees,
    detail: `Opening ${formatGBP(open)} + spending ${formatGBP(o.spend * o.months)} + fees ${formatGBP(fees)} − repayments ${formatGBP(o.payment * o.months)} − adjustment ${formatGBP(o.external)} = ${formatGBP(closing)}.`,
  };
}
export function simulateCycle(
  cards: Card[],
  o: {
    start: string;
    months: number;
    spend: number;
    payment: number;
    external: number;
    fee: number;
  },
) {
  // Card-level ledger: every month starts from the previous month's closing balances.
  // Transfers and repayments are recorded as ledger events; only repayments/adjustments
  // reduce total debt. With no external cash, cycling cannot reduce total debt.
  const events: Event[] = [];
  const state = new Map(cards.map((c) => [c.name, { ...c }]));
  const limit = summary(cards).limit;
  let total = Array.from(state.values()).reduce((sum, c) => sum + c.balance, 0);

  const emit = (
    date: string,
    type: string,
    source: string,
    destination: string,
    amount: number,
    reason: string,
    cardName: string | undefined,
    delta: number,
    totalDelta: number = delta,
  ) => {
    const before = total;
    const card = cardName ? state.get(cardName) : undefined;
    const cardBefore = card?.balance;
    if (card) card.balance = Math.max(0, card.balance + delta);
    total = Math.max(0, total + totalDelta);
    events.push({
      date,
      type,
      source,
      destination,
      amount: Math.max(0, amount),
      reason,
      before,
      after: total,
      utilBefore: (before / limit) * 100,
      utilAfter: (total / limit) * 100,
      ...(card
        ? {
            cardBefore,
            cardAfter: card.balance,
            cardUtilBefore: ((cardBefore || 0) / card.limit) * 100,
            cardUtilAfter: (card.balance / card.limit) * 100,
          }
        : {}),
    } as Event);
  };

  for (let month = 0; month < o.months; month++) {
    const base = new Date(`${o.start}T00:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + month);
    const year = base.getUTCFullYear();
    const monthIndex = base.getUTCMonth();
    const iso = (day: number) =>
      new Date(Date.UTC(year, monthIndex, Math.min(day, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate())))
        .toISOString()
        .slice(0, 10);

    const scheduled: Array<{ date: string; kind: string; card?: Card; }> = [];
    for (const card of state.values()) {
      if (card.statement) scheduled.push({ date: iso(card.statement), kind: "statement", card });
      if (card.dd) scheduled.push({ date: iso(card.dd), kind: "dd", card });
    }
    scheduled.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "statement" ? -1 : 1));
    let paymentRemaining = Math.max(0, o.payment);

    // Spend is allocated to the cards with the most 50% headroom first.
    // This makes the 50% rule visible and flags any spend that cannot fit.
    if (o.spend > 0) {
      let remaining = o.spend;
      const ordered = Array.from(state.values()).sort(
        (a, b) => (b.limit * 0.5 - b.balance) - (a.limit * 0.5 - a.balance),
      );
      for (const card of ordered) {
        if (remaining <= 0) break;
        const room = Math.max(0, card.limit * 0.5 - card.balance);
        const amount = Math.min(remaining, room);
        if (amount > 0) {
          emit(iso(1), "New spending", "User", card.name, amount, "Balanced simulated spending", card.name, amount);
          remaining -= amount;
        }
      }
      if (remaining > 0) {
        const overTargetOrder = Array.from(state.values()).sort(
          (a, b) => (b.limit - b.balance) - (a.limit - a.balance),
        );
        for (const card of overTargetOrder) {
          if (remaining <= 0) break;
          const available = Math.max(0, card.limit - card.balance);
          const amount = Math.min(remaining, available);
          if (amount > 0) {
            emit(iso(1), "New spending", "User", card.name, amount, "Spend beyond 50% headroom; flagged", card.name, amount);
            remaining -= amount;
          }
        }
      }
      if (remaining > 0) {
        emit(iso(1), "Rejected spending", "User", "Cards", remaining, "No available credit; rejected", undefined, 0);
      }
    }

    for (const item of scheduled) {
      if (item.kind === "statement") {
        emit(item.date, "Statement generation", item.card!.name, "Ledger", 0, "Simulated card statement", undefined, 0);
      } else if (o.payment > 0) {
        const balanceTotal = Array.from(state.values()).reduce((sum, c) => sum + c.balance, 0);
        const card = item.card!;
        const amount = Math.min(card.balance, paymentRemaining, balanceTotal > 0 ? paymentRemaining * (card.balance / balanceTotal) : 0);
        if (amount > 0) {
          emit(item.date, "Direct Debit", "Simulated bank account", card.name, amount, "Proportional simulated repayment", card.name, -amount);
          paymentRemaining -= amount;
        }
      }
    }

    if (o.fee > 0 && o.spend > 0) {
      const fee = (o.spend * o.fee) / 100;
      emit(iso(1), "Fee", "Transfer facility", "Cards", fee, "Transfer fee", undefined, fee);
    }
    if (month === 0 && o.external > 0) {
      const balances = Array.from(state.values());
      const balanceTotal = balances.reduce((sum, card) => sum + card.balance, 0);
      const appliedAdjustment = Math.min(o.external, balanceTotal);
      emit(iso(1), "Accounting adjustment", "External payment / loss", "Ledger", appliedAdjustment, "One-time accounting adjustment", undefined, -appliedAdjustment);
      let adjustmentRemaining = appliedAdjustment;
      balances.forEach((card, index) => {
        if (adjustmentRemaining <= 0 || balanceTotal <= 0) return;
        const amount = index === balances.length - 1
          ? adjustmentRemaining
          : Math.min(card.balance, appliedAdjustment * (card.balance / balanceTotal));
        if (amount > 0) {
          emit(iso(1), "Adjustment allocation", "Accounting adjustment", card.name, amount, "Card-level allocation of one-time adjustment", card.name, -amount, 0);
          adjustmentRemaining -= amount;
        }
      });
    }
    emit(iso(new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()), "End-of-month", "Ledger", "Ledger", 0, "Roll-forward checkpoint", undefined, 0);
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportCSV(cards: Card[]) {
  const rows = [
    "Card,Provider,Limit,Balance,Statement day,Direct Debit day,APR,Utilisation",
  ];
  cards.forEach((c) =>
    rows.push(
      [
        c.name,
        c.provider,
        c.limit,
        c.balance,
        c.statement ?? "",
        c.dd ?? "",
        c.apr ?? "",
        ((c.balance / c.limit) * 100).toFixed(2) + "%",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    ),
  );
  downloadBlob(rows.join("\n"), "card-inputs.csv", "text/csv");
}
export function downloadBlob(
  content: BlobPart,
  filename: string,
  type: string,
) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
export function buildReport(cards: Card[], status: any, events: Event[] = []) {
  const s = summary(cards);
  return `CREDIT CARD UTILISATION MANAGEMENT SIMULATOR\nSIMULATION ONLY\n\nEXECUTIVE SUMMARY\nTotal limit: ${formatGBP(s.limit)}\nTotal balance: ${formatGBP(s.balance)}\nUtilisation: ${s.util}%\n50% target: ${formatGBP(s.target)}\nDifference: ${formatGBP(s.diff)}\nCards above 50%: ${s.above}\n\nFEASIBILITY\n${status.label}\n${status.detail}\n\nASSUMPTIONS\nTransfer fee default: 0%\nExternal payment during recurring cycle: £0\nOne-time accounting adjustment: £1,821, shown separately\nMissing dates are never guessed.\n\nACCOUNTING RECONCILIATION\nOpening debt + new spending + fees - simulated repayments - external payments - approved adjustments = closing debt.\n\nEVENTS\n${events.map((e) => `${e.date} | ${e.type} | ${e.amount} | ${e.reason}`).join("\n")}`;
}

