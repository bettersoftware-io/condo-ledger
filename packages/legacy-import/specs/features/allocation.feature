# packages/legacy-import/specs/features/allocation.feature
Feature: Allocation parity

  # NOTE: the legacy app's posted allocation entry (estimateDistribution) was typed
  # by hand, and the legacy report and the legacy algorithm (allocationOf, in budget
  # mode) agree with each other and with it to the cent, but for A04 of Pozzetto:
  # residents 166 and 167 are posted as 898.80 and 46.49, the report and the algorithm
  # give 898.64 and 46.63 (the same 945.29 between them). They are held to the report.
    Scenario: the budget allocation of Saturno 2011 equals the posted allocation entry
    Given the legacy data for period "Saturno 2011"
    When the new app computes the budget allocation
    Then the allocation total of each of the 10 residents equals its line of the posted entry "tx5"

  Scenario: the budget allocation of Pozzetto 2013 equals the posted allocation entry
    Given the legacy data for period "Pozzetto 2013"
    When the new app computes the budget allocation
    Then the allocation total of each of the 25 residents other than "r166" and "r167" equals its line of the posted entry "tx291"
    And the allocation total of "r166" is 89864 cents and of "r167" is 4663 cents
