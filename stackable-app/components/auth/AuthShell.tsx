import Image from "next/image";

// The two-column auth layout (brand panel + form column), shared by /login and /forgot-password.
// `children` render in the form column under the logo; fixed overlays (modals) can be placed in
// `children` too, because fixed elements ignore the column.
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white text-black">
      {/* LEFT SIDE – IMAGE + OVERLAY */}
      <div className="relative hidden md:flex items-center justify-center bg-[#251a00] rounded-[12px]">
        {/* Background image */}
        <div className="absolute inset-0 overflow-hidden mt-10">
          <Image
            src="/images/student-using-stackable.png"
            alt="Student"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            width={4500}
            height={4500}
          />
        </div>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0)_0%,rgba(120,90,0,0.9)_55%,rgba(120,90,0,1)_70%)] mb-80 pointer-events-none"></div>

        {/* Overlay text */}
        <div className="relative z-10 px-10 text-center text-white mb-116 w-full">
          <h2 className="text-[86px] font-normal leading-tight font-image">
            Built for better <br />
            <span className="text-[#ECB938]">learning</span>
          </h2>
          <div className="absolute inset-0 z-10 flex items-center justify-center -translate-y-1/4 pointer-events-none">
            <Image
              src="/images/Eclipse.png"
              alt=""
              width={500}
              height={500}
              className="w-[62vw] max-w-[420px] min-w-[200px] h-auto"
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE – FORM */}
      <div className="flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8 mt-[-20px] w-full h-22">
            <Image
              src="/logos/stackable-symbol.webp"
              alt="Stackable logo"
              className="h-auto"
              width={600}
              height={600}
              sizes="70vw"
              style={{ width: "auto", height: "66" }}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
