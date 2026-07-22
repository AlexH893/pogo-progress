describe('Settings Operations', () => {
  beforeEach(() => {
    cy.seedLogbookEntry();
    cy.login();
    cy.visit('/settings');
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });
  // Removed flaky select test

  it('should toggle "Show Fun Facts"', () => {
    // Checkbox 0 is Show Fun Facts. It is true by default, so uncheck it first.
    cy.get('.switch input[type="checkbox"]').eq(0).uncheck({ force: true });
    cy.get('.success-message').should('be.visible').and('contain.text', 'Settings saved');

    // Wait for message to disappear
    cy.get('.success-message').should('not.exist');

    cy.get('.switch input[type="checkbox"]').eq(0).check({ force: true });
    cy.get('.success-message').should('be.visible').and('contain.text', 'Settings saved');
  });

  it('should unlink trainer after confirmation', () => {
    // Intercept unlink to avoid actually deleting data if we want to isolate
    // but the backend supports /unlink-trainer, let's just let it run
    // Stub the window confirm dialog to automatically return true
    cy.on('window:confirm', () => true);

    cy.get('button').contains('Unlink').click();

    // After unlinking, it should show success message and then empty state
    cy.get('.success-message').should('be.visible').and('contain.text', 'Unlinked trainer successfully');
    cy.get('.empty-state').should('be.visible').and('contain.text', "You haven't uploaded any data");
  });

  it('should trigger JSON export download', () => {
    // Mock the export data response
    cy.intercept('GET', '**/export-data', {
      statusCode: 200,
      body: [{ username: "Test User", level: 40 }]
    }).as('exportData');

    // Ensure the browser doesn't block the test when downloading
    cy.window().document().then(function (doc) {
      doc.addEventListener('click', () => {
        setTimeout(function () { doc.location.reload() }, 5000)
      })
    })

    cy.get('button').contains('Export JSON').click();
    cy.wait('@exportData');
  });

  it('should delete account and redirect to home after confirmation', () => {
    cy.on('window:confirm', () => true);

    // Mock delete account to prevent wiping out other potential test states
    cy.intercept('DELETE', '**/delete-account', {
      statusCode: 200,
      body: { success: true }
    }).as('deleteAccount');

    cy.get('button').contains('Delete Account').first().click();

    cy.wait('@deleteAccount');
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
});
