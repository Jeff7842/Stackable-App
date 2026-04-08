"use client";

import { X } from "lucide-react";
import { classNames, isYoutubeUrl, toYoutubeEmbedUrl, type SubjectResourceCard } from "@/lib/subjects";

type MediaViewerProps = {
  open: boolean;
  resource: SubjectResourceCard | null;
  onClose: () => void;
};

export default function MediaViewer({ open, resource, onClose }: MediaViewerProps) {
  if (!open || !resource) return null;

  const source = resource.sourceUrl || resource.storagePath || "";
  const youtubeEmbed = isYoutubeUrl(resource.sourceUrl) ? toYoutubeEmbedUrl(resource.sourceUrl) : null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close media viewer overlay"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[4px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-gray-100 bg-white shadow-[0_35px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{resource.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{resource.resourceType}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-[#F8FAFC] p-6">
          <div className="overflow-hidden rounded-[24px] border border-gray-100 bg-white">
            {youtubeEmbed ? (
              <iframe
                src={youtubeEmbed}
                title={resource.title}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : resource.resourceType === "audio" ? (
              <div className="p-10">
                <audio controls className="w-full">
                  <source src={source} />
                </audio>
              </div>
            ) : resource.resourceType === "video" ? (
              <video controls className="aspect-video w-full bg-black">
                <source src={source} />
              </video>
            ) : resource.resourceType === "link" ? (
              <div className="p-10 text-center">
                <a
                  href={resource.sourceUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white"
                >
                  Open external resource
                </a>
              </div>
            ) : (
              <div className="p-10 text-center">
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className={classNames(
                    "inline-flex rounded-[16px] bg-[#108548] px-5 py-3 text-sm font-semibold text-white",
                    !source && "pointer-events-none opacity-50",
                  )}
                >
                  Open resource
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
