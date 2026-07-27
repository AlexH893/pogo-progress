import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ProgressChartComponent } from './progress-chart.component';

describe('ProgressChartComponent', () => {
  let component: ProgressChartComponent;
  let fixture: ComponentFixture<ProgressChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProgressChartComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProgressChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (component.chartInstance) {
      component.chartInstance.destroy();
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update chart when data changes', fakeAsync(() => {
    spyOn<any>(component, 'updateChart');
    
    component.userHistory = [
      { created_at: new Date().toISOString(), total_xp: 100 }
    ];
    
    component.ngOnChanges({
      userHistory: {
        currentValue: component.userHistory,
        previousValue: [],
        firstChange: true,
        isFirstChange: () => true
      }
    });

    tick();
    expect((component as any).updateChart).toHaveBeenCalled();
  }));

  it('should create new chart instance on first update', () => {
    component.username = 'Trainer';
    component.userHistory = [{ created_at: '2024-01-01', total_xp: 100 }, { created_at: '2024-01-02', total_xp: 200 }];
    component.selectedMetric = 'total_xp';
    fixture.detectChanges(); // Render canvas
    
    (component as any).updateChart();
    
    expect(component.chartInstance).toBeTruthy();
    expect(component.chartInstance?.data.labels?.length).toBe(2);
    expect(component.chartInstance?.data.datasets[0].label).toBe('Total XP');
  });

  it('should handle different metrics correctly', () => {
    component.username = 'Trainer';
    component.userHistory = [{ created_at: '2024-01-01', level: 40, distance_walked: 100, caught: 50, stop_visited: 20, total_xp: 1000 }];
    fixture.detectChanges(); // Render canvas
    
    component.setMetric('level');
    expect(component.chartInstance?.data.datasets[0].label).toBe('Level');
    expect(component.chartInstance?.options.scales?.['y']?.max).toBe(80);

    component.setMetric('distance_walked');
    expect(component.chartInstance?.data.datasets[0].label).toBe('Distance Walked (km)');
    expect(component.chartInstance?.options.scales?.['y']?.max).toBeUndefined();

    component.setMetric('caught');
    expect(component.chartInstance?.data.datasets[0].label).toBe('Pokémon Caught');

    component.setMetric('stop_visited');
    expect(component.chartInstance?.data.datasets[0].label).toBe('Pokéstops Visited');
  });

  it('should update existing chart instance without recreating', () => {
    component.username = 'Trainer';
    component.userHistory = [{ created_at: '2024-01-01', total_xp: 100 }];
    fixture.detectChanges(); // Render canvas
    
    (component as any).updateChart();
    
    const initialInstance = component.chartInstance;
    expect(initialInstance).toBeTruthy();
    spyOn(initialInstance!, 'update');
    
    component.userHistory = [{ created_at: '2024-01-01', total_xp: 100 }, { created_at: '2024-01-02', total_xp: 200 }];
    (component as any).updateChart();
    
    expect(component.chartInstance).toBe(initialInstance);
    expect(initialInstance!.update).toHaveBeenCalled();
    expect(component.chartInstance?.data.labels?.length).toBe(2);
  });

  describe('level 80 behavior', () => {
    it('should identify level 80 correctly and hide level tab', () => {
      component.username = 'Trainer';
      component.userHistory = [{ created_at: '2024-01-01', level: 80, total_xp: 200000000 }];
      fixture.detectChanges();

      expect(component.isLevel80).toBeTrue();
      const buttons = fixture.nativeElement.querySelectorAll('.chart-tab');
      const buttonTexts = Array.from(buttons).map((b: any) => b.textContent.trim());
      expect(buttonTexts).not.toContain('Level');
    });

    it('should show level tab when user is below level 80', () => {
      component.username = 'Trainer';
      component.userHistory = [{ created_at: '2024-01-01', level: 50, total_xp: 100000000 }];
      fixture.detectChanges();

      expect(component.isLevel80).toBeFalse();
      const buttons = fixture.nativeElement.querySelectorAll('.chart-tab');
      const buttonTexts = Array.from(buttons).map((b: any) => b.textContent.trim());
      expect(buttonTexts).toContain('Level');
    });

    it('should prevent setting metric to level if user is level 80 and fallback to total_xp', () => {
      component.username = 'Trainer';
      component.userHistory = [{ created_at: '2024-01-01', level: 80, total_xp: 200000000 }];
      fixture.detectChanges();

      component.setMetric('level');
      expect(component.selectedMetric).toBe('total_xp');
    });
  });
});
