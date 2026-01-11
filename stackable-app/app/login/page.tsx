import Link from "next/link"

const page = () => {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white text-black">
  {/* LEFT SIDE – IMAGE + OVERLAY */}
  <div className="relative hidden md:flex items-center justify-center bg-[#515244] rounded-[12px]">
    
    {/* Background image */}
    <div className="absolute inset-0 overflow-hidden mt-10">
    <img
      src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/Teacher%20laptop%202.png"
      alt="Teacher"
      className="absolute inset-0 w-full h-full object-cover"
    />
</div>
    {/* Dark overlay */}
<div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,0)_0%,rgba(81,82,68,0.9)_55%,rgba(81,82,68,1)_70%)] mb-80">
</div>

    {/* Overlay text */}
    <div className="relative z-10 px-10 text-center text-white mb-116">
      <h2 className="text-7xl font-semibold leading-tight font-ABeeZee">
        Built for better <br />
        <span className="text-[#F9B233]">learning</span>
      </h2>
    </div>
  </div>

  {/* RIGHT SIDE – FORM */}
  <div className="flex items-center justify-center px-6">
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex justify-center mb-12">
        <img
          src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/Artboard%203.png"
          alt="Stackable logo"
          className="h-22"
        />
      </div>

      {/* Form */}
      <form className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold font-Inter">Sign In</h2>
          <p className="mt-1 text-sm text-gray-500 font-Inter">
            Sign in if you already have an account
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Email address</label>
          <input
            type="email"
            placeholder="stackable@example.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#F9B233]"
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            placeholder="••••••••••"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#F9B233]"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded-lg bg-[#FFF4C2] py-3 font-medium text-black hover:bg-[#F9E38C] transition"
        >
          Continue
        </button>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="mx-4 text-xs text-gray-400 uppercase tracking-wide whitespace-nowrap">
            or sign in with
          </span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Google button */}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 py-2 hover:bg-gray-50 transition"
        >
          <img
            src="https://ceuppatdypoutimqdglm.supabase.co/storage/v1/object/public/Web-Images/google.png"
            alt="Google"
            className="h-5 w-5"
          />
          <span className="text-sm font-medium">Sign in with Google</span>
        </button>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Don&apos;t have access?{" "}
          <Link
            href="/request-demo"
            className="text-[#F9B233] font-medium hover:underline"
          >
            Request demo
          </Link>
        </p>
      </form>
    </div>
  </div>
</div>

  )
}

export default page