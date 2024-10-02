import { AfterViewInit, Component } from '@angular/core';

@Component({
  selector: 'app-meter',
  standalone: true,
  imports: [],
  templateUrl: './meter.component.html',
  styleUrl: './meter.component.css'
})
export class MeterComponent implements AfterViewInit {

  ngAfterViewInit() {
    const counters = document.querySelectorAll('.count');

    counters.forEach((counter: any) => {
      counter.innerText = '0';

      const updateCounter = () => {
        const target = +counter.getAttribute('data-target');
        const current = +counter.innerText;

        const increment = target / 200;

        if (current < target) {
          counter.innerText = `${Math.ceil(current + increment)}`;
          setTimeout(updateCounter, 30);
        } else {
          counter.innerText = target.toLocaleString();  // Add commas to numbers
        }
      };

      updateCounter();
    });
  }
}