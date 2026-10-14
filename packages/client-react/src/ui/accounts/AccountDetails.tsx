import type { ReactElement } from "react";

import { useViewModel } from "@cl/react-bindings";

import { Fieldset } from "../Fieldset.tsx";
import { formatCents } from "../format.ts";
import { Row } from "../Row.tsx";
import { Scheda } from "../Scheda.tsx";

import "./AccountDetails.css";

/**
 * The selected account's sheet (README "Account Details", with the
 * prototype's values): its path, type and nature, the attributes a cost
 * account inherits, its balances and its system id. What the accounts do not
 * carry yet reads as inherited from the parent. Empty before a period is
 * chosen.
 */
export function AccountDetails(): ReactElement {
  const { useAccountDetails } = useViewModel();
  const details = useAccountDetails();

  if (details === null) {
    return <Scheda wide>{null}</Scheda>;
  }

  return (
    <Scheda wide>
      <Row label="Account" tone="accent">
        {details.path}
      </Row>
      <Row label="Account type">{details.typeLabel}</Row>
      <Row label="Account nature">{details.natureLabel}</Row>
      <Row label="Default contra-account" tone="muted">
        {FROM_PARENT}
      </Row>
      <Row label="Period restriction" tone="muted">
        {FROM_PARENT}
      </Row>
      {details.isCost ? (
        <>
          <Fieldset legend="COST ACCOUNT ATTRIBUTES">
            <Row label="Allocation restriction on a group" tone="muted">
              {FROM_PARENT}
            </Row>
            <Row label="Allocation on ownership change" tone="muted">
              By accrual days (uses parent account settings)
            </Row>
            <Row label="Default tax deduction" tone="muted">
              - uses parent account settings -
            </Row>
            <Row label="Next-period budget calculation" tone="muted">
              110% of budget (uses parent account settings)
            </Row>
          </Fieldset>
          <Row label="Separate tables for budget & final balance" tone="muted">
            <span className="account-details-check">
              <input type="checkbox" checked={false} disabled readOnly />
              (uses parent account settings)
            </span>
          </Row>
          <Fieldset legend="ALLOCATION TABLES (USES PARENT ACCOUNT SETTINGS)">
            <p className="account-details-note">
              No tables linked — uses parent account settings.
            </p>
          </Fieldset>
        </>
      ) : null}
      <Fieldset legend="ACCOUNT BALANCES">
        <Row label="Debit" tone="mono">
          {formatCents(details.debit)}
        </Row>
        <Row label="Credit" tone="mono">
          {formatCents(details.credit)}
        </Row>
        <Row label="Balance" tone="num">
          {formatCents(details.balance)}
        </Row>
        {details.budget === null ? (
          <Row label="Budget" tone="muted">
            ---
          </Row>
        ) : (
          <Row label="Budget" tone="mono">
            {formatCents(details.budget)}
          </Row>
        )}
      </Fieldset>
      <Fieldset legend="OTHER">
        <Row label="System ID" tone="mono">
          {details.systemId}
        </Row>
        <Row label="Created on" tone="muted">
          ---
        </Row>
      </Fieldset>
    </Scheda>
  );
}

const FROM_PARENT = "-None- (uses parent account settings)";
