@canonical @classic
Feature: Classic additional core interaction surfaces
  These flows are scoped to the Classic client.
  Capability boundaries remain explicit; no cross-port parity is implied.

  Rule: Classic side-question panel
    @ux-extra-001 @classic @btw
    Scenario: Display and act on a side-question result
      Given the Classic BTW panel has a question and a supplied result state
      When it renders
      Then it shows available question, error and thinking content
      And its answer and action footer are hidden while running
      And a completed non-empty answer is shown
      And visible Retry requires a question
      And visible Inject into chat is disabled without an answer
      When I activate enabled Retry or Inject into chat
      Then the supplied retry or inject callback runs

  # Adaptive Cards (@ux-extra-002/003, @cap-adaptive-cards) were removed from the suite on 2026-10-04 by Rui's
  # decision (too complex for the compliance contract). The IDs are retired and must not be reused.

  Rule: Classic generated widgets
    @ux-extra-004 @classic @widgets
    Scenario: Interpret persisted and live widget artifacts separately
      Given widget metadata identifies an HTML or SVG artifact
      When the client resolves a persisted timeline artifact
      Then non-empty artifact content is required for a usable persisted widget
      When the client resolves an unfinished live artifact
      Then it can represent a streaming widget before the final content exists
      And loading, streaming, final and error are distinct artifact states
      # Against Piclaw 3.2.5 only the persisted half is constructible: widgets arrive from a tool call already final.

    @ux-extra-005 @classic @widgets
    Scenario: Keep widget dismissal separate from queue mutation
      Given a live floating widget is visible
      When I close the floating pane
      Then the client records dismissal of that widget session
      And closing the pane does not itself steer or remove a queued follow-up

    @ux-extra-014 @classic @widgets
    Scenario: Route widget bridge actions through the host
      Given an interactive widget is open in a chat
      When the widget submits text through its bridge
      Then the text is sent as a message in the chat that opened the widget
      And the composer draft is untouched
      When the widget asks to close through its bridge while a follow-up is queued
      Then the floating pane closes
      And the queued follow-up is neither steered nor removed

  Rule: Classic notification coordination
    @ux-extra-011 @classic @notifications @cap-push-notifications
    Scenario: Coordinate local notification ownership across clients
      Given client presence snapshots identify device, selected chat and visibility
      When the notification coordinator chooses a local recipient
      Then it considers the current snapshot and live same-device presence entries for that chat
      And any visible candidate suppresses local notification delivery
      And otherwise only the lexicographically first client identifier may deliver locally
      And withdrawing a client's presence removes its published storage entry
      # Browser permission, delivery and sound support are separate capability gates.

  Rule: Classic recovery presentation
    @ux-extra-012 @classic @recovery
    Scenario: Hide validated recovery control posts
      Given a post has a valid protected_recovery_continuation control-intent block
      When the Classic post component renders it
      Then the control post is omitted from the visible timeline
      And invalid typed recovery fields do not qualify it for this control-intent hiding path

    @ux-extra-013 @classic @recovery
    Scenario: Suppress an empty informational recovery placeholder
      Given an agent post has the agent-recovery type and info status
      And it has no renderable text, attachments, card or card submission
      When the Classic post component renders it
      Then the placeholder is omitted from the visible timeline
      # Recovery, timeout and turn-outcome metadata are separate from user controls.
