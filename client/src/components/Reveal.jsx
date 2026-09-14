import { useEffect, useRef } from 'react';

/**
 * Lightweight scroll reveal. Adds the `on` class when the element enters the
 * viewport (or is already inside it on mount). Falls back to instantly
 * visible when IntersectionObserver is unavailable.
 */
export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('on');
      return undefined;
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            node.classList.add('on');
            observer.disconnect();
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`rv ${className}`} style={delay ? { '--rvd': `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}
