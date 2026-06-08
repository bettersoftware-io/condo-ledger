import {
  pgTable,
  integer,
  varchar,
  text,
  timestamp,
  numeric,
  primaryKey,
} from "drizzle-orm/pg-core";
import { studio } from "./masterData.ts";
import { accountingPeriod } from "./installment.ts";
import { unit, unitGroup } from "./condominium.ts";
import { consumptionMeter } from "./accounting.ts";

// ---------------------------------------------------------------------------
// distributionTable
// ---------------------------------------------------------------------------
export const distributionTable = pgTable("distribution_table", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => studio.id),
  accountingPeriodId: integer("accounting_period_id")
    .notNull()
    .references(() => accountingPeriod.id),
  name: varchar("name", { length: 63 }).notNull(),
  order: integer("order"),
  restrictionUnitGroupId: integer("restriction_unit_group_id").references(
    () => unitGroup.id,
  ),
  consumptionMeterId: integer("consumption_meter_id").references(
    () => consumptionMeter.id,
  ),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// distributionTableItem
// ---------------------------------------------------------------------------
export const distributionTableItem = pgTable(
  "distribution_table_item",
  {
    distributionTableId: integer("distribution_table_id")
      .notNull()
      .references(() => distributionTable.id),
    unitId: integer("unit_id")
      .notNull()
      .references(() => unit.id),
    studioId: integer("studio_id")
      .notNull()
      .references(() => studio.id),
    coefficient: numeric("coefficient", {
      precision: 20,
      scale: 6,
    }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.distributionTableId, t.unitId] }),
  }),
);
