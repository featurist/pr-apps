@localOnly
Feature: Configure Pr App environment, resources, routes, etc.

  Scenario: Add environment variables to new pr app
    Given Frank's app needs environment variables "FOO=bar" and "STUFF=1"
    When Frank adds configuration file specifying extra environment
    And Frank opens a new pull request
    Then Frank's pr app has those environment variables set

  Scenario: Add routes to new pr app
    Given Frank's app has a microservice that needs to be accessible from the main service
    When Frank adds configuration file specifying a route to the microservice
    And Frank also sets an environment variable for the main service to address the microservice
    And Frank opens a new pull request
    Then Frank's main service can reach the microservice
