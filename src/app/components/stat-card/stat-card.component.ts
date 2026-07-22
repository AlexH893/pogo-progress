import { Component, EventEmitter, Input, Output, ChangeDetectorRef, ElementRef, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent implements OnInit, OnDestroy {
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

  ngOnInit() {
    this.animatedDisplayValue = this.displayValue; // Fallback

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimated && this.value !== null && this.value !== undefined) {
          this.hasAnimated = true;
          this.animateValue(0, this.value, 1500);
          this.observer?.disconnect();
        }
      });
    }, { threshold: 0.1 });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private animateValue(start: number, end: number, duration: number) {
    let startTimestamp: number | null = null;
    const isFloat = this.step === '0.1';

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing out quintic
      const easeOut = 1 - Math.pow(1 - progress, 5);
      const current = start + easeOut * (end - start);
      
      if (isFloat) {
        this.animatedDisplayValue = current.toFixed(1);
      } else {
        this.animatedDisplayValue = Math.floor(current).toLocaleString();
      }
      
      this.cdr.detectChanges();

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        this.animatedDisplayValue = this.displayValue; // snap to exact formatted string
        this.cdr.detectChanges();
      }
    };
    window.requestAnimationFrame(step);
  }

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
