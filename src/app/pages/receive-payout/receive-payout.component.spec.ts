import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReceivePayoutComponent } from './receive-payout.component';

describe('ReceivePayoutComponent', () => {
  let component: ReceivePayoutComponent;
  let fixture: ComponentFixture<ReceivePayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceivePayoutComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ReceivePayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
