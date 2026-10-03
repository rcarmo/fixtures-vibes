@classic
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

    @ux-timeline-018 @oracle-defect @cap-message-delete
    Scenario: Direct deletion with an unseen stored reply leaves that reply behind
      Given a parent appears to have no replies in the loaded timeline view
      And the installed backend has a stored reply to that parent
      When I click the delete button on the parent
      Then the client requests direct deletion without a cascade prompt
      And the backend returns only the parent ID as deleted
      And the parent's row is removed while the stored reply retains its thread ID
      # Not a compliance requirement. Documents a Piclaw 3.2.5 orphaning risk:
      # a non-cascade delete of a parent removes only the parent and the stored
      # reply keeps its thread ID (checked through the public API in rc.11).
      # Classic always loads a parent's replies with it, so the "unseen reply"
      # precondition cannot be built through the UI and no spec covers this ID.

    @ux-timeline-019 @conditional-fixture @cap-message-delete
    Scenario: A synthetic Replies exist rejection exposes the otherwise dormant retry prompt
      Given a message with no visible replies
      And the suite rejects the first deletion request with the error "Replies exist"
      When I click the delete button on the message
      Then the Classic UI asks "Delete this message and its replies?"
      And cancelling leaves the message in place, also after a reload
      And deleting again and confirming removes the message, also after a reload
      # Piclaw 3.2.5 never sends this rejection itself; the suite injects it in
      # the browser to exercise the client branch.

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
