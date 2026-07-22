describe('Home Page Edge Cases', () => {

  beforeEach(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
    cy.intercept('POST', '**/post-data').as('postData');
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  it('should toggle debug OCR text', () => {
    cy.login();
    cy.visit('/');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item', { timeout: 10000 }).should('have.length', 5);

    // Debug toggle should exist when rawOcrText is present (which the backend sends)
    cy.get('.debug-toggle').scrollIntoView().should('contain.text', 'Show OCR text').click();
    
    // Check that pre block appears
    cy.get('.debug-text').scrollIntoView().should('be.visible').and('contain.text', 'Total');
    
    cy.get('.debug-toggle').scrollIntoView().should('contain.text', 'Hide OCR text').click();
    cy.get('.debug-text').should('not.exist');
  });

  it('should inline edit the Upload Label', () => {
    cy.login();
    cy.visit('/');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item', { timeout: 10000 }).should('have.length', 5);

    // Add label
    cy.get('.entry-name-placeholder').first().scrollIntoView().should('contain.text', 'Add a custom label/note');
    cy.get('button[aria-label="Add label"]').first().scrollIntoView().click();
    cy.get('input[placeholder="Enter label"]').first().scrollIntoView().should('be.visible').type('New Custom Label{enter}');

    // Wait for the PUT request to update
    cy.get('.entry-name-display').eq(1).scrollIntoView().should('contain.text', 'New Custom Label');

    // Edit again
    cy.get('button[aria-label="Edit label"]').first().scrollIntoView().click();
    cy.get('input[placeholder="Enter label"]').first().scrollIntoView().clear().type('Updated Label').blur();
    cy.get('.entry-name-display').eq(1).scrollIntoView().should('contain.text', 'Updated Label');
  });

  it('should inline edit the Screenshot Date', () => {
    cy.login();
    cy.visit('/');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item', { timeout: 10000 }).should('have.length', 5);

    cy.get('button[aria-label="Edit date"]').first().scrollIntoView().click();
    cy.get('input[type="datetime-local"]').first().scrollIntoView().should('be.visible').type('2024-01-01T12:00').blur();
    
    // The display string should update to reflect the new date (Jan 1, 2024 roughly depending on timezone formatting)
    cy.get('.entry-name-container').first().contains(/Jan 1, 2024|2024/i).should('exist');
  });

  it('should show Guest prompt when not logged in', () => {
    cy.visit('/'); // Not logged in
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item', { timeout: 10000 }).should('have.length', 5);

    cy.get('.guest-prompt').scrollIntoView().should('be.visible').and('contain.text', 'Sign in to save your progress');
    cy.get('.auth-success-prompt').should('not.exist');
  });

  it('should show Authenticated prompt when logged in', () => {
    cy.login();
    cy.visit('/');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item', { timeout: 10000 }).should('have.length', 5);

    cy.get('.auth-success-prompt').scrollIntoView().should('be.visible').and('contain.text', 'Your progress is automatically saved!');
    cy.get('.guest-prompt').should('not.exist');
  });

});
