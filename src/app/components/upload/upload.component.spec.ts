import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UploadComponent } from './upload.component';
import { By } from '@angular/platform-browser';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UploadComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit fileDropped when a valid image is selected', () => {
    spyOn(component.fileDropped, 'emit');
    const mockFile = new File([''], 'test.png', { type: 'image/png' });
    const event = { target: { files: [mockFile] } } as any;

    component.onFileSelected(event);

    expect(component.fileDropped.emit).toHaveBeenCalledWith(mockFile);
  });

  it('should emit error when an invalid file is selected', () => {
    spyOn(component.error, 'emit');
    const mockFile = new File([''], 'test.json', { type: 'application/json' });
    const event = { target: { files: [mockFile] } } as any;

    component.onFileSelected(event);

    expect(component.error.emit).toHaveBeenCalledWith('Please upload a valid image file (JPG, PNG, WEBP).');
  });

  it('should handle drag events correctly', () => {
    const dragEvent = new Event('dragover') as any;
    dragEvent.preventDefault = jasmine.createSpy('preventDefault');
    
    component.onDragOver(dragEvent);
    expect(dragEvent.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBeTrue();

    component.onDragLeave();
    expect(component.isDragOver).toBeFalse();
  });

  it('should handle file drop correctly', () => {
    spyOn(component.fileDropped, 'emit');
    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const dropEvent = new Event('drop') as any;
    dropEvent.preventDefault = jasmine.createSpy('preventDefault');
    dropEvent.dataTransfer = { files: [mockFile] };

    component.onDrop(dropEvent);

    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(component.isDragOver).toBeFalse();
    expect(component.fileDropped.emit).toHaveBeenCalledWith(mockFile);
  });
  
  it('should ignore file drop if currently processing', () => {
    spyOn(component.fileDropped, 'emit');
    component.isProcessing = true;
    const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    const dropEvent = new Event('drop') as any;
    dropEvent.preventDefault = jasmine.createSpy('preventDefault');
    dropEvent.dataTransfer = { files: [mockFile] };

    component.onDrop(dropEvent);

    expect(component.fileDropped.emit).not.toHaveBeenCalled();
  });
});
