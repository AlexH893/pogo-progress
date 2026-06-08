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

  it('should delete entry if confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.deleteEntry(1);

    const deleteReq = httpMock.expectOne(`${getApiUrl()}/delete-data/1`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true });

    // It should fetch data again after delete
    const getReq = httpMock.expectOne(`${getApiUrl()}/get-data`);
    getReq.flush([]);
  });

  it('should not delete entry if not confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(false);

    component.deleteEntry(1);

    httpMock.expectNone(`${getApiUrl()}/delete-data/1`);
  });
});
