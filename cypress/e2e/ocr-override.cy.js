describe('OCR Override Logic', () => {
  let authToken;

  beforeEach(() => {
    // 1. Get test token
    cy.request('GET', 'http://localhost:3000/auth/test-token').then((resp) => {
      authToken = resp.body.token;
      
      // 2. Clean test data
      cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
      
      // 3. Create linked trainer using test user
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/post-data',
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          username: 'TheSleepySiren1', // The explicitly correct name (with a 1)
          level: 40,
        }
      });

      // 4. Visit the home page so `window` is the app window
      cy.visit('/');

      // 5. Log in
      cy.login();
    });
  });

  after(() => {
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');
  });

  it('should override OCR typo with known linked trainer name', () => {
    cy.intercept('POST', '**/post-data').as('postData');
    
    // Upload image that is known to produce typo "TheSleepySirenl" (with an L instead of 1)
    cy.get('input[type="file"]').selectFile('cypress/fixtures/username-edgecase.jpg', { force: true });
    
    // Wait for processing to complete
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    
    // 1. The UI should show the corrected name (TheSleepySiren1)
    cy.get('.profile-name').should('contain.text', 'TheSleepySiren1');
    
    // 2. The network request should have sent the corrected name instead of the typo
    cy.wait('@postData').its('request.body.username').should('eq', 'TheSleepySiren1');
  });
});
