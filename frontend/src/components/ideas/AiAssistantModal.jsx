import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { api, getErrorMessage } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/CommonUI';

export function AiAssistantModal({
  open,
  onClose,
  field,
  fieldLabel,
  currentValue,
  contextData = {},
  onApply,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [parsedFeatures, setParsedFeatures] = useState(null);

  async function handleGenerate() {
    setLoading(true);
    setSuggestion('');
    setParsedFeatures(null);

    try {
      const res = await api.post('/ideas/ai/assist', {
        field,
        currentText: typeof currentValue === 'string' ? currentValue : '',
        context: {
          title: contextData.title || '',
          shortSummary: contextData.shortSummary || '',
          problemStatement: contextData.problemStatement || '',
          category: contextData.category || '',
        },
      });

      const data = res.data.data;
      setSuggestion(data.suggestion);
      if (Array.isArray(data.features) && data.features.length > 0) {
        setParsedFeatures(data.features);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'AI Assistant was unable to generate a suggestion.'));
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (field === 'keyFeatures' && parsedFeatures) {
      onApply(parsedFeatures);
    } else {
      onApply(suggestion);
    }
    onClose();
    toast.success(`${fieldLabel} updated with AI suggestion.`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI Writing Assistant"
      subtitle={`Refine and improve your ${fieldLabel.toLowerCase()} with AI`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Original Draft Display */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Current Draft
          </p>
          <p className="text-xs text-slate-700 whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed">
            {typeof currentValue === 'string' && currentValue.trim()
              ? currentValue
              : '(Empty — AI will craft an initial draft based on your project title and category)'}
          </p>
        </div>

        {/* Action Trigger */}
        {!suggestion && !loading && (
          <div className="text-center py-4">
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 rounded-xl brand-gradient-bg px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:opacity-95"
            >
              <Sparkles className="h-4 w-4" /> Generate AI Suggestion
            </button>
            <p className="mt-2 text-xs text-slate-500">
              Suggestions will NOT be applied automatically. You can review and edit before accepting.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 text-[#6E05F2] animate-spin" />
            <p className="text-xs font-semibold text-slate-600">
              Generating tailored recommendation...
            </p>
          </div>
        )}

        {/* Suggestion Result */}
        {suggestion && !loading && (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#6E05F2]/30 bg-[#6E05F2]/[0.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#6E05F2]">
                  <Sparkles className="h-3.5 w-3.5" /> AI Suggestion
                </span>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-xs text-slate-500 hover:text-[#6E05F2] underline"
                >
                  Regenerate
                </button>
              </div>

              {parsedFeatures ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {parsedFeatures.map((feat, i) => (
                    <div key={i} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                      <p className="font-bold text-[#171717]">{feat.title}</p>
                      {feat.description && (
                        <p className="text-slate-600 mt-0.5">{feat.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={6}
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-800 leading-relaxed focus:border-[#6E05F2] focus:outline-none"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
              >
                <Check className="h-4 w-4" /> Apply Suggestion
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

