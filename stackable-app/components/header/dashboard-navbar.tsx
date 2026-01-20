'use client';

export default function Navbar() {
  return (
    <header className="h-16 bg-white border-b flex items-center px-6 fixed top-0 left-64 right-0 z-10">
      <input
        placeholder="Search anything"
        className="border rounded px-4 py-2 w-96"
      />
      <div className="ml-auto flex gap-4 items-center">
        <span>🔔</span>
        <span>🌙</span>
        <span className="font-medium">Joe Doe</span>
      </div>
    </header>
  );
}
