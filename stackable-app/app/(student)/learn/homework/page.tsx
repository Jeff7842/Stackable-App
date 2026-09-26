import { NotebookPen } from "lucide-react";

export default function HomeworkPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-bold text-[22px] mt-[10px]">Homework</h1>
      <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-yellow-100/60 flex items-center justify-center">
          <NotebookPen className="h-7 w-7 text-yellow-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-lg">Coming Soon</p>
          <p className="text-sm text-gray-500 mt-1">
            Homework assignments and submissions will be available here shortly.
          </p>
        </div>
      </div>
    </div>
  );
}
