/**
 * Frames a phone-admin screen inside the desktop panel: a centred column the
 * width the screen was designed for, so it reads the same as on the phone.
 */
export default function DeskFrame({ children, width = 640 }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="px-6 py-6">
      <div className="mx-auto bg-white min-h-[calc(100vh-3rem)] relative overflow-clip"
        style={{ maxWidth: width, borderRadius: 16, boxShadow: "0 0 24px rgba(0,0,0,0.06)" }}>
        {children}
      </div>
    </div>
  );
}
