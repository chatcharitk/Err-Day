import test from "node:test";
import assert from "node:assert/strict";
import {
  expenseTotals,
  workMinutes,
  overtimeMinutes,
  validDay,
  csvText,
} from "../src/lib/finance-math";
const items = [
  { description: "แชมพู", quantity: 3, unitPrice: 12000 },
  { description: "สีผม", quantity: 2, unitPrice: 25000 },
];
test("expense totals derive from quantities and integer satang", () => {
  const t = expenseTotals({ items, vatMode: "NONE" });
  assert.equal(t.totalAmount, 86000);
  assert.equal(t.items[0].totalPrice, 36000);
});
test("exclusive VAT, discount and withholding remain distinct", () => {
  const t = expenseTotals({
    items,
    vatMode: "EXCLUSIVE",
    discountAmount: 6000,
    withholdingAmount: 2400,
  });
  assert.equal(t.vatAmount, 5600);
  assert.equal(t.totalAmount, 85600);
  assert.equal(t.netAmount, 83200);
});
test("inclusive VAT is extracted, never added again", () => {
  const t = expenseTotals({
    items: [],
    totalAmount: 10700,
    vatMode: "INCLUSIVE",
  });
  assert.equal(t.vatAmount, 700);
  assert.equal(t.totalAmount, 10700);
});
test("round line totals before summing and ignore client line total", () => {
  assert.equal(
    expenseTotals({
      items: [
        {
          description: "fraction",
          quantity: 1.5,
          unitPrice: 101,
          totalPrice: 999,
        },
      ],
      vatMode: "NONE",
    }).totalAmount,
    152,
  );
});
test("legacy amounts stay unchanged until an explicit recalculation", () => {
  const t = expenseTotals({
    items,
    vatMode: "LEGACY",
    totalAmount: 90000,
    vatAmount: 5000,
  });
  assert.equal(t.totalAmount, 90000);
  assert.equal(t.vatAmount, 5000);
});
test("invalid money and empty descriptions are rejected", () => {
  for (const unitPrice of [-1, Infinity, NaN, 0.1])
    assert.throws(() =>
      expenseTotals({
        items: [{ description: "x", quantity: 1, unitPrice }],
        vatMode: "NONE",
      }),
    );
  assert.throws(() =>
    expenseTotals({
      items: [{ description: "", quantity: 1, unitPrice: 1 }],
      vatMode: "NONE",
    }),
  );
  assert.throws(() =>
    expenseTotals({ items, vatMode: "NONE", withholdingAmount: 90000 }),
  );
});
test("9h default and 10h exception", () => {
  assert.equal(overtimeMinutes(540, 540), 0);
  assert.equal(overtimeMinutes(600, 540), 60);
  assert.equal(overtimeMinutes(600, 600), 0);
  assert.equal(overtimeMinutes(630, 600), 30);
});
test("work time supports overnight and explicit excluded breaks", () => {
  assert.equal(
    workMinutes("2026-09-10T20:00:00+07:00", "2026-09-11T06:30:00+07:00", 30),
    600,
  );
  assert.throws(() =>
    workMinutes("2026-09-10T10:00:00+07:00", "2026-09-10T09:00:00+07:00"),
  );
  assert.throws(() =>
    workMinutes("2026-09-10T10:00:00+07:00", "2026-09-12T10:00:00+07:00"),
  );
});
test("strict dates and spreadsheet formula protection", () => {
  assert.equal(validDay("2026-02-30"), false);
  assert.equal(validDay("2024-02-29"), true);
  assert.ok(
    csvText([[" =HYPERLINK(1)", "normal", 'a"b']]).includes("' =HYPERLINK(1)"),
  );
});
