import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeatureHighlightsComponent } from './feature-highlights.component';

describe('FeatureHighlightsComponent', () => {
  let component: FeatureHighlightsComponent;
  let fixture: ComponentFixture<FeatureHighlightsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureHighlightsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FeatureHighlightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
