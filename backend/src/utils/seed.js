import { Bookmark } from '../models/Bookmark.js';
import { Category } from '../models/Category.js';
import { Collaboration } from '../models/Collaboration.js';
import { Conversation } from '../models/Conversation.js';
import { Idea } from '../models/Idea.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Vote } from '../models/Vote.js';

export const DEFAULT_CATEGORIES = [
  {
    name: 'AI & Machine Learning',
    slug: 'ai-machine-learning',
    description: 'Intelligent agents, LLM workflows, computer vision, and ML tools.',
    icon: 'Cpu',
  },
  {
    name: 'Developer Tools',
    slug: 'developer-tools',
    description: 'Open-source frameworks, DevOps automation, APIs, and productivity CLIs.',
    icon: 'Code2',
  },
  {
    name: 'SaaS & Productivity',
    slug: 'saas-productivity',
    description: 'B2B software, workflow platforms, and collaborative workspaces.',
    icon: 'Layers',
  },
  {
    name: 'FinTech',
    slug: 'fintech',
    description: 'Payments, personal finance, treasury tooling, and compliance automation.',
    icon: 'Wallet',
  },
  {
    name: 'EdTech',
    slug: 'edtech',
    description: 'Cohort learning, peer mentorship, campus platforms, and skill builders.',
    icon: 'GraduationCap',
  },
  {
    name: 'HealthTech & Bio',
    slug: 'healthtech-bio',
    description: 'Digital diagnostics, patient care coordination, and wellness systems.',
    icon: 'HeartPulse',
  },
  {
    name: 'Climate & Sustainability',
    slug: 'climate-sustainability',
    description: 'Clean energy analytics, circular supply chains, and carbon tracking.',
    icon: 'Leaf',
  },
  {
    name: 'Cybersecurity & Privacy',
    slug: 'cybersecurity-privacy',
    description: 'Zero-trust tooling, application security, and privacy-first apps.',
    icon: 'ShieldCheck',
  },
  {
    name: 'Social Impact',
    slug: 'social-impact',
    description: 'Civic tech, accessibility tools, and community empowerment projects.',
    icon: 'Globe',
  },
];

export async function ensureCategories() {
  const count = await Category.countDocuments();
  if (count > 0) return;
  await Category.insertMany(DEFAULT_CATEGORIES);
}

export async function seedDemoData() {
  await ensureCategories();

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) return;

  const demoPasswordHash = await User.hashPassword('SparkDemo123');

  const [admin, maya, arjun, elena] = await User.create([
    {
      name: 'IdeaSpark Trust & Safety',
      username: 'admin',
      email: 'admin@ideaspark.local',
      passwordHash: demoPasswordHash,
      emailVerified: true,
      role: 'admin',
      headline: 'Platform Governance & Community Operations',
      bio: 'Ensuring safe collaboration, ownership transparency, and community standards across IdeaSpark.',
      skills: ['Security Architecture', 'IP Governance', 'Community Ops'],
    },
    {
      name: 'Maya Krishnan',
      username: 'mayak',
      email: 'maya@ideaspark.local',
      passwordHash: demoPasswordHash,
      emailVerified: true,
      headline: 'AI Systems Engineer & Product Builder',
      bio: 'Building applied AI tools for Healthcare & Education. Looking for passionate frontend and UX collaborators.',
      skills: ['Python', 'PyTorch', 'FastAPI', 'System Design'],
      interests: ['HealthTech & Bio', 'AI & Machine Learning', 'Accessibility'],
      socialLinks: {
        github: 'https://github.com/example-maya',
        linkedin: 'https://linkedin.com/in/example-maya',
      },
    },
    {
      name: 'Arjun Mehta',
      username: 'arjunm',
      email: 'arjun@ideaspark.local',
      passwordHash: demoPasswordHash,
      emailVerified: true,
      headline: 'Full-Stack Developer & UI Architect',
      bio: 'React, TypeScript, Node.js, and real-time collaborative systems enthusiast.',
      skills: ['React', 'Tailwind CSS', 'Node.js', 'PostgreSQL', 'Figma'],
      interests: ['Developer Tools', 'SaaS & Productivity', 'FinTech'],
    },
    {
      name: 'Elena Rostova',
      username: 'elenar',
      email: 'elena@ideaspark.local',
      passwordHash: demoPasswordHash,
      emailVerified: true,
      headline: 'Climate Data Scientist & Startup Founder',
      bio: 'Former sustainability analyst turning supply-chain emissions tracking into self-serve software for SMBs.',
      skills: ['Data Visualization', 'Product Strategy', 'SQL', 'Go'],
      interests: ['Climate & Sustainability', 'SaaS & Productivity'],
    },
  ]);

  const ideas = await Idea.create([
    {
      creator: maya._id,
      title: 'MedScribe Edge — Privacy-First Clinical Triage & Intake Copilot',
      shortSummary:
        'An on-device multilingual patient intake assistant for rural and community clinics that structures symptoms before physician consults without cloud PHI exposure.',
      problemStatement:
        'Community clinics lose 35% of consultation time gathering baseline multilingual intake notes, while cloud LLM tools create strict patient privacy barriers.',
      proposedSolution:
        'Use quantized local speech-to-structured-FHIR models running on clinic tablets with clinician-in-the-loop verification cards and offline sync.',
      detailedDescription:
        'MedScribe Edge combines Whisper-small local inference with a deterministic clinical symptom ontology mapper. Protected architecture includes local encrypted SQLite storage, HL7 FHIR R4 export adapters, and zero-retention audio buffers.',
      category: 'HealthTech & Bio',
      requiredSkills: ['React', 'UI/UX Design', 'WebAssembly', 'Python', 'FHIR'],
      expectedDuration: '3 - 6 months',
      teamSize: 4,
      projectStage: 'prototype',
      visibility: 'public',
      protectDetailsWithNDA: true,
      collaborationRequirements:
        'Looking for a React/PWA engineer and a healthcare UX designer comfortable with accessibility-first tablet interfaces (~8 hrs/week).',
      upvoteCount: 3,
      bookmarkCount: 2,
      collaboratorCount: 2,
      featured: true,
      authorizedUsers: [arjun._id],
      ownershipHistory: [
        {
          action: 'created',
          actor: maya._id,
          newValue: 'visibility:public | nda:true',
          timestamp: new Date(Date.now() - 6 * 86400000),
        },
      ],
    },
    {
      creator: arjun._id,
      title: 'PatchPulse — Live Breaking-Change Radar for Microservice Teams',
      shortSummary:
        'Automated OpenAPI, GraphQL, and event-schema diffing in pull requests that maps downstream consumer impact before merge.',
      problemStatement:
        'Engineering teams discover breaking API field changes in staging or production because contract diffs are siloed inside individual repositories.',
      proposedSolution:
        'A GitHub App + lightweight CLI graph indexer that traces cross-repo API consumers and posts interactive impact callouts directly on PRs.',
      detailedDescription:
        'PatchPulse parses TypeScript SDK calls, OpenAPI specs, and Protobuf schemas into a dependency graph. Collaborators will help build the interactive React dependency graph viewer and GitHub webhook ingestion worker.',
      category: 'Developer Tools',
      requiredSkills: ['TypeScript', 'Node.js', 'React', 'AST Parsing', 'GitHub API'],
      expectedDuration: '1 - 3 months',
      teamSize: 3,
      projectStage: 'mvp',
      visibility: 'public',
      protectDetailsWithNDA: false,
      collaborationRequirements:
        'Seeking a backend Node/Go developer and a developer-experience designer to ship our open-beta launch.',
      upvoteCount: 4,
      bookmarkCount: 2,
      collaboratorCount: 1,
      featured: true,
      ownershipHistory: [
        {
          action: 'created',
          actor: arjun._id,
          newValue: 'visibility:public | nda:false',
          timestamp: new Date(Date.now() - 4 * 86400000),
        },
      ],
    },
    {
      creator: elena._id,
      title: 'GreenLedger Lite — Automated Scope 3 Supplier Carbon Estimator',
      shortSummary:
        'Self-serve invoice and freight CSV analyzer helping small manufacturers generate audit-ready carbon disclosures in under 20 minutes.',
      problemStatement:
        'Mid-market and small suppliers face enterprise procurement mandates for carbon reporting but cannot afford $40k+/year sustainability consultants.',
      proposedSolution:
        'Automated spend & logistics categorization mapped against verified emission factor databases with one-click supplier disclosure PDFs.',
      detailedDescription:
        'Confidential calculation pipeline matching HS commodity codes, carrier routes, and regional grid intensities with explainable citation trails for auditors.',
      category: 'Climate & Sustainability',
      requiredSkills: ['React', 'Data Engineering', 'Tailwind CSS', 'Product Marketing'],
      expectedDuration: '3 - 6 months',
      teamSize: 4,
      projectStage: 'validation',
      visibility: 'public',
      protectDetailsWithNDA: true,
      collaborationRequirements:
        'Looking for a full-stack engineer and a B2B product designer excited about climate tech.',
      upvoteCount: 2,
      bookmarkCount: 1,
      collaboratorCount: 1,
      featured: true,
      ownershipHistory: [
        {
          action: 'created',
          actor: elena._id,
          newValue: 'visibility:public | nda:true',
          timestamp: new Date(Date.now() - 3 * 86400000),
        },
      ],
    },
    {
      creator: maya._id,
      title: 'CampusGuild — Peer Capstone & Hackathon Matchmaker for Universities',
      shortSummary:
        'Skill-verified student project formation platform pairing CS, design, and business students for semester-long capstones.',
      problemStatement:
        'University capstone teams form inside narrow friend groups, leaving engineering projects without designers and business students without technical co-builders.',
      proposedSolution:
        'Cross-department project boards with portfolio badges, milestone check-ins, and faculty advisor showcase pages.',
      detailedDescription:
        'Built specifically for university `.edu` cohorts with semester templates, skill balance indicators, and automated team retrospectives.',
      category: 'EdTech',
      requiredSkills: ['React', 'Express', 'MongoDB', 'UX Research'],
      expectedDuration: '1 - 3 months',
      teamSize: 5,
      projectStage: 'concept',
      visibility: 'public',
      protectDetailsWithNDA: false,
      collaborationRequirements: 'Student founders, campus ambassadors, and full-stack builders welcome!',
      upvoteCount: 1,
      bookmarkCount: 1,
      collaboratorCount: 1,
      featured: false,
      ownershipHistory: [
        {
          action: 'created',
          actor: maya._id,
          newValue: 'visibility:public | nda:false',
          timestamp: new Date(Date.now() - 2 * 86400000),
        },
      ],
    },
  ]);

  // Seed real Vote & Bookmark records matching upvoteCount & bookmarkCount so live toggles stay exact
  await Vote.create([
    { user: maya._id, idea: ideas[0]._id },
    { user: arjun._id, idea: ideas[0]._id },
    { user: elena._id, idea: ideas[0]._id },
    { user: admin._id, idea: ideas[1]._id },
    { user: maya._id, idea: ideas[1]._id },
    { user: arjun._id, idea: ideas[1]._id },
    { user: elena._id, idea: ideas[1]._id },
    { user: maya._id, idea: ideas[2]._id },
    { user: elena._id, idea: ideas[2]._id },
    { user: arjun._id, idea: ideas[3]._id },
  ]);

  await Bookmark.create([
    { user: arjun._id, idea: ideas[0]._id },
    { user: elena._id, idea: ideas[0]._id },
    { user: maya._id, idea: ideas[1]._id },
    { user: elena._id, idea: ideas[1]._id },
    { user: arjun._id, idea: ideas[2]._id },
    { user: elena._id, idea: ideas[3]._id },
  ]);

  // Seed active collaboration workspace for MedScribe Edge between Maya & Arjun
  const medScribe = ideas[0];
  const teamConv = await Conversation.create({
    type: 'team',
    title: `${medScribe.title} — Team Workspace`,
    participants: [maya._id, arjun._id],
    idea: medScribe._id,
  });

  const collab = await Collaboration.create({
    idea: medScribe._id,
    owner: maya._id,
    members: [
      { user: maya._id, role: 'Founder & AI Lead', isOwner: true },
      { user: arjun._id, role: 'Lead Frontend Architect', isOwner: false },
    ],
    milestones: [
      {
        title: 'Define offline tablet intake wireframes',
        description: 'Finalize high-contrast multilingual symptom cards for clinic nurses.',
        status: 'done',
        assignee: arjun._id,
        createdBy: maya._id,
      },
      {
        title: 'Integrate local FHIR JSON export preview',
        description: 'Connect structured intake state to clinician review screen.',
        status: 'in_progress',
        assignee: maya._id,
        createdBy: maya._id,
      },
    ],
    updates: [
      {
        author: maya._id,
        title: 'Prototype Benchmark Complete',
        content: 'Quantized intake parser runs in 420ms on standard clinic hardware!',
      },
    ],
    conversation: teamConv._id,
    status: 'active',
  });

  teamConv.collaboration = collab._id;
  const welcomeMsg = await Message.create({
    conversation: teamConv._id,
    sender: maya._id,
    content: 'Welcome to the MedScribe Edge workspace, Arjun! Excited to build the tablet UI together.',
    readBy: [{ user: maya._id }, { user: arjun._id }],
  });
  teamConv.lastMessage = welcomeMsg._id;
  teamConv.lastMessageAt = welcomeMsg.createdAt;
  await teamConv.save();

  return { admin, maya, arjun, elena };
}

// Allow standalone CLI execution via `npm run seed`
const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isDirectRun) {
  const { connectDB, disconnectDB } = await import('../config/db.js');
  await connectDB();
  await seedDemoData();
  console.log('[Seed] IdeaSpark categories and demo data seeded successfully.');
  await disconnectDB();
}

