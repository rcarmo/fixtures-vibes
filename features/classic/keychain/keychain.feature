@classic @keychain
Feature: Keychain and shell secret substitution
  Every runtime keeps a Piclaw-like keychain: named, encrypted credentials managed from Settings and made available to
  the agent's shell by the same substitution rules. These scenarios carry no capability tag; a runtime that cannot
  pass one records it as a defect, not a skip.

  Rule: Environment variable names derive from entry names
    An entry name maps to one shell variable name: each run of "/", "-" or "." becomes "_", any other character outside
    A-Z, a-z, 0-9 and "_" is dropped, and the result is upper-cased. A name that maps to nothing, or to something that
    starts with a digit, has no shell variable.

  Background:
    Given I am authenticated and on the main chat in the Classic shell

  @ux-keychain-001 @cap-settings-dialog
  Scenario: Add a credential from the Keychain settings section
    Given the Keychain section of Settings is open
    When I add an entry with a name, a type (secret, token, password or basic), a secret, an optional username and notes
    Then the entry is listed with its name, its type, the shell variable it injects and when it was updated
    And the section reports how many entries it holds, encrypted at rest
    And the secret itself is not shown

  @ux-keychain-002 @cap-settings-dialog
  Scenario: Filter keychain entries
    Given the keychain holds several entries
    When I type part of an entry name into the Keychain filter
    Then only matching entries are listed and the count reports the matches for that filter
    And a filter that matches nothing says so

  @ux-keychain-003 @cap-settings-dialog
  Scenario: Reveal a secret only after unlocking
    Given an entry exists
    When I reveal its secret
    Then the section asks for the keychain master password (or another configured factor) before showing anything
    When I unlock with the correct password
    Then that entry's secret is shown with a copy action, and no other entry's secret is shown
    And I can hide it again

  @ux-keychain-004 @cap-settings-dialog
  Scenario: Delete an entry after an inline confirmation
    Given an entry exists
    When I choose to delete it
    Then the section asks for confirmation on that row
    When I decline
    Then the entry is kept
    When I delete it again and confirm
    Then the entry is no longer listed and the count drops by one

  @ux-keychain-005
  Scenario: Inject a credential into a shell command that names its variable
    Given an entry whose name maps to a shell variable
    When the agent runs a shell command whose text contains that variable as $NAME or ${NAME}
    Then the command sees the entry's secret in that variable
    # Shells with other syntaxes use their own literal reference: $env:NAME in PowerShell, %NAME% in cmd.

  @ux-keychain-006
  Scenario: Inject only what the command text names
    Given several entries exist
    When the agent runs a shell command that does not name an entry's variable literally
    Then that entry's secret is not in the command's environment
    And dynamic lookups (indirect expansion, printenv, env enumeration) do not request injection

  @ux-keychain-007
  Scenario: Substitute keychain placeholders in command text
    Given an entry with a secret and a username
    When the agent runs a shell command containing keychain:<name>
    Then the placeholder is replaced by the entry's secret
    And keychain:<name>:username (or :user) is replaced by its username
    And keychain:<name>:secret, :password or :token are replaced by its secret
