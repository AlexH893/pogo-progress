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
    let themeColor = '#81c784';
    switch (this.selectedMetric) {
      case 'level': labelText = 'Level'; themeColor = '#ffd54f'; break;
      case 'distance_walked': labelText = 'Distance Walked (km)'; themeColor = '#4fc3f7'; break;
      case 'caught': labelText = 'Pokémon Caught'; themeColor = '#81c784'; break;
      case 'stop_visited': labelText = 'Pokéstops Visited'; themeColor = '#ffb74d'; break;
      case 'total_xp': labelText = 'Total XP'; themeColor = '#ba68c8'; break;
    }

    const isLevel = this.selectedMetric === 'level';

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '129, 199, 132';
    };
    const rgbColor = hexToRgb(themeColor);
    
    gradient.addColorStop(0, `rgba(${rgbColor}, 0.5)`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);

    if (this.chartInstance) {
      this.chartInstance.data.labels = labels;
      this.chartInstance.data.datasets[0].data = data;
      this.chartInstance.data.datasets[0].label = labelText;
      (this.chartInstance.data.datasets[0] as any).borderColor = themeColor;
      (this.chartInstance.data.datasets[0] as any).backgroundColor = gradient;
      (this.chartInstance.data.datasets[0] as any).pointBackgroundColor = themeColor;
      (this.chartInstance.data.datasets[0] as any).pointHoverBorderColor = themeColor;
      
      if (this.chartInstance.options.plugins && this.chartInstance.options.plugins.tooltip) {
        this.chartInstance.options.plugins.tooltip.borderColor = `rgba(${rgbColor}, 0.3)`;
      }

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
          borderColor: themeColor,
          backgroundColor: gradient,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: themeColor,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: themeColor,
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(20, 20, 20, 0.9)',
            titleColor: '#e8f5e9',
            bodyColor: '#e8f5e9',
            borderColor: `rgba(${rgbColor}, 0.3)`,
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            usePointStyle: true,
            boxPadding: 6,
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
            grid: { display: false },
            border: { display: false },
            ticks: { color: 'rgba(232, 245, 233, 0.5)' }
          },
          y: {
            max: isLevel ? 80 : undefined,
            grid: { 
              color: 'rgba(232, 245, 233, 0.05)',
              tickLength: 0
            },
            border: { dash: [5, 5], display: false },
            ticks: { color: 'rgba(232, 245, 233, 0.5)' }
          }
        }
      }
    });
  }
}
