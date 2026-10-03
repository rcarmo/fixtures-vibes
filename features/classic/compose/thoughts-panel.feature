@classic
Feature: Classic thought and draft panel disclosure
  Observed on the installed Piclaw reference release.
  # Reconciled 2026-09-28: generic more…/less controls, nine-line tail windows,
  # and independently scrollable bodies replace the older line-count renderer.

  @ux-thoughts-001 @cap-thoughts
  Scenario: Render collapsed thought content with disclosure state
    Given thought content longer than nine lines is streaming and its panel is collapsed
    When the status panel renders
    Then the collapsed preview shows the newest nine lines
    And earlier lines are hidden behind a visible "more" disclosure control

  @ux-thoughts-002 @cap-thoughts
  Scenario: Continue updating content independently of disclosure
    Given a thought panel is collapsed
    When further thought text streams
    Then the rendered thought content updates without requiring the panel to be expanded

  @ux-thoughts-003 @cap-thoughts
  Scenario: Toggle thought panel expansion
    Given thought content has a disclosure control
    When I activate that control
    Then the panel expands and shows all retained thought lines
    When I activate the control again
    Then the panel collapses to the newest lines

  @ux-thoughts-004 @cap-thoughts
  Scenario: Collapse an expanded status panel with Escape
    Given an expanded status panel
    And focus is not in an editable field
    When I press Escape
    Then that panel collapses to the newest lines

  @ux-thoughts-005 @cap-thoughts
  Scenario: Preserve text when changing disclosure state
    Given a status panel contains streamed text
    When I expand and collapse the panel repeatedly
    Then no retained thought text is lost
