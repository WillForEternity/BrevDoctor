"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export function AboutCreators() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const creators = [
    {
      name: "Will",
      role: "Co-Founder",
      bio: "Passionate about leveraging AI to simplify complex infrastructure decisions and empower developers.",
      avatar: "/creator2.jpeg",
      imageStyle: "scale-[1.85] -translate-x-2", // Zoom in more and shift left on Will
    },
    {
      name: "Andrey",
      role: "Co-Founder",
      bio: "Building tools to make GPU infrastructure accessible and intelligent for developers everywhere.",
      avatar: "/creator1.jpeg",
      imageStyle: "", // No zoom
    },
  ];

  const modal = isOpen && mounted ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl max-w-3xl w-full my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="p-8 border-b border-zinc-800">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
            Meet the Creators
          </h2>
          <p className="text-zinc-400">
            The team behind Brev Doctor
          </p>
        </div>

        {/* Creators grid */}
        <div className="p-8 space-y-6">
          {creators.map((creator, index) => (
            <div
              key={index}
              className="flex items-center gap-6 py-6 px-6 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:border-emerald-500/30 transition-colors duration-300"
            >
              <div className="w-28 h-28 rounded-full bg-zinc-700 flex-shrink-0 overflow-hidden">
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className={`w-full h-full object-cover ${creator.imageStyle}`}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-zinc-100 mb-1">
                  {creator.name}
                </h3>
                <p className="text-emerald-400 text-sm font-medium mb-3">
                  {creator.role}
                </p>
                <p className="text-zinc-400 leading-relaxed">
                  {creator.bio}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 rounded-b-2xl">
          <p className="text-center text-zinc-500 text-sm">
            Questions or feedback? Reach out to us at{" "}
            <a href="mailto:hello@brevdoctor.dev" className="text-emerald-400 hover:text-emerald-300">
              hello@brevdoctor.dev
            </a>
          </p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-sm font-medium"
      >
        About the Creators
      </button>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

