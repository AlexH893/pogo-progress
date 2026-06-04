import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-fun-fact',
  templateUrl: './fun-fact.component.html',
  styleUrls: ['./fun-fact.component.scss']
})
export class FunFactComponent {
  @Input() funFact: string | null = null;
  @Output() shuffleClicked = new EventEmitter<void>();

  onShuffle(): void {
    this.shuffleClicked.emit();
  }
}
