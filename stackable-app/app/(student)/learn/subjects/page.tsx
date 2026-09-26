import { BookOpenText } from "lucide-react";

export default function SubjectsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-bold text-[22px] mt-[10px]">My Subjects</h1>
      <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100/60 flex items-center justify-center">
          <BookOpenText className="h-7 w-7 text-blue-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-lg">Coming Soon</p>
          <p className="text-sm text-gray-500 mt-1">
            Your subject details and resources will be available here shortly.
          </p>
        </div>
      </div>
    </div>
  );
}
