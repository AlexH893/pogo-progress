import { UploadComponent } from './upload.component'

describe('UploadComponent', () => {
  it('should mount', () => {
    cy.mount(UploadComponent)
  })

  it('should emit an error for invalid file types', () => {
    cy.mount(UploadComponent, {
      componentProperties: {
        error: {
          emit: cy.spy().as('errorSpy')
        } as any
      }
    }).then((wrapper) => {
      const invalidFile = new File([''], 'test.pdf', { type: 'application/pdf' });
      wrapper.component['handleFile'](invalidFile);
      cy.get('@errorSpy').should('have.been.calledWith', 'Please upload a valid image file (JPG, PNG, WEBP).');
    })
  })

  it('should emit fileDropped for valid image files', () => {
    cy.mount(UploadComponent, {
      componentProperties: {
        fileDropped: {
          emit: cy.spy().as('fileDroppedSpy')
        } as any
      }
    }).then((wrapper) => {
      const validFile = new File([''], 'test.png', { type: 'image/png' });
      wrapper.component['handleFile'](validFile);
      cy.get('@fileDroppedSpy').should('have.been.calledWith', validFile);
    })
  })
})