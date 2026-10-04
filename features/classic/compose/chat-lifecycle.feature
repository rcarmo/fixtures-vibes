@classic @chat-lifecycle
Feature: Separate the conversation from transient agent activity
  # Oracle: installed Piclaw 3.2.4 event translator and shipped Classic UI.
  # Conversation/idle fixes have bounded native coverage; none is fully mapped.
  # Error persistence, provider recovery and physical-device acceptance need
  # backend and device evidence beyond this bounded rendering probe.

  @ux-chat-lifecycle-001 @idle
  Scenario: An idle chat does not manufacture an activity pane
    Given the selected chat has an authoritative idle snapshot with no active status data
    And there are no transient previews, requests or extension panels
    When the Classic chat opens or reloads
    Then the conversation and composer remain visible
    And there is no agent activity pane saying Idle or Working
    And a previous tool completion does not become a persistent Completed footer

  @ux-chat-lifecycle-002 @streaming @thoughts @draft @cap-thoughts
  Scenario: Streaming thoughts and response drafts have separate panes
    Given a selected chat contains the user's submitted prompt
    When its current turn streams thinking text and assistant response text
    Then the Thoughts pane contains the thinking text
    And the Draft pane contains the response text
    And the current phase says Writing response
    And these previews do not become extra user messages in the timeline
    And internal tool-call markers are not inserted into the response text

  @ux-chat-lifecycle-003 @tools @output @cap-tool-output
  Scenario: Tool output belongs to the Output status pane
    Given a tool starts with a call identity and arguments in the selected turn
    When a tool execution update supplies text output
    Then the Output pane displays the supplied preview using Classic's tool-output renderer
    And the activity status identifies the tool while the Output pane is shown
    And raw tool-result records do not appear as conversation posts
    And tool output is never attributed to the user
    # Preserve Classic's renderer, including its output trimming and Markdown
    # rules; this does not require plain preformatted text or identical bytes.

  @ux-chat-lifecycle-004 @author @markdown
  Scenario: A persisted assistant reply retains its identity and Markdown
    Given the conversation contains a user prompt and a persisted assistant response
    When the timeline renders the messages
    Then the user prompt uses the user name and avatar
    And the assistant response uses the assistant name and avatar
    And the assistant response has agent-post presentation
    And Markdown emphasis and list items render as emphasis and list items
    And the persisted assistant response is not attributed to the user

  @ux-chat-lifecycle-005 @error @cap-tool-output
  Scenario: A terminal provider error is not a user input or a tool success
    Given the current turn has streamed previews and completed a tool
    When the provider fails and the agent emits a terminal error status
    Then the error has an agent error presentation rather than a user post
    And the current turn's draft and thought previews are cleared
    And there is no Completed tool footer standing in for the failed turn
    When the chat reloads with an authoritative idle snapshot
    Then it does not recreate an active or completed tool pane
    # This scenario does not prescribe how a durable error notice is stored.
    # The probe verifies transient status and idle reload, not error persistence.

  @ux-chat-lifecycle-006 @stream @draft
  Scenario: A streaming draft keeps every chunk in order
    Given the agent streams its response in several chunks and then pauses
    Then the Draft pane shows every chunk received so far, in order, not only the latest
    And the final reply contains all chunks in the same order

  @ux-chat-lifecycle-007 @scope @concurrency
  Scenario: A running turn in one session does not leak into another
    Given session "main" has a turn that is streaming a draft and then pauses
    When session "research" is open in another tab and completes a turn
    Then the "research" tab shows its own reply and no draft, status or Stop control from "main"
    And the "main" tab still shows its own draft and not the "research" reply
    And when the "main" turn finishes, its reply appears only in "main"

  @ux-chat-lifecycle-008 @tools @timer @cap-tool-output
  Scenario: A running tool shows what it is doing and for how long
    Given the agent calls a shell tool that takes several seconds
    Then the agent status shows the tool name and its arguments while it runs
    And an elapsed time counted from when the tool started, which advances
    When the tool finishes and the agent replies
    Then the running-tool status is gone

  @ux-chat-lifecycle-009 @scope @concurrency
  Scenario: Sessions run turns at the same time
    # Mandatory for every runtime: Piclaw 3.2.5 runs each session's turns independently. A runtime-wide "one active
    # session" guard is a defect, not a capability choice.
    Given session "a" has a turn waiting on the model
    When I send a message in session "b"
    Then session "b"'s turn also reaches the model while "a" is still waiting, without an error or a block on sending
    And a message sent in session "c" meanwhile is answered
    When the model answers "b" first
    Then "b" shows its reply while "a" is still running
    And when the model then answers "a", its reply appears only in "a"
