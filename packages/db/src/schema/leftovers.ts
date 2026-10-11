import {
  pgTable,
  integer,
  varchar,
  char,
  text,
  boolean,
  timestamp,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";
import { eventPriority, licenseType, ticketStatus } from "../enums.ts";
import { studio, accessAccount, masterData } from "./masterData.ts";
import { country } from "./reference.ts";

// ---------------------------------------------------------------------------
// calendarEvent
// ---------------------------------------------------------------------------
export const calendarEvent = pgTable("calendar_event", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => {return studio.id}),
  layerId: integer("layer_id").references(() => {return calendarLayer.id}),
  date: timestamp("date", { withTimezone: true }),
  ignoreTime: boolean("ignore_time").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  priority: eventPriority("priority"),
  status: varchar("status", { length: 31 }),
  data: text("data"),
  dataType: varchar("data_type", { length: 31 }),
  dataKey: text("data_key"),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// calendarLayer
// ---------------------------------------------------------------------------
export const calendarLayer = pgTable("calendar_layer", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => {return studio.id}),
  name: varchar("name", { length: 31 }).notNull(),
  description: text("description"),
  color: integer("color"),
  order: integer("order"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// license
// ---------------------------------------------------------------------------
export const license = pgTable("license", {
  id: integer("id").primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  type: licenseType("type").notNull(),
  code: varchar("code", { length: 255 }),
  controlCode: varchar("control_code", { length: 255 }),
  startDate: date("start_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// propertyManager
// ---------------------------------------------------------------------------
export const propertyManager = pgTable("property_manager", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id")
    .notNull()
    .references(() => {return studio.id}),
  masterDataId: integer("master_data_id")
    .notNull()
    .references(() => {return masterData.id}),
  signature: text("signature"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// propertyManagersAssociation
// ---------------------------------------------------------------------------
export const propertyManagersAssociation = pgTable(
  "property_managers_association",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    countryIso31661A2: char("country_iso3166_1_a2", { length: 2 })
      .notNull()
      .references(() => {return country.iso31661Alpha2}),
    name: varchar("name", { length: 63 }).notNull(),
    registerNumberLabel: varchar("register_number_label", {
      length: 31,
    }).notNull(),
    notes: text("notes"),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
);

// ---------------------------------------------------------------------------
// propertyManagersAssociationCode
// ---------------------------------------------------------------------------
export const propertyManagersAssociationCode = pgTable(
  "property_managers_association_code",
  {
    propertyManagerId: integer("property_manager_id")
      .notNull()
      .references(() => {return propertyManager.id}),
    propertyManagersAssociationId: integer("property_managers_association_id")
      .notNull()
      .references(() => {return propertyManagersAssociation.id}),
    code: varchar("code", { length: 127 }).notNull(),
    created: timestamp("created", { withTimezone: true }),
    updated: timestamp("updated", { withTimezone: true }),
  },
  (t) => {return {
    pk: primaryKey({
      columns: [t.propertyManagerId, t.propertyManagersAssociationId],
    }),
  }},
);

// ---------------------------------------------------------------------------
// ticket
// ---------------------------------------------------------------------------
export const ticket = pgTable("ticket", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => {return studio.id}),
  ticketTopicId: integer("ticket_topic_id").references(() => {return ticketTopic.id}),
  contextId: integer("context_id"),
  contextType: varchar("context_type", { length: 31 }),
  openedByUsername: varchar("opened_by_username", { length: 63 }).references(
    () => {return accessAccount.username},
  ),
  openedByNominativeCache: varchar("opened_by_nominative_cache", {
    length: 127,
  }),
  status: ticketStatus("status").notNull(),
  priority: eventPriority("priority"),
  subject: varchar("subject", { length: 255 }).notNull(),
  url: varchar("url", { length: 255 }),
  notes: text("notes"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// ticketMessage
// ---------------------------------------------------------------------------
export const ticketMessage = pgTable("ticket_message", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => {return ticket.id}),
  authorUsername: varchar("author_username", { length: 63 }).references(
    () => {return accessAccount.username},
  ),
  authorNominativeCache: varchar("author_nominative_cache", { length: 127 }),
  message: text("message"),
  readByTicketOpener: boolean("read_by_ticket_opener").notNull(),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// ticketTopic
// ---------------------------------------------------------------------------
export const ticketTopic = pgTable("ticket_topic", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  studioId: integer("studio_id").references(() => {return studio.id}),
  name: varchar("name", { length: 63 }).notNull(),
  code: varchar("code", { length: 15 }),
  order: integer("order"),
  created: timestamp("created", { withTimezone: true }),
  updated: timestamp("updated", { withTimezone: true }),
});
