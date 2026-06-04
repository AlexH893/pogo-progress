import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent {
  @Input() label: string = '';
  @Input() value: number | null = null;
  @Input() displayValue: string = '';
  @Input() diff: number | null | undefined = null;
  @Input() formattedDiff: string = '';
  @Input() isAnimating: boolean = false;
  @Input() step: string = '1';
  @Input() placeholder: string = '';
  
  @Input() isEditing: boolean = false;
  @Output() isEditingChange = new EventEmitter<boolean>();
  
  @Output() correctionSubmitted = new EventEmitter<string>();

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.isEditingChange.emit(this.isEditing);
  }

  submitCorrection(val: string): void {
    this.correctionSubmitted.emit(val);
    this.isEditing = false;
    this.isEditingChange.emit(this.isEditing);
  }
}
