// The client's original logo, shown as it is: on a plate of its own light background,
// because the file is opaque with black lettering (no transparent or vector version yet).
import logo from '../assets/brand/aerovia-logo.webp';
import symbol from '../assets/brand/aerovia-symbol.webp';
import { brand } from '../content/site';

export function SymbolPlate({ className = '' }: { className?: string }) {
  return (
    <span className={`plate plate-symbol ${className}`}>
      <img src={symbol} alt="" width="74" height="64" />
    </span>
  );
}

export function LogoPlate({ className = '' }: { className?: string }) {
  return (
    <span className={`plate plate-logo ${className}`}>
      <img src={logo} alt={brand.name} width="557" height="480" loading="lazy" decoding="async" />
    </span>
  );
}
