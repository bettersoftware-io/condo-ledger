import { cents } from "#/entities/cents.ts";

import { describeInstallmentsPortContract } from "../ports/__contracts__/InstallmentsPortContract.ts";
import { createScheduleSeed } from "../testing/createScheduleSeed.ts";
import { createInstallmentsSimulator } from "./installmentsSimulator.ts";

describeInstallmentsPortContract("installments simulator", () => {
  return {
    port: createInstallmentsSimulator(createScheduleSeed()),
    periodId: "p1",
    unknownPeriodId: "p99",
    emptyPeriodId: "p3",
    draft: {
      installments: [
        { name: "Installment 1", dueDate: "2015-03-31", percentage: 5000 },
        { name: "Installment 2", dueDate: "2015-09-30", percentage: 5000 },
      ],
      wholeEuros: false,
    },
    // r31 owes 50.00 from before, on item 1; r33's 20.00 credit comes off its item 1; r33's 99.99 halves to 50.00 each.
    plannedAmounts: new Map([
      ["r31", [cents(35000), cents(30000)]],
      ["r32", [cents(15000), cents(15000)]],
      ["r33", [cents(3000), cents(5000)]],
    ]),
    refusedDraft: {
      installments: [
        { name: "Installment 1", dueDate: "2015-03-31", percentage: 5000 },
        { name: "Installment 2", dueDate: "2015-09-30", percentage: 4000 },
      ],
      wholeEuros: false,
    },
    refusedReason: "percentages-not-100",
    // The seed's collection e10 pays 100.00 of ii1.
    paidInstallmentId: "in1",
    paidItemId: "ii1",
    unpaidInstallmentId: "in2",
    unpaidItemId: "ii3",
    teardown: (): void => {},
  };
});
