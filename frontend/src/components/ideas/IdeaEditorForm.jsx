import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  Globe,
  HelpCircle,
  History,
  Info,
  Layers,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AiAssistantModal } from './AiAssistantModal';

const PREDEFINED_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'UI/UX Designer',
  'AI/ML Engineer',
  'Data Analyst',
  'Mobile App Developer',
  'Marketing Specialist',
  'Business Strategist',
  'Researcher',
];

const INDUSTRY_DOMAINS = [
  'Technology & Software',
  'Healthcare & Bio',
  'Education & EdTech',
  'Finance & FinTech',
  'Agriculture & AgriTech',
  'Climate & CleanTech',
  'E-Commerce & Retail',
  'Media & Entertainment',
  'Cybersecurity',
  'Social Impact & Civic',
];

const COLLABORATION_TYPES = [
  { id: 'startup', label: 'Startup / Business', desc: 'Commercial venture aiming for product-market fit' },
  { id: 'open_source', label: 'Open Source Project', desc: 'Public codebase built collaboratively for the community' },
  { id: 'academic', label: 'Academic Project', desc: 'University, thesis, or degree-focused initiative' },
  { id: 'research', label: 'Research Project', desc: 'R&D, deep exploration, or experimental prototyping' },
  { id: 'hackathon', label: 'Hackathon Project', desc: 'Fast-paced sprint for competitions or hackathons' },
  { id: 'personal', label: 'Personal Project', desc: 'Independent passion project or side-hustle build' },
];

const WORK_ARRANGEMENTS = [
  { id: 'remote', label: 'Remote', desc: 'Asynchronous or virtual collaboration worldwide' },
  { id: 'hybrid', label: 'Hybrid', desc: 'Mix of virtual coordination and local co-working' },
  { id: 'onsite', label: 'On-site', desc: 'In-person collaboration at a specific campus or office' },
];

const TIME_COMMITMENTS = [
  { id: '2-5', label: '2–5 hrs / week', desc: 'Casual contributor or strategic advisor' },
  { id: '5-10', label: '5–10 hrs / week', desc: 'Steady weekly builder & sprint teammate' },
  { id: '10-20', label: '10–20 hrs / week', desc: 'Core contributor with significant availability' },
  { id: '20+', label: '20+ hrs / week', desc: 'Full-time / near full-time dedicated co-builder' },
];

const COMPENSATION_MODELS = [
  { id: 'open', label: 'Open to Discussion', desc: 'Terms decided transparently with the right partners' },
  { id: 'equity', label: 'Equity-based', desc: 'Vesting shares, founder equity, or future tokens' },
  { id: 'revenue_share', label: 'Revenue Sharing', desc: 'Split of post-launch product profits & sales' },
  { id: 'paid', label: 'Paid / Contract', desc: 'Direct compensation, milestone bounties, or stipend' },
  { id: 'unpaid', label: 'Voluntary / Unpaid', desc: 'Portfolio building, mission-driven, and open-source' },
];

const FORM_SECTIONS = [
  { id: 1, title: 'Basics & Problem', icon: Layers },
  { id: 2, title: 'Solution & Specs', icon: Sparkles },
  { id: 3, title: 'Team & Collab', icon: Users },
  { id: 4, title: 'Privacy & NDA', icon: ShieldCheck },
  { id: 5, title: 'Attachments', icon: FileText },
  { id: 6, title: 'Review & Publish', icon: Send },
];

const AUTOSAVE_STORAGE_KEY = 'ideaspark_create_draft_v2';

export function IdeaEditorForm({
  initialIdea = null,
  onSubmitIdea,
  onSaveDraft,
  submitting,
  mode = 'create',
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [currentSection, setCurrentSection] = useState(1);
  const [categories, setCategories] = useState([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModalState, setAiModalState] = useState({
    open: false,
    field: '',
    fieldLabel: '',
    currentValue: '',
  });

  // Section 1
  const [title, setTitle] = useState(initialIdea?.title || '');
  const [shortSummary, setShortSummary] = useState(initialIdea?.shortSummary || '');
  const [problemStatement, setProblemStatement] = useState(initialIdea?.problemStatement || '');
  const [targetAudience, setTargetAudience] = useState(initialIdea?.targetAudience || '');
  const [industryDomain, setIndustryDomain] = useState(initialIdea?.industryDomain || '');
  const [existingAlternatives, setExistingAlternatives] = useState(initialIdea?.existingAlternatives || '');
  const [marketOpportunity, setMarketOpportunity] = useState(initialIdea?.marketOpportunity || '');

  // Section 2
  const [proposedSolution, setProposedSolution] = useState(initialIdea?.proposedSolution || '');
  const [detailedDescription, setDetailedDescription] = useState(initialIdea?.detailedDescription || '');
  const [uniqueSellingProposition, setUniqueSellingProposition] = useState(
    initialIdea?.uniqueSellingProposition || ''
  );
  const [keyFeatures, setKeyFeatures] = useState(
    initialIdea?.keyFeatures?.length
      ? initialIdea.keyFeatures
      : [
          { title: 'MVP Core Architecture', description: 'Core functional workflow and responsive UI.' },
        ]
  );
  const [expectedOutcome, setExpectedOutcome] = useState(initialIdea?.expectedOutcome || '');
  const [successMetrics, setSuccessMetrics] = useState(initialIdea?.successMetrics || '');
  const [referenceLinks, setReferenceLinks] = useState(
    initialIdea?.referenceLinks?.length ? initialIdea.referenceLinks : []
  );

  // Section 3
  const [category, setCategory] = useState(initialIdea?.category || 'AI & Machine Learning');
  const [projectStage, setProjectStage] = useState(initialIdea?.projectStage || 'concept');
  const [expectedDuration, setExpectedDuration] = useState(initialIdea?.expectedDuration || '1 - 3 months');
  const [teamSize, setTeamSize] = useState(initialIdea?.teamSize || 4);
  const [skillsList, setSkillsList] = useState(initialIdea?.requiredSkills || ['React', 'Node.js']);
  const [skillInput, setSkillInput] = useState('');
  const [requiredRoles, setRequiredRoles] = useState(
    initialIdea?.requiredRoles?.length ? initialIdea.requiredRoles : ['Full-Stack Developer']
  );
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [collaborationType, setCollaborationType] = useState(initialIdea?.collaborationType || 'startup');
  const [workArrangement, setWorkArrangement] = useState(initialIdea?.workArrangement || 'remote');
  const [weeklyCommitment, setWeeklyCommitment] = useState(initialIdea?.weeklyCommitment || '5-10');
  const [compensationModel, setCompensationModel] = useState(initialIdea?.compensationModel || 'open');
  const [collaborationRequirements, setCollaborationRequirements] = useState(
    initialIdea?.collaborationRequirements || ''
  );

  // Section 4
  const [visibility, setVisibility] = useState(initialIdea?.visibility || 'public');
  const [protectDetailsWithNDA, setProtectDetailsWithNDA] = useState(
    Boolean(initialIdea?.protectDetailsWithNDA)
  );
  const [customNda, setCustomNda] = useState({
    url: initialIdea?.customNdaUrl || '',
    storageKey: initialIdea?.customNdaStorageKey || '',
    name: initialIdea?.customNdaName || '',
  });
  const [allowCollaborationRequests, setAllowCollaborationRequests] = useState(
    initialIdea?.allowCollaborationRequests !== false
  );
  const [requireOwnerApproval, setRequireOwnerApproval] = useState(
    initialIdea?.requireOwnerApproval !== false
  );
  const [maxCollaborators, setMaxCollaborators] = useState(
    initialIdea?.maxCollaborators || initialIdea?.teamSize || 5
  );
  const [shareLinkExpiresAt, setShareLinkExpiresAt] = useState(
    initialIdea?.shareLinkExpiresAt
      ? new Date(initialIdea.shareLinkExpiresAt).toISOString().split('T')[0]
      : ''
  );
  const [editSummary, setEditSummary] = useState('');

  // Section 5
  const [attachments, setAttachments] = useState(initialIdea?.attachments || []);
  const [uploadProgress, setUploadProgress] = useState(null); // null or { name, percent }
  const [previewFileModal, setPreviewFileModal] = useState(null);

  // Section 6: Review Mode
  const [reviewAudienceTab, setReviewAudienceTab] = useState('public'); // 'public' | 'protected'

  // UX & Auto Save state
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const isInitialMount = useRef(true);

  // Load Categories & AI status
  useEffect(() => {
    api
      .get('/ideas/categories')
      .then((res) => setCategories(res.data?.data?.categories || []))
      .catch(() => {});

    api
      .get('/ideas/ai/status')
      .then((res) => setAiEnabled(Boolean(res.data?.data?.enabled)))
      .catch(() => setAiEnabled(false));
  }, []);

  // Restore Local Draft on new idea creation if available
  useEffect(() => {
    if (mode !== 'create') return;
    try {
      const savedRaw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && (parsed.title || parsed.shortSummary || parsed.problemStatement)) {
          setTitle(parsed.title || '');
          setShortSummary(parsed.shortSummary || '');
          setProblemStatement(parsed.problemStatement || '');
          setTargetAudience(parsed.targetAudience || '');
          setIndustryDomain(parsed.industryDomain || '');
          setExistingAlternatives(parsed.existingAlternatives || '');
          setMarketOpportunity(parsed.marketOpportunity || '');
          setProposedSolution(parsed.proposedSolution || '');
          setDetailedDescription(parsed.detailedDescription || '');
          setUniqueSellingProposition(parsed.uniqueSellingProposition || '');
          if (Array.isArray(parsed.keyFeatures) && parsed.keyFeatures.length) {
            setKeyFeatures(parsed.keyFeatures);
          }
          setExpectedOutcome(parsed.expectedOutcome || '');
          setSuccessMetrics(parsed.successMetrics || '');
          if (Array.isArray(parsed.referenceLinks)) setReferenceLinks(parsed.referenceLinks);
          if (parsed.category) setCategory(parsed.category);
          if (parsed.projectStage) setProjectStage(parsed.projectStage);
          if (parsed.expectedDuration) setExpectedDuration(parsed.expectedDuration);
          if (parsed.teamSize) setTeamSize(parsed.teamSize);
          if (Array.isArray(parsed.skillsList)) setSkillsList(parsed.skillsList);
          if (Array.isArray(parsed.requiredRoles)) setRequiredRoles(parsed.requiredRoles);
          if (parsed.collaborationType) setCollaborationType(parsed.collaborationType);
          if (parsed.workArrangement) setWorkArrangement(parsed.workArrangement);
          if (parsed.weeklyCommitment) setWeeklyCommitment(parsed.weeklyCommitment);
          if (parsed.compensationModel) setCompensationModel(parsed.compensationModel);
          if (parsed.collaborationRequirements) {
            setCollaborationRequirements(parsed.collaborationRequirements);
          }
          if (parsed.visibility) setVisibility(parsed.visibility);
          if (typeof parsed.protectDetailsWithNDA === 'boolean') {
            setProtectDetailsWithNDA(parsed.protectDetailsWithNDA);
          }
          setHasRestoredDraft(true);
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }, [mode]);

  // Debounced Auto-Save to localStorage
  useEffect(() => {
    if (mode !== 'create') return undefined;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return undefined;
    }

    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      const draftPayload = {
        title,
        shortSummary,
        problemStatement,
        targetAudience,
        industryDomain,
        existingAlternatives,
        marketOpportunity,
        proposedSolution,
        detailedDescription,
        uniqueSellingProposition,
        keyFeatures,
        expectedOutcome,
        successMetrics,
        referenceLinks,
        category,
        projectStage,
        expectedDuration,
        teamSize,
        skillsList,
        requiredRoles,
        collaborationType,
        workArrangement,
        weeklyCommitment,
        compensationModel,
        collaborationRequirements,
        visibility,
        protectDetailsWithNDA,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(draftPayload));
        setAutoSaveStatus('saved');
        setLastAutoSavedAt(new Date());
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    mode,
    title,
    shortSummary,
    problemStatement,
    targetAudience,
    industryDomain,
    existingAlternatives,
    marketOpportunity,
    proposedSolution,
    detailedDescription,
    uniqueSellingProposition,
    keyFeatures,
    expectedOutcome,
    successMetrics,
    referenceLinks,
    category,
    projectStage,
    expectedDuration,
    teamSize,
    skillsList,
    requiredRoles,
    collaborationType,
    workArrangement,
    weeklyCommitment,
    compensationModel,
    collaborationRequirements,
    visibility,
    protectDetailsWithNDA,
  ]);

  function clearLocalDraft() {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    setHasRestoredDraft(false);
    toast.info('Local draft cleared.');
  }

  // Section Completion Metrics
  const sectionStatus = useMemo(() => {
    const s1Complete = Boolean(
      title.trim().length >= 5 &&
        shortSummary.trim().length >= 20 &&
        shortSummary.trim().length <= 320 &&
        problemStatement.trim().length >= 15
    );
    const s2Complete = Boolean(
      proposedSolution.trim().length >= 15 &&
        detailedDescription.trim().length >= 30 &&
        keyFeatures.length > 0 &&
        keyFeatures.every((f) => f.title.trim())
    );
    const s3Complete = Boolean(category && teamSize >= 1 && requiredRoles.length > 0);
    const s4Complete = Boolean(visibility);
    const s5Complete = true; // Attachments are optional
    const s6Complete = s1Complete && s2Complete && s3Complete && s4Complete;

    const completedCount = [s1Complete, s2Complete, s3Complete, s4Complete, s5Complete].filter(
      Boolean
    ).length;
    const progressPercent = Math.round((completedCount / 5) * 100);

    return {
      s1: s1Complete,
      s2: s2Complete,
      s3: s3Complete,
      s4: s4Complete,
      s5: s5Complete,
      s6: s6Complete,
      progressPercent,
    };
  }, [
    title,
    shortSummary,
    problemStatement,
    proposedSolution,
    detailedDescription,
    keyFeatures,
    category,
    teamSize,
    requiredRoles,
    visibility,
  ]);

  // Dynamic Skill Management
  function handleAddSkill() {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (skillsList.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.info('Skill already in list.');
      return;
    }
    setSkillsList([...skillsList, trimmed]);
    setSkillInput('');
  }

  function handleRemoveSkill(target) {
    setSkillsList(skillsList.filter((s) => s !== target));
  }

  // Dynamic Role Management
  function handleToggleRole(role) {
    if (requiredRoles.includes(role)) {
      setRequiredRoles(requiredRoles.filter((r) => r !== role));
    } else {
      setRequiredRoles([...requiredRoles, role]);
    }
  }

  function handleAddCustomRole() {
    const trimmed = customRoleInput.trim();
    if (!trimmed) return;
    if (requiredRoles.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      toast.info('Role already in list.');
      return;
    }
    setRequiredRoles([...requiredRoles, trimmed]);
    setCustomRoleInput('');
  }

  // Dynamic Key Features
  function handleAddFeature() {
    if (keyFeatures.length >= 15) {
      toast.info('Maximum 15 features allowed.');
      return;
    }
    setKeyFeatures([...keyFeatures, { title: '', description: '' }]);
  }

  function handleUpdateFeature(index, key, val) {
    const updated = [...keyFeatures];
    updated[index] = { ...updated[index], [key]: val };
    setKeyFeatures(updated);
  }

  function handleRemoveFeature(index) {
    setKeyFeatures(keyFeatures.filter((_, i) => i !== index));
  }

  // Dynamic Reference Links
  function handleAddLink() {
    if (referenceLinks.length >= 10) {
      toast.info('Maximum 10 reference links allowed.');
      return;
    }
    setReferenceLinks([...referenceLinks, { title: '', url: 'https://' }]);
  }

  function handleUpdateLink(index, key, val) {
    const updated = [...referenceLinks];
    updated[index] = { ...updated[index], [key]: val };
    setReferenceLinks(updated);
  }

  function handleRemoveLink(index) {
    setReferenceLinks(referenceLinks.filter((_, i) => i !== index));
  }

  // File Upload Handling
  async function handleFileUpload(e, isCustomNda = false) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validations
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.txt'];
    const lowerName = file.name.toLowerCase();
    const isAllowedExt = allowedExts.some((ext) => lowerName.endsWith(ext));
    if (!isAllowedExt) {
      toast.error('Only PDF, PNG, JPG, WEBP, or TXT documents are supported.');
      e.target.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size cannot exceed 8MB.');
      e.target.value = '';
      return;
    }

    setUploadProgress({ name: file.name, percent: 25 });
    const formData = new FormData();
    formData.append('file', file);

    try {
      const interval = setInterval(() => {
        setUploadProgress((prev) => (prev ? { ...prev, percent: Math.min(prev.percent + 20, 85) } : null));
      }, 150);

      const res = await api.post('/ideas/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(interval);
      setUploadProgress({ name: file.name, percent: 100 });

      const uploaded = res.data.data.file;

      if (isCustomNda) {
        setCustomNda({
          url: uploaded.url,
          storageKey: uploaded.storageKey || '',
          name: uploaded.name,
        });
        toast.success('Custom NDA document uploaded successfully.');
      } else {
        setAttachments((prev) => [
          ...prev,
          {
            name: uploaded.name,
            url: uploaded.url,
            storageKey: uploaded.storageKey || '',
            publicId: uploaded.publicId || '',
            mimeType: uploaded.mimeType || file.type,
            size: uploaded.size || file.size,
            isProtected: true,
          },
        ]);
        toast.success(`Attached "${uploaded.name}".`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to upload attachment.'));
    } finally {
      setTimeout(() => setUploadProgress(null), 600);
      e.target.value = '';
    }
  }

  function handleToggleAttachmentProtection(index) {
    const updated = [...attachments];
    updated[index].isProtected = !updated[index].isProtected;
    setAttachments(updated);
  }

  function handleRemoveAttachment(index) {
    setAttachments(attachments.filter((_, i) => i !== index));
  }

  // AI Assistant trigger
  function openAiAssistant(field, fieldLabel, currentValue) {
    setAiModalState({
      open: true,
      field,
      fieldLabel,
      currentValue,
    });
  }

  function handleApplyAiSuggestion(val) {
    const { field } = aiModalState;
    if (field === 'title') setTitle(val);
    else if (field === 'shortSummary') setShortSummary(val);
    else if (field === 'problemStatement') setProblemStatement(val);
    else if (field === 'proposedSolution') setProposedSolution(val);
    else if (field === 'detailedDescription') setDetailedDescription(val);
    else if (field === 'keyFeatures' && Array.isArray(val)) {
      setKeyFeatures(val);
    }
  }

  // Construct Payload
  function buildPayload(statusToSave = 'active') {
    const cleanedLinks = referenceLinks
      .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
      .filter((l) => l.url && /^https?:\/\//i.test(l.url));

    const cleanedFeatures = keyFeatures
      .map((f) => ({ title: f.title.trim(), description: f.description.trim() }))
      .filter((f) => f.title);

    return {
      status: statusToSave,
      title: title.trim(),
      shortSummary: shortSummary.trim(),
      problemStatement: problemStatement.trim(),
      targetAudience: targetAudience.trim(),
      industryDomain: industryDomain.trim(),
      existingAlternatives: existingAlternatives.trim(),
      marketOpportunity: marketOpportunity.trim(),

      proposedSolution: proposedSolution.trim(),
      detailedDescription: detailedDescription.trim(),
      uniqueSellingProposition: uniqueSellingProposition.trim(),
      keyFeatures: cleanedFeatures,
      expectedOutcome: expectedOutcome.trim(),
      successMetrics: successMetrics.trim(),
      referenceLinks: cleanedLinks,

      category: category.trim(),
      requiredSkills: skillsList,
      requiredRoles,
      expectedDuration: expectedDuration.trim(),
      teamSize: Number(teamSize),
      projectStage,
      collaborationType,
      workArrangement,
      weeklyCommitment,
      compensationModel,
      collaborationRequirements: collaborationRequirements.trim(),

      visibility,
      protectDetailsWithNDA,
      customNdaUrl: customNda.url,
      customNdaStorageKey: customNda.storageKey,
      customNdaName: customNda.name,
      allowCollaborationRequests,
      requireOwnerApproval,
      maxCollaborators: Number(maxCollaborators),
      shareLinkExpiresAt: shareLinkExpiresAt ? new Date(shareLinkExpiresAt).toISOString() : null,

      attachments,
      ...(mode === 'edit' && editSummary ? { editSummary: editSummary.trim() } : {}),
    };
  }

  // Validation before publishing
  function validateForPublish() {
    if (!title.trim() || title.trim().length < 5) {
      setCurrentSection(1);
      toast.error('Idea Title must be at least 5 characters (Section 1).');
      return false;
    }
    if (shortSummary.trim().length < 20 || shortSummary.trim().length > 320) {
      setCurrentSection(1);
      toast.error('Short Public Summary must be between 20 and 320 characters (Section 1).');
      return false;
    }
    if (!problemStatement.trim() || problemStatement.trim().length < 15) {
      setCurrentSection(1);
      toast.error('Problem Statement must be at least 15 characters (Section 1).');
      return false;
    }
    if (!proposedSolution.trim() || proposedSolution.trim().length < 15) {
      setCurrentSection(2);
      toast.error('Proposed Solution must be at least 15 characters (Section 2).');
      return false;
    }
    if (!detailedDescription.trim() || detailedDescription.trim().length < 30) {
      setCurrentSection(2);
      toast.error('Detailed Description & Roadmap must be at least 30 characters (Section 2).');
      return false;
    }
    if (!category.trim()) {
      setCurrentSection(3);
      toast.error('Category is required (Section 3).');
      return false;
    }
    if (requiredRoles.length === 0) {
      setCurrentSection(3);
      toast.error('Select at least one required team role (Section 3).');
      return false;
    }
    return true;
  }

  function handlePublish() {
    if (!validateForPublish()) return;
    const payload = buildPayload('active');
    onSubmitIdea(payload);
    if (mode === 'create') {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    }
  }

  function handleSaveDraftAction() {
    const payload = buildPayload('draft');
    if (onSaveDraft) {
      onSaveDraft(payload);
    } else {
      onSubmitIdea(payload);
    }
    if (mode === 'create') {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Banner: Restored Draft Notification (Create mode) */}
      {hasRestoredDraft && mode === 'create' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#2057E8]/30 bg-[#2057E8]/5 px-4 py-3 text-xs text-[#2057E8]">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <span>Restored your unsaved draft from your local browser storage.</span>
          </div>
          <button
            type="button"
            onClick={clearLocalDraft}
            className="font-semibold underline hover:text-[#171717]"
          >
            Clear Draft
          </button>
        </div>
      )}

      {/* Stepper Navigation & Completion Progress Bar */}
      <div className="sticky top-16 z-20 rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#6E05F2] text-xs font-bold text-white">
              {currentSection}
            </span>
            <span className="text-sm font-bold text-[#171717]">
              Section {currentSection} of 6: {FORM_SECTIONS[currentSection - 1].title}
            </span>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {mode === 'create' && (
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                {autoSaveStatus === 'saving' && (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-[#6E05F2]" /> Saving draft...
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Auto-saved locally
                  </>
                )}
                {autoSaveStatus === 'idle' && lastAutoSavedAt && (
                  <>
                    <Clock className="h-3 w-3 text-slate-400" /> Saved {lastAutoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </>
                )}
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveDraftAction}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" /> Save as Draft
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-4">
          <div
            className="h-full brand-gradient-bg transition-all duration-300"
            style={{ width: `${sectionStatus.progressPercent}%` }}
          />
        </div>

        {/* Section Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {FORM_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isCurrent = currentSection === sec.id;
            const isComplete = sectionStatus[`s${sec.id}`];

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setCurrentSection(sec.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition ${
                  isCurrent
                    ? 'border-[#6E05F2] bg-[#6E05F2]/5 text-[#6E05F2] font-bold shadow-2xs'
                    : isComplete
                    ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800 font-medium hover:bg-emerald-50'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" />
                  {isComplete && !isCurrent && <Check className="h-3 w-3 text-emerald-600" />}
                </div>
                <span className="text-[11px] leading-tight line-clamp-1">{sec.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: BASIC INFORMATION & PROBLEM
          ========================================================================= */}
      {currentSection === 1 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
                Section 1 of 6
              </span>
              <h2 className="text-xl font-bold text-[#171717] mt-0.5">
                Basic Information &amp; Problem
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Define the high-level elevator pitch and real-world pain point you are tackling.
              </p>
            </div>
            <Layers className="h-6 w-6 text-[#6E05F2] shrink-0" />
          </div>

          {/* Idea Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Idea Title <span className="text-rose-500">*</span>
              </label>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() => openAiAssistant('title', 'Idea Title', title)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E05F2] hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Improve with AI
                </button>
              )}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. MedScribe Edge — Privacy-First Clinical Triage Copilot"
              maxLength={140}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              <span>{title.length < 5 ? 'At least 5 characters required' : 'Clear & descriptive'}</span>
              <span>{title.length}/140</span>
            </div>
          </div>

          {/* Short Public Summary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Short Public Summary (20–320 chars) <span className="text-rose-500">*</span>
              </label>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() => openAiAssistant('shortSummary', 'Short Public Summary', shortSummary)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E05F2] hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Improve with AI
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={shortSummary}
              onChange={(e) => setShortSummary(e.target.value)}
              maxLength={320}
              placeholder="A crisp, elevator-pitch summary safe to appear on public Explore cards..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span
                className={
                  shortSummary.length < 20 || shortSummary.length > 320
                    ? 'text-amber-600 font-medium'
                    : 'text-emerald-600 font-medium'
                }
              >
                {shortSummary.length < 20
                  ? `Need ${20 - shortSummary.length} more characters (min 20)`
                  : 'Length valid for public cards'}
              </span>
              <span className="text-slate-400">{shortSummary.length}/320</span>
            </div>
          </div>

          {/* Problem Statement */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Problem Statement <span className="text-rose-500">*</span>
              </label>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() => openAiAssistant('problemStatement', 'Problem Statement', problemStatement)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E05F2] hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Improve with AI
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              maxLength={4000}
              placeholder="What specific friction, inefficiencies, or barriers exist today? Who experiences this daily?"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Audience */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Audience (Who will benefit?)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Rural health workers, college students, indie SaaS hackers"
                maxLength={1500}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>

            {/* Industry / Domain */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Industry / Domain
              </label>
              <input
                type="text"
                value={industryDomain}
                onChange={(e) => setIndustryDomain(e.target.value)}
                placeholder="e.g. Healthcare, Developer Tools, FinTech, Education"
                maxLength={120}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {INDUSTRY_DOMAINS.slice(0, 5).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setIndustryDomain(d)}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-[#6E05F2]/10 hover:text-[#6E05F2]"
                  >
                    + {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Existing Alternatives */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Existing Alternatives
              </label>
              <textarea
                rows={3}
                value={existingAlternatives}
                onChange={(e) => setExistingAlternatives(e.target.value)}
                maxLength={3000}
                placeholder="How do people solve this now? (Manual spreadsheets, costly enterprise vendors, etc.)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>

            {/* Market Opportunity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Market Opportunity (Optional)
              </label>
              <textarea
                rows={3}
                value={marketOpportunity}
                onChange={(e) => setMarketOpportunity(e.target.value)}
                maxLength={3000}
                placeholder="TAM / SAM estimations, emerging regulations, market timing tailwinds..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentSection(2)}
              className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              Next: Solution &amp; Specs <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: SOLUTION & PRODUCT SPECIFICATIONS
          ========================================================================= */}
      {currentSection === 2 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
                Section 2 of 6
              </span>
              <h2 className="text-xl font-bold text-[#171717] mt-0.5">
                Solution &amp; Product Specifications
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Specify your product approach, USP, roadmap, and dynamic feature list.
              </p>
            </div>
            <Sparkles className="h-6 w-6 text-[#6E05F2] shrink-0" />
          </div>

          {/* Proposed Solution */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Proposed Solution <span className="text-rose-500">*</span>
              </label>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() => openAiAssistant('proposedSolution', 'Proposed Solution', proposedSolution)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E05F2] hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Improve with AI
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={proposedSolution}
              onChange={(e) => setProposedSolution(e.target.value)}
              maxLength={6000}
              placeholder="How does your architecture, algorithm, or SaaS tool solve the problem?"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          {/* Detailed Description & Roadmap */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Detailed Description &amp; Roadmap <span className="text-rose-500">*</span>
              </label>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() =>
                    openAiAssistant('detailedDescription', 'Detailed Description & Roadmap', detailedDescription)
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E05F2] hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Improve with AI
                </button>
              )}
            </div>
            <textarea
              rows={6}
              value={detailedDescription}
              onChange={(e) => setDetailedDescription(e.target.value)}
              maxLength={12000}
              placeholder="Technical architecture, user journey, phased roadmap milestones (Phase 1, Phase 2, Launch)..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          {/* Unique Selling Proposition */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unique Selling Proposition (USP)
            </label>
            <input
              type="text"
              value={uniqueSellingProposition}
              onChange={(e) => setUniqueSellingProposition(e.target.value)}
              maxLength={2000}
              placeholder="What makes your approach 10x faster, cheaper, or fundamentally novel?"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          {/* Dynamic Key Features List */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#171717]">Key Features</p>
                <p className="text-[11px] text-slate-500">
                  Add concrete product capabilities your collaborators will build.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {aiEnabled && (
                  <button
                    type="button"
                    onClick={() => openAiAssistant('keyFeatures', 'Key Features', JSON.stringify(keyFeatures))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E05F2] hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> Auto-Generate
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#6E05F2] hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Feature
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {keyFeatures.map((feat, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={feat.title}
                      onChange={(e) => handleUpdateFeature(index, 'title', e.target.value)}
                      placeholder={`Feature #${index + 1} Title (e.g. End-to-end Encrypted Webhook Relayer)`}
                      className="w-full font-semibold text-xs text-[#171717] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(index)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Remove feature"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={feat.description}
                    onChange={(e) => handleUpdateFeature(index, 'description', e.target.value)}
                    placeholder="Short description or technical deliverable notes..."
                    className="w-full text-xs text-slate-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Expected Outcome */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Outcome
              </label>
              <textarea
                rows={3}
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                maxLength={3000}
                placeholder="e.g. Functional prototype ready for pilot beta with 50 clinic partners..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>

            {/* Success Metrics */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Success Metrics
              </label>
              <textarea
                rows={3}
                value={successMetrics}
                onChange={(e) => setSuccessMetrics(e.target.value)}
                maxLength={2000}
                placeholder="e.g. Sub-200ms latency, 99.9% uptime, 100 weekly active builders..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>
          </div>

          {/* Reference Links */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#171717]">Reference &amp; Inspiration Links</p>
                <p className="text-[11px] text-slate-500">
                  Add external URLs for research papers, similar products, or architecture diagrams.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddLink}
                className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#2057E8] hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add URL
              </button>
            </div>

            {referenceLinks.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No reference links added yet.</p>
            ) : (
              <div className="space-y-2">
                {referenceLinks.map((linkItem, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-center gap-2 rounded-xl bg-white border border-slate-200 p-2 text-xs"
                  >
                    <input
                      type="text"
                      value={linkItem.title}
                      onChange={(e) => handleUpdateLink(idx, 'title', e.target.value)}
                      placeholder="Title or label (e.g. Whitepaper)"
                      className="w-full sm:w-1/3 rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-[#2057E8] focus:outline-none"
                    />
                    <input
                      type="url"
                      value={linkItem.url}
                      onChange={(e) => handleUpdateLink(idx, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full sm:flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-[#2057E8] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentSection(1)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#171717]"
            >
              <ArrowLeft className="h-4 w-4" /> Back: Basics
            </button>
            <button
              type="button"
              onClick={() => setCurrentSection(3)}
              className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              Next: Team &amp; Collab <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 3: TEAM, SKILLS & COLLABORATION
          ========================================================================= */}
      {currentSection === 3 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
                Section 3 of 6
              </span>
              <h2 className="text-xl font-bold text-[#171717] mt-0.5">
                Team, Skills &amp; Collaboration
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure your required roles, work arrangement, commitment expectations, and compensation models.
              </p>
            </div>
            <Users className="h-6 w-6 text-[#6E05F2] shrink-0" />
          </div>

          {/* Category & Project Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              >
                {categories.length === 0 && (
                  <option value="AI & Machine Learning">AI &amp; Machine Learning</option>
                )}
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project Stage</label>
              <select
                value={projectStage}
                onChange={(e) => setProjectStage(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              >
                <option value="concept">Concept</option>
                <option value="validation">Validation</option>
                <option value="prototype">Prototype</option>
                <option value="mvp">MVP Ready</option>
                <option value="launched">Launched</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Duration
              </label>
              <input
                type="text"
                value={expectedDuration}
                onChange={(e) => setExpectedDuration(e.target.value)}
                placeholder="e.g. 2 - 4 months"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Team Size
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
              />
            </div>
          </div>

          {/* A. Required Team Roles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                A. Required Team Roles <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {requiredRoles.length} role(s) selected
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {PREDEFINED_ROLES.map((role) => {
                const selected = requiredRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleToggleRole(role)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                      selected
                        ? 'border-[#6E05F2] bg-[#6E05F2] text-white shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '} {role}
                  </button>
                );
              })}
            </div>

            {/* Custom Role Input */}
            <div className="flex items-center gap-2 max-w-md pt-1">
              <input
                type="text"
                value={customRoleInput}
                onChange={(e) => setCustomRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomRole())}
                placeholder="Add custom role (e.g. Prompt Engineer, Growth Hacker)..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomRole}
                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Add Role
              </button>
            </div>
          </div>

          {/* Required Skills */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Required Skills</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {skillsList.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#6E05F2]/20 bg-[#6E05F2]/5 px-2.5 py-1 text-xs font-semibold text-[#6E05F2]"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                placeholder="Type skill & press Enter (e.g. Python, Tailwind, WebAssembly)..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-[#6E05F2] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Add
              </button>
            </div>
          </div>

          {/* B. Collaboration Type (Selectable Cards) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              B. Collaboration Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {COLLABORATION_TYPES.map((type) => {
                const isSelected = collaborationType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setCollaborationType(type.id)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-[#6E05F2] bg-[#6E05F2]/5 ring-1 ring-[#6E05F2]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#171717]">{type.label}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">{type.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* C. Work Arrangement */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              C. Work Arrangement
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {WORK_ARRANGEMENTS.map((arr) => {
                const isSelected = workArrangement === arr.id;
                return (
                  <button
                    key={arr.id}
                    type="button"
                    onClick={() => setWorkArrangement(arr.id)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-[#2057E8] bg-[#2057E8]/5 ring-1 ring-[#2057E8]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#171717]">{arr.label}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">{arr.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* D. Weekly Time Commitment */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              D. Weekly Time Commitment
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TIME_COMMITMENTS.map((tc) => {
                const isSelected = weeklyCommitment === tc.id;
                return (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setWeeklyCommitment(tc.id)}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-[#CD2BE2] bg-[#CD2BE2]/5 ring-1 ring-[#CD2BE2]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#171717]">{tc.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{tc.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* E. Compensation Model */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              E. Compensation Model
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {COMPENSATION_MODELS.map((comp) => {
                const isSelected = compensationModel === comp.id;
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => setCompensationModel(comp.id)}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-[#6E05F2] bg-[#6E05F2]/5 ring-1 ring-[#6E05F2]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#171717]">{comp.label}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">{comp.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collaboration Requirements & Commitment Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Collaboration Requirements &amp; Commitment Note
            </label>
            <textarea
              rows={3}
              value={collaborationRequirements}
              onChange={(e) => setCollaborationRequirements(e.target.value)}
              maxLength={3000}
              placeholder="Communication expectations (Discord, Slack, daily async standups, GitHub repo etiquette)..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#6E05F2] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentSection(2)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#171717]"
            >
              <ArrowLeft className="h-4 w-4" /> Back: Specs
            </button>
            <button
              type="button"
              onClick={() => setCurrentSection(4)}
              className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              Next: Privacy &amp; NDA <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 4: PRIVACY, NDA & OWNERSHIP PROTECTION
          ========================================================================= */}
      {currentSection === 4 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
                Section 4 of 6
              </span>
              <h2 className="text-xl font-bold text-[#171717] mt-0.5">
                Privacy, NDA &amp; Ownership Protection
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Control who can discover, view, and join your project with recorded audit timestamps.
              </p>
            </div>
            <ShieldCheck className="h-6 w-6 text-[#6E05F2] shrink-0" />
          </div>

          {/* A. Visibility Settings (Selectable Cards) */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              A. Visibility Settings
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                {
                  id: 'public',
                  title: 'Public',
                  badge: 'Explore Feed',
                  desc: 'Appears in public search & Explore. Protected technical details stay restricted according to NDA settings.',
                  icon: Globe,
                },
                {
                  id: 'unlisted',
                  title: 'Unlisted Link',
                  badge: 'Private Link',
                  desc: 'Hidden from Explore and search. Accessible exclusively through a secure, revocable sharing link.',
                  icon: Link2,
                },
                {
                  id: 'private',
                  title: 'Private',
                  badge: 'Stealth Mode',
                  desc: 'Only you and explicitly authorized collaborators can access it. Never exposed in public APIs or search.',
                  icon: Lock,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = visibility === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVisibility(item.id)}
                    className={`flex flex-col items-start p-4 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-[#6E05F2] bg-[#6E05F2]/5 ring-1 ring-[#6E05F2] shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-1.5 font-bold text-sm text-[#171717]">
                        <Icon className="h-4 w-4 text-[#6E05F2]" /> {item.title}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. NDA Protection */}
          <div className="rounded-2xl border border-[#6E05F2]/20 bg-[#6E05F2]/[0.03] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="protectWithNda"
                type="checkbox"
                checked={protectDetailsWithNDA}
                onChange={(e) => setProtectDetailsWithNDA(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#6E05F2] focus:ring-[#6E05F2]"
              />
              <div className="space-y-1">
                <label
                  htmlFor="protectWithNda"
                  className="text-sm font-bold text-[#171717] cursor-pointer"
                >
                  Require Confidentiality Agreement / NDA Before Revealing Full Details
                </label>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When enabled, visitors see only your Public Summary &amp; Problem Statement. Proposed
                  solutions, detailed roadmaps, and protected attachments remain locked until the viewer
                  signs a recorded confidentiality acknowledgement.
                </p>
              </div>
            </div>

            {/* Legal Notice */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Important Legal Notice:</strong> IdeaSpark records electronic acknowledgements
                with timestamp, user ID, IP hash, and agreement version. In-app acknowledgements record
                intent and audit trails, but do not replace executed formal legal contracts.
              </div>
            </div>

            {/* Custom NDA Upload */}
            {protectDetailsWithNDA && (
              <div className="pt-2 border-t border-[#6E05F2]/10 space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Optional Custom NDA Document (PDF or TXT, max 8MB)
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
                    <FileUp className="h-4 w-4 text-[#6E05F2]" />
                    Upload Custom NDA Document
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={(e) => handleFileUpload(e, true)}
                      className="hidden"
                    />
                  </label>
                  {customNda.name && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                      <Check className="h-3.5 w-3.5" /> {customNda.name}
                      <button
                        type="button"
                        onClick={() => setCustomNda({ url: '', storageKey: '', name: '' })}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* D. Additional Privacy & Collaboration Controls */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Additional Access Controls
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center justify-between rounded-xl bg-white border border-slate-200 p-3.5 cursor-pointer">
                <div className="pr-3">
                  <p className="text-xs font-bold text-[#171717]">Allow Collaboration Requests</p>
                  <p className="text-[11px] text-slate-500">
                    Builders can apply with personalized applications
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowCollaborationRequests}
                  onChange={(e) => setAllowCollaborationRequests(e.target.checked)}
                  className="h-4 w-4 rounded text-[#6E05F2]"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl bg-white border border-slate-200 p-3.5 cursor-pointer">
                <div className="pr-3">
                  <p className="text-xs font-bold text-[#171717]">Require Owner Approval</p>
                  <p className="text-[11px] text-slate-500">
                    Applications must be vetted by you before workspace invite
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={requireOwnerApproval}
                  onChange={(e) => setRequireOwnerApproval(e.target.checked)}
                  className="h-4 w-4 rounded text-[#6E05F2]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Number of Collaborators
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxCollaborators}
                  onChange={(e) => setMaxCollaborators(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Private Link Expiration (Optional)
                </label>
                <input
                  type="date"
                  value={shareLinkExpiresAt}
                  onChange={(e) => setShareLinkExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* C. Ownership & Version History (Edit Mode) */}
          {mode === 'edit' && initialIdea && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#6E05F2]" />
                  <p className="text-xs font-bold text-[#171717]">
                    Ownership Timestamp &amp; Version History
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-600">
                  Version v{initialIdea.version || 1}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                  <p className="text-slate-400">Idea ID</p>
                  <p className="font-mono font-bold text-[#171717]">{initialIdea.ideaCode}</p>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                  <p className="text-slate-400">Created At</p>
                  <p className="font-semibold text-[#171717]">
                    {new Date(initialIdea.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                  <p className="text-slate-400">Last Updated</p>
                  <p className="font-semibold text-[#171717]">
                    {new Date(initialIdea.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                  <p className="text-slate-400">Total Revisions</p>
                  <p className="font-semibold text-[#171717]">
                    {initialIdea.editHistory?.length || 0} recorded
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Changelog Summary for this Update
                </label>
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="e.g. Added target audience, updated key features for pilot"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs focus:border-[#6E05F2] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentSection(3)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#171717]"
            >
              <ArrowLeft className="h-4 w-4" /> Back: Team
            </button>
            <button
              type="button"
              onClick={() => setCurrentSection(5)}
              className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              Next: Attachments <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 5: ATTACHMENTS & REFERENCES
          ========================================================================= */}
      {currentSection === 5 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
                Section 5 of 6
              </span>
              <h2 className="text-xl font-bold text-[#171717] mt-0.5">Attachments &amp; Files</h2>
              <p className="text-xs text-slate-500 mt-1">
                Attach pitch decks, UI wireframes, architecture briefs, or research documents (PDF, PNG, JPG, WEBP, TXT).
              </p>
            </div>
            <FileText className="h-6 w-6 text-[#6E05F2] shrink-0" />
          </div>

          {/* Upload Dropzone */}
          <label className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#6E05F2]/30 bg-[#6E05F2]/[0.02] p-8 text-center cursor-pointer hover:border-[#6E05F2] transition">
            <UploadCloud className="h-10 w-10 text-[#6E05F2]" />
            <p className="mt-3 text-sm font-bold text-[#171717]">
              Click to browse or drop project files here
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Permitted formats: PDF, PNG, JPG, WEBP, TXT (Maximum 8MB per file)
            </p>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={(e) => handleFileUpload(e, false)}
              className="hidden"
            />
          </label>

          {/* Upload Progress Indicator */}
          {uploadProgress && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 truncate">{uploadProgress.name}</span>
                <span className="font-mono text-[#6E05F2]">{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full brand-gradient-bg transition-all"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Uploaded File List with Preview & NDA Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#171717]">
                Uploaded Attachments ({attachments.length})
              </p>
              <span className="text-[11px] text-slate-400">
                You can toggle protection per attachment
              </span>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No attachments added yet. You can publish without attachments or upload files above.
              </p>
            ) : (
              <div className="space-y-2.5">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.url}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#F8F9FC] p-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2057E8]/10 text-[#2057E8] shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171717] truncate">{att.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {(att.size ? (att.size / 1024).toFixed(0) : 0)} KB •{' '}
                          {att.isProtected ? 'NDA Protected' : 'Public Attachment'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAttachmentProtection(idx)}
                        className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold border ${
                          att.isProtected
                            ? 'border-[#6E05F2]/30 bg-[#6E05F2]/10 text-[#6E05F2]'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {att.isProtected ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {att.isProtected ? 'Protected' : 'Public'}
                      </button>

                      {att.url && (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="rounded-xl border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Remove file"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentSection(4)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#171717]"
            >
              <ArrowLeft className="h-4 w-4" /> Back: Privacy
            </button>
            <button
              type="button"
              onClick={() => setCurrentSection(6)}
              className="inline-flex items-center gap-1.5 rounded-xl brand-gradient-bg px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              Next: Review &amp; Publish <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 6: REVIEW & PUBLISH
          ========================================================================= */}
      {currentSection === 6 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E05F2]">
                Section 6 of 6
              </span>
              <h2 className="text-xl font-bold text-[#171717] mt-0.5">
                Review &amp; Publish
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Preview your idea exactly as collaborators and public visitors will see it before publishing.
              </p>
            </div>

            {/* Audience Toggle */}
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setReviewAudienceTab('public')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  reviewAudienceTab === 'public'
                    ? 'bg-white text-[#171717] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Public Visitor View
              </button>
              <button
                type="button"
                onClick={() => setReviewAudienceTab('protected')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  reviewAudienceTab === 'protected'
                    ? 'bg-[#6E05F2] text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Full Owner / NDA View
              </button>
            </div>
          </div>

          {/* Validation Warnings if Incomplete */}
          {!sectionStatus.s6 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <p className="font-bold">Some required fields still need attention before publishing:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800">
                  {(!title || title.length < 5) && <li>Title must be at least 5 characters (Section 1)</li>}
                  {(shortSummary.length < 20 || shortSummary.length > 320) && (
                    <li>Short Public Summary must be 20–320 characters (Section 1)</li>
                  )}
                  {(!problemStatement || problemStatement.length < 15) && (
                    <li>Problem Statement must be at least 15 characters (Section 1)</li>
                  )}
                  {(!proposedSolution || proposedSolution.length < 15) && (
                    <li>Proposed Solution must be at least 15 characters (Section 2)</li>
                  )}
                  {(!detailedDescription || detailedDescription.length < 30) && (
                    <li>Detailed Description &amp; Roadmap must be at least 30 characters (Section 2)</li>
                  )}
                  {requiredRoles.length === 0 && <li>Select at least one required role (Section 3)</li>}
                </ul>
                <p className="mt-2 text-slate-600">
                  You can click <strong>Save as Draft</strong> anytime to save incomplete progress to your account.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Preview Container */}
          <div className="rounded-3xl border border-slate-200 bg-[#F8F9FC] p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {category || 'Category'}
                </span>
                <span className="rounded-full bg-purple-50 text-[#6E05F2] border border-purple-200 px-2.5 py-0.5 text-xs font-semibold capitalize">
                  {projectStage}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                    visibility === 'public'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : visibility === 'unlisted'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {visibility}
                </span>
                {protectDetailsWithNDA && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#6E05F2]/10 text-[#6E05F2] border border-[#6E05F2]/20 px-2.5 py-0.5 text-xs font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" /> NDA Gated
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-slate-400">
                {mode === 'edit' ? initialIdea?.ideaCode : 'ISP-PREVIEW'}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-[#171717]">
                {title || 'Untitled Idea'}
              </h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {shortSummary || 'No short summary provided.'}
              </p>
            </div>

            {/* Target Audience & Industry Chips */}
            {(targetAudience || industryDomain) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {industryDomain && (
                  <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-slate-700">
                    <strong>Industry:</strong> {industryDomain}
                  </span>
                )}
                {targetAudience && (
                  <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-slate-700">
                    <strong>Audience:</strong> {targetAudience}
                  </span>
                )}
              </div>
            )}

            {/* Problem Statement Card */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Problem Statement
              </p>
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {problemStatement || 'No problem statement provided.'}
              </p>
            </div>

            {/* Protected Details Section (conditioned on preview audience) */}
            {reviewAudienceTab === 'public' && protectDetailsWithNDA ? (
              <div className="rounded-2xl border-2 border-dashed border-[#6E05F2]/30 bg-white p-8 text-center space-y-2">
                <ShieldCheck className="mx-auto h-8 w-8 text-[#6E05F2]" />
                <p className="text-sm font-bold text-[#171717]">
                  Protected Specifications &amp; Architecture (NDA Gated)
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Public visitors will see this locked banner until they sign your recorded confidentiality terms.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Proposed Solution
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-line mt-1 leading-relaxed">
                    {proposedSolution || 'No proposed solution provided.'}
                  </p>
                </div>

                {uniqueSellingProposition && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Unique Selling Proposition (USP)
                    </p>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {uniqueSellingProposition}
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Detailed Description &amp; Roadmap
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-line mt-1 leading-relaxed">
                    {detailedDescription || 'No detailed roadmap provided.'}
                  </p>
                </div>

                {keyFeatures.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Key Features
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {keyFeatures.map((feat, i) => (
                        <div key={i} className="rounded-xl bg-[#F8F9FC] border border-slate-200 p-2.5 text-xs">
                          <p className="font-bold text-[#171717]">{feat.title}</p>
                          {feat.description && (
                            <p className="text-slate-600 mt-0.5">{feat.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Team & Collaboration Summary */}
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Team &amp; Collaboration Specifications
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-slate-400">Team Size:</span>
                  <p className="font-bold text-[#171717] mt-0.5">{teamSize} members</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-slate-400">Work Style:</span>
                  <p className="font-bold text-[#171717] mt-0.5 capitalize">{workArrangement}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-slate-400">Commitment:</span>
                  <p className="font-bold text-[#171717] mt-0.5">{weeklyCommitment} hrs/wk</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-slate-400">Compensation:</span>
                  <p className="font-bold text-[#171717] mt-0.5 capitalize">{compensationModel}</p>
                </div>
              </div>

              {requiredRoles.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Roles Recruited:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {requiredRoles.map((role) => (
                      <span
                        key={role}
                        className="rounded-lg bg-[#2057E8]/10 border border-[#2057E8]/20 px-2.5 py-1 text-xs font-semibold text-[#2057E8]"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Attachments ({attachments.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-100"
                    >
                      <span className="font-semibold text-slate-700 truncate">{att.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {att.isProtected ? 'NDA Protected' : 'Public'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Three Primary Actions: Draft / Switch Section / Publish */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentSection(5)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#171717]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Edit Sections
            </button>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleSaveDraftAction}
                disabled={submitting}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> Save as Draft
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={submitting}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl brand-gradient-bg px-7 py-3 text-sm font-bold text-white shadow-md hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Publishing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> {mode === 'edit' ? 'Update & Publish' : 'Publish Idea'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Writing Assistant Modal */}
      <AiAssistantModal
        open={aiModalState.open}
        onClose={() => setAiModalState((prev) => ({ ...prev, open: false }))}
        field={aiModalState.field}
        fieldLabel={aiModalState.fieldLabel}
        currentValue={aiModalState.currentValue}
        contextData={{ title, shortSummary, problemStatement, category }}
        onApply={handleApplyAiSuggestion}
      />
    </div>
  );
}
