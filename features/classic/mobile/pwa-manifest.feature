@classic @pwa
Feature: PWA manifest and home screen icon responses
  Home-screen installation itself is browser-controlled.

  @ux-pwa-001 @cap-pwa
  Scenario: Serve a manifest with declared application icons
    When I fetch the manifest linked from the application page
    Then the response describes the application name and icons
    And icon records contain source, sizes, type and purpose fields
    And the declared sizes include 192x192 and 512x512
    And every declared icon source is served as an image

  @ux-pwa-002 @cap-pwa @cap-agent-avatar
  Scenario: Use configured agent-avatar URLs for manifest icons
    Given the agent avatar is set to a PNG image
    When the manifest is fetched
    Then its icons are no longer the default icons
    And each icon URL serves a PNG at its declared size, including 192x192 and 512x512
    When the avatar is cleared
    Then the manifest lists the default icons again

  @ux-pwa-003 @cap-pwa
  Scenario: Fall back to static icons without an avatar
    Given no agent avatar is configured for manifest use
    When I fetch the manifest
    Then static application icons are declared instead of a missing avatar URL
    And each declared icon is a PNG of its declared size

  @ux-pwa-004 @cap-pwa
  Scenario Outline: Request sized Apple touch icons
    When I request <path>
    Then the response is a PNG image of <size> by <size> pixels
    And it is the agent avatar when one is configured, otherwise the static icon

    Examples:
      | path                           | size |
      | /apple-touch-icon-180x180.png  | 180  |
      | /apple-touch-icon-167x167.png  | 167  |
      | /apple-touch-icon-152x152.png  | 152  |
      | /apple-touch-icon.png          | 180  |

  @ux-pwa-005 @cap-pwa
  Scenario: Prefer PNG avatars for favicon compatibility
    When I request /favicon.ico
    Then the response is an image
    And it is a PNG agent avatar when one is configured, otherwise the static favicon

  @ux-pwa-006 @cap-pwa @cap-agent-avatar
  Scenario: Vary avatar icon cache URLs with the avatar version
    Given the agent avatar is set to one PNG image
    When it is changed to a different PNG image
    Then every manifest icon URL changes
    And the icons served at the new URLs differ from the previous ones
