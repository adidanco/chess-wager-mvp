/// <reference types="cypress" />

describe('Scambodia Multi-User E2E Flow', () => {
  const userA = { email: 'iff@gmail.com', password: '111111' };
  const userB = { email: 'bca@gmail.com', password: '111111' };

  function skipSplashAndOnboarding() {
    cy.get('body').then($body => {
      if ($body.find('[data-cy="splash-complete"]').length) {
        cy.get('[data-cy="splash-complete"]').click({ force: true });
      } else {
        cy.contains(/continue|skip|get started|next/i, { matchCase: false }).then($btn => {
          if ($btn && ($btn as any).length > 0) cy.wrap($btn).click({ force: true });
        });
      }
    });
    cy.get('body').then($body => {
      if ($body.find('[data-cy="onboarding-complete"]').length) {
        cy.get('[data-cy="onboarding-complete"]').click({ force: true });
      } else {
        cy.contains(/continue|skip|get started|next/i, { matchCase: false }).then($btn => {
          if ($btn && ($btn as any).length > 0) cy.wrap($btn).click({ force: true });
        });
      }
    });
  }

  function ensureLoggedOut() {
    cy.url().then(url => {
      if (url.endsWith('/login')) return;

      if (url.endsWith('/')) {
        cy.get('body').then($body => {
          if ($body.find('[data-cy="logout-btn"]').length) {
            cy.get('[data-cy="logout-btn"]').click({ force: true });
            cy.url().should('include', '/login');
          } else {
            cy.log('Logout button not found on home. Clearing storage and explicitly visiting /login.');
            cy.clearLocalStorage();
            cy.window().then(win => win.sessionStorage.clear());
            cy.clearCookies(); 
            cy.visit('/login');
            cy.url().should('include', '/login');
          }
        });
      } else {
        cy.log('Not on home or login page. Clearing storage and explicitly visiting /login.');
        cy.clearLocalStorage();
        cy.window().then(win => win.sessionStorage.clear());
        cy.clearCookies();
        cy.visit('/login');
        cy.url().should('include', '/login');
      }
    });
  }

  it('User A creates a game, User B joins, both reach lobby', () => {
    cy.visit('/');
    skipSplashAndOnboarding();
    ensureLoggedOut();

    // Login as User A
    cy.get('[data-cy="login-email"]').type(userA.email);
    cy.get('[data-cy="login-password"]').type(userA.password);
    cy.get('[data-cy="login-submit"]').click();

    // Wait for Home page
    cy.get('[data-cy="home-main"]').should('exist');
    cy.log('On Home page. Skipping navigation, directly visiting /create-scambodia-game');

    // Directly visit the Scambodia game creation page
    cy.visit('/create-scambodia-game');
    cy.url().should('include', '/create-scambodia-game');
    cy.log('Successfully navigated to /create-scambodia-game.');

    // Now on Game Configuration Screen for Scambodia
    cy.log('Expecting Scambodia game configuration screen. Looking for [data-cy="wager-input"]');

    // Wait for create game form (wager input signifies this form)
    cy.log('Looking for wager input [data-cy="wager-input"] to confirm config page.');
    cy.get('[data-cy="wager-input"]', { timeout: 10000 }).should('exist');
    cy.get('[data-cy="wager-input"]').clear().type('10');

    // Log before attempting round selection
    cy.log('Attempting to select rounds.');
    cy.url().then(url => {
      cy.log(`Current URL before round selection: ${url}`);
    });
    cy.get('body').then($body => {
      cy.log(`Body HTML before round selection (first 500 chars): ${$body.html().substring(0, 500)}`);
    });

    cy.get('body').then($body => {
      if ($body.find('[data-cy="rounds-3"]').length) {
        cy.get('[data-cy="rounds-3"]').click();
      } else if ($body.find('button:contains("3 Rounds")').length) {
        cy.contains('button', '3 Rounds').click();
      } else if ($body.find('div:contains("3 Rounds")').length) {
        cy.contains('div', '3 Rounds').click();
      } else {
        cy.log('Could not find a selector for 3 Rounds. Please check the UI.');
        throw new Error('Round selection UI not found');
      }
    });

    // More verbose logging before attempting to click the submit button
    cy.log('Attempting to find the create game submit button.');
    cy.url().then(url => {
      cy.log(`Current URL before create game submit: ${url}`);
    });
    cy.get('body').then($body => {
      cy.log(`Body HTML before create game submit (first 500 chars): ${$body.html().substring(0, 500)}`);
    });

    // Wait for UI to stabilize and attempt to click the correct submit button for the form
    cy.wait(500);
    let createGameSubmitButtonClicked = false;
    cy.get('body').then($body => {
      if ($body.find('[data-cy="create-game-submit"]').length) {
        cy.log('Found button with [data-cy="create-game-submit"]. Clicking it.');
        cy.get('[data-cy="create-game-submit"]', { timeout: 10000 })
          .should('exist')
          .should('be.visible')
          .click({ force: true });
        createGameSubmitButtonClicked = true;
      } else {
        cy.log('WARNING: [data-cy="create-game-submit"] not found. Attempting fallback selectors for create game form submit.');
        if ($body.find('button[type="submit"]:contains("Create")').length) {
          cy.log('Fallback: Found button with type=submit and text containing "Create". Clicking it.');
          cy.contains('button[type="submit"]', /create/i, { matchCase: false })
            .should('exist')
            .should('be.visible')
            .click({ force: true });
          createGameSubmitButtonClicked = true;
        } else if ($body.find('button:contains("Create Game")').length) {
          cy.log('Fallback: Found button with text containing "Create Game". Clicking it.');
          cy.contains('button', /create game/i, { matchCase: false })
            .should('exist')
            .should('be.visible')
            .click({ force: true });
          createGameSubmitButtonClicked = true;
        } else {
          cy.log('ERROR: Could not find the create game submit button with [data-cy="create-game-submit"] or any fallback selectors.');
          cy.document().then(doc => {
            cy.log('Full Page HTML on failure to find create game submit: ' + doc.documentElement.outerHTML);
          });
          throw new Error('Create game submit button not found on the form.');
        }
      }
    }).then(() => {
      expect(createGameSubmitButtonClicked).to.be.true; // Ensure one of the click paths was taken
    });

    // Assert navigation after attempting to submit the create game form
    cy.url().should('not.include', '/categories', 'ERROR: Navigated back to /categories after game creation submission.');
    cy.url().should('match', /\/(lobby|game)\/[^\/]+/, 'ERROR: URL after game creation did not match lobby/game pattern.'); // e.g., /lobby/xyz or /game/xyz

    // User A is now in the lobby
    cy.get('[data-cy="scambodia-lobby-heading"]', { timeout: 10000 }).should('exist');
    cy.url().then((lobbyUrl) => {
      cy.log(`User A created lobby. Lobby URL: ${lobbyUrl}`);

      // --- User B's actions --- 
      cy.log('Simulating User B joining...');
      // Ensure User A is logged out or session is cleared before User B logs in
      // For simplicity, let's visit home, logout (if button exists), then clear storage
      cy.visit('/');
      ensureLoggedOut(); // ensureLoggedOut navigates to /login
      
      cy.log('Logging in as User B...');
      skipSplashAndOnboarding(); // Call this again in case of redirect to splash
      cy.get('[data-cy="login-email"]').type(userB.email);
      cy.get('[data-cy="login-password"]').type(userB.password);
      cy.get('[data-cy="login-submit"]').click();
      cy.get('[data-cy="home-main"]', { timeout: 10000 }).should('exist');
      cy.log('User B logged in.');

      cy.log(`User B navigating to lobby: ${lobbyUrl}`);
      cy.visit(lobbyUrl);
      cy.get('[data-cy="scambodia-lobby-heading"]', { timeout: 10000 }).should('exist');
      cy.get('[data-cy="lobby-player-list"]', { timeout: 10000 }).should('exist');
      cy.log('User B successfully joined the lobby and sees player list.');
      // User B can assert they see User A (creator) in the lobby
      cy.get('[data-cy="lobby-player-list"]').should('contain.text', userA.email.substring(0,3));

      // --- User A's actions to start the game ---
      cy.log('Simulating User A returning to start the game...');
      // User A needs to log back in and navigate to the lobby
      cy.visit('/');
      ensureLoggedOut(); // ensureLoggedOut navigates to /login

      cy.log('Logging in as User A again...');
      skipSplashAndOnboarding();
      cy.get('[data-cy="login-email"]').type(userA.email);
      cy.get('[data-cy="login-password"]').type(userA.password);
      cy.get('[data-cy="login-submit"]').click();
      cy.get('[data-cy="home-main"]', { timeout: 10000 }).should('exist');
      cy.log('User A logged back in.');

      cy.log(`User A re-navigating to lobby: ${lobbyUrl}`);
      cy.visit(lobbyUrl);
      cy.get('[data-cy="scambodia-lobby-heading"]', { timeout: 10000 }).should('exist');
      
      cy.log('User A: Verifying presence of player list container.');
      cy.url().then(url => {
        cy.log(`User A is at URL: ${url} before checking player list.`);
      });
      cy.get('[data-cy="lobby-player-list"]', { timeout: 20000 })
        .should('exist')
        .should('be.visible')
        .then(($list) => {
          cy.log(`Player list HTML for User A: ${$list.html()}`);
          // Now that we know the list exists and is visible, check its content
          expect($list.text()).to.include(userA.email.substring(0,3));
          expect($list.text()).to.include(userB.email.substring(0,3));
        });

      cy.log('User A: Player list verified. Now looking for the Start Game button.');
      cy.get('[data-cy="lobby-start-game-btn"]', { timeout: 10000 })
        .should('exist')
        .should('be.visible')
        .click({ force: true });

      cy.url().should('include', '/game/');
      cy.get('[data-cy="scambodia-game-board"]', { timeout: 10000}).should('exist');
      cy.log('User A and User B are now in the game.');
    });

    // Final assertion to ensure the main test thread (User A) is in the game
    // This might be redundant if the above cy.url().then() block completes successfully for User A
    // but good for safety. It needs User A to be the active session at the end.
    // Given the re-login, this should be User A's context.
    cy.url().should('include', '/game/');
    cy.get('[data-cy="scambodia-game-board"]', { timeout: 10000}).should('exist');
  });
}); 