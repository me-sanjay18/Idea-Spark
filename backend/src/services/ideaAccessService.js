import { Agreement } from '../models/Agreement.js';
import { Collaboration } from '../models/Collaboration.js';

export async function evaluateIdeaAccess(idea, user = null, shareToken = '') {
  const userId = user?._id ? String(user._id) : null;
  const creatorId = String(idea.creator?._id || idea.creator);
  const isOwner = Boolean(userId && userId === creatorId);
  const isAdmin = Boolean(user?.role === 'admin');

  let isCollaborator = false;
  let isExplicitlyAuthorized = false;
  let hasAcceptedNda = false;
  let ndaRevoked = false;
  let collaborationId = null;

  if (userId) {
    isExplicitlyAuthorized = (idea.authorizedUsers || []).some(
      (u) => String(u?._id || u) === userId
    );

    const collab = await Collaboration.findOne({
      idea: idea._id,
      'members.user': user._id,
    }).select('_id');

    if (collab) {
      isCollaborator = true;
      collaborationId = String(collab._id);
    } else if (isOwner) {
      const ownerCollab = await Collaboration.findOne({ idea: idea._id }).select('_id');
      if (ownerCollab) collaborationId = String(ownerCollab._id);
    }

    if (idea.protectDetailsWithNDA) {
      const agreement = await Agreement.findOne({
        user: user._id,
        idea: idea._id,
        agreementVersion: idea.ndaVersion || 1,
      }).select('_id acceptedAt revokedAt');

      if (agreement) {
        if (agreement.revokedAt) {
          ndaRevoked = true;
          hasAcceptedNda = false;
        } else {
          hasAcceptedNda = true;
        }
      }
    }
  }

  // 1. Lifecycle & Visibility checks
  if (idea.status === 'removed' && !isAdmin && !isOwner) {
    return { canViewIdea: false, reason: 'IDEA_REMOVED' };
  }

  // Draft ideas are strictly visible ONLY to the owner (and platform admin if moderating)
  if (idea.status === 'draft' && !isOwner && !isAdmin) {
    return { canViewIdea: false, reason: 'IDEA_DRAFT' };
  }

  if (idea.status === 'archived' && !isOwner && !isCollaborator && !isAdmin) {
    return { canViewIdea: false, reason: 'IDEA_ARCHIVED' };
  }

  if (idea.visibility === 'private') {
    const allowedPrivate = isOwner || isCollaborator || isExplicitlyAuthorized || isAdmin;
    if (!allowedPrivate) {
      return { canViewIdea: false, reason: 'PRIVATE_IDEA' };
    }
  }

  let usedValidShareToken = false;
  if (idea.visibility === 'unlisted') {
    const tokenMatches = Boolean(shareToken && idea.shareToken && shareToken === idea.shareToken);
    const isLinkExpired = Boolean(
      idea.shareLinkExpiresAt && new Date(idea.shareLinkExpiresAt).getTime() <= Date.now()
    );
    const isLinkRevoked = Boolean(idea.shareLinkRevoked);
    const hasValidShareToken = tokenMatches && !isLinkExpired && !isLinkRevoked;
    usedValidShareToken = hasValidShareToken;

    const allowedUnlisted =
      isOwner || isCollaborator || isExplicitlyAuthorized || isAdmin || hasValidShareToken;

    if (!allowedUnlisted) {
      if (tokenMatches && (isLinkExpired || isLinkRevoked)) {
        return { canViewIdea: false, reason: 'SHARE_LINK_EXPIRED_OR_REVOKED' };
      }
      return { canViewIdea: false, reason: 'UNLISTED_TOKEN_REQUIRED' };
    }
  }

  // 2. Protected details check (Section 2 specs, proposed solution, detailed description, protected attachments)
  let canViewProtectedDetails = false;
  let requiresNdaAcceptance = false;
  let requiresAuthenticationForDetails = false;

  if (isOwner || isCollaborator || isAdmin) {
    canViewProtectedDetails = true;
  } else if (idea.protectDetailsWithNDA) {
    if (!userId) {
      requiresAuthenticationForDetails = true;
      requiresNdaAcceptance = true;
      canViewProtectedDetails = false;
    } else if (hasAcceptedNda) {
      canViewProtectedDetails = true;
    } else {
      requiresNdaAcceptance = true;
      canViewProtectedDetails = false;
    }
  } else {
    if (!userId) {
      requiresAuthenticationForDetails = true;
      canViewProtectedDetails = false;
    } else {
      canViewProtectedDetails = true;
    }
  }

  return {
    canViewIdea: true,
    canViewProtectedDetails,
    requiresNdaAcceptance,
    requiresAuthenticationForDetails,
    hasAcceptedNda,
    ndaRevoked,
    usedValidShareToken,
    isOwner,
    isCollaborator,
    isExplicitlyAuthorized,
    isAdmin,
    collaborationId,
  };
}

export function serializeIdeaForViewer(
  ideaDoc,
  access,
  { isBookmarked = false, isUpvoted = false, includeShareToken = false, shareToken = '' } = {}
) {
  const raw = ideaDoc.toObject ? ideaDoc.toObject() : { ...ideaDoc };
  const tokenQuery = shareToken ? `?token=${encodeURIComponent(shareToken)}` : '';

  const hasCustomNda = Boolean(raw.customNdaUrl || raw.customNdaStorageKey);
  const safeCustomNdaUrl =
    access.canViewIdea && hasCustomNda ? `/api/ideas/${raw._id}/nda-document${tokenQuery}` : '';

  const safeIdea = {
    _id: raw._id,
    ideaCode: raw.ideaCode,
    creator: raw.creator,
    version: raw.version || 1,

    // Section 1 (Public-tier pitch & problem context)
    title: raw.title,
    shortSummary: raw.shortSummary,
    problemStatement: raw.problemStatement,
    targetAudience: raw.targetAudience || '',
    industryDomain: raw.industryDomain || '',
    existingAlternatives: raw.existingAlternatives || '',
    marketOpportunity: raw.marketOpportunity || '',

    // Section 3 (Team & Collaboration metadata)
    category: raw.category,
    requiredSkills: raw.requiredSkills || [],
    requiredRoles: raw.requiredRoles || [],
    expectedDuration: raw.expectedDuration,
    teamSize: raw.teamSize,
    projectStage: raw.projectStage,
    collaborationType: raw.collaborationType || 'startup',
    workArrangement: raw.workArrangement || 'remote',
    weeklyCommitment: raw.weeklyCommitment || '5-10',
    compensationModel: raw.compensationModel || 'open',

    // Section 4 (Visibility, NDA & Collaboration Rules)
    visibility: raw.visibility,
    status: raw.status,
    protectDetailsWithNDA: Boolean(raw.protectDetailsWithNDA),
    ndaVersion: raw.ndaVersion || 1,
    customNdaUrl: safeCustomNdaUrl,
    customNdaName: access.canViewIdea ? raw.customNdaName || '' : '',
    allowCollaborationRequests: raw.allowCollaborationRequests !== false,
    requireOwnerApproval: raw.requireOwnerApproval !== false,
    maxCollaborators: raw.maxCollaborators || raw.teamSize || 5,

    // Engagement & Audit Counters
    upvoteCount: raw.upvoteCount || 0,
    bookmarkCount: raw.bookmarkCount || 0,
    collaboratorCount: raw.collaboratorCount || 1,
    viewsCount: raw.viewsCount || 0,
    featured: Boolean(raw.featured),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    isBookmarked,
    isUpvoted,
    access: {
      isOwner: access.isOwner,
      isCollaborator: access.isCollaborator,
      canViewProtectedDetails: access.canViewProtectedDetails,
      requiresNdaAcceptance: access.requiresNdaAcceptance,
      requiresAuthenticationForDetails: access.requiresAuthenticationForDetails,
      hasAcceptedNda: access.hasAcceptedNda,
      ndaRevoked: Boolean(access.ndaRevoked),
      collaborationId: access.collaborationId,
    },
  };

  const mapAttachmentForViewer = (att) => {
    const secureUrl = `/api/ideas/${raw._id}/attachments/${att._id}${tokenQuery}`;
    const serialized = {
      _id: att._id,
      name: att.name,
      url: secureUrl,
      mimeType: att.mimeType,
      size: att.size,
      isProtected: Boolean(att.isProtected),
      uploadedAt: att.uploadedAt,
    };
    if (access.isOwner) {
      serialized.storageKey = att.storageKey || '';
      serialized.publicId = att.publicId || '';
    }
    return serialized;
  };

  if (access.canViewProtectedDetails) {
    safeIdea.proposedSolution = raw.proposedSolution || '';
    safeIdea.detailedDescription = raw.detailedDescription || '';
    safeIdea.uniqueSellingProposition = raw.uniqueSellingProposition || '';
    safeIdea.keyFeatures = raw.keyFeatures || [];
    safeIdea.expectedOutcome = raw.expectedOutcome || '';
    safeIdea.successMetrics = raw.successMetrics || '';
    safeIdea.referenceLinks = raw.referenceLinks || [];
    safeIdea.collaborationRequirements = raw.collaborationRequirements || '';
    safeIdea.attachments = (raw.attachments || []).map(mapAttachmentForViewer);
    safeIdea.protectedAttachmentsCount = (raw.attachments || []).filter((a) => a.isProtected).length;
  } else {
    safeIdea.proposedSolution = null;
    safeIdea.detailedDescription = null;
    safeIdea.uniqueSellingProposition = null;
    safeIdea.keyFeatures = [];
    safeIdea.expectedOutcome = null;
    safeIdea.successMetrics = null;
    safeIdea.referenceLinks = [];
    safeIdea.collaborationRequirements = raw.collaborationRequirements || '';
    safeIdea.attachments = (raw.attachments || [])
      .filter((att) => !att.isProtected)
      .map(mapAttachmentForViewer);
    safeIdea.protectedAttachmentsCount = (raw.attachments || []).filter((att) => att.isProtected).length;
  }

  if (access.isOwner || access.isCollaborator || access.isAdmin) {
    safeIdea.editHistory = raw.editHistory || [];
    safeIdea.ownershipHistory = raw.ownershipHistory || [];
    safeIdea.authorizedUsers = raw.authorizedUsers || [];
  } else {
    safeIdea.editCount = (raw.editHistory || []).length;
    safeIdea.ownershipHistory = (raw.ownershipHistory || []).map((item) => ({
      action: item.action,
      timestamp: item.timestamp,
    }));
  }

  if (access.isOwner) {
    safeIdea.shareLinkExpiresAt = raw.shareLinkExpiresAt || null;
    safeIdea.shareLinkRevoked = Boolean(raw.shareLinkRevoked);
    safeIdea.customNdaStorageKey = raw.customNdaStorageKey || '';
  }

  if ((access.isOwner || includeShareToken) && raw.shareToken) {
    safeIdea.shareToken = raw.shareToken;
  }

  return safeIdea;
}

export function serializeIdeaCard(
  ideaDoc,
  { isBookmarked = false, isUpvoted = false, includeOwnerFields = false } = {}
) {
  const raw = ideaDoc.toObject ? ideaDoc.toObject() : { ...ideaDoc };
  const card = {
    _id: raw._id,
    ideaCode: raw.ideaCode,
    creator: raw.creator,
    version: raw.version || 1,
    title: raw.title,
    shortSummary: raw.shortSummary,
    category: raw.category,
    industryDomain: raw.industryDomain || '',
    requiredSkills: raw.requiredSkills || [],
    requiredRoles: raw.requiredRoles || [],
    expectedDuration: raw.expectedDuration,
    teamSize: raw.teamSize,
    maxCollaborators: raw.maxCollaborators || raw.teamSize || 5,
    projectStage: raw.projectStage,
    collaborationType: raw.collaborationType || 'startup',
    workArrangement: raw.workArrangement || 'remote',
    weeklyCommitment: raw.weeklyCommitment || '5-10',
    compensationModel: raw.compensationModel || 'open',
    visibility: raw.visibility,
    status: raw.status,
    protectDetailsWithNDA: Boolean(raw.protectDetailsWithNDA),
    allowCollaborationRequests: raw.allowCollaborationRequests !== false,
    upvoteCount: raw.upvoteCount || 0,
    bookmarkCount: raw.bookmarkCount || 0,
    collaboratorCount: raw.collaboratorCount || 1,
    viewsCount: raw.viewsCount || 0,
    featured: Boolean(raw.featured),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    isBookmarked,
    isUpvoted,
  };

  if (includeOwnerFields) {
    if (raw.shareToken) card.shareToken = raw.shareToken;
    card.shareLinkRevoked = Boolean(raw.shareLinkRevoked);
    card.shareLinkExpiresAt = raw.shareLinkExpiresAt || null;
  }

  return card;
}
