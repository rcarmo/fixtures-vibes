@classic
Feature: Classic workspace menu and layout controls
  Classic controls and stored scale settings are not a guarantee of Visual parity.

  Rule: Workspace menu actions
    Background:
      Given the Classic workspace menu is open

    @ux-shell-001
    Scenario: Menu contains New file, Refresh tree, Reindex workspace
      Given the workspace is visible
      Then New file, Refresh tree and Reindex workspace actions are enabled
      When I activate one of these actions
      Then the matching workspace action is dispatched
      And the menu closes

    @ux-shell-002
    Scenario: Menu contains hidden files toggle
      Given the workspace is visible
      When I activate the hidden files toggle
      Then the workspace tree shows its hidden entries
      When I activate the toggle again
      Then the hidden entries are no longer shown

    @ux-shell-003
    Scenario: Workspace items disabled in chat-only mode
      Given the workspace is not visible
      Then the New file, Refresh tree, Reindex workspace and hidden-files actions are disabled

    @ux-shell-004
    Scenario: Terminal and VNC menu controls depend on callbacks
      Given the client supplies terminal or VNC opening callbacks
      Then the corresponding menu actions are offered
      And activating an action invokes its callback
      # Actual connection availability is checked by its service, not by workspace visibility alone.

  Rule: Shell layout
    @ux-shell-005
    Scenario: Compose box spans full width
      Given the Classic chat surface is displayed
      Then the compose wrapper occupies the available chat-column width

    @ux-shell-006
    Scenario: Hamburger button visible and above safe area
      Given the Classic composer is rendered in a supported mobile viewport
      Then the menu trigger is fully visible, below the top safe-area inset, and clear of the composer
      # Piclaw 3.2.5 places the menu trigger at the top-left of the timeline (not inside the composer); the shell
      # container pads its top with env(safe-area-inset-top).

    @ux-shell-007
    Scenario: Tab close does not activate tab
      Given multiple workspace tabs are open
      When I activate a tab's close control
      Then that click is handled by the close action without also activating the tab

  Rule: Display scale
    @ux-shell-008
    Scenario: Menu contains display scale control
      Given the Classic workspace menu is open
      Then the display scale control reflects the stored client scale setting
      # Piclaw 3.2.5 offers the control only when installed as an app (display-mode standalone or fullscreen);
      # browser tabs cannot emulate that display mode, so suites record this scenario as an environment limit there.
      When I choose another supported scale
      Then the client applies and stores that scale

    @ux-shell-009
    Scenario: Inline code in editor preview is monospaced
      Given an editor Markdown preview contains inline code
      Then the preview styles inline code with the code font family
