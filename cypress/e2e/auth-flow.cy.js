describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should show the Google sign-in button for guests', () => {
    cy.get('#google-signin-btn').should('exist');
    cy.get('.user-profile').should('not.exist');
  });

  it('should show user profile and sign out button when logged in', () => {
    cy.login(); 
    
    // Visit page again to trigger auth check with the mocked storage
    cy.visit('/');

    // Wait for the UI to update
    cy.get('.user-profile').should('be.visible');
    cy.get('.user-profile .avatar').should('be.visible').and('contain.text', 'C');
    cy.get('.logout-btn').should('be.visible').and('contain.text', 'Sign Out');
    cy.get('#google-signin-btn').should('not.exist');
  });

  it('should log the user out when clicking sign out', () => {
    cy.login();
    cy.visit('/');
    
    cy.get('.logout-btn').click();
    
    // Should revert back to guest state
    cy.get('#google-signin-btn', { timeout: 10000 }).should('be.visible');
    cy.get('.user-profile').should('not.exist');
    
    // Check localStorage is cleared
    cy.window().then((win) => {
      expect(win.localStorage.getItem('auth_token')).to.be.null;
      expect(win.localStorage.getItem('auth_user')).to.be.null;
    });
  });
});
