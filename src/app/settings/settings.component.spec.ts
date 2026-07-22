import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { SettingsService, UserPreferences } from './settings.service';
import { AuthService } from '../services/auth.service';
import * as fileSaver from 'file-saver';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const settingsSpy = jasmine.createSpyObj('SettingsService', ['getUserPreferences', 'updateUserPreferences', 'exportData', 'unlinkTrainer', 'deleteAccount']);
    const authSpy = jasmine.createSpyObj('AuthService', ['getToken', 'signOut']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ HttpClientTestingModule, FormsModule ],
      declarations: [ SettingsComponent ],
      providers: [
        { provide: SettingsService, useValue: settingsSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    settingsService = TestBed.inject(SettingsService) as jasmine.SpyObj<SettingsService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should set error if user is not signed in', () => {
      authService.getToken.and.returnValue(null);
      fixture.detectChanges(); // calls ngOnInit
      expect(component.error).toBe('Please sign in to view settings.');
      expect(component.isLoading).toBeFalse();
    });

    it('should load preferences if user is signed in', () => {
      authService.getToken.and.returnValue('mock-token');
      const mockPref: UserPreferences = { username: 'Trainer', default_unit: 'km', show_fun_facts: true, display_tutorial: true };
      settingsService.getUserPreferences.and.returnValue(of(mockPref));
      
      fixture.detectChanges(); // calls ngOnInit
      expect(component.preference).toEqual(mockPref);
      expect(component.isLoading).toBeFalse();
      expect(component.error).toBe('');
    });
  });

  describe('loadPreferences', () => {
    it('should handle error when loading preferences fails', () => {
      settingsService.getUserPreferences.and.returnValue(throwError(() => new Error('API error')));
      component.loadPreferences();
      expect(component.error).toBe('Failed to load preferences.');
      expect(component.isLoading).toBeFalse();
    });
  });

  describe('savePreferences', () => {
    it('should call updateUserPreferences and handle success', fakeAsync(() => {
      settingsService.updateUserPreferences.and.returnValue(of({ success: true }));
      const mockPref: UserPreferences = { username: 'Trainer', default_unit: 'km', show_fun_facts: true, display_tutorial: true };
      
      component.savePreferences(mockPref);
      expect(settingsService.updateUserPreferences).toHaveBeenCalledWith('Trainer', 'km', true, true);
      expect(component.successMsg).toBe('Settings saved for Trainer');
      
      tick(3000);
      expect(component.successMsg).toBe('');
    }));

    it('should handle error when saving preferences fails', () => {
      settingsService.updateUserPreferences.and.returnValue(throwError(() => new Error('API error')));
      const mockPref: UserPreferences = { username: 'Trainer', default_unit: 'km', show_fun_facts: true, display_tutorial: true };
      
      component.savePreferences(mockPref);
      expect(component.error).toBe('Failed to save settings.');
    });
  });

  describe('exportData', () => {
    it('should export data on success', () => {
      const mockData = [{ key: 'value' }];
      settingsService.exportData.and.returnValue(of(mockData));
      spyOn(fileSaver, 'saveAs');
      
      component.exportData();
      
      expect(settingsService.exportData).toHaveBeenCalled();
      expect(fileSaver.saveAs).toHaveBeenCalled();
      const callArgs = (fileSaver.saveAs as any).calls.first().args;
      expect(callArgs[0] instanceof Blob).toBeTrue();
      expect(callArgs[1]).toBe('pogo-progress-data.json');
    });

    it('should handle error when export fails', () => {
      settingsService.exportData.and.returnValue(throwError(() => new Error('API error')));
      component.exportData();
      expect(component.error).toBe('Failed to export data.');
    });
  });

  describe('unlinkTrainer', () => {
    it('should unlink trainer on confirmation', fakeAsync(() => {
      spyOn(window, 'confirm').and.returnValue(true);
      settingsService.unlinkTrainer.and.returnValue(of({ success: true }));
      component.preference = { username: 'Trainer', default_unit: 'km', show_fun_facts: true, display_tutorial: true };
      
      component.unlinkTrainer('Trainer');
      
      expect(settingsService.unlinkTrainer).toHaveBeenCalledWith('Trainer');
      expect(component.preference).toBeNull();
      expect(component.successMsg).toBe('Unlinked trainer successfully.');
      tick(3000);
      expect(component.successMsg).toBe('');
    }));

    it('should do nothing if confirmation is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.unlinkTrainer('Trainer');
      expect(settingsService.unlinkTrainer).not.toHaveBeenCalled();
    });

    it('should handle error when unlink fails', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      settingsService.unlinkTrainer.and.returnValue(throwError(() => new Error('API error')));
      component.unlinkTrainer('Trainer');
      expect(component.error).toBe('Failed to unlink trainer.');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account, sign out and navigate on confirmation', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      settingsService.deleteAccount.and.returnValue(of({ success: true }));
      
      component.deleteAccount();
      
      expect(settingsService.deleteAccount).toHaveBeenCalled();
      expect(authService.signOut).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should do nothing if confirmation is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.deleteAccount();
      expect(settingsService.deleteAccount).not.toHaveBeenCalled();
    });

    it('should handle error when delete fails', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      settingsService.deleteAccount.and.returnValue(throwError(() => new Error('API error')));
      component.deleteAccount();
      expect(component.error).toBe('Failed to delete account.');
    });
  });
});
