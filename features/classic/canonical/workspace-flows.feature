@canonical @classic @workspace
Feature: Classic workspace flows
  Source-backed canonical expectations for the Classic workspace explorer,
  tab strip, tab store, and workspace panes.

  Background:
    Given the audited surface is the Classic workspace shell
    And only source-backed Classic behaviors are in scope

  @ux-workspace-001 @crud @cap-workspace
  Scenario: Create a new untitled markdown file in the resolved folder
    Given a workspace file or folder is selected
    When I choose "New file"
    Then the explorer resolves the selected folder or its parent as the create target
    And it tries "untitled.md" before numbered "untitled-N.md" fallbacks in that folder
    And the created path becomes selected
    And the parent folder is expanded when the target is not the workspace root
    And the target subtree and file preview refresh
    And the workspace index status refreshes

  @ux-workspace-002 @crud @cap-workspace
  Scenario: Rename a selected non-root workspace entry
    Given a non-root workspace entry is selected
    When I rename it to a different trimmed name
    Then the explorer calls the rename mutation for the selected path
    And it dispatches a "workspace-file-renamed" event with the old and new paths
    And the renamed path becomes selected
    And file previews reload the renamed file path
    And renamed directories keep expanded descendants remapped to the new prefix
    And the workspace index status refreshes

  @ux-workspace-003 @crud @cap-workspace
  Scenario: Delete a selected file after confirmation
    Given a file row is selected
    When I trigger deletion and confirm the filename prompt
    Then the explorer deletes that file path
    And the current selection clears when the deleted file was selected
    And the parent subtree reloads
    And a deletion failure is surfaced on the preview state

  @ux-workspace-004 @hidden @cap-workspace
  Scenario: Toggle hidden files and reload the visible tree state
    Given the Classic workspace header menu is open
    When I toggle hidden files
    Then the component flips "workspaceShowHidden" in local storage
    And it refreshes workspace visibility with the new hidden-files flag
    And it reloads the root tree
    And it reloads each already-expanded subtree

  @ux-workspace-005 @search @index @cap-search @cap-workspace
  Scenario: Expose reindex controls without a verified in-pane file-search field
    Given the Classic workspace header menu is open
    Then it shows "Refresh tree", "Reindex workspace", and a hidden-files toggle
    And this inspected component also shows file creation and upload actions
    And no dedicated file-search input is rendered by this inspected component

  @ux-workspace-006 @selection @rename @cap-session-manage @cap-workspace
  Scenario: Single-click previews files and double-click enters rename
    Given the Classic workspace tree is visible
    When I single-click a file row outside action buttons and carets
    Then the clicked path becomes selected
    And the explorer notifies file selection listeners
    And the file preview loads for that path
    When I double-click a non-root row outside action buttons, links, inputs, and carets
    Then the explorer enters rename mode for that path

  @ux-workspace-007 @upload @cap-attachments @cap-workspace
  Scenario: Upload files to the resolved folder with progress and overwrite prompts
    Given one or more files are chosen or dropped onto the Classic workspace explorer
    When the upload begins
    Then the explorer uploads into the resolved folder or the workspace root
    And aggregate progress tracks the current file, total files, filename, and percent
    And a name conflict prompts before retrying with overwrite enabled
    And the last successful uploaded path becomes selected and previewed when available
    And the target subtree and workspace index status refresh
    And upload failures surface error text on the workspace surface

  @ux-workspace-008 @viewer @cap-vnc @cap-workspace
  Scenario: Render workspace previews by preview kind and content type
    Given a Classic workspace preview context contains file metadata and preview content
    When the preview pane renders the selection
    Then markdown text uses the markdown workspace preview extension
    And other text renders as escaped code content
    And images render from the preview URL or the workspace raw URL
    And binary files render a download-oriented message
    And preview metadata includes kind and file extension
    And preview metadata also includes content type, size, modified time, and path when available

  @ux-workspace-009 @viewer @editor @cap-editor @cap-vnc @cap-workspace
  Scenario: Gate open-in-tab and open-in-editor actions by file capabilities
    Given a Classic workspace file is selected
    Then "Open in tab" is shown only for files with a specialized workspace tab handler
    And "Open in editor" is disabled unless the preview is text, the selection is not a directory, and the preview is at most 256 KiB
    And the menu routes editor opens through the current open-editor callback

  @ux-workspace-010 @tabs @dirty @cap-workspace
  Scenario: Show dirty tab affordances and compare-to-saved gating
    Given an editor tab has unsaved changes
    Then the tab reports unsaved changes
    And its close control reports unsaved changes instead of offering a plain close
    And the tab's context menu offers "Compare to Saved", which a tab without changes does not offer

  @ux-workspace-011 @tabs @close @cap-workspace
  Scenario: Close tabs with MRU fallback while preserving pinned tabs in bulk close flows
    Given several editor tabs are open
    When I close the active tab
    Then the most recently used remaining tab becomes active, not merely its neighbour
    When I close other tabs from one tab's context
    Then pinned tabs stay open
    When I close all tabs
    Then pinned tabs still stay open

  @ux-workspace-012 @tabs @rename @cap-session-manage @cap-workspace
  Scenario: Rename tracked tab identities without dropping active or MRU state
    Given a workspace-backed tab is already open
    When the tab store renames that tab path
    Then the stored tab id, path, and default label update to the new path
    And a provided custom label overrides the default label
    And the active tab id follows the renamed tab when it was active
    And the MRU order keeps the renamed tab in the same position

  @ux-workspace-013 @tabs @popout @cap-workspace
  Scenario: Gate dock, popout, reattach, and standalone viewer routes from the tab context menu
    Given the Classic tab context menu is open for a tab
    Then the terminal dock toggle is rendered only for the active tab when dock support is present
    And detached tabs show a reattach action instead of a second popout action
    And attached tabs can offer "Open in window"
    And "Open in new tab" uses addon standalone routes when available
    And non-addon files map to the office viewer, data viewer, image viewer, or raw workspace URL according to file type

  @ux-workspace-014 @terminal @errors @cap-terminal @cap-workspace
  Scenario: Surface terminal load, availability, reconnect, and exit states
    Given the Classic terminal pane is mounted
    When xterm bootstrap throws
    Then the pane shows a terminal load failure placeholder and status
    When the terminal session reports disabled or throws during startup
    Then terminal output reports backend unavailability and the status becomes unavailable
    When the websocket closes unexpectedly after startup
    Then the pane schedules a reconnect attempt
    When the backend emits terminal exit state
    Then the pane appends a terminal exited marker and the status becomes exited

  @ux-workspace-015 @vnc @errors @cap-vnc @cap-workspace
  Scenario: Surface VNC configuration, read-only, and runtime error gates
    Given the Classic VNC pane is mounted
    When there are no saved targets and direct connect is disabled on the host
    Then the pane shows a configuration-oriented empty state instead of a live session
    When the resolved target is read-only
    Then send-clipboard controls render disabled
    And pointer and keyboard handlers are not attached for interactive input
    And clipboard send returns immediately in read-only mode
    When the VNC proxy, display protocol, or session load fails
    Then the pane reports proxy, protocol, or session-load error text in its status and display chrome

  @ux-workspace-016 @editor @save @cap-editor @cap-workspace
  Scenario: Save changed editor content
    Given an editor tab has unsaved text
    When I invoke Save
    Then the text is written to the file once and the tab no longer reports unsaved changes
    And reopening the file shows the saved text
    When a save fails
    Then the editor shows a "Save failed" status, keeps the unsaved changes and lets me save again

  @ux-workspace-017 @editor @save @cap-editor @cap-workspace
  Scenario: Avoid writing an unchanged editor document
    Given an editor tab whose text was changed back to the saved text
    When I invoke Save
    Then the tab no longer reports unsaved changes
    And nothing is written to the file

  @ux-workspace-019 @editor @save @cap-editor @cap-workspace
  Scenario: Keep edits made while a save is in progress
    Given an editor tab has unsaved text
    When I invoke Save
    And I type more text before the save completes
    Then after the save completes the editor still shows all the text
    And the tab still reports unsaved changes
    When I save again
    Then the file holds all the text

  @ux-workspace-018 @editor @conflict @cap-editor @cap-workspace
  Scenario: Resolve an editor file conflict with the supplied actions
    Given the editor conflict monitor exposes a file-changed notice
    When I choose Reload
    Then returned file content replaces the editor document while its view state is restored
    And the saved baseline and modification time update and dirty state clears
    When I choose Save copy
    Then the current text is written to a newly resolved copy path
    When I choose Overwrite
    Then the editor invokes its normal save handler
