// components/HeaderLogo.tsx
export default function HeaderLogo() {
  return (
    <div className="flex justify-center py-6">
      <img
        src="/CHECK24_Logo_Nova-Blue (1).svg"
        alt="CHECK24 Logo"
        className="h-16 md:h-20 max-w-xs object-contain"
        style={{ marginTop: '8px', marginBottom: '16px' }}
      />
    </div>
  );
}
