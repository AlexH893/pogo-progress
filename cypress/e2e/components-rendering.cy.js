describe('Components Rendering', () => {

  beforeEach(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
    cy.intercept('POST', '**/post-data').as('postData');
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  it('should display the fun fact component and allow shuffling', () => {
    cy.login();
    cy.visit('/');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item', { timeout: 10000 }).should('have.length', 5);

    cy.get('app-fun-fact').scrollIntoView().should('be.visible');
    cy.get('app-fun-fact .fun-fact-content p').should('not.be.empty');

    // Get initial text
    cy.get('app-fun-fact .fun-fact-content p').invoke('text').then((initialText) => {
      // Click shuffle
      cy.get('app-fun-fact .edit-btn').scrollIntoView().click();
      // Should show a loading state or different text
      cy.get('app-fun-fact .fun-fact-content p').invoke('text').should('not.equal', initialText);
    });
  });


    cy.seedLogbookEntry({ entryName: 'Entry 1', totalXp: 10000000 });
    cy.seedLogbookEntry({ entryName: 'Entry 2', totalXp: 11000000 }); // Seed overrides the previous one because it deletes first?
    // Let's use the API directly to add a second one after seeding
    cy.request('GET', 'http://localhost:3000/auth/test-token').then((resp) => {
      const authToken = resp.body.token;
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/post-data',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          username: 'Stillworld',
          level: 40,
          distanceWalked: 1200,
          caught: 1200,
          stopVisited: 2100,
          totalXp: 11000000,
          entryName: 'Entry B'
        }
      });
    });

    cy.login();
    cy.visit('/logbook');

    // Check chart
    cy.get('.logbook-chart-section').scrollIntoView().should('be.visible');
    cy.get('app-progress-chart canvas').scrollIntoView().should('be.visible');
  });

});
