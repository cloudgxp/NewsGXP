import React from 'react';
import { X, CheckCircle2, ArrowRight, Code2, Database, Shield, Radio } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="about-modal-overlay"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="about-modal-dialog"
        className="bg-[#F7F7F2] border border-[#D1D1CB] shadow-xl rounded-sm max-w-2xl w-full my-8 text-[#2D2D2D] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-white border-b border-[#D1D1CB] px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono-accent text-xs bg-[#1A1A1A] text-[#F7F7F2] px-1.5 py-0.5 font-bold tracking-wider rounded-sm">
              GXP
            </span>
            <h2 className="text-xl font-black tracking-tight text-[#1A1A1A]">
              About NewsGXP
            </h2>
          </div>
          <button
            id="close-about-modal-btn"
            onClick={onClose}
            className="p-1 hover:bg-[#F1F1EB] rounded-sm text-[#888880] hover:text-[#1A1A1A] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-sm leading-relaxed overflow-y-auto max-h-[75vh]">
          {/* Mission & Identity */}
          <div className="border-b border-[#D1D1CB] pb-4">
            <h3 className="text-xl font-bold font-editorial mb-1 text-[#1A1A1A]">
              Your news. Your providers.
            </h3>
            <p className="text-[#666660]">
              NewsGXP is a news aggregation portal built on the core principle of modular,
              decoupled content providers. Rather than lock users into a closed algorithm,
              NewsGXP enables direct, transparent aggregation from real-world publishers.
            </p>
          </div>

          {/* Core Architecture */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-[#F47521]" />
              Core Architecture Principle
            </h4>
            <div className="bg-[#F1F1EB] border-l-3 border-[#F47521] p-3 text-xs italic font-editorial text-[#1A1A1A] mb-3">
              “Providers know how to fetch content. The application knows how to display content.”
            </div>
            <p className="text-xs text-[#666660]">
              The application UI only knows about the shared <code className="bg-[#E8E8E1] px-1 py-0.2 rounded-xs font-mono-accent text-[#1A1A1A]">Article</code> model.
              All source discovery, network protocols, XML/HTML parsing, data sanitization, and thumbnail extraction
              happen completely inside isolated provider modules.
            </p>
          </div>

          {/* MVP Scope: Crunchyroll */}
          <div className="bg-white border border-[#D1D1CB] p-4 rounded-sm shadow-xs">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#F47521]" />
              MVP Implementation: Crunchyroll Slice
            </h4>
            <ul className="text-xs text-[#666660] space-y-2 list-disc list-inside">
              <li>
                <strong className="text-[#1A1A1A]">Live Ingestion:</strong> Connects to Crunchyroll’s official production RSS feed service (<code className="font-mono-accent text-[11px] text-[#1A1A1A]">cr-news-api-service.prd.crunchyrollsvc.com</code>).
              </li>
              <li>
                <strong className="text-[#1A1A1A]">CORS Boundary:</strong> Uses a lightweight feed gateway endpoint (<code className="font-mono-accent text-[11px] text-[#1A1A1A]">/api/feed/crunchyroll</code>) with bounded caching to maintain high responsiveness and respect rate limits.
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Normalization:</strong> Transforms diverse RSS elements, Media RSS thumbnails, HTML entity-encoded descriptions, and category tags into uniform <code className="font-mono-accent text-[11px] text-[#1A1A1A]">Article</code> objects.
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Graceful Fault Tolerance:</strong> Malformed entries are discarded individually without interrupting valid stories.
              </li>
            </ul>
          </div>

          {/* Minimum Steps for Provider #2 */}
          <div className="bg-[#F1F1EB] border border-[#D1D1CB] p-4 rounded-sm shadow-xs">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#F47521]" />
              Expanding to Provider #2
            </h4>
            <p className="text-xs text-[#666660] mb-2">
              Adding a second provider (e.g. IGN, Anime News Network, Hacker News, Reuters) requires only three steps:
            </p>
            <ol className="text-xs text-[#666660] space-y-1.5 list-decimal list-inside font-mono-accent">
              <li>Create <code className="text-[#1A1A1A]">src/providers/providerName/index.ts</code> implementing <code className="text-[#1A1A1A]">NewsProvider</code>.</li>
              <li>Add the source URL to the feed gateway allowlist in <code className="text-[#1A1A1A]">functions/api/feed/[provider].ts</code> and <code className="text-[#1A1A1A]">server.ts</code>.</li>
              <li>Register the new provider instance in <code className="text-[#1A1A1A]">src/services/feedService.ts</code>.</li>
            </ol>
            <p className="text-[11px] text-[#888880] mt-2 italic">
              No modifications to the article feed, card components, or layout are required.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F1F1EB] border-t border-[#D1D1CB] px-6 py-3.5 flex justify-end">
          <button
            id="about-modal-close-action"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
