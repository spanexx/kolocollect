import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WithdrawFundComponent } from './withdraw-fund.component';

describe('WithdrawFundComponent', () => {
  let component: WithdrawFundComponent;
  let fixture: ComponentFixture<WithdrawFundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WithdrawFundComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WithdrawFundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
