import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogbookComponent } from './logbook.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';
import { getApiUrl } from '../config';

describe('LogbookComponent', () => {
  let component: LogbookComponent;
  let fixture: ComponentFixture<LogbookComponent>;
  let httpMock: HttpTestingController;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      user$: of({ googleId: 'test_user_id', email: 'test@test.com', name: 'Test' })
    };

    await TestBed.configureTestingModule({
      declarations: [ LogbookComponent ],
      imports: [ HttpClientTestingModule ],
      providers: [
        { provide: AuthService, useValue: mockAuthService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogbookComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    
    // Initial fetch from ngOnInit
    fixture.detectChanges();
    const req = httpMock.expectOne(`${getApiUrl()}/get-data`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, username: 'TestUser', level: 40 }]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create and fetch data on init', () => {
    expect(component).toBeTruthy();
    expect(component.stats.length).toBe(1);
    expect(component.stats[0].username).toBe('TestUser');
    expect(component.isLoading).toBeFalse();
  });

  it('should handle edit mode state correctly', () => {
    const row = { id: 1, username: 'TestUser' };
    
    component.startEdit(row);
    expect(component.editingRowId).toBe(1);
    expect(component.editData.username).toBe('TestUser');

    component.cancelEdit();
    expect(component.editingRowId).toBeNull();
    expect(component.editData).toEqual({});
  });

  it('should save edits and refresh data', () => {
    component.editingRowId = 1;
    component.editData = {
      username: 'UpdatedUser',
      level: 42,
      distance_walked: 10,
      caught: 100,
      stop_visited: 50,
      total_xp: 1000,
      entry_name: 'Test'
    };

    component.saveEdit();

    const putReq = httpMock.expectOne(`${getApiUrl()}/update-data/1`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body.username).toBe('UpdatedUser');
    expect(putReq.request.body.level).toBe(42);
    putReq.flush({ success: true });

    // It should fetch data again after save
    const getReq = httpMock.expectOne(`${getApiUrl()}/get-data`);
    getReq.flush([]);

    expect(component.editingRowId).toBeNull();
  });

  it('should delete entry if confirmed via dialog', () => {
    component.deleteConfirmDialog = {
      nativeElement: {
        showModal: jasmine.createSpy('showModal'),
        close: jasmine.createSpy('close')
      }
    } as any;

    component.openDeleteDialog(1);
    expect(component.pendingDeleteId).toBe(1);
    expect(component.deleteConfirmDialog.nativeElement.showModal).toHaveBeenCalled();

    component.confirmDelete();

    const deleteReq = httpMock.expectOne(`${getApiUrl()}/delete-data/1`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true });

    // It should fetch data again after delete
    const getReq = httpMock.expectOne(`${getApiUrl()}/get-data`);
    getReq.flush([]);

    expect(component.pendingDeleteId).toBeNull();
    expect(component.deleteConfirmDialog.nativeElement.close).toHaveBeenCalled();
  });

  it('should not delete entry if dialog is closed', () => {
    component.deleteConfirmDialog = {
      nativeElement: {
        showModal: jasmine.createSpy('showModal'),
        close: jasmine.createSpy('close')
      }
    } as any;

    component.openDeleteDialog(1);
    expect(component.pendingDeleteId).toBe(1);

    component.closeDeleteDialog();
    expect(component.pendingDeleteId).toBeNull();
    expect(component.deleteConfirmDialog.nativeElement.close).toHaveBeenCalled();

    component.confirmDelete();
    httpMock.expectNone(`${getApiUrl()}/delete-data/1`);
  });

  describe('calculateVelocity', () => {
    it('should calculate velocity for an exact 7 day difference', () => {
      component.stats = [
        { created_at: new Date('2023-10-08T10:00:00Z').toISOString(), caught: 200, total_xp: 2000, distance_walked: 20, stop_visited: 100, default_unit: 'km' },
        { created_at: new Date('2023-10-01T10:00:00Z').toISOString(), caught: 100, total_xp: 1000, distance_walked: 10, stop_visited: 50, default_unit: 'km' }
      ];
      component.calculateVelocity();
      expect(component.velocityLabel).toBe('Past 7 Days');
      expect(component.velocityStats).toEqual({
        caught: 100,
        total_xp: 1000,
        distance_walked: 10,
        stop_visited: 50,
        default_unit: 'km'
      });
    });

    it('should fallback to since last upload if no 7 day match is found (e.g. 1 day ago)', () => {
      component.stats = [
        { created_at: new Date('2023-10-08T10:00:00Z').toISOString(), caught: 200, total_xp: 2000, distance_walked: 20, stop_visited: 100, default_unit: 'km' },
        { created_at: new Date('2023-10-07T10:00:00Z').toISOString(), caught: 150, total_xp: 1500, distance_walked: 15, stop_visited: 75, default_unit: 'km' }
      ];
      component.calculateVelocity();
      expect(component.velocityLabel).toBe('Since Last Upload (1 day ago)');
      expect(component.velocityStats.caught).toBe(50);
    });

    it('should not calculate velocity if less than 2 entries', () => {
      component.stats = [
        { created_at: new Date('2023-10-08T10:00:00Z').toISOString(), caught: 200, total_xp: 2000, distance_walked: 20, stop_visited: 100, default_unit: 'km' }
      ];
      component.calculateVelocity();
      expect(component.velocityStats).toBeNull();
    });
  });

  describe('Comparison Functionality', () => {
    it('should toggle selection correctly up to 2 items', () => {
      component.toggleSelection(1);
      expect(component.isSelected(1)).toBeTrue();
      expect(component.selectedEntryIds.size).toBe(1);

      component.toggleSelection(2);
      expect(component.isSelected(2)).toBeTrue();
      expect(component.selectedEntryIds.size).toBe(2);

      // Should not add a 3rd
      component.toggleSelection(3);
      expect(component.isSelected(3)).toBeFalse();
      expect(component.selectedEntryIds.size).toBe(2);

      // Should remove if already selected
      component.toggleSelection(1);
      expect(component.isSelected(1)).toBeFalse();
      expect(component.selectedEntryIds.size).toBe(1);
    });

    it('should clear selection', () => {
      component.toggleSelection(1);
      component.clearSelection();
      expect(component.selectedEntryIds.size).toBe(0);
      expect(component.comparisonResult).toBeNull();
    });

    it('should compute comparison deltas correctly and open dialog', () => {
      component.compareDialog = {
        nativeElement: {
          showModal: jasmine.createSpy('showModal'),
          close: jasmine.createSpy('close')
        }
      } as any;

      component.stats = [
        { id: 1, created_at: new Date('2023-10-01T10:00:00Z').toISOString(), total_xp: 1000, distance_walked: 10, caught: 100, stop_visited: 50, level: 20 },
        { id: 2, created_at: new Date('2023-10-05T10:00:00Z').toISOString(), total_xp: 5000, distance_walked: 50, caught: 500, stop_visited: 250, level: 25 }
      ];

      component.toggleSelection(1);
      component.toggleSelection(2);
      component.compareSelected();

      expect(component.comparisonResult).not.toBeNull();
      expect(component.comparisonResult.delta.total_xp).toBe(4000);
      expect(component.comparisonResult.delta.distance_walked).toBe(40);
      expect(component.comparisonResult.delta.caught).toBe(400);
      expect(component.comparisonResult.delta.stop_visited).toBe(200);
      expect(component.comparisonResult.delta.level).toBe(5);

      expect(component.compareDialog.nativeElement.showModal).toHaveBeenCalled();
    });

    it('should close compare dialog and clear selection', () => {
      component.compareDialog = {
        nativeElement: {
          showModal: jasmine.createSpy('showModal'),
          close: jasmine.createSpy('close')
        }
      } as any;

      component.toggleSelection(1);
      component.closeCompareDialog();

      expect(component.compareDialog.nativeElement.close).toHaveBeenCalled();
      expect(component.selectedEntryIds.size).toBe(0);
    });
  });
});
