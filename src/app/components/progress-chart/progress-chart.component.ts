import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-progress-chart',
  templateUrl: './progress-chart.component.html',
  styleUrls: ['./progress-chart.component.scss']
})
export class ProgressChartComponent implements OnChanges {
  @Input() userHistory: any[] = [];
  @Input() username: string = '';

  @ViewChild('progressChart') progressChartRef!: ElementRef<HTMLCanvasElement>;
  
  selectedMetric: 'level' | 'distance_walked' | 'caught' | 'stop_visited' | 'total_xp' = 'total_xp';
  chartInstance: Chart | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userHistory'] && this.userHistory && this.userHistory.length > 0) {
      setTimeout(() => this.updateChart(), 0);
    }
  }

  setMetric(metric: 'level' | 'distance_walked' | 'caught' | 'stop_visited' | 'total_xp'): void {
    this.selectedMetric = metric;
    this.updateChart();
  }

  private updateChart(): void {
    if (!this.progressChartRef || this.userHistory.length === 0) return;

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.userHistory.map(row => new Date(row.created_at).toLocaleDateString());
    const data = this.userHistory.map(row => row[this.selectedMetric]);

    let labelText = '';
    switch (this.selectedMetric) {
      case 'level': labelText = 'Level'; break;
      case 'distance_walked': labelText = 'Distance Walked (km)'; break;
      case 'caught': labelText = 'Pokémon Caught'; break;
      case 'stop_visited': labelText = 'Pokéstops Visited'; break;
      case 'total_xp': labelText = 'Total XP'; break;
    }

    const isLevel = this.selectedMetric === 'level';

    if (this.chartInstance) {
      this.chartInstance.data.labels = labels;
      this.chartInstance.data.datasets[0].data = data;
      this.chartInstance.data.datasets[0].label = labelText;
      if (this.chartInstance.options.scales && this.chartInstance.options.scales['y']) {
        this.chartInstance.options.scales['y'].max = isLevel ? 80 : undefined;
      }
      this.chartInstance.update();
      return;
    }

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: labelText,
          data,
          borderColor: '#81c784',
          backgroundColor: 'rgba(129, 199, 132, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#81c784',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20, 20, 20, 0.9)',
            titleColor: '#e8f5e9',
            bodyColor: '#e8f5e9',
            borderColor: 'rgba(129, 199, 132, 0.3)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toLocaleString();
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(232, 245, 233, 0.05)' },
            ticks: { color: 'rgba(232, 245, 233, 0.5)' }
          },
          y: {
            max: isLevel ? 80 : undefined,
            grid: { color: 'rgba(232, 245, 233, 0.05)' },
            ticks: { color: 'rgba(232, 245, 233, 0.5)' }
          }
        }
      }
    });
  }
}
