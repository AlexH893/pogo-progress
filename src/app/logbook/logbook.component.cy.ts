import { LogbookComponent } from './logbook.component'
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LogbookComponent', () => {
  it('should mount', () => {
    cy.mount(LogbookComponent, {
      imports: [HttpClientTestingModule]
    })
  })
})