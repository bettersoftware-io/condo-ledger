# packages/legacy-import/specs/features/double-entry.feature
Feature: Double-entry ledger parity

  Scenario Outline: every transaction balances and the tree ties to the flat sum
    Given the legacy data for period "<period>"
    When the new app projects the ledger
    Then every projected transaction balances (dare equals avere)
    And the account tree root saldo is zero
    And the account tree saldo equals the raw sum of entries

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
