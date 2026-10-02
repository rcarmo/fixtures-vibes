@classic @piclaw-3.2.4 @source-reviewed
Feature: Message deletion from timeline
  The installed Piclaw reference counts replies in the loaded view before prompting.
  Direct deletion does not guard against replies outside that view.

  Background:
    Given I am authenticated and on the main chat
    And the timeline contains messages

  Rule: Direct deletion follows the loaded timeline view
    @ux-timeline-017 @cap-message-delete
    Scenario: Delete a single message without visible replies
      Given a message with no visible thread replies exists
      When I click the delete button on that message
      Then the message is removed from the timeline without a confirmation prompt
      And refreshing the page should not show the deleted message

    @ux-timeline-018 @oracle-mismatch @cap-message-delete @reconcile-3.2.5
    Scenario: Direct deletion with an unseen stored reply leaves that reply behind
      Given a parent appears to have no replies in the loaded timeline view
      And the installed backend has a stored reply to that parent
      When I click the delete button on the parent
      Then the client requests direct deletion without a cascade prompt
      And the backend returns only the parent ID as deleted
      And the parent's row is removed while the stored reply retains its thread ID
      # Joined disposable UI/backend-function evidence; production HTTP/auth
      # and live deletion remain unverified. This is a known orphaning risk.

    @ux-timeline-019 @conditional-fixture @cap-message-delete @reconcile-3.2.5
    Scenario: A synthetic Replies exist rejection exposes the otherwise dormant retry prompt
      Given a parent appears to have no replies in the loaded timeline view
      And a disposable API fixture rejects direct deletion with "Replies exist"
      When I click the delete button on the parent
      Then the Classic UI asks whether to delete it and its replies
      And confirming retries with cascade enabled
      And cancelling makes no cascade request and leaves the parent visible
      # Installed Piclaw 3.2.4 direct deletion does not emit this rejection.
      # This tests a conditional UI branch, not a normal backend journey.

  Rule: Visible thread replies require explicit cascade confirmation
    @ux-timeline-020 @cap-message-delete
    Scenario: Deleting a message with visible replies asks for cascade confirmation
      Given a message that has N visible thread replies exists
      When I click the delete button on the parent message
      Then a confirmation prompt should ask "Delete this message and its N replies?"

    @ux-timeline-021 @cap-message-delete
    Scenario: Confirming cascade deletes the parent and visible replies together
      Given a message that has visible thread replies exists
      When I click the delete button on the parent message
      And I confirm the cascade prompt
      Then the parent and its visible replies are removed together
      And refreshing the page shows neither of them

    @ux-timeline-022 @cap-message-delete
    Scenario: Cancelling cascade preserves the parent and visible replies
      Given a message that has visible thread replies exists
      When I click the delete button on the parent message
      And I cancel the cascade prompt
      Then the parent message should remain visible
      And its visible thread replies should remain visible
