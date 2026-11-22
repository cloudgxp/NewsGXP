import React from 'react';
import { X, ArrowRight, Code2, Radio, Briefcase } from 'lucide-react';

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
        <div className="bg-white border-b border-[#D1D1CB] px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono-accent text-xs bg-[#1A1A1A] text-[#F7F7F2] px-1.5 py-0.5 font-bold tracking-wider rounded-sm">
              GXP
            </span>
            <h2 className="text-xl font-black tracking-tight text-[#1A1A1A]">About NewsGXP</h2>
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

        <div className="p-6 space-y-6 text-sm leading-relaxed overflow-y-auto max-h-[75vh]">
          <div className="border-b border-[#D1D1CB] pb-4">
            <h3 className="text-xl font-bold font-editorial mb-1 text-[#1A1A1A]">
              AI &amp; Tech news. Remote AI jobs.
            </h3>
            <p className="text-[#666660]">
              NewsGXP is an open-source AI &amp; Technology news and remote AI jobs portal powered
              by Cloudflare Workers, D1, and Workers AI. Follow primary announcements directly from
              research labs, engineering blogs, and company career portals—with zero third-party job
              aggregators.
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-[#F47521]" />
              Cloudflare-Native Architecture
            </h4>
            <div className="bg-[#F1F1EB] border-l-3 border-[#F47521] p-3 text-xs italic font-editorial text-[#1A1A1A] mb-3">
              “Ingested once daily at 8:00 PM EST into Cloudflare D1, enriched by Workers AI, and
              pruned automatically after 45 days.”
            </div>
            <p className="text-xs text-[#666660]">
              Scheduled Cron Triggers fetch all 32 news feeds and 21 company career portals into{' '}
              <code className="bg-[#E8E8E1] px-1 py-0.2 rounded-xs font-mono-accent text-[#1A1A1A]">
                Cloudflare D1
              </code>
              , verify &amp; summarize new items via{' '}
              <code className="bg-[#E8E8E1] px-1 py-0.2 rounded-xs font-mono-accent text-[#1A1A1A]">
                Workers AI
              </code>
              , and preserve your weekly segment diffs cleanly.
            </p>
          </div>

          <div className="bg-white border border-[#D1D1CB] p-4 rounded-sm shadow-xs">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#F47521]" />
              Direct Company Career-Page Remote AI Jobs (21 Companies)
            </h4>
            <ul className="text-xs text-[#666660] space-y-2 list-disc list-inside">
              <li>
                <strong className="text-[#1A1A1A]">Official Portals Only:</strong> Queries official
                career sites and ATS APIs directly across Big Tech (Google, Microsoft, GitHub, AMD),
                Frontier Labs (OpenAI, Anthropic, Cohere, Perplexity, Hugging Face, Stability AI), AI
                Infra (Cloudflare, Databricks, Scale AI, Vercel, GitLab, Cursor, LangChain, Stripe),
                and Generative Media (ElevenLabs, Runway, Suno).
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Snapshot Diffing for Weekly Segments:</strong>{' '}
                Tracks original <code className="text-[#1A1A1A]">first_seen_at</code> timestamps to
                power the <em>New This Week</em> view and one-click Markdown export for YouTube and
                LinkedIn.
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Automatic 45-Day Closed Cleanup:</strong>{' '}
                Closed postings automatically purge 45 days after disappearing from career pages,
                while still-active and bookmarked roles remain intact.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-[#D1D1CB] p-4 rounded-sm shadow-xs">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#F47521]" />
              32 Verified AI &amp; Tech News Sources
            </h4>
            <ul className="text-xs text-[#666660] space-y-2 list-disc list-inside">
              <li>
                <strong className="text-[#1A1A1A]">Frontier Labs:</strong> OpenAI News &amp;
                Research, Anthropic News, Google DeepMind / Gemini / AI, Meta AI, Mistral AI, and
                Cohere.
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Cloud &amp; Engineering:</strong> AWS GenAI &amp;
                ML, Azure AI Foundry, Microsoft AI &amp; Skills Hub, GitHub Blog &amp; Changelog,
                Google Blog &amp; Developers, Hugging Face, and Perplexity.
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Hardware &amp; Edge:</strong> NVIDIA Generative
                AI &amp; Developer, AMD AI &amp; Computing, and Apple Intelligence.
              </li>
              <li>
                <strong className="text-[#1A1A1A]">Generative Media:</strong> Stability AI, Runway,
                Pika, Luma AI, ElevenLabs Product &amp; Research, and Suno Blog &amp; Release Notes.
              </li>
            </ul>
          </div>

          <div className="bg-[#F1F1EB] border border-[#D1D1CB] p-4 rounded-sm shadow-xs">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#F47521]" />
              Adding a Source or Company
            </h4>
            <ol className="text-xs text-[#666660] space-y-1.5 list-decimal list-inside font-mono-accent">
              <li>
                Add news feeds in <code className="text-[#1A1A1A]">src/config/feeds.ts</code>,{' '}
                <code className="text-[#1A1A1A]">worker/ingest.ts</code>, and{' '}
                <code className="text-[#1A1A1A]">src/services/feedService.ts</code>.
              </li>
              <li>
                Add company career portals in{' '}
                <code className="text-[#1A1A1A]">src/config/companies.ts</code>.
              </li>
            </ol>
          </div>
        </div>

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
