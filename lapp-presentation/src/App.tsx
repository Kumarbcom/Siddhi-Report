import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Zap, Settings, Shield, Link2, Minimize2, Cpu } from 'lucide-react';

interface SlideData {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
}

const slidesData: SlideData[] = [
  {
    id: 1,
    title: "Drag Chains",
    subtitle: "LAPP SILVYN® CHAIN",
    description: "LAPP's SILVYN® CHAIN systems are designed for cable protection and management in dynamic applications. They ensure cables remain secure and functional during continuous equipment movement.",
    icon: <Link2 size={48} color="#FF7900" />
  },
  {
    id: 2,
    title: "Continuous Movement",
    subtitle: "ÖLFLEX® SERVO FD",
    description: "ÖLFLEX® FD cables are highly flexible cables specifically engineered for continuous movement within drag chains. Suitable for applications requiring high flexibility and durability in constantly moving parts.",
    icon: <Zap size={48} color="#FF7900" />
  },
  {
    id: 3,
    title: "Control Cabinet & Glands",
    subtitle: "LAPP SKINTOP®",
    description: "SKINTOP® cable glands provide secure, strain-relieved, and often liquid-tight cable entry into control cabinets, ensuring absolute safety for sensitive internal components.",
    icon: <Shield size={48} color="#FF7900" />
  },
  {
    id: 4,
    title: "Cabinet Wiring",
    subtitle: "LAPP ÖLFLEX® UNIPLUS",
    description: "ÖLFLEX® UNIPLUS single-core cables are ideal for internal wiring of devices and control cabinets, delivering reliable power distribution.",
    icon: <Cpu size={48} color="#FF7900" />
  },
  {
    id: 5,
    title: "Cable Bundling",
    subtitle: "LAPP KW Plastic Coil",
    description: "KW plastic coils are used for easy and quick bundling of cables, providing mechanical protection and clean organization throughout the equipment.",
    icon: <Minimize2 size={48} color="#FF7900" />
  },
  {
    id: 6,
    title: "Circular Connectors",
    subtitle: "LAPP EPIC® M12",
    description: "EPIC® circular connectors, such as M12 connectors, are suitable for robust data, signal, and power connections in industrial applications, offering vibration protection and easy assembly.",
    icon: <Settings size={48} color="#FF7900" />
  },
  {
    id: 7,
    title: "Data & Connectivity",
    subtitle: "UNITRONIC® & ETHERLINE®",
    description: "UNITRONIC® (Data & Communication Cables) and ETHERLINE® (Industrial Ethernet Cables) are used for reliable data transmission, laptop connections, and network connectivity.",
    icon: <Zap size={48} color="#FF7900" />
  }
];

function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = slidesData.length + 2; // + title slide + end slide

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      }
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  return (
    <div className="presentation-container">
      <header className="header">
        <div className="logo">LAPP Integration</div>
        <div className="slide-counter">
          {currentSlide + 1} / {totalSlides}
        </div>
      </header>

      <main className="slides-wrapper">
        {/* Title Slide */}
        <div className={`slide ${currentSlide === 0 ? 'active' : currentSlide > 0 ? 'previous' : ''}`}>
          <div className="title-slide content-slide full-width">
            <div>
              <h1>LAPP Products</h1>
              <h2>Equipment Integration Showcase</h2>
              <p className="slide-description" style={{ marginTop: '20px', maxWidth: '600px', margin: '20px auto' }}>
                A comprehensive overview of LAPP cable, connector, and management solutions used in our advanced machinery.
              </p>
            </div>
          </div>
        </div>

        {/* Content Slides */}
        {slidesData.map((slide, index) => {
          const slideIndex = index + 1;
          let slideClass = 'slide';
          if (currentSlide === slideIndex) slideClass += ' active';
          else if (currentSlide > slideIndex) slideClass += ' previous';

          return (
            <div key={slide.id} className={slideClass}>
              <div className="content-slide">
                <div className="text-content">
                  <div className="slide-number-badge">{slide.id}</div>
                  <h2 className="slide-title">{slide.title}</h2>
                  <h3 className="slide-subtitle">{slide.subtitle}</h3>
                </div>
                <div className="card-view">
                  <div style={{ marginBottom: '20px' }}>{slide.icon}</div>
                  <p className="slide-description">{slide.description}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* End Slide */}
        <div className={`slide ${currentSlide === totalSlides - 1 ? 'active' : ''}`}>
          <div className="title-slide content-slide full-width">
            <div>
              <h2>Thank You</h2>
              <h1 style={{ fontSize: '3rem', marginTop: '10px' }}>Equipment Integration with LAPP</h1>
            </div>
          </div>
        </div>
      </main>

      <div className="controls">
        <button 
          className="btn" 
          onClick={prevSlide} 
          disabled={currentSlide === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft />
        </button>
        <button 
          className="btn" 
          onClick={nextSlide} 
          disabled={currentSlide === totalSlides - 1}
          aria-label="Next slide"
        >
          <ChevronRight />
        </button>
      </div>

      <div 
        className="progress-bar" 
        style={{ width: `${((currentSlide) / (totalSlides - 1)) * 100}%` }}
      />
    </div>
  );
}

export default App;
