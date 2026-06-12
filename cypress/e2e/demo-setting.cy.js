describe('Demo Setting Toggle', () => {
  let authToken;

  beforeEach(() => {
    cy.request('GET', 'http://localhost:3000/auth/test-token').then((resp) => {
      authToken = resp.body.token;
      
      cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
      
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/post-data',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          username: 'CypressTestUser',
          level: 40,
          distanceWalked: 1000,
          caught: 5000,
          stopVisited: 2000,
          totalXp: 20000000,
          entryName: 'Test Entry'
        }
      });

      cy.login();
    });
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  it('should toggle the Play Demo button visibility', () => {
    // Note: The first upload automatically sets 'display_tutorial' to false in the database.
    // Check initial state on home page (should be hidden)
    cy.visit('/');
    cy.get('.demo-btn').should('not.exist');

    // Go to settings and toggle ON
    cy.visit('/settings');
    // The first checkbox is 'show_fun_facts', the second is 'display_tutorial' (Demo & Tutorial)
    cy.get('.switch input[type="checkbox"]').eq(1).check({ force: true });
    cy.get('.success-message').should('be.visible').and('contain.text', 'Settings saved');

    // Go back to home and check it's visible
    cy.visit('/');
    cy.get('.demo-btn').should('exist').and('be.visible');

    // Go back to settings and toggle OFF
    cy.visit('/settings');
    cy.get('.switch input[type="checkbox"]').eq(1).uncheck({ force: true });
    cy.get('.success-message').should('be.visible').and('contain.text', 'Settings saved');

    // Go back to home and check it's hidden again
    cy.visit('/');
    cy.get('.demo-btn').should('not.exist');
  });
});
