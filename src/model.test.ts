import { describe, it, expect } from "vitest";
import {
  initialCards,
  summary,
  allocation,
  feasibility,
  simulateCycle,
  totalFees,
} from "./model";
describe("auditable financial model", () => {
  it("calculates total limit", () =>
    expect(summary(initialCards).limit).toBe(35800));
  it("calculates total balance", () =>
    expect(summary(initialCards).balance).toBe(19721));
  it("calculates utilisation", () =>
    expect(summary(initialCards).util).toBe(55.09));
  it("calculates 50% target", () =>
    expect(summary(initialCards).target).toBe(17900));
  it("calculates £1821 difference", () =>
    expect(summary(initialCards).diff).toBe(1821));
  it("allocates each card to 50%", () =>
    expect(allocation(initialCards).every((x) => x.result <= x.target)).toBe(
      true,
    ));
  it("conserves transfer debt", () =>
    expect(
      feasibility(initialCards, {
        external: 0,
        spend: 0,
        payment: 0,
        fee: 0,
        months: 1,
      }).closing,
    ).toBe(19721));
  it("calculates fees", () => expect(totalFees(100, 2, 3)).toBe(6));
  it("adds fees to debt", () =>
    expect(
      feasibility(initialCards, {
        external: 0,
        spend: 100,
        payment: 0,
        fee: 2,
        months: 1,
      }).closing,
    ).toBe(19823));
  it("rolls monthly spending and payments", () =>
    expect(
      feasibility(initialCards, {
        external: 0,
        spend: 100,
        payment: 50,
        fee: 0,
        months: 2,
      }).closing,
    ).toBe(19821));
  it("orders ledger events chronologically", () => {
    const e = simulateCycle(initialCards, {
      start: "2026-01-01",
      months: 2,
      spend: 10,
      payment: 5,
      external: 0,
      fee: 0,
    });
    expect(e[0].date).toBe("2026-01-01");
    expect(e.at(-1)?.date).toBe("2026-02-28");
  });
  it("detects impossible growth without payment", () =>
    expect(
      feasibility(initialCards, {
        external: 0,
        spend: 100,
        payment: 0,
        fee: 0,
        months: 1,
      }).ok,
    ).toBe(false));
  it("applies one-time adjustment once", () =>
    expect(
      simulateCycle(initialCards, {
        start: "2026-01-01",
        months: 2,
        spend: 0,
        payment: 0,
        external: 1821,
        fee: 0,
      }).filter((e) => e.type === "Accounting adjustment"),
    ).toHaveLength(1));
  it("never produces negative balance", () =>
    expect(
      simulateCycle(initialCards, {
        start: "2026-01-01",
        months: 1,
        spend: 0,
        payment: 999999,
        external: 0,
        fee: 0,
      }).every((e) => e.after >= 0),
    ).toBe(true));
  it("flags missing date cards", () =>
    expect(initialCards.filter((c) => !c.statement || !c.dd).length).toBe(2));
});

