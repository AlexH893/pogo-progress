import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send the correct payload in updateUserPreferences', () => {
    const httpTestingController = TestBed.inject(HttpTestingController);
    
    service.updateUserPreferences('TrainerOne', 'km', true, false).subscribe();

    const req = httpTestingController.expectOne((request) => request.url.includes('/user-preferences/TrainerOne'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      defaultUnit: 'km',
      showFunFacts: true,
      displayTutorial: false
    });
    
    req.flush({ success: true });
    httpTestingController.verify();
  });
});
