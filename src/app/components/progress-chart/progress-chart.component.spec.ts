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

  it('should change metric and update chart', () => {
    spyOn<any>(component, 'updateChart');
    
    component.setMetric('caught');

    expect(component.selectedMetric).toBe('caught');
    expect((component as any).updateChart).toHaveBeenCalled();
  });
});
