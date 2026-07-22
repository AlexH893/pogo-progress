import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogbookComponent } from './logbook.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { of } from 'rxjs';
import { getApiUrl } from '../config';

describe('LogbookComponent', () => {
  let component: LogbookComponent;
  let fixture: ComponentFixture<LogbookComponent>;
  let httpMock: HttpTestingController;
  let mockAuthService: any;

  let mockToastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    mockAuthService = {
      user$: of({ googleId: 'test_user_id', email: 'test@test.com', name: 'Test' })
    };
    mockToastService = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      declarations: [ LogbookComponent ],
      imports: [ HttpClientTestingModule ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogbookComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    
    // Initial fetch from ngOnInit
    fixture.detectChanges();
    const chartReq = httpMock.expectOne(`${getApiUrl()}/get-chart-data`);
    chartReq.flush([]);
    const req = httpMock.expectOne(`${getApiUrl()}/get-data?limit=20&offset=0&sortField=created_at&sortDir=desc`);
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
    const chartReqSave = httpMock.expectOne(`${getApiUrl()}/get-chart-data`);
    chartReqSave.flush([]);
    const getReq = httpMock.expectOne(`${getApiUrl()}/get-data?limit=20&offset=0&sortField=created_at&sortDir=desc`);
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
    const chartReqDel = httpMock.expectOne(`${getApiUrl()}/get-chart-data`);
    chartReqDel.flush([]);
    const getReq = httpMock.expectOne(`${getApiUrl()}/get-data?limit=20&offset=0&sortField=created_at&sortDir=desc`);
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
      component.chartData = [
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
      component.chartData = [
        { created_at: new Date('2023-10-08T10:00:00Z').toISOString(), caught: 200, total_xp: 2000, distance_walked: 20, stop_visited: 100, default_unit: 'km' },
        { created_at: new Date('2023-10-07T10:00:00Z').toISOString(), caught: 150, total_xp: 1500, distance_walked: 15, stop_visited: 75, default_unit: 'km' }
      ];
      component.calculateVelocity();
      expect(component.velocityLabel).toBe('Since Last Upload (1 day ago)');
      expect(component.velocityStats.caught).toBe(50);
    });

    it('Bug 5: should calculate velocity based on chronological order even if stats array is unsorted', () => {
      // The old array from the test above but backward (oldest first).
      // The component should sort it newest first internally before calculating.
      component.chartData = [
        { created_at: new Date('2023-10-01T10:00:00Z').toISOString(), caught: 100, total_xp: 1000, distance_walked: 10, stop_visited: 50, default_unit: 'km' },
        { created_at: new Date('2023-10-08T10:00:00Z').toISOString(), caught: 200, total_xp: 2000, distance_walked: 20, stop_visited: 100, default_unit: 'km' }
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

    it('should not calculate velocity if less than 2 entries', () => {
      component.chartData = [
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

  // ─── Bug 3: Delete failure ─────────────────────────────────────────────────
  describe('Bug 3: confirmDelete error handling', () => {
    beforeEach(() => {
      component.deleteConfirmDialog = {
        nativeElement: {
          showModal: jasmine.createSpy('showModal'),
          close: jasmine.createSpy('close')
        }
      } as any;
    });

    it('should show an error toast and close the dialog when the DELETE request fails', () => {
      component.openDeleteDialog(1);
      component.confirmDelete();

      const deleteReq = httpMock.expectOne(`${getApiUrl()}/delete-data/1`);
      deleteReq.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      // Dialog must be closed so it doesn't hang open
      expect(component.deleteConfirmDialog.nativeElement.close).toHaveBeenCalled();
      // pendingDeleteId must be cleared
      expect(component.pendingDeleteId).toBeNull();
      // User must see an error toast
      expect(mockToastService.show).toHaveBeenCalledWith(
        'Failed to delete entry. Please try again.',
        'error'
      );
    });

    it('should NOT show a toast or close the dialog on a successful DELETE', () => {
      component.openDeleteDialog(1);
      component.confirmDelete();

      const deleteReq = httpMock.expectOne(`${getApiUrl()}/delete-data/1`);
      deleteReq.flush({ success: true });

      // Drain the follow-up GET
      const chartReqDel2 = httpMock.expectOne(`${getApiUrl()}/get-chart-data`);
      chartReqDel2.flush([]);
      const getReq = httpMock.expectOne(`${getApiUrl()}/get-data?limit=20&offset=0&sortField=created_at&sortDir=desc`);
      getReq.flush([]);

      expect(mockToastService.show).not.toHaveBeenCalled();
    });
  });

  // ─── Bug 4: startEdit clears editingCell ───────────────────────────────────
  describe('Bug 4: startEdit clears any open inline cell first', () => {
    it('should set editingCell to null before activating row-edit mode', () => {
      const row = { id: 1, username: 'TestUser', level: 40,
        distance_walked: 10, caught: 100, stop_visited: 50,
        total_xp: 1000, entry_name: 'Entry' };

      // Simulate an open inline cell on the same row
      component.editingCell = { id: 1, field: 'level' };

      component.startEdit(row);

      // editingCell must be cleared before row-edit takes over
      expect(component.editingCell).toBeNull();
      expect(component.editingRowId).toBe(1);
    });

    it('should clear editingCell even when switching from a different row', () => {
      // Pre-warm state: inline cell on row 2 is open
      component.editingCell = { id: 2, field: 'caught' };
      // Row 1 is in full row-edit mode (editingRowId set without a real save)
      component.editingRowId = 1;
      component.editData = { id: 1, username: 'TestUser', level: 40,
        distance_walked: 10, caught: 100, stop_visited: 50,
        total_xp: 1000, entry_name: 'Entry' };

      const row2 = { id: 2, username: 'OtherUser', level: 35,
        distance_walked: 5, caught: 50, stop_visited: 20,
        total_xp: 500, entry_name: 'Row2' };

      component.startEdit(row2);

      // The previous row's save PUT should have fired
      const putReq = httpMock.expectOne(`${getApiUrl()}/update-data/1`);
      putReq.flush({ success: true });
      const chartReqEdit = httpMock.expectOne(`${getApiUrl()}/get-chart-data`);
      chartReqEdit.flush([]);
      const getReq = httpMock.expectOne(`${getApiUrl()}/get-data?limit=20&offset=0&sortField=created_at&sortDir=desc`);
      getReq.flush([]);

      // Inline cell must be gone regardless
      expect(component.editingCell).toBeNull();
      expect(component.editingRowId).toBe(2);
    });
  });

  // ─── Bug 6: native dialog Escape routes through our close handler ──────────
  describe('Bug 6: native dialog cancel event (Escape key) clears selection', () => {
    it('should call closeCompareDialog() and clear selectedEntryIds when cancel fires on compareDialog', () => {
      // Set up compare dialog mock with addEventListener
      let cancelHandler: ((e: Event) => void) | null = null;
      const mockDialogEl = {
        showModal: jasmine.createSpy('showModal'),
        close: jasmine.createSpy('close'),
        addEventListener: (event: string, handler: (e: Event) => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }
      };
      component.compareDialog = { nativeElement: mockDialogEl } as any;

      // Trigger ngAfterViewInit to register the cancel listener
      component.ngAfterViewInit();

      // Simulate 2 selected entries (the state before opening the dialog)
      component.toggleSelection(1);
      component.toggleSelection(2);
      expect(component.selectedEntryIds.size).toBe(2);

      // Simulate browser firing the 'cancel' event (Escape key)
      const cancelEvent = new Event('cancel', { cancelable: true });
      cancelHandler!(cancelEvent);

      // Selection must be cleared, same as if the close button was clicked
      expect(component.selectedEntryIds.size).toBe(0);
      expect(component.comparisonResult).toBeNull();
      // And the dialog itself must be closed
      expect(mockDialogEl.close).toHaveBeenCalled();
    });

    it('should call closeDeleteDialog() and clear pendingDeleteId when cancel fires on deleteConfirmDialog', () => {
      let cancelHandler: ((e: Event) => void) | null = null;
      const mockDialogEl = {
        showModal: jasmine.createSpy('showModal'),
        close: jasmine.createSpy('close'),
        addEventListener: (event: string, handler: (e: Event) => void) => {
          if (event === 'cancel') cancelHandler = handler;
        }
      };
      component.deleteConfirmDialog = { nativeElement: mockDialogEl } as any;

      component.ngAfterViewInit();

      component.pendingDeleteId = 42;

      const cancelEvent = new Event('cancel', { cancelable: true });
      cancelHandler!(cancelEvent);

      expect(component.pendingDeleteId).toBeNull();
      expect(mockDialogEl.close).toHaveBeenCalled();
    });
  });
});
