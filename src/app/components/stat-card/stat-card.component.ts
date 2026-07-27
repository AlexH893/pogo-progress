import { Component, EventEmitter, Input, Output, ChangeDetectorRef, ElementRef, OnInit, OnChanges, OnDestroy, SimpleChanges, ViewChild, HostListener } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() label: string = '';
  @Input() value: number | null | undefined = null;
  @Input() displayValue: string = '';
  @Input() diff: number | null | undefined = null;
  @Input() formattedDiff: string = '';
  @Input() isAnimating: boolean = false;
  @Input() step: string = '1';
  @Input() placeholder: string = '';
  
  @Input() isEditing: boolean = false;
  @Output() isEditingChange = new EventEmitter<boolean>();
  
  @Output() correctionSubmitted = new EventEmitter<string>();



  private valInputEl: ElementRef<HTMLInputElement> | null = null;
  @ViewChild('valInput') set valInput(content: ElementRef<HTMLInputElement> | null) {
    if (content) {
      this.valInputEl = content;
      setTimeout(() => {
        if (content.nativeElement) {
          content.nativeElement.focus();
          content.nativeElement.select();
        }
      }, 0);
    } else {
      this.valInputEl = null;
    }
  }

  animatedDisplayValue: string = '0';
  private observer: IntersectionObserver | null = null;
  private hasAnimated: boolean = false;
  private editOpenedAt: number = 0;

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isEditing) return;
    // Ignore clicks that happened within 50ms of opening edit mode (the same click that opened it)
    if (Date.now() - this.editOpenedAt < 50) return;
    const target = event.target as HTMLElement;
    if (target && !this.el.nativeElement.contains(target)) {
      const val = this.valInputEl ? this.valInputEl.nativeElement.value : (this.value !== null && this.value !== undefined ? String(this.value) : '');
      this.submitCorrection(val);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayValue']) {
      this.animatedDisplayValue = this.displayValue;
      this.cdr.detectChanges();
    }
  }

  ngOnInit() {
    this.animatedDisplayValue = this.displayValue;
  }

  ngOnDestroy() {}

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editOpenedAt = Date.now();
    }
    this.isEditingChange.emit(this.isEditing);
    this.cdr.detectChanges();
  }

  submitCorrection(val: string): void {
    this.isEditing = false;
    this.isEditingChange.emit(false);
    this.correctionSubmitted.emit(val);
    this.cdr.detectChanges();
  }
}
