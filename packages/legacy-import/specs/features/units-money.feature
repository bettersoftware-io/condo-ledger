# packages/legacy-import/specs/features/units-money.feature
Feature: Per-resident previous balances parity

  Scenario Outline: the previous balance of each resident is the legacy startingBalance
    Given the legacy data for period "<period>"
    When the new app computes the previous balances
    Then each resident's previous balance equals the legacy unitResident startingBalance
    And the total of the previous balances equals the sum of the legacy startingBalance

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
