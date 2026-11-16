type BrandLogoProps = { className?: string };

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img src={`${import.meta.env.BASE_URL}logodj3hitam.png?v=20261116`} alt="DJ3 Engineering" />
    </span>
  );
}
