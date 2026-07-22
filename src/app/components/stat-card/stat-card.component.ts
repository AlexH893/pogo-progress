import { Component, EventEmitter, Input, Output, ChangeDetectorRef, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent implements OnInit, OnDestroy {
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

  @ViewChild('statValueEl', { static: true }) statValueEl!: ElementRef;

  animatedDisplayValue: string = '0';
  private observer: IntersectionObserver | null = null;
  private hasAnimated: boolean = false;

  constructor(private cdr: ChangeDetectorRef, private el: ElementRef) {}

  ngOnInit() {
    this.animatedDisplayValue = this.displayValue; // Fallback

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimated && this.value !== null) {
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
    this.isEditingChange.emit(this.isEditing);
    this.cdr.detectChanges();
  }

  submitCorrection(val: string): void {
    this.correctionSubmitted.emit(val);
    this.isEditing = false;
    this.isEditingChange.emit(this.isEditing);
  }
}
