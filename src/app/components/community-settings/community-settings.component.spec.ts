import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunitySettingsComponent } from './community-settings.component';

describe('CommunitySettingsComponent', () => {
  let component: CommunitySettingsComponent;
  let fixture: ComponentFixture<CommunitySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunitySettingsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommunitySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
