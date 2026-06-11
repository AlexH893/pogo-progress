describe('OCR Regression Tests', () => {
  beforeEach(() => {
    // Cypress requires the Angular dev server to be running (npm start)
    cy.visit('/');
  });

  after(() => {
    // Clean up database after tests
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data').then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it('should upload IMG_2031.PNG and parse stats correctly', () => {
    // 1. Upload the image fixture
    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });

    // 2. Wait for processing to complete. 
    // The spinner is shown during processing, so we wait for it to disappear.
    // OCR can take a while (especially Tesseract initialization), so increase the timeout.
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // 3. Assert the parsed values exist on the screen
    cy.get('.stats__item').should('have.length', 5);

    // Verify Level
    cy.contains('.stats__item dt', 'Level')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '79');

    // Verify Username
    cy.get('.profile-name').should('contain.text', 'Stillworld');

    // Verify Distance
    cy.contains('.stats__item dt', 'Distance')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '28,368.0 km');

    // Verify Pokemon caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '309,542');

    // Verify Pokestops visited
    cy.contains('.stats__item dt', 'PokéStops')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '183,692');

    // Verify Total XP
    cy.contains('.stats__item dt', 'Total XP')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '352,169,022');

    
  });

  it('should upload 0n7ketb83odf1.jpeg and parse stats correctly', () => {
    // 1. Upload the image fixture
    cy.get('input[type="file"]').selectFile('cypress/fixtures/0n7ketb83odf1.jpeg', { force: true });

    // 2. Wait for processing to complete. 
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // 3. Assert the parsed values exist on the screen
    cy.get('.stats__item').should('have.length', 5);

    // Verify Level
    cy.contains('.stats__item dt', 'Level')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '47');

    // Verify Username
    cy.get('.profile-name').should('contain.text', 'crosspawz');

    // Verify Distance
    cy.contains('.stats__item dt', 'Distance')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '8,716.5 km');

    // Verify Pokemon caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '75,615');

    // Verify Pokestops visited
    cy.contains('.stats__item dt', 'PokéStops')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '31,376');

    // Verify Total XP
    cy.contains('.stats__item dt', 'Total XP')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '113,442,433');

    
  });

  it('should upload valor.jpg and parse stats correctly', () => {
    // 1. Upload the image fixture
    cy.get('input[type="file"]').selectFile('cypress/fixtures/valor.jpg', { force: true });

    // 2. Wait for processing to complete. 
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // 3. Assert the parsed values exist on the screen
    cy.get('.stats__item').should('have.length', 5);

    // Verify Level
    cy.contains('.stats__item dt', 'Level')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '34');

    // Verify Username
    cy.get('.profile-name').should('contain.text', 'Swagpapa209');

    // Verify Distance
    cy.contains('.stats__item dt', 'Distance')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '327.2 km');

    // Verify Pokemon caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '2,642');

    // Verify Pokestops visited
    cy.contains('.stats__item dt', 'PokéStops')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '1,608');

    // Verify Total XP
    cy.contains('.stats__item dt', 'Total XP')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '5,021,350');

    
  });

  it('should upload pokestops-visited-edgecase.jpg and parse stats correctly', () => {
    // 1. Upload the image fixture
    cy.get('input[type="file"]').selectFile('cypress/fixtures/pokestops-visited-edgecase.jpg', { force: true });

    // 2. Wait for processing to complete. 
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // 3. Assert the parsed values exist on the screen
    cy.get('.stats__item').should('have.length', 5);

    // Verify Level
    cy.contains('.stats__item dt', 'Level')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '23');

    // Verify Username
    cy.get('.profile-name').should('contain.text', 'DarkraiPH1111');

    // Verify Distance
    cy.contains('.stats__item dt', 'Distance')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '9.1 km');

    // Verify Pokemon caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '232');

    // Verify Pokestops visited
    cy.contains('.stats__item dt', 'PokéStops')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '40');

    // Verify Total XP
    cy.contains('.stats__item dt', 'Total XP')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '431,181');

    
  });

  it('should upload username-edgecase.jpg and parse stats correctly', () => {
    // 1. Upload the image fixture
    cy.get('input[type="file"]').selectFile('cypress/fixtures/username-edgecase.jpg', { force: true });

    // 2. Wait for processing to complete. 
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // 3. Assert the parsed values exist on the screen
    cy.get('.stats__item').should('have.length', 5);

    // Verify Level
    cy.contains('.stats__item dt', 'Level')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '34');

    // Verify Username
    cy.get('.profile-name').invoke('text').should('match', /TheSleepySiren[1l]/);

    // Verify Distance
    cy.contains('.stats__item dt', 'Distance')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '109.8 km');

    // Verify Pokemon caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '1,610');

    // Verify Pokestops visited
    cy.contains('.stats__item dt', 'PokéStops')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '352');

    // Verify Total XP
    cy.contains('.stats__item dt', 'Total XP')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '2,039,629');

    
  });

  it('should upload username-1.jpg and parse stats correctly', () => {
    // 1. Visit the home page
    cy.visit('/');

    // 2. Select the file
    cy.get('input[type=file]').selectFile('cypress/fixtures/username-1.jpg', { force: true });

    // 3. Wait for 'processing' to finish, meaning 'success' state is shown
    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');
    cy.get('.stats__item').should('have.length', 5);

    // Verify Level
    cy.contains('.stats__item dt', 'Level')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '65');

    // Verify Username
    cy.get('.profile-name').invoke('text').should('match', /RedEliGmz?/);

    // Verify Distance Walked
    cy.contains('.stats__item dt', 'Distance')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '4,822.3 km');

    // Verify Pokemon caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '54,515');

    // Verify Pokestops visited
    cy.contains('.stats__item dt', 'PokéStops')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '21,190');

    // Verify Total XP
    cy.contains('.stats__item dt', 'Total XP')
      .siblings('dd')
      .find('.stat-val')
      .should('have.text', '57,168,317');

    
  });
});
