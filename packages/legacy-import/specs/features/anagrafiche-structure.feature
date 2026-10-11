# packages/legacy-import/specs/features/anagrafiche-structure.feature
Feature: Anagrafiche and structure projection parity

  Scenario: the registry projects every categorised party with a known category
    Given the legacy data
    When the new app projects the anagrafiche
    Then every anagrafica has a category present in the category registry
    And the registry has at least 100 parties

  Scenario: the building tree contains exactly the real condominiums
    Given the legacy data
    When the new app projects the condominium tree
    Then the tree contains the building "Pozzetto" with a null legacy code rendered blank
    And the tree contains the super-condominium "Sole"
    And the tree excludes any building whose name contains "test"
