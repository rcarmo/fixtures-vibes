@classic @shell-environment
Feature: Shell detection, variable expansion and environment settings
  The agent's shell tool behaves exactly like Piclaw 3.2.5 (runtime/src/tools/tracked-bash.ts, secure/keychain.ts,
  secure/shell-secrets.ts, environment-overrides.ts): it detects which shell to run, gives every command the runtime's
  environment plus Settings overrides, and adds keychain secrets only for the variables the command text references.
  Keychain entries are retrieved (decrypted) only when a command references their variable or placeholder; a command
  that references none reads no secret. Management of the keychain itself is in keychain/keychain.feature.
  Scenarios without @cap-windows-shell are mandatory for every runtime.

  Rule: Shell detection
    A configured shell path (Piclaw: the shellPath setting) wins and is run as a POSIX shell; if that file does not exist
    the command fails with an error naming it. Otherwise:
    - on POSIX hosts the candidates are $SHELL (when it names an existing file), /bin/bash, then bash on PATH;
    - on Windows they are $SHELL (when it names an existing file, run as POSIX, e.g. Git Bash), PowerShell 7
      (C:\Program Files\PowerShell\7\pwsh.exe), Windows PowerShell (…\WindowsPowerShell\v1.0\powershell.exe), pwsh.exe,
      powershell.exe, %ComSpec%, then cmd.exe.
    POSIX shells run `<shell> -c <command>`, PowerShell `-NoProfile -Command <command>`, cmd `/c <command>`. A
    candidate that cannot be started (not found) is skipped for the next one; the error lists every shell tried.

  Rule: Variable references
    Before a command runs, its text is scanned for variable references in all four syntaxes, whatever the shell:
    $env:NAME, ${NAME}, $NAME and %NAME%, where NAME is [A-Za-z_][A-Za-z0-9_]*. Matching is textual and
    case-sensitive: quoting, comments or the shell's own expansion rules do not matter. Each referenced NAME that is a
    keychain variable is added to the command's environment with that entry's secret; nothing else is retrieved.
    A keychain value never replaces a variable the environment already has.

  Rule: Keychain variable names
    An entry whose name is already a shell identifier ([A-Za-z_][A-Za-z0-9_]*) uses its name unchanged, case included.
    Any other name maps by turning each run of "/", "-" or "." into "_", dropping any other character outside
    [A-Za-z0-9_] and upper-casing; a result that is empty or starts with a digit gives no variable. When two entries map
    to the same variable, the entry whose name sorts first (byte order) provides it.

  Rule: Keychain placeholders
    keychain:<name> in the command text is replaced by the entry's secret before the shell sees it; keychain:<name>:username
    (or :user) by its username; :secret, :password and :token by its secret. A placeholder runs over the characters
    [A-Za-z0-9._/:-] and ends at the first other character. A placeholder naming a missing entry, or asking for the
    username of an entry without one, fails the command with an error and the command does not run.

  Rule: Environment settings
    Settings has an Environment section listing the runtime's environment variables (keychain variables excluded) with
    their values. Adding or editing a value stores an override that applies to every later command at once and survives
    reloads and restarts; clearing it restores the inherited value, or removes the variable if none was inherited.
    Names must be shell identifiers, and keychain variable names cannot be overridden. The section may be simpler than
    Piclaw's and look different.

  Background:
    Given I am authenticated and on the main chat in the Classic shell

  @ux-shell-env-001
  Scenario: Run commands in the detected POSIX shell
    Given the runtime runs on a POSIX host with no configured shell path
    When the agent runs a shell command
    Then it runs in $SHELL when that names an existing file, and in bash otherwise

  @ux-shell-env-002 @cap-windows-shell
  Scenario: Run commands in the detected Windows shell
    Given the runtime runs on Windows with no configured shell path and no usable $SHELL
    When the agent runs a shell command
    Then it runs in PowerShell (pwsh before Windows PowerShell), or in cmd when no PowerShell can be started

  @ux-shell-env-003
  Scenario: Detect variable references in every syntax
    Given a keychain entry whose variable is NAME
    When the agent runs a command whose text mentions NAME only as $env:NAME, as %NAME% or inside single quotes as '$NAME'
    Then the command's environment has NAME set to the entry's secret
    But a reference that differs only in case does not inject it

  @ux-shell-env-004
  Scenario: Retrieve only the referenced keychain entries
    Given several keychain entries
    When the agent runs a command that references exactly one of their variables
    Then only that entry's variable is in the command's environment
    When the agent runs a command that references none
    Then no keychain variable is in its environment

  @ux-shell-env-005
  Scenario: Name keychain variables exactly like Piclaw
    Given keychain entries named "fixtures_lower_<id>", "fixtures/kcc-<id>" and "fixtures.kcc.<id>"
    Then "$fixtures_lower_<id>" injects the first entry, with its name unchanged
    And "$FIXTURES_KCC_<ID>" injects the "fixtures.kcc.<id>" entry, which sorts before "fixtures/kcc-<id>"

  @ux-shell-env-006
  Scenario: Fail a command whose keychain placeholder cannot be resolved
    When the agent runs a command containing keychain:<name> for an entry that does not exist
    Then the tool reports an error and the command does not run
    When the agent runs a command containing keychain:<name>:username for an entry without a username
    Then the tool reports an error and the command does not run

  @ux-shell-env-007 @cap-windows-shell
  Scenario: Expand keychain variables in PowerShell
    Given a keychain entry whose variable is NAME and the detected shell is PowerShell
    When the agent runs a command reading $env:NAME
    Then it sees the entry's secret, and keychain:<name> placeholders are replaced as in any shell

  @ux-shell-env-008 @cap-settings-dialog
  Scenario: Override an environment variable from Settings
    Given the Environment section of Settings is open
    Then it lists the runtime's environment variables, such as PATH
    When I add the variable FIXTURES_ENV_<id> with a value
    Then a shell command run afterwards sees that value
    When I change the value
    Then the next shell command sees the new value
    When I clear the override
    Then the next shell command no longer has the variable

  @ux-shell-env-009 @cap-settings-dialog
  Scenario: Keep environment overrides across reloads
    Given I added an environment override
    When I reload the page and open the Environment section again
    Then the override is still listed with its value

  @ux-shell-env-010 @cap-settings-dialog
  Scenario: Keep keychain variables out of the Environment section
    Given a keychain entry whose variable is NAME
    Then the Environment section does not list NAME
    When I try to add an environment override named NAME
    Then it is refused, and a command referencing $NAME still gets the keychain secret
