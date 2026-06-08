describe('Upload Error Handling', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should show error when uploading a non-image file (example.json)', () => {
    // Upload the JSON fixture — the upload component should reject it client-side
    cy.get('input[type="file"]').selectFile('cypress/fixtures/example.json', { force: true });

    // The upload component validates file type and emits an error for non-image files
    cy.get('.status--error', { timeout: 5000 }).should('be.visible');
    cy.get('.status--error').should('contain.text', 'Please upload a valid image file');
  });

  it('should show error when uploading a non-Pokémon GO screenshot', () => {
    cy.get('input[type="file"]').selectFile('cypress/fixtures/not-pogo.png', { force: true });

    // Wait for OCR processing to start and then finish with an error
    cy.get('.status--loading', { timeout: 30000 }).should('be.visible');
    cy.get('.status--error', { timeout: 45000 }).should('be.visible');
    cy.get('.status--error').invoke('text').should('match',
      /does not appear to be a Pokémon GO trainer profile screenshot|another language or the image is too blurry/
    );
  });

  it('should recover from an error and allow re-upload', () => {
    // First, trigger an error with the JSON file
    cy.get('input[type="file"]').selectFile('cypress/fixtures/example.json', { force: true });
    cy.get('.status--error', { timeout: 5000 }).should('be.visible');

    // Now upload a valid screenshot — the error should clear and stats should appear
    cy.get('input[type="file"]').selectFile('cypress/fixtures/valor.jpg', { force: true });
    cy.get('.status--loading', { timeout: 30000 }).should('be.visible');
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // Error should be gone, stats should be visible
    cy.get('.status--error').should('not.exist');
    cy.get('.stats__item').should('have.length', 5);
  });

  after(() => {
    // Clean up any test data that may have been created
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data').then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
