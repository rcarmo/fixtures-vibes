@classic
Feature: Classic context meter tooltip

  @ux-context-001 @cap-context-meter
  Scenario: Show supplied usage in the context tooltip
    Given a turn has reported its context usage
    Then the context meter's label shows the used and total tokens in compact form and the rounded percentage
    When usage exceeds the context window
    Then the meter keeps its size and reports at least 100%

  @ux-context-002 @cap-context-meter
  Scenario: Display missing token counts without inventing them
    Given context usage does not contain a token count
    When the context pie renders
    Then its usage label contains the supplied percentage without fabricated token values
    And unavailable formatted numeric values use the formatter's unknown marker
    # Not constructible in a black-box suite against Piclaw 3.2.5: the meter appears only after a turn, and every
    # turn carries a token count (provider usage or the runtime's estimate). No spec until a runtime can omit it.

  @ux-context-003 @cap-context-meter
  Scenario: Offer compaction only when a callback exists
    Given no active compaction label is supplied
    When the context pie renders with a compaction callback
    Then its tooltip includes Compact context
    And clicking it invokes that callback
    When it renders without that callback
    Then the button is disabled and its tooltip says Context usage

  @ux-context-004 @cap-context-meter
  Scenario: Show the supplied compaction title and elapsed label
    Given a non-empty compaction label is supplied
    When the context pie renders
    Then it has the is-compacting class and shows that label beside the pie
    And its tooltip includes the supplied compaction title or the Smart compaction fallback
    And this tooltip branch replaces the ordinary Compact context suffix

  @ux-context-005 @cap-context-meter
  Scenario: Apply the coded usage warning colours
    Given a turn has reported its context usage
    Then the context meter is red above 90%
    And amber above 75% up to 90%
    And green up to 75%
