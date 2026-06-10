import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { SettingsComponent } from './settings.component';
import { SettingsService } from './settings.service';
import { of } from 'rxjs';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ HttpClientTestingModule, FormsModule ],
      declarations: [ SettingsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call updateUserPreferences with display_tutorial', () => {
    const settingsService = TestBed.inject(SettingsService);
    spyOn(settingsService, 'updateUserPreferences').and.returnValue(of({ success: true }));

    const pref = {
      username: 'TrainerOne',
      default_unit: 'km' as const,
      show_fun_facts: true,
      display_tutorial: false
    };

    component.savePreferences(pref);

    expect(settingsService.updateUserPreferences).toHaveBeenCalledWith('TrainerOne', 'km', true, false);
  });
});
