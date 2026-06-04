import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-diff-summary',
  templateUrl: './diff-summary.component.html',
  styleUrls: ['./diff-summary.component.scss']
})
export class DiffSummaryComponent {
  @Input() statDiffs: any = null;
  @Input() dailyAverages: any = null;
  @Input() editingFields: Record<string, boolean> = {};

  hasAnyDiffs(): boolean {
    return this.statDiffs !== null;
  }

  formatDiffCount(val: number): string {
    if (!val) return '';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString()}`;
  }

  formatDiffDistance(val: number): string {
    if (!val) return '';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }

  showPace(field: string): boolean {
    if (!this.dailyAverages || this.editingFields[field]) return false;
    const val = this.dailyAverages[field];
    return val !== null && val !== undefined && val !== 0 && !Number.isNaN(val);
  }

  formatPaceCount(val: number): string {
    if (!val) return '';
    const sign = val > 0 ? '+' : '';
    const formatted = Math.abs(val) < 10 ? val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(val).toLocaleString();
    return `${sign}${formatted} / day`;
  }

  formatPaceDistance(val: number): string {
    if (!val) return '';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / day`;
  }
}
