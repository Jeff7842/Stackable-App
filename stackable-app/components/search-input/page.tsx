
export default function SearchInputPage() {
    return (
        <>
        <div className="relative hidden mr-3 md:block w-42 lg:w-66 rounded-[15px] overflow-hidden border border-gray-300 focus:outline-2 focus:outline-amber-300  bg-white">
            {/* Button */}
            <button
              className="absolute left-[4px] top-1/2 -translate-y-1/2
      rounded-full w-8 h-8 bg-transparent flex items-center justify-center cursor-pointer hover:bg-[#000000] hover:text-white hover:scale-[1.06] hover:text-gray-500 transition-all duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
                <path d="M21 21l-6 -6" />
              </svg>
            </button>

            {/* Input */}
            <input
              placeholder="Search anything..."
              className="w-full text-[14px] px-2 py-2 pl-11 rounded-[15px] outline-none font-open focus:outline-amber-300 focus:border-black focus:outline-2" />
          </div>
          </>
    );
}
