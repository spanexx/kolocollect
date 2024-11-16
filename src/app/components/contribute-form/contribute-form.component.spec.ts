import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContributeFormComponent } from './contribute-form.component';

describe('ContributeFormComponent', () => {
  let component: ContributeFormComponent;
  let fixture: ComponentFixture<ContributeFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContributeFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ContributeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
