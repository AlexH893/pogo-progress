describe('Logbook CRUD Operations', () => {
  // Seed a fresh, known state before EVERY test so they are fully independent.
  // No test depends on the side-effects of a previous test.
  beforeEach(() => {
    cy.seedLogbookEntry();
    cy.login();
    cy.visit('/logbook');
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  // ─── View ────────────────────────────────────────────────────────────────────

  it('should view the logbook entry', () => {
    cy.get('body').then($body => cy.writeFile('cypress_dom.html', $body.html()));
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(2).should('contain', 'Test Entry');
      cy.get('td').eq(3).should('contain', '40');
      cy.get('.edit-btn').should('exist');
      cy.get('.delete-btn').should('exist');
    });
  });

  // ─── Edit ────────────────────────────────────────────────────────────────────

  it('should edit the logbook entry via the row edit mode', () => {
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('.edit-btn').click({ force: true });
    });

    cy.get('input.edit-input[type="text"]').first().should('have.value', 'Test Entry').closest('tr').within(() => {
      cy.get('input[type="text"]').eq(0).clear().type('Updated Entry Name');
      cy.get('input[type="number"]').eq(0).clear().type('42');
      cy.get('.save-btn').click({ force: true });
    });

    cy.contains('td', 'Updated Entry Name').parent('tr').within(() => {
      cy.get('td').eq(2).should('contain', 'Updated Entry Name');
      cy.get('td').eq(3).should('contain', '42');
    });
  });

  // ─── Inline Edit Validation ───────────────────────────────────────────────────

  it('should reject invalid negative numbers in inline edit and rollback', () => {
    cy.intercept('PUT', '**/update-data/*').as('updateData');

    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(6).click();
      // Force value to -1, bypassing the keydown blocking logic
      cy.get('input[type="number"]').clear().invoke('val', '-1').trigger('input');
      cy.get('input[type="number"]').blur();
    });

    cy.wait('@updateData').its('response.statusCode').should('eq', 400);
    cy.get('.toast-error', { timeout: 5000 }).should('be.visible').and('contain.text', 'Failed to save edit');

    // Should rollback to the original value (5000)
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(6).should('contain', '5,000');
    });
  });

  it('should handle strings or empty values gracefully without crashing', () => {
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(7).click();
      cy.get('input[type="number"]').clear().type('invalid_string', { parseSpecialCharSequences: false, force: true });
      cy.get('input[type="number"]').blur();
    });

    // The stop_visited cell should still exist (not crash)
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(7).should('exist');
    });
  });

  it('should prevent typing letters, spaces, and invalid characters into number fields', () => {
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(6).click();
      cy.get('input[type="number"]').clear().type('100e0 ', { force: true });
      cy.get('input[type="number"]').invoke('val').should('match', /^(1000|)$/);
      cy.get('input[type="number"]').blur();
    });
  });

  it('should reject excessively large numbers that exceed realistic limits', () => {
    cy.intercept('PUT', '**/update-data/*').as('updateData');

    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(4).click();
      cy.get('input[type="number"]').clear().type('2000000001');
      cy.get('input[type="number"]').blur();
    });

    cy.wait('@updateData').its('response.statusCode').should('eq', 400);
    cy.get('.toast-error', { timeout: 5000 }).should('be.visible').and('contain.text', 'Failed to save edit');

    // Should rollback to the original value (20,000,000)
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(4).should('contain', '20,000,000');
    });
  });

  it('should reject malicious string payloads and rollback', () => {
    cy.intercept('PUT', '**/update-data/*').as('updateData');

    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('td').eq(2).click();
      cy.get('input[type="text"]').clear().invoke('val', '<script>alert(1)</script>').trigger('input');
      cy.get('input[type="text"]').blur();
    });

    cy.wait('@updateData').its('response.statusCode').should('eq', 400);
    cy.get('.toast-error', { timeout: 5000 }).should('be.visible').and('contain.text', 'Failed to save edit');
  });

  // ─── Delete ──────────────────────────────────────────────────────────────────

  it('should delete the logbook entry', () => {
    cy.contains('td', 'Test Entry').parent('tr').within(() => {
      cy.get('.delete-btn').click({ force: true });
    });

    cy.get('.confirm-delete-btn').should('be.visible').click({ force: true });

    cy.contains('td', 'Test Entry').should('not.exist');
  });
});
