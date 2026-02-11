import { Component, signal, HostListener, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Subsonic Producciones');

  isScrolled = signal(false);
  menuOpen = signal(false);
  formStatus = signal<'idle' | 'sending' | 'success' | 'error'>('idle');

  currentYear = new Date().getFullYear();

  contactForm = {
    nombre: '',
    email: '',
    tipoEvento: '',
    fecha: '',
    mensaje: ''
  };

  mixcloudUrls: SafeResourceUrl[] = [];

  particles = Array.from({ length: 20 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 4
  }));

  eqBars = Array.from({ length: 40 }, (_, i) => ({
    i,
    h: 20 + Math.random() * 80,
    d: Math.random() * 2
  }));

  private mixPaths = [
    '/Beatvicious/retromix/',
    '/Beatvicious/dj-kitan-eurodance/',
    '/Beatvicious/random_mix_vol2-beatvicious/',
    '/Beatvicious/random_mix_vol1-beatvicious/'
  ];

  constructor(private sanitizer: DomSanitizer, private http: HttpClient) {}

  ngOnInit(): void {
    this.mixcloudUrls = this.mixPaths.map(path =>
      this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${encodeURIComponent(path)}`
      )
    );
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 50);
  }

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.formStatus.set('sending');

    this.http.post('/api/contact', this.contactForm).subscribe({
      next: () => {
        this.formStatus.set('success');
        this.contactForm = { nombre: '', email: '', tipoEvento: '', fecha: '', mensaje: '' };
        setTimeout(() => this.formStatus.set('idle'), 5000);
      },
      error: () => {
        this.formStatus.set('error');
        setTimeout(() => this.formStatus.set('idle'), 5000);
      }
    });
  }
}
