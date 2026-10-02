@canonical @piclaw-baseline
Feature: Piclaw-compatible interaction model
  Every runtime exposes the same observable user flows as Piclaw through native UI and APIs.
  Unsupported capabilities fail their tagged scenario rather than being simulated.
  Safety deviations are explicit and require alignment instead of weakening safeguards.

  Background:
    Given an isolated canonical database
    And the canonical current session "main"
    And a second session "research"
    And deterministic native assets and registry data
    And all actions are performed through visible enabled controls

  @shell @pointer @keyboard @ux-shared-001
  Scenario Outline: Open and dismiss the workspace menu
    Given the workspace menu is closed
    When I open the workspace menu using <input>
    Then the workspace menu is open exactly once
    And focus can reach each enabled menu item
    When I dismiss the workspace menu using <dismissal>
    Then the workspace menu is closed
    And no underlying control is activated
    And after keyboard dismissal focus returns to the workspace menu button

    Examples:
      | input    | dismissal      |
      | pointer  | outside pointer|
      | keyboard | Escape         |

  @shell @workspace @responsive @ux-shared-002 @cap-workspace
  Scenario: Show and hide the native workspace
    Given the composer contains canonical unsent content
    When I choose "Show workspace" from the workspace menu
    Then the native workspace tree is visible
    And the workspace menu is closed
    When I hide the workspace
    Then the workspace tree is hidden
    And the current session and composer content are unchanged

  @quick-actions @typeahead @keyboard @ux-shared-003 @cap-quick-actions @cap-slash-commands
  Scenario: Type on the idle timeline to open Quick actions
    Given focus is on noninteractive timeline content
    And no modal, session picker, model picker, workspace editor or composer control is active
    When I type one printable non-whitespace character without Control, Meta or Alt
    Then Quick actions opens exactly once
    And its search field has focus
    And the typed character is the initial query
    And the highlighted result prefers an exact title over a longer title with that prefix
    When I press ArrowDown or ArrowUp
    Then the highlight moves through the filtered results and wraps at both ends
    When I press Enter
    Then the highlighted action runs exactly once
    And Quick actions closes without erasing the composer draft

  @quick-actions @typeahead @focus @failure @ux-shared-004 @cap-quick-actions @cap-slash-commands
  Scenario Outline: Do not steal typing from an interactive surface
    Given focus is inside <surface>
    When I type a printable character
    Then Quick actions remains closed
    And the surface receives the character normally

    Examples:
      | surface                  |
      | composer textarea        |
      | input or select          |
      | button or link           |
      | workspace sidebar        |
      | session or model picker  |

  @quick-actions @typeahead @ime @ux-shared-005 @cap-quick-actions @cap-slash-commands
  Scenario: Ignore consumed, modified and composing keys
    Given focus is on noninteractive timeline content
    When a key event is already prevented, repeated, composing, whitespace, Control-modified, Meta-modified or Alt-modified
    Then Quick actions remains closed
    And no action is activated

  @quick-actions @dismissal @scope @ux-shared-006 @cap-quick-actions
  Scenario Outline: Dismiss Quick actions without side effects
    Given Quick actions is open and its search query has not activated an action
    When I dismiss it using <dismissal>
    Then Quick actions is closed
    And focus returns to the connected opening trigger when applicable
    And the current session, composer draft, media and references are unchanged

    Examples:
      | dismissal       |
      | Escape          |
      | outside pointer |

  @quick-actions @scope @race @failure @ux-shared-007 @cap-quick-actions
  Scenario: Activate only current supported Quick actions
    Given command and session results are scoped to session "main"
    When I change to session "research" while an older catalogue or activation is pending
    Then the older result cannot replace or activate an action in "research"
    And failed activation keeps Quick actions open with recoverable input and an error
    And unsupported commands and workspace actions are absent rather than simulated
    And command insertion replaces the composer text with exactly the command and does not submit it (as @ux-original-007)

  @quick-actions @skills @commands @scope @ux-shared-008 @cap-quick-actions @cap-skills @cap-slash-commands
  Scenario: Discover loaded skills through canonical slash commands
    Given session "main" has two loaded skills with distinct names and descriptions
    When Quick actions loads the authoritative command catalogue
    Then each loaded skill appears exactly once as "/skill:<name>"
    And skill commands are searchable by name and description in the Slash commands group
    And no separate Skills group or synthetic skill action is added
    When I activate one skill command
    Then the composer text is replaced with exactly "/skill:<name>" and nothing is submitted (as @ux-original-007)
    And execution expands only the skill loaded by the captured session
    And an unknown or stale skill command fails recoverably without invoking another skill

  @plan @pointer @keyboard @ux-shared-009 @cap-plan-sidebar
  Scenario Outline: Open Plan and edit the stored Markdown
    Given session "main" has a stored Plan
    When I open Plan using <input>
    Then its editor and checklist progress are visible
    When I edit the Plan and save it
    Then the session-scoped "plan" tool reads the saved Markdown
    And a reload preserves the saved Markdown

    Examples:
      | input    |
      | pointer  |
      | keyboard |

  @plan @race @failure @ux-shared-010 @cap-plan-sidebar
  Scenario: Preserve dirty Plan text on a remote update
    Given the open Plan editor has unsaved local text
    When the "plan" tool stores different text for the same session
    Then the editor retains its local text
    And the UI reports that the Plan changed remotely
    When I refresh the dirty Plan, accepting any discard confirmation
    Then the editor shows the stored remote text

  @plan @scope @submit @ux-shared-011 @cap-plan-sidebar
  Scenario: Submit Plan to the captured session
    Given Plan and composer both contain unsent content
    When I choose "Submit to model"
    Then Plan is saved before it is sent
    And normal send or queue policy targets session "main"
    And composer text, media and references remain unchanged
    And switching sessions before the save completes cancels the submission instead of retargeting it

  @plan @tool @model @truthful-ui @ux-shared-012 @cap-plan-sidebar @cap-tool-output
  Scenario: Expose canonical Plan Markdown and the Plan tool to the model
    Given session "main" has checklist items in pending, in-progress and completed states
    Then Plan renders them as "- [ ]", "- [-]" and "- [x]" Markdown
    And headings and non-checklist Markdown remain editable without fabricated progress
    And the model tool catalogue contains one session-scoped "plan" tool
    When the model reads and updates Plan through that tool
    Then the sidebar and tool return the same canonical Markdown
    And another session's Plan is unchanged

  @session-picker @pointer @keyboard @ux-shared-013 @cap-session-picker
  Scenario Outline: Open, search and dismiss the session picker
    When I open the session picker using <input>
    Then its search field has focus
    And searching by native identifier finds sessions "main" and "research"
    When I dismiss it with Escape
    Then no session changes
    And focus returns to the session-picker trigger

    Examples:
      | input    |
      | pointer  |
      | keyboard |

  @session-picker @scope @race @ux-shared-014 @cap-session-picker
  Scenario: Select one coherent session view
    Given delayed responses exist for session "main"
    When I select session "research" using keyboard navigation
    Then timeline, queue, model, context and composer all show "research"
    And a late "main" response replaces none of them

  @session-picker @capability @ux-shared-015 @cap-session-picker
  Scenario: Expose only supported session mutations
    Then pin, archive, restore, rename, delete and child-session creation are enabled only when implemented by the native API
    And running or unknown-count sessions cannot be deleted
    And a failed mutation keeps the picker and selection recoverable

  @queue @fifo @ux-shared-016 @cap-queue
  Scenario: Queue two follow-ups exactly once
    Given session "main" has an active turn
    When I send two follow-ups
    Then both are shown in the follow-up stack in the order sent, also after a reload
    And when the turn ends each is delivered to the agent exactly once, in that order
    And session "research" is unchanged

  @queue @return @ux-shared-017 @cap-queue
  Scenario: Return a queued item to the editor
    Given session "main" has a queued item with text
    When I return that queued item to the editor
    Then the composer contains the queued text
    And the item leaves the queue
    And the agent receives that text only when I send it, exactly once
    # Conflicts with a newer composer draft (replace or merge) are not yet canonical.
    # A rejected removal is @ux-shared-032.

  @queue @remove @reorder @scope @ux-shared-018 @cap-queue
  Scenario: Reorder and remove by durable identity
    Given session "main" has three queued items and an unsent composer draft
    When I move one queued item up by one position
    Then only that item's position changes, also after a reload
    When I remove one queued item
    Then only that item leaves the queue and it is never delivered
    And the remaining items are delivered in their queued order
    And no other session or composer draft changes
    # A rejected removal is @ux-shared-032.

  @queue @steer @safety-deviation @ux-shared-019 @cap-queue @cap-steer
  Scenario: Steer a queued item into the matching active run
    Given session "main" has a matching active run and queued item
    When I activate Steer twice
    Then the item leaves the queue
    And the agent receives it exactly once, in session "main" only
    # A rejected Steer is @ux-shared-032.

  @model-picker @pointer @keyboard @ux-shared-020 @cap-model-picker
  Scenario Outline: Search and select a model authoritatively
    Given two models are available
    And the composer has unsent text
    When I open the model picker using <input>
    And I search for and select the second model
    Then the picker closes and session "main" shows the second model
    And the next turn in "main" uses the second model, also after a reload
    And session "research" still uses the default model
    And composer content is unchanged

    Examples:
      | input    |
      | pointer  |
      | keyboard |

  @session-picker @model-picker @typeahead @keyboard @capability @ux-shared-021 @cap-model-picker @cap-session-picker @cap-slash-commands
  Scenario Outline: Find and activate picker entries without changing unsupported state
    Given the <picker> contains multiple authoritative entries with similar names
    When I search by native identifier, display name or capability metadata
    Then only matching entries remain in native grouped order
    When focus leaves the search field and I type a printable unmodified prefix
    Then incremental typeahead highlights the prefix match before substring matches
    And Arrow keys, Home, End, PageUp and PageDown move within enabled results
    And Enter activates the highlighted enabled entry exactly once
    And Escape closes the picker and restores focus without changing selection
    And unavailable mutations or models remain absent or disabled rather than simulated

    Examples:
      | picker         |
      | session picker |
      | model picker   |

  @model-picker @failure @race @truthful-ui @ux-shared-022 @cap-model-picker
  Scenario: Reject stale or unsupported model state
    Given a model switch is pending for session "main"
    When I switch to session "research"
    Then the late response cannot change the "research" model label
    And a rejected switch retains the prior model and composer draft
    And thinking appears only for advertised support
    And unknown context remains unavailable
    And local token estimates are labelled estimates
    And compaction is actionable only when natively supported

  @turn @reconnect @scope @ux-shared-023 @cap-reconnect @cap-stop
  Scenario: Cancel the captured active turn across reconnect
    Given a busy turn has captured session, turn and runtime owner
    When SSE disconnects and reconnects
    Then busy state is refreshed without changing ownership
    When I activate the distinct stop control
    Then only that captured turn is cancelled
    And composer and queue are preserved
    And a stale terminal event cannot stop a newer turn

  @timeline @copy @delete @pointer @keyboard @failure @ux-shared-024 @cap-message-delete
  Scenario: Copy and delete timeline messages through native actions
    Given the timeline contains user and assistant Markdown with a code block
    Then each deletable message exposes an accessible Delete message action
    And each copyable message exposes an accessible Copy message action
    And each code block exposes its own Copy code action
    When I copy the message or code block
    Then the clipboard receives original stored Markdown or code rather than rendered HTML
    And success or failure glyphs are announced and return to idle after the native timeout
    When native deletion rejects or accepts the captured message ID
    Then only that message remains or is removed according to the authoritative response
    And no other session, message reference or composer draft changes

  @messages @model @range @scope @failure @ux-shared-025 @cap-messages-tool
  Scenario: Let the model identify bounded ranges of persisted messages
    Given session "main" contains ordered persisted messages with durable numeric IDs
    When the model requests multiple explicit message IDs with context before and after
    Then the native messages tool returns them in timeline order with bounded surrounding rows
    And missing IDs are reported without substituting another session's content
    When the model requests an after-row or before-row window with a bounded limit
    Then only messages inside that current-session window are returned
    And content and result counts are bounded and pagination metadata is truthful
    And quoted message content is data rather than new instructions

  @attachments @failure @ux-shared-026 @cap-attachments @cap-upload-cancel
  Scenario: Retry attachment delivery without duplication
    Given upload or paste shows one native progress control
    When I cancel and retry the selected file
    Then cancellation prevents send and retains the draft
    And retry delivers one durable media item to the active destination
    And it survives reload and source removal

  @tools @pane @glyph @timer @reconnect @accessibility @ux-shared-027 @cap-reconnect @cap-tool-output
  Scenario: Present tool execution lifecycle in the native tool pane
    Given the captured turn emits a tool call with a durable tool-call ID and start time
    When I open its tool pane using pointer or keyboard
    Then focus reaches the pane and its disclosure state is announced
    And the running glyph, tool name, arguments and elapsed timer are visible
    And the elapsed label advances from the authoritative start time at the native cadence
    When the matching result succeeds, fails or is cancelled
    Then the corresponding terminal glyph and accessible label replace the running glyph
    And the timer freezes at the authoritative terminal duration
    And stale or duplicate events cannot alter a newer tool call with the same display name
    And reconnect or reload reconstructs the same lifecycle from persisted events
    And closing the pane restores usable focus without activating underlying controls
    And reduced-motion mode preserves state meaning without requiring animation

  @timeline @svg @security @accessibility @ux-shared-028
  Scenario: Model-generated SVG cannot run code or fetch resources
    Given an assistant message contains a fenced "svg" block with a script, an event handler and an external image reference
    Then no script runs and the external reference is not fetched
    And the SVG source remains visible as inert text
    And ordinary raw HTML remains escaped

  @copy @speech @capability @ux-shared-029 @cap-read-aloud
  Scenario: Copy and read assistant content truthfully
    When I copy an assistant code block
    Then the clipboard receives original stored text rather than highlighted HTML
    And read aloud is shown only when the browser and assistant text support it
    And starting another post transfers speech ownership
    And stale completion callbacks do nothing

  @queue @steer @idle @ux-shared-030 @cap-queue @cap-steer @cap-steer-idle
  Scenario: Steer a queued item while no run is active
    Given session "main" is idle and has a queued item
    When I activate Steer for that item
    Then the queued item is delivered to session "main" exactly once
    And it leaves the queue

  @queue @failure @ux-shared-032 @cap-queue
  Scenario Outline: A rejected queue action keeps the item recoverable
    Given session "main" has a running turn and a queued item
    When the runtime rejects <action> for that item
    Then a failure is shown
    And the item is back in the follow-up stack without a reload
    And the agent receives the item at most once

    Examples:
      | action                |
      | returning to editor   |
      | cancelling            |
      | steering              |

  @timeline @copy @fidelity @ux-shared-033
  Scenario Outline: Text shown and copied matches what was written
    Given a <author> post contains Markdown and a fenced code block with angle brackets such as "a < b && c > d"
    Then the code block shows that text exactly
    And Copy code puts exactly that text on the clipboard
    And Copy message puts the Markdown as written on the clipboard, with no HTML entities

    Examples:
      | author    |
      | user      |
      | assistant |

  @timeline @svg @accessibility @ux-shared-031 @cap-svg-render
  Scenario: Render safe model-generated SVG as an isolated image
    Given an assistant message contains a fenced "svg" block with safe vector geometry and a title
    Then the timeline displays it as an image with an accessible title that fits the message width
    And no inline SVG element from the message is inserted into the page
    And the SVG source remains available to copy
