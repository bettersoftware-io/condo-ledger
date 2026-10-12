# packages/legacy-import/specs/features/installments.feature
Feature: Installments parity

  Scenario Outline: the installment plan reproduces the legacy installmentItem amounts
    Given the legacy data for period "<period>"
    When the new app projects the installments
    Then the installments group total equals the sum of legacy installmentItem amounts

    Examples:
      | period        |
      | Saturno 2011  |
      | Pozzetto 2013 |
