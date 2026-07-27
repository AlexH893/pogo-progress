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
  
  selectedMetric: 'level' | 'distance_walked' | 'caught' | 'stop_visited' | 'total_xp' | 'stardust' = 'total_xp';
  chartInstance: Chart | null = null;

  get isLevel80(): boolean {
    return !!(this.userHistory && this.userHistory.some(row => row.level !== null && row.level !== undefined && row.level >= 80));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userHistory'] && this.userHistory && this.userHistory.length > 0) {
      if (this.isLevel80 && this.selectedMetric === 'level') {
        this.selectedMetric = 'total_xp';
      }
      setTimeout(() => this.updateChart(), 0);
    }
  }

  setMetric(metric: 'level' | 'distance_walked' | 'caught' | 'stop_visited' | 'total_xp' | 'stardust'): void {
    if (metric === 'level' && this.isLevel80) {
      return;
    }
    this.selectedMetric = metric;
    this.updateChart();
  }

  private updateChart(): void {
    if (!this.progressChartRef) return;
    if (this.isLevel80 && this.selectedMetric === 'level') {
      this.selectedMetric = 'total_xp';
    }
    const validHistory = this.userHistory.filter(row => row[this.selectedMetric] !== null && row[this.selectedMetric] !== undefined);
    if (validHistory.length === 0) return;

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = validHistory.map(row => new Date(row.created_at).toLocaleDateString());
    const data = validHistory.map(row => row[this.selectedMetric]);

    let labelText = '';
    let themeColor = '#FF5A00'; // Default Daylight Orange
    switch (this.selectedMetric) {
      case 'level': labelText = 'Level'; themeColor = '#1A1A1A'; break; // Charcoal
      case 'distance_walked': labelText = 'Distance Walked (km)'; themeColor = '#B4A6F0'; break; // Light Purple
      case 'caught': labelText = 'Pokémon Caught'; themeColor = '#FFC107'; break; // Yellow
      case 'stop_visited': labelText = 'Pokéstops Visited'; themeColor = '#1A1A1A'; break; // Charcoal
      case 'total_xp': labelText = 'Total XP'; themeColor = '#FF5A00'; break; // Orange
      case 'stardust': labelText = 'Stardust'; themeColor = '#E040FB'; break; // Vibrant Magenta/Purple
    }

    const isLevel = this.selectedMetric === 'level';

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 90, 0';
    };
    const rgbColor = hexToRgb(themeColor);
    
    gradient.addColorStop(0, `rgba(${rgbColor}, 0.2)`);
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
        this.chartInstance.options.plugins.tooltip.borderColor = `rgba(${rgbColor}, 0.1)`;
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
          tension: 0.4, // Smooth daylight curves
          fill: true,
          pointBackgroundColor: themeColor,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: themeColor,
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#FFFFFF',
            titleColor: '#1A1A1A',
            bodyColor: '#1A1A1A',
            borderColor: `rgba(0,0,0,0.1)`,
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            usePointStyle: true,
            boxPadding: 6,
            cornerRadius: 12, // Soft rounded tooltips
            titleFont: { family: "'Inter', sans-serif", weight: 'bold' },
            bodyFont: { family: "'Inter', sans-serif" },
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
            ticks: { color: '#6B6B6B', font: { family: "'Inter', sans-serif" } }
          },
          y: {
            max: isLevel ? 80 : undefined,
            grid: { 
              color: 'rgba(0, 0, 0, 0.05)',
              tickLength: 0
            },
            border: { display: false },
            ticks: { color: '#6B6B6B', font: { family: "'Inter', sans-serif" } }
          }
        }
      }
    });
  }
}
