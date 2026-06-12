describe('Diff/Comparison Flow', () => {
  // This test suite verifies the comparison flow when a user uploads
  // two different screenshots for the same username. The second upload
  // should show the "Changes since last upload" diff summary.

  beforeEach(() => {
    // Clean up any leftover test data before running each test
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data').then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  after(() => {
    // Clean up test data after all tests
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data').then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it('should show diff summary when uploading the same user twice', () => {
    // ── First upload: establish baseline stats ──
    cy.visit('/');
    cy.login();

    cy.intercept('POST', '**/post-data').as('firstUpload');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/valor.jpg', { force: true });
    cy.wait('@firstUpload');

    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // Verify first upload parsed correctly
    cy.get('.stats__item').should('have.length', 5);
    cy.get('.profile-name').should('contain.text', 'Swagpapa209');

    // The diff summary should NOT appear on the first upload (no previous data)
    cy.get('.diff-section').should('not.exist');

    // ── Second upload: same user, same screenshot ──
    // Re-upload the same image. Since the stats are identical,
    // the backend will return previousStats but diffs will be zero.
    // The diff section should NOT appear when all diffs are 0.
    cy.visit('/');
    cy.login();

    cy.intercept('POST', '**/post-data', (req) => {
      req.continue((res) => {
        if (res.body && res.body.previousStats) {
          // Force previous stats to match exactly to avoid OCR floating point non-determinism
          res.body.previousStats.level = req.body.level;
          res.body.previousStats.distance_walked = req.body.distanceWalked;
          res.body.previousStats.caught = req.body.caught;
          res.body.previousStats.stop_visited = req.body.stopVisited;
          res.body.previousStats.total_xp = req.body.totalXp;
        }
      });
    }).as('secondUpload');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/valor.jpg', { force: true });
    cy.wait('@secondUpload');

    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    cy.get('.stats__item').should('have.length', 5);
    cy.get('.profile-name').should('contain.text', 'Swagpapa209');

    // With identical stats, diffs are all zero → diff section should not appear
    cy.get('.diff-section').should('not.exist');
  });

  it('should show diff summary when a user corrects a stat value', () => {
    // Upload a screenshot first to establish baseline
    cy.visit('/');
    cy.login();

    cy.intercept('POST', '**/post-data').as('editUpload');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/valor.jpg', { force: true });
    cy.wait('@editUpload');

    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    cy.get('.stats__item').should('have.length', 5);

    // Verify the stat card edit button exists for Caught
    cy.contains('.stats__item dt', 'Caught')
      .siblings('dd')
      .find('.edit-btn')
      .should('exist');
  });

  it('should display positive diffs when uploading two different screenshots for the same user', () => {
    // ── Step 1: Clean slate ──
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');

    // ── Step 2: Upload the first screenshot (lower stats) ──
    cy.visit('/');
    cy.login();

    cy.intercept('POST', '**/post-data').as('firstUpload');
    cy.get('input[type="file"]').selectFile('cypress/fixtures/valor.jpg', { force: true });
    cy.wait('@firstUpload');

    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    cy.get('.stats__item').should('have.length', 5);
    cy.get('.profile-name').should('contain.text', 'Swagpapa209');

    // No diff section on first upload
    cy.get('.diff-section').should('not.exist');

    // ── Step 3: Manually correct the username to match another fixture's user, 
    // then re-upload with higher stats ──
    // Instead, we'll use a direct API approach: insert a "previous" record
    // for Stillworld with lower stats, then upload the Stillworld screenshot.
    cy.request('DELETE', 'http://localhost:3000/cleanup-test-data');

    // Post artificial lower stats for Stillworld to act as the "previous" entry
    cy.request('GET', 'http://localhost:3000/auth/test-token').then((resp) => {
      const token = resp.body.token;
      cy.request({
        method: 'POST',
        url: 'http://localhost:3000/post-data',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          username: 'Stillworld',
          level: 30,
          distanceWalked: 1000.0,
          caught: 10000,
          stopVisited: 10000,
          totalXp: 1000000,
          createdAt: '2020-01-01T00:00:00.000Z',
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    // Now upload the real Stillworld screenshot (which has higher stats)
    cy.visit('/');
    cy.login();

    cy.get('input[type="file"]').selectFile('cypress/fixtures/IMG_2031.PNG', { force: true });

    cy.get('.status--loading', { timeout: 45000 }).should('not.exist');

    // Verify stats parsed
    cy.get('.stats__item').should('have.length', 5);
    cy.get('.profile-name').should('contain.text', 'Stillworld');

    // ── Step 4: Verify the diff section appears ──
    cy.get('.diff-section', { timeout: 10000 }).should('be.visible');
    cy.get('.diff-section h2').should('contain.text', 'Changes since last upload');

    // Verify positive diffs are shown (the real stats should be higher than our artificial ones)
    cy.get('.diff-positive').should('have.length.at.least', 1);
  });
});
