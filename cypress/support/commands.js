// ***********************************************
// This example namespace declaration will help
// with Intellisense and code completion in your
// IDE or Text Editor.
// ***********************************************
// declare namespace Cypress {
//   interface Chainable<Subject = any> {
//     customCommand(param: any): typeof customCommand;
//   }
// }
//
// function customCommand(param: any): void {
//   console.warn(param);
// }
//
// NOTE: You can use it like so:
// Cypress.Commands.add('customCommand', customCommand);
//
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

Cypress.Commands.add('login', () => {
  cy.request('GET', 'http://localhost:3000/auth/test-token').then((resp) => {
    const { token, user } = resp.body;
    cy.window().then((win) => {
      if (win.mockAuth) {
        win.mockAuth(user, token);
      } else {
        win.localStorage.setItem('auth_token', token);
        win.localStorage.setItem('auth_user', JSON.stringify(user));
      }
    });
  });
});

/**
 * Seeds a fresh, known logbook entry for each test.
 * Cleans up any existing test data first so tests are fully independent.
 * Yields the authToken for tests that need to make direct API calls.
 */
Cypress.Commands.add('seedLogbookEntry', (overrides = {}) => {
  cy.request('GET', 'http://localhost:3000/auth/test-token').then((resp) => {
    const authToken = resp.body.token;

    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data').then(() => {
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/post-data',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          username: 'Stillworld',
          level: 40,
          distanceWalked: 1000,
          caught: 5000,
          stopVisited: 2000,
          totalXp: 20000000,
          entryName: 'Test Entry',
          ...overrides
        }
      });
    });
  });
});
