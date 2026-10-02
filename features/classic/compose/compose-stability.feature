@classic @piclaw-3.2.4 @source-reviewed
Feature: Classic composer draft and queue behavior
  The installed Piclaw reference release is the oracle.

  @ux-compose-001
  Scenario: Clear captured content while allowing a new draft
    Given the composer contains text and references
    When I submit the draft
    Then the displayed draft clears while the submitted turn is still in flight
    And text typed afterwards belongs to the new draft and survives the reply

  @ux-compose-002
  Scenario: Restore a failed submission alongside newer text
    Given a submitted draft is being sent in the background
    And I have typed a different new draft
    When that submission fails
    Then the composer holds the failed text, a blank line, then the newer text
    And if the newer text equals the failed text it is not duplicated
    And the failure is shown as an alert in the composer
    And no post appears in the timeline and no turn starts
    # Reference merging is not asserted: Classic has no portable way to add
    # references before a send, so only text restoration is in the contract.

  @ux-compose-003
  Scenario: Reject an entirely empty submission
    Given there is no non-whitespace text, media or file, folder or message reference
    When I submit the composer
    Then no message is posted and no turn starts

  @ux-compose-004 @cap-queue
  Scenario: Return a queued message replaces the current editor draft
    Given a queued follow-up is waiting behind a running turn
    And the composer contains a newer unsent draft, an attachment and a failure alert
    When I return the queued item to the editor
    Then the composer text is replaced by the queued text
    And the attachment and the alert are cleared
    And the queued item leaves the follow-up stack
    And the text area has focus with the cursor at the end of the text

  @ux-compose-005 @cap-attachments
  Scenario: Keep upload progress separate from sending state
    Given a draft includes a file attachment
    When I submit it and the upload is still in progress
    Then the composer shows an upload status naming the file with a progress bar
    And the send button is disabled and labelled as uploading attachments
    When the upload completes and the message request is still in flight
    Then the upload status is gone
    And the send button is disabled and labelled as sending the message

  @ux-compose-006 @cap-attachments @cap-session-picker
  Scenario: Submit captures the destination chat
    Given a draft with an attachment is submitted in one session
    And I switch to another session while the upload is still in progress
    When the upload finishes
    Then the message is delivered to the session where it was submitted
    And it does not appear in the session that is now selected
