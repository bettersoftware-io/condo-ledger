# apps/web/tools/gen/specs/features/units-money.feature
Feature: Per-resident units money parity

  Scenario Outline: resident saldoPrec reproduces the legacy startingBalance
    Given the legacy data for period "<period>"
    When the new app projects the units tree
    Then each resident saldoPrec equals the legacy unitResident startingBalance
    And the group saldoPrec equals the sum of resident saldoPrec

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
