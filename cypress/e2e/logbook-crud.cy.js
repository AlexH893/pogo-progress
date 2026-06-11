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

  it('should delete the logbook entry', () => {
    cy.on('window:confirm', () => true);

    cy.contains('td', 'Stillworld').parent('tr').within(() => {
      cy.get('.delete-btn').click({ force: true });
    });

    cy.contains('td', 'Stillworld').should('not.exist');
  });
});
