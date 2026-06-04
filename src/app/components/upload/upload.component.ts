import { Component, EventEmitter, Input, Output } from '@angular/core';

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
  
  @Output() fileDropped = new EventEmitter<File>();

  isDragOver = false;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileDropped.emit(file);
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
    if (file?.type.startsWith('image/')) {
      this.fileDropped.emit(file);
    } 
  }
}
