import { Component } from '@angular/core';
import { HeroComponent } from '../components/hero/hero.component';
import { FeatureHighlightsComponent } from "../components/feature-highlights/feature-highlights.component";
import { HowItWorksComponent } from '../components/how-it-works/how-it-works.component';
import { MeterComponent } from '../components/meter/meter.component';
import { TestimonialsComponent } from '../components/testimonials/testimonials.component';
import { CtaComponent } from '../components/cta/cta.component';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [HeroComponent, FeatureHighlightsComponent, 
    HowItWorksComponent, MeterComponent, TestimonialsComponent,
    CtaComponent
  ],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.css'
})
export class HomepageComponent {

}
