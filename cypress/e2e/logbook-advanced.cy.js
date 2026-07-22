describe('Logbook Advanced Features', () => {
  beforeEach(() => {
    const now = new Date();
    const olderDate = new Date(now.getTime() - 100000).toISOString();
    const newerDate = new Date(now.getTime()).toISOString();

    // Seed first entry (older)
    cy.seedLogbookEntry({ entryName: 'Entry A', totalXp: 10000000, caught: 1000, createdAt: olderDate });
    
    // Seed second entry for the same user via API
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
          entryName: 'Entry B',
          createdAt: newerDate
        }
      });
    });

    cy.login();
    cy.visit('/logbook');
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  it('should display velocity stats based on recent entries', () => {
    cy.get('.velocity-section').should('be.visible');
    cy.get('.velocity-card').contains('Pokémon Caught').siblings('.velocity-value').should('contain.text', '+200');
    cy.get('.velocity-card').contains('XP Gained').siblings('.velocity-value').should('contain.text', '+1,000,000');
  });

  it('should compare two selected entries', () => {
    // Check checkboxes for both entries
    cy.get('.logbook-checkbox').eq(0).check({ force: true });
    cy.get('.logbook-checkbox').eq(1).check({ force: true });

    // Click Compare
    cy.get('.selection-action-bar').should('be.visible').and('contain.text', '2 entries selected');
    cy.get('.compare-btn').click();

    // Verify dialog appears
    cy.get('.compare-dialog').should('be.visible');
    
    // Verify delta calculations
    cy.get('.compare-cell.delta-val').contains('XP').should('contain.text', '+1,000,000');
    cy.get('.compare-cell.delta-val').contains('Caught').should('contain.text', '+200');

    // Close dialog
    cy.get('.compare-dialog .cancel-btn').click();
    cy.get('.compare-dialog').should('not.be.visible');
  });

  it('should sort table columns', () => {
    // Default is descending (Newest first)
    cy.get('tbody tr').eq(0).should('contain.text', 'Entry B');
    cy.get('tbody tr').eq(1).should('contain.text', 'Entry A');

    // Click to sort ascending (Oldest first)
    cy.contains('th', 'Screenshot Date').click();
    
    cy.get('tbody tr').eq(0).should('contain.text', 'Entry A');
    cy.get('tbody tr').eq(1).should('contain.text', 'Entry B');

    // Click to sort descending again
    cy.contains('th', 'Screenshot Date').click();
    cy.get('tbody tr').eq(0).should('contain.text', 'Entry B');
    cy.get('tbody tr').eq(1).should('contain.text', 'Entry A');
  });

  it('should toggle "Show Uploaded Date" column', () => {
    cy.contains('th', 'Uploaded Date').should('not.exist');
    
    cy.contains('label', 'Show Uploaded Date').find('input[type="checkbox"]').check({ force: true });
    cy.contains('th', 'Uploaded Date').should('exist');

    cy.contains('label', 'Show Uploaded Date').find('input[type="checkbox"]').uncheck({ force: true });
    cy.contains('th', 'Uploaded Date').should('not.exist');
  });
});
