import { Component } from '@angular/core';
import { FeatureHighlightsComponent } from '../feature-highlights/feature-highlights.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [FeatureHighlightsComponent, RouterModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css'
})
export class HeroComponent {

}
