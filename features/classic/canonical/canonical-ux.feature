@canonical @piclaw-3.2.4 @classic @source-reviewed
Feature: Classic Piclaw interaction model
  The installed Piclaw reference release is the oracle.
  Visual differences and optional add-on behavior are not implied to be identical.

  Background:
    Given Piclaw is in single-user mode in an isolated workspace
    And the Classic client has selected session "main"
    And session "research" is available

  @ux-original-001 @shell @pointer @keyboard
  Scenario: Open and dismiss the workspace menu
    Given the workspace menu is closed
    When I activate the workspace menu trigger
    Then the workspace menu is shown
    When I click outside the menu or press Escape
    Then the workspace menu closes

  @ux-original-002 @shell @workspace @cap-workspace
  Scenario: Toggle workspace visibility without submitting the draft
    Given the composer contains unsent text
    When I choose the workspace visibility action
    Then the workspace visibility changes
    And the action does not submit the composer
    When I choose the visibility action again
    Then the previous workspace visibility is restored

  @ux-original-003 @quick-actions @typeahead @keyboard @cap-quick-actions @cap-slash-commands
  Scenario: Open Quick Actions by typing outside interactive controls
    Given the key event target is eligible noninteractive timeline content
    And no modal or popup exclusion applies
    When I type one printable non-whitespace character without Control, Meta or Alt
    Then Quick Actions opens with that character as its query
    And its input is focused when the open effect runs
    And results use the enabled Agents, Workspace and Slash commands groups
    And the initial selection prefers an exact title then a title prefix then the first result
    When I press ArrowDown or ArrowUp
    Then selection wraps through the filtered results
    When I press Enter with a selected result
    Then the selected action handler runs and the palette closes

  @ux-original-004 @quick-actions @focus @cap-quick-actions
  Scenario Outline: Do not open timeline typeahead from excluded targets
    Given the key event target is within <surface>
    When I type a printable character
    Then that event does not open Quick Actions

    Examples:
      | surface                               |
      | textarea or input                     |
      | select, button or link                |
      | contenteditable or textbox            |
      | composer or CodeMirror editor         |
      | workspace pane or sidebar             |
      | dialog, listbox or open popup         |

  @ux-original-005 @quick-actions @ime @cap-quick-actions
  Scenario: Ignore consumed and modified typeahead events
    Given a timeline key event meets an exclusion for prevented, repeated, composing, whitespace or modified input
    When the timeline typeahead guard evaluates it
    Then Quick Actions does not open from that event

  @ux-original-006 @quick-actions @dismissal @cap-quick-actions
  Scenario: Dismiss Quick Actions without executing a result
    Given Quick Actions is open
    When I press Escape or click its outside area
    Then Quick Actions closes and clears its query
    And no result action is executed

  @ux-original-007 @quick-actions @commands @cap-quick-actions @cap-slash-commands
  Scenario: Insert a Quick Actions command into the composer
    Given the composer already contains text
    And Quick Actions lists a slash command
    When I select that slash command
    Then the composer text is replaced with exactly the selected command
    And the composer is focused with its cursor at the end
    And selection does not submit the command
    And Quick Actions closes

  @ux-original-008 @quick-actions @skills @cap-quick-actions @cap-skills
  Scenario: Discover loaded skills in the command catalogue
    Given the selected session has loaded skills
    When I open Quick Actions with a slash query
    Then loaded skills are listed as "/skill:<name>" commands with descriptions in the Slash commands group
    And no separate Skills group is shown
    When I select a skill command
    Then its command text replaces the existing draft like other slash commands
    And selection alone does not submit the command

  @ux-original-009 @plan @addon-dependent @cap-addons @cap-plan-sidebar @reconcile-3.2.5
  Scenario: Save Markdown through the Plan sidebar add-on
    Given the Plan sidebar add-on is installed and its browser entry is loaded
    And its editor has loaded the selected chat's Markdown
    When I edit the Markdown and activate Save
    Then the add-on posts the chat identifier and Markdown to its plan API
    And a successful response updates its saved timestamp
    And the dirty flag clears only if the editor still contains the submitted text
    And newer edits are retained as unsaved changes

  @ux-original-010 @plan @addon-dependent @cap-addons @cap-plan-sidebar @reconcile-3.2.5
  Scenario: Keep dirty Plan text when a remote update arrives
    Given the Plan sidebar add-on editor contains unsaved edits
    When a plan-update event for the same chat is received
    Then the add-on retains the local text and displays its remote-change warning
    When I explicitly activate Refresh
    Then the add-on requests the stored plan without the automatic dirty-preservation option
    And an applicable response replaces the displayed Markdown
    # Refresh is not specified as a compare-and-swap revision operation or discard confirmation.

  @ux-original-011 @plan @addon-dependent @cap-addons @cap-plan-sidebar @reconcile-3.2.5
  Scenario: Save a Plan before submitting it to the model
    Given the Plan sidebar add-on is open
    When I activate Submit to model
    Then the add-on first saves the editor Markdown for the captured chat
    And it does not submit if saving fails, the chat changes or the saved plan is empty
    And otherwise it posts the saved checklist prompt in auto mode to that chat's message endpoint
    And a submission error is displayed in the Plan sidebar

  @ux-original-012 @plan @addon-dependent @cap-addons @cap-plan-sidebar @reconcile-3.2.5
  Scenario: Represent checklist progress using the Plan add-on
    Given the Plan sidebar add-on is installed with its model tool available
    And the selected chat's plan contains pending, in-progress and completed checklist items
    Then the sidebar interprets "- [ ]", "- [-]" and "- [x]" as checklist states
    And headings and other Markdown remain editor content
    And the progress display derives from parsed checklist items
    When the session-scoped "plan" tool reads or writes the plan
    Then it addresses the selected chat's stored Markdown
    # Tool activation policy still decides whether the tool is model-visible.

  @ux-original-013 @session-picker @keyboard @cap-session-picker
  Scenario: Open and dismiss the Classic session picker
    When I activate the session picker
    Then its search field receives focus when the popup is mounted
    And session entries are organised by the current picker grouping rules
    When I press Escape
    Then the popup closes without selecting a different session
    And the session-trigger control is focused

  @ux-original-014 @session-picker @scope @cap-session-picker
  Scenario: Select another session through the picker
    Given the session picker contains session "research"
    When I activate that session entry
    Then the client requests selection of its chat identifier
    And chat-scoped timeline and queue refresh paths use the new selection
    And their stale-response guards reject responses for a superseded selection

  @ux-original-015 @session-picker @capability @cap-session-picker
  Scenario: Use the session actions actually supplied by the client
    Given the session picker displays a session
    Then its action controls depend on the session entry and supplied callbacks
    And pinning, renaming, archiving and restoring use their respective client action paths
    And a failed mutation reports an error instead of declaring success
    # This does not assert that every skin offers delete or child creation in this popup.

  @ux-original-016 @queue @cap-queue
  Scenario: Display queued follow-ups during a busy turn
    Given the selected chat has an active turn
    When accepted composer submissions are queued by the server
    Then the follow-up stack displays the returned queue entries for that chat
    And subsequent queue refreshes reconcile the stack with server state

  @ux-original-017 @queue @return @cap-queue
  Scenario: Return a queued follow-up to the Classic editor
    Given a queued follow-up contains serialised text and references
    When I activate its return-to-editor action
    Then the client reconstructs the text and file, folder and message references
    And it replaces the composer text and references with the reconstructed draft
    And it clears the composer's media list and submission notices
    And it schedules focus and cursor placement at the end of the restored text
    And it schedules the queued-item removal callback
    # The installed client does not persist a merged recovery draft before removal.

  @ux-original-018 @queue @remove @reorder @cap-queue
  Scenario: Reorder and remove queued follow-ups with reconciliation
    Given the follow-up stack contains multiple entries
    When I move an entry
    Then the client optimistically changes the local order and sends the indices with the chat identifier
    And a reorder failure triggers a queue refresh
    When I remove a queued entry
    Then the client optimistically hides that row and requests server removal
    And a failure clears its dismissal marker, shows a warning and refreshes the queue

  @ux-original-019 @queue @steer @current-behavior @cap-queue @cap-steer @reconcile-3.2.5
  Scenario: Steer a queued item using the backend-authoritative action
    Given the Classic follow-up stack offers Steer for a queued item
    When I activate Steer
    Then the client optimistically hides the item and calls the steer endpoint with its row and chat identifiers
    And the backend determines whether to steer an active run or send immediately after the stream ends
    And a failure shows a warning and refreshes queue state
    # The input PR's @safety-deviation proposed disabling idle Steer.
    # That proposal is not the current Classic behavior and is not implemented by this specification.

  @ux-original-020 @model-picker @cap-model-picker
  Scenario: Select a model for the selected chat
    Given the model catalogue provides selectable entries
    When I open the model picker and select an entry
    Then the client requests that provider and model for the captured chat
    And accepted model data updates the displayed model and context information
    And a rejected request reports failure
    And selecting a model does not submit the composer draft

  @ux-original-021 @session-picker @model-picker @keyboard @cap-model-picker @cap-session-picker
  Scenario: Navigate the Classic picker lists
    Given a Classic session or model popup is open
    When I enter a search query
    Then its own query matcher filters the available entries
    When I navigate with arrows or supported paging keys outside text-editing behavior
    Then its keyboard handler moves the highlighted entry within the filtered list
    And the model picker requires Control or Meta with Home and End while its search input has focus
    When I press Enter with a highlighted entry
    Then that entry is activated
    When I press Escape
    Then the popup closes
    # Search fields and searchable metadata differ between the two picker implementations.

  @ux-original-022 @model-picker @capability @cap-model-picker
  Scenario: Render model capabilities without inventing values
    Given the catalogue or model response omits optional capability information
    When the model UI renders it
    Then capability controls use the reported model metadata
    And unavailable context information is not treated as an authoritative measured token count
    And a model response for a superseded chat is rejected by the model-state guard

  @ux-original-023 @turn @reconnect @cap-reconnect @cap-stop
  Scenario: Refresh active-turn state after reconnect and request stop
    Given the client reconnects its SSE channel
    When reconnect refresh handlers run
    Then chat data, agent status and queue state are refreshed
    When I activate the visible stop control
    Then the client requests cancellation through its selected-chat control path
    And stale turn events are filtered by the turn-state guards
    # Cancellation is a request; the UI must await subsequent authoritative state.

  @ux-original-024 @timeline @copy @delete @cap-message-delete
  Scenario: Copy and delete messages using their actual controls
    Given a post renders Markdown containing a fenced code block
    When I use the post copy action
    Then the clipboard receives the post's source Markdown
    When I use the code block copy action
    Then the clipboard receives code text
    When I request deletion of a message with replies
    Then the client follows the cascade confirmation path
    And cancelling the confirmation preserves the message
    And accepted deletion removes the targeted message and confirmed replies

  @ux-original-025 @messages @model-facing @cap-messages-tool
  Scenario: Retrieve explicit message IDs and bounded row windows
    Given the messages tool is available in an authorised session
    When the model requests multiple explicit message IDs with surrounding context
    Then the tool returns bounded message results and reports missing_row_ids
    When the model supplies an after_row or before_row window and a limit
    Then the tool applies that window and limit to the selected chat scope
    And in single-user mode an explicit permitted chat or all-chat scope may be requested
    And family mode restricts reads to authorised owned sessions
    # Message results are model-facing data, not a guarantee about how a model interprets text.

  @ux-original-026 @attachments @cap-attachments
  Scenario: Keep attachment upload state separate from message submission
    Given the composer has selected an attachment
    When upload succeeds
    Then the returned media identifier is available to the message submission path
    When upload fails
    Then the client reports the upload error
    And it does not treat that failed file as a successfully uploaded attachment
    # This does not promise server deduplication across upload retries or source deletion.

  @ux-original-027 @tools @pane @timer @cap-tool-output
  Scenario: Route tool execution through the Classic status and Output panes
    Given the current turn starts a tool with a call identity and arguments
    When tool execution updates include output text
    Then the status identifies that call and the Output pane displays its preview
    And no raw tool result is inserted as a user message in the conversation
    When the last active tool finishes successfully
    Then the activity phase changes to Waiting for model
    And the completed call is metadata rather than a persistent Completed tool footer
    And the draft and thought previews survive that intra-turn transition
    When a terminal turn event is followed by an authoritative idle reload
    Then active tool and preview panes are absent
    # Timing, concurrent calls and reduced-motion parity need additional evidence.

  @ux-original-028 @copy @speech @capability @cap-read-aloud
  Scenario: Copy code and transfer post speech ownership
    Given the browser exposes supported speech synthesis and the post has speakable text
    When I start reading an assistant post aloud
    Then the speech controller owns that post's utterance
    When I start another post
    Then prior speech is cancelled and ownership transfers
    And stale callbacks cannot clear the newer speech owner
    When I copy a code block
    Then the copy path uses code text instead of highlighted HTML

  @ux-original-029 @svg @markdown @piclaw-3.2.4 @cap-svg-render
  Scenario: Render a safe fenced SVG as an isolated image and retain source
    Given a post contains a fenced SVG with safe vector geometry and a title
    Then the post renders an image named by the SVG title from a data:image/svg+xml URL
    And the original SVG source remains available to copy
    And the SVG is not inserted into the page as inline elements
    When another fence contains scripts, event handlers or external references
    Then that unsafe fence remains visible as escaped source without a preview image
    And it cannot execute script or fetch an external resource
