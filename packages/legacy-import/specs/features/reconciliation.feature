# apps/web/tools/gen/specs/features/reconciliation.feature
Feature: Reconciliation gate

  Scenario Outline: a period with books reconciles to zero
    Given the legacy data for period "<period>"
    Then the period has posted books
    And the trial balance nets to zero
    And the new reconciliation gate marks the period reconciled

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
