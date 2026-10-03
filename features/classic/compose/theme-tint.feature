@classic @compose @theme
Feature: Classic theme and tint commands
  The /theme and /tint composer commands change how the Classic shell looks. "Appearance" below means what a user
  sees: the page background and the accent colour (for example, the send button under the pointer once a message is
  ready).

  Background:
    Given I am authenticated and on the main chat in the Classic shell

  @ux-theme-001 @cap-theme-tint
  Scenario: /theme with no arguments shows available themes
    When I type "/theme" and press Enter in the Classic compose box
    Then the timeline should show a message containing "Available themes"

  @ux-theme-002 @cap-theme-tint
  Scenario: /theme ristretto applies dark theme visually
    When I type "/theme ristretto" and press Enter in the Classic compose box
    Then the page background should become dark
    And the accent colour should change
    And the timeline should show "Theme set to"

  @ux-theme-003 @cap-theme-tint
  Scenario: /theme default restores from ristretto visually
    Given the Classic shell theme is set to "ristretto"
    When I type "/theme default" and press Enter in the Classic compose box
    Then the page background and accent colour should return to the default appearance
    And the timeline should show "Theme set to"

  @ux-theme-004 @cap-theme-tint
  Scenario: /theme dark returns error — not a valid theme name
    When I type "/theme dark" and press Enter in the Classic compose box
    Then the appearance should not change
    And the timeline should show "Unknown theme"

  @ux-theme-005 @cap-theme-tint
  Scenario: /theme survives page refresh
    Given the Classic shell theme is set to "ristretto"
    When I refresh the Classic page
    Then the page should still have the ristretto appearance

  @ux-theme-006 @cap-theme-tint
  Scenario: /tint hex changes accent and background on default theme
    When I type "/tint #e11d48" and press Enter in the Classic compose box
    Then the accent colour should become #e11d48
    And the page background should take on a tint
    And the timeline should show "Tint set to"

  @ux-theme-007 @cap-theme-tint
  Scenario: /tint named color works on default theme
    When I type "/tint orange" and press Enter in the Classic compose box
    Then the accent colour and page background should change from the default appearance
    And the timeline should show "Tint set to"

  @ux-theme-008 @cap-theme-tint
  Scenario: Switching tints visibly changes accent color
    Given the Classic shell is tinted "#e11d48"
    When I type "/tint #3b82f6" and press Enter in the Classic compose box
    Then the accent colour and page background should differ from the previous tint

  @ux-theme-009 @cap-theme-tint
  Scenario: /tint off clears tint and restores vanilla default
    Given the Classic shell is tinted "#3b82f6"
    When I type "/tint off" and press Enter in the Classic compose box
    Then the page background and accent colour should return to the default appearance
    And the timeline should show "Tint cleared"

  @ux-theme-010 @cap-theme-tint
  Scenario: /tint with no args shows usage
    When I type "/tint" and press Enter in the Classic compose box
    Then the timeline should show "Usage"

  @ux-theme-011 @cap-theme-tint
  Scenario: /tint invalid value returns error
    When I type "/tint $$notacolor" and press Enter in the Classic compose box
    Then the appearance should not change
    And the timeline should show "Invalid tint"

  @ux-theme-012 @cap-theme-tint
  Scenario: /tint survives page refresh
    Given the Classic shell is tinted "#e11d48"
    When I refresh the Classic page
    Then the page should still have the same tinted appearance

  @ux-theme-013 @cap-theme-tint
  Scenario: Tint on default, switch to ristretto, switch back
    Given the Classic shell is tinted "#e11d48"
    When I type "/theme ristretto" and press Enter in the Classic compose box
    Then the page should have the ristretto appearance
    When I type "/theme default" and press Enter in the Classic compose box
    Then the page should have the untinted default appearance, because /theme clears the tint

  @ux-theme-014 @cap-theme-tint
  Scenario: /tint on ristretto switches to default+tint
    Given the Classic shell theme is set to "ristretto"
    When I type "/tint #3b82f6" and press Enter in the Classic compose box
    Then the page background should be light again, tinted
    And the accent colour should become #3b82f6

  @ux-theme-015 @cap-theme-tint
  Scenario: Round-trip visual consistency
    Given the Classic shell theme is "default" with no tint
    And I note the current appearance
    When I apply tint "#e11d48"
    Then the page background should differ from the noted one
    When I switch to "/theme ristretto"
    Then the page background should differ again
    When I switch back to "/theme default"
    Then the appearance should match the original noted one
