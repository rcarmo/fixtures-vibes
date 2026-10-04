@classic @keychain
Feature: Keychain and shell secret substitution
  Every runtime keeps a Piclaw-like keychain: named, encrypted credentials managed from Settings and made available to
  the agent's shell by the same substitution rules. These scenarios carry no keychain capability tag; a runtime that
  cannot pass one records it as a defect, not a skip. The Settings section may be simpler than Piclaw's and look
  different: only the behaviour below is required, not its layout, wording or extra columns.

  Rule: Environment variable names derive from entry names
    An entry name that is already a shell identifier ([A-Za-z_][A-Za-z0-9_]*) is its variable name, unchanged. Any other
    name maps by turning each run of "/", "-" or "." into "_", dropping any other character outside A-Z, a-z, 0-9 and
    "_", and upper-casing. A name that maps to nothing, or to something that starts with a digit, has no shell variable.
    The full detection, retrieval and expansion rules are in shell-environment/shell-environment.feature.

  Background:
    Given I am authenticated and on the main chat in the Classic shell

  @ux-keychain-001 @cap-settings-dialog
  Scenario: Add a credential from Settings
    Given the keychain section of Settings is open
    When I add an entry with a name, a secret and an optional username
    Then the entry is listed by its name
    And its secret is not shown

  @ux-keychain-002 @cap-settings-dialog
  Scenario: Keep keychain entries across sessions
    Given I added an entry
    When I reload the page and open the keychain section again
    Then the entry is still listed
    And its secret is still not shown

  @ux-keychain-003 @cap-settings-dialog
  Scenario: Reveal a secret only on request
    Given an entry exists
    Then its secret is hidden until I ask to reveal that entry
    And if the runtime protects reveal with a master password or another factor, it asks for it first
    When the reveal succeeds
    Then that entry's secret is shown, and no other entry's secret is

  @ux-keychain-004 @cap-settings-dialog
  Scenario: Delete an entry after confirming
    Given an entry exists
    When I choose to delete it
    Then I am asked to confirm
    When I decline
    Then the entry is kept
    When I delete it again and confirm
    Then the entry is no longer listed

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
