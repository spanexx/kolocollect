import { AfterViewInit, Component, ElementRef } from '@angular/core';

@Component({
  selector: 'app-cta',
  standalone: true,
  imports: [],
  templateUrl: './cta.component.html',
  styleUrl: './cta.component.css'
})
export class CtaComponent implements AfterViewInit {

  constructor(private el: ElementRef) { }

  ngAfterViewInit(): void {
    const ctaSection = this.el.nativeElement.querySelector('.cta-section');
    
    window.addEventListener('scroll', () => {
      const sectionPos = ctaSection.getBoundingClientRect().top;
      const screenPos = window.innerHeight / 1.3;

      if (sectionPos < screenPos) {
        ctaSection.style.opacity = '1';  // Make visible
        ctaSection.style.animation = 'fadeInUp 1s ease-out forwards';
      }
    });
  }
}