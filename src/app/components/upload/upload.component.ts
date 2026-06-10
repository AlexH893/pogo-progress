import { Component, EventEmitter, Input, Output, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent {
  @Input() isProcessing = false;
  @Input() previewUrl: string | null = null;
  @Input() state: string = 'idle';
  @Input() errorMessage: string = '';
  
  @ViewChild('exampleModal') exampleModal!: ElementRef<HTMLDialogElement>;
  
  @Output() fileDropped = new EventEmitter<File>();
  @Output() error = new EventEmitter<string>();

  isDragOver = false;
  
  private readonly validTypes = ['image/jpeg', 'image/png', 'image/webp'];

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (this.isProcessing) {
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    } 
  }
  
  private handleFile(file: File): void {
    if (this.validTypes.includes(file.type)) {
      this.fileDropped.emit(file);
    } else {
      this.error.emit('Please upload a valid image file (JPG, PNG, WEBP).');
    }
  }

  openExampleModal(): void {
    if (this.exampleModal) {
      this.exampleModal.nativeElement.showModal();
      setTimeout(() => {
        this.exampleModal.nativeElement.classList.add('is-open');
      }, 10);
    }
  }

  closeExampleModal(): void {
    if (this.exampleModal) {
      this.exampleModal.nativeElement.classList.remove('is-open');
      setTimeout(() => {
        this.exampleModal.nativeElement.close();
      }, 300);
    }
  }
}
