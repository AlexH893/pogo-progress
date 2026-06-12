describe('Logbook CRUD Operations', () => {
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
          username: 'Stillworld',
          level: 40,
          distanceWalked: 1000,
          caught: 5000,
          stopVisited: 2000,
          totalXp: 20000000,
          entryName: 'Test Entry'
        }
      });

      cy.login();
      cy.visit('/logbook');
    });
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  it('should view the logbook entry', () => {
    cy.visit('/logbook');
    cy.wait(5000);
    cy.get('body').then($body => cy.writeFile('cypress_dom.html', $body.html()));
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('td').eq(1).should('contain', 'Stillworld');
      cy.get('td').eq(2).should('contain', 'Test Entry');
      cy.get('td').eq(3).should('contain', '40');
      cy.get('.edit-btn').should('exist');
      cy.get('.delete-btn').should('exist');
    });
  });

  it('should edit the logbook entry', () => {
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('.edit-btn').click({ force: true });
    });
    
    // Find row in edit mode using the input's value
    cy.get('input.edit-input[type="text"]').first().should('have.value', 'Stillworld').closest('tr').within(() => {
      // Update entry name
      cy.get('input[type="text"]').eq(1).clear().type('Updated Entry Name');
      // Update level
      cy.get('input[type="number"]').eq(0).clear().type('42');
      
      cy.get('.save-btn').click({ force: true });
    });

    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('td').eq(2).should('contain', 'Updated Entry Name');
      cy.get('td').eq(3).should('contain', '42');
    });
  });

  it('should reject invalid negative numbers in inline edit and rollback', () => {
    cy.intercept('PUT', '**/update-data/*').as('updateData');

    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      // Click on caught cell to start inline edit
      cy.get('td').eq(6).click();
      
      // Force value to -1, bypassing the new keydown blocking logic
      cy.get('input[type="number"]').clear().invoke('val', '-1').trigger('input');
      // Trigger blur to save
      cy.get('input[type="number"]').blur();
    });

    cy.wait('@updateData').its('response.statusCode').should('eq', 400);

    // Should show error toast
    cy.get('.toast-error', { timeout: 5000 }).should('be.visible').and('contain.text', 'Failed to save edit');

    // Should rollback to the original value (5000)
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('td').eq(6).should('contain', '5,000');
    });
  });

  it('should handle strings or empty values gracefully without crashing', () => {
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      // Click on stop_visited cell to start inline edit
      cy.get('td').eq(7).click();
      
      // Clear the input and type an invalid string for a number input
      cy.get('input[type="number"]').clear().type('invalid_string', { parseSpecialCharSequences: false, force: true });
      cy.get('input[type="number"]').blur();
    });

    // Verify it rolled back or is handled gracefully
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('td').eq(7).should('exist');
    });
  });

  it('should prevent typing letters, spaces, and invalid characters into number fields', () => {
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      // Click on caught cell to start inline edit
      cy.get('td').eq(6).click();
      
      // Clear and try typing invalid characters
      cy.get('input[type="number"]').clear().type('100e0 ', { force: true });
      
      // Depending on Cypress preventDefault support, it should either only register digits (1000) or reject the string entirely
      // We check that the UI stays functional
      cy.get('input[type="number"]').invoke('val').should('match', /^(1000|)$/);
      cy.get('input[type="number"]').blur();
    });
  });

  it('should reject excessively large numbers that exceed realistic limits', () => {
    cy.intercept('PUT', '**/update-data/*').as('updateData');

    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      // Click on total_xp cell to start inline edit
      cy.get('td').eq(4).click();
      
      // Type a number greater than 2,000,000,000
      cy.get('input[type="number"]').clear().type('2000000001');
      cy.get('input[type="number"]').blur();
    });

    cy.wait('@updateData').its('response.statusCode').should('eq', 400);

    // Should show error toast
    cy.get('.toast-error', { timeout: 5000 }).should('be.visible').and('contain.text', 'Failed to save edit');

    // Should rollback to the original value (20,000,000)
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('td').eq(4).should('contain', '20,000,000');
    });
  });

  it('should delete the logbook entry', () => {
    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('.delete-btn').click({ force: true });
    });

    cy.get('.confirm-delete-btn').should('be.visible').click({ force: true });

    cy.contains('td', 'Stillworld').should('not.exist');
  });
});
