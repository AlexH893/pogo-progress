import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FunFactComponent } from './fun-fact.component';

describe('FunFactComponent', () => {
  let component: FunFactComponent;
  let fixture: ComponentFixture<FunFactComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FunFactComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FunFactComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the fun fact if provided', () => {
    component.funFact = 'You have walked a lot!';
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('.fun-fact-content p');
    expect(p.textContent).toContain('You have walked a lot!');
  });

  it('should emit shuffleClicked when shuffle button is clicked', () => {
    spyOn(component.shuffleClicked, 'emit');
    component.funFact = 'Test fact';
    fixture.detectChanges();
    
    const button = fixture.nativeElement.querySelector('.edit-btn');
    button.click();

    expect(component.shuffleClicked.emit).toHaveBeenCalled();
  });
});
